#!/usr/bin/env python3
"""
Threads auto-reply script untuk Birru (@albirrukhaliefnugraha)
HANYA reply komentar di postingan SENDIRI. JANGAN engage ke profil lain.

Prerequisite: THREADS_ACCESS_TOKEN harus tersedia di environment
"""

import json
import os
import sys
import requests
from pathlib import Path
from datetime import datetime

# ========== STEP 1: Ambil token ==========
env_path = Path('/home/ubuntu/meta-automation-saas/.env')
env_vars = {}
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                env_vars[key.strip()] = value.strip()

local_env_path = Path('/home/ubuntu/meta-automation-saas/.env.local')
if local_env_path.exists():
    with open(local_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, _, value = line.partition('=')
                value = value.strip().strip('"')
                if value != '[SENSITIVE]':
                    env_vars[key.strip()] = value

THREADS_ACCESS_TOKEN = env_vars.get('THREADS_ACCESS_TOKEN')

# Fallback: ambil dari environment runtime
if not THREADS_ACCESS_TOKEN:
    THREADS_ACCESS_TOKEN = os.environ.get('THREADS_ACCESS_TOKEN')

if not THREADS_ACCESS_TOKEN:
    print("ERROR: THREADS_ACCESS_TOKEN tidak tersedia")
    print("Set THREADS_ACCESS_TOKEN di .env.local atau environment")
    sys.exit(1)

# ========== STEP 2: Ambil 5 postingan terbaru ==========
url = "https://graph.threads.net/v1.0/me/threads"
params = {"fields": "id,text,timestamp", "limit": 5}
headers = {"Authorization": f"Bearer {THREADS_ACCESS_TOKEN}"}

resp = requests.get(url, params=params, headers=headers)
resp.raise_for_status()
threads = resp.json().get("data", [])

# ========== STEP 3: Cek komentar baru ==========
REPLIED_COMMENTS_FILE = Path('/home/ubuntu/meta-automation-saas/data/replied_comments.json')

def load_replied() -> set:
    if REPLIED_COMMENTS_FILE.exists():
        with open(REPLIED_COMMENTS_FILE) as f:
            return set(json.load(f))
    return set()

def save_replied(ids: set) -> None:
    REPLIED_COMMENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REPLIED_COMMENTS_FILE, 'w') as f:
        json.dump(list(ids), f)

replied_ids = load_replied()

# ========== STEP 4: Generate & post reply ==========
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

results = {"found": 0, "replied": 0, "replies": []}

for thread in threads:
    tid = thread.get("id")
    if not tid:
        continue
    
    reply_url = f"https://graph.threads.net/v1.0/{tid}/replies"
    reply_params = {"fields": "id,text,username,timestamp"}
    replies = requests.get(reply_url, params=reply_params, headers=headers).json().get("data", [])
    
    for comment in replies:
        cid = comment.get("id", "")
        if cid in replied_ids:
            continue
        
        reply_text = REPLIES[hash(cid) % len(REPLIES)]
        if len(reply_text) > 150:
            continue
        
        # Create reply
        create = requests.post(
            "https://graph.threads.net/v1.0/me/threads",
            json={"media_type": "TEXT", "text": reply_text, "reply_to_id": cid},
            headers=headers
        ).json()
        
        # Publish
        publish = requests.post(
            "https://graph.threads.net/v1.0/me/threads_publish",
            json={"creation_id": create.get("id")},
            headers=headers
        )
        
        if publish.ok:
            replied_ids.add(cid)
            results["found"] += 1
            results["replied"] += 1
            results["replies"].append({"comment_id": cid, "text": reply_text})

save_replied(replied_ids)

# ========== STEP 5: Laporan ==========
print(f"Komentar baru: {results['found']}")
print(f"Berhasil dibalas: {results['replied']}")
for r in results["replies"]:
    print(f"  - {r['comment_id']}: {r['text']}")
