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
- [x] `SOURCE/lib/billing/settleOrder.ts` (new)
- [x] `SOURCE/lib/supabase/service-role.ts` (`recordPaymentSettlement()` added; the stale `§18` comment at `:73` corrected)
- [x] `SOURCE/lib/billing/__tests__/settleOrder.test.ts` (new)

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
- [x] Read all Investigation Targets; record the RPC contract (what a `null` return means) verbatim
- [x] **State-change sweep**: enumerate every write path that can reach `subscriptions` and confirm there is exactly one; enumerate every `payment_orders.status` transition and confirm the `pending → paid` one is guarded in SQL
- [x] Write failing tests first, asserting **call order** and **write counts**, not merely occurrence
### 2. Green Phase
- [x] Implement the four steps and `recordPaymentSettlement()`; fix the `§18` comment; run only the added tests
### 3. Refactor Phase
- [x] Add the union exhaustiveness check and confirm all five reason literals are reachable in test
- [x] After exporting the real `SettleResult`, add a compile-time link in `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (e.g. `const _fixtureSettleContract: SettleResult = FIXTURE_RECHECK_OUTCOMES.stillPending;`, covering both union arms) and delete the transcribed `FixtureSettleResult` declaration — until that link exists, fixture drift against this union is silent

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
- [x] All added tests pass; refusals are **outcomes, never exceptions**; the orphaned-order exception propagates and is never swallowed
- [x] All five reason literals reachable in test, with a compile-time exhaustiveness check over the union
- [x] The stale `"schema.sql §18"` comment at `service-role.ts:73` is corrected
- [x] Every Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Every Reference Contracts Compliance Check evaluates to `Y`
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/settleOrder.ts`, `SOURCE/lib/supabase/service-role.ts`; downstream, plan Tasks 3.4, 3.7, 4.1, 6.1.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen; ownership scoping stays **out** of this function (plan Task 3.4 owns it — the webhook trigger has no caller identity).

## Investigation Notes

### 1. Investigation Targets — what each one pinned

- **`SOURCE/lib/supabase/service-role.ts`** — `serviceRoleClient()` is **private and never exported** (file header rule 1: *"Ra ngoài chỉ có những thao tác hẹp, đã đặt tên rõ ràng"*). Consequence for this task: step 1's `service_role` read **cannot** be done inside `settleOrder.ts`; it has to be a second narrow operation in this file. RPC convention: `await serviceRoleClient().rpc(<sql name>, { p_… })`, errors mapped to `{ code, message }`; reads use `.from().select()…` and `throw` on error (`listReportedExams`). The stale label at `:73` read `schema.sql §18`.
- **`SOURCE/lib/billing/payos/index.ts`** (Task 3.1) — `getPaymentStatus(orderCode): Promise<{ status: PaymentStatus; amount: number }>`, **exactly two properties**. `PaymentStatus = "pending" | "paid" | "cancelled" | "unknown"`; `unknown` is the fail-closed answer for an unrecognised provider literal, and no path turns it into `paid`. A missing `amount` in the response yields `0` (fail-closed). **Every** failure path throws `PayosCallError` (`:credentials`, `:transport`, `:http`, `:parse`, `:envelope`, `:shape`) — the class carries only `site`, never a provider field.
- **`SOURCE/supabase/schema.sql`** (`record_payment_settlement`, `:1734-1791`) — signature `(p_order_code bigint, p_period_days integer default 30) returns timestamptz`. **The `null` contract, verbatim**: `if not found then return null; -- phát lại hoặc đơn lạ: no-op, không phải lỗi`. The `pending` gate is inside the UPDATE itself (`where order_code = … and status = 'pending'`), not a separate check. Null-beneficiary branch: `raise exception 'settlement for order % has no beneficiary' using errcode = 'check_violation'`. Extension is `greatest(subscriptions.expires_at, now()) + make_interval(days => p_period_days)` — extend, never overwrite. Grants: `revoke all … from public, anon, authenticated`, `grant execute … to service_role`.
- **`payment_orders`** (`:1610-1648`) — `order_code bigint primary key`, `user_id uuid … on delete set null` (orphan case is reachable by design), `amount integer not null check (amount > 0)`, `status text … check (status in ('pending','paid','expired','cancelled'))`.
- **`SOURCE/lib/billing/types.ts`** — read, **not modified**. `SettleResult` deliberately lives in the new `settleOrder.ts`, so the frozen contract stays frozen.
- **backend DD § `settleOrder.ts`** (`:815-833`), **§ Integration Point I6** (`:1072`, `In: orderCode. Out: { expiresAt } | { error }. On error: propagate, never swallow`), **§ Sensitivity / P-1** (`:697`, `:704`).
- **UI Spec C-10** — seven Result → sentence → badge triples; `amount_mismatch` and `provider_unavailable` each own a sentence; the State × Display matrix states *"The action's failure reasons are **outcomes**, not exceptions … A thrown exception is left to the route's `error.tsx`"* — which is what licenses the two propagating exception paths below.
- **ADR-0014 § Decision / § Implementation Guidance** — Decisions 1–4 and the amount-comparison clause, both quoted in the Binding Decisions table.

### 2. State-change sweep (`Change Category: state-change`)

**Every write path that can reach `subscriptions`** — enumerated across the repository, not just the changed files:

| Path | Verdict |
|---|---|
| `record_payment_settlement()` SQL function | The **only** one. `insert … on conflict (user_id) do update` is the sole `subscriptions` write statement in `schema.sql`. |
| Client-side write | Impossible: `revoke insert, update, delete on public.subscriptions from anon, authenticated`, and the only policy is `subscriptions_select_own` (select). |
| Any other `service-role.ts` operation | None touches `subscriptions`. Verified by grep over the file: the tables written are `exams`, `exam_moderation_log`, `support_tickets`, `support_ticket_notes`, plus three RPCs (`record_exam_result`, `record_skill_mastery`, `record_payment_settlement`). |
| A second TS write path added by this task | None. `settleOrder()` touches PostgREST for **one** table (`payment_orders`, read-only) and reaches `subscriptions` only through the RPC. **Test-enforced**: `expect(fromTables).toEqual(["payment_orders"])`. |

**Every `payment_orders.status` transition**:

| Transition | Where | Guarded? |
|---|---|---|
| `∅ → 'pending'` | the column default at insert (`createOrder()`, plan Task 3.4 — not yet written) | n/a (creation) |
| `'pending' → 'paid'` | **only** inside `record_payment_settlement`, as `update … where status = 'pending'` | **Yes, in SQL**, in the same statement that claims the row. Two concurrent triggers ⇒ the loser matches 0 rows ⇒ `null` ⇒ `not_pending`. |
| `'pending' → 'expired' / 'cancelled'` | no writer exists in the repository today | Not this task's; recorded so a future writer is a deliberate addition, not a discovery. |
| `→ 'refunded'` | does not exist, deliberately (schema comment: refunds are a bank operation plus a hand-written SQL statement, D10) | n/a |

**Same class of defect, checked for**: *a write reachable without provider verification* — none; the RPC is called from exactly one place and step 2 precedes it unconditionally (mutant M1 below proves the ordering is asserted). *A second write path to `subscriptions`* — none, per the table above.

**Residual outside this task's scope, recorded for review**: `payment_orders` rows can only ever leave `'pending'` via settlement today; nothing marks a lapsed order `'expired'`. That is not a defect of this change (S-05 derives "expired" for display from `pending_until`), but it means the `'expired'` literal in the CHECK is currently unreachable from code. Flagged for plan Task 3.4/3.6, not fixed here.

### 3. Binding Decisions — Compliance Check results

**Planned approach, one sentence per Axis (recorded before the TDD cycle):**
- *data_flow*: `settleOrder(orderCode: number)` takes the order code and nothing else, runs read → `getPaymentStatus()` → amount comparison against the row read in step 1 → RPC, in that fixed order, with the RPC unreachable unless `getPaymentStatus()` returned `status === "paid"` in the same invocation.
- *persistence*: the write is a single `serviceRoleClient().rpc("record_payment_settlement", { p_order_code })` in `service-role.ts`, carrying no identifier of any kind beyond the order code.

| Source | Axis | Evaluation | Evidence |
|---|---|---|---|
| ADR-0014 § Decision | data_flow | **Y** | `settleOrder.length === 1` asserted; the signature is `(orderCode: number)`. Every settled path logs `["read:payment_orders", "payos:getPaymentStatus", "rpc:record_payment_settlement"]` in that order — asserted as a whole array, not by occurrence. Mutant **M1** (RPC hoisted above step 2) is killed by 13 cases. |
| ADR-0014 § Decision | persistence | **Y** | `expect(rpcMock).toHaveBeenCalledWith("record_payment_settlement", { p_order_code: ORDER_CODE })` — a whole-object match — plus `Object.keys(rpcMock.mock.calls[0][1])` equals `["p_order_code"]`. Mutant **M11** (adds `p_user_id`) killed by 2 cases. The read likewise passes no identity: mutant **M12** (`.eq("user_id", …)`) killed. |
| ADR-0014 § Implementation Guidance | data_flow | **Y** | Step 3 is `provider.amount !== order.amount`, where `order` is the row from step 1. `PREMIUM_PRICE_VND` is **not imported** into `settleOrder.ts` at all. Mutant **M4** (compare against `39000`) killed by the legacy-price case; mutant **M5** (compare the provider value against itself) killed by 4 cases. |

Re-evaluated at the Exit Gate against the **final** implementation, not only the plan: all three still **Y**, on the evidence above.

### 4. Reference Contracts — Compliance Check results

| Source | Evaluation | Evidence |
|---|---|---|
| backend DD § Sensitivity / P-1 (state-lifecycle-negative) | **Y** | The adapter return is consumed as exactly `provider.status` and `provider.amount`; nothing else is read, stored or logged, and `settleOrder.ts` emits **no log line at all**. Asserted at runtime, not by inspection: the test hands `getPaymentStatus` an object whose `status`, `amount` **and a forbidden `transactions`** are recording getters, and asserts the distinct read-key set is exactly `["amount", "status"]`. A spread, a whole-object log or a copy of the response would add `transactions` to that set. Mutant **M13** (`select("*")` on the order read, the storage half of the same surface) killed. |
| UI Spec C-10 (structure-order) | **Y** | `SettleResult` declares exactly the five refusal literals. Two linked assertions: a hand-typed `ALL_REFUSAL_REASONS` under `satisfies Record<RefusalReason, true>` — a sixth literal makes a key missing and a removed literal makes a key excess, both **tsc errors**; and one runtime case that drives all five distinct branches and asserts the sorted produced set equals the five literals written out longhand. So each of C-10's seven sentences has a producing branch (the seventh, rate-limited, is plan Task 3.4's, by design). |

### 5. Call-order assertions used

Ordering is observed through one shared `callLog: string[]`, appended by each mocked boundary at the moment it delivers a value (`read:payment_orders`, `payos:getPaymentStatus`, `rpc:record_payment_settlement`), and asserted with `toEqual` on the **whole array**. Write counts come from `rpcMock.mock.calls.filter(c => c[0] === "record_payment_settlement").length`, not from `toHaveBeenCalled()`.

| Branch | Asserted `callLog` | Settlement writes |
|---|---|---|
| settled | `[read, payos, rpc]` | 1 |
| `unknown_order` | `[read]` | 0 |
| `not_pending` (step 1) | `[read]` | 0 |
| `not_paid_yet` | `[read, payos]` | 0 |
| **`amount_mismatch`** | `[read, payos]` | **0 asserted before the action and 0 after** |
| `provider_unavailable` | `[read, payos]` | 0 |
| replay (2 calls) | second call stops at step 1 | **1 total**, and `getPaymentStatus` called exactly once |

### 6. What each case rejects (mutation-tested, 14 mutants, **14 killed, 0 survivors**)

Each mutant was applied to an in-memory copy of the shipped source, the file written, the task's test file run, then the original restored byte-for-byte; the harness restores in a `finally` block and `git status` confirms no mutant remains on disk.

| Case | Rejects |
|---|---|
| *đọc → hỏi → ghi, ĐÚNG thứ tự đó* | any implementation whose RPC call is not the **last** of the three boundary touches (**M1**, 13 red); any that writes more than once. |
| *đơn không tồn tại ⇒ unknown_order* | an implementation that asks the provider before consulting our row; one that answers `not_pending` for an absent row (**M10**). |
| *đơn đã 'paid' / 'expired' / 'cancelled' ⇒ not_pending* | an implementation that guards only on absence and lets a non-pending row reach the provider or the write (**M6**). |
| *adapter không gọi được ⇒ provider_unavailable* | an implementation that reports an unreachable provider as `not_paid_yet` (**M2**) — the opposite user action per C-10 — and, in the same case, one that throws instead of returning an outcome. |
| *lỗi KHÔNG phải PayosCallError không bị nuốt* | a `catch` with no class test, which would relabel our own bugs as "try again shortly" (**M9**). |
| *đơn bán ở giá CŨ vẫn settle* | step 3 comparing against a **constant** (**M4**) — the only case that can distinguish it, since a 39 000 order matches both readings. |
| *đơn giá HIỆN TẠI, nhà cung cấp báo giá CŨ ⇒ amount_mismatch* + *amount 0 ⇒ amount_mismatch* | step 3 comparing a value against **itself** or against anything that travels with the provider (**M5**, 4 red); a missing-`amount` response settling. |
| *chỉ đọc `status` và `amount`* | any read of a third provider field — spread, log, or copy (P-1). |
| *thua cuộc đua (RPC null) ⇒ not_pending* | an implementation that reports the lost race as settled (**M7**) or as an exception. |
| *phát lại: lượt hai KHÔNG ghi thêm* | the classic hollow pair — "the second call returns `not_pending`" alone does not prove the write count stayed at 1; both are asserted, plus `getPaymentStatus` called once. |
| *đơn mồ côi: exception LAN RA* | an implementation that swallows the SQL `raise exception` into a refusal (**M8**), which would erase the only trace of a `'paid'` row with no beneficiary. |
| *nhận ĐÚNG MỘT tham số* | an amount / status / user id sneaking into either the function signature or the RPC parameter list (**M11**). |
| *đọc đúng hai cột, theo order_code* | an owner-scoped settlement read, which would break the webhook trigger (**M12**); a widened `select("*")` (**M13**). |
| *chuẩn hoá `+00:00` → `…Z`* | returning PostgREST's serialization form unchanged (**M14**) — the same defect class CL-01 names for `pendingUntil`. |

Expected values are literals throughout: the five reason strings, `39000`, `45000`, `0`, `2026-09-18T12:00:00.000Z`, `2026-09-18T12:00:00+00:00`, `2026081900`. None is produced by calling `settleOrder`, the adapter, or the mocked RPC.

### 7. Decisions taken inside this task, and their handoffs

- **`readPaymentOrderForSettlement()` is new and was not enumerated in the DD.** The DD's step 1 requires a `service_role` read, and `service-role.ts` forbids exporting its client, so a second narrow operation there is the only construct that preserves the contract. It is deliberately named `…ForSettlement` because it bypasses RLS: reusing it from a Server Action would re-open the enumeration oracle FE-B-02 closed. It returns only `{ status, amount }` — no `user_id` reaches TypeScript.
- **`p_period_days` is not passed.** The SQL declares `default 30` beside the `make_interval` that consumes it, so the period length keeps exactly one declaration; sending 30 from TypeScript would be the second clock ADR-0013 already outlawed for the pending window. **Handoff to plan Task 6.1 (SVC-1)**: this relies on PostgREST resolving the function with the defaulted argument omitted — proven on real Postgres there, not here.
- **`expiresAt` is normalised to the `…Z` form** in `recordPaymentSettlement()`, at the point the value leaves the database, under the same rule CL-01 sets for `pendingUntil`.
- **Two exception paths leave `settleOrder()` deliberately**: a failed order read, and the orphaned-order SQL exception. Neither is one of the five enumerated refusals, and C-10's State × Display matrix already routes a thrown exception to the route's `error.tsx`.
- **Fixture reconciliation done**: `FixtureSettleResult` is deleted from `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts`; `FixtureRecheckOutcome` is now `SettleResult | FixtureRateLimitedRefusal`, so the existing `as const satisfies Record<string, FixtureRecheckOutcome>` on `FIXTURE_RECHECK_OUTCOMES` is the compile-time link over **both** union arms. The header's transcription warning and its reconciliation checklist are updated.
- **Backend DD `:1199` corrected** (handed to this task's Refactor phase): the prose shorthand `getPaymentStatus() === "paid"` — never true, since Task 3.1's adapter returns a two-property object — now reads `getPaymentStatus().status === "paid"`. Nothing else in that clause changed. **Residual, not fixed**: the v1.7 history row at `:1422` still describes this residual as "deliberately left". History rows in that document are not re-edited by its own stated rule, and bumping the document version is outside this task's authority — flagged rather than silently altered.

### 8. Verification run (from `SOURCE/`)

| Gate | Result |
|---|---|
| `npx vitest run lib/billing/__tests__/settleOrder.test.ts` | **28 passed**, 0 skipped (27 + the read-failure case of §9) |
| `npm test` | **1133 passed / 10 skipped** (baseline 1105/10 + 28 new; no regression) |
| `npm run test:fixture` | **23 passed**, exit 0 (unchanged) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (`--max-warnings 0`) |
| Mutation harness (14 mutants) | **14 killed, 0 survivors**; sources restored, `git status` clean of mutants |

Not run, per the phase's own rules: `npm run build` / `next build` (hangs under the sandbox), `npm run verify:schema` (touches the dev DB; no DDL changed here), `npm run test:integration` / `test:localdb` (comment-only skeletons that exit 1 by design). **No production deploy of this branch has occurred.**

### 9. Revision cycle — the two survivors of the reviewer's 26-mutant sweep

The reviewer's sweep applied 26 mutants to the shipped sources and killed 24. My own §6 sweep was narrower (14 mutants) and never aimed one at the step-1 read path, which is exactly why it reported no survivors. Only the test file changed in this cycle; `settleOrder.ts` and `service-role.ts` were not touched.

| Survivor | Where it hid | Fix | Mutation result |
|---|---|---|---|
| `if (error) throw error;` → `if (error) return null;` (`service-role.ts:417`) | **No case ever drove `maybeSingle()` to return an `error`.** `givenOrderRow()` hardcoded `{ data: row, error: null }`, so the throw branch had zero coverage — §7 records two deliberate exception paths and only the orphaned-order one had a case. | New arrange helper `givenOrderReadFails(code, message)` (the old helper could not express an error at all: the fake now takes a `FakeReadResult` union, which is the three shapes the boundary can actually return) + one new case, *lượt đọc bước 1 HỎNG ⇒ lỗi LAN RA*. | **Killed.** Exactly 1 failed / 27 passed, exit 1, and the one red case is the new one: `AssertionError: promise resolved "{ settled: false, …(1) }" instead of rejecting`. |
| explicit projection → `return data as {…}` whole-row pass-through (`service-role.ts:421`) | The case *"trả về ĐÚNG hai trường, không mang user_id đi tiếp"* **read its expectation back out of its own fixture**: `givenOrderRow({status, amount})` could only ever produce a two-key object, so both the `toEqual` and the key-set assertion were true by construction of the arrange, not by behaviour of the implementation. | The fake row type now carries the third column (`user_id?`), and that case feeds one. Both assertions were left exactly as they were — they only now have something to observe. | **Killed.** Exactly 1 failed / 27 passed, exit 1, red on that case: `expected { status: 'pending', …(2) } to deeply equal { status: 'pending', amount: 39000 }`, diff line `+ "user_id": "1111…5555"`. |

**Third fix — the stated Proof Obligation that was only half-written.** The *unavailable boundary* claim's State assertion reads "write count 0 **before and after**"; the `provider_unavailable` case asserted only the after-count, leaving the before-0 implied by `beforeEach`'s `mockReset()`. It now spells out both, mirroring the mismatch case, and arranges `givenSettlementReturns(...)` so a write is genuinely *possible*: counting 0 against a mock that could not have written proves something about the mock, not about the implementation. Evidence that this is not cosmetic — under a write-before-verification mutant (`recordPaymentSettlement()` hoisted above step 2 in `settleOrder.ts`), the case now fails on the count itself, `AssertionError: expected 1 to be +0`, whereas its neighbour *"một lỗi KHÔNG phải PayosCallError"* — the case that still has no settlement arranged — fails instead on `Cannot destructure property 'data'`, i.e. incidentally, on a mock that could not deliver a value. That mutant is killed by 13 cases.

**Fragility fixed in place, not by a new case**: `LEGACY_STORED_AMOUNT` (45 000) now carries a comment saying why it must stay different from `STORED_AMOUNT` (39 000). Per the reviewer's measurement, the constant-39000 mutant is killed by **exactly one** case (the legacy-price order) and the constant-45000 mutant by nine — so either direction of "compare against a constant" is caught, but tidying the two values to be equal would silently delete the sole executioner of the first.

All three mutants were restored byte-for-byte in a `finally` block (`RESTORED_BYTE_FOR_BYTE=true` each), exit codes read via `spawnSync` on `node_modules/vitest/vitest.mjs` — `2>&1` inside `execSync` corrupts the status on this platform. Post-restore grep finds no mutant text on disk, and `git status` shows only this task's intended files.

**Gates after the revision**: `npx vitest run lib/billing/__tests__/settleOrder.test.ts` **28 passed**; `npm test` **1133 passed / 10 skipped**; `npm run test:fixture` **23 passed**, exit 0; `npx tsc --noEmit` exit 0; `npm run lint` clean.
