# Task: S-06 route, `?order=` parsing, and the boundary files

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.2**
Layer: **frontend** (`SOURCE/app/(billing)/pricing/checkout/**`)

Metadata:
- Dependencies: backend-task-04 (plan Task 0.4 — ST-01, which unblocks slice S2), backend-task-19 (`getMyOrder()`), backend-task-18 (`createOrder()`)
- Provides: the S-06 route shell that plan Tasks 4.3 and 4.4 render into
- Size: Small (3 files)

## Implementation Content

`SOURCE/app/(billing)/pricing/checkout/page.tsx`:
- auth guard **before** fetch;
- `?order=` accepted **only** when it is a **string** matching `/^\d+$/` whose `Number()` is a **positive safe integer** (`> 0` and `<= Number.MAX_SAFE_INTEGER`); **never `parseInt`** (it accepts `"123abc"`);
- anything else — **including a non-string** — lands in **C-13 Empty state**, **not an error and not a 404**;
- reads one order via `getMyOrder(orderCode)` under `orders_select_own`.

`pricing/checkout/{loading,error}.tsx` at **`size="small"`**, same origin pattern as plan Task 3.6.

**Neither new path is added to `PUBLIC_PATHS`** (both are private by default; AC-032 budget of exactly three public entries is untouched), **neither path contains a dot** (a dotted segment reaches neither the auth middleware nor the nonce-bearing CSP), and **no CSP change is made or authorised**.

## Target Files
- [ ] `SOURCE/app/(billing)/pricing/checkout/page.tsx`
- [ ] `SOURCE/app/(billing)/pricing/checkout/loading.tsx`
- [ ] `SOURCE/app/(billing)/pricing/checkout/error.tsx`

## Investigation Targets
- `SOURCE/app/(HM)/history/loading.tsx` and `SOURCE/app/(HM)/history/error.tsx` (the origin pattern; here at `size="small"`)
- `SOURCE/app/(billing)/me/orders/loading.tsx` and `error.tsx` (plan Task 3.6 — the sibling implementation to stay consistent with)
- `SOURCE/app/(billing)/queries.ts` (plan Task 3.5 — `getMyOrder(orderCode)`)
- `SOURCE/lib/supabase/middleware.ts` (`PUBLIC_PATHS` — **read only**; confirm this route is **not** added)
- `SOURCE/lib/security/csp.ts` (**frozen** — confirm no CSP change)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — verify default (`pending`) + loading + empty (no/unknown/foreign `?order=`, one shared state) + error + partial states)
- `docs/design/subscription-frontend-design.md` (§ Main Components)
- `docs/design/subscription-frontend-design.md` (§ FE-I9 / UI-D18)
- `docs/design/subscription-frontend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-frontend-design.md` (§ Security Considerations)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | The page passes the eight-field `CheckoutOrder` from `getMyOrder()` to C-13 without reshaping it |

## Boundary Context (from the plan Connection Map)

**Boundary — S-05 / `PurchaseCta` → S-06 (order identifier across a navigation).**
- Owners: `OrderRow.tsx`, `PurchaseCta.tsx` ↔ `SOURCE/app/(billing)/pricing/checkout/page.tsx`.
- **Serialized Format**: URL query string `?order={digits}` on `/pricing/checkout` — a decimal digit string, no grouping, no sign.
- **Consumer Parse Rule**: accept **only** a value that is a **string** matching `/^\d+$/` whose `Number()` is a positive safe integer (`> 0` and `<= Number.MAX_SAFE_INTEGER`). **Never `parseInt`** — it accepts `"123abc"`. Anything else ⇒ C-13 Empty state, **not an error and not a 404**.
- **Expected Signal**: navigation lands on `/pricing/checkout?order={the same orderCode createOrder() returned}` and S-06 renders that order transfer block.
- **Roundtrip check this task must satisfy**: the digit string the producer emits parses, under this rule, to the identical `orderCode` value — and every non-conforming input lands in the one shared Empty state.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the C-13 Empty/Partial **superset** reconciled in plan Task 0.6
- [ ] Write the failing **table-driven** parsing cases: `undefined`, `""`, `"abc"`, `"12a"`, `"-1"`, `"0"`, `["1","2"]`, `"9007199254740993"`, `"12345"` ⇒ **only the last is accepted**
### 2. Green Phase
- [ ] Implement the page and the two boundary files; run only the added tests
### 3. Refactor Phase
- [ ] Confirm the four Empty-state causes render **byte-identical output**

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- Manual browser pass at 360px + greyscale (plan Task 6.5) — golden states 11-24
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: table-driven unit tests over the parsing rule, plus render tests for the four Empty-state causes.
- **Success criteria**: only `"12345"` is accepted from the listed table; the **four Empty-state causes (no param / unparseable / unknown / foreign) are byte-identical in rendered output**; both boundary files at `size="small"`; no `PUBLIC_PATHS` entry added; no dot in either path; no CSP change.
- **Failure response**: if `parseInt` is used anywhere in the parse, replace it — it accepts `"123abc"` and would route a malformed identifier into a real fetch.
- **Verification level**: L1 for the route (a user reaches the checkout screen); L2 for the parsing table.

## Proof Obligations
- **Claim (invalid option / empty input)**: an absent, blank, unparseable or out-of-range identifier lands in **the shared Empty state**, not an error and not a 404.
- **Primary failure mode**: `parseInt` accepts `"123abc"`; or a non-string (`["1","2"]`) reaches `Number()` and coerces.
- **Boundary to exercise**: the page parameter parsing, driven by the literal table above.
- **State assertion**: N/A (no state change).
- **Mock boundary rationale**: `getMyOrder()` stubbed; the parsing logic is real.
- **Residual**: none for parsing.

- **Claim (no enumeration oracle)**: the four Empty-state causes are **byte-identical in rendered output on purpose**.
- **Primary failure mode**: distinguishing "not yours" from "not found" **confirms the existence of another user order**.
- **Boundary to exercise**: rendered output compared across the four causes.
- **State assertion**: N/A.
- **Mock boundary rationale**: `getMyOrder()` stubbed to return `null` for both unknown and foreign, matching what RLS produces.
- **Residual**: the RLS-level guarantee is proven by SVC-2 (plan Task 6.2).

## Completion Criteria
- [ ] All added tests pass, including the full parsing table
- [ ] The four Empty-state causes are byte-identical in rendered output
- [ ] Both boundary files at `size="small"`, matching the origin pattern
- [ ] **Neither path added to `PUBLIC_PATHS`; neither path contains a dot; no CSP change shipped**
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: the `/pricing/checkout` route; downstream, plan Tasks 4.3, 4.4, 4.6.
- Scope boundary: `SOURCE/lib/security/csp.ts` and `SOURCE/lib/supabase/middleware.ts` are **read only** in this task.

## Investigation Notes
(Record the parsing table results, the byte-identical Empty-state comparison, and the Compliance Check result here.)
