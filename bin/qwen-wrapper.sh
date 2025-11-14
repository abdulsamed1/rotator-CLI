#!/bin/bash

# Qwen Wrapper Script
# This script wraps calls to the Qwen API

set -e

# Get the prompt from stdin or arguments
PROMPT="${1:-}"

if [ -z "$PROMPT" ]; then
    read PROMPT
fi

# Call Qwen API
# Example implementation - adjust based on your actual Qwen API endpoint
curl -s -X POST "${QWEN_BASE_URL}/api/generate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${QWEN_API_KEY}" \
    -d "{\"prompt\": \"$PROMPT\"}" \
    || echo "Error calling Qwen API"
