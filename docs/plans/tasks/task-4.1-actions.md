# Task 4.1 — features/authoring/actions.ts — 5 server actions

**Phase**: 4 · **Depends on**: 1.1, 2.1, 2.2 · **Type**: Implementation + Quality + Integration

## Goal
Implement `SOURCE/features/authoring/actions.ts` per Design Doc §Data Contracts — Server Actions:
- `extractAndAssemble(input)` — validate metadata + file type/size/pages (`limits.ts`) **before any AI call**; create `exams(status='processing')`; upload both files to `exam-uploads/{examId}`; run `extractQuestions` + `extractAnswers` + `cropImages` + `assembleExam`; INSERT questions (assembled: `question_type`, `choices?`, `correct_answer?`, `essay_answer?`, `image_url`, `topic=subject`); set `status='review'` (clean) or `'failed'` (errors); snapshot `author_display_name` from own profile. Redirect `/me/exams/[id]`. **Persist only the assembled result** (raw AI output advisory).
- `saveExam(examId, patch)` — author edits fields (review or published); re-validate.
- `publishExam(examId)` — own + status in (review,draft) + clean → `status='published'`, `reviewed_at=now()`.
- `deleteExam(examId)` — own (any status) → delete exam + questions + Storage objects.
- `reportExam(examId, reason)` — published + non-empty reason → insert `exam_reports`; unique `23505` → `"duplicate"`.

Discriminated `{error:{kind,…}}` returns; `throw`+log on infra error; **never log tokens or raw AI payloads**.

## Files
New: `SOURCE/features/authoring/actions.ts`. Pattern refs: `(exams)/actions.ts`, `(auth)/actions.ts`, `lib/auth/getCurrentUser.ts`, `lib/supabase/server.ts`.

## ACs / metrics
AC-003/006/007/012/015/016/017/018/025/026. Field propagation (answer from file, topic=subject, name snapshot).

## Verification / Acceptance
Unit tests (mocked client + mocked extractors) assert the branch mapping (validation/file/extraction/assembly/server error kinds; `"duplicate"`; nothing persisted on failure; no form state cleared). Integration against the live DB: a real upload lands `review` with N assembled question rows (`topic=subject`, answers from the answer file), a figure question carries an `image_url`; publish flips to `published`; delete removes rows + Storage objects. Proof: persisted questions equal the assembled result, not raw AI output.

## References
Design Doc §Data Contracts, §Data Flow; ADR-0004 (answer authority, assembly authoritative); ADR-0001 (author write policies).
