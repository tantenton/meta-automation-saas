#!/bin/bash
set -e

# Extract project ref from SUPABASE_URL
export SUPABASE_URL=$(grep "NEXT_PUBLIC_SUPABASE_URL" /home/ubuntu/meta-automation-saas/.env.local | cut -d'"' -f2)
export SUPABASE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" /home/ubuntu/meta-automation-saas/.env.local | cut -d'"' -f2)
export TOKEN_ENCRYPTION_KEY=$(grep "TOKEN_ENCRYPTION_KEY" /home/ubuntu/meta-automation-saas/.env.local | cut -d'"' -f2)

echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_KEY length=${#SUPABASE_KEY}"
echo "TOKEN_ENCRYPTION_KEY length=${#TOKEN_ENCRYPTION_KEY}"
