<!-- BIRRU-AG DISPATCH: repo=C:\BirruLabs\meta-automation-saas job=meta-automation-outbound-discovery-003 -->
IMPORTANT: You are working EXCLUSIVELY in the repository at `C:\BirruLabs\meta-automation-saas`.
Do NOT read, edit, or operate in any other repository or directory.
Your task file is at `C:\BirruLabs\meta-automation-saas/.birru/tasks/ACTIVE_TASK.md`.
Write your report to `C:\BirruLabs\meta-automation-saas/.birru/reports/meta-automation-outbound-discovery-003.md`.

---

Implement dynamic persona-led Threads outbound discovery and engagement.
Current static targets return processed=0. Requirements:
1. Infer persona topic weights from latest 30 published posts: AI/coding tools, realistic productivity, desk setup, digital focus, quarter-life/economic pressure.
2. Add research-first discovery endpoint or extend outbound: accept current web/public Threads trend candidates, score relevance/freshness/saturation/safety, upsert qualified targets/posts. No blind/random scrolling.
3. Preserve static targets but dynamically refresh/expand pool. Skip politics, sensitive/toxic/spam, attacks, generic comments.
4. Comments reference actual post, casual Indonesian persona, max 3-5/run, deduped, safe pacing, evidence permalink.
5. Default dry-run; auto_post only explicit true. Structured response: research_signals, candidates, drafts, posted permalinks, skip reasons.
6. Tests: scoring, dedup, safety, empty discovery, max-per-run, API contract.
7. Add cron-compatible trend-discovery-before-outbound script/endpoint invocation.
8. No browser/computer-use/login. Official APIs/public HTTP only.
9. Verify tests/lint/build. Report .birru/reports/meta-automation-outbound-discovery-003.md.
Never publish comments during implementation/testing and never expose credentials.
