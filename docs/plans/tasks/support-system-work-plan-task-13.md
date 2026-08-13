# Task 13: `service-role.ts` additions + `admin/tickets/actions.ts` + `admin/tickets/page.tsx` (Work Plan Phase 3, Task 3.1)

Metadata:
- Dependencies: support-system-work-plan-task-03 (Deliverable: real applied schema/RPC), support-system-work-plan-task-04 (Deliverable: shared `TicketStatus`/`TicketActionState` types)
- Provides: `listSupportTickets`/`changeSupportTicketStatus`/`addSupportTicketNote` (`SOURCE/lib/supabase/service-role.ts`); `changeTicketStatusAction`/`addTicketNoteAction`; the exported `TicketWithNotes` type (consumed by task-14's `import type` reference)
- Size: Medium (3 files: `service-role.ts` additions, `actions.ts`, `page.tsx`)

## Implementation Content

Add `listSupportTickets` (batched: 1 `support_tickets` select + 1 `support_ticket_notes` select filtered by ids, grouped in JS, plus per-screenshot signed URLs), `changeSupportTicketStatus` (`.rpc("change_support_ticket_status", ...)`, never `.from().update()`), `addSupportTicketNote` (`adminId` from the caller's own `auth.uid()`, never client-supplied) to `service-role.ts`. Create `admin/tickets/actions.ts` (`changeTicketStatusAction`, `addTicketNoteAction` — each independently re-derives the user and re-checks `isAdminUserId()`, mirrors `moderateExamAction`; neither ever calls any mail-sending function, AC-030). Create `admin/tickets/page.tsx` (own `getCurrentUser()`+`isAdminUserId()`+`notFound()` guard, since `(admin)` has no shared `layout.tsx`; batched read via `listSupportTickets()`). Implement `SOURCE/app/(admin)/admin/tickets/__tests__/actions.int.test.ts` (mocked service-role client, per the skeleton's 3 groups).

## Target Files
- [ ] `SOURCE/lib/supabase/service-role.ts` (additive — `listSupportTickets`, `changeSupportTicketStatus`, `addSupportTicketNote`)
- [ ] `SOURCE/app/(admin)/admin/tickets/actions.ts` (new — `changeTicketStatusAction`, `addTicketNoteAction`)
- [ ] `SOURCE/app/(admin)/admin/tickets/page.tsx` (new — page guard + batched read)
- [ ] `SOURCE/app/(admin)/admin/tickets/__tests__/actions.int.test.ts` (fill in the skeleton)

## Investigation Targets
- `SOURCE/app/(admin)/admin/tickets/__tests__/actions.int.test.ts` (full file — Group 1-3 Behavior/Proof Obligation blocks: `first_status_transition_at` write-once, independent admin re-authorization, batched-read `notify_failed` supply)
- `docs/design/support-system-backend-design.md` (§ Data Contracts — `changeTicketStatusAction`/`addTicketNoteAction`/`listSupportTickets`/`changeSupportTicketStatus`/`addSupportTicketNote` literal code; § Schema & DB Enforcement §4 — `change_support_ticket_status`'s RPC-only requirement (D002 v1.2 fix); § Integration Point Map — Admin authorization; § Technical Dependencies §5)
- `SOURCE/app/(admin)/**` (an existing admin action, e.g. `moderateExamAction`, for the exact independent-re-authorization convention this task must mirror — `getCurrentUser()`+`isAdminUserId()` re-check inside the action body itself, never trusting a page-level guard)
- `SOURCE/lib/supabase/service-role.ts` (an existing service-role function, e.g. `listReportedExams`, for the batched-read/no-N+1 convention `listSupportTickets` must mirror)
- `SOURCE/lib/support/types.ts` (task-04's `TicketStatus`/`TicketActionState` — the shared types this task consumes)

## Change Category

`Change Category: state-change`

This task introduces the first write path for ticket status/notes beyond the student's own insert-own write (task-06) — a genuinely new class of state transition (admin-triggered). Sweep: confirm `changeTicketStatusAction`'s defensive `nextStatus` check rejects any value outside the fixed 3 statuses the same way `submitSupportTicket`'s intent check rejects an invalid intent (task-06), and confirm neither admin action ever calls a mail-sending function (AC-030), matching the plan's own explicit "no student status-change email exists anywhere in v1" invariant.

## Boundary Context (Connection Map)

**Boundary 1**: `TicketStatusControl` (browser) → `changeTicketStatusAction` (Server Action). This task owns the **right-side / action** owner (`SOURCE/app/(admin)/admin/tickets/actions.ts`); the left-side client adapter owner is task-14.
- **Serialized Format**: Hidden `<input name="ticketId">` + selected `<select name="status">`, both `FormData` fields.
- **Consumer Parse Rule**: task-14's local `statusFormAction` wrapper reads `formData.get("ticketId")`/`"status"`, casts `status` to `TicketStatus`.
- **Roundtrip check this task must satisfy**: this task's action reads exactly the `ticketId`/`status` field names task-14's adapter will construct; the DB CHECK constraint is the authoritative backstop against an invalid `status` value reaching persistence even if the defensive in-action check is somehow bypassed.
- **Expected Signal**: `TicketActionState` response; proven end-to-end once task-14's adapter exists (this task proves the server side in isolation via mocked-client tests).

**Boundary 2**: `InternalNoteForm` (browser) → `addTicketNoteAction` (Server Action). This task owns the **right-side / action** owner; the left-side client adapter owner is task-14.
- **Serialized Format**: Hidden `<input name="ticketId">` + `<textarea name="noteText">`, both `FormData` fields.
- **Consumer Parse Rule**: task-14's local `noteFormAction` wrapper reads both fields.
- **Roundtrip check this task must satisfy**: `adminId` is derived from the action's own `auth.uid()`, never accepted as a client-supplied `FormData` field — a note cannot be attributed to a different admin than the one who is actually authenticated.
- **Expected Signal**: `TicketActionState` response; the new note appears in `InternalNotesPanel`'s rendered list on success (task-14/task-15's responsibility to prove the render side).

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular `moderateExamAction`'s exact independent-re-authorization code shape to mirror.
- [ ] Sweep the adjacent cases per Change Category above; record findings in Investigation Notes.
- [ ] Write failing tests per the skeleton's 3 groups.
- [ ] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [ ] Implement `listSupportTickets`/`changeSupportTicketStatus`/`addSupportTicketNote` in `service-role.ts`.
- [ ] Implement `changeTicketStatusAction`/`addTicketNoteAction` in `actions.ts`, each with its own independent `isAdminUserId()` re-check.
- [ ] Implement `page.tsx`'s own guard + batched read.
- [ ] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests); re-confirm the Boundary Context roundtrip checks against task-14's expected adapter shape (read task-14's Investigation Targets note if needed to confirm field-name agreement in advance).
- [ ] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness (catches the `TicketWithNotes` transcription risk — Risk R-F2 — at task-14's later consumption point) — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: unit/integration coverage — Config: `SOURCE/vitest.config.ts` (`include: app/**`)
- Production build in CI (`npx next build`) — Enforces: build correctness — Config: `.github/workflows/ci.yml:74-80`

## Operation Verification Methods
- **Verification method**: admin-action int test (independent re-authorization, RPC-shape correctness, batched-read completeness), mocked service-role client.
- **Success criteria**: all 3 skeleton groups green (9 proof obligations); `changeSupportTicketStatus` always calls `.rpc(...)`, never `.from().update()`; `listSupportTickets` makes exactly 2 round trips regardless of ticket count.
- **Failure response**: if Group 1 fails (timestamp overwritten on second call), check that the caller forwards the RPC function's own returned row rather than re-deriving a timestamp locally.
- **Verification level**: L2 (new tests added and passing) — the real RPC atomicity and `authenticated`-cannot-call-it grant are proven by task-01's DDL + task-03/task-16's RLS regression, not by this task's mocked-client tests.

## Proof Obligations
- **Claim**: `first_status_transition_at` is written exactly once, on the first transition away from `new`, and never overwritten on a subsequent call (AC-047, `same-value` Failure Mode Checklist category).
- **Primary failure mode**: the caller issues a `.from("support_tickets").update(...)` call instead of `.rpc(...)` (reopening D002), or reads a stale/locally-cached timestamp instead of the function's own returned row.
- **Boundary to exercise**: in-process integration (mocked service-role client whose `.rpc()` mirrors the real function's CASE-expression semantics).
- **State assertion**: before = ticket at `status: 'new'`, `firstStatusTransitionAt: null`; action = two consecutive `changeSupportTicketStatus` calls; after = first call returns a non-null timestamp, second call returns the identical value.
- **Mock boundary rationale**: service-role client mocked; real atomicity proven by the function being a single SQL statement (task-01), not by this mock.
- **Residual**: the `authenticated`-cannot-call-it EXECUTE grant is proven by task-03's RLS harness, not by this task.
- **Claim**: both admin actions independently reject a non-admin caller, and no status change ever triggers any mail-sending call (AC-021, AC-024, AC-030).
- **Primary failure mode**: either action trusts a caller-supplied flag or the page-level guard instead of independently re-deriving the user and re-checking `isAdminUserId()`; or a status-change call triggers a mail-related function call.
- **Boundary to exercise**: in-process integration (mocked Supabase client with a non-admin session; mocked `isAdminUserId`).
- **State assertion**: before = mocked session is non-admin; action = call `changeTicketStatusAction`/`addTicketNoteAction`; after = both resolve to a refusal, and the mocked service-role write functions are never invoked.
- **Mock boundary rationale**: Supabase client + `isAdminUserId` mocked for determinism; service-role write functions mocked to assert never-invoked.
- **Residual**: none — this is the exact documented risk the backend DD's own biggest_risks entry names (any authenticated student could invoke the action id directly if the re-check is skipped).
- **Claim**: `listSupportTickets` returns a batched read (exactly 2 round trips) with `notify_failed` always present, never conditionally omitted (AC-022 data half).
- **Primary failure mode**: `notify_failed` is dropped from the select's column list or object shape (silent mail outage invisible in the admin list); or the implementation issues a per-ticket round trip for notes instead of one batched `where ticket_id in [...]` select (N+1).
- **Boundary to exercise**: in-process integration (mocked service-role client returning two batched result sets).
- **State assertion**: N/A (read-only).
- **Mock boundary rationale**: service-role client mocked to assert exact call count/shape.
- **Residual**: the UI rendering half of AC-022 (flag visible in the collapsed row) is task-15's fixture-e2e responsibility, not this task's.
- **Claim**: `changeTicketStatusAction` defensively rejects a `nextStatus` value outside the fixed 3 `TicketStatus` values before ever calling `changeSupportTicketStatus` (`invalid option` Failure Mode Checklist category, AC-029 UI-cannot-construct-invalid-value half).
- **Primary failure mode**: the action forwards an out-of-range status value straight to the service-role call, relying entirely on the DB CHECK constraint as the only gate — defeating the defensive-check convention this design otherwise applies consistently (mirrors `submitSupportTicket`'s own intent check, task-06).
- **Boundary to exercise**: in-process integration (mocked Supabase client + mocked `changeSupportTicketStatus`, called with a status value outside `{new,in_progress,resolved}`).
- **State assertion**: N/A.
- **Mock boundary rationale**: service-role client mocked; the DB CHECK constraint remains the authoritative backstop (task-01), this test proves the defensive application-layer check.
- **Residual**: none.

## Completion Criteria
- [ ] All added tests pass (3 skeleton groups, 9 proof obligations)
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [ ] Matches the backend DD's Data Contracts §changeTicketStatusAction/§addTicketNoteAction/§listSupportTickets exactly
- [ ] `tsc`/lint clean
- [ ] The exported `TicketWithNotes` type is available for task-14's `import type` reference before that task begins (retires Risk R-F2 early)

## Notes
- Impact scope: `SOURCE/lib/supabase/service-role.ts` (additive), `SOURCE/app/(admin)/admin/tickets/actions.ts`, `SOURCE/app/(admin)/admin/tickets/page.tsx`.
- Scope boundary: do not implement any admin-rendering component here — task-14's responsibility. `page.tsx`'s render is limited to a minimal placeholder/prop-passing shell sufficient to keep the build green through this task; task-14 adds the real component tree.
