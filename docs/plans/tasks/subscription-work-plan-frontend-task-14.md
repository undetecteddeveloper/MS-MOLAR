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
- [x] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-1 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-1** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (plan Task 0.7 — the order fixtures with and without `qrPayload`, and the counted `createOrder` stub)
- `SOURCE/features/billing/components/pricing/PurchaseCta.tsx` (plan Task 4.4)
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
- [x] Read all Investigation Targets and record FE-1 annotation block verbatim
- [x] Write items (a)…(g); confirm (a) fails if the links are present but rendered after the control, and (b) fails if the URL carries a different digit string
### 2. Green Phase
- [x] Run the case; all seven items green
### 3. Refactor Phase
- [x] Re-run at 360px and confirm the overflow measurement is deterministic

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
- [x] FE-1 green, all items (a)…(g)
- [x] Item (b) compares against the stub returned `orderCode`, not merely a well-formed digit string
- [x] Item (g) measured, not eyeballed
- [x] Test-case resolution: **fixture-e2e 3/3 — lane complete**
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: no product code change; do not introduce MSW; no live payOS connection.

## Investigation Notes (recorded during execution — plan Task 4.6)

**FE-1 annotation block** (`subscription.fixture.e2e.test.ts:169`) read in full and left byte-for-byte unchanged; the implementation was appended at the END of the file, after FE-3's, because it runs on FE-3's harness (`resolveServerTree()`, the counted action stubs, `state`) and those are `const`s declared there.

### What each Investigation Target contributed

- **`PurchaseCta.tsx` (Task 4.4)** — synchronous `busyRef` latch read BEFORE any `setState` and any `await`; `createOrder()` awaited; `router.push('/pricing/checkout?' + 'order=' + orderCode)` by RAW concatenation; the latch is deliberately NOT released after a success (the screen is leaving) and IS released by `fail()`. `onClick` returns early on `if (!canPurchase)`. Failure renders one `role="alert"` with no `aria-live`. All four refusal codes map onto EXISTING dictionary keys — `rate_limited` → `billing.recheck.rateLimited`, the same string FE-3 already pins, so FE-1 reuses FE-3's literal instead of duplicating it.
- **`checkout/page.tsx` (Task 4.2)** — `parseOrderCode()` is an accept-list: `typeof raw === "string"` → `/^\d+$/` → `Number.isSafeInteger(n) && n > 0`; never `parseInt`. An unparseable value short-circuits BEFORE `getMyOrder()`, so zero reads occur. Four causes (no param, unparseable, unknown code, someone else's order) share ONE Empty state, byte-identical by design. Composition on the payable branch: `PaymentPanel` → `LegalLinks` → `PaymentConfirm`, three siblings — that DOM order IS AC-039 on S-06.
- **`PaymentPanel.tsx` / `TransferDetails.tsx` / `VietQrCode.tsx` (Task 4.3)** — one gate, `isPayable(status) === (status === "pending")`, exported and reused by the route. C-14 builds the four pairs from ONE array in structure order and drops a blank field rather than rendering an empty `<dd>`. Amount: `formatVnd()` FIRST, `t()` after (UI-D13). C-12's `encodeQrMatrix()` returns `null` unconditionally today (ADR-0018/BU-2 open), so the QR is absent on EVERY fixture — recorded in the case, because "no QR node on the no-QR screen" is therefore not evidence of anything.
- **`PaymentConfirm.tsx` (Task 4.5)** — gate closed ⇒ a `Button` with `aria-disabled="true"`, NO `disabled`, NO `onClick`, and a VISIBLE reason bound by `aria-describedby={confirm-<code>-legal}`. Gate open ⇒ C-10 with `variant="primary"`, which renders the SAME label string. The label therefore cannot distinguish the two branches; `aria-describedby` can, and item (e) reads that.
- **`LegalLinks.tsx`** — one `<p>` with `/terms` then `/refund-policy`, shared by S-01 and S-06 so the constraint exists once.
- **`subscriptionFixtureData.ts` (Task 0.7)** — `createSubscriptionActionStubs()` exposes `createOrderCallCount` and `simulateCreateOrder()`, but a hold/release gate ONLY for `recheckOrder`. This task's Target Files do not include that module, so FE-1 does not edit its contract: the in-flight gate is local to the test file and WRAPS `simulateCreateOrder()`, so the count asserted on is still the fixture module's own counter. The recorded OP-1 inconsistency (`plan: "free"` with a 500 tutor limit) was left untouched.
- **`isPaidTierEnabled()`** — reads `process.env.GEMINI_PAID_TIER_ENABLED` per call under `force-dynamic`, so `canPurchase` is driven through the REAL gate by setting that variable, not by stubbing the module. A stubbed gate is a gate that cannot regress, and item (f) exists to hold it.
- **UI Spec C-03 / C-12 / C-14 / C-15** — states covered: C-03 default + creating (the in-flight window) + creation-failed + unavailable; C-14 default (four pairs, selectable) + the no-payload partial; C-12 empty (no encoder) — its default and error states are unreachable while ADR-0018 is open; C-15 partial (legal gate closed) — its default/loading/error states belong to C-10 and are FE-3's.

### Harness edits (all strictly additive)

`pushMock` added to the first `vi.hoisted` block and wired into the EXISTING `next/navigation` factory in place of a throwaway `push: vi.fn()`; `createOrder` appended to the existing `@/lib/billing/orderActions` factory; `getMyOrder` appended to the existing `@/features/billing/queries` factory. Appending rather than adding a second `vi.mock` for the same module id is load-bearing — a second factory REPLACES the first. Verified: the lane still ran 45/45 after the harness edits and before a single FE-1 case existed.

### Residuals recorded rather than dropped

1. **The router is a runtime substitution.** jsdom has no Next router, so the navigation is observed as the ARGUMENT to `router.push()` and that string is then fed to the REAL S-06 route, whose real accept-list decides what renders. The client-side navigation itself stays with the manual browser pass (plan Task 6.5).
2. **Item (g) is a stated width MODEL, not a paint.** jsdom lays nothing out (`scrollWidth`/`getBoundingClientRect()` are 0), so `driver.horizontalOverflowPx()` has no in-process equivalent. The case computes an upper-bound width for the longest UNBREAKABLE run in every text-bearing element against the width available at 360px, with its own positive control and a determinism re-measure, plus the structural `min-w-0` / `break-all` preconditions no character model can see. Measured limits: flex gaps are ignored and inline-joined text nodes are measured separately, both of which make the reading more permissive than a browser's.
3. **The accept-list's internals are not FE-1's.** A grouped code is rejected by the REGEX, but `Number("1,000")` is already `NaN`, so FE-1 cannot separate the regex from the `isSafeInteger` layer. That eight-row table is plan Task 4.2's unit test and is not duplicated here.
