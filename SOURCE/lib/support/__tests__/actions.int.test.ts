// User Support System v1 — submitSupportTicket [integration] Test Skeleton
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §submitSupportTicket, Data Flow steps 1-9, Test Boundaries — planned
//   `lib/support/__tests__/actions.test.ts`)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-002 server half, AC-004, AC-008..AC-011,
//   AC-018, AC-019, AC-028, AC-031, AC-032, metric 5, metric 7, metric 10)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e 3/3,
//   service-integration-e2e 1/2 — this file is integration slot 1/3. See sibling
//   skeletons: SOURCE/lib/mail/__tests__/sendSupportNotification.int.test.ts (slot 2/3),
//   SOURCE/app/(admin)/admin/tickets/__tests__/actions.int.test.ts (slot 3/3),
//   SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts (reserved
//   fixture-e2e journey), SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts,
//   SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts,
//   SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts.
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// executable assertions yet. Mirrors this repo's rating.int.test.ts / submitExam.int.test.ts
// house style: one candidate slot (this file) carries several proof-obligation groups,
// each its own `describe`/`it` group once implemented. Mocked Supabase client + mocked
// `next/server` `after()`, per backend DD Test Boundaries ("Supabase client inside
// submitSupportTicket — Yes (mock); next/server's after() — Yes (mock, platform-API
// boundary)"). The real RLS-enforced insert/Storage-write path and cross-student
// isolation are proven by SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts, not
// here — this file proves only the JS call construction and control flow.
//
// File path follows the backend DD's own Implementation Path Mapping
// (`SOURCE/lib/support/__tests__/actions.test.ts`) with the `.int.` infix this repo's
// existing Server-Action test files use uniformly (rating.int.test.ts,
// submitExam.int.test.ts, tutorActions.int.test.ts, recordSkillMastery.int.test.ts) —
// the repo's file-naming convention takes precedence over the design doc's literal
// suggested filename; the `@lane: integration` header on every group below is the
// routing/budget source of truth either way.

// =============================================================================
// Group 1 — three fixed intents + auto-captured metadata (never blocks submission)
// =============================================================================
// AC: "Given a successful submission from any page, when the ticket row is inspected,
//   then it carries a non-empty page URL, a non-empty user agent string, and screen
//   dimensions (width and height in CSS pixels)." (AC-008)
// AC: "Given the captured page URL, when the admin views the ticket, then the URL is
//   the page the student was on at submit time, not the widget's own route or a static
//   placeholder." (AC-009)
// AC: "Given metadata capture fails or a value is unavailable in the student's
//   browser, when the ticket is submitted, then the ticket is still created with the
//   remaining fields populated and the missing field recorded as absent — a metadata
//   gap never blocks a report." (AC-010)
// AC: "Given the widget is open, when the student submits without selecting an intent
//   or with an empty/whitespace-only message, then the submission is refused..."
//   (AC-002, server-side half)
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9)
// Behavior: submitSupportTicket(formData) is called against a mocked Supabase client
//   boundary once per intent ("bug"/"suggestion"/"question") with full metadata present
//   -> assert the constructed insert payload; then once with pageUrl/userAgent/
//   screenWidth/screenHeight all absent from the FormData -> assert the ticket is still
//   created with those four fields explicitly null, never gating the insert on any of
//   them being present.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/lib/support/actions.ts (submitSupportTicket) + mocked Supabase
//   client (createClient() boundary)
// @complexity: medium
// @real-dependency: none — the Supabase client is the sanctioned mock boundary per
//   backend DD Test Boundaries; RLS insert-own re-verification and the DB CHECK
//   constraints are covered by the service-integration-e2e sibling skeleton.
// Primary failure mode: a metadata field's absence (pageUrl/userAgent/screenWidth/
//   screenHeight all undefined in the FormData) throws or short-circuits before the
//   insert instead of writing null for that field and proceeding; OR an intent outside
//   {bug,suggestion,question} reaches the insert call; OR message.trim()==="" reaches
//   the insert call; OR the action itself sets a `status` value on the payload,
//   racing the DB's own `default 'new'` (AC-028).
// Proof obligation:
//   (a) for each of the three fixed intents with full metadata present, the mocked
//       insert call's payload carries intent unchanged, message trimmed, and
//       page_url/user_agent/screen_width/screen_height exactly matching the FormData
//       values (AC-008/AC-009); the payload has no `status` key at all (AC-028's
//       default is a DB-layer concern, not an application-set value);
//   (b) a call with pageUrl/userAgent/screenWidth/screenHeight all omitted from the
//       FormData still invokes insert exactly once, with those four fields explicitly
//       `null` (not `undefined`, not omitted from the object) and intent/message
//       populated normally (AC-010);
//   (c) intent outside {bug,suggestion,question}, or message empty/whitespace-only
//       after trim, resolves to `{ error: "invalid" }` and the mocked insert is never
//       invoked (AC-002 server-side half);
//   (d) no authenticated session (mocked `getUser()` returns null) resolves to
//       `{ error: "unauthenticated" }` before any guard/insert call is reached (AC-004).

// =============================================================================
// Group 2 — single-screenshot structural constraint (metric 7, schema-shape half)
// =============================================================================
// AC: "`support_tickets.screenshot_path` is a single scalar column — the schema
//   structurally permits at most one attachment per ticket." (AC-011, metric 7)
// ROI: 40 (BV:6 x Freq:5 + Legal:0 + Defect:10)
// Behavior: submitSupportTicket(formData) is called with a screenshot File present and
//   `checkScreenshotFile` mocked to pass -> assert the constructed insert payload's
//   `screenshot_path` field is a single string (or `null` when no file is attached),
//   never an array, never a second column — a call-construction proof that the payload
//   shape cannot express more than one attachment, independent of and prior to the DB's
//   own scalar-column enforcement. This is the schema-shape half of metric 7 (the
//   falsifiable half per the PRD's own v1.2 review finding that a `count(*)` SQL query
//   over a scalar column is a tautology); the UI-replace-not-append half (AC-011's UI
//   behavior) is covered by the fixture-e2e submission-journey skeleton's screenshot
//   obligation, not here.
// @category: edge-case
// @lane: integration
// @dependency: SOURCE/lib/support/actions.ts (submitSupportTicket) + mocked Supabase
//   client + mocked Storage upload (`supabase.storage.from(...).upload(...)`)
// @complexity: low
// Primary failure mode: a future edit adds a second screenshot-related field or an
//   array to the insert payload without any test catching it, because nothing asserts
//   the payload shape is a single scalar.
// Proof obligation:
//   (a) with a screenshot File present and `checkScreenshotFile` mocked `{ ok: true }`,
//       the insert payload's `screenshot_path` is a single string value (the uploaded
//       object path), and the payload object has no second screenshot-related key;
//   (b) with no screenshot File present in the FormData, `screenshot_path` is exactly
//       `null` in the payload and no Storage upload call is ever made;
//   (c) `checkScreenshotFile` mocked `{ ok: false, reason: "too_large" | "invalid_type" }`
//       resolves to `{ error: "screenshot_rejected" }`, no Storage upload call is made,
//       and no insert call is made (AC-012, cited here as the reject-before-write half
//       this group's fixture already sets up).

// =============================================================================
// Group 3 — rate limiting on ticket submission (R6, AC-018/AC-019)
// =============================================================================
// AC: "Given a student who submits beyond the configured ceiling within the configured
//   window, when the next submission arrives, then it is refused with an actionable
//   message that tells the student they may retry later, and no ticket row is
//   created." (AC-018)
// AC: "Given a refused (rate-limited) submission, when it is refused, then no
//   notification email is emitted for it." (AC-019)
// ROI: 70 (BV:8 x Freq:7 + Legal:0 + Defect:6)
// Behavior: `guard("submitTicket", user.id)` (SOURCE/lib/security/rateLimit.ts) is
//   mocked to return a refusal -> submitSupportTicket returns `{ error: "rate_limited" }`
//   without ever reaching the insert or registering the after()-scheduled mail
//   callback.
// @category: edge-case
// @lane: integration
// @dependency: SOURCE/lib/security/rateLimit.ts (guard, mocked) + SOURCE/lib/support/actions.ts
// @complexity: low
// Primary failure mode: a rate-limited call still reaches the insert (double-writes a
//   ticket for a request the student was told was refused) or still registers the
//   after()-scheduled mail callback (AC-019 violated — an email is queued for a refused
//   request).
// Proof obligation:
//   (a) a mocked `guard()` refusal resolves to exactly `{ error: "rate_limited" }` (no
//       other keys) and the mocked Supabase insert is never called;
//   (b) the mocked `after()` is never invoked on the rate-limited path — proves AC-019's
//       "no notification email is emitted for it" at the call-construction level (the
//       mail callback is never even registered, not merely registered-then-skipped).

// =============================================================================
// Group 4 — fire-and-forget mail (D5, AC-031/AC-032): student sees success without
//   waiting on mail; notify_failed flag set on failure only
// =============================================================================
// AC: "Given the mail transport throws, times out, or is unconfigured, when a student
//   submits, then the ticket row is still committed and the student sees the success
//   acknowledgement." (AC-031)
// AC: "Given a send failure, when it occurs, then it is logged with enough context to
//   diagnose it ... and the ticket carries an admin-visible flag indicating its
//   notification did not send." (AC-032)
// ROI: 92 (BV:9 x Freq:9 + Legal:0 + Defect:11) — this feature's single highest-value
//   proof: the backend DD's own R-4 risk entry names exactly this decoupling as the
//   fix for a prior duplicate-submission risk (review finding I003).
// Behavior: submitSupportTicket(formData) with a valid ticket -> assert the function
//   resolves `{ ok: true, shortRef }` BEFORE the mocked `after()`'s captured callback
//   has been invoked or its inner `sendSupportNotification` promise has even been
//   created (proving the response is not gated on the mail send in any way) -> the
//   captured `after()` callback is then invoked directly and separately, once with a
//   mocked `sendSupportNotification` resolving `{ ok: true }` and once with it
//   resolving `{ ok: false }` / rejecting, asserting `flagSupportTicketNotifyFailed` is
//   called on failure only and that neither branch can alter the already-returned
//   response object.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/lib/support/actions.ts (submitSupportTicket) + mocked
//   next/server `after()` + mocked `sendSupportNotification` (SOURCE/lib/mail/) +
//   mocked `flagSupportTicketNotifyFailed` (SOURCE/lib/supabase/service-role.ts)
// @complexity: high
// @real-dependency: none — `after()`'s real post-response scheduling guarantee is a
//   Next.js platform behavior this repo's test runner cannot reproduce end-to-end
//   (backend DD Mock Boundary Decisions, "next/server's after() — Yes (mock,
//   platform-API boundary)"); this test proves the call-shape contract (registered
//   before return; callback invocable and testable independent of the response) that
//   stands in for the platform guarantee.
// Primary failure mode: submitSupportTicket awaits `sendSupportNotification` inline
//   before returning (reopens the I003 duplicate-submission risk the backend DD's v1.1
//   revision exists to close); OR a mail failure changes the action's return value; OR
//   `flagSupportTicketNotifyFailed` is never called on a mocked send failure; OR it is
//   called even on a mocked send success.
// Proof obligation:
//   (a) `after()` is called with a callback function BEFORE `submitSupportTicket`'s
//       promise resolves, and the resolved return value is exactly
//       `{ ok: true, shortRef }` with `shortRef === ticket.id.slice(0, 8)` — asserted
//       without ever awaiting or resolving the mocked `sendSupportNotification`
//       promise, proving no code path between insert success and the return statement
//       touches the mail call (AC-031's "never waits" half, D5);
//   (b) invoking the captured `after()` callback directly with `sendSupportNotification`
//       mocked to reject/return `{ ok: false }` calls
//       `flagSupportTicketNotifyFailed(ticket.id)` exactly once, and a server-side log
//       call carries at minimum ticket id, recipient, and failure reason (AC-032);
//   (c) invoking the captured `after()` callback with `sendSupportNotification` mocked
//       to resolve `{ ok: true }` never calls `flagSupportTicketNotifyFailed`.
