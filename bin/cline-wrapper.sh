#!/usr/bin/env bash
# cline-wrapper.sh

REAL_BIN="/home/abdulsamed/.npm-global/bin/cline"

# جرّب التواصل مع الروتاتور
RESP=$(curl -s --max-time 1 "http://localhost:3000/next?provider=openrouter")
VALID=$(echo "$RESP" | grep -c "key")

if [ "$VALID" -eq 1 ]; then
    KEY=$(echo "$RESP" | jq -r .key)

    if [ ! -z "$KEY" ] && [ "$KEY" != "null" ]; then
        echo "[Rotator] Using rotated OpenRouter key for Cline CLI"

        export OPENAI_API_KEY="$KEY"
        export OPENAI_BASE_URL="http://localhost:3000/v1/forward?provider=openrouter"

        exec "$REAL_BIN" "$@"
    fi
fi

echo "[Fallback] Rotator not available — starting Cline normally"
exec "$REAL_BIN" "$@"
