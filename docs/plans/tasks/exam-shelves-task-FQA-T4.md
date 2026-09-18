# Task FQA-T4 — Security review: ADR-0021 Security Considerations confirmed implemented

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T4**
Layer: cross-cutting (verification only — no source files changed)

Metadata:
- Dependencies: Phase 8 complete (P8-T1/T2/T4 already proved each item individually; this task confirms the whole-feature picture)
- Blocks: none
- Size: Small (0 files; 1 review pass)
- Verification level: L2

## Implementation Content
Security review — confirm ADR-0021's Security Considerations are implemented: `exam_attempts` RLS unweakened (0 policy changes); RPC granted to `authenticated`+`service_role` only; `?from=` normalised before reaching SQL; window boundaries hour-snapped server-side.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D1, D6; § Consequences; § Implementation Guidance)
- `docs/design/exam-shelves-backend-design.md` (§ Security Considerations)
- `SOURCE/supabase/schema.sql` (the final, shipped §20a/20b/20c block — confirm 0 RLS policy statements added/altered/dropped anywhere in this feature's diff)
- `docs/plans/tasks/exam-shelves-task-P8-T1.md`, `docs/plans/tasks/exam-shelves-task-P8-T2.md`, `docs/plans/tasks/exam-shelves-task-P8-T4.md` (the 3 already-landed proofs this review cross-references, rather than re-deriving)
- `SOURCE/lib/exams/attemptSource.ts` (P1-T5 — the single normalisation point for `?from=` before it reaches SQL)
- `SOURCE/features/exams/queries/hotCounts.ts` (P3-T1 — the single hour-snapped window computation)

## Investigation Notes
_(Record here: a checklist confirmation for each of the 4 named security properties, with a pointer to the specific already-landed proof — P8-T1's probe, P8-T2's HS-a/HS-e, P8-T4's obligations (d)/(f) — that established it, rather than re-testing from scratch.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read the ADR's Security Considerations and the backend DD's own § Security Considerations section in full
### 2. Green Phase
- [ ] For each of the 4 named properties, locate the specific already-landed proof (test case, grant, or code path) that establishes it
- [ ] Confirm `schema.sql`'s feature diff contains 0 RLS policy statements (grep for `create policy`/`alter policy`/`drop policy` restricted to this feature's changed lines)
### 3. Refactor Phase
- [ ] N/A — this task changes no source files

## Operation Verification Methods
- **Verification method**: cross-reference review against already-landed proofs (P8-T1/T2/T4), plus a direct grep of `schema.sql`'s feature diff for policy statements.
- **Success criteria**: all 4 properties confirmed, each with a specific pointer to its proof; 0 policy statements found in the feature's `schema.sql` diff.
- **Failure response**: if any property lacks a clear already-landed proof, this blocks sign-off — do not assume it is "probably fine" because the feature otherwise works; escalate to add the missing proof before continuing.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: `exam_attempts` RLS is unweakened by this feature — 0 policy changes anywhere in the diff.
  - **Primary failure mode**: a policy was inadvertently touched while adding the `source` column or the new index, widening what a non-owner can read/write.
  - **Boundary to exercise**: static diff of `schema.sql`'s feature-scoped changes (grep for policy DDL keywords).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this is confirmed statically and cross-referenced against P8-T2's HS-a runtime proof.
- **Claim**: `?from=` is normalised (via `toAttemptSource`) before reaching SQL — no raw client string ever reaches the `exam_attempts.source` insert.
  - **Primary failure mode**: a future edit bypasses `toAttemptSource` and passes a raw value directly into the insert.
  - **Boundary to exercise**: code-path review of `startAttempt` (P1-T5) and its call site (P6-T1).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: this is a static/manual code review confirmation; the CHECK constraint (proven by P8-T2's HS-g) is the DB-layer last-line defense if this were ever bypassed.

## Completion Criteria
- [ ] All 4 named security properties confirmed, each with a specific proof reference
- [ ] `schema.sql`'s feature diff confirmed to contain 0 policy statements
- [ ] Investigation Notes record the full checklist confirmation

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task.
