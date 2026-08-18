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
- [ ] `SOURCE/app/(billing)/pricing/checkout/_components/__tests__/PaymentConfirm.test.tsx` (new)

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
- [ ] Read all Investigation Targets and confirm `billing.terms.body` / `billing.refund.body` are absent from the shipped `en.ts`
- [ ] Write the **single combined test** and the second `aria-disabled` case; confirm each fails against a predicate wired to `isPaidTierEnabled()`
### 2. Green Phase
- [ ] Run both cases against the shipped implementation; green
### 3. Refactor Phase
- [ ] Confirm the two assertions were not split into separate tests

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
- [ ] The single combined test is green and contains **both** assertions
- [ ] The second case asserts `aria-disabled="true"`, `hasAttribute("disabled") === false`, Tab-reachability and a no-op activation
- [ ] The predicate is not derived from `isPaidTierEnabled()`
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: do not split the combined assertions; do not mock the dictionary or the legal pages.
