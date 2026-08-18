# Phase 0 Completion: Design-sync reconciliation and test harness

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 0** (estimated 9 commits, one per task)
Layer mix: documents + build configuration only. **No product code.**

## Task completion checklist

| Plan task | Task file | Layer | Done |
|---|---|---|---|
| 0.1 `vitest.integration.config.ts` + `test:integration` | `subscription-work-plan-backend-task-01.md` | backend | [ ] |
| 0.2 `vitest.localdb.config.ts` + `test:localdb` | `subscription-work-plan-backend-task-02.md` | backend | [ ] |
| 0.3 CL-02 UI Spec / frontend DD amendment (**must precede plan Task 2.4**) | `subscription-work-plan-backend-task-03.md` | backend | [ ] |
| 0.4 ST-01 — unblock slice S2 | `subscription-work-plan-backend-task-04.md` | backend | [ ] |
| 0.5 Documentation hygiene batch A (CL-03, CL-04, ST-02, ST-03) | `subscription-work-plan-backend-task-05.md` | backend | [ ] |
| 0.6 Documentation hygiene batch B (ST-04, ST-05, CL-05, CL-06, LO-01, LO-02) | `subscription-work-plan-backend-task-06.md` | backend | [ ] |
| 0.7 fixture-e2e harness and fixture data | `subscription-work-plan-frontend-task-01.md` | frontend | [ ] |
| 0.8 service-e2e fixtures + two-session auth fixture | `subscription-work-plan-backend-task-07.md` | backend | [ ] |
| 0.9 ⚠ ESCALATION — undesigned usage sink (raises BU-6) | `subscription-work-plan-backend-task-08.md` | backend | [ ] |

## Test skeleton files to verify (paths)

- `SOURCE/tests/integration/subscription.int.test.ts` — INT-1, INT-2, INT-3 (**stay comments-only in Phase 0**)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — FE-1, FE-2, FE-3 (**stay comments-only in Phase 0**)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — SVC-1, SVC-2 (**stay comments-only in Phase 0**)

## Phase Completion Criteria (from the work plan, verbatim)

- [ ] `npm test` collects the same files as before Phase 0 and is green
- [ ] `npm run test:integration` and `npm run test:localdb` both resolve their configs and run (0 tests, skeletons still comments-only)
- [ ] UI Spec UI-D17 / C-06 delta amended; frontend `ui:06` corrected; X-13 recorded
- [ ] FE-B-01 / FE-B-02 reconciled as closed in the frontend DD; S2 no longer documented as un-startable
- [ ] AC-050 **deferral** (UI Spec `:404`, S-07, P2; PRD R15 Should Have) recorded alongside its owner; no task claims to implement it
- [ ] BU-6 raised: the `:79`/`:145` contradiction has an escalation row and a requested DD revision; **no task instructs an implementer to choose a schema alternative**
- [ ] Every design-sync item with a code or document consequence has a covering amendment
- [ ] Quality check (staged): `npm run lint`, `npx tsc --noEmit`

## Deployment Sequencing

- **Production deploy permitted at end of Phase 0: No** (nothing to deploy — documents and test configs only).
