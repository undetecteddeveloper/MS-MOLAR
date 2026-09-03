# Task 5.1 — features/exams/queries.ts — published + byline + image

**Phase**: 5 · **Depends on**: 1.1 · **Type**: Contract-change + Quality

## Goal
Extend `SOURCE/features/exams/queries.ts` `listExams`/`getExam`/`getExamForPlayer`: add `.eq('status','published')` (explicit R-7 guard on top of the RLS floor, so a viewer's own non-published exams never leak into the catalog) and select `author_display_name` into the `Exam` view-model plus each question's `question_type`/`image_url`/`essay_answer` (additive columns; existing callers keep working).

## Files
`SOURCE/features/exams/queries.ts` (edit `EXAM_COLUMNS`/`toExam` and the question mapper).

## ACs / metrics
AC-011/021/024/027; R-7 guard.

## Verification / Acceptance
Catalog shows only `published` exams (own non-published never appears in `/exams`); `author_display_name` + question `image_url`/`question_type`/`essay_answer` available on the view-models; catalog count unchanged vs pre-backfill (AC-027).

## References
Design Doc §Read Queries (catalog extension), §Risks R-7.
