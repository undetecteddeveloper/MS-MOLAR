# Task 12: Fixture-e2e Harness Setup — Admin-Triage Prerequisite (Work Plan Phase 3, Task 3.0)

Metadata:
- Dependencies: none (independent of task-07, can start in parallel once Phase 2 begins)
- Provides: fixture data + override boundary for `listSupportTickets`/`changeTicketStatusAction`/`addTicketNoteAction` (consumed by task-15 / `support-admin-triage.fixture.e2e.test.ts`)
- Size: Small (1 file)

## Implementation Content

Build fixture data + a mock/override boundary for `listSupportTickets`/`changeTicketStatusAction`/`addTicketNoteAction` (a multi-status ticket set including one with `notify_failed: true`, a status-change success response, a note-add success response), reusing task-07's `SupportDriver` pattern. `@category: e2e-setup` `@lane: fixture-e2e`.

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/supportAdminFixtureData.ts` (new — fixture profiles + documented override-boundary mechanism, mirroring task-07's naming/structure)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (task-07's output — the `SupportDriver` pattern and override-boundary mechanism this task reuses)
- `SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts` (the skeleton this fixture data must support — read the full Journey obligations list to know exactly which profiles/shapes are required)
- `docs/design/support-system-backend-design.md` (§ Data Contracts — `listSupportTickets`/`changeTicketStatusAction`/`addTicketNoteAction` exact return shapes; `TicketWithNotes` field shape)
- `docs/design/support-system-frontend-design.md` (§ Mock Boundary Decisions — `listSupportTickets`/`changeTicketStatusAction`/`addTicketNoteAction` "Yes (module boundary)")

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular `TicketWithNotes`'s exact field shape (as transcribed in the frontend DD, to be reconciled against the real backend type once task-13 exists).
- [ ] Author the fixture ticket set (multiple statuses, at least one `notify_failed: true`) + status-change/note-add success response profiles.
- [ ] Write a minimal Node/vitest import-check that fails until the fixture module exists and exports typed, structurally-valid profiles.

### 2. Green Phase
- [ ] Add the fixture-data module with all profiles + the reused override-boundary mechanism.
- [ ] Confirm the import-check passes.

### 3. Refactor Phase
- [ ] Clean up naming/typing; ensure profiles are easily importable by task-15's driver script without further shape changes.

## Quality Assurance Mechanisms
- ESLint / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs`

## Operation Verification Methods
- **Verification method**: import the fixture module from a throwaway script/test and confirm each profile is structurally valid; separately, open a throwaway Playwright MCP session against `npm run dev` and attempt to exercise the override boundary once.
- **Success criteria**: fixture profiles import cleanly with no type errors; the throwaway MCP session either observes the override taking effect or confirms a documented module-boundary wiring point.
- **Failure response**: if the override mechanism cannot be made to work within this task's Target Files scope, document the specific blocker in Investigation Notes and escalate.
- **Verification level**: L3 (fixture module builds/type-checks cleanly) as the floor; L1 (a real `npm run dev` page load reflects fixture data) as the target.

## Completion Criteria
- [ ] Fixture profiles + override boundary exist and are importable
- [ ] No lint/type errors
- [ ] Confirmed loadable by a throwaway Playwright MCP session against `npm run dev`

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/` only — this task must not modify `SOURCE/app/(admin)/admin/tickets/**` (those don't exist yet — task-13/task-14's responsibility).
- Scope boundary: do not implement `listSupportTickets`/`changeTicketStatusAction`/`addTicketNoteAction` here — task-13's responsibility. This task only prepares data/harness that task-15 will consume.
