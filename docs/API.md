# API Contract

All `/api/v1` mutation/read endpoints except health require:

`Authorization: Bearer <HERMES_API_KEY>`

## POST /api/v1/media/upload
Multipart field: `file`. Returns `public_url`.

## GET/POST /api/v1/accounts
POST stores an encrypted token. GET never returns token material.

## GET/POST /api/v1/posts
POST is idempotent by `idempotency_key`.

## GET /api/v1/posts/:id
Returns lifecycle state and Meta IDs.

## POST /api/v1/posts/:id/publish
Claims and processes one job synchronously.

## GET|POST /api/v1/worker/run
Protected by `CRON_SECRET`; processes due jobs.

Lifecycle:
`draft -> queued|scheduled -> processing -> published`
Failures retry up to `POST_MAX_ATTEMPTS`, then become `failed`.
