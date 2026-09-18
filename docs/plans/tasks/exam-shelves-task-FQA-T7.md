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
- [ ] None (production database only — no repo source files changed by this task)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure step 9 — the exact statement-by-statement production apply procedure)
- `SOURCE/supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql` (P0-T3 — the 7 statements being applied, in order)
- project context: `.mcp.json` ref is PROD; dev server uses a different ref — **confirm the project ref before every call, this is production**

## Investigation Notes
_(Record here: each statement's application timestamp and the engineer's explicit confirmation before the `exam_attempts`-touching statement; each catalogue-level verification query's raw result after each statement; the final prod `schema_version.fingerprint` value.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Confirm the engineer is present and ready to give explicit per-statement confirmation before starting
- [ ] Confirm the MCP/Composio SQL path is targeting the PROD project ref, not dev — this is the single highest-consequence ref-confirmation in the whole plan
### 2. Green Phase
- [ ] Apply each of the 7 statements ONE AT A TIME, in order, obtaining explicit engineer confirmation before the statement(s) touching `exam_attempts`
- [ ] After each statement, run the catalogue-level verification query appropriate to that statement (`pg_proc.proacl` for the function/grants, `pg_constraint` for the CHECK, `pg_indexes` for the index, `information_schema.columns` for the column) — never `information_schema.routine_privileges`
### 3. Refactor Phase
- [ ] Read prod's `schema_version.fingerprint` and confirm it equals dev's `<fp>` (Success Criteria #7)

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
- [ ] All 7 statements applied to prod, one at a time, with explicit engineer confirmation before the `exam_attempts`-touching statement(s)
- [ ] Every catalogue-level verification passed after its corresponding statement
- [ ] Prod's `schema_version.fingerprint` confirmed equal to dev's
- [ ] Investigation Notes record every statement, its timestamp, and every verification query's raw result

## Notes
- Impact scope: production database only — this is the single task in the entire plan with the highest blast radius if mishandled.
- Scope boundary: no repo source files are touched by this task; do not conflate this with any dev-database task.
- **This is the last gate before the feature is called done.**
