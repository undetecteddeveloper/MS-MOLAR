# Phase 3 Completion: Admin Queue — Backend + Frontend

Covers Work Plan Phase 3 (Tasks 3.0-3.3 / `support-system-work-plan-task-12.md` through `support-system-work-plan-task-15.md`).

## All-Task Completion Checklist

- [ ] Task 12 (3.0 — fixture-e2e admin harness setup) complete: fixture profiles + override boundary importable, confirmed loadable via a throwaway Playwright MCP session.
- [ ] Task 13 (3.1 — `service-role.ts` additions + `admin/tickets/actions.ts` + `page.tsx`) complete: skeleton Groups 1-3 green (9 proof obligations); `TicketWithNotes` type exported.
- [ ] Task 14 (3.2 — `support.admin.*` i18n keys + admin components) complete: all component tests green, including the AC-014 `<img>`-only render-path assertion; `tsc`/lint clean (Risk R-F2 reconciliation confirmed here).
- [ ] Task 15 (3.3 — fixture-e2e admin-triage) complete: all 5 journey obligations pass.

## Test Skeleton File Paths for Verification

- `SOURCE/app/(admin)/admin/tickets/__tests__/actions.int.test.ts` — expect Group 1 (a)-(b), Group 2 (a)-(d), Group 3 (a)-(c) all green
- `SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts` — expect Journey obligations (a)-(e) all passing
- Component test files for `TicketQueueList`/`TicketQueueRow`/`TicketStatusBadge`/`NotificationFailureFlag`/`TicketDetailPanel`/`TicketStatusControl`/`InternalNotesPanel` (task-14) — expect all green

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] Both admin actions independently reject a non-admin caller regardless of page-level guard state — AC-021, AC-024
- [ ] `first_status_transition_at` written exactly once and never overwritten across consecutive status changes (skeleton Group 1) — AC-047
- [ ] `listSupportTickets` returns a batched read with `notify_failed` always present (never conditionally omitted) — AC-022 (data half)
- [ ] `support-admin-triage` fixture-e2e green (5/5 obligations) — AC-022 (UI half), AC-023, AC-027, AC-029 (UI-cannot-construct-invalid-value half), AC-030, AC-041, AC-042
- [ ] `TicketDetailPanel` renders the screenshot exclusively via a plain `<img src>` bound to the signed URL, never through any markup-interpreting render path — AC-014 (closes document review finding I002)

## Verification Commands

```
cd SOURCE && npx vitest run "app/(admin)/admin/tickets"
cd SOURCE && npx vitest run lib/i18n/__tests__/i18n.test.ts
cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npm run build
```

Manual: run `SOURCE/tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts` against a real browser (Playwright MCP or equivalent) per the file's own driver instructions.

## Next Phase Gate

The Final Phase's Task F.1 (full RLS regression) depends on Task 03's completed harness plus this phase's admin write paths being in place so the regression run exercises the complete feature surface. Task F.3's AC sweep depends on this phase's `TicketDetailPanel`/`TicketStatusBadge`/admin-action proofs to confirm AC-014/AC-023/AC-041/AC-042 etc. are genuinely closed, not merely planned.
