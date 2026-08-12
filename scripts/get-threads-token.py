#!/usr/bin/env python3
"""
Get Threads access token from database and decrypt it.
Outputs token to stdout or error message.
"""

import json
import os
import sys
from pathlib import Path

# Load from system environment (优先 dari runtime)
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
TOKEN_ENCRYPTION_KEY = os.environ.get('TOKEN_ENCRYPTION_KEY')

# Fallback: Load .env jika tidak di environment
if not SUPABASE_URL or not SUPABASE_KEY or not TOKEN_ENCRYPTION_KEY:
    env_path = Path('/home/ubuntu/meta-automation-saas/.env')
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    k, v = key.strip(), value.strip()
                    if not SUPABASE_URL and k == 'NEXT_PUBLIC_SUPABASE_URL':
                        SUPABASE_URL = v
                    elif not SUPABASE_KEY and k == 'SUPABASE_SERVICE_ROLE_KEY':
                        SUPABASE_KEY = v
                    elif not TOKEN_ENCRYPTION_KEY and k == 'TOKEN_ENCRYPTION_KEY':
                        TOKEN_ENCRYPTION_KEY = v

if not SUPABASE_URL or not SUPABASE_KEY or not TOKEN_ENCRYPTION_KEY:
    print("ERROR: Supabase or TOKEN_ENCRYPTION_KEY not configured")
    sys.exit(1)

try:
    from supabase import create_client, Client
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import base64
    import hashlib
except ImportError:
    print("ERROR: Required packages not installed. Run: pip install supabase cryptography")
    sys.exit(1)

def decrypt_token(encrypted_value: str) -> str:
    """Decrypt Threads access token"""
    secret = TOKEN_ENCRYPTION_KEY
    key = hashlib.sha256(secret.encode()).digest()
    
    parts = encrypted_value.split('.')
    if len(parts) != 4 or parts[0] != 'v1':
        raise ValueError('Invalid encrypted token format')
    
    iv = base64.urlsafe_b64decode(parts[1])
    tag = base64.urlsafe_b64decode(parts[2])
    encrypted = base64.urlsafe_b64decode(parts[3])
    
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, encrypted, None)
    return decrypted.decode('utf-8')

def main():
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        result = supabase.from_('accounts').select('*') \
            .eq('platform', 'threads') \
            .eq('is_active', True) \
            .maybe_single() \
            .execute()
        
        data = result.data
        
        if not data:
            print("NO_THREADS_ACCOUNT")
            sys.exit(0)
        
        encrypted_token = data.get('access_token_encrypted')
        if not encrypted_token:
            print("NO_ENCRYPTED_TOKEN")
            sys.exit(1)
        
        token = decrypt_token(encrypted_token)
        print(token)
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
