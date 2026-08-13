# Task 15: Fixture-e2e `support-admin-triage.fixture.e2e.test.ts` (Work Plan Phase 3, Task 3.3)

Metadata:
- Dependencies: support-system-work-plan-task-14 (Deliverable: admin rendering-layer components), support-system-work-plan-task-12 (Deliverable: fixture harness)
- Provides: first full admin-surface proof, independent of a live backend
- Size: Small (1 file: fill in the skeleton)

## Implementation Content

Fill in and execute the admin journey: notify-failed flag visible in the collapsed row without expanding (AC-022) → list ordered most-recent-first (AC-041) → each of the three statuses renders a distinct glyph + text (AC-042) → change a ticket's status via `TicketStatusControl`, reload against updated fixture data, confirm persistence (AC-023) → write an internal note, confirm it appears (AC-027).

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts` (fill in the skeleton's driver code)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts` (full file — the Journey Behavior/Proof Obligation block, obligations (a)-(e))
- `docs/ui-spec/support-system-ui-spec.md` (§ Component: TicketQueueList; § Component: TicketQueueRow; § Component: TicketDetailPanel; § Component: TicketStatusControl; § Component: InternalNotesPanel)
- `SOURCE/app/(admin)/admin/tickets/TicketQueueList.tsx`, `TicketQueueRow.tsx`, `TicketStatusBadge.tsx`, `TicketStatusControl.tsx`, `InternalNotesPanel.tsx` (task-14's implemented components this journey drives)
- `SOURCE/tests/e2e/fixture/supportAdminFixtureData.ts` (task-12's fixture profiles — multi-status ticket set, `notify_failed: true` ticket, status-change/note-add success responses)

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact collapsed-row DOM structure `TicketQueueRow` renders (to confirm the notify-failed flag assertion targets the collapsed view, not the expanded one).
- [ ] Fill in the driver code per the skeleton's stated Journey Behavior; initially expect failures until wired against task-12's fixture harness and task-14's real components.

### 2. Green Phase
- [ ] Wire the driver against the fixture harness and real components; iterate until all 5 proof obligations pass.

### 3. Refactor Phase
- [ ] Clean up driver code; confirm the reload-based persistence assertion (obligation d) genuinely reloads against updated fixture data rather than asserting client-only state.

## Quality Assurance Mechanisms
- ESLint / `tsc` strict — Enforces: style, types — Config: `SOURCE/eslint.config.mjs`

## Operation Verification Methods
- **Verification method**: full admin journey driven against task-12's fixture harness (multi-status ticket set, status-change/note-add responses) and task-14's real components.
- **Success criteria**: all 5 obligations pass (notify-failed flag visible collapsed; most-recent-first ordering; distinct glyph+text per status; status-change persists on reload; note appears after submission).
- **Failure response**: if obligation (a) fails (flag only visible after expanding), check `TicketQueueRow`'s collapsed-view JSX for whether `NotificationFailureFlag` is conditionally rendered only inside the expanded branch.
- **Verification level**: L1 (full end-to-end admin journey, independent of a live backend) as the target; L2 (driver code passes against the fixture harness) as the floor.

## Proof Obligations
- **Claim**: for a ticket with `notify_failed: true`, the failure flag's rendered indicator is present in `TicketQueueRow`'s collapsed (unexpanded) view (AC-022, UI half).
- **Primary failure mode**: the notify-failed flag is present in the underlying fixture data but never rendered in the collapsed row view — only visible after expanding/opening the ticket, defeating AC-022's "visible ... without opening the ticket" requirement.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: N/A (render-only).
- **Mock boundary rationale**: `listSupportTickets` fixture-driven per frontend DD Mock Boundary Decisions.
- **Residual**: the data-supply half of AC-022 (the field is always present, never conditionally omitted) is proven separately by task-13's `actions.int.test.ts` Group 3.
- **Claim**: the rendered list order matches the fixture data's `created_at` descending order exactly (AC-041).
- **Primary failure mode**: the list is rendered in insertion order or ascending order instead of most-recent-first.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: N/A.
- **Mock boundary rationale**: `listSupportTickets` fixture-driven.
- **Residual**: none.
- **Claim**: for each of the three `TicketStatus` values present in the fixture set, `TicketStatusBadge` renders both a distinct glyph and a distinct label, and no two statuses share either (AC-042).
- **Primary failure mode**: two statuses share the same glyph or label text, relying on color alone to distinguish them.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: N/A.
- **Mock boundary rationale**: fixture ticket set spans all three statuses.
- **Residual**: none.
- **Claim**: changing a ticket's status via `TicketStatusControl`, then reloading the page against fixture data updated to reflect that change, shows the new status — not the pre-change one (AC-023, `state-change` category).
- **Primary failure mode**: a status change appears to succeed in the dialog but is not reflected after a page reload — a client-state-only illusion of persistence.
- **Boundary to exercise**: full-ui (mocked backend, status-change fixture response + a reload against updated fixture data).
- **State assertion**: before = ticket at status X; action = change via `TicketStatusControl` against a fixture success response, then reload against fixture data reflecting status Y; after = the reloaded page shows status Y, not X.
- **Mock boundary rationale**: `changeTicketStatusAction` fixture-driven; the "reload" step re-renders against a second, updated fixture data set, simulating real persistence without a live backend.
- **Residual**: real DB persistence and the `first_status_transition_at` write-once guarantee are proven by task-13's own int test and task-01/task-03's DDL+RLS proof, not by this journey.
- **Claim**: submitting a note via `InternalNotesPanel` against a fixture success response results in the note text appearing in the panel's rendered list (AC-027).
- **Primary failure mode**: the submitted note is not appended to the rendered list, or the form does not clear/reset after a successful submission.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: before = note not present in the list; action = submit via `InternalNoteForm` against a fixture success response; after = the note's text appears in the panel's rendered list.
- **Mock boundary rationale**: `addTicketNoteAction` fixture-driven.
- **Residual**: none.

## Completion Criteria
- [ ] All 5 obligations pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the full-ui boundary
- [ ] This is the first full admin-surface proof, independent of a live backend

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts` only — driver code fills the existing skeleton, no production component code is changed by this task.
- Scope boundary: admin authorization itself (AC-021/AC-024, the independent `isAdminUserId()` re-check) is backend logic already covered by task-13's integration-lane test — this journey assumes a fixture-admin session and focuses on the rendered UI, not the authorization gate itself. If a real defect is found in a task-14 component, the fix belongs in that task's already-touched files, not here.
