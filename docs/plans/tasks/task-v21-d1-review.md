# Task D1 — S-03 review: part grouping + 2 new editors

**Phase**: D (UI) · **Depends on**: C1, C2 · **Type**: Implementation + Quality

## Goal
Review screen understands parts and the 2 new types (Design Doc §v2.1 UI delta):
- `AssembledQuestionList`: group questions under part headings from `exams.parts` (fallback "Phần {n}"); single-part exams render exactly as v2.0 (no heading).
- `QuestionEditor` variants:
  - `true_false`: 4 statement rows (editable text) each with a Đ/S toggle showing the answer-file value ("from your answer file" annotation, mirroring the mcq treatment).
  - `short_answer`: stem + expected-value input (annotated "from your answer file").
- `ExtractionErrorPanel`: renders part-aware copy ("Phần {p} Câu {n} — …"); anchors `#p{p}q{n}`.
- Live validation (`validateAssembledExam`) already covers new types via A3 — wire, don't re-implement.

## Files
Edited: `features/authoring/components/{AssembledQuestionList,QuestionEditor,ExtractionErrorPanel,ReviewScreen}.tsx`.

## Verification / Acceptance
Manual on the 2025 fixture draft: 3 part sections; TF editor toggles persist through Save; short-answer edits persist; error links jump to the right question. Old single-part exam renders unchanged. `tsc`/eslint clean; a11y: toggles are real buttons with pressed state, keyboard operable, part headings are real headings.

## References
Design Doc §v2.1 UI delta; UI Spec v2.0 (QuestionEditor/AssembledQuestionList patterns — extend, keep the Ink & Lacquer treatment).
