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
- [x] None (verification-only task; no source files changed)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The SQL objects — "Metric query", the exact SQL text)
- `docs/prd/exam-shelves-prd.md` (§ AC-042 — the acceptance criterion this query must satisfy)
- `SOURCE/supabase/schema.sql` (the shipped `exam_attempts.source` column — confirm the query's `group by source` targets exactly this column)

## Investigation Notes

**Backend DD (`docs/design/exam-shelves-backend-design.md:284-296`)** — Metric query (AC-042, Success Criteria #1/#2), run by the engineer with `service_role`; `exam_attempts` RLS makes it unavailable to the app by design:
```sql
select source,
       count(*)                                                      as attempts,
       round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as share_pct
  from public.exam_attempts
 where started_at >= '2026-09-18'          -- ship date
 group by source
 order by attempts desc;
```
PRD AC-042 (`docs/prd/exam-shelves-prd.md:163`): "Given a set of attempts, when one SQL query groups them by that column, then it returns the share of attempts started from each shelf, with 0 application-log reading required." Success Criteria #1/#2 (`:213-214`) reference this same query.

`SOURCE/supabase/schema.sql` — `exam_attempts.source` is declared inline at `:207` (`source text not null default 'none'`) and via the idempotent alter/constraint pair at `:2582-2585` (`alter table ... add column if not exists source text not null default 'none';` + `add constraint exam_attempts_source_check check (source in ('practice', 'hot', 'explore', 'none'));`). The DD query's `group by source` targets exactly this column — no other column named `source` exists on `exam_attempts`.

**Run 1 — verbatim query against dev** (`hynwleaxtbtjzkvpjsug`, via `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug "<sql>"` from `SOURCE/`, per `ms-molar-repo-mechanics` memory): executed with 0 modification. Result: `{"rows": []}` — 0 rows, 0 errors. Cause confirmed separately: `select count(*), max(started_at), min(started_at) from exam_attempts` → 185 total rows, `latest = 2026-09-14`, i.e. every existing attempt predates the `2026-09-18` ship-date filter in the query. This is expected per this task's scope note — P6-T1/P7-T1's live smoke tests (which would write post-ship rows, exercising `hot`/`practice`/`explore`) are deferred to the engineer and have not run yet on dev. The verbatim query is therefore confirmed to execute cleanly against the real shipped schema (no column-name/table-shape drift), returning a correctly-empty result rather than erroring.

**Run 2 — supplementary, same query shape with `started_at >= '2026-01-01'`** (widened only to observe the aggregation arithmetic against dev's actual pre-ship data, since the verbatim ship-date filter legitimately yields 0 rows right now; this is not a substitute for Run 1, which is the AC-042 record): `{"rows": [{"source": "none", "attempts": 185, "share_pct": "100.0"}]}`. Confirms in one `select`: groups by `source`, computes `attempts` via `count(*)`, computes `share_pct` via the window-function ratio (185/185 × 100.0 = 100.0, correct), all three columns (`source`, `attempts`, `share_pct`) produced together, 0 application-log reading, 0 errors. All 185 pre-ship rows carry `source = 'none'` (the column default, backfilled by the `add column ... default 'none'` alter) — consistent with `hot`/`practice`/`explore` only being written by post-ship attempt-starts that haven't happened on dev yet.

**Column metadata read-back** (`information_schema.columns`, `table_name = 'exam_attempts' and column_name = 'source'`): `is_nullable = 'NO'`, `column_default = "'none'::text"` — matches the DD's `not null default 'none'` exactly (same shape as the DD's own step-7 read-back recipe).

**Conclusion**: AC-042 confirmed. The query is structurally correct and self-sufficient against dev's real shipped schema — 1 `select`, grouped by `source`, 1 `share_pct` column per value, 0 application-log reading. Dev's current data is 100% `none` because no post-ship attempt has been written yet (Phase 6/7 smoke tests deferred to the engineer per task scope) — this is the expected, documented residual, not a defect.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read the backend DD's Metric query SQL text in full
### 2. Green Phase
- [x] Run the query against dev exactly as specified in the DD (no modification)
- [x] Confirm it groups by `source` and returns a `share_pct` column per value, in a single `select` statement
### 3. Refactor Phase
- [x] Confirm 0 application-log reading was required to produce this metric — the query is self-sufficient against the DB alone

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
- [x] Metric query run verbatim against dev
- [x] Result confirmed grouped by `source`, one `share_pct` per value, single `select`
- [x] 0 application-log reading confirmed required
- [x] Investigation Notes record the raw query output

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task; do not modify the DD's query to work around a schema mismatch — if one is found, escalate rather than silently patching the query.
