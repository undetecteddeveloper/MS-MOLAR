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
- [x] `SOURCE/lib/billing/orderActions.ts` (new — `createOrder()`, `recheckOrder()`)
- [x] `SOURCE/lib/supabase/service-role.ts` (`recordPaymentOrder`)
- [x] `SOURCE/lib/security/rateLimit.ts` (two new `RATE_LIMITS` entries)
- [x] `SOURCE/lib/security/rateLimit.test.ts`, `SOURCE/lib/security/rateLimitStore.test.ts` (`vi.mock("server-only")` added; **no existing assertion edited**)
- [x] `SOURCE/tests/integration/subscription.int.test.ts` (**INT-3 filled**)

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
- [x] Read all Investigation Targets and record INT-3 annotation block verbatim
- [x] **State-change sweep**: enumerate every path that can insert a `payment_orders` row and confirm step (0) precedes all of them; confirm no path recomputes `pending_until` for an existing row
- [x] Write INT-3 and the unit cases first and confirm they fail (adapter count, `pendingUntil` byte-identity, ownership byte-identity)
### 2. Green Phase
- [x] Implement `createOrder()` (step 0 first), `recheckOrder()`, `recordPaymentOrder`, and the two `RATE_LIMITS` entries
- [x] Run `npm run test:integration` against dev and `npm test`; confirm the added cases pass
### 3. Refactor Phase
- [x] Confirm `rateLimit.test.ts` four existing assertion blocks pass **unmodified**
- [x] After exporting `recheckOrder()`'s real return type (the rate-limited refusal shape included), add a compile-time link in `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (e.g. `const _fixtureRefusalContract: Awaited<ReturnType<typeof recheckOrder>> = FIXTURE_RECHECK_OUTCOMES.rateLimited;`) and delete the transcribed `FixtureRateLimitedRefusal` / `FixtureRecheckOutcome` declarations — until that link exists, fixture drift against the wire shape is silent

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
- [x] All added tests pass; **INT-3 green from this commit** under `npm run test:integration` against dev
- [x] `createOrder()` step (0) precedes every other step; zero provider calls and zero writes on the reuse branch
- [x] The ownership check lives in `recheckOrder()`, **not** in `settleOrder()`; no client-side or page-side pre-check was added instead
- [x] `rateLimit.test.ts` four existing assertion blocks pass **unmodified**; `createOrder` and `recheckOrder` are in `DB_COST_ACTIONS` at `limit >= 15` / `windowMs >= 60_000`
- [x] The Binding Decisions Compliance Check evaluates to `Y`; every Reference Contracts Compliance Check evaluates to `Y`
- [x] Test-case resolution: **integration 1/3 (INT-3)**
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/orderActions.ts`, `SOURCE/lib/supabase/service-role.ts`, `SOURCE/lib/security/rateLimit.ts`; downstream, plan Tasks 3.5, 3.6, 4.2, 4.4, 6.2.
- Scope boundary: no existing assertion in `rateLimit.test.ts` or `rateLimitStore.test.ts` may be edited; `SOURCE/lib/billing/types.ts` frozen; `settleOrder()` signature unchanged (no caller parameter).

## Investigation Notes
(Record the state-change sweep, the adapter invocation counts observed, the byte-identical `pendingUntil` values, and each Compliance Check result here.)

### 1. Dev-ref confirmation (recorded before INT-3 wrote anything)

`SOURCE/.env.local` is the only credentials file loaded by anything in this task. Its
`NEXT_PUBLIC_SUPABASE_URL` resolves to `https://hynwleaxtbtjzkvpjsug.supabase.co` —
project ref **`hynwleaxtbtjzkvpjsug`**, the **dev** project. A probe run with the
service-role key from that same file (and no other) reported `payment_orders OK rows=0`
and `subscriptions OK rows=0`, so schema gate B's tables genuinely exist there and the
table was empty before INT-3 ran.

`SOURCE/.env.local.prod-backup` was **not** read, not copied and not pointed at by any
lane. `.mcp.json` was not consulted for a project ref (it points at production,
`pebjdlbgbmizgfpuptjl`), and no statement was applied to production — that is plan Task
5.8.

### 2. Investigation Targets — what each one settled

| Target | What it settled for this task |
|---|---|
| `lib/billing/checkoutOrder.ts` | `toCheckoutOrder(row: PaymentOrderRow): CheckoutOrder` — the single mapper **both** `createOrder()` branches return through. `pendingUntil` is `new Date(row.pending_until).toISOString()`, i.e. the `…Z` form, which is what makes the byte-identity assertion well-defined |
| `lib/billing/pricing.ts` | `PREMIUM_PRICE_VND = 39_000`, `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000`; its docblock already names the three consumers, the third being step (0)'s reuse predicate |
| `lib/billing/payos/index.ts` | `createPaymentRequest(draft: OrderDraft): Promise<PaymentRequestResult>` derives `expiredAt` **itself** from `ORDER_PENDING_WINDOW_MS`, floors it to seconds, and returns that same instant back as `expiresAt`. Consequence for `createOrder()`: `pending_until` must be **the adapter's returned `expiresAt`**, never a second local `Date.now() + WINDOW` — that is how the Binding Decision is satisfied without a second literal and without a second clock read |
| `lib/billing/settleOrder.ts` | `settleOrder(orderCode: number): Promise<SettleResult>`; its header already states the ownership check is deliberately **not** here (the webhook trigger has no caller identity). Signature unchanged by this task |
| `lib/security/rateLimit.ts` / `rateLimit.test.ts` | `RATE_LIMITS` object literal + `guard(action, userId)`. `DB_COST_ACTIONS` at `:93-99` asserts `limit >= 15` (`:139`) and `windowMs >= 60_000` (`:140`); `:127-135` requires every key be classified into exactly one family |
| `lib/supabase/service-role.ts` | `serviceRoleClient()` is private; every export is one narrow named operation, and the write-path ones return `{ error }` rather than throwing. `recordPaymentOrder` follows `recordPaymentSettlement`'s shape |
| `lib/supabase/server.ts` | `createClient()` — cookie-bound, request-scoped, RLS applies. This is `recheckOrder()`'s read client |
| `supabase/schema.sql:1604-1667` | 11 columns; `order_code bigint primary key`; four transfer columns `text not null`; `pending_until timestamptz not null`; `orders_select_own` is `for select to authenticated using (user_id = auth.uid())`; `revoke insert, update, delete … from anon, authenticated` |
| `tests/integration/subscription.int.test.ts` | INT-3's obligations (a)–(h), transcribed verbatim into the case names and comments of the filled block |
| `vitest.integration.config.ts` | `environment: "node"`, include `tests/integration/**`, alias `@`. **No `setupFiles`** — the lane loads no env file, so INT-3 loads `.env.local` itself |
| backend DD (order of operations / ownership scoping / rate-limit entries / third verification point / I6) | quoted in the Compliance Checks below |
| ADR-0013 § Implementation Guidance `:169` | the Binding Decision's source text |

Credentials convention followed (eleven existing `*.int.test.ts` precedents): read
`.env.local` manually into `process.env`, compute `HAS_LIVE_DB`, gate the suite with
`describe.skipIf(!HAS_LIVE_DB)` and a loud `console.warn`.
`app/(layer2)/__tests__/recordSkillMastery.int.test.ts` is the closest precedent (real
Postgres, real signed-in session, `vi.mock("server-only")`, and a
`vi.mock("@/lib/supabase/server")` whose `createClient` returns a **real** authenticated
client rather than a fake) and is the one INT-3 follows.

### 3. State-change sweep (`Change Category: state-change`)

Every path that can insert a `payment_orders` row, repo-wide:

1. **`recordPaymentOrder()`** (added here, `service-role.ts`) — the only application
   insert. It has exactly one call site, `createOrder()` step (3), which is unreachable
   unless step (0) already returned no reusable row. Step (0) is the first statement
   after `guard()`, so it precedes every insert by construction.
2. **Clients** — `revoke insert, update, delete on public.payment_orders from anon,
   authenticated` and no insert policy exists. `supabase/test-rls.ts` PO-c already
   asserts a forged client insert fails with `42501`.
3. **Test fixtures** — `tests/e2e/service/subscriptionServiceFixtures.ts:735` and
   `supabase/test-rls.ts` insert through `service_role`; both are test-lane only and
   scope their rows by a marker. INT-3's own seeded past-window row is the third, and
   teardown deletes it.

Paths that could recompute `pending_until` on an existing row: **none**.
`record_payment_settlement()` (`schema.sql:1749-1755`) updates only `status` and
`settled_at`, and there is no other `update … payment_orders` anywhere in the repo. The
reuse branch therefore cannot restart a countdown unless `createOrder()` itself
recomputes the value it returns — which is precisely what the byte-identity assertion
and mutation M2 are pointed at.

Adjacent residuals folded into this task's cases: the reuse predicate (`pending_until >
now()` vs `created_at > now() - 30 min` — mutation M3), provider-first insert ordering
(row count 0 after a rejected create — its own named unit case), and the window written
by plan Task 1.1's DDL (asserted equal to the adapter's `expiredAt` — the roundtrip
check). No residual outside the Target Files scope was found.

### 4. Binding Decisions — Compliance Check

**Planned approach (axis `contract_schema`, one sentence for the one row):** step (2)
calls `createPaymentRequest()`, which derives `expiredAt` from `ORDER_PENDING_WINDOW_MS`
and returns that same instant back as `expiresAt`; step (3) writes **that returned
value** into `pending_until`, so `orderActions.ts` performs no window arithmetic and
carries no second literal at all.

| Source | Axis | Pre-impl | Rationale |
|---|---|---|---|
| ADR-0013 § Implementation Guidance | contract_schema | **Y** | `orderActions.ts` neither imports `ORDER_PENDING_WINDOW_MS` nor computes a deadline; one value flows adapter → row. Proven by a roundtrip case asserting the inserted `pending_until` is the adapter's returned `expiresAt`, and by a source-text assertion that no second window literal exists in the module |

### 5. Reference Contracts — Compliance Check

**Planned approach, row 1:** step (0) selects the row and returns `toCheckoutOrder(row)`
directly, so the returned `pendingUntil` comes from `row.pending_until` and the function
has no branch that constructs a date.

**Planned approach, row 2:** `recheckOrder()` reads through the request-scoped client
under `orders_select_own` with `.maybeSingle()`; `null` — whatever its cause — falls into
one `if (!row) return { settled: false, reason: "unknown_order" };` placed before the
`settleOrder()` call, so foreign and nonexistent share one branch, one cost and zero
provider calls.

| Source | Pre-impl | Rationale |
|---|---|---|
| backend DD § `createOrder()`'s order of operations | **Y** | The reuse branch returns the mapper's projection of the stored row; asserted byte-identical across two consecutive creates **and** against the value read back from the database row |
| backend DD § `recheckOrder()` — ownership scoping | **Y** | One `if (!row)` branch serves both inputs; deep equality plus zero provider calls plus zero writes asserted separately per branch |

### 6. Observed evidence (from the green run, not from reading code)

**Adapter invocation counts**, read off the counted stub at three points in one
`npm run test:integration` run:

| Moment | `createPaymentRequest` count | Assertion |
|---|---|---|
| after the first `createOrder()` | **1** | INT-3 (d) |
| after the second `createOrder()`, no wait | **1** | INT-3 (d) — the reuse branch spends zero provider round trips |
| after the third, past a rewritten `pending_until` | **2** | INT-3 (g) |

**Byte-identical `pendingUntil`**, values as observed:

| Reading | Value |
|---|---|
| first `createOrder()` return | `2026-08-19T07:44:26.815Z` |
| second `createOrder()` return | `2026-08-19T07:44:26.815Z` |
| `payment_orders.pending_until` read after the first create | `2026-08-19T07:44:26.815+00:00` |
| the same column read after the second create | `2026-08-19T07:44:26.815+00:00` |

The two returns are equal as strings; the two database reads are equal as strings;
and the returned instant equals the stored instant. The `…Z` / `+00:00` split is
visible in the table above and is exactly the CL-01 hazard `toCheckoutOrder()`
exists to normalise — which is why the row value is cross-checked by instant
(`Date.parse`) and never by re-running the mapper.

**Order codes**: first `1787123666815`, second `1787123666815` (same order reused),
third `1787123668343` (a new one, after the window was pushed into the past).
Pending-row count: `0` before, `1` after the first create, `1` after the second.

### 7. Mutation testing (applied to in-memory copies of `orderActions.ts`, restored after each)

| # | Mutation | Result | Killed by |
|---|---|---|---|
| M1 | step (0) moved **after** the insert | **killed**, both lanes | unit *"đơn còn hạn ⇒ trả lại CHÍNH nó, ĐÚNG MỘT lượt chạm biên"*; INT-3 (b), (c), (d), (e), (g) |
| M2 | reuse branch recomputes `pending_until` as `now() + window` | **killed**, both lanes | unit *"`pendingUntil` là mốc ĐÃ LƯU của dòng…"* and *"mã nguồn … không chứa phép tính cửa sổ nào"*; INT-3 (e) |
| M3 | reuse predicate becomes `created_at > now() - 30 min` | **killed**, both lanes | unit *"vị từ tái dùng là `pending_until > <bây giờ>`…"* and the no-second-literal case; INT-3 (g) |
| M4 | ownership check removed from `recheckOrder()` (delegated wholesale to `settleOrder()`) | **killed**, unit lane | *"đơn của NGƯỜI KHÁC ⇒ unknown_order, 0 lượt gọi nhà cung cấp, 0 lượt ghi"*, *"hai lời từ chối GIỐNG NHAU HOÀN TOÀN"*, *"đơn CỦA MÌNH ⇒ … đọc theo phiên TRƯỚC, rồi mới tới service_role"* |
| M5 | foreign-order branch returns a distinguishable value (`not_pending` for a foreign row, `unknown_order` for a nonexistent one) | **killed**, unit lane | *"hai lời từ chối GIỐNG NHAU HOÀN TOÀN — cùng giá trị, cùng dãy lượt chạm biên"* plus both single-branch cases |

M4 and M5 survive the **integration** lane, and that is correct rather than a gap:
INT-3 exercises `createOrder()` only. The real-RLS proof for those two, with two
real sessions, is SVC-2 / plan Task 6.2, exactly as this task's Proof Obligations
record under "Residual".

`orderActions.ts` was byte-identical to its original after the run (verified by
comparison, not by assumption).

### 8. Compliance Checks re-evaluated against the FINAL implementation

| Contract | Final | Evidence |
|---|---|---|
| Binding Decision — ADR-0013 § Implementation Guidance (`contract_schema`) | **Y** | `orderActions.ts` contains no window arithmetic: step (3) writes `payment.expiresAt`, the value the adapter derived from `ORDER_PENDING_WINDOW_MS` and returned. Asserted by the unit case *"`pending_until` ghi xuống là ĐÚNG mốc adapter trả về"* and by the comment-stripped source case that rejects `30 * 60`, `1_800_000` and the identifier `ORDER_PENDING_WINDOW_MS`. Mutation M2 confirms the assertion has teeth |
| Reference Contract 1 — reused row keeps its original `pending_until` | **Y** | Values in §6; two returns byte-identical, two database reads byte-identical, returned instant equal to the stored instant. Mutation M2 killed |
| Reference Contract 2 — the two `unknown_order` refusals are byte-identical | **Y** | One `if (!data)` branch, placed before the `settleOrder()` call. The unit case compares the whole returned values **and** the whole boundary-touch sequences of the two branches, with zero provider calls and zero writes asserted for each. Mutations M4 and M5 killed |

**Boundary roundtrip check** (from the plan's Connection Map): the value the
adapter emits as `expiredAt`/`expiresAt` is the value stored in `pending_until`,
and the reuse branch returns that stored value unchanged — the first half is the
unit roundtrip case, the second half is INT-3 (e).

### 9. Two decisions recorded so they are not read as omissions

1. **`canPurchase` is not re-checked inside `createOrder()`.** The backend DD's
   Data Contracts row lists `canPurchase === true` as a **caller precondition**,
   and `app/(billing)/pricing/page.tsx:29` already derives it from
   `isPaidTierEnabled()`. Adding a server-side gate here would introduce a
   behavioral mode and a failure literal that no document in this task's scope
   specifies, so it was left alone rather than invented. If it is wanted, it
   belongs to whoever owns AC-049/AC-054, not to this task.
2. **`{ error: "unauthenticated" }` rather than `redirect()`.** `requireUser()`
   in `app/(layer4)/actions.ts` is a private helper of that route group and
   redirects; `lib/support/actions.ts` — the only other lib-level Server Action —
   deliberately returns a value instead, because a redirect destroys the state of
   the screen the user is standing on and crosses the action boundary as an
   exception. The backend DD's own failure clause for both actions says refusals
   are outcomes, never exceptions, so the returning form was chosen.

### 10. Lanes, as measured (real exit codes via `spawnSync`, never a redirected run)

| Lane | Before | After |
|---|---|---|
| `npm test` | 1138 pass / 10 skip | **1164 pass / 10 skip**, exit 0 (+26 = the new unit file) |
| `npm run test:integration` | exit 1, "No test suite found" | **8 passed, exit 0** — and green twice in a row, with `payment_orders` back to 0 rows each time |
| `npm run test:fixture` | 23 pass, exit 0 | 23 pass, exit 0 |
| `npm run test:localdb` | exit 1 by design | exit 1 by design (its cases arrive in Phase 6) |
| `npx tsc --noEmit` | 0 | 0 |
| `npm run lint` | clean | clean |

`next build` was not run: it hangs indefinitely under this sandbox rather than
failing. No `--passWithNoTests` was added to any lane.

**Compile-time link proven to bind, not assumed**: adding a required field to
`RecheckOutcome` in `lib/billing/orderActions.ts` made `tsc` report
`tests/e2e/fixture/subscriptionFixtureData.ts(411,3): error TS2322 … Property
'probeField' is missing` — an error *inside the fixture file*. Reverted; `tsc` is
back to 0.

---

## Revision after integration-test-reviewer (`needs_revision`, one required fix)

### 11. The lane's own exit code proved nothing — fixed at the lane, not at an assertion

**The finding, restated as a measurement.** The reviewer ran the lane with
`SUPABASE_SERVICE_ROLE_KEY=""` and got `Test Files 1 skipped (1) / Tests 8 skipped
(8)`, **exit 0**, with no warning text: vitest 4.1.10 suppresses module-scope
`console.output` for a file whose only suite is skipped. So the deliverable of this
task — "`npm run test:integration` goes from exit 1 to exit 0" — was produced
identically by eight real passes and by eight silent skips. A renamed `.env.local`
certified the same green as working code. The comment at `:305` claiming *"The skip
is loud (console.warn) and narrow"* was false in both halves.

**Which of the two permitted mechanisms holds, decided from the files, not assumed.**
An opt-in flag (`test.env` inside `vitest.integration.config.ts`) earns its place
only if **some** invocation of this config must still be allowed to skip. Read:

| File | What it settles |
|---|---|
| `.github/workflows/ci.yml` | The `verify` job runs `npm run lint`, `npx tsc --noEmit`, `npm test`. The `bundle-secrets` job runs `npx next build` + `npm run check:bundle`. **`npm run test:integration` appears nowhere.** |
| `SOURCE/vitest.config.ts:19` | `include: ["lib/**", "components/**", "app/**"]` — `tests/**` is not collected, so even `npm test` cannot reach this file. |
| backend DD § Implementation Approach Phase 4 | "CI has no database, so every DB-touching assertion is an integration test run locally against dev, not a CI gate" — the exclusion is honoured by the lane living outside CI, not by the lane degrading. |

Two independent routes make this config unreachable from CI; the only caller is a
developer at a keyboard. **No invocation needs to be allowed to skip**, so the flag
has no job to do and the simpler option holds: *missing credentials are an operator
error and must fail the lane*. No `test.env`, no `cross-env`, no new dependency.

**What was implemented.** `HAS_LIVE_DB` became `MISSING_CREDENTIALS` (the list of
absent variable names, so the message can name them). The `console.warn` — proven
not to be displayed in the exact state it existed for — was deleted rather than
kept alongside its replacement. When the list is non-empty, one **named case** is
registered and throws; the main suite keeps `describe.skipIf(!HAS_LIVE_DB)` so the
failure reads as one line rather than eight `beforeAll` cascades. The comment at
`:305` was rewritten to state the CI-unreachability, the vitest suppression
behaviour and the new guarantee.

### 12. Proof of the fix — observed, not asserted

| # | Invocation | Reporter output | Exit |
|---|---|---|---|
| 1 | `SUPABASE_SERVICE_ROLE_KEY=""` | `9 tests \| 1 failed \| 8 skipped`; `× làn phải chạy với đủ credential Supabase dev, KHÔNG được lặng lẽ bỏ qua`; message names `SUPABASE_SERVICE_ROLE_KEY` | **1** |
| 2 | `.env.local` renamed away entirely | same named case fails; message names **all three** (`NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY`) | **1** |
| 3 | normal, `--reporter=verbose` | eight `✓` lines, one per obligation (a)–(h) — **passes, not skips**, read off the reporter | **0** |

`.env.local` was restored immediately in the same command that renamed it and is
**byte-identical**: `sha256 2d8ef6ce321f9e1cb8935d578c56dad227475c058c08d1900064624d5dac6413`
before and after. Exit codes read with `spawnSync` on `node_modules/vitest/vitest.mjs`,
never through a redirected run — the finding is about a misread exit status, so the
measurement must not repeat the mistake.

**One trap worth recording**: a runner spawned with `cwd: "e:/…"` (lower-case drive
letter) makes Vite resolve module ids differently from `npm`, and `vi.mock("server-only")`
silently misses — the file then fails to collect for a reason that has nothing to do
with the code. The runner must use `E:\…` exactly as npm does. Two confusing red runs
came from this before it was identified; both were tooling, not the test.

### 13. Secondary item — INT-3 now kills the second-clock mutant on its own

`armProviderStub` built `expiresAt` as `new Date(Date.now() + ORDER_PENDING_WINDOW_MS)`
— **the same computation a second-clock defect performs**. A mutant writing
`pending_until` from a locally recomputed `now + 30 min` instead of from
`payment.expiresAt` therefore left INT-3 fully green; only the unit lane's
`PROVIDER_EXPIRES_AT` literal discharged the Binding Decision.

Replaced with a pinned literal `PROVIDER_EXPIRES_AT = "2099-12-31T23:59:59.000Z"`.
The `.000` is not cosmetic: the real adapter floors to seconds before sending
`expiredAt` (`lib/billing/payos/index.ts:260`) and returns `new Date(sec * 1000).toISOString()`
(`:294`), so it **never** emits millisecond precision — the stub previously spoke a
precision the boundary cannot produce, and now matches it. The `ORDER_PENDING_WINDOW_MS`
import was removed from the test file with it, so the hazard cannot come back by
accident.

Case (e) gained a fourth clause: `Date.parse(rowAfterFirst.pending_until)` equals
`Date.parse(PROVIDER_EXPIRES_AT)`, and `first.pendingUntil` equals the literal
byte-for-byte. Clauses 1–3 only said three values agree — they agree just as well
when all three are a self-computed `now() + 30 min`.

**Mutant re-run** (M2′: `pendingUntil: new Date(Date.now() + ORDER_PENDING_WINDOW_MS).toISOString()`
in `orderActions.ts` step (3), applied to a copy and restored):

```
× (e) `pendingUntil` GIỐNG NHAU TỪNG BYTE giữa hai lượt trả về, và dòng trong CSDL không hề đổi
  → AssertionError: expected 1787126784696 to be 4102444799000 // Object.is equality
Tests  1 failed | 7 passed (8)      exit 1
```

Previously this mutant left INT-3 **8 passed**. `orderActions.ts` restored and verified
byte-identical afterwards (`sha256 23c28c282d1a2b98a168d6c34303530f71a60a1d01e95e1d830e13f0267fd02e`
before and after) — compared, not assumed.

The `pendingUntil` values recorded in §6 above are from the pre-revision run and were
clock-derived; the current stub pins them to the literal, which is the point of the change.

### 14. Lanes re-measured after the revision

| Lane | Result |
|---|---|
| `npm test` | **1164 passed / 10 skipped**, exit 0 (unchanged) |
| `npm run test:integration` | **8 passed**, exit 0 — and **exit 1 with a named failing case** when a credential is absent |
| `npm run test:fixture` | 23 passed, exit 0 |
| `npx tsc --noEmit` | 0 |
| `npm run lint` | clean (`--max-warnings 0`) |
| `npm run test:localdb` | untouched; still exit 1 by design, no `--passWithNoTests` added |

`payment_orders` on dev (`hynwleaxtbtjzkvpjsug`) reads **0 rows total** after every run,
including the mutant run. `next build` not run (hangs under the sandbox). Production
(`pebjdlbgbmizgfpuptjl`) untouched; `.env.local.prod-backup` never read.

**Out of scope, deliberately untouched**: the unit lane's faked `@/lib/supabase/server`
(real-RLS `orders_select_own` proof stays a Residual of plan Task 6.2 / SVC-2);
`subscriptionFixtureData.ts:203`'s hand-copied `39_000` and the `FIXTURE_*_LIMIT`
constants (known, documented in place).

### 15. Compliance Checks re-evaluated against the post-revision implementation

`lib/billing/orderActions.ts` is byte-identical to the version §8 evaluated (hash in
§13), so every rationale there still stands; the revision only strengthened the
evidence.

| Contract | Post-revision | What changed in the evidence |
|---|---|---|
| Binding Decision — ADR-0013 § Implementation Guidance (`contract_schema`) | **Y** | Unchanged in code. Now proven by the **integration** lane too: the pinned `PROVIDER_EXPIRES_AT` makes a second window computation in `createOrder()` fail case (e), where before it passed all eight (§13) |
| Reference Contract 1 — reused row keeps its original `pending_until` | **Y** | Case (e) clauses 1–3 unchanged; clause 4 added, pinning the stored value to a literal the code under test did not build |
| Reference Contract 2 — the two `unknown_order` refusals are byte-identical | **Y** | Untouched by this revision; unit lane cases and mutations M4/M5 unchanged |

**Boundary roundtrip check** (plan Connection Map): still discharged, and now by INT-3
alone as well — the value the adapter emits as `expiresAt` is asserted equal, as an
instant and as a byte string, to what `pending_until` holds and to what the reuse
branch returns.

---

## Revision after integration-test-reviewer, cycle 2 (one required fix, one comment narrowing)

### 16. The guard was itself a test case, so the test-name filter swallowed it

**The residual, restated as a measurement.** The previous cycle's guard was a
registered `it(...)`. A registered case is subject to vitest's test-name filter,
which is a mechanism *outside* the file — the same class of defect that swallowed
the original `console.warn`. Measured before the fix, with `SUPABASE_SERVICE_ROLE_KEY`
emptied in the spawned environment:

| Invocation | Reporter | Exit |
|---|---|---|
| `--config vitest.integration.config.ts -t "..."`, credential absent | `Test Files 1 skipped (1)` / `Tests 9 skipped (9)` | **0** |
| the same filter, credentials present | `Tests 1 passed \| 7 skipped` | **0** |

Both green; only the pass count distinguishes them, and nothing automated reads
a pass count. `npm run test:integration -- -t "..."` is ordinary single-case
iteration, and a stray `.only` defeats the guard by the same mechanism.

**What was implemented.** The guard moved from a registered case to a
**module-scope throw**, i.e. to COLLECTION time — the one point no test-name
filter and no `.only` can reach. `HAS_LIVE_DB` and `describe.skipIf(!HAS_LIVE_DB)`
went with it: once the module throws on an absent credential, the suite below is
reached only when credentials are present, so the boolean and the `skipIf` were
dead. The thrown message is unchanged and still names every missing variable.

**Why the named case was NOT kept beside the throw**, contrary to the reviewer's
suggested shape — decided from a measurement, not from preference. Both would
fire on the identical condition (`MISSING_CREDENTIALS.length > 0`), and a
collection failure **discards the file's registered tasks**: with the named case
registered immediately before the throw, an unfiltered credential-absent run
reported `tests/integration/subscription.int.test.ts (0 test)` / `Tests no tests`.
The case is therefore unreachable in exactly the state it exists for — dead code
that a comment would have to describe falsely, which is the failure this whole
revision is closing. The readability argument for keeping it does not survive
the measurement either: the collection failure prints
`FAIL tests/integration/subscription.int.test.ts` followed by
`Error: Làn integration thiếu SUPABASE_SERVICE_ROLE_KEY. ...` and a source frame
at the throw — one readable line naming the variable.

### 17. Proof of the fix (real exit codes via `spawnSync` on `node_modules/vitest/vitest.mjs`, cwd `E:\...`, never a redirected run)

| # | Invocation | Reporter output | Exit |
|---|---|---|---|
| 1 | `-t "lượt tạo THỨ BA"`, `SUPABASE_SERVICE_ROLE_KEY` emptied | `Test Files 1 failed (1)` / `Tests no tests`; `Error: Làn integration thiếu SUPABASE_SERVICE_ROLE_KEY. …` | **1** |
| 2 | the same filter, credentials present | `Test Files 1 passed (1)` / `Tests 1 passed \| 7 skipped (8)` | **0** |
| 3 | unfiltered, `--reporter=verbose`, credentials present | eight `✓` lines, (a)–(h), read as **passes**, not skips | **0** |
| 4 | `--silent -t "lượt tạo THỨ BA"`, credential emptied (extra) | same collection failure | **1** |

Run 1 is the acceptance condition of this cycle and it now holds; run 2 shows the
green path is untouched. The credential was emptied **in the spawned process
environment**, never in the file — `loadEnvLocal()` skips a key that is already
defined, so an empty string reproduces an absent credential exactly.
`SOURCE/.env.local` was consequently never opened for writing and is byte-identical:
`sha256 2d8ef6ce321f9e1cb8935d578c56dad227475c058c08d1900064624d5dac6413`.
`SOURCE/lib/billing/orderActions.ts` untouched:
`sha256 23c28c282d1a2b98a168d6c34303530f71a60a1d01e95e1d830e13f0267fd02e`.

### 18. The `:316-318` overstatement, narrowed

The comment claimed `Test Files 1 skipped / Tests 8 skipped / exit 0` was
"byte-indistinguishable from eight real passes". The reporter summary did print
the word "skipped"; what was actually indistinguishable was (i) the **exit
status**, the only thing an automated consumer reads, and (ii) the **absence of
any warning**, because vitest suppresses module-scope `console.warn` for a file
whose only suite is skipped. The clause now says exactly those two things. The
rest of that block — the two independent routes making the config unreachable
from CI, verified against `.github/workflows/ci.yml` and `vitest.config.ts:19` —
was re-read and left as written.

### 19. Lanes re-measured after cycle 2

| Lane | Result |
|---|---|
| `npm test` | **1164 passed / 10 skipped**, exit 0 (baseline held) |
| `npm run test:integration` | **8 passed**, exit 0; **exit 1** when a credential is absent, **including under `-t` and `--silent`** |
| `npm run test:fixture` | 23 passed, exit 0 |
| `npx tsc --noEmit` | 0 |
| `npm run lint` | clean (`--max-warnings 0`) |
| `npm run test:localdb` | untouched; still exit 1 by design, no `--passWithNoTests` added |

`payment_orders` on dev (`hynwleaxtbtjzkvpjsug`, read from `SOURCE/.env.local`)
is back to **0 rows total** after the runs. Production (`pebjdlbgbmizgfpuptjl`)
untouched; `.env.local.prod-backup` never read. `next build` not run (hangs under
the sandbox).

**One formatting note, measured rather than assumed**: `npx prettier --check` on
this file reports two deviations — the pre-existing `loadEnvLocal()` method chain
(copied verbatim from the precedent, which `prettier --check` also reports as
deviating) and the multi-line `describe(` call left behind by removing `.skipIf`.
Prettier is not a gate in this repo (no `format` script; `lint` is `eslint
--max-warnings 0`, which passes). Re-indenting ~160 already-reviewed lines to
satisfy a non-gate would have buried this cycle's three-line change, so the
multi-line call form was kept.

### 20. Compliance Checks re-evaluated against the post-cycle-2 implementation

`lib/billing/orderActions.ts` is byte-identical to the version §8 and §15
evaluated (hash in §17), and no assertion in INT-3 changed — only the lane's
credential guard and two comment blocks. Every Binding Decisions and Reference
Contracts Compliance Check therefore still evaluates to **Y**, on the same
evidence, now carried by a lane whose green can no longer be produced by an
absent credential under any invocation.
