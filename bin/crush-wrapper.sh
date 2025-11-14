#!/usr/bin/env bash
# crush-wrapper.sh

REAL_BIN="/usr/bin/crush"

# نحاول الحصول على مفتاح OpenRouter من الروتاتور
RESP=$(curl -s --max-time 1 "http://localhost:3000/next?provider=openrouter")
VALID=$(echo "$RESP" | grep -c "key")

if [ "$VALID" -eq 1 ]; then
    KEY=$(echo "$RESP" | jq -r .key)

    if [ ! -z "$KEY" ] && [ "$KEY" != "null" ]; then
        echo "[Rotator] Using rotated OpenRouter key for Crush CLI"

        export OPENAI_API_KEY="$KEY"
        export OPENROUTER_API_KEY="$KEY"
        export OPENAI_BASE_URL="http://localhost:3000/v1/forward?provider=openrouter"

        exec "$REAL_BIN" "$@"
    fi
fi

echo "[Fallback] Rotator not available — starting Crush normally"
exec "$REAL_BIN" "$@"
