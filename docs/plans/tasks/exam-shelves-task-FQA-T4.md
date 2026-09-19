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
- [x] None (verification-only task; no source files changed)

## Investigation Targets
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D1, D6; § Consequences; § Implementation Guidance)
- `docs/design/exam-shelves-backend-design.md` (§ Security Considerations)
- `SOURCE/supabase/schema.sql` (the final, shipped §20a/20b/20c block — confirm 0 RLS policy statements added/altered/dropped anywhere in this feature's diff)
- `docs/plans/tasks/exam-shelves-task-P8-T1.md`, `docs/plans/tasks/exam-shelves-task-P8-T2.md`, `docs/plans/tasks/exam-shelves-task-P8-T4.md` (the 3 already-landed proofs this review cross-references, rather than re-deriving)
- `SOURCE/lib/exams/attemptSource.ts` (P1-T5 — the single normalisation point for `?from=` before it reaches SQL)
- `SOURCE/features/exams/queries/hotCounts.ts` (P3-T1 — the single hour-snapped window computation)

## Investigation Notes

security-reviewer sign-off: **approved_with_notes**, 0 required fixes. All 4 named properties confirmed, each cross-referenced against source and an already-landed live-dev proof:

1. **`exam_hot_counts()` security definer, anon revoked, authenticated+service_role granted** — `schema.sql:2602-2642` (`security definer`, `revoke all ... from public, anon`, `grant execute ... to authenticated, service_role`); live-proven by P8-T1's verify-schema probes, P8-T2's HS-e, P8-T4's obligation (f).
2. **Window boundaries hour-snapped server-side** — `schema.sql:2618-2624` (`date_trunc('hour', ...)` inside the SQL body; Node's `hotWindows()` in `hotCounts.ts:55-60` only subtracts days, never snaps); live-proven by P8-T4's obligation (d) (1s-before/1s-after the boundary).
3. **0 RLS policy changes on `exam_attempts`** — `git diff 5267fd9^ HEAD -- SOURCE/supabase/schema.sql | grep -n "create policy\|alter policy\|drop policy"` returns 0 matches across the feature's whole diff; cross-referenced against P8-T2's HS-a positive control.
4. **`?from=` normalised exactly once, server-side** — traced end to end: `[id]/page.tsx` reads raw `searchParams.from` untyped → `StartAttemptButton.tsx` passes it untouched as a bound server-action arg → `actions.ts`'s `startAttempt` calls `toAttemptSource(rawSource)` (`attemptSource.ts:25-28`, the sole normalisation point, whitelist of 4 literals, never throws) — no raw client string reaches `.insert()`. DB-layer second wall: the `exam_attempts_source_check` CHECK constraint, proven by P8-T2's HS-g (23514 on `source='hacked'`).

Also independently checked beyond the task's named 4 properties: `/exams` absent from `PUBLIC_PATHS` (still auth-gated); F-001 home guard confirmed at `app/page.tsx`; all feature reads use the parameterized query builder/`.rpc()` (0 raw SQL concatenation); 0 hardcoded secrets/eval/`dangerouslySetInnerHTML` in the feature's changed files; Next.js pinned past CVE-2025-29927, and even under that CVE class the real authorization boundary is DB-layer RLS, not middleware.

Two non-blocking notes recorded (no fix required):
- **Hardening (medium confidence)**: `exam_hot_counts()` has no application-level rate limit on the read path (unlike write paths using `guard()`). Acceptable today (authenticated-only, aggregate-only, hour-snapped), but `guard()` could be applied as defense-in-depth later.
- **Policy (documented trade-off, not a defect)**: ADR-0021 explicitly accepts the aggregate is not k-anonymous at low volumes, with a named revisit trigger ("if the shelf ever shows anything alongside the count") — a deliberate product decision, not a coding gap.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read the ADR's Security Considerations and the backend DD's own § Security Considerations section in full
### 2. Green Phase
- [x] For each of the 4 named properties, locate the specific already-landed proof (test case, grant, or code path) that establishes it
- [x] Confirm `schema.sql`'s feature diff contains 0 RLS policy statements (grep for `create policy`/`alter policy`/`drop policy` restricted to this feature's changed lines)
### 3. Refactor Phase
- [x] N/A — this task changes no source files

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
- [x] All 4 named security properties confirmed, each with a specific proof reference
- [x] `schema.sql`'s feature diff confirmed to contain 0 policy statements
- [x] Investigation Notes record the full checklist confirmation

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task.
