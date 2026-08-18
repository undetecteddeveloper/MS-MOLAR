# Task: Implement and run fixture-e2e FE-3 (re-check outcome on `/me/orders`)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.9**
Layer: **frontend** (`SOURCE/tests/e2e/fixture/**`)

Metadata:
- Dependencies: frontend-task-07 (C-10 + C-11), frontend-task-01 (the harness)
- Provides: fixture-e2e 2/3 cumulative
- Size: Small (1 test file)

## Implementation Content

Assert:
- an alert node **appears** — **absent before, present after**;
- its text **EQUALS** the fixed expected `billing.recheck.stillPending` sentence per locale;
- the badge still reads the "awaiting payment" word **unchanged**;
- **every entitlement-derived value in C-11 is byte-identical before and after** — "no wrong grant" is only proven by a **before/after comparison**;
- **focus is still on the activated control**;
- the stubbed action module records **exactly 1** invocation under **two synchronous activations**;
- the rate-limited sentence **EQUALS** the fixed expected `billing.recheck.rateLimited` string per locale **and is NOT EQUAL** to the generic error string **nor to any other outcome sentence in the same locale**.

**Test-case resolution for this phase: 2 fixture-e2e cases of 3 (FE-2, FE-3) cumulative.**

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-3 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-3** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (plan Task 0.7 — order fixtures and the counted `recheckOrder` stub)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (plan Task 3.7 — the control under test)
- `SOURCE/app/(billing)/me/orders/_components/PlanSummary.tsx` (plan Task 3.7 — C-11, whose values must be byte-identical before and after)
- `SOURCE/components/billing/OrderStatusBadge.tsx` (plan Task 2.3)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (the fixed expected sentences)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `RecheckOrderControl` — C-10 — verify default (idle) + loading (busy) + error + partial (terminal status) states and all seven rendered outcomes)
- `docs/design/subscription-frontend-design.md` (§ Decision 2 / UI-D16)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record FE-3 annotation block verbatim
- [ ] Capture the C-11 values **before** the activation, so the after-comparison is a real before/after
### 2. Green Phase
- [ ] Run the case; all assertions green
### 3. Refactor Phase
- [ ] Re-run to confirm determinism

## Quality Assurance Mechanisms
- Manual browser pass at 360px + greyscale (plan Task 6.5) — the load-bearing accessibility and layout check
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: fixture-e2e browser journey with the action module stubbed and counted.
- **Success criteria**: every assertion above green, in particular the **byte-identical** before/after comparison of every entitlement-derived value in C-11 and the **exactly 1** invocation under two synchronous activations.
- **Failure response**: if any C-11 value changes across a `not_paid_yet` re-check, **stop** — a re-check that alters entitlement display without a settlement is a wrong-grant signal.
- **Verification level**: L1.

## Proof Obligations
- **Claim**: a re-check that does not settle changes **nothing** about entitlement, and says so in its own words.
- **Primary failure mode**: asserting that the alert appeared without asserting that nothing was granted — "no wrong grant" is only proven by a before/after comparison, not by the absence of an error.
- **Boundary to exercise**: the rendered S-05 route with the action module stubbed.
- **State assertion**: alert node **absent before, present after**; every entitlement-derived C-11 value **byte-identical before and after**; badge word unchanged; `document.activeElement` still the activated control.
- **Mock boundary rationale**: only the action module is stubbed and counted; dictionary, components and route tree are real.
- **Residual**: whether the alert **survives the server re-render** in a real browser (R-1 / A5) is discharged by the manual pass (plan Task 6.5, item iii).

## Completion Criteria
- [ ] FE-3 green, all assertions including the before/after byte-identity and the single-invocation count
- [ ] The rate-limited sentence equals its fixed expected string and differs from every other outcome sentence in the same locale
- [ ] Test-case resolution: **fixture-e2e 2/3 (FE-2, FE-3)**
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: no product code change; do not introduce MSW.
