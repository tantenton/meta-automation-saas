#!/usr/bin/env python3
"""Fetch Threads access token via Vercel API endpoint"""
import os
import requests

# Get API key from local file
api_key = os.environ.get('HERMES_API_KEY')
if not api_key:
    with open('/home/ubuntu/meta-automation-saas/.env.local') as f:
        for line in f:
            if line.strip().startswith('HERMES_API_KEY='):
                api_key = line.strip().split('=')[1].strip('"')
                break

if not api_key:
    print("ERROR: HERMES_API_KEY not found")
    exit(1)

# Trigger the cron job via API
base_url = "https://meta-automation-saas.vercel.app"
endpoint = f"{base_url}/api/v1/threads-auto-reply"

print(f"Triggering: {endpoint}")
print(f"Auth key: {api_key[:10]}...")

try:
    resp = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json={}
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
