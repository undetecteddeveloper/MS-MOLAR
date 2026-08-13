# Task 16: Full RLS Regression + Reduce Skeleton to Pointer (Work Plan Final Phase, Task F.1)

Metadata:
- Dependencies: support-system-work-plan-task-03 (Deliverable: ST-a..ST-e ported into `test-rls.ts`); implicitly all of Phase 1-3 (this is the closing regression gate over the complete feature surface)
- Provides: closing confirmation that the full `test-rls.ts` suite (including this feature's ST-a..ST-e) still passes after all downstream write paths (student submission, admin triage) have been built on top of the Phase 0 foundation
- Size: N/A (verification-only — no new source files; the pointer-reduction was already performed at Task 03, this task confirms it still holds)

## Implementation Content

Re-run `cd SOURCE && npx tsx supabase/test-rls.ts` (full suite, including ST-a..ST-e) as the closing regression gate, per this feature's service-integration-e2e timing guidance (executed once more in the final phase, in addition to Phase 0's required blocking early run). Confirm `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` is still reduced to a pointer comment (Task 03 performed this reduction; this task only re-confirms it was not accidentally reverted by any later change).

## Target Files
- [ ] None expected — this is a regression re-run, not a new implementation. If the re-run surfaces a real regression, the fix belongs in whichever already-touched file (task-01/task-03/task-13) the failing case implicates.

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (the full suite, especially the ST-a..ST-e section Task 03 added)
- `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` (confirm still a pointer comment, not reverted)
- `docs/plans/support-system-work-plan.md` (§ Notes — "RLS harness double-run reconciliation" — the explicit rationale for why this suite runs twice: once as Phase 0's blocking Early Verification Point, once here as the closing regression gate)

## Implementation Steps

Given this is a regression re-run rather than new-behavior implementation, the standard Red-Green-Refactor cycle does not apply as literally.

### 1. Run Phase (equivalent to Red — find any regression before declaring done)
- [ ] Run `cd SOURCE && npx tsx supabase/test-rls.ts` (full suite).
- [ ] Confirm all five ST-a..ST-e cases still pass with real error-class discrimination and state-recount discipline (Task 03's own bar, unchanged).
- [ ] Confirm `support.rls.service.e2e.test.ts` is still a pointer comment (not reverted by any Phase 1-3 change).

### 2. Fix Phase (equivalent to Green — resolve any regression found)
- [ ] If any case now fails, identify which Phase 1-3 change (if any) touched `schema.sql` or the RLS policies and revert/correct it in that task's own already-touched file — do not expand scope to an unrelated file.

### 3. Confirm Phase (equivalent to Refactor — final re-run)
- [ ] Re-run the full suite once more after any fix; confirm exit code 0.

## Quality Assurance Mechanisms
- `npx tsx supabase/test-rls.ts` (manual, not in CI) — Enforces: RLS isolation against real Postgres, two real users, anon key — Config: `SOURCE/supabase/test-rls.ts` — this task's own closing regression gate

## Operation Verification Methods
- **Verification method**: `cd SOURCE && npx tsx supabase/test-rls.ts` (full suite) executed once more, after Phase 1-3 are complete.
- **Success criteria**: exit code 0; all cases including ST-a..ST-e pass with the harness's own state-recount/error-class discipline.
- **Failure response**: any failure here means a Phase 1-3 change silently broke the authorization layer Phase 0 established — stop and correct the regression before proceeding to Task 18's broader QA sweep; do not treat this as a flaky-test retry candidate.
- **Verification level**: L1 (functional — real RLS isolation re-proven against a real Postgres instance, this feature's highest-consequence security guarantee, confirmed unbroken by every later change).

## Proof Obligations
- **Claim**: no Phase 1-3 implementation change silently broke the RLS isolation Phase 0/Task 03 established.
- **Primary failure mode**: a later task (most plausibly Task 13's admin service-role functions, which touch the same tables) introduced a schema/policy change that regresses `support_tickets`/`support_ticket_notes`/`support-screenshots` isolation.
- **Boundary to exercise**: real local Postgres (the same harness Task 03 used).
- **State assertion**: before = the same seeded fixture state Task 03 established; action = re-run the full suite; after = identical pass results to Task 03's original run.
- **Mock boundary rationale**: none — RLS cannot be proven by a mocked client.
- **Residual**: none — this is the feature's final RLS confirmation before ship.

## Completion Criteria
- [ ] `cd SOURCE && npx tsx supabase/test-rls.ts` exits 0 (full suite, including ST-a..ST-e)
- [ ] `support.rls.service.e2e.test.ts` confirmed still reduced to a pointer comment
- [ ] No regression found, or any regression found is fixed in its owning file and re-confirmed

## Notes
- Impact scope: none by default (verification-only); if a regression fix is required, it lands in whichever Phase 0-3 file the failing case implicates.
- Scope boundary: do not use this task to introduce new RLS cases beyond ST-a..ST-e — that would expand this feature's scope beyond what Task 03/the backend DD's Test Boundaries table define. A newly-discovered gap should be escalated, not silently patched into this closing regression task.
