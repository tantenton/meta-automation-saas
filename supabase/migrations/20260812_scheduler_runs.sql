-- Scheduler run log table
-- Records every autonomous orchestration cycle for audit and debugging.
-- Service role writes; authenticated users have no direct access.

CREATE TABLE IF NOT EXISTS scheduler_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at              timestamptz NOT NULL DEFAULT now(),
  dry_run             boolean     NOT NULL DEFAULT true,
  accounts_processed  jsonb       NOT NULL DEFAULT '[]',
  research_ok         boolean,
  drafts_created      int         NOT NULL DEFAULT 0,
  drafts_rejected     int         NOT NULL DEFAULT 0,
  drafts_queued       int         NOT NULL DEFAULT 0,
  metrics_processed   int         NOT NULL DEFAULT 0,
  error_message       text,
  duration_ms         int,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduler_runs_run_at
  ON scheduler_runs (run_at DESC);

ALTER TABLE scheduler_runs ENABLE ROW LEVEL SECURITY;

-- Only the service role (used by Next.js server) may read or write
CREATE POLICY scheduler_runs_service_role ON scheduler_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
