// server.js
const express = require('express');
const fetch = require('node-fetch'); // node 18+ has global fetch, fallback to node-fetch if needed
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.raw({ type: '*/*' }));

const CONFIG_PATH = './providers.json';
let cfg = JSON.parse(fs.readFileSync(CONFIG_PATH)); // providers config

// in-memory status
const status = {};
for (const p of Object.keys(cfg)) {
  status[p] = cfg[p].map((_, i) => ({ idx: i, alive: true, fails: 0 }));
}

// select next key for provider (round-robin skipping dead)
function nextKey(provider) {
  const pool = cfg[provider];
  if (!pool || pool.length === 0) return null;
  const st = status[provider];
  // find next alive
  for (let r = 0; r < pool.length; r++) {
    const cand = st.find(s => s.alive);
    if (!cand) break;
    // rotate: move first to last
    const chosen = st.shift();
    st.push(chosen);
    const idx = chosen.idx;
    return { key: pool[idx].key, baseURL: pool[idx].baseURL, idx, meta: pool[idx].meta || {} };
  }
  // none alive -> return first anyway
  return { key: pool[0].key, baseURL: pool[0].baseURL, idx: 0, meta: pool[0].meta || {} };
}

// mark failure to possibly blacklist
function markFail(provider, idx) {
  const s = status[provider].find(x => x.idx === idx);
  if (!s) return;
  s.fails = (s.fails || 0) + 1;
  if (s.fails >= 3) s.alive = false;
}
function markOk(provider, idx) {
  const s = status[provider].find(x => x.idx === idx);
  if (!s) return;
  s.fails = 0;
  s.alive = true;
}

// health probe: try revive periodically (simple)
setInterval(async () => {
  for (const p of Object.keys(cfg)) {
    for (const entry of cfg[p]) {
      const s = status[p].find(x => x.idx === cfg[p].indexOf(entry));
      if (!s) continue;
      if (!s.alive) {
        // fire a lightweight probe (OPTIONS or GET root)
        try {
          const probeUrl = entry.baseURL.replace(/\/+$/, '') + '/';
          await fetch(probeUrl, { method: 'HEAD', timeout: 3000 });
          s.alive = true;
          s.fails = 0;
          console.log(`revived ${p} idx=${s.idx}`);
        } catch (e) {
          // still down
        }
      }
    }
  }
}, 30_000);

// Simple route: return next key (used by wrappers)
app.get('/next', (req, res) => {
  const provider = req.query.provider;
  if (!provider) return res.status(400).send('provider query required');
  const chosen = nextKey(provider);
  if (!chosen) return res.status(404).send('no keys for provider');
  res.json({ key: chosen.key, baseURL: chosen.baseURL || null });
});

// Forward route for OpenAI-like calls:
// client sets: POST http://localhost:3000/v1/forward?provider=openai
app.all('/v1/forward', async (req, res) => {
  const provider = req.query.provider || 'openai';
  const chosen = nextKey(provider);
  if (!chosen) return res.status(404).send('no provider keys');
  const upstream = chosen.baseURL.replace(/\/$/, '');
  // assume body is raw JSON
  try {
    const url = upstream + (req.url.includes('?') ? '' : '') + req.path.replace('/v1/forward', '') || '/v1/chat/completions';
    // Forward path: we will simply forward to upstream's path /v1/*
    // Build headers
    const headers = {};
    // set auth header according to provider meta (we store type)
    if (chosen.meta.auth === 'bearer') headers['Authorization'] = `Bearer ${chosen.key}`;
    if (chosen.meta.auth === 'api_key_query') {
      // append as query param
    }
    // copy content-type
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

    const forwardUrl = upstream + (req.query.upath || req.path.replace('/v1/forward', ''));
    const fetchRes = await fetch(forwardUrl, {
      method: req.method,
      headers,
      body: req.body && req.body.length ? req.body : undefined,
      timeout: 30_000
    });

    if (fetchRes.status >= 500 || fetchRes.status === 429) {
      markFail(provider, chosen.idx);
      // try once with next key
      const nextChosen = nextKey(provider);
      if (nextChosen && nextChosen.idx !== chosen.idx) {
        const headers2 = headers;
        if (nextChosen.meta.auth === 'bearer') headers2['Authorization'] = `Bearer ${nextChosen.key}`;
        const retryRes = await fetch(upstream + req.path.replace('/v1/forward', ''), {
          method: req.method,
          headers: headers2,
          body: req.body && req.body.length ? req.body : undefined,
          timeout: 30_000
        });
        // pipe response
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

// Simple admin: list providers
app.get('/admin/providers', (req, res) => {
  res.json({ cfg, status });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rotator running on http://localhost:${PORT}`));
