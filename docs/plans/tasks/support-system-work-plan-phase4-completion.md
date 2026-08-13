# Final Phase Completion: Quality Assurance

Covers Work Plan Final Phase (Tasks F.1-F.9 / `support-system-work-plan-task-16.md` through `support-system-work-plan-task-18.md`; this is the plan's 5th phase, numbered `phase4` continuing the sequence after Phase 0-3).

## All-Task Completion Checklist

- [ ] Task 16 (F.1 — full RLS regression + confirm pointer reduction) complete: `cd SOURCE && npx tsx supabase/test-rls.ts` exits 0 (full suite, incl. ST-a..ST-e); `support.rls.service.e2e.test.ts` confirmed still a pointer comment.
- [ ] Task 17 (F.2 — **MANUAL**: `ADMIN_USER_IDS` Vercel Preview-scope fix, TD-014) complete: human engineer confirms `/admin/tickets` renders (not 404s) on a Preview deployment.
- [ ] Task 18 (F.3-F.9 — folded Final QA sweep) complete: all 7 sub-items (AC verification, security review, quality checks, full test run, a11y pass, coverage check, doc-update confirmation) signed off with no open findings.

## Test Skeleton / Verification Paths

- `SOURCE/supabase/test-rls.ts` (full suite, incl. ST-a..ST-e) — expect exit 0
- Full vitest suite: `SOURCE/lib/support/**`, `SOURCE/lib/mail/**`, `SOURCE/lib/ugc/limits.ts`, `SOURCE/components/support/**`, `SOURCE/app/(admin)/admin/tickets/**`
- `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts`, `support-ticket-submission.fixture.e2e.test.ts`, `support-admin-triage.fixture.e2e.test.ts` — expect all 3 re-confirmed green

## Phase Completion Criteria (verbatim from Work Plan's overall Completion Criteria)

- [ ] All phases (0-3 + Final) completed
- [ ] All integration/fixture-e2e/service-integration-e2e tests passing (3 integration files, 3 fixture-e2e files, `test-rls.ts` full suite incl. ST-a..ST-e)
- [ ] Both Design Docs' acceptance criteria satisfied (see Task 18)
- [ ] Staged quality checks completed (zero errors) — `cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npx vitest run && npm run build`
- [ ] All tests pass
- [ ] `ADMIN_USER_IDS` Preview-scope manual fix applied (Task 17) so the admin surface is QA-able off Production
- [ ] Necessary documentation updated (none required beyond this plan)
- [ ] User review approval obtained

## Verification Commands

```
cd SOURCE && npx tsx supabase/test-rls.ts
cd SOURCE && npx vitest run
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npm run build
cd SOURCE && npm run check:bundle
```

Manual: Task 17's Vercel Preview-scope confirmation; Task 18's manual keyboard pass across the widget and admin page; the 3 fixture-e2e journeys re-run against a real browser.

## Next Phase Gate

None — this is the final phase. Once all three tasks are green and the human engineer has confirmed both manual checkpoints (Task 02's schema apply, already confirmed in Phase 0, and Task 17's `ADMIN_USER_IDS` Preview-scope fix), the feature is ready for user review approval per the work plan's overall Completion Criteria.
