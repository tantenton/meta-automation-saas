#!/usr/bin/env python3
"""Test Threads API connection using stored token in environment"""
import os
import sys
import requests

# Get token from system environment
token = os.environ.get('THREADS_ACCESS_TOKEN')

if not token:
    print("ERROR: THREADS_ACCESS_TOKEN not found in environment")
    print("Available env vars with THREADS:")
    for k, v in os.environ.items():
        if 'THREADS' in k or 'ACCESS' in k or 'TOKEN' in k:
            print(f"  {k}: {v[:30] if len(v) > 30 else v}")
    sys.exit(1)

print(f"Token found (length={len(token)})")
print(f"First 20 chars: {token[:20]}...")

# Test API call
url = "https://graph.threads.net/v1.0/me/threads"
params = {"fields": "id,text,timestamp", "limit": 2}
headers = {"Authorization": f"Bearer {token}"}

try:
    resp = requests.get(url, params=params, headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
