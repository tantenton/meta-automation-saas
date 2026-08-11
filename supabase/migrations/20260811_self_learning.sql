-- Self-learning content loop tables for meta-automation-saas
-- Enables pattern-based content strategy with metrics feedback

-- 1. content_patterns: Stores successful content patterns with metrics
CREATE TABLE IF NOT EXISTS content_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  pattern_name text NOT NULL,
  description text,
  structure text,
  hook_type text,
  example_hooks jsonb DEFAULT '[]',
  times_used int DEFAULT 0,
  total_likes int DEFAULT 0,
  total_replies int DEFAULT 0,
  total_reposts int DEFAULT 0,
  total_views int DEFAULT 0,
  avg_engagement_rate float DEFAULT 0,
  effectiveness_score float DEFAULT 5.0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, pattern_name)
);

-- 2. content_strategy: Stores account-specific strategy learned from patterns
CREATE TABLE IF NOT EXISTS content_strategy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,
  preferred_patterns jsonb DEFAULT '[]',
  avoid_patterns jsonb DEFAULT '[]',
  key_learnings jsonb DEFAULT '[]',
  iteration int DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 3. pending_metrics: Tracks posts awaiting engagement metrics
CREATE TABLE IF NOT EXISTS pending_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  post_id text NOT NULL,
  threads_post_id text,
  pattern_used text,
  pillar text,
  content text,
  published_at timestamptz,
  check_after timestamptz,
  metrics_collected bool DEFAULT false,
  collected_at timestamptz,
  likes int,
  replies int,
  reposts int,
  views int,
  engagement_rate float,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_patterns_account_id ON content_patterns(account_id);
CREATE INDEX IF NOT EXISTS idx_pending_metrics_account_id_collected_check ON pending_metrics(account_id, metrics_collected, check_after);

-- RLS policies (service role bypass)
ALTER TABLE content_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_metrics ENABLE ROW LEVEL SECURITY;

-- content_patterns RLS: Users can CRUD their own patterns
CREATE POLICY content_patterns_crud ON content_patterns
  FOR ALL
  TO authenticated
  USING (account_id = auth.jwt()->>'sub')
  WITH CHECK (account_id = auth.jwt()->>'sub');

-- content_strategy RLS: Users can CRUD their own strategy
CREATE POLICY content_strategy_crud ON content_strategy
  FOR ALL
  TO authenticated
  USING (account_id = auth.jwt()->>'sub')
  WITH CHECK (account_id = auth.jwt()->>'sub');

-- pending_metrics RLS: Users can read their pending metrics, service role can manage
CREATE POLICY pending_metrics_read ON pending_metrics
  FOR SELECT
  TO authenticated
  USING (account_id = auth.jwt()->>'sub');

CREATE POLICY pending_metrics_service_role ON pending_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
