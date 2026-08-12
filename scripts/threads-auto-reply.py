#!/usr/bin/env python3
"""
Auto-reply script untuk Threads Birru (@albirrukhaliefnugraha)
HANYA reply komentar di postingan SENDIRI. JANGAN engage ke profil atau postingan orang lain.
"""

import json
import os
import sys
import requests
from pathlib import Path
from datetime import datetime

# Load .env
env_path = Path('/home/ubuntu/meta-automation-saas/.env')
env_vars = {}
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                env_vars[key.strip()] = value.strip()

THREADS_ACCESS_TOKEN = env_vars.get('THREADS_ACCESS_TOKEN')
if not THREADS_ACCESS_TOKEN or THREADS_ACCESS_TOKEN.startswith('['):
    print("ERROR: THREADS_ACCESS_TOKEN not configured in .env")
    sys.exit(1)

REPLIED_COMMENTS_FILE = Path('/home/ubuntu/meta-automation-saas/data/replied_comments.json')

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

def get_latest_threads() -> list:
    """Get latest 5 threads from user profile"""
    url = "https://graph.threads.net/v1.0/me/threads"
    params = {
        "fields": "id,text,timestamp",
        "limit": 5,
        "access_token": THREADS_ACCESS_TOKEN
    }
    try:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error fetching threads: {e}")
        return []

def get_thread_replies(thread_id: str) -> list:
    """Get replies/comments for a specific thread"""
    url = f"https://graph.threads.net/v1.0/{thread_id}/replies"
    params = {
        "fields": "id,text,username,timestamp",
        "access_token": THREADS_ACCESS_TOKEN
    }
    try:
        resp = requests.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error fetching replies for thread {thread_id}: {e}")
        return []

def create_reply_comment(text: str, reply_to_id: str) -> str | None:
    """Create a reply thread, return creation_id"""
    url = "https://graph.threads.net/v1.0/me/threads"
    payload = {
        "media_type": "TEXT",
        "text": text,
        "reply_to_id": reply_to_id
    }
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("id")
    except Exception as e:
        print(f"Error creating reply comment: {e}")
        return None

def publish_reply(creation_id: str) -> bool:
    """Publish a reply thread"""
    url = "https://graph.threads.net/v1.0/me/threads_publish"
    payload = {"creation_id": creation_id}
    headers = {"Content-Type": "application/json"}
    try:
        resp = requests.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"Error publishing reply: {e}")
        return False

def generate_reply() -> str:
    import random
    return random.choice(REPLIES)

def main():
    print(f"[{datetime.now().isoformat()}] Starting auto-reply check...")
    
    replied_ids = load_replied_comments()
    print(f"Loaded {len(replied_ids)} previously replied comments")
    
    threads = get_latest_threads()
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
            
        replies = get_thread_replies(thread_id)
        print(f"Thread {thread_id}: {len(replies)} comments")
        
        for comment in replies:
            comment_id = comment.get("id", "")
            if comment_id in replied_ids:
                continue
                
            reply_text = generate_reply()
            if len(reply_text) > 150:
                continue
                
            # Create reply
            creation_id = create_reply_comment(reply_text, comment_id)
            if not creation_id:
                continue
                
            # Publish reply
            if not publish_reply(creation_id):
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
