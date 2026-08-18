# Task: `createOrder()` and `recheckOrder()` + the two rate-limit entries + INT-3

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.4**
Layer: **backend** (`SOURCE/lib/billing/**`, `SOURCE/lib/security/**`, `SOURCE/tests/integration/**`)

Metadata:
- Dependencies: backend-task-15 (adapter), backend-task-16 (`settleOrder`), backend-task-17 (`toCheckoutOrder`), backend-task-01 (`test:integration` config), backend-task-11 (gate B on dev)
- Provides: the two server actions the frontend calls; **INT-3 filled in this same commit**
- Size: Medium (4–5 files)

`Change Category: state-change`

`createOrder()` inserts `payment_orders` rows and decides when **not** to. Sweep the adjacent cases sharing that persisted state — the reuse predicate, the provider-first insert ordering, and the `pending_until` window written by plan Task 1.1 DDL — for the same class of defect: a second row minted for one live pending order, or a restarted countdown.

## Implementation Content

### `createOrder()`
- **Step (0) first** — an owner-scoped select for `user_id = <session user>` **and** `status = 'pending'` **and** `pending_until > now()`. If found: return `toCheckoutOrder(row)` and **stop**, with **zero** provider calls and **zero** writes, returning **the row original `pending_until`** (never `now() + 30 min`).
- Then (1) derive a fresh `orderCode` and the amount from `PREMIUM_PRICE_VND`; (2) `createPaymentRequest()` with `expiredAt` from `ORDER_PENDING_WINDOW_MS`; (3) insert **one** row through `service-role.ts` (`recordPaymentOrder`) — **provider-first**, so the four transfer columns can be `not null` and a blank transfer block is unreachable by a reload.
- `user_id` comes from the **authenticated session inside the action**, never from a client parameter.
- The predicate is **`pending_until > now()`**, *not* `created_at > now() - 30 min`, so in-flight rows keep the window they were sold under.

### `recheckOrder(orderCode)`
- `requireUser()` → `guard("recheckOrder", userId)` → read the order row through the **request-scoped** client under `orders_select_own`.
- A foreign row is **invisible**: `.maybeSingle()` yields `null`, identical to a nonexistent code, and both take the **one** branch returning `unknown_order` **before any provider call**.
- `settleOrder(orderCode)` is invoked **only** when that read returns a row.
- **This check must not be moved into `settleOrder()`** — its other trigger has no caller identity, and moving it would need a nullable "caller" parameter, i.e. a mode flag on the money path. **No client-side or page-side pre-check compensates.**

### `RATE_LIMITS`
- Add `createOrder` and `recheckOrder` to `DB_COST_ACTIONS` at `rateLimit.test.ts:93-99` (without which the classification case at `:127-135` goes red — **intended behaviour**), configured at **`limit >= 15`** over **`windowMs >= 60_000`**, because the DB-cost family asserts both.
- Add `vi.mock("server-only", () => ({}))` to `rateLimit.test.ts` **and** `rateLimitStore.test.ts`.
- **No existing assertion in either file may be edited.**

### INT-3 — filled in **this** commit
This is the commit that implements `createOrder()` reuse branch, which is the behaviour INT-3 asserts. In `SOURCE/tests/integration/subscription.int.test.ts`:
- after the first create: `count(*) pending = 1`, `amount = 39000` **literal**, unique `order_code`, status `pending`;
- after a second immediate create: count **still exactly 1**, equal `orderCode`s, `createPaymentRequest` invoked **exactly once** across both, `pendingUntil` **byte-identical**, `qrPayload` and amount identical;
- then write a row with a **past** `pending_until` and assert a **third** create mints a new `orderCode` **and** brings the cumulative adapter count to **exactly 2**;
- teardown deletes every fixture row so the case passes twice in a row and in isolation.
Runs under `npm run test:integration` (plan Task 0.1 config) against **dev**.

## Target Files
- [ ] `SOURCE/lib/billing/orderActions.ts` (new — `createOrder()`, `recheckOrder()`)
- [ ] `SOURCE/lib/supabase/service-role.ts` (`recordPaymentOrder`)
- [ ] `SOURCE/lib/security/rateLimit.ts` (two new `RATE_LIMITS` entries)
- [ ] `SOURCE/lib/security/rateLimit.test.ts`, `SOURCE/lib/security/rateLimitStore.test.ts` (`vi.mock("server-only")` added; **no existing assertion edited**)
- [ ] `SOURCE/tests/integration/subscription.int.test.ts` (**INT-3 filled**)

## Investigation Targets
- `SOURCE/lib/billing/checkoutOrder.ts` (from plan Task 3.3 — the one mapper both branches must return through)
- `SOURCE/lib/billing/pricing.ts` (`PREMIUM_PRICE_VND`, `ORDER_PENDING_WINDOW_MS`)
- `SOURCE/lib/billing/payos/` (from plan Task 3.1 — `createPaymentRequest`; the counted stub target for INT-3)
- `SOURCE/lib/billing/settleOrder.ts` (from plan Task 3.2 — invoked only after the owner-scoped read returns a row)
- `SOURCE/lib/security/rateLimit.ts` and `SOURCE/lib/security/rateLimit.test.ts` (`:93-99` `DB_COST_ACTIONS`; `:127-135` the classification case that goes red without the two entries; `:107-110`, `:118-121` the family invariants)
- `SOURCE/lib/supabase/service-role.ts` (the write client; `recordPaymentSettlement` added in plan Task 3.2 — follow its shape)
- `SOURCE/lib/supabase/server.ts` (the **request-scoped** client `recheckOrder` must use, so `orders_select_own` applies)
- `SOURCE/supabase/schema.sql` (the `payment_orders` block: `orders_select_own`, `payment_orders_user_created_idx`, `pending_until`)
- `SOURCE/tests/integration/subscription.int.test.ts` (**INT-3** `Proof obligation:` / `Primary failure mode:` annotation block — the source of this task obligations)
- `SOURCE/vitest.integration.config.ts` (plan Task 0.1 — the config INT-3 runs under)
- `docs/design/subscription-backend-design.md` (§ `createOrder()`s order of operations)
- `docs/design/subscription-backend-design.md` (§ `recheckOrder()` — ownership scoping)
- `docs/design/subscription-backend-design.md` (§ Rate-limit entries)
- `docs/design/subscription-backend-design.md` (§ Third verification point)
- `docs/design/subscription-backend-design.md` (§ Integration Point I6)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance) | contract_schema | "Keep the pending-order window and the provider `expiredAt` **the same number**, set from one shared constant" | `createOrder()` derives both the payOS `expiredAt` and `payment_orders.pending_until` from `ORDER_PENDING_WINDOW_MS`, with no second literal |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ `createOrder()`s order of operations) | state-lifecycle-negative | The reused row is returned with **its original `pending_until`**, read from the row, not recomputed as `now() + 30 min` … *"the countdown is never restarted"* | The reuse branch returns the row stored `pending_until` unchanged, asserted byte-identical across two consecutive creates |
| `docs/design/subscription-backend-design.md` (§ `recheckOrder()` — ownership scoping) | state-lifecycle-negative | `recheckOrder(orderCode)` resolves `{ settled: false, reason: "unknown_order" }` for an `orderCode` that does not exist **and** for one that exists but whose `user_id` is not the caller. The two are **byte-identical**: the same value, from the same branch, with the same side effects (none), the same number of provider calls (zero) and the same number of writes (zero) | Both inputs produce a deeply equal `unknown_order` result from one branch, with zero provider calls and zero writes in each |

## Boundary Context (from the plan Connection Map)

**Boundary — `createOrder()` → payOS create request.**
- Owners: `SOURCE/lib/billing/orderActions.ts` ↔ payOS `POST /v2/payment-requests` via `SOURCE/lib/billing/payos/`.
- **Serialized Format**: the request carries `expiredAt` derived from the **same** `ORDER_PENDING_WINDOW_MS` constant that sets `payment_orders.pending_until`.
- **Consumer Parse Rule**: response fields translated at the boundary — `qrCode` → `qrPayload`, `description` → `memo`.
- **Expected Signal**: provider-first ordering — on adapter failure **no `payment_orders` row exists** (row count 0 after a rejected create); on success the row carries the four returned values verbatim.
- **Roundtrip check**: the value the adapter emits as `expiredAt` and the value stored in `pending_until` describe the same instant, and the reuse branch returns that stored value unchanged.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record INT-3 annotation block verbatim
- [ ] **State-change sweep**: enumerate every path that can insert a `payment_orders` row and confirm step (0) precedes all of them; confirm no path recomputes `pending_until` for an existing row
- [ ] Write INT-3 and the unit cases first and confirm they fail (adapter count, `pendingUntil` byte-identity, ownership byte-identity)
### 2. Green Phase
- [ ] Implement `createOrder()` (step 0 first), `recheckOrder()`, `recordPaymentOrder`, and the two `RATE_LIMITS` entries
- [ ] Run `npm run test:integration` against dev and `npm test`; confirm the added cases pass
### 3. Refactor Phase
- [ ] Confirm `rateLimit.test.ts` four existing assertion blocks pass **unmodified**

## Quality Assurance Mechanisms
- `rateLimit.test.ts` three-family partition — Enforces: every `RATE_LIMITS` key is classified in exactly one family and its family invariants hold — Config: `SOURCE/lib/security/rateLimit.test.ts:93-99, :107-110, :118-121, :127-135`
- Real-Postgres integration tests (precedent `recordSkillMastery.int.test.ts`) — Enforces: the `status='pending'` guard, RLS visibility — Config: `SOURCE/vitest.integration.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: `npm run test:integration` against the **dev** database (INT-3), plus unit tests with the payOS adapter mocked and **counted**.
- **Success criteria**: INT-3 green **from this commit**; a repeated create returns the identical `orderCode` and the identical `pendingUntil` string; the adapter is invoked exactly once across two creates and exactly twice cumulatively after the expired-row create; foreign and nonexistent `orderCode`s are byte-identical refusals with zero provider calls.
- **Failure response**: if the reuse branch recomputes `pending_until`, **stop and fix the predicate** — a restarted countdown is a user-visible deadline change, not a rounding detail.
- **Verification level**: L2 (integration + unit). L1 for the full recovery path arrives with plan Task 3.6 / 3.8.

## Proof Obligations
- **Claim (AC-027, same-value)**: a repeated create returns the identical identifier and the identical deadline string.
- **Primary failure mode**: two of AC-027 four sub-claims are **invisible to a value-only assertion** — the **adapter invocation count** and the **byte-identity of `pendingUntil`**. A test that checks only the returned `orderCode` passes while a second provider order is silently created.
- **Boundary to exercise**: the real dev Postgres through the server action, with only the payOS adapter stubbed and counted.
- **State assertion**: before — zero `pending` rows for the fixture user; after first create — exactly 1 with `amount = 39000`; after second create — **still exactly 1**, same `orderCode`, `pendingUntil` byte-identical; after seeding a past-`pending_until` row and creating again — a new `orderCode` and cumulative adapter count exactly 2.
- **Mock boundary rationale**: only the payOS HTTP adapter is stubbed (it is an external paid service); the database, RLS and the mapper are real, because the claim is about rows.
- **Residual**: concurrency is not proven here — plan Task 6.1 concurrent case does that.

- **Claim (ownership refusal)**: a foreign order and a nonexistent order are indistinguishable in **value and in cost**.
- **Primary failure mode**: an enumeration oracle — distinguishing "not yours" from "not found" confirms another user order exists; or a latency difference doing the same through a provider call on one branch only.
- **Boundary to exercise**: `recheckOrder()` through the **request-scoped** client under `orders_select_own` (RLS real).
- **State assertion**: zero writes and zero provider calls on **both** branches.
- **Mock boundary rationale**: adapter counted; the Supabase client stays real, since RLS is the mechanism under test (the definitive proof is SVC-2 / plan Task 6.2, with two real sessions).
- **Residual**: two-real-session proof is plan Task 6.2; this task proves the branch and the counts.

## Completion Criteria
- [ ] All added tests pass; **INT-3 green from this commit** under `npm run test:integration` against dev
- [ ] `createOrder()` step (0) precedes every other step; zero provider calls and zero writes on the reuse branch
- [ ] The ownership check lives in `recheckOrder()`, **not** in `settleOrder()`; no client-side or page-side pre-check was added instead
- [ ] `rateLimit.test.ts` four existing assertion blocks pass **unmodified**; `createOrder` and `recheckOrder` are in `DB_COST_ACTIONS` at `limit >= 15` / `windowMs >= 60_000`
- [ ] The Binding Decisions Compliance Check evaluates to `Y`; every Reference Contracts Compliance Check evaluates to `Y`
- [ ] Test-case resolution: **integration 1/3 (INT-3)**
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/orderActions.ts`, `SOURCE/lib/supabase/service-role.ts`, `SOURCE/lib/security/rateLimit.ts`; downstream, plan Tasks 3.5, 3.6, 4.2, 4.4, 6.2.
- Scope boundary: no existing assertion in `rateLimit.test.ts` or `rateLimitStore.test.ts` may be edited; `SOURCE/lib/billing/types.ts` frozen; `settleOrder()` signature unchanged (no caller parameter).

## Investigation Notes
(Record the state-change sweep, the adapter invocation counts observed, the byte-identical `pendingUntil` values, and each Compliance Check result here.)
