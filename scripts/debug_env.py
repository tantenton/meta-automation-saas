#!/usr/bin/env python3
"""Debug env loading - check actual values via subprocess"""
import os
import subprocess
from pathlib import Path

# Source .env.local in a subprocess to get actual values
env_file = Path('/home/ubuntu/meta-automation-saas/.env.local')
result = subprocess.run(
    ['bash', '-c', f'source {env_file} && echo $NEXT_PUBLIC_SUPABASE_URL'],
    capture_output=True, text=True, env=os.environ.copy()
)
print(f"NEXT_PUBLIC_SUPABASE_URL from subprocess: {result.stdout.strip()[:30]}")

result = subprocess.run(
    ['bash', '-c', f'source {env_file} && echo $SUPABASE_SERVICE_ROLE_KEY'],
    capture_output=True, text=True, env=os.environ.copy()
)
print(f"SUPABASE_SERVICE_ROLE_KEY from subprocess: {result.stdout.strip()[:30]}")

result = subprocess.run(
    ['bash', '-c', f'source {env_file} && echo $TOKEN_ENCRYPTION_KEY'],
    capture_output=True, text=True, env=os.environ.copy()
)
print(f"TOKEN_ENCRYPTION_KEY from subprocess: {result.stdout.strip()[:30]}")
