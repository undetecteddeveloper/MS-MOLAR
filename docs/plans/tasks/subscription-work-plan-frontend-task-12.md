# Task: Wire `PurchaseCta` handler (`:37-39`) to `createOrder()` + navigation

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.4**
Layer: **frontend** (`SOURCE/app/(billing)/pricing/_components/PurchaseCta.tsx`)

Metadata:
- Dependencies: frontend-task-10 (the S-06 route the navigation lands on), backend-task-18 (`createOrder()`)
- Provides: the purchase entry point FE-1 (plan Task 4.6) exercises
- Size: Small (1 file + test)

## Implementation Content

The empty branch at `:37-39` gains:
- a **synchronous `busyRef` early-return**;
- `await createOrder()`;
- **no optimistic navigation** — the route is **not entered until an `orderCode` exists**, because arriving there by optimism would make a successful click **indistinguishable from a failed one**.

On failure, the button returns to activatable and a `role="alert"` paragraph **appears** with a **specific sentence**; the **rate-limited case reads distinctly from the generic failure string**.

**The prop, the `aria-disabled` string at `:29`, the `!canPurchase` early return at `:36` and the `reasonId` binding at `:32` are untouched.**

## Target Files
- [ ] `SOURCE/app/(billing)/pricing/_components/PurchaseCta.tsx` (handler body only)
- [ ] `SOURCE/app/(billing)/pricing/_components/__tests__/PurchaseCta.test.tsx` (added cases)

## Investigation Targets
- `SOURCE/app/(billing)/pricing/_components/PurchaseCta.tsx` (`:29` the `aria-disabled` string, `:32` the `reasonId` binding, `:36` the `!canPurchase` early return, `:37-39` the empty handler branch — **only the branch body changes**)
- `SOURCE/lib/billing/orderActions.ts` (plan Task 3.4 — `createOrder()` return shape)
- `SOURCE/app/(billing)/pricing/checkout/page.tsx` (plan Task 4.2 — the `?order=` consumer this navigation must satisfy)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (plan Task 3.7 — the `busyRef` + `role="alert"` idioms to mirror)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (the failure and rate-limited sentences)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PurchaseCta` — C-03 — verify default + loading (creating) + error (creation failed / rate-limited) + partial (unavailable) states)
- `docs/design/subscription-frontend-design.md` (§ FE-I3 / `code:25`)

## Boundary Context (from the plan Connection Map)

**Boundary — S-05 / `PurchaseCta` → S-06 (order identifier across a navigation).**
- Owners: `SOURCE/app/(billing)/me/orders/_components/OrderRow.tsx`, `SOURCE/app/(billing)/pricing/_components/PurchaseCta.tsx` ↔ `SOURCE/app/(billing)/pricing/checkout/page.tsx`.
- **Serialized Format**: URL query string `?order={digits}` on `/pricing/checkout` — a decimal digit string, no grouping, no sign.
- **Consumer Parse Rule**: accept **only** a string matching `/^\d+$/` whose `Number()` is a positive safe integer. **Never `parseInt`.** Anything else ⇒ C-13 Empty state.
- **Expected Signal**: navigation lands on `/pricing/checkout?order={the same orderCode createOrder() returned}` and S-06 renders that order transfer block.
- **Roundtrip check this task must satisfy**: the value this handler serialises into the query string is **the same value** `createOrder()` returned — asserted as an equality against that value, **not** merely as a well-formed digit string.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record which lines are **untouched** (`:29`, `:32`, `:36`)
- [ ] Write failing tests: two synchronous activations ⇒ **exactly one** `createOrder()` invocation; a failed create ⇒ **no navigation**, button activatable again, a `role="alert"` paragraph appears with a specific sentence; the rate-limited sentence differs from the generic failure sentence
### 2. Green Phase
- [ ] Fill the handler branch; run only the added tests
### 3. Refactor Phase
- [ ] Diff the file and confirm `:29`, `:32` and `:36` are unchanged

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Config: `SOURCE/package.json:7`
- `npx tsc --noEmit`, `npm run lint` (project-wide)
- Manual browser pass at 360px + greyscale (plan Task 6.5)

## Operation Verification Methods
- **Verification method**: component tests with `createOrder()` stubbed and counted, plus FE-1 (plan Task 4.6) for the real navigation.
- **Success criteria**: exactly one invocation under two synchronous activations; on success the URL carries **the same `orderCode` the stub returned**; on failure **no navigation** occurs and a specific `role="alert"` sentence appears; `:29`, `:32`, `:36` unchanged.
- **Failure response**: if navigation happens before an `orderCode` exists, remove the optimism — a successful click must be distinguishable from a failed one.
- **Verification level**: L2 here; L1 via FE-1.

## Proof Obligations
- **Claim**: a purchase click either produces a real order and navigates to it, or fails visibly without navigating.
- **Primary failure mode**: optimistic navigation makes a failed create look identical to a successful one; or a double click creates two orders.
- **Boundary to exercise**: the component handler with the action module stubbed and counted.
- **State assertion**: two synchronous activations ⇒ invocation count **exactly 1**; failure ⇒ navigation count **0** and the alert node **absent before, present after**.
- **Mock boundary rationale**: only the action module is stubbed; the component and the dictionary are real.
- **Residual**: the `?order=` value identity across the real navigation is asserted in FE-1 item (b).

## Completion Criteria
- [ ] All added tests pass
- [ ] Exactly one `createOrder()` invocation under two synchronous activations
- [ ] No optimistic navigation; failure renders a specific `role="alert"` sentence and the button becomes activatable again
- [ ] The rate-limited case reads distinctly from the generic failure string
- [ ] `:29`, `:32` and `:36` untouched
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `PurchaseCta` handler branch only.
- Scope boundary: the prop, the `aria-disabled` string, the `!canPurchase` early return and the `reasonId` binding are untouched.
