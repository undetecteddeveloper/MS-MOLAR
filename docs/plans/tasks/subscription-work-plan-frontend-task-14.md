# Task: Implement and run fixture-e2e FE-1 (purchase journey `/pricing` → `/pricing/checkout`)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.6**
Layer: **frontend** (`SOURCE/tests/e2e/fixture/**`)

Metadata:
- Dependencies: frontend-task-12 (`PurchaseCta` wiring), frontend-task-11 (S-06 components), frontend-task-01 (the harness)
- Provides: **fixture-e2e lane complete (3/3)**
- Size: Small (1 test file)

## Implementation Content

Assert:
- **(a)** both legal links present **and both preceding** the purchase control in **document order** — AC-039 is an **order claim, not a presence claim**;
- **(b)** activating with a stubbed `createOrder()` resolving `{orderCode}` puts the URL at `/pricing/checkout?order={that same orderCode}` — **the same value, not merely a well-formed one**;
- **(c)** all four `<dl>` pairs render with the fixture **exact** values and a **thousands-separated** amount;
- **(d)** with `qrPayload` **absent**, **all four pairs still render and the screen stays completable**;
- **(e)** `legalContentReady === false` ⇒ `aria-disabled="true"`, `hasAttribute("disabled")` **false**, **Tab-reachable**, activation performs **no action and causes no navigation**;
- **(f)** with `canPurchase === false`, activation causes **no navigation** and a readable reason renders;
- **(g)** **zero horizontal overflow at 360px** with a bigint `orderCode` beside an amount and a badge — **measured, not eyeballed**.

**Test-case resolution for this phase: 3 fixture-e2e cases of 3 (FE-1, FE-2, FE-3) — lane complete.**

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-1 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-1** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (plan Task 0.7 — the order fixtures with and without `qrPayload`, and the counted `createOrder` stub)
- `SOURCE/app/(billing)/pricing/_components/PurchaseCta.tsx` (plan Task 4.4)
- `SOURCE/app/(billing)/pricing/checkout/page.tsx` and its `_components/` (plan Tasks 4.2, 4.3)
- `SOURCE/components/billing/LegalLinks.tsx` (the links whose **document order** item (a) asserts)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PurchaseCta` — C-03 — verify default + loading (creating) + error (creation failed / rate-limited) + partial (unavailable) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TransferDetails` — C-14 — verify default (four `<dl>` pairs, all selectable) + partial states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `VietQrCode` — C-12 — verify default + empty (no payload / no encoder) + error states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentConfirm` — C-15 — verify default + loading + error + partial (legal gate closed) states)

## Boundary Context (from the plan Connection Map)

**Boundary — S-05 / `PurchaseCta` → S-06 (order identifier across a navigation).**
- **Serialized Format**: `?order={digits}` — a decimal digit string, no grouping, no sign.
- **Consumer Parse Rule**: only a string matching `/^\d+$/` whose `Number()` is a positive safe integer; **never `parseInt`**.
- **Expected Signal**: navigation lands on `/pricing/checkout?order={the same orderCode createOrder() returned}` and S-06 renders that order transfer block.
- **Roundtrip check FE-1 asserts**: item (b) compares the URL value against **the stub return value**, so a well-formed but different identifier fails.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record FE-1 annotation block verbatim
- [ ] Write items (a)…(g); confirm (a) fails if the links are present but rendered after the control, and (b) fails if the URL carries a different digit string
### 2. Green Phase
- [ ] Run the case; all seven items green
### 3. Refactor Phase
- [ ] Re-run at 360px and confirm the overflow measurement is deterministic

## Quality Assurance Mechanisms
- Manual browser pass at 360px + greyscale (plan Task 6.5) — the load-bearing accessibility and layout check
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: fixture-e2e browser journey across both screens, with only the action modules stubbed.
- **Success criteria**: all items (a)…(g) green; **fixture-e2e lane 3/3 resolved**.
- **Failure response**: if (d) fails, the transfer block is coupled to the QR — decouple it; the screen must remain payable from text, which is what AC-028 requires and what makes ADR-0018 (BU-2) non-blocking.
- **Verification level**: L1.

## Proof Obligations
- **Claim (AC-039)**: both legal links precede the purchase control **in document order**.
- **Primary failure mode**: a presence assertion passes while the links render after the control, so a user can purchase before the terms are visible.
- **Boundary to exercise**: the rendered DOM order of the `/pricing` screen.
- **State assertion**: N/A.
- **Mock boundary rationale**: none for layout.
- **Residual**: greyscale/screen-reader confirmation is the manual pass.

- **Claim**: the navigation carries the **same** order identifier the action produced.
- **Primary failure mode**: asserting the URL is well-formed rather than that it carries the same value — a mismatch would land the user on someone else Empty state.
- **Boundary to exercise**: the URL after activation, compared against the stub return value.
- **State assertion**: URL before → activation → URL after equals `/pricing/checkout?order={stub orderCode}`.
- **Mock boundary rationale**: `createOrder()` stubbed with a known `orderCode`; routing is real.
- **Residual**: the server-side identity between `createOrder()` and `getMyOrder()` is proven by INT-2 (plan Task 3.5).

- **Claim (unavailable boundary)**: with `qrPayload` absent the screen **stays completable**.
- **Primary failure mode**: the four `<dl>` pairs are hidden along with the QR, leaving nothing to pay from.
- **Boundary to exercise**: S-06 rendered with a `pending` fixture that has no `qrPayload`.
- **State assertion**: N/A.
- **Mock boundary rationale**: fixture-driven.
- **Residual**: none.

## Completion Criteria
- [ ] FE-1 green, all items (a)…(g)
- [ ] Item (b) compares against the stub returned `orderCode`, not merely a well-formed digit string
- [ ] Item (g) measured, not eyeballed
- [ ] Test-case resolution: **fixture-e2e 3/3 — lane complete**
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: no product code change; do not introduce MSW; no live payOS connection.
