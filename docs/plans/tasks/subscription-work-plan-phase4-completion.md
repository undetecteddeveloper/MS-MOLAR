# Phase 4 Completion: Payment screen and webhook

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 4** (estimated 6 commits)
Layer mix: **backend + frontend.**

## Task completion checklist

| Plan task | Task file | Layer | Done |
|---|---|---|---|
| 4.1 Webhook route + `PUBLIC_PATHS` + bundle markers | `subscription-work-plan-backend-task-20.md` | backend | [ ] |
| 4.2 S-06 route + `?order=` parsing + boundary files | `subscription-work-plan-frontend-task-10.md` | frontend | [ ] |
| 4.3 C-12 / C-13 / C-14 / C-15 + S-06 keys | `subscription-work-plan-frontend-task-11.md` | frontend | [ ] |
| 4.4 `PurchaseCta` handler wiring | `subscription-work-plan-frontend-task-12.md` | frontend | [ ] |
| 4.5 C-15 legal-gate combined test | `subscription-work-plan-frontend-task-13.md` | frontend | [ ] |
| 4.6 fixture-e2e FE-1 | `subscription-work-plan-frontend-task-14.md` | frontend | [ ] |

## Test skeleton files to verify (paths)

- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — **FE-1 filled in plan Task 4.6; lane complete (3/3)**
- `SOURCE/tests/integration/subscription.int.test.ts` — unchanged in this phase (integration 2/3)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — untouched (service 0/2)

## Phase Completion Criteria (from the work plan, verbatim)

- [ ] Unauthenticated **write** paths = exactly 1, with a reason comment at the entry
- [ ] `npm run check:bundle` green with the new payOS markers
- [ ] S-06 renders a pending order, and remains completable from the text block with the QR absent
- [ ] The legal gate holds independently of the release flag (plan Task 4.5 single combined test green)
- [ ] FE-1 green; **fixture-e2e lane 3/3 resolved**
- [ ] Test-case resolution: integration 2/3, fixture-e2e 3/3
- [ ] **No production deploy of this branch has occurred** — this phase code reads `payment_orders` and admits the webhook path, and prod has neither table until plan Task 5.8
- [ ] Quality check (staged): `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run check:bundle`

## Deployment Sequencing

- **Production deploy permitted at end of Phase 4: No.** What must be green first: **plan Task 5.8**; **and plan Task 6.2 before S-05 is reachable by real users**.

## Blocked / engineer-owned notes for this phase

- **BU-1 (TBD-02, legal content)** blocks nothing here: **S-06 ships with the confirm control inert and a readable reason, which is the specified behaviour, not a degradation.**
- **BU-2 (ADR-0018, QR encoder)** is **non-blocking**: without it `VietQrCode` renders nothing and S-06 stays payable from C-14 text block — which is what AC-028 requires anyway.
