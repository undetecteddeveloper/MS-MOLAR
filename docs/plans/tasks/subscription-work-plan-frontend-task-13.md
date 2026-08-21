# Task: C-15 legal-gate unit test (displaced proof obligation)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.5**
Layer: **frontend** (component + page render test)

Metadata:
- Dependencies: frontend-task-11 (C-15 and the `legalContentReady` predicate)
- Provides: the R-9 guard — **the highest-consequence guess in the frontend design**
- Size: Small (1 test file)

## Implementation Content

**One test** asserting `legalContentReady === false` for the shipped dictionary **and, in the same test**, that `SOURCE/app/(billing)/terms/page.tsx` and `SOURCE/app/(billing)/refund-policy/page.tsx` still render `LegalContentPending`.

**Both assertions must live in the same test** so the predicate and the rendered pages **cannot drift apart silently**.

A **second case** builds `legalContentReady === false` in a `canPurchase === true` world, asserting:
- `aria-disabled="true"`,
- `hasAttribute("disabled") === false`,
- **Tab-reachability**,
- and a **no-op activation**.

**This is the highest-consequence guess in the frontend design (Risk R-9): if the predicate is wired to the release flag because both are false today, the legal gate vanishes the moment the flag is switched on.**

## Target Files
- [x] `SOURCE/app/(billing)/pricing/checkout/__tests__/PaymentConfirm.test.tsx` — **extended, not created.** The path written here at decomposition time (`_components/__tests__/…`) is not where the file landed: plan Task 4.3 (commit `7056168`) already shipped it one level up, alongside the route's other test files, with a header saying this task's combined case was left out on purpose. A second file at the planned path would have been a duplicate suite, so the two cases were appended to the shipped one.

## Investigation Targets
- `SOURCE/app/(billing)/pricing/checkout/_components/PaymentConfirm.tsx` (plan Task 4.3 — C-15 and how `legalContentReady` arrives as a prop)
- `SOURCE/app/(billing)/terms/page.tsx` and `SOURCE/app/(billing)/refund-policy/page.tsx` (the two pages the same test must render)
- `SOURCE/components/billing/LegalDocument.tsx` (`LegalContentPending`)
- `SOURCE/lib/i18n/dictionaries/en.ts` (whether `billing.terms.body` and `billing.refund.body` exist — the predicate source)
- `SOURCE/lib/billing/paidTier.ts` (**read only** — the flag the predicate must **not** be derived from)
- `docs/design/subscription-frontend-design.md` (§ C-15 / R-9)
- `docs/design/subscription-frontend-design.md` (§ Test Boundaries, C-15 row)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentConfirm` — C-15 — verify default + loading (delegated to C-10) + error + partial (legal gate closed ⇒ `aria-disabled="true"`, focusable, no-op activation) states)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-frontend-design.md` (§ Test Boundaries, C-15 row) | state-lifecycle-negative | One case asserting **`legalContentReady === false`** for the shipped dictionary **and, in the same test**, that `app/(billing)/terms/page.tsx` and `app/(billing)/refund-policy/page.tsx` still render `LegalContentPending` — so the predicate and the rendered legal pages cannot drift | A single test contains both assertions, and it fails if either the predicate or a page changes independently |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and confirm `billing.terms.body` / `billing.refund.body` are absent from the shipped `en.ts`
- [x] Write the **single combined test** and the second `aria-disabled` case; confirm each fails against a predicate wired to `isPaidTierEnabled()`
### 2. Green Phase
- [x] Run both cases against the shipped implementation; green
### 3. Refactor Phase
- [x] Confirm the two assertions were not split into separate tests

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: one test resolving the **real** dictionary and rendering **both real legal pages**; one further case for the closed-gate control behaviour.
- **Success criteria**: **the legal gate holds independently of the release flag (this single combined test green)**; the control is `aria-disabled="true"`, `hasAttribute("disabled") === false`, Tab-reachable, and activation is a no-op.
- **Failure response**: if the test can only pass by splitting the two assertions, **do not split them** — the combined form is the whole point.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: `legalContentReady` and the rendered legal pages agree, and neither depends on the release flag.
- **Primary failure mode**: the predicate is wired to the release flag because both are false today; **the legal gate then vanishes the moment the flag is switched on** — and a split test would keep passing while the pages and the predicate drift apart.
- **Boundary to exercise**: the C-15 component **and** both legal page renders, inside **one** test.
- **State assertion**: gate false ⇒ control `aria-disabled="true"`, focusable, activation performs no action and causes no navigation.
- **Mock boundary rationale**: none — the real dictionary and the real pages are used; mocking either would remove the drift protection.
- **Residual**: the legal **content** is TBD-02 / BU-1 and engineer-owned; this test proves the gate, not the content.

## Completion Criteria
- [x] The single combined test is green and contains **both** assertions
- [x] The second case asserts `aria-disabled="true"`, `hasAttribute("disabled") === false`, Tab-reachability and a no-op activation
- [x] The predicate is not derived from `isPaidTierEnabled()`
- [x] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Investigation Notes

### Investigation Targets, as read
- `checkout/_components/PaymentConfirm.tsx` — C-15 takes `{ orderCode, status, legalContentReady }`. `legalContentReady === true` ⇒ it returns `RecheckOrderControl` (C-10) with `variant="primary"` and nothing else. `false` ⇒ a `Button` with `aria-disabled="true"`, `aria-describedby` → a visible `<p>`, **no `onClick` at all** and **no native `disabled`**. The predicate is never computed here.
- `checkout/page.tsx` — the predicate's only home: `const LEGAL_BODY_KEYS = ["billing.terms.body", "billing.refund.body"] as const;` and `LEGAL_BODY_KEYS.every((key) => key in en)`, evaluated **inside the request handler** (not at module scope), passed down as a prop. C-15 is mounted only when `isPayable(order.status)` — i.e. `status === "pending"`.
- `terms/page.tsx` / `refund-policy/page.tsx` — async server components, both rendering `LegalContentPending` inside `LegalDocument`; the refund page additionally renders `billing.noAutoRenew` (AC-040), which is a product fact and not legal content.
- `components/billing/LegalDocument.tsx` — `LegalContentPending` renders one `role="status"` paragraph carrying the passed `message`.
- `lib/i18n/dictionaries/en.ts` — `billing.terms.body` / `billing.refund.body` **do not exist**; only `.title`, `.eyebrow`, `.pending` ship. Predicate is therefore `false` today.
- `lib/billing/paidTier.ts` — read only, unmodified. `isPaidTierEnabled()` reads `process.env.GEMINI_PAID_TIER_ENABLED` at call time, so a stubbed env is enough to build the `canPurchase === true` world.
- frontend DD § C-15 / R-9 / § Test Boundaries C-15 row, UI Spec § C-15 — read; the combined-case requirement and the second case's four assertions are transcribed verbatim into the test's comments.

### Reference Contracts — Compliance Check
| Row | Planned approach | Evaluation |
|---|---|---|
| frontend DD § Test Boundaries, C-15 row (state-lifecycle-negative) | ONE `it()` body reads the `legalContentReady` the **real** `checkout/page.tsx` passes to C-15 (via an unrendered-element walk, so the value is *read*, not re-derived) and asserts it `false`; the **same** body then renders the two **real** legal pages and asserts each still contains exactly one `LegalContentPending`. Nothing is mocked except the request-scoped edges (auth, order read, locale cookie, `server-only`). | **Y** — verified by mutation: keys added to `en.ts` while the pages keep the placeholder ⇒ red (`expected true to be false`); `/terms` shipping real content while the keys stay absent ⇒ red (`expected +0 to be 1`). Neither half can drift without the single test failing. |

### R-9 evidence (the reason this task exists)
Mutant `legalContentReady = isPaidTierEnabled()` planted in `checkout/page.tsx`: the **combined** case stayed green (both locks false — exactly the blind spot R-9 names), and the second case, which stubs `GEMINI_PAID_TIER_ENABLED=1`, failed at `expect(props.legalContentReady).toBe(false)` with `expected true to be false`. The two locks are proven independent.

### Residual — what these two cases still cannot see
A predicate hard-coded `false`, and `.every` swapped for `.some`, are **behaviourally equivalent to the shipped code today** (neither key exists, so every candidate returns `false`). They are caught only by the source-text case plan Task 4.3 left in this file, and the combined case turns red on them the day PRD U3's content lands. Closing them behaviourally would require perturbing the shipped dictionary, which this task's scope boundary forbids. One further mutant — the predicate wired to *look-alike* keys (`billing.terms.bodyText`) — survived every case in the file including 4.3's `toContain("billing.terms.body")`; a quote-anchored, comment-stripped assertion was **added** to 4.3's source-text case (nothing removed) and kills it.

## Notes
- Impact scope: test only.
- Scope boundary: do not split the combined assertions; do not mock the dictionary or the legal pages.
