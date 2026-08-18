# Phase 3 Completion: Order lifecycle, settlement, and My Orders

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 3** (estimated 9 commits)
Layer mix: **backend + frontend.**

## Task completion checklist

| Plan task | Task file | Layer | Done |
|---|---|---|---|
| 3.1 payOS adapter | `subscription-work-plan-backend-task-15.md` | backend | [ ] |
| 3.2 `settleOrder.ts` + `recordPaymentSettlement()` | `subscription-work-plan-backend-task-16.md` | backend | [ ] |
| 3.3 `checkoutOrder.ts` — the one mapper | `subscription-work-plan-backend-task-17.md` | backend | [ ] |
| 3.4 `createOrder()` / `recheckOrder()` + rate limits + **INT-3** | `subscription-work-plan-backend-task-18.md` | backend | [ ] |
| 3.5 `queries.ts` (closes CL-01) + **INT-2** | `subscription-work-plan-backend-task-19.md` | backend | [ ] |
| 3.6 S-05 page, C-07, C-08, boundary files | `subscription-work-plan-frontend-task-06.md` | frontend | [ ] |
| 3.7 C-10 + C-11 + remaining S-05 keys | `subscription-work-plan-frontend-task-07.md` | frontend | [ ] |
| 3.8 ★ frontend early verification point | `subscription-work-plan-frontend-task-08.md` | frontend | [ ] |
| 3.9 fixture-e2e FE-3 | `subscription-work-plan-frontend-task-09.md` | frontend | [ ] |

**Ordering constraint that is load-bearing**: plan Tasks 3.3 and 3.4 **precede** plan Task 3.5 (CL-01 `getMyOrder()` → `toCheckoutOrder()` fix).

## Test skeleton files to verify (paths)

- `SOURCE/tests/integration/subscription.int.test.ts` — **INT-3 filled in plan Task 3.4 commit; INT-2 filled in plan Task 3.5 commit** (integration 2/3)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — **FE-3 filled in plan Task 3.9** (fixture-e2e 2/3)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — untouched (service 0/2)

## Phase Completion Criteria (from the work plan, verbatim)

- [ ] An order settles end-to-end through `recheckOrder()` on dev, with no webhook involved
- [ ] ★ Frontend early verification point passed (non-empty `/me/orders` with a correct C-11)
- [ ] INT-3 green **from plan Task 3.4 commit**, INT-2 green **from plan Task 3.5 commit** — each integration case filled by the task implementing the behaviour it asserts, under `npm run test:integration` against dev
- [ ] All **five** `SettleResult` refusal reasons implemented and reachable; all **seven** C-10 outcome sentences rendered and asserted per locale, pairwise distinct
- [ ] **No production deploy of this branch has occurred** — this phase code reads `payment_orders` and renders S-05, and SVC-2 (plan Task 6.2) has not run
- [ ] FE-3 green
- [ ] `rateLimit.test.ts` four existing assertion blocks pass **unmodified**
- [ ] Test-case resolution: integration 2/3, fixture-e2e 2/3
- [ ] Quality check (staged): `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`

## Failure response

If C-11 shows Free for a Premium user, **stop**. If a date is one day off, **stop**. Neither is a defect to work around; both invalidate the design premises.

## Deployment Sequencing

- **Production deploy permitted at end of Phase 3: No.** What must be green first: **plan Task 5.8**; **and plan Task 6.2 (SVC-2) before S-05 is reachable by real users**, per FE-B-02 escalation condition.
