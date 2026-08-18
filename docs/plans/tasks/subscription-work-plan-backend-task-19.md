# Task: `app/(billing)/queries.ts` — `listMyOrders()` and `getMyOrder()` (closes CL-01) + INT-2

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.5**
Layer: **backend** (server-only data module + integration test; not a page/layout/component file)

Metadata:
- Dependencies: backend-task-17 (`toCheckoutOrder`), backend-task-18 (`createOrder` — INT-2 creates an order first), backend-task-01 (`test:integration`), backend-task-11 (gate B on dev)
- Provides: the two read functions S-05 (plan Task 3.6) and S-06 (plan Task 4.2) consume; **INT-2 filled in this same commit**
- Size: Small (2 files)

`Change Category: boundary-change`

`getMyOrder()` mapping step changes so that one contract has **one** producer. Sweep the adjacent cases sharing that contract — `createOrder()` return (plan Task 3.4), `toCheckoutOrder()` (plan Task 3.3) and every consumer of `pendingUntil` — for the same class of defect: a second inline camelCase mapping of the same row.

## Implementation Content

`import "server-only"`, following the four shipped route-group query modules.

- **`listMyOrders()`** wraps `readBounded` and orders `created_at desc` **in SQL**. The read is flat — no embed — so the `(HM)` JavaScript-sort exception, which exists only because `.order(col, { referencedTable })` is a measured no-op for to-one embeds, **does not arise**. It maps to `MyOrderRow` with `status` typed **`string`, not the union**.
- **`getMyOrder(orderCode)` imports and uses `toCheckoutOrder(row)`.** It keeps its location, its signature and its `import "server-only"`; **only its mapping step changes**. **Do not write an inline camelCase mapping for this row.**
- `listMyOrders()` / `MyOrderRow` are unaffected — a different, list-shaped projection.

**This is the fix for CL-01.** Two mappings for one contract produce a **failing test** (INT-2), not a silent divergence: `pendingUntil` in PostgREST `+00:00` form is not string-equal to `toISOString()` `…Z` form — same instant, different string — and that string is the deadline text AC-027 observes.

### INT-2 — filled in **this** commit
This is the commit that changes `getMyOrder()` mapping, which is the behaviour INT-2 asserts. **Without it, CL-01 fix ships with nothing that proves it.**

Create an order, then in a **fresh request-scoped client that has not called `createOrder()`** read it back and assert:
- a **single deep-equality** assertion over the whole `CheckoutOrder` (no field excluded, no normalisation applied to either side);
- `pendingUntil` compared as a raw string **byte for byte** *and* against the literal `…Z` form the implementation commits to;
- the four transfer values byte-identical to what the mocked `createPaymentRequest()` returned;
- that `queries.ts` declares **no inline camelCase mapping of its own** for this row.

## Target Files
- [ ] `SOURCE/app/(billing)/queries.ts` (new)
- [ ] `SOURCE/tests/integration/subscription.int.test.ts` (**INT-2 filled**)

## Investigation Targets
- `SOURCE/app/(layer2)/queries.ts` and `SOURCE/app/(layer4)/queries.ts` (the shipped route-group query-module convention, incl. `import "server-only"`)
- `SOURCE/lib/supabase/boundedRead.ts` (`readBounded` — the bounded-read wrapper and its ordering options)
- `SOURCE/lib/billing/checkoutOrder.ts` (plan Task 3.3 — the mapper this module must import, not reimplement)
- `SOURCE/lib/billing/orderActions.ts` (plan Task 3.4 — the other producer of `CheckoutOrder`; INT-2 compares against it)
- `SOURCE/supabase/schema.sql` (`payment_orders_user_created_idx` on `(user_id, created_at desc)` — the index the SQL ordering must match)
- `SOURCE/tests/integration/subscription.int.test.ts` (**INT-2** `Proof obligation:` / `Primary failure mode:` annotation block)
- `docs/design/subscription-backend-design.md` (§ Escalation E-02 / CL-01)
- `docs/design/subscription-frontend-design.md` (§ Data-Fetching Plan)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | `getMyOrder()` returns exactly this shape, produced by `toCheckoutOrder()` |
| `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010) | derived-display | `pendingUntil` ← `pending_until timestamptz`: **`new Date(row.pending_until).toISOString()`** — always the `…Z` form with milliseconds. The normalisation is the point | `getMyOrder()` `pendingUntil` is byte-identical to `createOrder()` for the same `orderCode`, in the `…Z` form |

## Boundary Context (from the plan Connection Map)

**Boundary — Postgres → PostgREST → `createOrder()` / `getMyOrder()` → S-06.**
- Owners: `public.payment_orders` (via `SOURCE/lib/billing/checkoutOrder.ts`) ↔ `SOURCE/app/(billing)/pricing/checkout/**`.
- **Serialized Format**: PostgREST renders `timestamptz` as `2026-08-18T09:30:00+00:00`; `bigint` and `integer` as JSON numbers.
- **Consumer Parse Rule**: `toCheckoutOrder(row)` — the **one** mapper: `Number(row.order_code)`; `amount` → `amountVnd` (rename only); `new Date(row.pending_until).toISOString()` ⇒ the `…Z` form; four `text` fields verbatim.
- **Expected Signal**: `createOrder()` return and `getMyOrder(orderCode)` return are **deeply equal** for one `orderCode`, with `pendingUntil` **byte-identical**.
- **Roundtrip check**: the value `createOrder()` emits parses to the value `getMyOrder()` returns — asserted as one deep equality, not field by field.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record INT-2 annotation block verbatim
- [ ] **Boundary sweep**: grep for every camelCase mapping of a `payment_orders` row and confirm `toCheckoutOrder()` is the only one after this change
- [ ] Write INT-2 first and confirm it fails against an inline mapping (the `+00:00` vs `…Z` difference is what it catches)
### 2. Green Phase
- [ ] Implement `listMyOrders()` (SQL `created_at desc`) and `getMyOrder()` (via `toCheckoutOrder`); run `npm run test:integration` against dev
### 3. Refactor Phase
- [ ] Confirm `MyOrderRow.status` is typed `string`, not the union, and that the module performs no JavaScript re-sort

## Quality Assurance Mechanisms
- Real-Postgres integration tests (precedent `recordSkillMastery.int.test.ts`) — Enforces: query correctness, ordering against the matching index, RLS visibility — Config: `SOURCE/vitest.integration.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: `npm run test:integration` against **dev** — create through `createOrder()`, read back through `getMyOrder()` in a **fresh** request-scoped client, and compare with one deep equality.
- **Success criteria**: **INT-2 green from this commit**; `pendingUntil` byte-identical and in the literal `…Z` form; the four transfer values byte-identical to the mocked `createPaymentRequest()` return; `queries.ts` contains no inline camelCase mapping; `listMyOrders()` returns rows newest first with the ordering expressed in SQL.
- **Failure response**: if the deep equality fails on `pendingUntil`, the second mapping still exists — **remove the mapping, do not normalise the assertion**.
- **Verification level**: L2 (integration test against a real database).

## Proof Obligations
- **Claim (same-value)**: two producers of one contract yield **deeply equal** values.
- **Primary failure mode**: a field-by-field assertion that silently tolerates a different `pendingUntil` string form; on screen the user sees one deadline after purchase and a differently formatted one after a reload.
- **Boundary to exercise**: the real dev Postgres through PostgREST, read by a **fresh request-scoped client that has not called `createOrder()`** (so no in-process value is reused).
- **State assertion**: one row created → read back in a new client → the two `CheckoutOrder` values are deeply equal, with `pendingUntil` compared as a raw string byte for byte.
- **Mock boundary rationale**: only `createPaymentRequest()` is mocked (external paid service); the database, PostgREST serialisation and the mapper are real — a mocked client would assert the mock, not the serialization form that causes the defect.
- **Residual**: does not prove the rendered deadline text — plan Task 3.6 / FE-1 do.

- **Claim (missing-sort-key ordering)**: ordering is expressed **once**, in the query module, against the matching index.
- **Primary failure mode**: rows lacking a stable sort key are re-sorted (or not sorted) in the view, so "newest first" holds in one place and not another.
- **Boundary to exercise**: the SQL query against `payment_orders_user_created_idx`.
- **State assertion**: rows inserted out of chronological order come back `created_at desc`.
- **Mock boundary rationale**: none — real database.
- **Residual**: the view non-re-sorting invariant is re-stated and asserted in plan Task 3.6.

## Completion Criteria
- [ ] All added tests pass; **INT-2 green from this commit**
- [ ] `getMyOrder()` imports and uses `toCheckoutOrder(row)`; **no inline camelCase mapping exists in `queries.ts`**
- [ ] `listMyOrders()` orders `created_at desc` **in SQL**; `MyOrderRow.status` is typed `string`
- [ ] `import "server-only"` present, following the four shipped route-group query modules
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Test-case resolution: **integration 2/3 cumulative (INT-2, INT-3)**
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/app/(billing)/queries.ts`; downstream, plan Tasks 3.6, 4.2.
- Scope boundary: `SOURCE/lib/billing/checkoutOrder.ts` is imported, never re-implemented; `SOURCE/lib/billing/types.ts` frozen.

## Investigation Notes
(Record the boundary sweep result, the byte-compared `pendingUntil` strings, and each Compliance Check result here.)
