// User Support System v1 — Admin Triage Journey [fixture-e2e] Test Skeleton
// Design Docs: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §listSupportTickets, §changeTicketStatusAction, §addTicketNoteAction), docs/design/support-system-frontend-design.md
//   (v1.2, TicketQueueList/TicketQueueRow/TicketDetailPanel/TicketStatusControl/
//   InternalNotesPanel/NotificationFailureFlag)
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Component: TicketQueueList,
//   TicketQueueRow, TicketDetailPanel, TicketStatusControl, InternalNotesPanel)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-021, AC-022 UI half, AC-023, AC-041,
//   AC-042, Use Cases 10-11)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e
//   3/3 (this file is slot 3/3, additional-beyond-reserved), service-integration-e2e
//   1/2.
//
// Skeleton only — comments describing what the implementer must write; no imports, no
// executable driver code yet. Same `SupportDriver` structural-subset convention as the
// two sibling fixture-e2e skeletons in this feature. Fixture-driven backend:
// `listSupportTickets`, `changeTicketStatusAction`, `addTicketNoteAction` must resolve
// to fixture data/responses instead of a live backend, per the frontend DD's Mock
// Boundary Decisions ("submitSupportTicket, changeTicketStatusAction,
// addTicketNoteAction, listSupportTickets ... Yes (module boundary)"). Admin
// authorization itself (AC-021/AC-024, the independent isAdminUserId() re-check) is
// backend logic already covered by the integration-lane
// `app/(admin)/admin/tickets/__tests__/actions.int.test.ts` skeleton's Group 2 — this
// file assumes a fixture-admin session and focuses on the rendered UI, not the
// authorization gate itself.

// =============================================================================
// Journey — queue shows the notification-failure flag inline; open a ticket; change
//   status; write a note; status persists on reload
// =============================================================================
// AC: "...they see the ticket queue with, per ticket, ... the notification-failure
//   flag where set — the flag is visible in the list, without opening the ticket, so
//   a silent mail outage is noticed rather than discovered one ticket at a time."
//   (AC-022, UI half — the data-supply half is proven by the integration-lane
//   sibling skeleton)
// AC: "Given an admin viewing a ticket, when they change its status, then the new
//   status persists and is visible on reload." (AC-023)
// AC: "Given multiple tickets, when the admin page renders, then they are ordered by
//   creation time descending." (AC-041)
// AC: "Given tickets in different statuses, when the list renders, then each
//   ticket's status is visible in the list without opening the ticket, and status is
//   not conveyed by color alone." (AC-042)
// ROI: 48 (BV:7 x Freq:5 + Legal:0 + Defect:8)
// Behavior: navigate to `/admin/tickets` as a fixture admin session with a fixture
//   ticket set spanning multiple statuses and at least one ticket with
//   `notify_failed: true` -> assert the notify-failed flag is visible on that ticket's
//   row without any row-expand/click interaction -> assert list ordering is
//   most-recent-first -> assert `TicketStatusBadge` renders a distinct glyph + text
//   per status, never relying on a color-only cue -> open one ticket, change its
//   status via `TicketStatusControl` against a fixture `changeTicketStatusAction`
//   response, then reload the page against updated fixture data reflecting the new
//   status, asserting the change is still shown -> write an internal note via
//   `InternalNotesPanel` against a fixture `addTicketNoteAction` response, asserting
//   the note appears in the panel.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — listSupportTickets, changeTicketStatusAction,
//   addTicketNoteAction fixture-driven
// @complexity: medium
// @real-dependency: none — this journey never touches a real Supabase project; the
//   actual `authenticated`-cannot-read-notes RLS boundary is proven by the
//   service-integration-e2e sibling skeleton, and the admin-action independent
//   re-authorization is proven by the integration-lane sibling skeleton. This test
//   proves only that the browser-rendered admin UI reaches the correct visible state
//   for each fixture response shape.
// Primary failure mode: the notify-failed flag is present in the underlying fixture
//   data but never rendered in the collapsed row view (only visible after expanding/
//   opening the ticket), defeating AC-022's "visible ... without opening the ticket"
//   requirement — exactly the silent-mail-outage risk the PRD calls out; OR a status
//   change appears to succeed in the dialog but is not reflected after a page reload
//   (AC-023 violated, a client-state-only illusion of persistence); OR
//   `TicketStatusBadge` conveys status by background color alone with no
//   accompanying glyph/text difference (AC-042 violated).
// Proof obligation:
//   (a) for the fixture ticket with `notify_failed: true`, the failure flag's
//       rendered indicator is present in `TicketQueueRow`'s collapsed (unexpanded)
//       view — assert this without ever clicking/expanding that row;
//   (b) the rendered list order matches the fixture data's `created_at` descending
//       order exactly (AC-041);
//   (c) for each of the three `TicketStatus` values present in the fixture set,
//       `TicketStatusBadge` renders both a distinct glyph character and a distinct
//       Vietnamese label text node, and no two statuses share either (AC-042);
//   (d) changing a ticket's status via `TicketStatusControl`, then reloading the page
//       against fixture data updated to reflect that change, shows the new status —
//       not the pre-change one (AC-023);
//   (e) submitting a note via `InternalNotesPanel` against a fixture success response
//       results in the note text appearing in the panel's rendered list.
