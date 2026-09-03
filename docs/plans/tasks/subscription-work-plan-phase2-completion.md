# Phase 2 Completion: Entitlement read made observable (★ early verification point)

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 2** (estimated 5 commits)
Layer mix: **backend + frontend.** The cross-layer seam is verified in this phase, not at the end.

## Task completion checklist

| Plan task | Task file | Layer | Done |
|---|---|---|---|
| 2.1 Fill `readEntitlement(userId)` body | `subscription-work-plan-backend-task-14.md` | backend | [ ] |
| 2.2 Mount `EntitlementProvider` in both layouts | `subscription-work-plan-frontend-task-02.md` | frontend | [ ] |
| 2.3 Formatters + C-09 + S-05 dictionary keys | `subscription-work-plan-frontend-task-03.md` | frontend | [ ] |
| 2.4 Mount `TutorQuotaNote`; retire `formattedResetDate` | `subscription-work-plan-frontend-task-04.md` | frontend | [x] |
| 2.5 fixture-e2e FE-2 | `subscription-work-plan-frontend-task-05.md` | frontend | [ ] |

**Ordering constraints that are load-bearing**: plan Task 0.3 (backend-task-03) **precedes** plan Task 2.4; plan Task 2.2 **precedes** plan Task 2.4 (without the `(exams)` provider the mount renders `null` forever while lint, build and the unit test pass).

## Test skeleton files to verify (paths)

- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — **FE-2 filled and executed in this phase** (fixture-e2e 1/3)
- `SOURCE/tests/integration/subscription.int.test.ts` — untouched in this phase (integration 0/3)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — untouched (service 0/2)

## Phase Completion Criteria (from the work plan, verbatim)

- [ ] ★ **Early verification point passed**: a seeded Premium row makes a gated component render a real plan and a real remaining count; a new account reads `free`
- [ ] One render test per route group asserting a gated child does **not** receive `FREE_FALLBACK`, both green
- [ ] Formatter and C-09 unit tests green, including the fabricated-status case
- [x] `formattedResetDate` no longer declared on `TutorQuotaNote`; the mount passes no prop
- [ ] FE-2 passes against the real route tree
- [ ] The period-start derivation has exactly one implementation (`periodStartEpoch()` in `quota.ts`), imported by the read path
- [ ] **No production deploy of this branch has occurred** — this phase code reads `subscriptions`, which production does not have until plan Task 5.8
- [ ] `SOURCE/lib/billing/types.ts`, `entitlement.tsx`, `(billing)/layout.tsx` and `ExplainStepAffordance.tsx` unmodified
- [ ] Quality check (staged): `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`

## Failure response

If `PlanSummary` (or any gated component) shows Free for a Premium user, **stop**: the route group or the provider mount is wrong and **every downstream test would pass while the screen lied**. If a rendered date is one day off, **stop**: the `timeZone` pin is missing or a legacy formatter was used. **Neither is a defect to work around.**

## Deployment Sequencing

- **Production deploy permitted at end of Phase 2: No** — the code reads `subscriptions`. What must be green first: **plan Task 5.8** (prod apply + gate B on prod, content verified by a real query).
