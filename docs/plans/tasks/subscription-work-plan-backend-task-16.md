# Task: `settleOrder.ts` + `recordPaymentSettlement()` in `service-role.ts`

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.2**
Layer: **backend** (`SOURCE/lib/billing/**`, `SOURCE/lib/supabase/**`)

Metadata:
- Dependencies: backend-task-15 (plan Task 3.1 — the adapter)
- Provides: the **only** code path that can extend entitlement — consumed by plan Tasks 3.4 (`recheckOrder`) and 4.1 (webhook)
- Size: Small (2 files + tests)

`Change Category: state-change`

This task introduces the single write path that extends a paid entitlement. Sweep the adjacent cases sharing that persisted state — `record_payment_settlement` in `SOURCE/supabase/schema.sql`, the `payment_orders.status` transition, and `SOURCE/lib/supabase/service-role.ts` other writers — for the same class of defect: a write reachable without provider verification, or a second write path to `subscriptions`.

## Implementation Content

**The `SettleResult` discriminated union, enumerated exactly as the backend DD `:799-802` declares it:**

```ts
export type SettleResult =
  | { settled: true; expiresAt: string }
  | { settled: false; reason: "unknown_order" | "not_pending" | "not_paid_yet"
                            | "amount_mismatch" | "provider_unavailable" };
```

**Five refusal reasons, not three.** Each is produced by a distinct branch:
- `unknown_order` — step 1, row absent;
- `not_pending` — step 1 status guard, **and** step 4 `null` return when another trigger won the race;
- `not_paid_yet` — step 2, provider says anything but paid;
- **`amount_mismatch`** — step 3, the provider amount differs from the **stored row**. UI Spec C-10 calls this *"the one outcome where money may have moved"*, and it routes to a human;
- **`provider_unavailable`** — step 2, the adapter could not be reached.

Each maps one-to-one to one of C-10 seven rendered sentences; **shipping fewer reasons than five silently removes a sentence from that table.**

**The four-step order:**
1. read our own order row through `service_role` — **deliberately not owner-scoped**, because the webhook trigger has no session; unknown ⇒ `unknown_order`, not `pending` ⇒ `not_pending`, stop;
2. ask payOS — anything but `paid` ⇒ stop, **no write**; **this is the trust boundary**;
3. compare the provider amount against the **stored row**, never against a constant and never against the payload;
4. call `recordPaymentSettlement(orderCode)`; a `null` return means another trigger won the race ⇒ `not_pending`, **not** an error.

**No parameter of this function carries an amount, a status, or a user.** Fix the stale `"schema.sql §18"` comment at `service-role.ts:73` in the same change.

## Target Files
- [ ] `SOURCE/lib/billing/settleOrder.ts` (new)
- [ ] `SOURCE/lib/supabase/service-role.ts` (`recordPaymentSettlement()` added; the stale `§18` comment at `:73` corrected)
- [ ] `SOURCE/lib/billing/__tests__/settleOrder.test.ts` (new)

## Investigation Targets
- `SOURCE/lib/supabase/service-role.ts` (`:73` the stale `§18` comment; the existing RPC-call convention)
- `SOURCE/lib/billing/payos/` (from plan Task 3.1 — `getPaymentStatus()` and its exactly-two-property return)
- `SOURCE/supabase/schema.sql` (the `record_payment_settlement` block from plan Task 1.1 — the `status='pending'` guard, the null-beneficiary `raise exception`, and the `null` return that signals a lost race)
- `SOURCE/lib/billing/types.ts` (**frozen**)
- `docs/design/subscription-backend-design.md` (§ Design — `settleOrder.ts`)
- `docs/design/subscription-backend-design.md` (§ Integration Point I6)
- `docs/design/subscription-backend-design.md` (§ Sensitivity / P-1)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `RecheckOrderControl` — C-10 — verify default (idle) + loading (busy) + error + partial (terminal status) states and all seven rendered outcomes)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | data_flow | A single `settleOrder(orderCode)` is the only code path that can extend entitlement, invoked from exactly two triggers, and it always re-verifies against `GET /v2/payment-requests/{id}` before writing. **No caller can pass an amount, a status, or a user id into it — only an `orderCode`** | `settleOrder()` signature accepts only an `orderCode`, and every write is preceded by a `getPaymentStatus()` call in the same invocation |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | persistence | The entitlement write is `service_role`-only, `INVOKER`, revoked by name from `public, anon, authenticated`, with `user_id` **derived in SQL from the order row** | `recordPaymentSettlement()` calls the RPC through the `service_role` client and passes no user identifier |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance) | data_flow | "Compare the provider-reported amount against **our stored order row**, not against a constant and not against the payload" | Step 3 compares `getPaymentStatus().amount` against the `amount` read from the stored `payment_orders` row, and against nothing else |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Sensitivity / P-1) | state-lifecycle-negative | **P-1 (normative).** No field of the provider `transactions[]` may be persisted to any column or reach any log. `settleOrder()` reads exactly **two** values from the provider response — the order `status` and its `amount` | `settleOrder()` reads only `status` and `amount` from the adapter return, and persists/logs no other provider field |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `RecheckOrderControl` — C-10) | structure-order | The seven Result → sentence (key) → badge triples, including `amount_mismatch` → "The amount received does not match this order — contact support" (`billing.recheck.amountMismatch`) and `provider_unavailable` → "We could not reach the payment provider — try again shortly" (`billing.recheck.providerUnavailable`). Plus: *"`SettleResult` (backend design) maps to copy one-to-one; **no two reasons share a sentence**"* and *"**`amount_mismatch` deliberately routes to a human.** It is the one outcome where money may have moved and the automatic path has stopped"* | The `SettleResult` union declares exactly the five refusal reasons, so each of C-10 seven sentences has a producing branch |

## Boundary Context (from the plan Connection Map)

**Boundary — webhook route / `recheckOrder()` → payOS status query.**
- Owners: `SOURCE/lib/billing/settleOrder.ts` ↔ payOS `GET /v2/payment-requests/{id}` via `SOURCE/lib/billing/payos/`.
- **Expected Signal**: `getPaymentStatus()` returns a value narrowed to `"pending" | "paid" | "cancelled" | "unknown"`, and its return object carries exactly two properties (`status`, `amount`) — P-1.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets; record the RPC contract (what a `null` return means) verbatim
- [ ] **State-change sweep**: enumerate every write path that can reach `subscriptions` and confirm there is exactly one; enumerate every `payment_orders.status` transition and confirm the `pending → paid` one is guarded in SQL
- [ ] Write failing tests first, asserting **call order** and **write counts**, not merely occurrence
### 2. Green Phase
- [ ] Implement the four steps and `recordPaymentSettlement()`; fix the `§18` comment; run only the added tests
### 3. Refactor Phase
- [ ] Add the union exhaustiveness check and confirm all five reason literals are reachable in test

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npx tsc --noEmit` — Enforces: discriminated-union exhaustiveness on `SettleResult` — Config: `SOURCE/tsconfig.json`
- `npm run check:bundle` — Enforces: the `record_payment_settlement` marker never reaches client bundle output — Config: `SOURCE/package.json:12` (marker added in plan Task 4.1)
- `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests with the payOS adapter and the Supabase service-role client mocked at the I/O edge, asserting **order of calls** and **counts of writes**; the real-Postgres proof is plan Task 6.1 (SVC-1).
- **Success criteria**: no write occurs before verification; the mismatch branch resolves to `amount_mismatch` with **zero writes**; an unreachable adapter resolves to `provider_unavailable`, never `not_paid_yet`; all five reason literals reachable.
- **Failure response**: if any branch writes before `getPaymentStatus()` returns `"paid"`, **stop the phase** — money granted without the provider saying so is the failure this ordering exists to prevent.
- **Verification level**: L2 here; L1 / real-Postgres in plan Task 6.1.

## Proof Obligations
- **Claim**: money is never granted twice and never granted without the provider saying so.
- **Primary failure mode**: a test asserting `settleOrder` *was called* rather than *what went through it* — specifically, asserting settlement succeeded without asserting the amount was compared, or without asserting the replay wrote nothing.
- **Boundary to exercise**: `settleOrder()` public function, with the adapter and the service-role client mocked and **counted**.
- **State assertion**: mismatch case — write count before 0 → action → write count after **0**, result `amount_mismatch`. Race case — RPC returns `null` → result `not_pending`, not an error, no exception.
- **Mock boundary rationale**: the payOS HTTP boundary and the Supabase client are external I/O and are mocked with counters; the branch logic stays real.
- **Residual**: idempotency across *n* ≥ 1 real settlements is proven on real Postgres in plan Task 6.1 (SVC-1), not here.

- **Claim (no-op)**: a repeated settlement of an already-settled record changes nothing and reports so.
- **Primary failure mode**: the second call reports success and extends the period again.
- **Boundary to exercise**: `settleOrder()` with the RPC mocked to return `null` on the second call.
- **State assertion**: first call ⇒ `{ settled: true }`; every call after the first ⇒ `not_pending`, with **zero** additional writes.
- **Mock boundary rationale**: as above.
- **Residual**: the SQL-level guard itself is proven in plan Task 6.1.

- **Claim (unavailable boundary)**: provider unreachable ⇒ a discriminated refusal, zero writes.
- **Primary failure mode**: an unreachable adapter is reported as `not_paid_yet` — the opposite user action, per C-10.
- **Boundary to exercise**: `settleOrder()` with the adapter throwing or timing out.
- **State assertion**: write count 0 before and after.
- **Mock boundary rationale**: adapter mocked to simulate unreachability.
- **Residual**: none for this branch.

## Completion Criteria
- [ ] All added tests pass; refusals are **outcomes, never exceptions**; the orphaned-order exception propagates and is never swallowed
- [ ] All five reason literals reachable in test, with a compile-time exhaustiveness check over the union
- [ ] The stale `"schema.sql §18"` comment at `service-role.ts:73` is corrected
- [ ] Every Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/settleOrder.ts`, `SOURCE/lib/supabase/service-role.ts`; downstream, plan Tasks 3.4, 3.7, 4.1, 6.1.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen; ownership scoping stays **out** of this function (plan Task 3.4 owns it — the webhook trigger has no caller identity).

## Investigation Notes
(Record the state-change sweep, the call-order assertions used, and each Compliance Check result here.)
