# Phase 3 Completion: Backend Shelves Composition — Integration Point

Covers Work Plan Phase 3 (Tasks P3-T1..P3-T2 / `exam-shelves-task-P3-T1.md`, `exam-shelves-task-P3-T2.md`).

**This is the backend's own named integration point** — the first moment the whole backend composition (Phase 1's ladder + Phase 2's extracted attempt read + the new RPC read) is operable together.

## All-Task Completion Checklist
- [ ] P3-T1 (`hotCounts.ts`) complete: single RPC call site + single window computation; `p_max_rows` imports `LIST_ROW_CEILING`.
- [ ] P3-T2 (`shelves.ts` + `shelves.int.test.ts` fill-in) complete: both candidates (5 assertions) green; AC-049 cross-shelf overlap assertion added and passing; 4-call budget proven via deferred-resolution gate technique.

## Test Skeleton / Verification Paths
- `SOURCE/features/exams/queries/__tests__/hotCounts.test.ts` — new
- `SOURCE/features/exams/__tests__/shelves.int.test.ts` — pre-committed skeleton, both candidates converted from `it.todo` to `it`

## Phase Completion Criteria (verbatim from Work Plan)
- [ ] `shelves.int.test.ts`'s 2 candidates (5 `it` cases) all green, converted from `it.todo`
- [ ] 4-call budget + concurrency proven via the deferred-resolution gate technique (per `rating.int.test.ts:676-706` precedent)
- [ ] Gates 1-3 green

## Verification Commands
```
cd SOURCE && npx vitest run features/exams/queries/__tests__/hotCounts.test.ts
cd SOURCE && npx vitest run features/exams/__tests__/shelves.int.test.ts
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npm run build
```

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 3's completion.

## Next Phase Gate
Phase 4 (`?sort=hot` axis) depends on P3-T2's `shelves.ts` composition landing (specifically `readHotCounts`/`hotWindows` from P3-T1 and `orderIdsByHotCount` from Phase 1, both reused by `ranking.ts`'s hot branch in P4-T2). Phase 7 (home block) also depends on P3-T2's `listHotExams` and can proceed in parallel with Phase 4-6 once this phase is complete.
