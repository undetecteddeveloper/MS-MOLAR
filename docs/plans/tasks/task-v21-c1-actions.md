# Task C1 — actions.ts + fromRows v2.1

**Phase**: C (persistence) · **Depends on**: A1, A3, B2 · **Type**: Implementation + Quality

## Goal
Persist the multi-part model (Design Doc §v2.1 Persistence delta):
- `extractAndAssemble`: question row id `<examId>-p<part>q<n>`; write `part_number`, `sub_answers` (TF booleans), short-answer expected value into `essay_answer`; write `exams.parts` from the extracted part headers (null when single-part). Re-run deletes old rows by the stored `question_ids` (works for both id forms).
- `saveExam` / `SaveQuestionPatch`: patch fields for `subItems`/`subAnswers`/short-answer value; published-exam validation covers the new types.
- `fromRows.ts`: `assembledFromRows` carries `part`/`subItems`/`subAnswers`; `questionNumberFromId` parses **both** `-q<n>` (v2.0 rows) and `-p<part>q<n>` (returns part too).
- Pipeline logger: stage lines mention parts (e.g., "22 câu / 3 phần").

## Files
Edited: `features/authoring/actions.ts`, `lib/ugc/{fromRows,types}.ts` (patch types), `lib/ugc/__tests__/fromRows.test.ts`.

## Verification / Acceptance
`vitest` green (fromRows both id forms; round-trip assembled→rows→assembled preserves (part, number, type, answers)). `tsc` clean. Manual: upload the 2025 fixture → DB rows carry correct `part_number`/`sub_answers`; re-run works; old exams unaffected.

## References
Design Doc §v2.1 Persistence/read delta; ADR-0005.
