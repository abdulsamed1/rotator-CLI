#!/usr/bin/env bash
# opencode-wrapper.sh

REAL_BIN="/home/abdulsamed/.opencode/bin/opencode"

# جرّب التواصل مع الروتاتور
RESP=$(curl -s --max-time 1 "http://localhost:3000/next?provider=openai")
VALID=$(echo "$RESP" | grep -c "key")

if [ "$VALID" -eq 1 ]; then
    KEY=$(echo "$RESP" | jq -r .key)

    if [ ! -z "$KEY" ] && [ "$KEY" != "null" ]; then
        echo "[Rotator] Using rotated OpenAI-compatible key for OpenCode CLI"

        # OpenAI-style API integration
        export OPENAI_API_KEY="$KEY"
        export OPENAI_BASE_URL="http://localhost:3000/v1/forward?provider=openai"

        exec "$REAL_BIN" "$@"
    fi
fi

# فشل rotator → fallback إلى الوضع الطبيعي
echo "[Fallback] Rotator not available — starting OpenCode normally"
exec "$REAL_BIN" "$@"
