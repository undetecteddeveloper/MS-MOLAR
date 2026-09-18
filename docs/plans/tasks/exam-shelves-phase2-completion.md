# Phase 2 Completion: ExamCard Visual Extension, ExamRibbon, ExamShelf Component + Attempt-Read Extraction

Covers Work Plan Phase 2 (Tasks P2-T1..P2-T4 / `exam-shelves-task-P2-T1.md` through `exam-shelves-task-P2-T4.md`).

**Gate**: P1-T1 (ExamCard pre-change snapshot) must be committed before P2-T2 begins. P2-T2 itself is a hard-stop checkpoint (frontend DD Risk R-2) — do not proceed past P2-T2 if its bare-card snapshot requires `-u`.

## All-Task Completion Checklist
- [ ] P2-T1 (`ExamRibbon.tsx`) complete: `aria-hidden`, `pointer-events-none`, `data-slot="ribbon"` all present; text matches `label` exactly.
- [ ] P2-T2 (`ExamCard` 3 props — AC-043 moment) complete: bare-card case 0-diff with no `-u`; `from`/`ribbon` cases pass their structural assertions.
- [ ] P2-T3 (`ExamShelf.tsx`) complete: full AC list (002/003/004/026/032/035/039/047/050/051) green; `viewAllHref`/`HOT_SUBTITLE` Reference Contracts confirmed.
- [ ] P2-T4 (`attempts.ts` extraction) complete: `rating.int.test.ts:319-457` passes with 0 diff.

## Test Skeleton / Verification Paths
- `SOURCE/features/exams/components/__tests__/ExamRibbon.test.tsx` — new
- `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx` — extended (bare case unchanged, 2 new cases)
- `SOURCE/features/exams/components/__tests__/ExamShelf.test.tsx` — new, design-doc-named
- `SOURCE/features/exams/__tests__/rating.int.test.ts:319-457` — must diff-empty after P2-T4

## Phase Completion Criteria (verbatim from Work Plan)
- [ ] `ExamCard` snapshot: bare case unchanged (no `-u`), 2 new cases pass
- [ ] `ExamShelf.test.tsx` green (structural proof, no live data yet)
- [ ] `rating.int.test.ts`'s pre-existing AC-016/AC-017 cases pass with 0 lines changed
- [ ] Gates 1-3 green

## Verification Commands
```
cd SOURCE && npx vitest run features/exams/components/__tests__/ExamRibbon.test.tsx
cd SOURCE && npx vitest run features/exams/components/__tests__/ExamCard.snapshot.test.tsx
cd SOURCE && npx vitest run features/exams/components/__tests__/ExamShelf.test.tsx
cd SOURCE && npx vitest run features/exams/__tests__/rating.int.test.ts
cd SOURCE && git diff -- features/exams/__tests__/rating.int.test.ts
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npm run build
```

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 2's completion.

## Next Phase Gate
Phase 3 depends on P1-T4 (examShelves types, already available from Phase 1) and P2-T4 (the extracted `attempts.ts` module) — `shelves.ts` (P3-T2) directly imports `attempts.ts`. Phase 3 may begin once P2-T4 is green; P2-T1/T2/T3 (the UI components) are not on Phase 3's critical path but are required before Phase 5 (page integration).
