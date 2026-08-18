# Phase 6 Completion: Quality Assurance (final phase)

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 6** (estimated 4 commits)
Layer mix: cross-layer (backend + frontend) + operations. **This is where the service-integration-e2e lane executes.**

## Task completion checklist

| Plan task | Task file | Layer | Kind | Done |
|---|---|---|---|---|
| 6.1 SVC-1 settlement idempotency | `subscription-work-plan-backend-task-29.md` | backend | automated | [ ] |
| 6.2 SVC-2 owner-scoping (**gate for S-05 reaching real users**) | `subscription-work-plan-backend-task-30.md` | backend | automated | [ ] |
| 6.3 Full regression across every adopted gate | `subscription-work-plan-backend-task-31.md` | backend | automated | [ ] |
| 6.4 Security review (ADR-0014 end to end) | `subscription-work-plan-backend-task-32.md` | backend | review | [ ] |
| 6.5 ⚠ **MANUAL** browser passes | `subscription-work-plan-frontend-task-15.md` | frontend | **manual** | [ ] |
| 6.6 Documentation close-out + AC sweep | `subscription-work-plan-backend-task-33.md` | backend | docs | [ ] |
| 6.7 ⚠ **MANUAL, REAL MONEY** — blocked on **BU-1** | `subscription-work-plan-backend-task-34.md` | backend | **manual / blocked** | [ ] |
| 6.8 ⚠ **MANUAL** pre-sale gate — blocked on **BU-1, BU-4, BU-5** | `subscription-work-plan-backend-task-35.md` | backend | **manual / blocked** | [ ] |

## Test skeleton files to verify (paths)

- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — **SVC-1 (plan Task 6.1) and SVC-2 (plan Task 6.2) executed here; lane complete (2/2)**
- `SOURCE/tests/integration/subscription.int.test.ts` — complete since Phase 5 (3/3); re-run in plan Task 6.3
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — complete since Phase 4 (3/3); re-run in plan Task 6.3

## Quality Assurance (from the work plan, verbatim)

- [ ] Quality check (staged)
- [ ] All tests pass (`npm test`, `npm run test:integration`, `npm run test:localdb`, the three fixture-e2e scripts)
- [ ] Static check pass (`npx tsc --noEmit`)
- [ ] Lint check pass (`npm run lint`)
- [ ] Build success (`npm run build`)
- [ ] `npm run check:bundle` pass
- [ ] `npm run verify:schema` pass on dev **and** prod

## Completion Criteria (from the work plan, verbatim)

- [ ] All phases completed
- [ ] **Test-case resolution: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/2 — unresolved tests: 0**
- [ ] Both Design Docs acceptance criteria satisfied, or deferred with a named owner
- [ ] `verify:schema` green on **both** dev and prod, fingerprints matching git, prod **content** verified by a real query (not a fingerprint comparison)
- [ ] `test-rls.ts` Phần 8 passing
- [ ] Staged quality checks completed (zero errors) across lint, types, tests, build and bundle scan
- [ ] Security review complete (plan Task 6.4), including P-1 and the enumeration-oracle checks
- [ ] Manual browser passes complete, including FE-AC-26 and the second verification point four observations
- [ ] `SOURCE/lib/billing/types.ts` unmodified
- [ ] Real-money end-to-end verified on production (plan Task 6.7) — **or** explicitly deferred with BU-1 recorded as the reason
- [ ] Pre-sale gate closed: BU-1, BU-4, BU-5 (plan Task 6.8) — **or** selling explicitly not yet enabled, with the open items named
- [ ] The **five** justified traceability gaps — **TBD-05, TBD-08, TBD-09, ADR-0018/BU-2, E-01/BU-3** — confirmed by the engineer
- [ ] The **two** non-blocking engineer-owned open items — **BU-2** (ADR-0018) and **BU-3** (E-01) — confirmed by the engineer
- [ ] **BU-6** resolved (the DD revision landed and plan Task 1.6 shipped with its own DDL block, allowlist coverage and RLS denial group) — **or** explicitly still open, with plan Task 1.6 and BU-4 recorded as what it holds
- [ ] Necessary documentation updated
- [ ] User review approval obtained

## Manual and blocked checkpoints in this phase

- **Plan Task 6.5** — manual: requires a human, `npm run pw` and a **real mid-range Android**. A green unit test does not discharge FE-AC-26.
- **Plan Task 6.7** — manual and **blocked on BU-1**: real money on production; cannot execute until the purchase control is enabled.
- **Plan Task 6.8** — manual and **blocked on BU-1, BU-4, BU-5**; BU-4 is itself blocked through **BU-6 → Task 1.6 → BU-4 → Task 6.8**. **The sale date moves rather than two blank legal pages shipping.**

## Deployment Sequencing

- **Production deploy permitted at end of Phase 6: Yes, with two further gates** — **plan Task 6.2** before S-05 reaches real users; **plan Task 6.8** (BU-1 + BU-4 + BU-5) before the purchase control is enabled, which is what makes a real transaction, and therefore plan Task 6.7, reachable at all.
