#!/usr/bin/env bash
# run-threads-outbound-discovery.sh
#
# Cron-compatible trend-discovery-before-outbound invocation.
# Step 1: POST /api/v1/threads/discover  — research + score + upsert targets
# Step 2: POST /api/v1/threads/outbound  — draft comments from top candidates
#
# Usage:
#   ./scripts/run-threads-outbound-discovery.sh
#   AUTO_POST=true ./scripts/run-threads-outbound-discovery.sh
#
# Cron example (every 6h, dry-run):
#   0 */6 * * * cd /path/to/meta-automation-saas && ./scripts/run-threads-outbound-discovery.sh >> /var/log/outbound.log 2>&1
#
# Cron example (daily at 9am WIB = 2am UTC, live post):
#   0 2 * * * cd /path/to/meta-automation-saas && AUTO_POST=true ./scripts/run-threads-outbound-discovery.sh
#
# Env vars required (from .env.local or shell):
#   APP_URL          — base URL of the running Next.js app (default: http://localhost:3000)
#   HERMES_API_KEY   — machine-to-machine bearer token
#   AUTO_POST        — set to "true" to publish comments (default: dry-run)
#   MAX_PER_RUN      — max comments per run (default: 5)
#   TREND_CANDIDATES — JSON array of {username, user_id?, category?, hint_keywords?}
#                      (default: empty — uses static outbound_targets from DB)

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
API_KEY="${HERMES_API_KEY:-${CRON_SECRET:-}}"
AUTO_POST="${AUTO_POST:-false}"
MAX_PER_RUN="${MAX_PER_RUN:-5}"
TREND_CANDIDATES="${TREND_CANDIDATES:-[]}"

if [ -z "$API_KEY" ]; then
  echo "[ERROR] HERMES_API_KEY or CRON_SECRET must be set" >&2
  exit 1
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "[$TIMESTAMP] Starting Threads outbound discovery pipeline..."
echo "  APP_URL:      $APP_URL"
echo "  AUTO_POST:    $AUTO_POST"
echo "  MAX_PER_RUN:  $MAX_PER_RUN"

# ─── Step 1: Trend Discovery ────────────────────────────────────────────────

echo ""
echo "[$TIMESTAMP] Step 1: Trend discovery + target upsert..."

DISCOVER_BODY=$(cat <<EOF
{
  "trend_candidates": $TREND_CANDIDATES,
  "min_score": 0.20,
  "max_candidates": 50,
  "upsert_targets": true
}
EOF
)

DISCOVER_RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$APP_URL/api/v1/threads/discover" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  --max-time 60 \
  -d "$DISCOVER_BODY")

DISCOVER_HTTP=$(echo "$DISCOVER_RESP" | tail -n1)
DISCOVER_JSON=$(echo "$DISCOVER_RESP" | head -n-1)

if [ "$DISCOVER_HTTP" != "200" ]; then
  echo "[ERROR] Discovery failed with HTTP $DISCOVER_HTTP"
  echo "$DISCOVER_JSON"
  exit 1
fi

TOTAL_DISCOVERED=$(echo "$DISCOVER_JSON" | grep -o '"total_scored":[0-9]*' | grep -o '[0-9]*' || echo "0")
UPSERTED=$(echo "$DISCOVER_JSON" | grep -o '"upserted":[0-9]*' | grep -o '[0-9]*' || echo "0")
echo "  Candidates discovered: $TOTAL_DISCOVERED"
echo "  Targets upserted:      $UPSERTED"

# ─── Step 2: Outbound Engagement ────────────────────────────────────────────

echo ""
echo "[$TIMESTAMP] Step 2: Outbound engagement (auto_post=$AUTO_POST)..."

AUTO_POST_BOOL="false"
if [ "$AUTO_POST" = "true" ]; then
  AUTO_POST_BOOL="true"
fi

OUTBOUND_BODY=$(cat <<EOF
{
  "auto_post": $AUTO_POST_BOOL,
  "max_per_run": $MAX_PER_RUN,
  "trend_candidates": $TREND_CANDIDATES
}
EOF
)

OUTBOUND_RESP=$(curl -s -w "\n%{http_code}" \
  -X POST "$APP_URL/api/v1/threads/outbound" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  --max-time 90 \
  -d "$OUTBOUND_BODY")

OUTBOUND_HTTP=$(echo "$OUTBOUND_RESP" | tail -n1)
OUTBOUND_JSON=$(echo "$OUTBOUND_RESP" | head -n-1)

if [ "$OUTBOUND_HTTP" != "200" ]; then
  echo "[ERROR] Outbound failed with HTTP $OUTBOUND_HTTP"
  echo "$OUTBOUND_JSON"
  exit 1
fi

PROCESSED=$(echo "$OUTBOUND_JSON" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*' || echo "0")
DRY_RUN=$(echo "$OUTBOUND_JSON" | grep -o '"dry_run":[a-z]*' | grep -o '[a-z]*$' || echo "unknown")
echo "  Processed:    $PROCESSED"
echo "  Dry run:      $DRY_RUN"

echo ""
echo "[$TIMESTAMP] Pipeline complete."

# Pretty-print full outbound response if available
if command -v python3 &>/dev/null; then
  echo "$OUTBOUND_JSON" | python3 -m json.tool 2>/dev/null || echo "$OUTBOUND_JSON"
else
  echo "$OUTBOUND_JSON"
fi
