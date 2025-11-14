#!/usr/bin/env bash
# gemini-wrapper.sh

REAL_BIN="/home/abdulsamed/.npm-global/bin/gemini"

# حاول الحصول على المفتاح من الروتاتور
RESP=$(curl -s --max-time 1 "http://localhost:3000/next?provider=gemini")

# تأكد أن السيرفر يرد JSON صحيح
VALID=$(echo "$RESP" | grep -c "key")

if [ "$VALID" -eq 1 ]; then
    KEY=$(echo "$RESP" | jq -r .key)
    if [ ! -z "$KEY" ] && [ "$KEY" != "null" ]; then
        export GEMINI_API_KEY="$KEY"
        echo "[Rotator] Using rotated Gemini key"
        exec "$REAL_BIN" "$@"
    fi
fi

# لو وصلنا هنا → الروتاتور مش شغال أو المفتاح غير صالح
echo "[Fallback] Rotator not available, using Gemini OAuth login"
exec "$REAL_BIN" "$@"
