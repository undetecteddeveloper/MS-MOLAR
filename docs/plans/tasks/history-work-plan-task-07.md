# Task 07: `lib/history/format.ts` — Shared Formatters (Work Plan Phase 2, Task 2.2)

Metadata:
- Dependencies: none (pure functions, fastest to verify)
- Provides: `formatSubmittedDate`, `formatCompletionTime`, `buildPdfFilename` (consumed by Task 09, Task 12, Task 13)
- Size: Small (2 files)

## Implementation Content

Create `SOURCE/lib/history/format.ts` (+ `format.test.ts`, no skeleton provided — author fresh unit tests from the Data Contracts yaml): `formatSubmittedDate`, `formatCompletionTime`, `buildPdfFilename`. This is the single shared source of truth consumed identically by `generateAttemptPdf.ts` (Task 09), `result/page.tsx` for `ScoreCard` (Task 12), and `HistoryRow` (Task 13) — no per-caller reformatting.

## Target Files
- [x] `SOURCE/lib/history/format.ts` (new)
- [x] `SOURCE/lib/history/format.test.ts` (new)

## Investigation Targets
- `docs/design/history-frontend-design.md` (§ Data Contracts — `SOURCE/lib/history/format.ts` yaml block — the exact contract for all 3 functions, including every documented Guarantee/fallback)
- `docs/design/history-frontend-design.md` (§ Minimal Surface Alternatives — Element 2) — Design Traceability
- `docs/ui-spec/history-ui-spec.md` (§ D2 — PDF filename convention, the exact slug algorithm and example `algebra-midterm-1_20260715.pdf`; § HistoryRow completion-time display format spec — `"Hh Mm"`/`"Mm Ss"`/`"Ss"`/`"—"` rules)
- `SOURCE/app/(layer4)/_components/ExamRow.tsx` (lines 56-60 — `formatDateTime`-style helper precedent for date formatting conventions in this codebase)

## Investigation Notes

- `docs/design/history-frontend-design.md` (§ Data Contracts, lines 364-391): exact yaml contract for the 3 functions.
  - `formatSubmittedDate(submittedAt: string | null): string` → `"DD/MM/YYYY"`; never throws; `"—"` for null/unparseable.
  - `formatCompletionTime(startedAt: string, submittedAt: string | null): string` → `"Hh Mm"` (>=3600s), `"Mm Ss"` (>=60s and <3600s), `"Ss"` (<60s); never throws; `"—"` when `submittedAt` is null, unparseable, or diff negative. Also applying the same `"—"` fallback when `startedAt` itself is unparseable (NaN diff), to satisfy the "never throws"/never-`NaN`-in-output guarantee — not explicitly enumerated in the contract text but required by it.
  - `buildPdfFilename(examTitle: string, submittedAt: string | null): string` → `"{slug}_{YYYYMMDD}.pdf"`; slug lowercase, non-alphanumeric runs collapsed to single hyphens, <=60 chars, no leading/trailing hyphen; empty/whitespace title → slug `"exam"`; null/unparseable `submittedAt` → date stamp falls back to current date. Also falling back to `"exam"` when the title contains only non-alphanumeric characters (collapses to empty string) — same rationale as the empty-title case, not separately enumerated but required to keep the slug non-empty.
- `docs/ui-spec/history-ui-spec.md` § D2 (line 57): `{exam-title-slug}_{YYYYMMDD}.pdf`; date is the attempt's `submitted_at`, not "now"; example `algebra-midterm-1_20260715.pdf`.
- `docs/ui-spec/history-ui-spec.md` line 199 (HistoryRow section): completion time format thresholds — `"Hh Mm"` when >= 60 min, `"Mm Ss"` when >= 60s and < 60 min, `"Ss"` when < 60s, `"—"` if either timestamp missing or diff negative. No concrete numeric example string is given anywhere in Design Doc/UI Spec; interpreted as literal unit-suffix notation (e.g. `"2h 15m"`, `"5m 30s"`, `"45s"`), consistent with the `"{h}h {m}m"`/`"{m}m {s}s"`/`"{s}s"` pattern implied by the placeholder letters.
- `SOURCE/app/(layer4)/_components/ExamRow.tsx` lines 56-60: existing `formatDateTime` precedent — `new Date(iso)`, manual `pad` helper, `DD/MM/YYYY` day/month/year order (matches `formatSubmittedDate`'s required output order).

### Reference Contract Compliance (post-implementation, evaluated against `SOURCE/lib/history/format.ts`)

- `buildPdfFilename` row: **Y** — `format.test.ts` "builds the D2 example filename verbatim" reproduces `algebra-midterm-1_20260715.pdf` exactly; slug hyphen-collapse/truncation/empty-title/non-alphanumeric-only-title/current-date-fallback each covered by a dedicated passing test.
- `formatCompletionTime` row: **Y** — `format.test.ts` covers `Ss`/`Mm Ss`/`Hh Mm` thresholds including the exact 60s/60min boundaries, plus null/unparseable-`submittedAt`/unparseable-`startedAt`/negative-diff → `"—"`, all passing.
- `formatSubmittedDate` row: **Y** — `format.test.ts` covers the happy path (`DD/MM/YYYY`, zero-padded), null → `"—"`, and unparseable → `"—"`, all passing.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-frontend-design.md` (§ Data Contracts — `lib/history/format.ts`) | derived-display | `"Contract: buildPdfFilename... Output: Type: string, \"{slug}_{YYYYMMDD}.pdf\" per UI Spec D2 ... slug is lowercase, non-alphanumeric runs collapsed to single hyphens, <=60 chars, no leading/trailing hyphen; empty/whitespace title -> slug \"exam\"; null/unparseable submittedAt -> date stamp falls back to the current date"` | Does `buildPdfFilename` produce `"{slug}_{YYYYMMDD}.pdf"` with a lowercase, hyphen-collapsed, <=60-char slug (no leading/trailing hyphen), falling back to slug `"exam"` for an empty/whitespace title and to the current date for a null/unparseable `submittedAt`? |
| `docs/design/history-frontend-design.md` (§ Data Contracts — `lib/history/format.ts`) | derived-display + state-lifecycle-negative | `"Contract: formatCompletionTime... Output: Type: string — \"Hh Mm\" (>=60min), \"Mm Ss\" (>=60s, <60min), \"Ss\" (<60s), per UI Spec HistoryRow format spec Guarantees: never throws; returns \"—\" when submittedAt is null, unparseable, or the computed diff is negative"` | Does `formatCompletionTime` produce `"Hh Mm"`/`"Mm Ss"`/`"Ss"` per the documented thresholds, never throw, and return `"—"` for a null/unparseable `submittedAt` or a negative computed diff? |
| `docs/design/history-frontend-design.md` (§ Data Contracts — `lib/history/format.ts`) | derived-display + state-lifecycle-negative | `"Contract: formatSubmittedDate... Output: Type: string, \"DD/MM/YYYY\" ... Guarantees: never throws; returns \"—\" for null or an unparseable date"` | Does `formatSubmittedDate` produce `"DD/MM/YYYY"`, never throw, and return `"—"` for a null or unparseable date? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular the exact slug algorithm and every documented fallback condition per formatter.
- [x] Write failing tests in `format.test.ts`: minimum one test per formatter's happy path + one per documented fallback condition (never-throws, `"—"` for null/unparseable/negative-diff for `formatSubmittedDate`/`formatCompletionTime`; slug edge cases — empty title, non-alphanumeric runs, >60 chars, null `submittedAt` — for `buildPdfFilename`).
- [x] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [x] Implement the 3 functions exactly per the Data Contracts yaml.
- [x] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [x] Improve code (maintain passing tests); confirm no duplication of the same date-diff logic between `formatCompletionTime` and any other file.
- [x] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (node), `lib/history/format.test.ts` — Enforces: pure formatter correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/lib/history/format.ts`

## Operation Verification Methods
- **Verification method**: run `format.test.ts` covering every documented happy path + fallback condition per formatter.
- **Success criteria**: 3 functions match the Data Contracts yaml exactly; `format.test.ts` covers happy path + every documented fallback; `tsc`/lint clean.
- **Failure response**: if a formatter's output diverges from the UI Spec's exact format strings (e.g. `"Hh Mm"` spacing, slug hyphenation), fix before Task 09/12/13 consume it — this is the single source of truth for 3 downstream call sites.
- **Verification level**: L2 (new tests added and passing) — this task has no Early Verification Point of its own; it is proven by consumption at Task 11's real PDF generation.

## Proof Obligations
- **Claim**: `formatSubmittedDate` never throws and returns `"—"` for null or an unparseable date; otherwise returns `"DD/MM/YYYY"`.
  - **Primary failure mode**: the function throws on a null/malformed input, or returns something other than `"—"` for that case.
  - **Boundary to exercise**: in-process unit (pure function, no I/O).
  - **State assertion**: N/A (pure function).
  - **Mock boundary rationale**: none — no external dependency to mock.
  - **Residual**: none.
- **Claim**: `formatCompletionTime` never throws and returns `"—"` when `submittedAt` is null, unparseable, or the diff is negative; otherwise returns the correctly-thresholded `"Hh Mm"`/`"Mm Ss"`/`"Ss"` string.
  - **Primary failure mode**: a negative diff (clock skew / data anomaly) produces a nonsensical string instead of `"—"`, or a threshold boundary (exactly 60s, exactly 60min) is miscategorized.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: `buildPdfFilename` produces a deterministic, correctly-slugged filename per D2, with the documented `"exam"`/current-date fallbacks.
  - **Primary failure mode**: the slug retains non-alphanumeric characters, exceeds 60 chars, or has a leading/trailing hyphen; or an empty title does not fall back to `"exam"`.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: the "current date" fallback for a null/unparseable `submittedAt` is inherently non-deterministic across test runs unless the test mocks the system clock — use a fixed/mocked `Date` in that specific test case to keep it deterministic (testing-principles: flaky-test avoidance).

## Completion Criteria
- [x] All added tests pass (happy path + every documented fallback, per formatter)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [x] `tsc`/lint clean
- [x] Every Reference Contract Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/lib/history/format.ts` + its test file only.
- Scope boundary: do not import these formatters into any consuming file in this task — that begins at Tasks 09/12/13.
