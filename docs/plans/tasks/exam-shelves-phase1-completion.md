# Phase 1 Completion: Pure-Logic Foundations & Containment Proof

Covers Work Plan Phase 1 (Tasks P1-T1..P1-T6 / `exam-shelves-task-P1-T1.md` through `exam-shelves-task-P1-T6.md`).

**Gate**: Phase 0 (P0-T6 Early Verification Point) must be complete before this phase starts. Within this phase, P1-T1 must be committed before any other task touches `ExamCard.tsx` (no task in Phase 1 itself touches `ExamCard.tsx`, but P2-T2 in the next phase depends on P1-T1 landing first).

## All-Task Completion Checklist
- [ ] P1-T1 (ExamCard pre-change snapshot, MUST BE FIRST) complete: snapshot committed, positive `h3` assertion precedes it, green with no `-u`.
- [ ] P1-T2 (`copy.ts` 16 keys) complete: all 16 literals match the UI Spec verbatim; `tsc` passes.
- [ ] P1-T3 (`rankExams.ts` export + widen) complete: existing cases pass unmodified (diff-empty); new cases prove null-vs-0 semantics.
- [ ] P1-T4 (`examShelves.ts` + constants) complete: full ladder case list green, incl. 4/5/6 boundary and shuffled-input determinism.
- [ ] P1-T5 (`attemptSource.ts` + `startAttempt`) complete: all 4 literals round-trip; malformed input always normalises to `'none'`.
- [ ] P1-T6 (`browseParams.ts`) complete: all 10 AC-008 keys + malformed-value cases proven table-driven.

## Test Skeleton / Verification Paths
- `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx` (+ committed `.snap`) — new, design-doc-named
- `SOURCE/lib/adaptive/__tests__/rankExams.test.ts` — extended, existing cases must diff-empty
- `SOURCE/lib/adaptive/__tests__/examShelves.test.ts` — new, design-doc-named
- `SOURCE/lib/exams/__tests__/attemptSource.test.ts` — new, design-doc-named
- `SOURCE/lib/exams/__tests__/browseParams.test.ts` — new, design-doc-named

## Phase Completion Criteria (verbatim from Work Plan)
- [ ] P1-T1's snapshot committed and green with **no `-u`** at this point (nothing has touched `ExamCard` yet)
- [ ] `rankExams.test.ts`'s existing cases pass unmodified (diff-empty check)
- [ ] `examShelves.test.ts`, `attemptSource.test.ts`, `browseParams.test.ts` all green
- [ ] `copy.ts`'s 16 keys typecheck-valid
- [ ] Gates 1-3 green

## Verification Commands
```
cd SOURCE && npx vitest run features/exams/components/__tests__/ExamCard.snapshot.test.tsx
cd SOURCE && npx vitest run lib/adaptive/__tests__/rankExams.test.ts
cd SOURCE && npx vitest run lib/adaptive/__tests__/examShelves.test.ts
cd SOURCE && npx vitest run lib/exams/__tests__/attemptSource.test.ts
cd SOURCE && npx vitest run lib/exams/__tests__/browseParams.test.ts
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0
cd SOURCE && npm run build
```

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` — exactly 1 pre-existing failing case, unrelated to this feature. Confirm it stays exactly 1 through Phase 1's completion.

## Next Phase Gate
Phase 2 depends on: P1-T1 (ExamCard baseline, for P2-T2), P1-T2 (copy keys, for P2-T3), P1-T4 (examShelves types, for P2-T3 and P2-T4). P1-T3, P1-T5, P1-T6 are consumed by later phases (P1-T3 conceptually by P1-T4/P2-T4; P1-T5 by P6-T1; P1-T6 by P5-T1) and do not block Phase 2's start once P1-T1/T2/T4 are green.
