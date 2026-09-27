# Phase 6 Completion: Attempt-Source `?from=` Chain Wiring

Covers Work Plan Phase 6 (Task P6-T1 / `exam-shelves-task-P6-T1.md`).

## All-Task Completion Checklist
- [ ] P6-T1 (`?from=` chain: detail page + `StartAttemptButton`) complete: manual smoke test on dev confirms `?from=hot` card start writes `source='hot'`; flat-grid/home-block start writes `source='none'`.

## Test Skeleton / Verification Paths
- No new automated test skeleton for this phase — verification is the manual smoke test recorded in P6-T1's Investigation Notes, plus gates 1-4.

## Phase Completion Criteria (verbatim from Work Plan, L1)
- [ ] Starting an attempt from a `?from=hot` card writes `source='hot'` on dev; a flat-grid/home-block start writes `source='none'`
- [ ] Gates 1-4 green

## Verification Commands
```
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npx vitest run
cd SOURCE && npm run build
```
(Manual: start an attempt from a shelf card and from the flat grid; read `exam_attempts.source` back on dev via the CLI session.)

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 6's completion.

## Next Phase Gate
Phase 8 (P8-T1, P8-T4) depends on this phase, plus Phase 5 and Phase 7, all being complete — the RLS/verify-schema probes and the service e2e run against a fully-wired feature. Phase 7 does not depend on Phase 6 and may already be complete or in progress in parallel.
