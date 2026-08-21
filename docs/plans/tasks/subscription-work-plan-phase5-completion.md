# Phase 5 Completion: AI cost gates and refusal attribution

Plan: `docs/plans/subscription-work-plan.md` (v1.2) — **Phase 5** (estimated 8 commits)
Layer mix: **backend**, with the frontend surfaces it feeds already shipped (C-05 blocked-quota branch and C-06, both verified in Phase 2).

## Task completion checklist

| Plan task | Task file | Layer | Done |
|---|---|---|---|
| 5.1 `quota.ts` — `consumeQuota()` | `subscription-work-plan-backend-task-21.md` | backend | [ ] |
| 5.2 gemini chokepoint + cost table | `subscription-work-plan-backend-task-22.md` | backend | [ ] |
| 5.3 tutor gate (UI-D3 / AC-041 constraint) | `subscription-work-plan-backend-task-23.md` | backend | [ ] |
| 5.4 upload gate + **INT-1** | `subscription-work-plan-backend-task-24.md` | backend | [x] |
| 5.5 telemetry codes + OK-04 mapping | `subscription-work-plan-backend-task-25.md` | backend | [ ] |
| 5.6 B-01 tier-conditional limit | `subscription-work-plan-backend-task-26.md` | backend | [ ] |
| 5.7 AC-047 telemetry distinguishability | `subscription-work-plan-backend-task-27.md` | backend | [ ] |
| 5.8 ⚠ **MANUAL** — prod apply + gate B on prod | `subscription-work-plan-backend-task-28.md` | backend | [ ] |

## Test skeleton files to verify (paths)

- `SOURCE/tests/integration/subscription.int.test.ts` — **INT-1 filled in plan Task 5.4 commit; lane complete (3/3)**
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` — complete since Phase 4 (3/3)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — **executes only in Phase 6** (service 0/2)

## Phase Completion Criteria (from the work plan, verbatim)

- [ ] Both AI paths refuse at the plan limit and at the project budget, with **zero** Gemini calls on refusal
- [ ] `client.models.generateContent` resolvable in exactly one module
- [ ] `telemetry.test.ts:261` passes **unmodified**; the added schema-parse case finds both in-file literal lists
- [ ] `rateLimit.test.ts` four existing assertion blocks pass **unmodified**; one added paid-tier case green
- [ ] INT-1 green; **integration lane 3/3 resolved**
- [ ] The per-user counter key is byte-identical across the read and write paths for all three fixtures; the key template has exactly one construction site
- [ ] `ExplainStepAffordance.tsx` unmodified; the client-visible refusal union is still exactly four literals; the quota distinction exists only in `telemetry_log.error_code`
- [ ] ⚠ Gate B green on **prod**, content verified by a real query
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — and not before
- [ ] Test-case resolution: integration 3/3, fixture-e2e 3/3, service-integration-e2e 0/2
- [ ] Quality check (staged): `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run check:bundle`

## Failure response

Plan Task 5.8 failure: **stop. Do not deploy the AI gates.**

## Deployment Sequencing

- **Production deploy permitted at end of Phase 5: Yes — this is the earliest permitted production deploy**, and only after **plan Task 5.8** is green: identical DDL applied to prod, gate B green on prod, the widened `telemetry_log` CHECK present, **verified by a real counting/inspection query, not a fingerprint comparison**.
- **Rollback note**: the `telemetry_log` constraint widening is safe to roll back **only before** the deploy that starts writing the new codes. After that deploy, a rollback re-narrows a CHECK that live code is writing against, and the rejected inserts are silent.
