#!/usr/bin/env python3
"""Simple env parser for .env files"""
import os
import sys
from pathlib import Path

def parse_env_file(env_path: Path) -> dict:
    """Parse .env file like bash would"""
    env_vars = {}
    if not env_path.exists():
        return env_vars
    
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, _, value = line.partition('=')
                # Strip quotes from value
                value = value.strip()
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                env_vars[key.strip()] = value
    
    return env_vars

if __name__ == "__main__":
    env_path = Path('/home/ubuntu/meta-automation-saas/.env.local')
    env_vars = parse_env_file(env_path)
    
    # Output raw values for key lookup
    keys_to_show = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TOKEN_ENCRYPTION_KEY', 'THREADS_ACCESS_TOKEN']
    for key in keys_to_show:
        val = env_vars.get(key, 'NOT_SET')
        print(f"{key}={val}")
