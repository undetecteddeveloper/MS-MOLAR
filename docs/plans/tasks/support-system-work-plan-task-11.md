# Task 11: Fixture-e2e `support-ticket-submission.fixture.e2e.test.ts` (RESERVED SLOT — full journey) (Work Plan Phase 2, Task 2.4)

Metadata:
- Dependencies: support-system-work-plan-task-09 (Deliverable: `SupportWidget` tree), support-system-work-plan-task-07 (Deliverable: fixture harness), support-system-work-plan-task-06 (Deliverable: real `submitSupportTicket` contract shape)
- Provides: first full student-facing journey proof, independent of a live backend
- Size: Small (1 file: fill in the skeleton)

## Implementation Content

Fill in and execute the reserved-slot journey: open widget → exactly 3 intents rendered → for each intent, submit against a fixture success response and assert the acknowledgement (not the form) renders only after the fixture promise resolves (non-optimistic, AC-040) → attach then re-attach a screenshot, asserting exactly one survives to submission (AC-011 UI half) → submit against a fixture `{ error: "rate_limited" }` and assert intent/message preserved (AC-020) → submit against a never-resolving fixture and assert the retryable timeout error renders with all fields preserved (AC-039).

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts` (fill in the skeleton's driver code)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts` (full file — the Journey Behavior/Proof Obligation block, obligations (a)-(e))
- `docs/ui-spec/support-system-ui-spec.md` (§ Component: SupportWidgetDialog — Default/Loading/Error/Success sub-state; § Component: IntentSelector; § Component: MessageField; § Component: ScreenshotAttachment)
- `SOURCE/components/support/SupportWidgetDialog.tsx`, `IntentSelector.tsx`, `MessageField.tsx`, `ScreenshotAttachment.tsx` (task-09's implemented components this journey drives)
- `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (task-07's fixture profiles — success-with-`shortRef`, rate-limited refusal, never-resolving timeout)
- `docs/design/support-system-backend-design.md` (§ Data Contracts — `submitSupportTicket`, the real contract shape this fixture's success/refusal profiles must match)

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact Vietnamese intent labels ("Báo lỗi", "Góp ý", "Câu hỏi") and the client's 20s timeout constant (or a test-scaled equivalent).
- [ ] Fill in the driver code per the skeleton's stated Journey Behavior; initially expect failures until wired against task-07's fixture harness and task-09's real components.

### 2. Green Phase
- [ ] Wire the driver against the fixture harness and real components; iterate until all 5 proof obligations pass.

### 3. Refactor Phase
- [ ] Clean up driver code; confirm the non-optimistic-rendering assertion (obligation b) genuinely observes the form view before the fixture promise resolves, not merely a same-tick synchronous check that would pass even on an optimistic-render bug.

## Quality Assurance Mechanisms
- ESLint / `tsc` strict — Enforces: style, types — Config: `SOURCE/eslint.config.mjs`

## Operation Verification Methods
- **Verification method**: full journey driven against task-07's fixture harness (success/refusal/timeout profiles) and task-09's real components, in a real browser or Playwright-compatible driver.
- **Success criteria**: all 5 obligations pass (exactly 3 intents; non-optimistic acknowledgement per intent; single-attachment constraint; rate-limited-refusal input preservation; timeout-error input preservation).
- **Failure response**: if obligation (b) fails (acknowledgement renders before the fixture promise resolves), check `SupportWidgetDialog`'s phase transition for an accidental synchronous state update before the `await`.
- **Verification level**: L1 (full end-to-end student journey, independent of a live backend) as the target; L2 (driver code passes against the fixture harness) as the floor.

## Proof Obligations
- **Claim**: opening the widget renders exactly three intent options with the exact Vietnamese labels, and no fourth option exists anywhere in the dialog's rendered markup (AC-001).
- **Primary failure mode**: a fourth intent option is reachable through some interaction path not covered by `IntentSelector`'s three fixed buttons.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: N/A.
- **Mock boundary rationale**: `submitSupportTicket` fixture-driven per frontend DD Mock Boundary Decisions ("module boundary").
- **Residual**: none.
- **Claim**: for each of the three intents, a successful submission transitions to the acknowledgement sub-state showing the fixture's `shortRef` verbatim, only after the fixture promise has resolved — never optimistically (AC-040, AC-049).
- **Primary failure mode**: an optimistic-success bug shows the acknowledgement before `submitSupportTicket`'s promise has actually resolved.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: before = form view visible immediately after the click; action = await the fixture promise resolving; after = acknowledgement view replaces the form view only post-resolution.
- **Mock boundary rationale**: `submitSupportTicket` fixture-driven.
- **Residual**: real Supabase persistence and RLS are proven separately by task-03, not by this journey.
- **Claim**: attaching a screenshot then attaching a second one before submitting results in exactly one attachment being part of the submitted request — never two (AC-011, UI half).
- **Primary failure mode**: a second screenshot attachment is added alongside the first instead of replacing it.
- **Boundary to exercise**: full-ui (mocked backend).
- **State assertion**: before = no attachment; action = attach, then attach again; after = the fixture backend's recorded call arguments (or the UI's own single-attachment indicator) show exactly one file.
- **Mock boundary rationale**: `submitSupportTicket` fixture-driven, call arguments inspectable.
- **Residual**: the schema-shape half of the single-screenshot constraint (`screenshot_path` as a single scalar column) is proven separately by task-06's `actions.int.test.ts` Group 2.
- **Claim**: a rate-limited refusal and a timeout both preserve the student's typed intent/message/screenshot selection exactly as entered, and the error is retryable (AC-020, AC-039).
- **Primary failure mode**: a refusal or timeout clears the student's typed message instead of preserving it for retry.
- **Boundary to exercise**: full-ui (mocked backend, rate-limited fixture response + never-resolving timeout fixture).
- **State assertion**: before = typed intent/message/screenshot present; action = submit against the refusal/timeout fixture; after = dialog returns to form view with all fields still present, unchanged.
- **Mock boundary rationale**: `submitSupportTicket` fixture-driven with a deliberately refusing/never-resolving profile.
- **Residual**: none.

## Completion Criteria
- [ ] All 5 obligations pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the full-ui boundary
- [ ] This is the first full student-facing journey proof, independent of a live backend

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts` only — driver code fills the existing skeleton, no production component code is changed by this task.
- Scope boundary: if a real defect is found in a task-09 component, the fix belongs in that task's already-touched files, not here — escalate rather than silently expanding this task's Target Files. This is the RESERVED SLOT skeleton (emitted regardless of ROI score per the generator's Phase 4 rule) — do not reduce its scope below the 5 stated obligations without a recorded reason.
