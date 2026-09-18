# Task FQA-T10 — AC-042 confirmation: metric SQL query

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T10** (added 2026-09-18 per plan review I001-I006)
Layer: backend (verification only — no source files changed)

Metadata:
- Dependencies: Phase 8 complete (dev carries the shipped `exam_attempts.source` column with real written data from Phase 6/7's smoke tests)
- Blocks: none
- Size: Small (0 files; 1 SQL query run)
- Verification level: L1 (real query against dev)

## Implementation Content
Confirm AC-042 — run the backend Design Doc's metric SQL query (§ The SQL objects, "Metric query") against the shipped `exam_attempts.source` column on dev; confirm it groups by `source` and returns a `share_pct` per value in one `select`, with 0 application-log reading required.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The SQL objects — "Metric query", the exact SQL text)
- `docs/prd/exam-shelves-prd.md` (§ AC-042 — the acceptance criterion this query must satisfy)
- `SOURCE/supabase/schema.sql` (the shipped `exam_attempts.source` column — confirm the query's `group by source` targets exactly this column)

## Investigation Notes
_(Record here: the exact query run, its raw output — one row per `source` value with a `share_pct` column — and confirmation the 4 declared source values (or a subset, if not all have been exercised yet on dev) all appear correctly grouped.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read the backend DD's Metric query SQL text in full
### 2. Green Phase
- [ ] Run the query against dev exactly as specified in the DD (no modification)
- [ ] Confirm it groups by `source` and returns a `share_pct` column per value, in a single `select` statement
### 3. Refactor Phase
- [ ] Confirm 0 application-log reading was required to produce this metric — the query is self-sufficient against the DB alone

## Operation Verification Methods
- **Verification method**: run the DD's Metric query verbatim against dev; inspect the result set structure and values.
- **Success criteria**: one row per distinct `source` value present in `exam_attempts`, each with a `share_pct` column, produced entirely from a single SQL `select` with 0 application-log reading.
- **Failure response**: if the query errors (e.g. column name mismatch against the shipped schema) or requires supplementary application-log data to compute `share_pct`, this is an AC-042 violation — escalate rather than hand-computing the percentage outside SQL.
- **Verification level**: L1 — real query against a real, live-written dataset.

## Proof Obligations
- **Claim** (AC-042): the metric query groups by `source` and returns a `share_pct` per value in one `select`, with 0 application-log reading required.
  - **Primary failure mode**: the query as authored in the Design Doc references a column name or table shape that has since drifted from what P0-T1 actually shipped, causing it to error or silently return wrong values.
  - **Boundary to exercise**: live dev Postgres, real query execution.
  - **State assertion**: N/A (read-only aggregate query).
  - **Mock boundary rationale**: none — this is deliberately a real-dev check, since the whole point of AC-042 is that the metric is computable from the DB alone.
  - **Residual**: this confirms the query is correct and self-sufficient against dev's current data (which reflects whatever real attempt-starts happened during Phase 6/7's smoke tests and any manual testing); a statistically meaningful `share_pct` distribution will only emerge once real users generate attempts in production — that is expected and outside this task's scope.

## Completion Criteria
- [ ] Metric query run verbatim against dev
- [ ] Result confirmed grouped by `source`, one `share_pct` per value, single `select`
- [ ] 0 application-log reading confirmed required
- [ ] Investigation Notes record the raw query output

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task; do not modify the DD's query to work around a schema mismatch — if one is found, escalate rather than silently patching the query.
