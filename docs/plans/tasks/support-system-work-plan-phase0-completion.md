# Phase 0 Completion: Schema/DDL Foundation (BLOCKING MANUAL CHECKPOINT)

Covers Work Plan Phase 0 (Tasks 0.1-0.3 / `support-system-work-plan-task-01.md` through `support-system-work-plan-task-03.md`).

## All-Task Completion Checklist

- [ ] Task 01 (0.1 — schema.sql draft + fingerprint sync + verify-schema.ts/setup-storage.ts wiring) complete: `npm test` (schema fingerprint + FK-parser suites) green on staged DDL.
- [ ] Task 02 (0.2 — **MANUAL, BLOCKING**: apply schema.sql to Supabase + run verify:schema) complete: human engineer confirms `npm run verify:schema` passes for the dev environment.
- [ ] Task 03 (0.3 — RLS harness ST-a..ST-e, Early Verification Point) complete: `cd SOURCE && npx tsx supabase/test-rls.ts` exits 0, all five cases pass with real error-class discrimination and state-recount discipline.

## Test Skeleton / Verification Paths

- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`, `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` — expect green against the staged/applied `schema.sql`
- `SOURCE/supabase/test-rls.ts` (new section, cases ST-a..ST-e) — expect the full suite to exit 0
- `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` — expect reduced to a pointer comment once ported

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] Early Verification Point passed: `test-rls.ts` ST-a..ST-e green against real local Postgres with the harness's own state-recount/error-class discipline (AC-015, AC-025, AC-048, AC-013, metrics 1-3) — ST-e closes document review finding I001
- [ ] `npm run verify:schema` confirms no drift for at least the dev environment (prod re-verified before launch)
- [ ] `support_tickets` + `support_ticket_notes` + `change_support_ticket_status` + `support-screenshots` bucket policy all applied idempotently

## Verification Commands

```
cd SOURCE && npm test
cd SOURCE && npm run verify:schema
cd SOURCE && npx tsx supabase/test-rls.ts
```

## Next Phase Gate

Phase 1 (Task 04/05/06) may only begin once this phase's Early Verification Point (Task 03) is fully green — the backend DD's own Failure response: "do not build lib/support/lib/mail/the admin route on top of an unverified authorization layer." Task 04 and Task 05 have zero DB dependency and could technically be authored in parallel with Phase 0, but Task 06 (which both depend on) is hard-blocked on Task 03.
