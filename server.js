// server.js
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.raw({ type: '*/*' }));

const CONFIG_PATH = './providers.json';
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(CONFIG_PATH));
} catch (e) {
  console.error(`FATAL: Could not load or parse ${CONFIG_PATH}.`);
  process.exit(1);
}

const status = {};
for (const p of Object.keys(cfg)) {
  status[p] = cfg[p].map((_, i) => ({ idx: i, alive: true, fails: 0 }));
}

function getBaseURL(entry) {
  if (Array.isArray(entry.baseURL)) {
    // If baseURL is an array, assume the last entry is the most specific/correct one.
    return entry.baseURL[entry.baseURL.length - 1];
  }
  return entry.baseURL;
}

function nextKey(provider) {
  const pool = cfg[provider];
  if (!pool || pool.length === 0) return null;
  const st = status[provider];

  for (let r = 0; r < pool.length; r++) {
    const cand = st.find(s => s.alive);
    if (!cand) break;
    const chosen = st.shift();
    st.push(chosen);
    const idx = chosen.idx;
    const baseURL = getBaseURL(pool[idx]);
    return { key: pool[idx].key, baseURL, idx, meta: pool[idx].meta || {} };
  }

  const idx = st[0].idx;
  const baseURL = getBaseURL(pool[idx]);
  return { key: pool[idx].key, baseURL, idx, meta: pool[idx].meta || {} };
}

function markFail(provider, idx) {
  const s = status[provider] && status[provider].find(x => x.idx === idx);
  if (!s) return;
  s.fails = (s.fails || 0) + 1;
  if (s.fails >= 3) s.alive = false;
}

function markOk(provider, idx) {
  const s = status[provider] && status[provider].find(x => x.idx === idx);
  if (!s) return;
  s.fails = 0;
  s.alive = true;
}

setInterval(async () => {
  for (const p of Object.keys(cfg)) {
    for (const entry of cfg[p]) {
      const s = status[p].find(x => x.idx === cfg[p].indexOf(entry));
      if (!s || s.alive) continue;
      try {
        const probeUrl = getBaseURL(entry).replace(/\/+$/, '') + '/';
        await fetch(probeUrl, { method: 'HEAD', timeout: 3000 });
        s.alive = true;
        s.fails = 0;
        console.log(`revived ${p} idx=${s.idx}`);
      } catch (e) {
        // still down
      }
    }
  }
}, 30_000);

app.get('/next', (req, res) => {
  const provider = req.query.provider;
  if (!provider) return res.status(400).send('provider query required');
  const chosen = nextKey(provider);
  if (!chosen) return res.status(404).send('no keys for provider');
  res.json({ key: chosen.key, baseURL: chosen.baseURL || null });
});

app.all('/v1/forward', async (req, res) => {
  const provider = req.query.provider || 'openai';
  const chosen = nextKey(provider);
  if (!chosen) return res.status(404).send('no provider keys');

  const upstream = chosen.baseURL.replace(/\/$/, '');
  const forwardPath = req.query.upath || req.path.replace('/v1/forward', '');
  const forwardUrl = upstream + forwardPath;

  try {
    const headers = { ...req.headers };
    headers.host = new URL(upstream).host;
    if (chosen.meta.auth === 'bearer') {
      headers['authorization'] = `Bearer ${chosen.key}`;
    }

    const fetchRes = await fetch(forwardUrl, {
      method: req.method,
      headers,
      body: req.body && req.body.length ? req.body : undefined,
      timeout: 30_000,
    });

    if (fetchRes.status >= 500 || fetchRes.status === 429) {
      markFail(provider, chosen.idx);
      const nextChosen = nextKey(provider);
      if (nextChosen && nextChosen.idx !== chosen.idx) {
        const headers2 = { ...headers };
        if (nextChosen.meta.auth === 'bearer') {
          headers2['authorization'] = `Bearer ${nextChosen.key}`;
        }
        const nextUpstream = nextChosen.baseURL.replace(/\/$/, '');
        const retryUrl = nextUpstream + forwardPath;
        const retryRes = await fetch(retryUrl, {
          method: req.method,
          headers: headers2,
          body: req.body && req.body.length ? req.body : undefined,
          timeout: 30_000,
        });

        const text = await retryRes.text();
        res.status(retryRes.status).send(text);
        if (retryRes.status < 400) markOk(provider, nextChosen.idx);
        return;
      }
    }

    const text = await fetchRes.text();
    res.status(fetchRes.status).send(text);
    if (fetchRes.status < 400) markOk(provider, chosen.idx);
  } catch (err) {
    markFail(provider, chosen.idx);
    res.status(502).send('upstream error: ' + String(err.message));
  }
});

app.get('/admin/providers', (req, res) => {
  res.json({ cfg, status });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rotator running on http://localhost:${PORT}`));