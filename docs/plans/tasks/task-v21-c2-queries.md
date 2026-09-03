# Task C2 — Queries + PublicQuestion confinement

**Phase**: C (persistence) · **Depends on**: A1, C1 · **Type**: Implementation + Quality

## Goal
Read paths carry the new fields with the answer-confinement discipline extended (Design Doc §v2.1 Persistence/read delta):
- `(authoring)/queries.ts` (`getMyExam`): full assembled exam incl. `part`, `subItems`, `subAnswers`, short answer — author-only surface, may see answers.
- `(exams)/queries.ts` (`getExamForPlayer`): select `part_number`, `question_type`, sub-item **statements** (`choices` column) — **NEVER `sub_answers`, `essay_answer`, `correct_answer`**; select `exams.parts` for section headings.
- `types/question.ts` / `types/exam.ts`: `Question` gains `partNumber?`, `subItems?`, `subAnswers?`; **`PublicQuestion = Omit<Question, "correctAnswer" | "essayAnswer" | "subAnswers">`**; `Exam.parts?`.

## Files
Edited: `features/authoring/queries.ts`, `features/exams/queries.ts`, `types/{question,exam}.ts`.

## Verification / Acceptance
`tsc` clean — the `PublicQuestion` omission makes leaking `subAnswers` into player components a **compile error** (structural guarantee, same as v2.0's correctAnswer). Grep check: `sub_answers` appears in no `(exams)` select string except via review-only paths. Manual: player payload for a TF exam contains statements but no booleans.

## References
Design Doc §v2.1 Persistence/read delta; ADR-0005 (sub_answers confinement).
