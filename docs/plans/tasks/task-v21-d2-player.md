# Task D2 — Player: TF + short-answer inputs

**Phase**: D (UI) · **Depends on**: C2 · **Type**: Implementation + Quality

## Goal
The exam player renders and collects input for the 2 new types **without scoring them** (Design Doc §v2.1 UI delta; product decision — auto-scoring deferred):
- `QuestionRenderer`: `true_false` → the 4 sub-item statements each with a Đ/S segmented control; `short_answer` → one short text input; both carry the "Not auto-scored yet" label (same visual treatment as essay).
- Part headings between sections (from `exams.parts`).
- Student input for new types is kept in the attempt answer payload (string encoding decided here, e.g. `"a:Đ,b:S,…"` / raw string) so it can be shown on the result page — but `computeScore` ignores it.

## Files
Edited: `features/exams/components/QuestionRenderer.tsx` (+ attempt page wiring if the answer payload type needs widening).

## Verification / Acceptance
Manual: attempt a published 2025-format exam → all 22 questions renderable and answerable; navigation/pagination unaffected; no answers visible anywhere in the payload (network tab check: no `sub_answers`). Old MCQ exams unchanged. `tsc`/eslint clean; a11y: segmented controls keyboard-operable with visible state.

## References
Design Doc §v2.1 UI delta; ADR-0005 (display-not-score).
