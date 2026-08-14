-- 20260814_comment_engagement.sql
-- Safe additive migration: extends post_comments for multi-platform support
-- and adds daily_reply_counters for per-platform reply cap enforcement.
-- Idempotent: uses IF NOT EXISTS / DO blocks throughout.

-- ─── Extend post_comments (already exists from 20260814_post_comments_replies) ───

-- Add platform column (nullable default 'threads' so existing rows stay valid)
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS platform text DEFAULT 'threads'
    CHECK (platform IN ('threads', 'instagram', 'facebook'));

-- Add parent_comment_id for nested comment tracking
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id text;

-- Add safety_class for AI safety categorisation
ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS safety_class text
    CHECK (safety_class IN ('safe', 'sensitive', 'spam', 'skip'));

-- Extend reply_status CHECK to include new statuses used by multi-platform flow.
-- Postgres does not support ALTER COLUMN ... ADD CHECK without dropping the old one,
-- so we drop the existing constraint and re-add with the full set.
DO $$ BEGIN
  ALTER TABLE post_comments DROP CONSTRAINT IF EXISTS post_comments_reply_status_check;
  ALTER TABLE post_comments ADD CONSTRAINT post_comments_reply_status_check
    CHECK (reply_status IN ('pending','approved','replied','skipped','approval_required','spam','failed'));
EXCEPTION WHEN others THEN
  NULL; -- constraint rename differs across Postgres versions; silently skip
END $$;

-- Back-fill platform for existing Threads rows
UPDATE post_comments SET platform = 'threads' WHERE platform IS NULL;

-- ─── Indexes for new columns ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_post_comments_account_platform
  ON post_comments(account_id, platform);

CREATE INDEX IF NOT EXISTS idx_post_comments_reply_status
  ON post_comments(reply_status);

-- ─── daily_reply_counters ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_reply_counters (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform    text    NOT NULL CHECK (platform IN ('threads','instagram','facebook')),
  date        date    NOT NULL DEFAULT CURRENT_DATE,
  reply_count int     NOT NULL DEFAULT 0,
  UNIQUE(account_id, platform, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reply_counters_lookup
  ON daily_reply_counters(account_id, platform, date);

-- RLS
ALTER TABLE daily_reply_counters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_reply_counters' AND policyname = 'daily_reply_counters_service_role'
  ) THEN
    CREATE POLICY daily_reply_counters_service_role ON daily_reply_counters
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON daily_reply_counters TO service_role;
GRANT ALL ON post_comments         TO service_role;
