# Phase 4 Completion: The `?sort=hot` Axis

Covers Work Plan Phase 4 (Tasks P4-T1..P4-T4 / `exam-shelves-task-P4-T1.md` through `exam-shelves-task-P4-T4.md`).

**Gate**: P4-T1's 4 edits (`ExamSort` union, `DEFAULT_ASCENDING`, inner branch, page whitelist) MUST land as exactly one commit. Verify this via `git log` before considering Phase 4 started correctly.

## All-Task Completion Checklist
- [ ] P4-T1 (`ExamSort` widening — SINGLE COMMIT) complete: `git log` confirms one commit; `tsc` passes; outer `if/else` structure at `catalogue.ts:105-117` untouched besides the inner case.
- [ ] P4-T2 (`ranking.ts` hot branch) complete: 4th `Promise.all` member guarded correctly; `readHotCounts`/`orderIdsByHotCount` reused.
- [ ] P4-T3 (`rating.int.test.ts` candidate 3/3 fill-in) complete: both obligations pass; `git diff` confirms 0 changes to lines 1-747.
- [ ] P4-T4 (`ExamFilters` Nổi nhất chip) complete: 5-chip order correct; 0 changed props on the existing 4.

## Test Skeleton / Verification Paths
- `SOURCE/features/exams/__tests__/rating.int.test.ts:748-833` — pre-committed skeleton, filled in by P4-T3
- `SOURCE/features/exams/components/__tests__/ExamFilters.test.tsx` (extended, per P4-T4)

## Phase Completion Criteria (verbatim from Work Plan)
- [ ] `catalogue.ts` union + `DEFAULT_ASCENDING` + inner branch landed in exactly ONE commit
- [ ] `rating.int.test.ts`'s new candidate-3 cases green; lines 1-747 byte-identical to before this phase
- [ ] `ExamFilters` shows 4 chips, 0 changed props on the original 3
- [ ] Gates 1-3 green

## Verification Commands
```
cd SOURCE && git log --oneline -- features/exams/queries/catalogue.ts app/\(exams\)/exams/page.tsx
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx vitest run features/exams/__tests__/rating.int.test.ts
cd SOURCE && git diff -- features/exams/__tests__/rating.int.test.ts
cd SOURCE && npx vitest run features/exams/components/__tests__/ExamFilters.test.tsx
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npm run build
```

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 4's completion.

## Next Phase Gate
Phase 5 depends on P1-T6 (`hasBrowseParam`, from Phase 1), P2-T3 (`ExamShelf`, from Phase 2), and P4-T4 (the chip, from this phase) — all three must be green before `page.tsx`'s branch (P5-T1) is wired. Phase 5's fixture-e2e (P5-T2) additionally depends on P5-T1.
