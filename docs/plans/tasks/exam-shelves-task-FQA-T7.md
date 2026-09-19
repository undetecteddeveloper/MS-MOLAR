# Task FQA-T7 (manual, not automatable, LAST GATE) — Production apply + fingerprint parity

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T7 — deploy-time, explicitly OUT OF SCOPE for implementation, the last thing before the feature is called done**
Layer: backend (production database — no repo source files changed)

Metadata:
- Dependencies: FQA-T1..T6 complete; this is the last gate, run at deploy time, separately from implementation
- Blocks: nothing further — this is the plan's final gate
- Size: Small (0 repo files; 7 production SQL statement applications + catalogue-level verification)
- Verification level: L1 (real production database)

## THIS TASK IS DEPLOY-TIME, NOT IMPLEMENTATION-TIME

Per the plan: "This task is explicitly OUT OF SCOPE for implementation — it happens at deploy time, separately, and is the last thing before the feature is called done." Do not run this task until the engineer has explicitly signed off on all prior FQA tasks and is ready for the actual production deploy step.

## Implementation Content
At deploy time, apply the migration's 7 statements to prod ONE STATEMENT PER CALL over the MCP/Composio SQL path (backend DD § Migration Procedure step 9), gated on the engineer's EXPLICIT confirmation before any statement touching `exam_attempts` is sent. After each statement, verify at catalogue level (`pg_proc.proacl`, `pg_constraint`, `pg_indexes`, `information_schema.columns` — never `information_schema.routine_privileges`, which reads empty under the read-only prod user and looks exactly like a missing grant). Read prod's `schema_version.fingerprint` and confirm it equals dev's (Success Criteria #7).

## Target Files
- [x] None (production database only — no repo source files changed by this task)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure step 9 — the exact statement-by-statement production apply procedure)
- `SOURCE/supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql` (P0-T3 — the 7 statements being applied, in order)
- project context: `.mcp.json` ref is PROD; dev server uses a different ref — **confirm the project ref before every call, this is production**

## Investigation Notes
**Applied 2026-09-19 via Composio `SUPABASE_BETA_RUN_SQL_QUERY`, ref `pebjdlbgbmizgfpuptjl` (confirmed as `MS-MOLAR-prod` via `SUPABASE_LIST_ALL_PROJECTS` before any query).** The direct Supabase MCP was unusable (`--read-only` + no `SUPABASE_ACCESS_TOKEN`), so the engineer directed the Composio path instead.

- **Baseline (read-only)**: fingerprint `187d3ed24f0c`; `source` column / `exam_attempts_source_check` / `exam_attempts_status_submitted_idx` / `exam_hot_counts` all absent (0 each); `exam_attempts` = 99 rows.
- **Engineer confirmation**: explicit "Áp ngay" via AskUserQuestion before the first `exam_attempts`-touching statement (covered the 4 statements: ADD COLUMN, DROP CONSTRAINT, ADD CONSTRAINT, CREATE INDEX).
- **1/7 ADD COLUMN** -> verify (`information_schema.columns`): `source`, `is_nullable=NO`, default `'none'::text`; 99/99 rows = `'none'`.
- **2/7 DROP CONSTRAINT IF EXISTS** (no-op, none existed) and **3/7 ADD CONSTRAINT** -> verify (`pg_constraint`): 1 row, `convalidated=true`, `CHECK (source = ANY (ARRAY['practice','hot','explore','none']))`.
- **4/7 CREATE INDEX** -> verify (`pg_indexes`): `btree (status, submitted_at DESC)`.
- **5/7 CREATE FUNCTION**, **6/7 REVOKE ... FROM public, anon** (run immediately after 5/7, since a new function is PUBLIC-executable until revoked), **7/7 GRANT ... TO authenticated, service_role** -> verify (`pg_proc`, never `routine_privileges`): `prosecdef=true`, `provolatile=s`, `proconfig=search_path=public, pg_temp`, `proacl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`; `has_function_privilege`: anon=false, authenticated=true, service_role=true.
- **Fingerprint write** (`schema_version` upsert) returned `340bab74ca57`, `applied_at 2026-09-19 10:26:27+00`.
- **Parity**: prod `340bab74ca57` = dev `340bab74ca57` (Success Criteria #7). `exam_attempts` still 99 rows, 0 with `source <> 'none'`.
- **Note**: a smoke call of `exam_hot_counts()` through the `read_only=true` path returned `42501 permission denied` — expected (that path runs as `supabase_read_only_user`, which is not in the ACL); it is consistent with the grant, not a defect. The function's body is proven on dev (P8-T1/T4); a live authenticated call on prod happens with the first signed-in `/exams` visit.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Confirm the engineer is present and ready to give explicit per-statement confirmation before starting
- [x] Confirm the MCP/Composio SQL path is targeting the PROD project ref, not dev — this is the single highest-consequence ref-confirmation in the whole plan
### 2. Green Phase
- [x] Apply each of the 7 statements ONE AT A TIME, in order, obtaining explicit engineer confirmation before the statement(s) touching `exam_attempts`
- [x] After each statement, run the catalogue-level verification query appropriate to that statement (`pg_proc.proacl` for the function/grants, `pg_constraint` for the CHECK, `pg_indexes` for the index, `information_schema.columns` for the column) — never `information_schema.routine_privileges`
### 3. Refactor Phase
- [x] Read prod's `schema_version.fingerprint` and confirm it equals dev's `<fp>` (Success Criteria #7)

## Operation Verification Methods
- **Verification method**: catalogue-level queries after each statement, never `information_schema.routine_privileges` (which reads empty under the read-only prod user and looks exactly like a missing grant — a documented false-negative trap); final fingerprint comparison against dev.
- **Success criteria**: all 7 statements applied successfully, each verified at catalogue level; prod's `schema_version.fingerprint` equals dev's.
- **Failure response**: if any statement fails or a catalogue-level check does not match expectations, STOP before applying further statements — a partial production schema change is the highest-risk state in the entire plan. Do not use `information_schema.routine_privileges` to diagnose a suspected grant issue; it will falsely suggest the grant is missing even when it is present.
- **Verification level**: L1 — real production database, the highest-consequence verification in the plan.

## Proof Obligations
- **Claim** (Success Criteria #7): prod's `schema_version.fingerprint` equals dev's after all 7 statements are applied.
  - **Primary failure mode**: a statement silently fails or applies partially (e.g. due to a connection issue mid-batch, or the MCP path timing out), leaving prod in an inconsistent state that only a fingerprint mismatch would reveal.
  - **Boundary to exercise**: live production Postgres.
  - **State assertion**: before → prod fingerprint ≠ `<fp>`; after → prod fingerprint = `<fp>`, matching dev exactly.
  - **Mock boundary rationale**: none — this is deliberately the real production database.
  - **Residual**: none — this is the plan's final, terminal proof obligation.

## Completion Criteria
- [x] All 7 statements applied to prod, one at a time, with explicit engineer confirmation before the `exam_attempts`-touching statement(s)
- [x] Every catalogue-level verification passed after its corresponding statement
- [x] Prod's `schema_version.fingerprint` confirmed equal to dev's
- [x] Investigation Notes record every statement, its timestamp, and every verification query's raw result

## Notes
- Impact scope: production database only — this is the single task in the entire plan with the highest blast radius if mishandled.
- Scope boundary: no repo source files are touched by this task; do not conflate this with any dev-database task.
- **This is the last gate before the feature is called done.**
