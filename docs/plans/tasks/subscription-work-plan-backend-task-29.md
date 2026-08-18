# Task: service-integration-e2e SVC-1 — settlement grants exactly one period, exactly once, and only after the provider says paid

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.1**
Layer: **backend** (`SOURCE/tests/e2e/service/**` against real Postgres)

Metadata:
- Dependencies: backend-task-02 (`test:localdb`), backend-task-07 (service fixtures), backend-task-11 (gate B on dev), backend-task-16 (`settleOrder`), backend-task-09 (the SQL function)
- Provides: the proof of ADR-0014 idempotency **and** of the recorded two-statement deviation
- Size: Small (1 test file)

## Implementation Content

Against the **real dev database**, after gate B is green there. **Only the payOS adapter is stubbed (and counted); `service-role.ts` is left real**, because this case claim is about the write, not about call order.

Read observable state **before and after by query** for every claim: `subscriptions.expires_at`, `subscriptions.period_anchor_at`, `payment_orders.status`, `payment_orders.settled_at`.

Cases (a)…(h) exactly as the skeleton specifies, including:
- the **replay** boundary — *n* ≥ 3 replays ⇒ `expires_at` still advanced by **exactly one period in total**;
- the **early-purchase** branch — 10 days remaining ⇒ **+40 days** and `period_anchor_at` moved to now (more days, **one** allowance);
- the negative that settlement is **never reachable** without a preceding `getPaymentStatus() === "paid"` — **a row count of 0 after the call is the assertion**;
- the **adapter-rejects** negative — zero writes, adapter invocation count **exactly 1**, no retry storm;
- `record_payment_settlement` **not** executable with a user JWT (AC-033).

**Expected instants are hardcoded in the test, never read back from the implementation.** Teardown removes every fixture-prefixed row.

**This is also what proves the recorded ADR-0014 deviation** (two statements rather than one) rather than assuming it: **run the concurrent-settlement case, not only the sequential one.**

## Target Files
- [ ] `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-1 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-1** `Proof obligation:` / `Primary failure mode:` annotation block — cases (a)…(h))
- `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` (plan Task 0.8 — prefix, sessions, counted adapter stub)
- `SOURCE/lib/billing/settleOrder.ts` (plan Task 3.2 — the four-step order)
- `SOURCE/lib/supabase/service-role.ts` (`recordPaymentSettlement()` — left **real**)
- `SOURCE/supabase/schema.sql` (`record_payment_settlement` — the `status='pending'` guard, the `greatest()` extension, the revokes)
- `SOURCE/vitest.localdb.config.ts` (plan Task 0.2)
- `docs/design/subscription-backend-design.md` (§ Second verification point)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance) | data_flow | "Extend with `max(expires_at, now()) + 30 days`. Write it once, in one function, and test **all three cases: still valid, inside grace, past grace**" | All three cases are executed against the real function and each asserts a hardcoded expected instant |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | persistence | Replay defence is state-based: idempotency is the order own `pending → paid` transition, guarded in SQL — no nonce table, no timestamp window, no clock | *n* ≥ 3 replays advance `expires_at` by exactly one period in total, and `settled_at` is set once |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, `record_payment_settlement`) | derived-display | `set expires_at = greatest(public.subscriptions.expires_at, now()) + make_interval(days => p_period_days)`, `period_anchor_at = now()` — in the same statement | The early-purchase case observes +40 days from a 10-days-remaining start and `period_anchor_at` moved to now |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the (a)…(h) case list verbatim
- [ ] Write each case with **hardcoded expected instants** and before/after queries; confirm they fail against a deliberately weakened guard
### 2. Green Phase
- [ ] Execute under `npm run test:localdb` against dev; all cases green
### 3. Refactor Phase
- [ ] Re-run twice in a row to confirm teardown idempotency; run the concurrent case repeatedly

## Quality Assurance Mechanisms
- Real-Postgres integration tests (precedent `recordSkillMastery.int.test.ts`) — Enforces: `greatest()`, `on conflict do update`, the `status='pending'` guard, the row lock, RLS visibility — Config: `SOURCE/vitest.localdb.config.ts`
- `SOURCE/supabase/test-rls.ts` — Enforces: the AC-033 denial (a user JWT cannot execute the function)

## Operation Verification Methods
- **Verification method**: real-Postgres service-lane execution with only the payOS adapter stubbed and counted; every claim read back by query.
- **Success criteria**: all (a)…(h) cases green; the concurrent case green; `expires_at` advanced by exactly one period across *n* ≥ 3 replays; `settled_at` set once; a row count of **0** after a call with no preceding `paid`.
- **Failure response**: if the concurrent case fails, the recorded two-statement deviation is **not** safe — fall back to the recorded alternative (a single data-modifying CTE plus an explicit null-beneficiary post-check, a local change to that one function) rather than accepting the result.
- **Verification level**: L1 (real database, real function, observable rows).

## Proof Obligations
- **Claim (no-op)**: a repeated settlement of an already-settled record changes nothing and reports so.
- **Primary failure mode**: asserting settlement succeeded does not prove the second replay wrote nothing — the named hollow-test shape for this feature.
- **Boundary to exercise**: the real dev Postgres, through `settleOrder()` and the real `service-role.ts`.
- **State assertion**: `expires_at`, `period_anchor_at`, `status`, `settled_at` read **before and after each** replay; total advance exactly one period; `settled_at` unchanged after the first.
- **Mock boundary rationale**: only the payOS adapter is stubbed (external paid service) and it is counted; everything else is real.
- **Residual**: production behaviour under a genuine payOS delivery is plan Task 6.7.

## Completion Criteria
- [ ] All (a)…(h) cases green, including the concurrent-settlement case
- [ ] Expected instants hardcoded in the test, never read back from the implementation
- [ ] Teardown removes every fixture-prefixed row; the suite passes twice in a row
- [ ] Every Binding Decisions and Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Test-case resolution: **service-integration-e2e 1/2**

## Notes
- Impact scope: test only.
- Scope boundary: `service-role.ts` stays real; do not stub it to make a case pass.

## Investigation Notes
(Record the before/after query results, the hardcoded instants, and each Compliance Check result here.)
