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
- [x] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-3 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-3** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (plan Task 0.7 — order fixtures and the counted `recheckOrder` stub)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (plan Task 3.7 — the control under test)
- `SOURCE/features/billing/components/orders/PlanSummary.tsx` (plan Task 3.7 — C-11, whose values must be byte-identical before and after)
- `SOURCE/components/billing/OrderStatusBadge.tsx` (plan Task 2.3)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (the fixed expected sentences)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `RecheckOrderControl` — C-10 — verify default (idle) + loading (busy) + error + partial (terminal status) states and all seven rendered outcomes)
- `docs/design/subscription-frontend-design.md` (§ Decision 2 / UI-D16)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record FE-3 annotation block verbatim
- [x] Capture the C-11 values **before** the activation, so the after-comparison is a real before/after
### 2. Green Phase
- [x] Run the case; all assertions green
### 3. Refactor Phase
- [x] Re-run to confirm determinism

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
- **Mock boundary rationale**: the dictionaries, the components and the route composition are real; **six module doubles** reach the rendered S-05 tree, not one — `@/lib/billing/orderActions` (the sanctioned boundary, counted), `@/features/billing/queries` (`listMyOrders`), `@/lib/auth/getCurrentUser`, `@/lib/billing/readEntitlement`, `next/navigation` (`usePathname` / `useSearchParams` / `redirect` / `useRouter().refresh`, the last of which is a **counted** stub because it is a real seam under C-10's handler) and `@/components/shared/SkipLink` (stubbed to `null`; async Server Component). The list is kept in the test file's mock-boundary paragraph, which is the copy that must stay in step with the code.
- **Residual**: whether the alert **survives the server re-render** in a real browser (R-1 / A5) is discharged by the manual pass (plan Task 6.5, item iii).

## Completion Criteria
- [x] FE-3 green, all assertions including the before/after byte-identity and the single-invocation count
- [x] The rate-limited sentence equals its fixed expected string and differs from every other outcome sentence in the same locale
- [x] Test-case resolution: **fixture-e2e 2/3 (FE-2, FE-3)**
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: no product code change; do not introduce MSW.

## Investigation Notes

Recorded while executing (plan Task 3.9). Every item below was read in full before FE-3 was written.

- **FE-3 annotation block** (`subscription.fixture.e2e.test.ts:1034-1117`) — the specification. Seven verification points (a)-(g); mock boundary = the ACTION MODULE only; the copy must come from the real dictionaries because the copy is the thing under test; (b) and (g) demand string EQUALITY against a literal written in the test; (f) is an invocation COUNT under two synchronous activations.
- **`subscriptionFixtureData.ts`** — `FIXTURE_ORDER_ROWS` is six rows (two `pending`, `paid`, `expired`, `cancelled`, `refunded`), so the rendered page carries three terminal and three active controls at once. `createSubscriptionActionStubs()` counts invocations BEFORE awaiting the hold, so `holdNextRecheck()`/`releaseHeldRecheck()` create the in-flight window (f) and the busy half of (e) need. The OP-1 drift (`plan: "free"` with a tutor limit of 500) is deliberate and was NOT touched; FE-3's C-11 literals are derived from those same numbers (488/500, 4/5).
- **`RecheckOrderControl.tsx` (C-10)** — handler order is correctness: `if (terminal) return;` then `if (busyRef.current) return;` before any `setState` and before any `await`. Outcome renders as a node that APPEARS with `role="alert"` and no `aria-live`. `TERMINAL_STATUSES` is a three-element Set, not `status !== "pending"`, so `refunded` stays active (FE-AC-10). Native `disabled` never appears; `aria-disabled` is the string "true"/"false", `aria-busy` a boolean. The terminal reason reuses `billing.recheck.notPending`.
- **`PlanSummary.tsx` (C-11)** — one `<dl>`, four `<dt>/<dd>` pairs, rendered only when BOTH quotas are `known`; `remaining = max(0, limit - used)`. It is a client component reading `useEntitlement()`, whose provider is mounted by `(billing)/layout.tsx` — which is why FE-3 renders the real layout chain instead of supplying a provider of its own.
- **`OrderStatusBadge.tsx` (C-09)** — pill = `aria-hidden` glyph + word; the word is the accessible name, so (c) reads it by subtracting the glyph (the shipped `RecheckOrderControl.test.tsx` idiom).
- **`page.tsx` / `OrderList` / `OrderRow`** — C-11 sits between `PageHeader` and C-07; C-10 is mounted once per row with `variant="row"` and the row's own `status`. C-07 and C-08 are ASYNC server components, so React 19's client renderer cannot render the page directly (it suspends and returns an empty tree). FE-3 therefore resolves async server components by awaiting them (`resolveServerTree`) and renders the resulting client tree through `@testing-library/react`; the composition itself is never rebuilt by the test.
- **Dictionaries** — the four sentences FE-3 pins (`billing.recheck.stillPending`, `billing.recheck.rateLimited`, `billing.recheck.notPending`, `billing.status.pending`) are hand-copied as literals; the inequality set in (g) is resolved at runtime from `createTranslate(getDictionary(locale))` so a copy edit keeps the inequality meaningful.
- **Harness change shared with FE-2**: `getCurrentUser` was appended to the existing `@/lib/auth/getCurrentUser` mock factory (a factory replaces the whole module and S-05's login gate reads that name). Two new boundaries were opened: `listMyOrders()` (data source) and `recheckOrder()` (the sanctioned action-module boundary, routed into the counted stub). FE-2's 23 cases were unaffected — 23 -> 44 with 0 regressions.

**Result** (first pass): `npm run test:fixture` 44 passed (23 FE-2 + 21 FE-3), `npx tsc --noEmit` exit 0, `npm run lint` clean, `npm test` 1283 passed / 10 skipped. 17 mutants applied to an in-memory copy of the product code and restored; every one of **those 17** was killed by at least one FE-3 case — but the set did not reach two live nodes, recorded below.

### Review pass — two mutants that SURVIVED the first 17, and what closed them

The 17 were chosen, not exhaustive; `integration-test-reviewer` measured two more and both lived. Recorded here with their measured result so the next reader does not re-derive them.

1. **`router.refresh()` could be deleted** — `components/billing/RecheckOrderControl.tsx:173`, `router.refresh();` → `void router;` ⇒ `npm run test:fixture` **44 passed, exit 0**. It is step 5 of C-10's handler and the ONLY mechanism by which the badge, the row and C-11 catch up with an outcome; deleted, a user who re-checks a paid order reads "Paid — your Premium period runs to …" above a badge still saying "Awaiting payment" and a C-11 still saying "Free", until a manual reload — the divergence UI-D16 exists to prevent. Root cause: the shared FE-2 harness replaced `useRouter()` with a throwaway `vi.fn()` for `refresh`, and the FE-3 mock-boundary paragraph claimed everything but `usePathname` was real. **Closed** by hoisting a counted `refreshMock` (named `router.refresh`), resetting it per render and asserting `toHaveBeenCalledTimes(1)` in (d). Re-measured: the same mutant now fails 2 cases — `expected "router.refresh" to be called 1 times, but got 0 times`.
2. **C-10's busy sentence was never pinned** — `RecheckOrderControl.tsx:225`, `t("billing.recheck.busy")` → `t("billing.recheck.amountMismatch")` ⇒ `npm run test:fixture` **44 passed, exit 0**. The screen-reader user would hear a manufactured payment failure ("a person has to settle this one") while the call is still in flight — the AC-036 vocabulary regression, one dictionary key over. Root cause: (e) asserted only `reasonFor(...).length > 0`; it was the one rendered C-10 string FE-3 never compared to a literal. **Closed** by a hand-typed `BUSY` literal per locale (trailing character U+2026, verified byte-for-byte against `lib/i18n/dictionaries/{en,vi}.ts`), added to the distinctness precondition and asserted with `toBe`. Re-measured: the mutant now fails with `expected 'The amount received does not match th…' to be 'Checking with the payment provider…'`.

Two further review findings, both recorded rather than "fixed":

3. **(c)/(d)'s before/after comparison is inert in this harness** — `expect(after.badge).toBe(before.badge)` and the four-value `summary` comparison cannot fail for any single-file product mutant: `EntitlementContext` holds a static value handed down by an async server layout and read via `use(context)`, there is no shared store between C-10 and its siblings, and the one path that would legitimately move those values is the mocked `router.refresh()`. **Not deleted** — it guards a future shape (an optimistic local patch, a client-side entitlement store) — but a comment at the comparison now says so, and names where the real discriminating power lives: the literal pins (badge word, the two non-degeneracy `SUMMARY_*` comparisons) and the whole-page subtraction identity, plus the new `refreshMock` count, which is what restores meaning to the after-half.
4. **The clock was not pinned, while `subscriptionFixtureData.ts:103-113` said it was** (via `driver.clock.setFixedTime` — true of the browser-driver harness, absent from this in-process lane). `OrderRow.isWindowStillOpen` therefore read the real `Date.now()`, `FIXTURE_PENDING_UNTIL_FUTURE` was already past, and S-05 rendered without the "continue paying" link the fixture was built to produce; nothing was red, but `before.html`/`after.html` are whole-page strings and any future assertion on them would have been wall-clock dependent. **Pinned**, since FE-2's 23 cases pass unchanged with it: `vi.useFakeTimers({ toFake: ["Date"], now: new Date(FIXTURE_NOW) })` in `renderOrdersRoute` (only `Date` is faked, so React's scheduler keeps a real `setTimeout`) with `vi.useRealTimers()` in `afterEach`. One precondition case was added to make the pin load-bearing — without it the pin can be deleted and nothing goes red.

**Result** (review pass): `npm run test:fixture` **45 passed, exit 0** (23 FE-2 + 22 FE-3), `npx tsc --noEmit` exit 0, `npm run lint` clean, `npm test` 1283 passed / 10 skipped, `npm run test:localdb` exit 1 "No test suite found in file" (deliberate). No product file was changed: both mutants were applied to a copy and the file restored byte-identically (sha256 `7519d12d…`).
