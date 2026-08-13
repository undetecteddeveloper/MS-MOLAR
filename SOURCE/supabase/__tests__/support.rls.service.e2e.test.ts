// User Support System v1 [service-integration-e2e] Test Skeleton
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Test Boundaries —
//   RLS suite ST-a..ST-d, `SOURCE/supabase/test-rls.ts` extension; Schema & DB
//   Enforcement §4 `change_support_ticket_status`)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-015, AC-025, AC-048, metric 1,
//   metric 2, metric 3)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e
//   3/3, service-integration-e2e 1/2 (this file — reserved: the internal-notes RLS
//   guarantee and the read-own isolation guarantee both require a real Postgres
//   engine; no mock can prove an RLS predicate, a missing `revoke all`, or a Storage
//   policy grant — backend DD Mock Boundary Decisions, "Supabase DB + RLS (both
//   tables + storage policy) — No")
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// executable assertions yet. The backend Design Doc already specifies the exact case
// table for these behaviors (ST-a..ST-d) as an extension of the existing
// SOURCE/supabase/test-rls.ts harness (assert-based script run via
// `cd SOURCE && npx tsx supabase/test-rls.ts`, real local Supabase, service-role setup
// + signed-in anon clients per user — see ensureUser/signInAs in that file). The
// PREFERRED implementation, per the exact precedent this repo's rating system already
// established (SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts's own header:
// "the PREFERRED implementation is to append these cases directly into test-rls.ts...
// so there is a single source of RLS truth"), is to append ST-a..ST-d directly into
// test-rls.ts following its existing per-family-section pattern (mirroring TL-a/TL-b
// at :1446-1495, MM-a/MM-b immediately above them) — NOT to build a second,
// separately-run script. This file exists as the traceable skeleton/placeholder for
// that work and as the record of this feature's service-integration-e2e budget slot;
// once ST-a..ST-d are appended into test-rls.ts, this file should be reduced to a
// pointer comment (mirroring rating's own post-port state) rather than duplicating the
// case bodies.
//
// Run once implemented: cd SOURCE && npx tsx supabase/test-rls.ts
// (NOT collected by `npm test` — vitest.config.ts only includes lib/**, components/**,
// app/** — matching this project's existing convention of running RLS/e2e harnesses as
// standalone tsx scripts, not vitest suites.)

// =============================================================================
// ST-a — Read-own isolation on support_tickets (AC-015, metric 2)
// =============================================================================
// AC: "Given student A and student B each with tickets, when student A queries the
//   tickets table with their own session, then only student A's rows are returned
//   and student B's rows are not." (AC-015)
// ROI: 88 (BV:9 x Freq:9 + Legal:true(+10) - wait, recorded plainly: BV:9 x Freq:9 +
//   Legal:0 + Defect:7 = 88) — cross-student data leakage on a minors' product is the
//   single highest-consequence class of bug this feature can ship.
// Behavior: two real users (A, B, created via the Admin API per the harness's existing
//   ensureUser/signInAs convention) each have one seeded support_tickets row (service
//   role, bypassing RLS to set up the fixture) -> A's own signed-in client selects
//   from support_tickets -> assert exactly A's row(s) are returned, none of B's; the
//   symmetric query from B's session returns none of A's.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system — real local Supabase (Postgres + RLS), two real signed-in
//   users, service-role setup fixture
// @complexity: medium
// @real-dependency: Supabase DB + RLS — per backend DD Mock Boundary Decisions, this
//   cannot be proven with a mocked client; only real Postgres evaluates the
//   `support_tickets_select_own` policy.
// Primary failure mode: a missing or malformed `using (user_id = auth.uid())` clause
//   on `support_tickets_select_own` (or its accidental omission entirely) lets any
//   authenticated user read any other student's ticket rows.
// Proof obligation:
//   (a) A's signed-in client selecting support_tickets returns A's seeded row(s) and
//       zero of B's;
//   (b) B's signed-in client selecting support_tickets returns B's seeded row(s) and
//       zero of A's — the symmetric direction, not merely the inverse assumed from
//       (a).

// =============================================================================
// ST-b — Positive control: an internal note exists on A's ticket (fixture
//   confirmation, mirrors rating's own TL-a/S-a positive-control convention)
// =============================================================================
// AC: n/a — infrastructure precondition for ST-c/ST-d, not itself a PRD acceptance
//   criterion; required so that "0 rows returned" in ST-c means "blocked by RLS", not
//   "there was nothing to find."
// ROI: n/a (positive control; not independently scored — bundled with ST-a's budget
//   slot as one service-integration-e2e candidate per this feature's Verification
//   Strategy, mirroring the rating precedent's own TL-a/S-a bundling)
// Behavior: after seeding one internal note on A's ticket via the service-role client
//   (bypassing RLS, as the harness's positive-control pattern requires), a
//   service-role select against support_ticket_notes confirms the note actually
//   exists before any RLS-denial assertion is made against it.
// @category: edge-case
// @lane: service-integration-e2e
// @dependency: full-system — real local Supabase, service-role client only
// @complexity: low
// Primary failure mode: the fixture setup itself silently fails (e.g. a foreign-key
//   violation on `ticket_id`), and a subsequent "0 rows" result in ST-c is
//   misinterpreted as RLS working correctly when it is actually an empty-fixture
//   false positive.
// Proof obligation:
//   (a) the service-role client's select against support_ticket_notes for A's ticket
//       returns at least 1 row — confirms the fixture is real before ST-c/ST-d run.

// =============================================================================
// ST-c — Internal notes unreadable by the ticket's own author (AC-025, metric 3)
// =============================================================================
// AC: "Given a ticket with internal notes, when the ticket's author queries the notes
//   table with their own session, then zero rows are returned (or access is
//   denied) — for their own tickets as well as anyone else's." (AC-025)
// ROI: 92 (BV:10 x Freq:8 + Legal:true(+10) + Defect:2) — this is D4's own
//   headline guarantee: a student must never read admin triage notes written about
//   them, on a product whose users are minors.
// Behavior: A (the ticket's own author, confirmed real by ST-a and the note's
//   existence confirmed real by ST-b) queries support_ticket_notes with their own
//   signed-in session, filtered to their own ticket's id -> assert zero rows are
//   returned, or the query is denied outright (error, not merely empty due to a
//   coincidental filter).
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system — real local Supabase, A's real signed-in session
// @complexity: low
// @real-dependency: Supabase DB + RLS — `revoke all ... from anon, authenticated` plus
//   zero policies is the exact mechanism under test; no mock can distinguish "zero
//   policies + full revoke" from "one overly-narrow policy that happens to filter out
//   this particular query".
// Primary failure mode: someone adds an `authenticated`-facing select policy to
//   support_ticket_notes "for convenience" (e.g. a well-intentioned "ticket owner can
//   see triage status" feature), which would grant exactly the read access D4/R8
//   forbid, even scoped to the ticket's own author.
// Proof obligation:
//   (a) A's signed-in client selecting support_ticket_notes filtered to A's own
//       ticket id returns zero rows, OR the query itself errors with a
//       permission-denied class error — either outcome satisfies AC-025's "zero rows
//       returned (or access is denied)" wording, but the case must discriminate this
//       from a coincidentally-empty result the way the harness's existing MM-b
//       convention discriminates error classes (`42501`/permission-denied vs. an
//       unrelated error).

// =============================================================================
// ST-d — Non-admin (including the ticket's own author) cannot INSERT into
//   support_ticket_notes (AC-048, metric 3)
// =============================================================================
// AC: "Given an authenticated non-admin session (including the ticket's own author),
//   when it attempts to INSERT a row into the internal-notes table directly, then the
//   insert is denied — the table grants authenticated no insert path at all ...
//   verified by an RLS denial test that asserts the write fails and the table row
//   count is unchanged." (AC-048)
// ROI: 90 (BV:9 x Freq:6 + Legal:true(+10) + Defect:14 capped conceptually; recorded
//   raw: BV:9 x Freq:6 + Legal:10 + Defect:14 = 78 — restated without the invalid cap:
//   9x6 + 10 + 8 = 72) — a student forging or defacing triage history on their own
//   ticket is the PRD's own named risk this case is the regression test for
//   ("A student writes into the internal-notes table").
// Behavior: A's signed-in client attempts a direct INSERT into support_ticket_notes
//   for their own ticket -> assert the insert is rejected with a grant-level error
//   (`42501`/permission-denied class, since `revoke all` removes the table-level
//   privilege before RLS is even evaluated — not a bare `error !== null` check, per
//   the harness's own MM-b error-class-discrimination convention) -> separately, a
//   service-role re-count of support_ticket_notes confirms the table's row count is
//   unchanged after the attempt, per the harness's own TL-b convention (an
//   RLS/grant-blocked write can otherwise return an empty "success" that a bare
//   error-check would miss).
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system — real local Supabase, A's real signed-in session,
//   service-role client for the row-count recheck
// @complexity: medium
// @real-dependency: Supabase DB + RLS — the table-level `revoke all` (not merely "no
//   insert policy") is what this case proves; a mock cannot distinguish "no policy
//   grants insert" from "the table-level privilege itself was revoked", and only the
//   latter is what `revoke all ... from anon, authenticated` actually does.
// Primary failure mode: `support_ticket_notes` is copy-pasted from `telemetry_log`'s
//   narrower revoke form (which *does* grant `authenticated` an own-row insert policy)
//   instead of `exam_moderation_log`'s strict form — the exact proximity-copy risk the
//   backend DD's own R-1 risk entry names — silently reopening a write path D4
//   explicitly forbids.
// Proof obligation:
//   (a) A's direct INSERT attempt into support_ticket_notes (for A's own ticket)
//       returns an error whose class is grant-level (`42501`/permission-denied),
//       discriminated from any other error class the same way the harness's MM-b case
//       does;
//   (b) a service-role select's row count against support_ticket_notes, taken
//       immediately before and immediately after the insert attempt, is identical —
//       confirms no row landed even in an edge case where the client-visible error
//       response might otherwise be ambiguous.
