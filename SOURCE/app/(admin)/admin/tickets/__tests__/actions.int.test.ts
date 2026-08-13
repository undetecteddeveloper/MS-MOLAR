// User Support System v1 — admin/tickets actions + service-role reads [integration]
//   Test Skeleton
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §changeTicketStatusAction, §addTicketNoteAction, §listSupportTickets,
//   §changeSupportTicketStatus, Schema & DB Enforcement §4 `change_support_ticket_status`,
//   Verification Strategy item (5)/(6))
// PRD: docs/prd/support-system-prd.md (v1.2, AC-021, AC-022 data-supply half, AC-024,
//   AC-027, AC-029 defensive half, AC-030, AC-047, metric 11, metric 12)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e
//   3/3, service-integration-e2e 1/2 — this file is integration slot 3/3. See
//   SOURCE/lib/support/__tests__/actions.int.test.ts (slot 1/3) and
//   SOURCE/lib/mail/__tests__/sendSupportNotification.int.test.ts (slot 2/3). The
//   UI-rendering half of AC-022 (notify_failed flag visible in the list without
//   opening a ticket) is covered by
//   SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts, not here — this
//   file proves only that the flag is present in the data `listSupportTickets`
//   returns, not how it renders.
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// executable assertions yet. Mocked Supabase service-role client per backend DD Test
// Boundaries ("Supabase client inside submitSupportTicket — Yes (mock)"; the same
// mock-the-client-boundary principle extends to the admin service-role functions and
// actions — the real RPC/RLS behavior of `change_support_ticket_status` and the
// `authenticated`-cannot-call-it grant are proven by
// SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts, not by this file).

// =============================================================================
// Group 1 — changeSupportTicketStatus: first-status-transition timestamp written
//   exactly once, never overwritten (AC-047)
// =============================================================================
// AC: "Given a ticket whose status changes from `new` to any other value, when that
//   transition is applied, then the ticket's first-status-transition timestamp is
//   written with the time of that transition; and given any subsequent status change
//   on the same ticket, when it is applied, then that timestamp is not overwritten..."
//   (AC-047)
// ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
// Behavior: `changeSupportTicketStatus(ticketId, nextStatus)` is called twice in
//   sequence against a mocked service-role client whose `.rpc("change_support_ticket_status", ...)`
//   is stubbed to mirror the real function's CASE-expression semantics (first call:
//   `status:'new'` row -> returns a fresh timestamp; second call on the same
//   already-non-'new' row -> returns the same timestamp unchanged) -> assert the
//   caller reads back exactly one non-null timestamp across both calls, and that both
//   calls go through `.rpc()`, never `.from().update()` (the backend DD's own D002
//   correction: no raw SQL/`.update()` path can express the conditional CASE write).
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/lib/supabase/service-role.ts (changeSupportTicketStatus) +
//   mocked Supabase service-role client
// @complexity: medium
// @real-dependency: none — this test proves the JS call shape (exactly one `.rpc()`
//   call per invocation, correct function name and argument names) and the
//   caller-side sequencing assumption; the function body's actual atomicity (no
//   read-then-write race inside Postgres) is proven by the function being a single
//   SQL statement (backend DD Schema & DB Enforcement §4), not by this mock, and the
//   `authenticated`-cannot-call-it grant is proven by the RLS/EXECUTE-grant probe in
//   the service-integration-e2e sibling skeleton.
// Primary failure mode: the caller issues a `.from("support_tickets").update(...)` call
//   instead of `.rpc("change_support_ticket_status", ...)` (reopening the D002 defect —
//   no way to express the conditional CASE write through the query builder); OR the
//   caller reads a stale/locally-cached timestamp instead of the function's own
//   returned row, letting a second transition appear to "advance" a timestamp that
//   should be frozen.
// Proof obligation:
//   (a) both the first and second call invoke exactly
//       `.rpc("change_support_ticket_status", { p_ticket_id: ticketId, p_status: nextStatus })`
//       — never `.from("support_tickets").update(...)` for this operation;
//   (b) the first call's returned `firstStatusTransitionAt` is non-null and distinct
//       from `null`; the second call's returned `firstStatusTransitionAt` equals the
//       first call's value exactly (not merely non-null) — proving the caller
//       forwards the function's own returned timestamp rather than re-deriving one.

// =============================================================================
// Group 2 — changeTicketStatusAction / addTicketNoteAction: independent admin
//   re-authorization (AC-021/AC-024), no email on status change (AC-030)
// =============================================================================
// AC: "Given the calling user's id is not in ADMIN_USER_IDS, when any admin Server
//   Action or the admin page is invoked, then it is rejected ... independently of any
//   page-level guard." (AC-021, AC-024)
// AC: "Given any status change by an admin, when it is applied, then no email is sent
//   to the student." (AC-030)
// AC: "Given an admin writes a note, when it persists, then it records the note text,
//   the authoring admin's user id, the ticket it belongs to, and a timestamp."
//   (AC-027)
// ROI: 62 (BV:8 x Freq:5 + Legal:true(+10) + Defect:8) — Legal:true because this is
//   the "Server Action is an independently callable endpoint" convention that the
//   backend DD's own biggest_risks entry calls out (any authenticated student could
//   invoke the action id directly if the re-check is skipped).
// Behavior: `changeTicketStatusAction(ticketId, nextStatus)` and
//   `addTicketNoteAction(ticketId, noteText)` are each called against a mocked
//   Supabase client whose `auth.getUser()` resolves to a non-admin user id (one whose
//   id is asserted NOT to be in a mocked `ADMIN_USER_IDS`), independent of any
//   page-level guard state -> both actions resolve to a refusal and neither reaches
//   its underlying service-role write; a second call with an admin id proceeds
//   normally and (for the status action) triggers no mail-sending call of any kind.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(admin)/admin/tickets/actions.ts (changeTicketStatusAction,
//   addTicketNoteAction) + mocked Supabase client + mocked isAdminUserId +
//   SOURCE/lib/supabase/service-role.ts (changeSupportTicketStatus, addSupportTicketNote,
//   mocked)
// @complexity: medium
// Primary failure mode: either action trusts a caller-supplied flag or the page-level
//   guard instead of independently re-deriving the user and re-checking
//   `isAdminUserId()` inside the action body itself — mirrors the documented
//   `moderateExamAction` convention this design explicitly follows (backend DD
//   biggest_risks); OR a status-change call triggers any mail-related function call
//   (AC-030 violated — no email is sent on any admin status change, ever, in v1).
// Proof obligation:
//   (a) a mocked non-admin session calling `changeTicketStatusAction` resolves to a
//       refusal (a non-null `error`) and the mocked `changeSupportTicketStatus` is
//       never invoked;
//   (b) the same non-admin session calling `addTicketNoteAction` resolves to a
//       refusal and the mocked `addSupportTicketNote` is never invoked;
//   (c) a mocked admin session calling `addTicketNoteAction` with valid `noteText`
//       invokes `addSupportTicketNote(ticketId, adminId, noteText)` with `adminId`
//       taken from the session's own `auth.uid()` — never from a client-supplied
//       argument — proving a note cannot be attributed to a different admin than the
//       one who is actually authenticated (AC-027);
//   (d) a mocked admin session successfully changing a ticket's status never invokes
//       `sendSupportNotification` or any other mail-sending function in the same call
//       (AC-030 — no student status-change email exists anywhere in v1).

// =============================================================================
// Group 3 — listSupportTickets: batched read includes notify_failed (AC-022, data
//   half only — UI visibility is the fixture-e2e sibling skeleton's concern)
// =============================================================================
// AC: "...they see the ticket queue with, per ticket, the intent, the message, the
//   technical metadata, the screenshot indicator, the current status, the creation
//   time, and the notification-failure flag where set — the flag is visible in the
//   list, without opening the ticket..." (AC-022, data-supply half — this backend
//   Design Doc's own AC Responsibility table marks AC-022 "data supply" as
//   backend-owned, distinct from the frontend-owned rendering half)
// ROI: 46 (BV:6 x Freq:6 + Legal:0 + Defect:10)
// Behavior: `listSupportTickets()` is called against a mocked service-role client
//   returning two batched result sets (one `support_tickets` select, one
//   `support_ticket_notes` select filtered by the first result's ids) -> assert
//   exactly two round trips are made (no per-row query, no embedded join — mirrors
//   `listReportedExams`), and that every returned ticket object carries a
//   `notify_failed` boolean field sourced directly from the row, present even when
//   `false`, not omitted.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/lib/supabase/service-role.ts (listSupportTickets) + mocked
//   Supabase service-role client
// @complexity: medium
// Primary failure mode: `notify_failed` is dropped from the select's column list or
//   from the returned object shape, making a silent mail outage invisible in the admin
//   list exactly as PRD Risk "Notification silently off" warns against; OR the
//   implementation issues a per-ticket round trip for notes instead of one batched
//   `where ticket_id in [...]` select (N+1, violating the PRD's own Performance NFR).
// Proof obligation:
//   (a) exactly one call selects from `support_tickets` and exactly one call selects
//       from `support_ticket_notes` — no third call, no per-ticket note fetch, for a
//       mocked result set of 3+ tickets;
//   (b) every object in the returned array has a `notify_failed` key with a boolean
//       value, including for a mocked ticket row where `notify_failed` is `false`
//       (proving the field is not conditionally omitted);
//   (c) each ticket's `notes` array contains exactly the notes whose `ticket_id`
//       matches that ticket's id from the mocked second result set, grouped in JS, not
//       via a database-side join.
