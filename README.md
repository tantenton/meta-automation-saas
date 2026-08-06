# Meta Automation API

API-first publisher for Hermes. Google Flow/browser automation creates media; this service uploads and publishes it to Instagram or Threads without Chrome focus/CDP.

## What is production-backed

- Bearer API-key authentication for Hermes
- Supabase Storage multipart uploads
- Encrypted Meta access tokens at rest (AES-256-GCM)
- Real posts table, scheduling, job status and retries
- Idempotency keys to prevent duplicate posts
- Instagram image/Reels container creation, status polling and publish
- Threads text/image/video container creation, status polling and publish
- Permalink lookup after publish
- Cron/worker endpoint for scheduled jobs

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql`, then `supabase/migrations/20260806_production_api.sql`.
3. Create one owner row in `users` and set its UUID as `HERMES_OWNER_USER_ID`.
4. Copy `.env.example` to `.env.local` and fill every required value.
5. Install and run:

```bash
npm ci
npm run build
npm start
```

## Connect an account

The token must already have the required Meta permissions. Tokens are validated, encrypted and never returned by list endpoints.

```bash
curl -X POST "$BASE/api/v1/accounts" \
  -H "Authorization: Bearer $HERMES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "platform":"threads",
    "platform_account_id":"THREADS_USER_ID",
    "account_name":"Gisella",
    "access_token":"META_ACCESS_TOKEN"
  }'
```

## Upload local media

```bash
curl -X POST "$BASE/api/v1/media/upload" \
  -H "Authorization: Bearer $HERMES_API_KEY" \
  -F "file=@C:/path/video.mp4"
```

Use `public_url` from the response.

## Create a publish job

```bash
curl -X POST "$BASE/api/v1/posts" \
  -H "Authorization: Bearer $HERMES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id":"SUPABASE_ACCOUNT_UUID",
    "content_id":"cnt_1786010357",
    "revision":1,
    "caption":"Caption final",
    "media_url":"PUBLIC_MEDIA_URL",
    "media_type":"video",
    "publish_now":true,
    "idempotency_key":"cnt_1786010357-threads-r1"
  }'
```

Then publish synchronously:

```bash
curl -X POST "$BASE/api/v1/posts/POST_UUID/publish" \
  -H "Authorization: Bearer $HERMES_API_KEY"
```

Or let cron process queued/scheduled jobs:

```bash
curl "$BASE/api/v1/worker/run?limit=5" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Poll status:

```bash
curl "$BASE/api/v1/posts/POST_UUID" \
  -H "Authorization: Bearer $HERMES_API_KEY"
```

A completed job has `status=published`, `meta_post_id`, and normally `permalink`.

## Operational notes

- The `meta-media` bucket is public because Meta must fetch the file from its servers. Use unguessable generated paths and lifecycle cleanup.
- Do not expose the service-role key to the browser.
- Run the worker once per minute using Vercel Cron, GitHub Actions, systemd timer, or another trusted scheduler.
- Reusing an idempotency key returns the existing post instead of creating a duplicate.
- Meta API version is configurable through `META_GRAPH_VERSION`; verify it against the app's supported version before deploy.
