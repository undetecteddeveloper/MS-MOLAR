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
- [x] `SOURCE/app/(billing)/me/orders/page.tsx`
- [x] `SOURCE/app/(billing)/me/orders/_components/OrderList.tsx`
- [x] `SOURCE/app/(billing)/me/orders/_components/OrderRow.tsx`
- [x] `SOURCE/app/(billing)/me/orders/loading.tsx`
- [x] `SOURCE/app/(billing)/me/orders/error.tsx`

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
- [x] Read all Investigation Targets, starting with the `(HM)/history` origin boundary files
- [x] Write failing tests: guest ⇒ redirect to `/?auth=signin` with **zero** rows fetched; empty ⇒ the dashed-border empty box, not an error; one row with an unrecognised status ⇒ C-09 unrecognised branch; `pending` + future `pendingUntil` ⇒ the "continue paying" link, absent otherwise
### 2. Green Phase
- [x] Implement the page, C-07, C-08 and the two boundary files; run only the added tests
### 3. Refactor Phase
- [x] Confirm the page and C-07 perform **no ordering of their own**

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
- [x] All added tests pass
- [x] The page performs **no ordering of its own**; C-07 re-states the non-re-sorting invariant
- [x] Guest ⇒ redirect to `/?auth=signin` with zero rows fetched
- [x] Boundary files match the `(HM)/history` origin pattern: same `PageContainer` size **and** padding, focused `role="alert"`, `reset()`, `error.digest` only, `min-h-11` retry
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred** — and S-05 must not reach real users until SVC-2 (plan Task 6.2) passes

## Notes
- Impact scope: the `/me/orders` route; downstream, plan Tasks 3.7, 3.8, 3.9.
- Scope boundary: `SOURCE/app/(billing)/layout.tsx` frozen; no `sm:` breakpoint; no height cap or internal scroll on C-07.

## Investigation Notes
(Record the origin-pattern details copied and each Compliance Check result here.)

### Investigation Targets read (2026-08-19)

**`(HM)/history/loading.tsx`** — `PageContainer as="main" size="small" padding="compact"`, one `h-8 w-32 animate-pulse rounded bg-border/60` heading block, then `mt-6 flex flex-col gap-3` with **4** `h-20 animate-pulse rounded-lg border border-border bg-card/40` blocks. Its comment states the rule: the skeleton must match **its own page's** size *and* padding or the content jumps when the skeleton is swapped for data.

**`(HM)/history/error.tsx`** — `"use client"`; `useRef<HTMLDivElement>`, `useEffect(..., [error])` doing `console.error(...)` then `alertRef.current?.focus()`; wrapper `ref` + `role="alert"` + `tabIndex={-1}`; `<button type="button" onClick={reset}>`. Origin logs the **whole error object** and has **no `min-h-11`**; frontend DD § "Route boundary files" says to take those two points from `(layer3)/profile/error.tsx` instead (`{ digest: error.digest }` only, `min-h-11`, `common.tryAgain`). The four new files therefore = origin shape + profile's three corrections.

**`(billing)/queries.ts`** — `listMyOrders(): Promise<MyOrderRow[]>`; `MyOrderRow = { orderCode: number; amountVnd: number; status: string; createdAt: string; pendingUntil: string }`. Ordering is declared **once in SQL** (`.order("created_at", { ascending: false })` against `payment_orders_user_created_idx`); the module's own comment forbids a second sort in JS. `createdAt`/`pendingUntil` leave the query **verbatim as PostgREST delivers them** (`+00:00` form, not `…Z`) — the view must not re-derive them. A guest reads 0 rows through `orders_select_own`, so `[]` is a value, not an error.

**`lib/format/datetime.ts` / `number.ts`** — `formatDateTime(iso, locale)` → `"DD/MM/YYYY HH:mm"` pinned to `Asia/Ho_Chi_Minh` + `en-GB`/`vi-VN`; `"—"` for null/unparseable; never throws. `formatVnd(amount, locale)` → grouped digits only, no unit; the unit lives in `billing.amount` (`"{amount} VND"`), and the rule is **format first, translate second**.

**`components/billing/OrderStatusBadge.tsx`** (C-09) — `"use client"`, props `{ status: string }`, narrows internally; anything outside `pending|paid|expired|cancelled` renders the fifth appearance (`?` glyph, `billing.status.unrecognised`, `border-destructive text-destructive`). Consumed as-is; no prop is added.

**`(billing)/layout.tsx`** — frozen. Supplies `SiteHeader`, `EntitlementProvider`, `#main-content`, `.pb-bottom-nav`. Not edited.

**`lib/i18n/dictionaries/en.ts`** — all S-05 keys already ship (plan Task 2.3): `billing.amount`, `billing.orders.{title,empty,emptyHint,createdAt,orderCode,continuePaying,loadError}`, `billing.status.*`, plus `common.tryAgain` and `billing.quota.upgradeLink` ("See plans", the shipped `/pricing` link label used by `ExplainStepAffordance.tsx:125`). **No dictionary key is added by this task** — `en.ts`/`vi.ts` are outside the Target Files.

**UI Spec § C-07 / § C-08, frontend DD § Main Components, § FE-I9 / UI-D18** — read; page tree is `PageContainer size="default"` → `PageHeader` (owns the `<h1>`) → (C-11, Task 3.7) → `OrderList`.

**Unimplemented dependency (recorded handoff, not a blocker):** C-10 `RecheckOrderControl` and C-11 `PlanSummary` do **not** exist yet — the work plan assigns both to **Task 3.7**, and neither is in this task's Target Files. `OrderRow` therefore renders badge + conditional "continue paying" link only, and `page.tsx` renders `PageHeader` + `OrderList` only. Integration handoff: Task 3.7 mounts `<RecheckOrderControl orderCode={order.orderCode} variant="row" />` in `OrderRow`'s right-hand control cluster (the `flex shrink-0 …` div) and `<PlanSummary />` between `PageHeader` and `OrderList`. No stub, no placeholder, no contract invented here.

### Reference Contracts — planned approach and Compliance Check

Planned approach (row 1, `orderCode`): `OrderRow` renders the identifier via `String(order.orderCode)` — the only stringification in the row — and builds the link as `` `/pricing/checkout?order=${order.orderCode}` ``. `formatVnd()` is applied to `amountVnd` **only**.

Planned approach (row 2, `pendingUntil`): the row reads `order.pendingUntil` exactly as the query module supplied it, uses it in **one** comparison (`Date.parse(order.pendingUntil) > Date.now()`) to decide whether the "continue paying" link renders, and renders **no** deadline text at all. `createdAt + 30 minutes` is never computed; the displayed timestamp is `createdAt` and nothing else.

| Row | Compliance Check | Result | Rationale |
|---|---|---|---|
| 1 | The rendered `orderCode` contains only digits, with no grouping separator and no locale formatting | **Y** | `String(order.orderCode)` — no `Intl`, no `toLocaleString`, no `formatVnd` on that field. Asserted for a 13-digit bigint under both locales, plus a negative assertion that neither the `en` (`,`) nor the `vi` (`.`) grouped form appears anywhere in the row text |
| 2 | The "continue paying" link and any deadline text render the `pendingUntil` value as supplied, with no recomputation in the view | **Y** | Single use of the supplied value in one comparison; no deadline text exists in this view (it belongs to C-13). Asserted by a `pending` row whose `createdAt` is over a day old while `pendingUntil` is in the future ⇒ link **present** (kills a `createdAt + 30 min` recomputation), and by a displayed-timestamp assertion whose expected string is `createdAt`'s and which asserts `pendingUntil`'s formatted string is **absent** (kills a swap of the two fields) |

### Exit Gate — Compliance Checks re-evaluated against the SHIPPED implementation (2026-08-19)

| Row | Compliance Check | Result | Evidence against the final code |
|---|---|---|---|
| 1 | The rendered `orderCode` contains only digits, with no grouping separator and no locale formatting | **Y** | `OrderRow.tsx` renders `{String(order.orderCode)}` and builds `` href={`/pricing/checkout?order=${order.orderCode}`} ``. `OrderRow.test.tsx` Cases 1–3 assert the raw 13-digit form in `en` and `vi` and the absence of both grouped forms. Mutants **M12** (`formatVnd` on the code), **M32** (`toLocaleString()`) and **M34** (grouped code in the href) are all killed |
| 2 | The "continue paying" link and any deadline text render the `pendingUntil` value as supplied, with no recomputation in the view | **Y** | The supplied value is read exactly once, in `isWindowStillOpen(order.pendingUntil)`; the view renders **no** deadline text (C-13 owns that). Mutants **M15** (`created_at + 30 min`), **M39** (predicate fed `createdAt`), **M13** (the two timestamps swapped) and **M40** (comparison inverted) are all killed. The fixtures give `createdAt` and `pendingUntil` clearly different instants, so a field swap cannot pass unseen |

**Boundary roundtrip (plan Connection Map, S-05 → S-06):** `OrderRow.test.tsx` Case 3 reads the emitted `?order=` value out of the href and parses it with the consumer rule copied from the plan (`/^\d+$/` + positive safe integer, never `parseInt`); it returns the same `orderCode`. The real consumer lands in plan Task 4.2.

**Mutation pass:** 40 mutants across the five files, **40 killed**. One survivor was found and fixed during the pass: the first form of the digest-only logging case compared `JSON.stringify(args)` and let `console.error(msg, { error })` through, because `digest` is an *enumerable* own property of the error object while `Error#message` is not — the whole-object form serialised to `{"error":{"digest":"…"}}`, satisfying both the "contains digest" and the "omits message" assertions. The case now asserts the payload's **shape** (`toEqual({ digest })` + exact key list + no `Error` anywhere in the call), and the mutant is killed.

**Gates:** `npm test` 1182 passed / 10 skipped (105 files passed, 1 skipped) — baseline 1164 + the 18 added here; `npm run test:fixture` 23 passed; `npx tsc --noEmit` exit 0; `npm run lint` clean; `npm run test:localdb` still exits non-zero with "No test suite found in file" (unchanged, deliberate).

**One deviation worth a reviewer's eye:** `react-hooks/purity` (a hard lint error under `--max-warnings 0`) rejects `Date.now()` inside a component body. The clock read therefore lives in a module-scope `isWindowStillOpen()` helper in `OrderRow.tsx`, with the reason stated at the call site: this is a server component rendered once per request, so the rule's re-render-instability concern does not arise, and "now" cannot come from anywhere else without changing C-08's props, which the frontend DD fixes as `{ order }`.

**Not done here, on purpose:** C-10 `RecheckOrderControl` and C-11 `PlanSummary` (plan Task 3.7 owns both — see the handoff note above), and no dictionary key was added (`en.ts` / `vi.ts` already carry every S-05 key and are outside this task's Target Files).
