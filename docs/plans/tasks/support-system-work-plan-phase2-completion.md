# Phase 2 Completion: Frontend Widget — Student-Facing Surface

Covers Work Plan Phase 2 (Tasks 2.0-2.4 / `support-system-work-plan-task-07.md` through `support-system-work-plan-task-11.md`).

## All-Task Completion Checklist

- [ ] Task 07 (2.0 — fixture-e2e harness setup) complete: fixture profiles + override boundary importable, confirmed loadable via a throwaway Playwright MCP session.
- [ ] Task 08 (2.1 — `support.*` i18n keys) complete: `i18n.test.ts` parity assertion green.
- [ ] Task 09 (2.2 — `SupportWidget` tree + 5 mount points) complete: all component tests green; AC-035 code-review pass recorded.
- [ ] Task 10 (2.3 — fixture-e2e widget-visibility, **required blocking Early Verification Point**) complete: Obligations A/B/C all pass in a real browser.
- [ ] Task 11 (2.4 — fixture-e2e ticket-submission, RESERVED SLOT) complete: all 5 journey obligations pass.

## Test Skeleton File Paths for Verification

- `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` — expect Obligation A (a), Obligation B (a)-(c), Obligation C (a)-(b) all passing
- `SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts` — expect Journey obligations (a)-(e) all passing
- Component test files for `SupportWidget`/`SupportWidgetTrigger`/`SupportWidgetDialog`/`IntentSelector`/`MessageField`/`ScreenshotAttachment` (task-09) — expect all green

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] Early Verification Point passed: all four `{ user, pathname }` combinations render/don't-render correctly across a representative sample of the five real mount pathnames, and the manual 360px Playwright pass confirms zero `BottomNav` intersection on at least one real mounted route — AC-001, AC-003, AC-005, AC-006, AC-007
- [ ] `support-widget-visibility` fixture-e2e green (3/3 obligations) — AC-003, AC-005, AC-006, metric 8, metric 9
- [ ] `support-ticket-submission` fixture-e2e green (5/5 obligations) — AC-001, AC-011 (UI half), AC-020, AC-039, AC-040, AC-049 (UI half)

## Verification Commands

```
cd SOURCE && npx vitest run components/support
cd SOURCE && npx vitest run lib/i18n/__tests__/i18n.test.ts
cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npm run build
```

Manual: run `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` and `support-ticket-submission.fixture.e2e.test.ts` against a real browser (Playwright MCP or equivalent) per each file's own driver instructions.

## Next Phase Gate

Phase 3 (Task 12/13/14/15) must not begin until Task 10's Early Verification Point is fully green — the frontend DD's own Failure response: "stop before wiring the dialog to the real backend action — an incorrect guard is a visibility bug independent of submission logic." Task 12 (fixture-e2e admin harness) has no dependency on this phase and could technically start in parallel once Phase 2 begins, but Task 13's dependency on Task 03/04 (not this phase) is the actual gate for Phase 3's backend half.
