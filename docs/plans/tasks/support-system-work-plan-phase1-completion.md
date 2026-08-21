# Phase 1 Completion: Backend Write Path — `submitSupportTicket` + Mail Module

Covers Work Plan Phase 1 (Tasks 1.1-1.3 / `support-system-work-plan-task-04.md` through `support-system-work-plan-task-06.md`).

## All-Task Completion Checklist

- [ ] Task 04 (1.1 — `limits.ts`/`types.ts`/`validateScreenshot.ts`) complete: boundary-fixture battery green (exact limit/one-over/each allowed MIME/disallowed MIME); `tsc`/lint clean.
- [ ] Task 05 (1.2 — `sendSupportNotification`/`checkEnv`/secret-scan/`nodemailer`) complete: skeleton Groups 1-3 green (8 proof obligations); `checkEnv.test.ts` extended cases green; `i18n.test.ts`'s new `report-ms`-absence assertion green.
- [ ] Task 06 (1.3 — `RATE_LIMITS.submitTicket` + `submitSupportTicket`) complete: skeleton Groups 1-4 green (14 proof obligations); Group 4a's response-not-gated-on-mail proof passes.

## Test Skeleton File Paths for Verification

- `SOURCE/lib/support/__tests__/validateScreenshot.test.ts` (no skeleton, authored fresh at Task 04) — expect boundary-fixture battery passing
- `SOURCE/lib/mail/__tests__/sendSupportNotification.int.test.ts` — expect Group 1 (a)-(c), Group 2 (a)-(b), Group 3 (a)-(c) all green
- `SOURCE/lib/env/__tests__/checkEnv.test.ts` — expect `goodEnv()` extension + 3 new per-variable cases green
- `SOURCE/lib/i18n/__tests__/i18n.test.ts` — expect the new `report-ms`-absence assertion green
- `SOURCE/lib/support/__tests__/actions.int.test.ts` — expect Group 1 (a)-(d), Group 2 (a)-(c), Group 3 (a)-(b), Group 4 (a)-(c) all green

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] `submitSupportTicket` contract matches the backend DD exactly (closed-union return, never leaks raw DB/Storage error text, `user_id` always `auth.uid()`-defaulted) — AC-002 (server half), AC-004, AC-008, AC-009, AC-010, AC-011 (schema-shape half), AC-012, AC-018, AC-019, AC-028, AC-031, AC-032
- [ ] `sendSupportNotification`/`composeSupportNotificationSubject` never throws and every generated subject carries the `[report-ms] ` prefix across all 3 intents × 2 locales including the failure branch — AC-033, AC-034, AC-043, AC-044, AC-045, AC-046, metric 14
- [ ] `shortRef` derivation is 1:1 server-derivable and never accepted as input — AC-049

## Verification Commands

```
cd SOURCE && npx vitest run lib/support/__tests__/validateScreenshot.test.ts
cd SOURCE && npx vitest run lib/mail/__tests__/sendSupportNotification.int.test.ts
cd SOURCE && npx vitest run lib/env/__tests__/checkEnv.test.ts
cd SOURCE && npx vitest run lib/i18n/__tests__/i18n.test.ts
cd SOURCE && npx vitest run lib/support/__tests__/actions.int.test.ts
cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npm run build
```

## Next Phase Gate

Phase 2 (Task 09) depends on Task 06's real `submitSupportTicket` contract for its eventual live-backend wiring pass — but Task 09's own component tests mock that boundary and are not blocked by Task 06's completion, only by Phase 1 completing before Phase 2's live-wiring pass (per the work plan's own diagram-legend note). Phase 3 (Task 13) depends on Task 04's shared types, not on Task 05/06.
