# 🔥 Universal API Key Rotator – Full Setup Guide

A complete, step-by-step guide to set up a **universal API key rotator** for:
- Gemini CLI (with OAuth fallback)
- Qwen CLI (OpenAI-compatible)
- OpenCode CLI
- iFlow CLI
- Cline CLI
- Crush CLI

This system:
- Automatically rotates API keys when quota is exceeded  
- Works with many providers (OpenAI, OpenRouter, Groq, HuggingFace, Gemini, etc.)  
- Supports fallback to the original CLI behavior when the rotator is offline  
- Requires **Zero configuration editing** inside the CLI tools 
-
---

## 📌 1. Folder Structure

```

~/rotator/
├── server.js
├── providers.json
├── package.json
├── bin/
│   ├── gemini-wrapper.sh
│   ├── qwen-wrapper.sh
│   ├── opencode-wrapper.sh
│   ├── iflow-wrapper.sh
│   ├── cline-wrapper.sh
│   └── crush-wrapper.sh

````

---

## 📌 2. Install jq (required by wrappers)

```bash
sudo apt update
sudo apt install jq -y
````

---

## 📌 3. Install Rotator Dependencies


```bash
mkdir -p ~/rotator
cd ~/rotator
npm install
```


---

## 📌 4. providers.json Structure

Add all your API keys:

```json
{
  "openai": [
    { "key": "OPENAI_KEY_1", "baseURL": "https://api.openai.com", "meta": { "auth": "bearer" } }
  ],

  "openrouter": [
    { "key": "YOUR_OPENROUTER_KEY", "baseURL": "https://api.openrouter.ai", "meta": { "auth": "bearer" } }
  ],

  "huggingface": [
    { "key": "HF_TOKEN", "baseURL": "https://api-inference.huggingface.co", "meta": { "auth": "bearer" } }
  ],

  "groq": [
    { "key": "GROQ_API_KEY", "baseURL": "https://api.groq.io", "meta": { "auth": "bearer" } }
  ],

  "gemini": [
    { "key": "GEMINI_KEY_1", "baseURL": "https://generativelanguage.googleapis.com/v1beta2" },
    { "key": "GEMINI_KEY_2", "baseURL": "https://generativelanguage.googleapis.com/v1beta2" },
    { "key": "GEMINI_KEY_3", "baseURL": "https://generativelanguage.googleapis.com/v1beta2" }
  ]
}
```

---

## 📌 5. Start the Rotator

```bash
cd ~/rotator
npm start
```

You'll see:

```
Rotator running on http://localhost:3000
```

---

# 🟦 6. Wrappers (each CLI gets its own script)

All wrappers:

* Try to pull a rotated key from rotator (`/next?provider=...`)
* If successful → use rotator
* If rotator offline → fallback to normal behavior

Each wrapper must be placed under:

```
~/rotator/bin/
```

And made executable:

```bash
chmod +x ~/rotator/bin/*.sh
```

Add PATH:

```bash
echo 'export PATH="$HOME/rotator/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```


---


You now have a **fully automated multi-provider key rotation system** that:

✔ Rotates keys for every CLI
✔ Supports fallback
✔ Solves quota exhaustion
✔ Prevents repetitive key replacement
✔ Works with dozens of free providers

```
Gemini → Rotator or OAuth  
Qwen → Rotator or Native  
OpenCode → Rotator or Native  
iFlow → Rotator or Native  
Cline → Rotator or OpenRouter  
Crush → Rotator or Native
```
