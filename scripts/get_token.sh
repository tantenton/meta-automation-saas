#!/bin/bash
set -e
source /home/ubuntu/meta-automation-saas/.env.local
echo "THREADS_APP_ID=$THREADS_APP_ID"
echo "THREADS_APP_SECRET=$THREADS_APP_SECRET"
echo "THREADS_ACCESS_TOKEN (length)=${#THREADS_ACCESS_TOKEN}"
