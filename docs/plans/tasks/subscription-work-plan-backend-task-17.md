# Task: `checkoutOrder.ts` — the one `toCheckoutOrder(row)` mapper

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.3**
Layer: **backend** (`SOURCE/lib/billing/**`)

Metadata:
- Dependencies: backend-task-12 (plan Task 1.4)
- Provides: `CheckoutOrder` + `toCheckoutOrder(row)` — the **single** mapper imported by plan Task 3.4 (`createOrder`) and plan Task 3.5 (`getMyOrder`)
- Size: Small (1 file + test)
- ⚠ **Ordering constraint: this task must precede plan Tasks 3.4 and 3.5** — the contract is pinned *before* two producers exist (that is the whole point of CL-01).

## Implementation Content

A **new file**, so `SOURCE/lib/billing/types.ts` stays frozen.

Exports:
- the `CheckoutOrder` type **consumed verbatim from UI Spec C-13** (not redefined, not re-ordered);
- the single snake_case → camelCase mapping, with every field serialized form pinned per Reference Contracts below — in particular **`pendingUntil` = `new Date(row.pending_until).toISOString()`**, normalising PostgREST `+00:00` form to the `…Z` form.

**The normalisation is the point.**

## Target Files
- [ ] `SOURCE/lib/billing/checkoutOrder.ts` (new)
- [ ] `SOURCE/lib/billing/__tests__/checkoutOrder.test.ts` (new)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — the normative eight-field `CheckoutOrder`)
- `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010)
- `SOURCE/lib/billing/types.ts` (**frozen** — confirm `CheckoutOrder` does **not** go here)
- `SOURCE/supabase/schema.sql` (the `payment_orders` block — the snake_case source column names and their SQL types)
- `SOURCE/lib/supabase/boundedRead.ts` (how PostgREST rows arrive in this repository, and their JSON shapes)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | `CheckoutOrder` declares exactly these eight fields with these names and types, in this order |
| `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010) | derived-display | `pendingUntil` ← `pending_until timestamptz`: **`new Date(row.pending_until).toISOString()`** — always the `…Z` form with milliseconds. The normalisation is the point | `toCheckoutOrder()` produces `pendingUntil` in the `…Z` form with milliseconds for a PostgREST `+00:00` input |

## Boundary Context (from the plan Connection Map)

**Boundary — Postgres → PostgREST → `createOrder()` / `getMyOrder()` → S-06.**
- Owners: `public.payment_orders` (via `SOURCE/lib/billing/checkoutOrder.ts`) ↔ `SOURCE/app/(billing)/pricing/checkout/**`.
- **Serialized Format**: PostgREST renders `timestamptz` as `2026-08-18T09:30:00+00:00`; `bigint` and `integer` as JSON numbers.
- **Consumer Parse Rule**: `toCheckoutOrder(row)` — the **one** mapper: `Number(row.order_code)`; `amount` → `amountVnd` (rename only); `new Date(row.pending_until).toISOString()` ⇒ the `…Z` form; four `text` fields verbatim.
- **Expected Signal**: `createOrder()` return and `getMyOrder(orderCode)` return are **deeply equal** for one `orderCode`, with `pendingUntil` byte-identical.
- **Roundtrip check this task must satisfy**: a PostgREST `+00:00` timestamp fed through this mapper emits exactly the `…Z` string the checkout screen renders and that INT-2 compares byte for byte.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and copy the eight-field C-13 declaration verbatim
- [ ] Write the failing test first: feed a literal PostgREST-shaped row (with `+00:00`) and assert `pendingUntil` **equals the literal `…Z` string with milliseconds** — a hardcoded expected value, never read back from the implementation
### 2. Green Phase
- [ ] Implement the mapper; run only the added tests
### 3. Refactor Phase
- [ ] Confirm no other module declares a `CheckoutOrder` shape or a competing mapping

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npx tsc --noEmit` — Enforces: the eight-field contract compiles as declared — Config: `SOURCE/tsconfig.json`
- `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit test over literal PostgREST-shaped input rows (no database).
- **Success criteria**: `pendingUntil` matches the `…Z` form **with milliseconds**; `orderCode` is a `number` via `Number(row.order_code)`; `amount` → `amountVnd` is a rename only; the four `text` fields pass through verbatim.
- **Failure response**: if a second mapping exists anywhere for this row shape, delete it here rather than reconciling it later — two mappings for one contract is exactly CL-01.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: one row shape has exactly one serialized `CheckoutOrder` form.
- **Primary failure mode**: a future change of serialization form (PostgREST `+00:00` vs `toISOString()` `…Z`) passes here and fails on the payment screen instead — the user sees one deadline after purchase and a differently formatted one after a reload.
- **Boundary to exercise**: the mapper public function, fed literal PostgREST-shaped rows (in-process unit).
- **State assertion**: N/A (pure mapping).
- **Mock boundary rationale**: none — literal input, no I/O.
- **Residual**: deep equality between the **two producers** is proven in plan Task 3.5 (INT-2), not here.

## Completion Criteria
- [ ] All added tests pass, including the literal `…Z`-form assertion
- [ ] `CheckoutOrder` declares exactly the eight C-13 fields; `SOURCE/lib/billing/types.ts` is unmodified
- [ ] No competing mapping for this row shape exists in the repository
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/checkoutOrder.ts`; downstream, plan Tasks 3.4, 3.5, 4.2, 4.3.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen.

## Investigation Notes
(Record the literal input row and expected `…Z` string used, and each Compliance Check result here.)
