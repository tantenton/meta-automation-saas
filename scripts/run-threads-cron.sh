#!/bin/bash
set -e

# Run via Vercel production endpoint (already has correct env vars)
# Endpoint will:
# 1. Get Threads access token from Supabase
# 2. Fetch latest posts
# 3. Check for new comments
# 4. Generate and post replies
# 5. Log results

BASE_URL="https://meta-automation-saas.vercel.app"

# Get API key from local env
API_KEY=$(grep -E "^HERMES_API_KEY=" /home/ubuntu/meta-automation-saas/.env.local | cut -d'"' -f2)
if [ -z "$API_KEY" ]; then
  echo "ERROR: HERMES_API_KEY not found"
  exit 1
fi

# Trigger the cron job via API
echo "Triggering threads-auto-reply cron..."
curl -s -X POST "$BASE_URL/api/v1/threads-auto-reply" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
