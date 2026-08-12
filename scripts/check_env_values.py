#!/usr/bin/env python3
import re

def parse_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                value = value.strip()
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                env[key.strip()] = value
    return env

env = parse_env('/home/ubuntu/meta-automation-saas/.env.local')

print(f"NEXT_PUBLIC_SUPABASE_URL: {env.get('NEXT_PUBLIC_SUPABASE_URL', 'MISSING')[:30]}...")
key = env.get('SUPABASE_SERVICE_ROLE_KEY')
print(f"SUPABASE_SERVICE_ROLE_KEY: {'PRESENT (length=' + str(len(key)) + ')' if key and key != '[SENSITIVE]' else 'MISSING'}")
tk = env.get('TOKEN_ENCRYPTION_KEY')
print(f"TOKEN_ENCRYPTION_KEY: {'PRESENT (length=' + str(len(tk)) + ')' if tk and tk != '[SENSITIVE]' else 'MISSING'}")

url = env.get('NEXT_PUBLIC_SUPABASE_URL', '')
if url and url != '[SENSITIVE]':
    ref = url.replace('https://', '').split('.')[0]
    print(f"Project ref: {ref}")
