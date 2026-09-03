# Task 6.3 — S-02 My exams

**Phase**: 6 · **Depends on**: 4.2 · **Type**: Implementation

## Goal
Build `/me/exams` (server) per UI Spec S-02: `MyExamsList` (newest-first, `?published=1` banner D13), `ExamRow` (per-status actions: processing→none; failed→Review&fix+Delete; review→Continue review+Delete; draft→Continue+Delete; published→Edit+Delete, title links to the live exam), shared `StatusBadge` (D9 glyph/border/label for processing/review/draft/published/failed), `DeleteDialog` (LeaveExamDialog + focus trap + focus return). Empty state → dashed block + "Upload an exam".

## Files
New: `SOURCE/app/(authoring)/me/exams/page.tsx` + `_components/{MyExamsList,ExamRow,StatusBadge,DeleteDialog}.tsx`, `loading.tsx`.

## ACs / metrics
AC-018/020. StatusBadge (D9).

## Verification / Acceptance
Golden state 6 (statuses with correct actions; badges distinguishable in grayscale — glyph+word, not color alone). Delete confirms and removes the exam (via `deleteExam`); published banner appears via `?published=1`.

## References
UI Spec §MyExamsList/ExamRow/StatusBadge/DeleteDialog, D8/D9/D13.
