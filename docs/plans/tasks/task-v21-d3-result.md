# Task D3 — Result page: non-MCQ treatment

**Phase**: D (UI) · **Depends on**: D2 · **Type**: Implementation + Quality

## Goal
Result surfaces degrade gracefully with non-MCQ questions present (Design Doc §v2.1 UI delta):
- Verify `computeScore` counts **only mcq** questions (score base = mcq count, not total) — fix if it currently divides by total questions.
- Result detail lists `true_false`/`short_answer`/`essay` questions with the student's input and the stored answer (server-rendered — the result page MAY show answers post-submission, matching existing essay/detail behavior), clearly marked "Not auto-scored".
- Topic breakdown unaffected (single-topic bucket per ADR-0004 stands).

## Files
Edited: `lib/scoring/computeScore.ts` (if needed), result page components under `app/(exams)/exams/[id]/attempt/[attemptId]/result/`.

## Verification / Acceptance
Unit: `computeScore` on a mixed exam (12 mcq + 4 TF + 6 short) scores /12, ignoring the rest; existing scoring tests unchanged. Manual: result + detail pages render the mixed exam without NaN/broken percentages; non-MCQ rows show input + answer + label. `tsc`/eslint clean.

## References
Design Doc §v2.1 UI delta; ADR-0005 (scoring deferred).
