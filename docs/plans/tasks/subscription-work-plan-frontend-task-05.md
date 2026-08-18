# Task: Implement and run fixture-e2e FE-2 (quota-exhausted journey)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.5**
Layer: **frontend** (`SOURCE/tests/e2e/fixture/**` rendering the real route tree)

Metadata:
- Dependencies: frontend-task-01 (the harness), frontend-task-02 (provider mounts), frontend-task-04 (the mount)
- Provides: the discharge of AC-042 that no unit test can give; also the **positive half of AC-041** that plan Task 5.3 must not move
- Size: Small (1 test file)

## Implementation Content

Fill `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` case **FE-2** against the harness from plan Task 0.7.

**Render the real route tree and let the provider come from where production puts it — do not wrap the unit in a provider.**

Assert:
- (a) a `<p>` carrying **both** the remaining count and the reset date beside **both** call sites;
- (b) the rendered date **equals** the pinned-timezone formatting of the fixture `resetsAt` — **one day off is a failure, not a rounding difference**;
- (c) **no prop is passed at the mount site** — output unchanged when invoked with no props;
- (d) `unknown` ⇒ the note renders **nothing** and the page still renders, with **no `0` and no `—`** in place of the counters;
- (e) the exhausted-state string is **NOT EQUAL** to the resolved `t("tutor.error")` value in the **same locale** — an inequality against the **actual dictionary value**, not a substring heuristic, so it survives a copy change;
- (f) the upgrade link navigates to `/pricing`;
- (g) every interactive element is **Tab-reachable**, **none carrying native `disabled`**, each with a **visible focus ring**.

**Test-case resolution for this phase: 1 fixture-e2e case of 3 (FE-2).**

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-2 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-2** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (plan Task 0.7 — entitlement fixtures `known` / `unknown` / exhausted)
- `SOURCE/components/billing/TutorQuotaNote.tsx` (plan Task 2.4 — the implemented component)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:177`, `:230` — the two mounts)
- `SOURCE/app/(layer2)/layout.tsx` (plan Task 2.2 — the provider mount the real route tree supplies)
- `SOURCE/components/tutor/ExplainStepAffordance.tsx` (**read only** — its blocked-quota branch becomes reachable here)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (`tutor.error` — the resolved value item (e) compares against)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TutorQuotaNote` — C-06 — verify default (`known`) + empty (`unknown` ⇒ `null`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `ExplainStepAffordance` (modified) — C-05 — verify default (idle) + loading (busy) + error + partial (hint-shown) + blocked-quota states)
- `docs/design/subscription-frontend-design.md` (§ Verification Strategy row 7 / FE-I8)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record FE-2 annotation block verbatim
- [ ] Write items (a)…(g) and confirm each fails against a deliberately removed provider mount
### 2. Green Phase
- [ ] Run the case against the real route tree; all seven items green
### 3. Refactor Phase
- [ ] Re-run to confirm determinism (fixed fixture `resetsAt`, fixed locale)

## Quality Assurance Mechanisms
- Manual browser pass at 360px + greyscale (`npm run pw` + a real mid-range Android) — **the load-bearing accessibility and layout check** — Config: `SOURCE/package.json:14`, `SOURCE/scripts/pw/cli.mjs` (executed in plan Task 6.5; FE-2 covers the automatable subset)
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: fixture-e2e browser journey against the **real route tree**, with only the action modules stubbed.
- **Success criteria**: all seven items (a)…(g) green.
- **Failure response**: if the rendered date is one day off, **stop** — the `timeZone` pin is missing or a legacy formatter was used. If the note renders `null` for a `known` quota, **stop** — the provider mount is wrong, and every downstream test would pass while the screen lied.
- **Verification level**: L1 (a real user journey through the real route tree).

## Proof Obligations
- **Claim (AC-042)**: the UI-D17 mount **actually renders**.
- **Primary failure mode**: a provider-wrapped unit test supplies the very thing production would be missing, so a permanently-`null` mount ships green.
- **Boundary to exercise**: the **real route tree** — layouts, provider and page as production composes them.
- **State assertion**: `known` fixture ⇒ a `<p>` beside **both** call sites with the count and the date; `unknown` fixture ⇒ nothing rendered, and the page still renders with **no `0` and no `—`**.
- **Mock boundary rationale**: only the action modules are stubbed; the provider and route tree stay real — that is the point of this lane.
- **Residual**: FE-AC-26 also requires the manual pass (plan Task 6.5, item iv) against a real signed-in user.

- **Claim (AC-041, positive half)**: the exhausted state is distinguishable from a generic failure **before** the press.
- **Primary failure mode**: a substring heuristic passes while the two strings are in fact the same copy; or the distinction is moved to a post-failure error code, reopening the disclosure surface UI-D3 closed.
- **Boundary to exercise**: rendered text compared against the **resolved dictionary value** in the same locale.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — real dictionary values are resolved.
- **Residual**: the error-path half of AC-041 is backend-owned (plan Task 5.3) and lives only in telemetry.

## Completion Criteria
- [ ] FE-2 passes against the **real route tree**, all items (a)…(g)
- [ ] Item (e) is an inequality against the resolved `t("tutor.error")` value, not a substring heuristic
- [ ] Item (c) asserts the mount passes **no** prop
- [ ] Test-case resolution: **fixture-e2e 1/3 (FE-2)**
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: do not wrap the unit in a provider; do not introduce MSW.
