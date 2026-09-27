# Phase 7 Completion: Home Block Guarded Hot Fetch

Covers Work Plan Phase 7 (Task P7-T1 / `exam-shelves-task-P7-T1.md`).

**Runs in parallel with Phases 4-6** — this phase depends only on Phase 3 (P3-T2)'s `listHotExams`.

## All-Task Completion Checklist
- [ ] P7-T1 (home guarded hot fetch) complete: anonymous visitor issues 0 RPC calls; signed-in visitor sees the hot order or the section absent (0 site-wide attempts), with 0 errors.

## Test Skeleton / Verification Paths
- No new dedicated skeleton file for this phase — verification is a call-count assertion (local to P7-T1) plus manual smoke test on `/` signed-in and signed-out.

## Phase Completion Criteria (verbatim from Work Plan, L1)
- [ ] Home right column shows "Đề nổi nhất" + top-3 hot exams for a signed-in visitor with data
- [ ] Anonymous visitor renders the signed-out hero with 0 RPC calls
- [ ] Gates 1-4 green

## Verification Commands
```
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npx vitest run
cd SOURCE && npm run build
```
(Manual: load `/` signed-in with data, signed-in with 0 site-wide attempts, and signed-out; confirm call counts and rendered sections match.)

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 7's completion.

## Next Phase Gate
Phase 8 (P8-T1, P8-T4) depends on this phase being complete, alongside Phase 5 and Phase 6.
