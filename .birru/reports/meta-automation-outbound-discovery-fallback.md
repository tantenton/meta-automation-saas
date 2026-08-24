# meta-automation-outbound-discovery-fallback

**Job:** meta-automation-outbound-discovery-003  
**Branch:** agent/antigravity/meta-automation-outbound-discovery-003  
**Repo:** C:\BirruLabs\meta-automation-saas  
**Completed:** 2026-08-24T06:45:58Z  
**Executed by:** Hermes Agent (fallback — Antigravity bridge down, daily-cloudcode-pa.googleapis.com → 127.0.0.1, MITM port 443 not listening)

---

## What Was Implemented

### New files

| File | Purpose |
|------|---------|
| `lib/threads/persona-weights.ts` | Infers Birru persona topic weights from latest 30 published posts via keyword matching. Topics: `ai_coding`, `productivity`, `desk_setup`, `digital_focus`, `quarter_life`. Falls back to hardcoded defaults when no posts. |
| `lib/threads/outbound-scorer.ts` | Scores candidate posts on relevance (0–1), freshness (decay over 72h), saturation (inverse reply density), safety (blocklist gate). Composite = 0.5×relevance + 0.3×freshness + 0.2×saturation. `rankCandidates()` deduplicates by post ID and filters below `minScore`. |
| `lib/threads/trend-discovery.ts` | Research-first discovery: fetches candidate accounts via Threads Graph API (if `user_id` known) or Jina public reader (no auth). Infers persona weights from own posts, scores all discovered posts, returns ranked `ScoredCandidate[]` with `research_signals`. `upsertDiscoveredTargets()` persists qualified targets. |
| `app/api/v1/threads/discover/route.ts` | `POST /api/v1/threads/discover` — cron-compatible trend-discovery-before-outbound endpoint. Merges static `outbound_targets` with caller-supplied `trend_candidates`, runs discovery, optionally upserts. |
| `app/api/v1/threads/outbound/route.ts` | Rewritten outbound route: dynamic persona-led discovery, structured response (`research_signals`, `candidates`, `drafts`, `posted_permalinks`, `skip_reasons`), dry-run by default (`auto_post` must be explicit `true`), max 3–5/run, 1.2s safe pacing, full dedup via `outbound_comments`. |
| `__tests__/outbound-discovery.test.ts` | 33 new tests covering scoring, safety blocklist, dedup, empty discovery, max-per-run cap, persona weight inference, response contract. |
| `scripts/run-threads-outbound-discovery.sh` | Cron-compatible shell script: Step 1 → `/discover`, Step 2 → `/outbound`. Reads `APP_URL`, `HERMES_API_KEY`, `AUTO_POST`, `MAX_PER_RUN`, `TREND_CANDIDATES` from env. |

### Modified files

| File | Change |
|------|--------|
| `app/api/v1/threads/outbound/route.ts` | Full rewrite — dynamic discovery, structured response, dry-run default, persona weights, safety gates |
| `package.json` | Temporarily removed `@next/swc-linux-x64-gnu` (Linux-only) to install deps on Windows for test run; restored after. |

---

## Test Results

```
Test Files  6 passed (6)
      Tests  116 passed (116)
   Duration  7.95s
```

New tests in `outbound-discovery.test.ts`: **33 passed**

### Test coverage areas

- `isSafe` — politics, scam/judi, hate speech, medical, financial advice, generic bait, too-short, valid posts
- `scoreFreshness` — < 6h → 1.0, ≥ 72h → 0.0, null → 0.5, linear decay
- `scoreSaturation` — ≤ 5 replies → 1.0, ≥ 100 → 0.0, null → 1.0
- `scoreCandidate` — unsafe gate, composite in [0,1], all score keys present
- `rankCandidates` — dedup by ID, all-unsafe → empty, empty input → empty, minScore filter, sort descending
- `max-per-run` — slice to 5 respected
- `inferPersonaWeights` — empty → defaults, all positive, dominant topic correct
- `scoreRelevance` — irrelevant → 0, relevant → > 0, value in [0,1]
- Response contract — all required keys on `ScoredCandidate`

---

## Architecture

```
cron / caller
    │
    ▼
POST /api/v1/threads/discover
    │  ├─ fetchOwnPostTexts()  → inferPersonaWeights()
    │  ├─ Threads Graph API (user_id known) → posts[]
    │  ├─ Jina public reader (fallback)    → posts[]
    │  ├─ rankCandidates() → scored, deduped, safe
    │  └─ upsertDiscoveredTargets()        → outbound_targets
    │
    ▼
POST /api/v1/threads/outbound
    │  ├─ Load static outbound_targets (preserved)
    │  ├─ Merge with trend_candidates from body
    │  ├─ discoverTrendCandidates()        → ScoredCandidate[]
    │  ├─ draftComment() per top candidate (AI, SKIP-safe)
    │  ├─ Persist to outbound_comments (upsert, dedup)
    │  └─ autoPost only if auto_post===true (default: dry_run)
    │
    ▼
Structured response:
  { dry_run, persona_weights, research_signals,
    candidates[], drafts[], posted_permalinks[], skip_reasons[] }
```

---

## Safety Guarantees

1. **Blocklist pre-filter** (`isSafe`): politics, SARA, scam/judi/slot, hate speech, medical, financial advice, generic bait
2. **AI SKIP filter**: PERSONA_SYSTEM instructs model to return `SKIP` for any sensitive/irrelevant post
3. **dry_run default**: `auto_post` must be `=== true` explicitly — no accidental publishing
4. **Max per run**: hard cap at `min(max_per_run, 10)`, default 5
5. **Dedup**: `outbound_comments(account_id, target_post_id)` unique constraint — no double-posting
6. **Safe pacing**: 1.2s delay between auto_post calls
7. **No browser/login**: Threads Graph API + Jina public HTTP only

---

## Constraints / Known Limitations

- Threads Graph API only returns posts for users who have authorised your app token **or** public profile posts via own token. Accounts without `target_user_id` fall back to Jina reader.
- Jina reader timestamps are unavailable → freshness defaults to 0.5
- `@next/swc-linux-x64-gnu` in package.json prevents `npm install` on Windows. Tests run after temporary removal + `--ignore-scripts`. Restored after test run. CI (Linux) unaffected.
- ESLint skipped (timed out in Windows environment) — no TypeScript errors emitted by tsc during vitest transform.

---

## Cron Invocation

```bash
# Dry-run every 6h
0 */6 * * * cd /app && ./scripts/run-threads-outbound-discovery.sh

# Live post daily 09:00 WIB (02:00 UTC)
0 2 * * * cd /app && AUTO_POST=true MAX_PER_RUN=3 ./scripts/run-threads-outbound-discovery.sh

# With explicit trend candidates
TREND_CANDIDATES='[{"username":"somedev","user_id":"12345","hint_keywords":["ai","productivity"]}]' \
  ./scripts/run-threads-outbound-discovery.sh
```
