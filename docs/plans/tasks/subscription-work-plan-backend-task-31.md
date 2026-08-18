# Task: Full regression across every adopted gate

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.3**
Layer: **backend** (repo-wide command execution; no React implementation)

Metadata:
- Dependencies: every implementation task in Phases 1–5, plus backend-task-29 and backend-task-30
- Provides: the evidence record for the plan Quality Assurance section
- Size: Small (no source file changed unless a gate goes red)

## Implementation Content

Run, from `SOURCE/`, and record each result:

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run check:bundle`
- `npm run verify:schema` on **dev and prod** — **two runs.** This is a **standalone script** (`npx tsx supabase/verify-schema.ts`), **not** part of `check:bundle`
- `SOURCE/supabase/test-rls.ts` including **Phần 8**
- `npm run test:integration` (INT-1…INT-3)
- `npm run test:localdb` (SVC-1, SVC-2)
- the three fixture-e2e cases (FE-1, FE-2, FE-3)

## Target Files
- [ ] (none — unless a gate goes red, in which case the fix belongs to the owning task, not to this one)
- [ ] Record every command and its result in the plan Phase 6 Notes

## Investigation Targets
- `SOURCE/package.json` (`:7` build, `:9` lint, `:10` test, `:12` check:bundle, `:13` verify:schema, `:14` pw — confirm which script is which before running)
- `docs/plans/subscription-work-plan.md` (§ Quality Assurance Mechanisms — the adopted gates and their covered files)
- `docs/plans/subscription-work-plan.md` (§ Completion Criteria — the test-case resolution counts this run must confirm)
- `SOURCE/supabase/test-rls.ts` (Phần 8 from plan Task 1.5)

## Quality Assurance Mechanisms
(All adopted mechanisms in the plan header apply to this task, because it runs all of them.)

## Operation Verification Methods
- **Verification method**: execute each command from `SOURCE/` and capture its exit status and summary line.
- **Success criteria**: every gate green; test-case resolution confirmed as **integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/2 — unresolved tests: 0**; `verify:schema` green on **both** environments with fingerprints matching git.
- **Failure response**: a red gate is routed back to the task that owns the file, not patched here. Note that under cold-cache parallel load one tutor unit test can exceed the 5000 ms default and passes in isolation — re-run it alone before treating it as a regression.
- **Verification level**: L2/L3 across the suite; L1 for the DB-side checks.

## Proof Obligations
- **Claim**: every adopted quality mechanism passes against the final state of the branch.
- **Primary failure mode**: `verify:schema` is assumed to have run because `check:bundle` did — they are **two distinct scripts** and neither pipes into the other, so one silently never runs.
- **Boundary to exercise**: the real CLI invocations, both databases, and all three test lanes.
- **State assertion**: N/A (read-only verification).
- **Mock boundary rationale**: none — every gate runs for real.
- **Residual**: the manual browser passes (plan Task 6.5) and the real-money transaction (plan Task 6.7) are **not** covered by any command here.

## Completion Criteria
- [ ] All listed commands executed from `SOURCE/` and their results recorded
- [ ] `npm run verify:schema` run **twice** (dev and prod), separately from `npm run check:bundle`
- [ ] `test-rls.ts` Phần 8 passing
- [ ] Test-case resolution: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/2

## Notes
- Impact scope: verification only.
- Scope boundary: fixes belong to the owning task; this task records results.
