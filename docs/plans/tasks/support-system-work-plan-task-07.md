# Task 07: Fixture-e2e Harness Setup — Widget-Visibility + Ticket-Submission Prerequisite (Work Plan Phase 2, Task 2.0)

Metadata:
- Dependencies: none
- Provides: `SOURCE/tests/e2e/fixture/` fixture data + override boundary for `submitSupportTicket`/`getCurrentUser` (consumed by task-10 / `support-widget-visibility.fixture.e2e.test.ts` and task-11 / `support-ticket-submission.fixture.e2e.test.ts`)
- Size: Small (1-2 files)

Certainty: low (Reason: this repo has no existing request/route-mocking layer — no MSW, no test-mode query override; both sibling fixture-e2e skeletons for this feature explicitly state "Wiring that override boundary into a real running page is a residual for whoever stands up the Playwright harness, per the same precedent `rating.fixture.e2e.test.ts` and `history.fixture.e2e.test.ts` already recorded for their own fixture-backend gaps" — so there is no working in-repo example of this interception actually wired end-to-end for a Server-Action-shaped boundary).
Exploratory implementation: true.
Fallback: if investigation shows no feasible way to intercept `submitSupportTicket`/`getCurrentUser` as called by real Server Components/Client Components without modifying those modules' own call sites (out of this task's scope — those belong to task-09, not yet built when this task runs), fall back to a **module-boundary override** consistent with the frontend DD's own stated Mock Boundary Decision ("submitSupportTicket ... Yes (module boundary)") — e.g. a test-only module alias/dependency-injection point task-09 is asked to honor when it is built. Record the exact mechanism chosen in Investigation Notes; if neither is feasible within this task's Target Files, document the specific blocker and escalate rather than silently narrowing task-10/task-11's later scope.

## Implementation Content

Build fixture data + a mock/override boundary for `submitSupportTicket`/`getCurrentUser` (success-with-`shortRef` profile, each documented refusal-code profile — `invalid`/`unauthenticated`/`rate_limited`/`screenshot_rejected`/`server`, a deliberately-delayed/never-resolving promise for the timeout branch, a null-user profile), confirming the `SupportDriver` structural-subset-of-Playwright's-`Page`/`Locator`-API pattern this repo's `rating.fixture.e2e.test.ts`/`history.fixture.e2e.test.ts` already establish. `@category: e2e-setup` `@lane: fixture-e2e`. Placed here rather than in Phase 0 because Phase 0 is reserved for the unrelated, explicitly-named DB-schema blocking prerequisite; this satisfies the "before any [relevant] implementation task" placement rule scoped to the frontend phase where fixture-e2e first applies.

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (new — fixture profiles + documented override-boundary mechanism; naming decision recorded in Investigation Notes)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (driver interface pattern, fixture-data style, and its own explicit "residual, out of Target Files" admission for the same wiring gap)
- `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts`, `SOURCE/tests/e2e/fixture/historyFixtureData.ts` (a second, more recent precedent for this exact repo's fixture-data + override-boundary convention)
- `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` (the skeleton this fixture data must support for Obligations A/B/C — read the full obligations list to know exactly which profiles/shapes are required)
- `SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts` (the skeleton this fixture data must support for the reserved-slot journey — success/refusal/timeout profiles)
- `docs/design/support-system-frontend-design.md` (§ Mock Boundary Decisions — `submitSupportTicket`/`getCurrentUser` "Yes (module boundary)"; § Data Contracts — `SubmitTicketResult`/`ClientSubmitError` exact field shapes the fixture profiles must match)

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular: does `rating.fixture.e2e.test.ts`/`history.fixture.e2e.test.ts` demonstrate any actual live-wired interception, or only an unresolved residual? (Expected finding, per both sibling skeletons' own header notes: only the latter.)
- [ ] Decide and record the override-boundary mechanism (see Certainty/Fallback above) in Investigation Notes before writing any fixture data.
- [ ] Author the fixture profiles (success-with-`shortRef`, each documented refusal code, delayed/never-resolving timeout profile, null-user profile) matching `SubmitTicketResult`/`ClientSubmitError`'s exact field shapes.
- [ ] Write a minimal Node/vitest import-check that fails until the fixture module exists and exports typed, structurally-valid profiles.

### 2. Green Phase
- [ ] Add the fixture-data module with all profiles + the decided override-boundary mechanism.
- [ ] Confirm the import-check passes.

### 3. Refactor Phase
- [ ] Clean up naming/typing; ensure profiles are easily importable by task-10/task-11's driver scripts without further shape changes.

## Quality Assurance Mechanisms
- ESLint / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs`

## Operation Verification Methods
- **Verification method**: import the fixture module from a throwaway script/test and confirm each profile is structurally valid against `SubmitTicketResult`/`ClientSubmitError`/`getCurrentUser()`'s return shapes; separately, open a throwaway Playwright MCP session against `npm run dev` and attempt to exercise the chosen override-boundary mechanism once.
- **Success criteria**: fixture profiles import cleanly with no type errors; the throwaway MCP session either (a) successfully observes the override taking effect on a real page load, or (b) if a fallback module-boundary mechanism was chosen instead, a documented wiring point exists that task-09 can honor when it is built.
- **Failure response**: if neither the override mechanism nor a documented module-boundary fallback can be made to work within this task's Target Files scope, document the specific blocker in Investigation Notes and escalate — do not silently narrow task-10/task-11's later scope without a recorded reason.
- **Verification level**: L3 (fixture module builds/type-checks cleanly) as the floor; L1 (a real `npm run dev` page load reflects fixture data) as the target.

## Completion Criteria
- [ ] Fixture profiles + override boundary exist and are importable
- [ ] No lint/type errors
- [ ] Confirmed loadable by a throwaway Playwright MCP session against `npm run dev` with the override boundary intercepting `submitSupportTicket`/`getCurrentUser` — or, if infeasible without out-of-scope file changes, the blocker is explicitly recorded in Investigation Notes for task-09/task-10/task-11 to resolve

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/` only — this task must not modify `SOURCE/components/support/**` or any production Server Action (those don't fully exist yet at this point in the dependency graph beyond task-06's `submitSupportTicket`, which is out of this task's Target Files).
- Scope boundary: do not implement `SupportWidget`/`SupportWidgetDialog` here — that is task-09's responsibility. This task only prepares data/harness that later tasks (task-10, task-11) will consume.
