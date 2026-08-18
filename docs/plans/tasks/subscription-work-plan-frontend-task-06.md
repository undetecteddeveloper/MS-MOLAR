# Task: S-05 `/me/orders` page, C-07, C-08 and the boundary files

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.6**
Layer: **frontend** (`SOURCE/app/(billing)/me/orders/**` page and components)

Metadata:
- Dependencies: frontend-task-03 (formatters + C-09), backend-task-19 (plan Task 3.5 — `listMyOrders()`)
- Provides: the S-05 surface that plan Tasks 3.7, 3.8, 3.9 build on
- Size: Medium (5 files)

## Implementation Content

- **Page**: auth guard **before** any fetch, redirecting to `/?auth=signin` (**never `/login`**); **zero rows fetched for a guest**.
- **C-07 `OrderList` (server)**: `<ul className="flex flex-col gap-3">`, the dashed-border empty box idiom, **no height cap and no internal scroll**, **no sorting or filtering of its own** — it **re-states the non-re-sorting invariant**.
- **C-08 `OrderRow` (server)**: created time via `formatDateTime()`, amount via `formatVnd()` + the `billing.amount` key, **`orderCode` as a raw digit string**; `md:flex-row` layout, **no `sm:`**; `min-w-0` on the text column and **no `whitespace-nowrap`** on the metadata line; a "continue paying" link **only when `pending` and `pendingUntil` is in the future**.
- **`me/orders/{loading,error}.tsx`** per the **origin** pattern `(HM)/history/{loading,error}.tsx` — the skeleton matches its **own** page `PageContainer` **size and padding**; the error boundary **focuses its `role="alert"` on mount** via a ref on a `tabIndex={-1}` wrapper, retries via `reset()`, logs **`error.digest` only**, and its retry control carries **`min-h-11`**.

**No integration case is filled here**: **INT-3 belongs to plan Task 3.4** (it asserts `createOrder()` reuse branch) and **INT-2 to plan Task 3.5** (it asserts `getMyOrder()` mapping). Both are already resolved when this task starts — **integration 2/3 cumulative**.

## Target Files
- [ ] `SOURCE/app/(billing)/me/orders/page.tsx`
- [ ] `SOURCE/app/(billing)/me/orders/_components/OrderList.tsx`
- [ ] `SOURCE/app/(billing)/me/orders/_components/OrderRow.tsx`
- [ ] `SOURCE/app/(billing)/me/orders/loading.tsx`
- [ ] `SOURCE/app/(billing)/me/orders/error.tsx`

## Investigation Targets
- `SOURCE/app/(HM)/history/loading.tsx` and `SOURCE/app/(HM)/history/error.tsx` (**the origin pattern** — copy size, padding, focus handling, `reset()`, digest-only logging)
- `SOURCE/app/(billing)/queries.ts` (plan Task 3.5 — `listMyOrders()` and `MyOrderRow`)
- `SOURCE/lib/format/datetime.ts`, `SOURCE/lib/format/number.ts` (plan Task 2.3)
- `SOURCE/components/billing/OrderStatusBadge.tsx` (plan Task 2.3 — C-09)
- `SOURCE/app/(billing)/layout.tsx` (**frozen** — the route-group shell; do not edit)
- `SOURCE/lib/i18n/dictionaries/en.ts` (`billing.amount` and the S-05 keys from plan Task 2.3)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `OrderList` — C-07 — verify default + loading (route `loading.tsx`) + empty + error (route `error.tsx`) + partial (unrecognised status in one row) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `OrderRow` — C-08 — verify default + partial (`pending` + future `pendingUntil` ⇒ "continue paying" link) states)
- `docs/design/subscription-frontend-design.md` (§ Main Components)
- `docs/design/subscription-frontend-design.md` (§ FE-I9 / UI-D18)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `OrderRow` — C-08) | derived-display | **The `orderCode` is rendered as a raw digit string** — it is an identifier the user reads aloud to support, so it must not be grouped, abbreviated or localised | The rendered `orderCode` contains only digits, with no grouping separator and no locale formatting |
| `docs/design/subscription-backend-design.md` (§ `createOrder()`s order of operations) | state-lifecycle-negative | The reused row is returned with **its original `pending_until`**, read from the row, not recomputed as `now() + 30 min` … *"the countdown is never restarted"* | The "continue paying" link and any deadline text render the `pendingUntil` value as supplied, with no recomputation in the view |

## Boundary Context (from the plan Connection Map)

**Boundary — S-05 / `PurchaseCta` → S-06 (order identifier across a navigation).**
- Owners: `SOURCE/app/(billing)/me/orders/_components/OrderRow.tsx`, `SOURCE/app/(billing)/pricing/_components/PurchaseCta.tsx` ↔ `SOURCE/app/(billing)/pricing/checkout/page.tsx`.
- **Serialized Format**: URL query string `?order={digits}` on `/pricing/checkout` — a decimal digit string, no grouping, no sign.
- **Consumer Parse Rule**: accept **only** a value that is a **string** matching `/^\d+$/` whose `Number()` is a positive safe integer (`> 0` and `<= Number.MAX_SAFE_INTEGER`). **Never `parseInt`** — it accepts `"123abc"`. Anything else ⇒ C-13 Empty state, not an error and not a 404.
- **Expected Signal**: navigation lands on `/pricing/checkout?order={the same orderCode createOrder() returned}` and S-06 renders that order transfer block.
- **Roundtrip check**: the digit string this row emits in the link parses, under the consumer rule, to the same `orderCode` value.

**Boundary — Postgres → PostgREST → `createOrder()` / `getMyOrder()` → S-06.**
- **Expected Signal**: `createOrder()` return and `getMyOrder(orderCode)` return are deeply equal for one `orderCode`, with `pendingUntil` byte-identical. (Proven in plan Task 3.5 / INT-2; this view must not re-derive or re-format that value in a way that breaks the identity.)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, starting with the `(HM)/history` origin boundary files
- [ ] Write failing tests: guest ⇒ redirect to `/?auth=signin` with **zero** rows fetched; empty ⇒ the dashed-border empty box, not an error; one row with an unrecognised status ⇒ C-09 unrecognised branch; `pending` + future `pendingUntil` ⇒ the "continue paying" link, absent otherwise
### 2. Green Phase
- [ ] Implement the page, C-07, C-08 and the two boundary files; run only the added tests
### 3. Refactor Phase
- [ ] Confirm the page and C-07 perform **no ordering of their own**

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- Manual browser pass at 360px + greyscale — **the load-bearing accessibility and layout check** (golden states 11-24) — Config: `SOURCE/package.json:14` (executed in plan Task 6.5)
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: unit/render tests over the page and both components, plus the ★ frontend early verification point in plan Task 3.8.
- **Success criteria**: rows render newest first **without the view sorting**; guest fetches zero rows; empty renders a non-error surface; an unrecognised status renders C-09 unrecognised branch; the boundary files match the origin pattern in size, padding, focus and retry height.
- **Failure response**: if the view sorts, remove the sort — the SQL ordering in plan Task 3.5 is the only one, and a second sort is the missing-sort-key defect this invariant exists to prevent.
- **Verification level**: L1 (a signed-in user sees their orders).

## Proof Obligations
- **Claim (missing-sort-key ordering)**: the view re-states the non-re-sorting invariant and **performs no ordering of its own**.
- **Primary failure mode**: a second sort in the view disagrees with the SQL ordering, so "newest first" holds in one place and not another.
- **Boundary to exercise**: the rendered list order against a fixture whose insertion order differs from `created_at desc`.
- **State assertion**: N/A (render).
- **Mock boundary rationale**: `listMyOrders()` is stubbed with fixture rows; the components are real.
- **Residual**: the SQL ordering itself is proven in plan Task 3.5.

- **Claim (empty input)**: no records ⇒ a **non-error empty surface**.
- **Primary failure mode**: an empty list renders as an error boundary or a blank page.
- **Boundary to exercise**: the page with an empty result set.
- **State assertion**: N/A.
- **Mock boundary rationale**: as above.
- **Residual**: none.

- **Claim (same-value)**: a repeated create surfaces the identical identifier and the identical deadline string in this view.
- **Primary failure mode**: the view reformats or recomputes `pendingUntil`, breaking the byte-identity plan Task 3.5 proves.
- **Boundary to exercise**: the rendered row against the value supplied by the query module.
- **State assertion**: N/A.
- **Mock boundary rationale**: as above.
- **Residual**: the producer-side identity is proven in plan Tasks 3.4 and 3.5.

## Completion Criteria
- [ ] All added tests pass
- [ ] The page performs **no ordering of its own**; C-07 re-states the non-re-sorting invariant
- [ ] Guest ⇒ redirect to `/?auth=signin` with zero rows fetched
- [ ] Boundary files match the `(HM)/history` origin pattern: same `PageContainer` size **and** padding, focused `role="alert"`, `reset()`, `error.digest` only, `min-h-11` retry
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred** — and S-05 must not reach real users until SVC-2 (plan Task 6.2) passes

## Notes
- Impact scope: the `/me/orders` route; downstream, plan Tasks 3.7, 3.8, 3.9.
- Scope boundary: `SOURCE/app/(billing)/layout.tsx` frozen; no `sm:` breakpoint; no height cap or internal scroll on C-07.

## Investigation Notes
(Record the origin-pattern details copied and each Compliance Check result here.)
