// User Support System v1 — Student Ticket Submission Journey [fixture-e2e] Test
//   Skeleton (RESERVED SLOT — user-facing multi-step journey)
// Design Docs: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §submitSupportTicket), docs/design/support-system-frontend-design.md (v1.2,
//   `SupportWidgetDialog` phase state machine, Verification Strategy items (2)/(3))
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Component: SupportWidgetDialog,
//   IntentSelector, MessageField, ScreenshotAttachment)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-001, AC-002 UI half, AC-008..AC-011,
//   AC-020, AC-039, AC-040, AC-049, Use Cases 1-5)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e
//   3/3 (this file is the RESERVED slot 1/3), service-integration-e2e 1/2. Reserved
//   per this generator's Phase 4 rule: the feature contains a user-facing multi-step
//   journey (open widget -> select intent -> type message -> optional screenshot ->
//   submit -> acknowledgement), so this candidate is emitted regardless of its own ROI
//   score.
//
// Skeleton only — comments describing what the implementer must write; no imports, no
// executable driver code yet, other than the same structural Driver interface and
// fixture-data pattern this repo's existing fixture-e2e files already establish
// (SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts, history.fixture.e2e.test.ts).
// This repo has no `@playwright/test` dependency and no `playwright.config.ts`
// committed — only the Playwright MCP browser-automation server is configured
// (`.mcp.json`) for interactive/manual sessions (frontend DD Test Boundaries: backend
// Server Actions are mocked at the module boundary, `usePathname()` mocked at the
// framework boundary — same principle extended here to a full page-level driver).
// Once implemented, this script should be written against a minimal `SupportDriver`
// interface that is a structural SUBSET of Playwright's real `Page`/`Locator` API
// (`goto`, `url`, `getByRole`, `getByLabelText`, `getByText`, `.click`, `.fill`,
// `.setInputFiles`, `.getAttribute`, `.first`, `.count`, `.textContent`) — a real
// Playwright `Page` satisfies this interface as-is, matching the FE2Driver/HistoryDriver
// precedent exactly.
//
// Fixture-driven backend: `submitSupportTicket` must resolve to fixture responses
// (success with a deterministic `shortRef`, each documented refusal code, and a
// deliberately-delayed/never-resolving promise for the timeout branch) instead of a
// live Server Action for this script to run against `npm run dev`. Wiring that
// override boundary into a real running page is a residual for whoever stands up the
// Playwright harness, per the same precedent `rating.fixture.e2e.test.ts` and
// `history.fixture.e2e.test.ts` already recorded for their own fixture-backend gaps.

// =============================================================================
// Journey — open widget, submit each of the three intents (with and without a
//   screenshot), see the non-optimistic acknowledgement; a refusal preserves input
// =============================================================================
// AC: "Given a logged-in student on any page where the widget renders, when they open
//   the widget, then exactly three intents are offered, labelled in Vietnamese as
//   'Báo lỗi', 'Góp ý', and 'Câu hỏi'." (AC-001)
// AC: "Given the widget, when a student attaches an image and then attempts to attach
//   a second one, then the ticket ends with exactly one image — the UI either
//   replaces the first or refuses the second, and never produces two attachments on
//   one ticket." (AC-011, UI half)
// AC: "Given the acknowledgement is shown, when it is shown, then the ticket row has
//   been committed — the success state is never optimistic." (AC-040)
// AC: "Given a rate-limited refusal, when it renders, then the student's typed intent
//   and message remain exactly as entered." (AC-020)
// AC: "Given a submission that fails before commit (network/server/timeout), when the
//   error renders, then intent, message, and screenshot selection are all preserved
//   and the error is retryable." (AC-039)
// AC: "Given a committed ticket, when the acknowledgement displays its short
//   reference, then that reference maps 1:1 to exactly one ticket row..." (AC-049)
// ROI: 90 (BV:10 x Freq:9 + Legal:0 + Defect:0 — reserved slot, emitted regardless of
//   score per the multi-step-journey rule; recorded for traceability, not as a
//   selection gate)
// Behavior: navigate to a normal (non-attempt-route) mounted page as a logged-in
//   fixture user -> open the widget -> for each of the three intents in turn, select
//   it, type a message, submit against a fixture `submitSupportTicket` returning
//   `{ ok: true, shortRef }`, and assert the acknowledgement view (not the form) is
//   what renders, showing the exact fixture `shortRef` -> separately, attach a
//   screenshot then attempt to attach a second one, asserting exactly one attachment
//   survives to submission -> separately, submit against a fixture refusal
//   (`{ error: "rate_limited" }`) and assert the dialog returns to the form with
//   intent/message intact -> separately, submit against a fixture that never resolves
//   within the client's timeout window and assert the retryable timeout error renders
//   with intent/message/screenshot-selection all preserved.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — submitSupportTicket fixture-driven per the
//   frontend DD's Mock Boundary Decisions ("submitSupportTicket ... Yes (module
//   boundary)")
// @complexity: high
// @real-dependency: none — this journey never touches a real Supabase project; ticket
//   persistence and RLS are proven separately by the service-integration-e2e sibling
//   skeleton. This test proves only that the browser-rendered UI reaches the correct
//   visible state for each backend response shape.
// Primary failure mode: the acknowledgement view renders before `submitSupportTicket`'s
//   promise has actually resolved (an optimistic-success bug, AC-040 violated); OR a
//   second screenshot attachment is added alongside the first instead of replacing it
//   (AC-011 violated); OR a refusal or timeout clears the student's typed message
//   instead of preserving it for retry (AC-020/AC-039 violated); OR a fourth intent
//   option is reachable through some interaction path not covered by
//   `IntentSelector`'s three fixed buttons.
// Proof obligation:
//   (a) opening the widget renders exactly three intent options with the exact
//       Vietnamese labels "Báo lỗi", "Góp ý", "Câu hỏi", and no fourth option node
//       exists anywhere in the dialog's rendered markup (AC-001);
//   (b) for each of the three intents, submitting against a fixture success response
//       transitions the dialog to its acknowledgement sub-state showing the fixture's
//       `shortRef` verbatim, and this transition is observed to happen only after the
//       fixture promise has resolved (e.g., by asserting the form view is still
//       visible immediately after the click and only replaced after an awaited tick),
//       proving non-optimistic rendering (AC-040, AC-049);
//   (c) attaching a screenshot then attaching a second one before submitting results
//       in exactly one attachment being part of the submitted request (assert via the
//       fixture backend's recorded call arguments, or via the UI's own
//       single-attachment indicator, whichever the implementation exposes) — never two
//       (AC-011);
//   (d) submitting against a fixture `{ error: "rate_limited" }` response returns the
//       dialog to the form view with the previously-typed intent selection and message
//       text both still present, exactly as typed (AC-020);
//   (e) submitting against a fixture promise that does not resolve within the client's
//       20s timeout window (or a test-scaled equivalent) surfaces the retryable timeout
//       error with intent, message, and screenshot selection all still present
//       (AC-039).
