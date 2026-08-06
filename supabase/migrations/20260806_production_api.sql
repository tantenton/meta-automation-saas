-- Production API migration for Hermes-driven Meta publishing
create extension if not exists "uuid-ossp";

alter table accounts add column if not exists access_token_encrypted text;
alter table accounts add column if not exists token_expires_at timestamptz;
alter table accounts add column if not exists token_last_validated_at timestamptz;

alter table posts drop constraint if exists posts_status_check;
alter table posts add constraint posts_status_check check (status in (
  'draft','queued','scheduled','processing','retrying','published','failed','cancelled'
));
alter table posts add column if not exists external_content_id text;
alter table posts add column if not exists revision integer not null default 1;
alter table posts add column if not exists media_type text not null default 'image';
alter table posts add constraint posts_media_type_check check (media_type in ('text','image','video'));
alter table posts add column if not exists idempotency_key text;
alter table posts add column if not exists content_hash text;
alter table posts add column if not exists permalink text;
alter table posts add column if not exists attempts integer not null default 0;
alter table posts add column if not exists processing_started_at timestamptz;

create unique index if not exists posts_idempotency_key_unique on posts(idempotency_key) where idempotency_key is not null;
create index if not exists posts_worker_due_idx on posts(status, scheduled_at, created_at);
create index if not exists posts_external_content_idx on posts(external_content_id, revision);

-- Storage bucket must be public because Meta fetches media URLs server-to-server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meta-media', 'meta-media', true, 104857600,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service-role API bypasses RLS. Public upload is intentionally not permitted.
