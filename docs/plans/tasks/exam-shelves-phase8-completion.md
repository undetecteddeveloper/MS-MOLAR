# Phase 8 Completion: Backend Verification Hardening — RLS Proof, verify-schema Probes, Service E2E

Covers Work Plan Phase 8 (Tasks P8-T1..P8-T4 / `exam-shelves-task-P8-T1.md` through `exam-shelves-task-P8-T4.md`).

**This is the plan's designated last automatable phase for the service-integration-e2e lane** — gate 6 becomes fully meaningful for this feature only once P8-T4 lands.

## All-Task Completion Checklist
- [ ] P8-T1 (`verify-schema.ts` probes) complete: `npm run verify:schema` green on dev, incl. 2 new `exam_hot_counts` probes.
- [ ] P8-T2 (`test-rls.ts` Phần 10) complete: all 7 cases (HS-a..HS-g) pass on dev.
- [ ] P8-T3 (`examHotCountsFixtures.ts`) complete: module compiles; `setUp`/`tearDown` idempotent.
- [ ] P8-T4 (service e2e fill-in) complete: `npm run test:localdb` green, all 6 obligations pass.

## Test Skeleton / Verification Paths
- `SOURCE/supabase/verify-schema.ts:448-493` — extended
- `SOURCE/supabase/test-rls.ts` (Phần 10, cases HS-a..HS-g) — new section
- `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` — new
- `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` — pre-committed skeleton, all 6 obligations converted from `it.todo` to `it`

## Phase Completion Criteria (verbatim from Work Plan, L2 on live dev)
- [ ] `test-rls.ts` Phần 10 all 7 cases (HS-a..HS-g) pass on dev
- [ ] `verify:schema` green, including the 2 new `exam_hot_counts` probes
- [ ] `test:localdb` green, including all 6 obligations of `exam-hot-counts.service.e2e.test.ts`
- [ ] Gates 1-6 all green for the first time with every feature test file present

## Verification Commands
```
cd SOURCE && npm run verify:schema
cd SOURCE && npx tsx supabase/test-rls.ts
cd SOURCE && npm run test:localdb
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npx vitest run
cd SOURCE && npm run build
cd SOURCE && npm run test:fixture
```

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 8's completion — this is the last phase before Final QA's own confirmation of the same baseline (FQA-T2).

## Next Phase Gate
The Final Phase (FQA-T1..T10) depends on Phase 8 being fully complete — it is the last phase before sign-off. FQA-T1 (Traceability coverage check), FQA-T2 (all 6 gates real exit codes), and the manual gates (FQA-T5/T6/T7) all assume every feature test file (`shelves.int.test.ts`, `rating.int.test.ts`'s appended block, `exam-shelves.fixture.e2e.test.ts`, `exam-hot-counts.service.e2e.test.ts`) is fully filled in with 0 remaining `it.todo`.
