#!/usr/bin/env bash
# iflow-wrapper.sh

REAL_BIN="/home/abdulsamed/.npm-global/bin/iflow"

# جرّب التواصل مع الروتاتور
RESP=$(curl -s --max-time 1 "http://localhost:3000/next?provider=openai")
VALID=$(echo "$RESP" | grep -c "key")

if [ "$VALID" -eq 1 ]; then
    KEY=$(echo "$RESP" | jq -r .key)

    if [ ! -z "$KEY" ] && [ "$KEY" != "null" ]; then
        echo "[Rotator] Using rotated OpenAI-compatible key for iFlow CLI"

        # إعداد الـ OpenAI API لـ iFlow
        export OPENAI_API_KEY="$KEY"
        export OPENAI_BASE_URL="http://localhost:3000/v1/forward?provider=openai"

        exec "$REAL_BIN" "$@"
    fi
fi

echo "[Fallback] Rotator not available — starting iFlow CLI normally"
exec "$REAL_BIN" "$@"
