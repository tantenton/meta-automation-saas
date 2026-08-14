-- post_comments: tracks incoming comments on our posts, AI-drafted replies, dedup
CREATE TABLE IF NOT EXISTS post_comments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  post_id           text        NOT NULL,   -- Threads/Meta post ID (meta_post_id)
  comment_id        text        NOT NULL UNIQUE,  -- Threads comment/reply ID — dedup key
  username          text        NOT NULL,
  text              text        NOT NULL,
  timestamp         text,                   -- ISO string from Threads API
  has_replies       boolean     NOT NULL DEFAULT false,
  reply_drafted     text,                   -- AI-drafted reply text
  reply_status      text        NOT NULL DEFAULT 'pending'
                    CHECK (reply_status IN ('pending','replied','skipped','failed')),
  reply_post_id     text,                   -- Threads post ID of the published reply
  reply_permalink   text,
  replied_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_comment_id   ON post_comments(comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_account_status
  ON post_comments(account_id, reply_status, replied_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id      ON post_comments(post_id);

-- post_replies: idempotency log for manual/machine-triggered replies (v1/threads/[id]/reply)
CREATE TABLE IF NOT EXISTS post_replies (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  parent_post_id    text        NOT NULL,
  reply_to_id       text        NOT NULL,
  text              text        NOT NULL,
  container_id      text,
  meta_reply_id     text,
  permalink         text,
  idempotency_key   text        NOT NULL UNIQUE,
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_replies_idempotency ON post_replies(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_post_replies_account_id  ON post_replies(account_id);

-- updated_at trigger for post_comments
CREATE OR REPLACE FUNCTION update_post_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_post_comments_updated_at ON post_comments;
CREATE TRIGGER set_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comments_updated_at();

-- RLS: service role manages; authenticated users read own (via accounts join)
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_replies  ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_comments_service_role ON post_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY post_replies_service_role ON post_replies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY post_comments_owner_read ON post_comments
  FOR SELECT TO authenticated
  USING (
    account_id IN (
      SELECT id FROM accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY post_replies_owner_read ON post_replies
  FOR SELECT TO authenticated
  USING (
    account_id IN (
      SELECT id FROM accounts WHERE user_id = auth.uid()
    )
  );
