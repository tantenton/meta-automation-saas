#!/usr/bin/env python3
"""
Auto-reply script untuk Threads Birru - fetch token dari database Supabase
"""
import json
import os
import sys
import requests
from pathlib import Path

# Parse .env.local (Production)
def parse_env(env_path: Path) -> dict:
    env_vars = {}
    if not env_path.exists():
        return env_vars
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            value = value.strip().strip('"')
            env_vars[key.strip()] = value
    return env_vars

# Read from system environment first (production)
SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
TOKEN_ENCRYPTION_KEY = os.environ.get('TOKEN_ENCRYPTION_KEY')

# Fallback to .env.local if not in environment
if not SUPABASE_URL or not SUPABASE_KEY or not TOKEN_ENCRYPTION_KEY:
    ENV = parse_env(Path('/home/ubuntu/meta-automation-saas/.env.local'))
    SUPABASE_URL = SUPABASE_URL or ENV.get('NEXT_PUBLIC_SUPABASE_URL')
    SUPABASE_KEY = SUPABASE_KEY or ENV.get('SUPABASE_SERVICE_ROLE_KEY')
    TOKEN_ENCRYPTION_KEY = TOKEN_ENCRYPTION_KEY or ENV.get('TOKEN_ENCRYPTION_KEY')

REPLIED_COMMENTS_FILE = Path('/home/ubuntu/meta-automation-saas/data/replied_comments.json')

def load_replied_comments() -> set:
    if REPLIED_COMMENTS_FILE.exists():
        try:
            with open(REPLIED_COMMENTS_FILE) as f:
                return set(json.load(f))
        except Exception as e:
            print(f"Error loading replied comments: {e}")
    return set()

def save_replied_comments(comment_ids: set) -> None:
    try:
        REPLIED_COMMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(REPLIED_COMMENTS_FILE, 'w') as f:
            json.dump(list(comment_ids), f)
        print(f"Saved {len(comment_ids)} replied comments")
    except Exception as e:
        print(f"Error saving replied comments: {e}")

def decrypt_token(encrypted_value: str, token_key: str) -> str:
    """Decrypt Threads access token"""
    import base64
    import hashlib
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    
    key = hashlib.sha256(token_key.encode()).digest()
    
    parts = encrypted_value.split('.')
    if len(parts) != 4 or parts[0] != 'v1':
        raise ValueError('Invalid encrypted token format')
    
    iv = base64.urlsafe_b64decode(parts[1])
    tag = base64.urlsafe_b64decode(parts[2])
    encrypted = base64.urlsafe_b64decode(parts[3])
    
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(iv, encrypted, None)
    return decrypted.decode('utf-8')

def get_threads_token_from_supabase(token_key: str) -> str:
    """Fetch and decrypt Threads access token from Supabase"""
    import http.client
    
    if not SUPABASE_URL or not SUPABASE_URL.startswith('https://'):
        raise ValueError("Invalid Supabase URL")
    
    # Extract project ref from URL: https://PROJECT.supabase.co -> PROJECT
    parts = SUPABASE_URL.replace('https://', '').split('.')
    if len(parts) < 2:
        raise ValueError("Invalid Supabase URL format")
    project_ref = parts[0]
    
    conn = http.client.HTTPSConnection(project_ref + '.supabase.co')
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }
    
    # Query accounts table
    conn.request("GET", "/rest/v1/accounts?platform=eq.threads&is_active=eq.true", "", headers)
    resp = conn.getresponse()
    data = json.loads(resp.read().decode())
    
    if not data:
        raise Exception("No active Threads account found")
    
    encrypted_token = data[0].get('access_token_encrypted')
    if not encrypted_token:
        raise Exception("No encrypted token found")
    
    return decrypt_token(encrypted_token, token_key)

# Persona Birru: casual Bahasa Indonesia, tech-savvy, 25yo guy
REPLIES = [
    "Wah keren juga tuh, mantap!",
    "Sip, setuju dengan opini lu.",
    "Oke juga nih, keep sharing!",
    "Menarik banget, makasih sharing!",
    "Bener banget, gue suka!",
    "Nice one! Keep it up.",
    "Mantap, gue juga suka gituan.",
    "Waduh jadi inget time ago ya.",
    "Agree, gue juga pernah gitu.",
    "Top markotop, makasih info!",
]

def generate_reply() -> str:
    import random
    return random.choice(REPLIES)

def get_latest_threads(access_token: str) -> list:
    """Get latest 5 threads from user profile"""
    url = "https://graph.threads.net/v1.0/me/threads"
    params = {
        "fields": "id,text,timestamp",
        "limit": 5,
        "access_token": access_token
    }
    try:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error fetching threads: {e}")
        return []

def get_thread_replies(thread_id: str, access_token: str) -> list:
    """Get replies/comments for a specific thread"""
    url = f"https://graph.threads.net/v1.0/{thread_id}/replies"
    params = {
        "fields": "id,text,username,timestamp",
        "access_token": access_token
    }
    try:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error fetching replies for thread {thread_id}: {e}")
        return []

def create_reply_comment(text: str, reply_to_id: str, access_token: str) -> str | None:
    """Create a reply thread, return creation_id"""
    url = "https://graph.threads.net/v1.0/me/threads"
    payload = {
        "media_type": "TEXT",
        "text": text,
        "reply_to_id": reply_to_id
    }
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers, params={"access_token": access_token})
        resp.raise_for_status()
        data = resp.json()
        return data.get("id")
    except Exception as e:
        print(f"Error creating reply comment: {e}")
        return None

def publish_reply(creation_id: str, access_token: str) -> bool:
    """Publish a reply thread"""
    url = "https://graph.threads.net/v1.0/me/threads_publish"
    payload = {"creation_id": creation_id}
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers, params={"access_token": access_token})
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"Error publishing reply: {e}")
        return False

def main():
    print(f"[{__import__('datetime').datetime.now().isoformat()}] Starting auto-reply check...")
    
    # Check Supabase config
    if not SUPABASE_URL or not SUPABASE_KEY or not TOKEN_ENCRYPTION_KEY:
        print("ERROR: Supabase or TOKEN_ENCRYPTION_KEY not configured")
        print(f"NEXT_PUBLIC_SUPABASE_URL: {'SET' if SUPABASE_URL else 'MISSING'}")
        print(f"SUPABASE_SERVICE_ROLE_KEY: {'SET' if SUPABASE_KEY else 'MISSING'}")
        print(f"TOKEN_ENCRYPTION_KEY: {'SET' if TOKEN_ENCRYPTION_KEY else 'MISSING'}")
        sys.exit(1)
    
    print(f"Supabase URL: {SUPABASE_URL[:50]}...")
    parts = SUPABASE_URL.replace('https://', '').split('.')
    if len(parts) >= 2:
        print(f"Project ref: {parts[0]}")
    
    # Fetch token from Supabase
    try:
        access_token = get_threads_token_from_supabase(TOKEN_ENCRYPTION_KEY)
        print("Successfully fetched Threads access token from database")
    except Exception as e:
        print(f"ERROR: Could not fetch token from Supabase: {e}")
        sys.exit(1)
    
    replied_ids = load_replied_comments()
    print(f"Loaded {len(replied_ids)} previously replied comments")
    
    threads = get_latest_threads(access_token)
    if not threads:
        print("No threads found")
        return
    
    print(f"Found {len(threads)} recent threads")
    
    results = {
        "found_comments": 0,
        "replied_comments": 0,
        "replies": []
    }
    
    for thread in threads:
        thread_id = thread.get("id")
        if not thread_id:
            continue
        
        replies = get_thread_replies(thread_id, access_token)
        print(f"Thread {thread_id}: {len(replies)} comments")
        
        for comment in replies:
            comment_id = comment.get("id", "")
            if comment_id in replied_ids:
                continue
            
            reply_text = generate_reply()
            if len(reply_text) > 150:
                continue
            
            # Create reply
            creation_id = create_reply_comment(reply_text, comment_id, access_token)
            if not creation_id:
                continue
            
            # Publish reply
            if not publish_reply(creation_id, access_token):
                continue
            
            # Mark as replied
            replied_ids.add(comment_id)
            results["found_comments"] += 1
            results["replied_comments"] += 1
            results["replies"].append({
                "comment_id": comment_id,
                "text": reply_text
            })
            print(f"Replied to comment {comment_id}")
    
    # Save replied comments
    save_replied_comments(replied_ids)
    
    print(f"\n=== Results ===")
    print(f"Found comments: {results['found_comments']}")
    print(f"Replied comments: {results['replied_comments']}")
    for reply in results["replies"]:
        print(f"  - {reply['comment_id']}: {reply['text'][:50]}...")

if __name__ == "__main__":
    main()
