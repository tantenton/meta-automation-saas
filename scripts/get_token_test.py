#!/usr/bin/env python3
import os
env = {}
with open('/home/ubuntu/meta-automation-saas/.env.local') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, value = line.partition('=')
            value = value.strip().strip('"')
            if value != '[SENSITIVE]':
                env[key.strip()] = value

print("THREADS_ACCESS_TOKEN in file:", 'THREADS_ACCESS_TOKEN' in env)
if 'THREADS_ACCESS_TOKEN' in env:
    print("Value length:", len(env['THREADS_ACCESS_TOKEN']))
    print("First 20 chars:", env['THREADS_ACCESS_TOKEN'][:20])
