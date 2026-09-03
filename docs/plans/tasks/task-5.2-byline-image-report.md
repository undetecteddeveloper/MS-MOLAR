# Task 5.2 — Byline + QuestionFigure + Report channel

**Phase**: 5 · **Depends on**: 5.1, 4.1, 3.2 · **Type**: Implementation + Integration

## Goal
- **AuthorByline**: insert on `ExamCard` (between title and School/Level `<dl>`) and on the exam detail page (under `<h1>`), rendered **only when** `author_display_name` exists (seeded → no row, no reserved space).
- **QuestionFigure in the player + exam detail**: render each image-bearing question's `image_url` via `QuestionFigure` (Task 3.2) in the exam player and the detail page.
- **Report channel**: `ReportButton` (rendered only for logged-in users on a published exam; already-reported → static "✓ You reported this exam" from `hasReported`) + `ReportDialog` (LeaveExamDialog pattern + focus trap; duplicate → terminal state) calling `reportExam`.

## Files
`SOURCE/features/exams/components/ExamCard.tsx` (edit), `SOURCE/app/(exams)/exams/[id]/page.tsx` (edit), the exam player component (edit — QuestionFigure); new `AuthorByline`, `ReportButton`, `ReportDialog` under `(exams)/_components/` or `components/shared/`.

## ACs / metrics
AC-011/021/023/025/026. UI Spec §AuthorByline, §ReportButton/ReportDialog.

## Verification / Acceptance
A published UGC exam shows "by {name}" + its figure(s); a seeded exam shows neither byline nor gap. Report a published exam → recorded, control flips to already-reported; second attempt → duplicate terminal. Figure renders only from the storage origin (Task 3.2). axe/keyboard on the dialog deferred to Task 7.

## References
Design Doc §Main Components; ADR-0003 (byline omission); ADR-0002 (QuestionFigure); UI Spec §Report components.
