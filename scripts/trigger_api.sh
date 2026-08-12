#!/bin/bash
# Trigger threads-auto-reply API via curl
set -e

API_KEY=$(grep "HERMES_API_KEY" /home/ubuntu/meta-automation-saas/.env.local | cut -d'"' -f2)
if [ -z "$API_KEY" ]; then
  echo "ERROR: HERMES_API_KEY not found"
  exit 1
fi

echo "Triggering threads-auto-reply API..."
curl -s -X POST "https://meta-automation-saas.vercel.app/api/v1/threads-auto-reply" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
