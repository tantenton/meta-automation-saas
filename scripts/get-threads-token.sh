#!/bin/bash
set -e

# Load .env.local - extract real values
while IFS= read -r line; do
  if [[ "$line" =~ ^NEXT_PUBLIC_SUPABASE_URL= ]]; then
    export NEXT_PUBLIC_SUPABASE_URL="${line#NEXT_PUBLIC_SUPABASE_URL=}"
    export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL%\"}"
    export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL#\"}"
  elif [[ "$line" =~ ^SUPABASE_SERVICE_ROLE_KEY= ]]; then
    export SUPABASE_SERVICE_ROLE_KEY="${line#SUPABASE_SERVICE_ROLE_KEY=}"
    export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY%\"}"
    export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY#\"}"
  fi
done < /home/ubuntu/meta-automation-saas/.env.local

echo "SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
echo "SUPABASE_KEY=${SUPABASE_SERVICE_ROLE_KEY:0:10}..."

cd /home/ubuntu/meta-automation-saas
npx tsx scripts/get-threads-token.ts
