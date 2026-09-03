# Task 4.2 — features/authoring/queries.ts — read queries

**Phase**: 4 · **Depends on**: 1.1 · **Type**: Implementation + Quality

## Goal
Implement `SOURCE/features/authoring/queries.ts`:
- `listMyExams()` — own rows, all statuses, newest-first: `id,title,subject,grade,questionCount,status,createdAt`.
- `getMyExam(id)` — own; the full assembled exam for review/edit: metadata + questions (`stem, question_type, choices, correct_answer, essay_answer, image_url`).
- `hasReported(examId)` — a row `(exam_id, auth.uid())` exists (own-report read).

Each obtains the client via `await createClient()`; RLS is the authorization floor. snake_case↔camelCase mappers per the `queries.ts` convention. Explicit `order by` (never insertion order).

## Files
New: `SOURCE/features/authoring/queries.ts`.

## ACs / metrics
AC-014/020/026. Missing-sort-key guard (explicit ordering).

## Verification / Acceptance
Against the live DB each query returns the expected shape and ordering (my-exams newest-first; `getMyExam` returns the full assembled exam incl. `image_url`/`question_type`/`essay_answer`; `hasReported` true only for the caller's own report). `tsc` strict clean.

## References
Design Doc §Read Queries.
