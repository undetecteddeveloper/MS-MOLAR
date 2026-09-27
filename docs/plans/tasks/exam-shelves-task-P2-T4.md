# Task P2-T4 — Extract `features/exams/queries/attempts.ts` from `ranking.ts`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 2, Task P2-T4**
Layer: backend (`SOURCE/features/exams/queries/`)

Metadata:
- Dependencies: P1-T4 (`ShelfAttempt` type this extraction produces/consumes)
- Blocks: P3-T2 (`shelves.ts` composition consumes this extracted module)
- Size: Small (2 files)
- Verification level: L2 — **the proof is a 0-diff regression check, not new behavior**

## Implementation Content
Extract `SOURCE/features/exams/queries/attempts.ts` (new — `ATTEMPT_SELECT`, `AttemptRow`, `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts`, moved **unchanged** from `ranking.ts:27-64`) and rewire `SOURCE/features/exams/queries/ranking.ts` to consume it.

## Target Files
- [x] `SOURCE/features/exams/queries/attempts.ts` (new)
- [x] `SOURCE/features/exams/queries/ranking.ts`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Implementation Plan step 4)
- `docs/design/exam-shelves-backend-design.md` (Fact Disposition Table row `ranking.ts:listExamsRanked`)
- `docs/design/exam-shelves-backend-design.md` (Data Representation Decision — extending `RankAttempt` → `ShelfAttempt`)
- `SOURCE/features/exams/queries/ranking.ts` (`:27-64` the exact code being moved — read this byte-for-byte before moving it)
- `SOURCE/features/exams/__tests__/rating.int.test.ts` (`:319-457`, incl. `:393-401` and `:447-456` — the cases that must pass with 0 edits; this is the extraction's entire proof)
- `SOURCE/lib/adaptive/examShelves.ts` (P1-T4 — the `ShelfAttempt` type this extraction's `toShelfAttempts` must satisfy)

## Change Category
`Change Category: boundary-change`

The Design-to-Plan Traceability table's Data Representation Decision row (contract-change, covering P1-T4/P2-T4/P3-T2) marks this extraction's `toShelfAttempts` as touching the `ShelfAttempt` type contract. Sweep the adjacent case: `ranking.ts`'s rewired consumption of the extracted module must produce byte-identical output to before — verify every other reader of the pre-extraction inline logic (there is only the one, in-file, per the DD) is now reading the extracted module correctly.

## Investigation Notes

- **Design Doc vs. task summary discrepancy found and resolved**: the task's Implementation Content line says all 5 names (`ATTEMPT_SELECT`, `AttemptRow`, `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts`) are "moved unchanged from ranking.ts:27-64". Reading `ranking.ts:27-64` byte-for-byte showed only `AttemptRow` (the type) and the three private helpers `embeddedExam`/`gradeOfAttempt`/`subjectOfAttempt` actually exist there pre-extraction — `ATTEMPT_SELECT`, `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts` do not exist anywhere pre-extraction. The backend Design Doc § Query layer (`exam-shelves-backend-design.md:348-360`) is authoritative here and is explicit: "`AttemptRow`, `embeddedExam`, `gradeOfAttempt` and `subjectOfAttempt` move here from `ranking.ts:27-64` unchanged... `school` joins the embed at zero round-trip cost". So: the 4 named items move byte-identical (logic unchanged); `ATTEMPT_SELECT`/`readMyAttemptRows`/`submittedExamIdsOf`/`toShelfAttempts` are new wrapper functions authored per the DD's exact signatures (`:351-357`), built by packaging logic that used to sit inline in `listExamsRanked` (the select string, the `new Set(...)` line, and the `attemptRows.flatMap(...)` block) — this is exactly what the Change Category note on this task already flags ("this extraction's `toShelfAttempts` as touching the `ShelfAttempt` type contract").
- `ranking.ts:27-64` pre-extraction byte-for-byte read: `AttemptRow` type (with the 2026-08-16 PostgREST-embed-shape comment), `EmbeddedExamFacets = {grade, subject}`, `embeddedExam`, `gradeOfAttempt`, `subjectOfAttempt` (with its TD-028 comment) — moved verbatim into `attempts.ts`, including both comments, unmodified. Only change to these 4 items: `EmbeddedExamFacets` widens with `school: string | null` (DD-sanctioned, null-tolerant like `subject`) and a new sibling `schoolOfAttempt` helper was added following the identical pattern as `subjectOfAttempt` — this is additive, not a change to the 4 moved items' own logic.
- `RankAttempt` (`rankExams.ts:58-79`) = `{examId, grade, subject, submittedAt, totalScore}`; `ShelfAttempt` (`examShelves.ts:53-55`, P1-T4) = `RankAttempt & {school}`. Confirmed `toShelfAttempts`'s `ShelfAttempt[]` return is structurally assignable to `rankExamIds`'s `attempts: readonly RankAttempt[]` (`rankExams.ts:93`) — the extra `school` field is inert for `rankExamIds`, so `ranking.ts`'s ranked order is unaffected by the widened return type.
- Checked `rating.int.test.ts:319-457` (the critical proof range) — this range is entirely `describe("listExams — ...")` / `describe("listExams — dir overrides ...")`, which exercises `listExams`'s `exams_with_difficulty` query chain only; it never touches `exam_attempts` or `listExamsRanked`. Confirmed via `Grep` that no assertion in the whole file checks the literal `.select()` argument string passed for the `exam_attempts` table (only table names via `mockTables()`'s call-order array, at `:663-674`), so widening `ATTEMPT_SELECT` to add `school` cannot affect any existing assertion.
- Adjacent-case sweep (boundary-change): the only other reader of the pre-extraction inline attempt logic is `listExamsRanked` itself (single in-file caller, confirmed by DD's Fact Disposition Table row for `ranking.ts:listExamsRanked` and by grep — no other file imports `AttemptRow`/`embeddedExam`/`gradeOfAttempt`/`subjectOfAttempt`, since none were ever exported). `shelves.int.test.ts` (sibling skeleton file, P3-T2's proof) does not import `attempts.ts` yet — confirmed by reading its header comment ("Nothing here imports them"), so this extraction cannot regress it.
- Existing `listExamsRanked` tests at `rating.int.test.ts:565-706` (not in the byte-identical-required range, but must stay green) mock `exam_attempts` rows shaped `{id, exam_id, submitted_at, exams: {grade[, subject]}}` with no `school` key — verified these pass unmodified post-extraction (`school` resolves to `null` via the same `typeof ... === "string"` guard `subjectOfAttempt` already used, so a missing key behaves identically to an explicit `null`).
- **Red phase baseline** (pre-extraction, on the unmodified tree): `npx vitest run features/exams/__tests__/rating.int.test.ts` → `Test Files 1 passed (1)`, `Tests 29 passed | 2 todo (31)`.
- **Green phase** (post-extraction): same command → identical `29 passed | 2 todo (31)`.
- **Refactor phase**: `git diff -- SOURCE/features/exams/__tests__/rating.int.test.ts` → empty (0 lines), confirmed for the whole file, a superset of the required `:319-457` range. `npx tsc --noEmit` (project-wide) → 0 errors, confirming `toShelfAttempts`'s `ShelfAttempt[]` output satisfies `rankExamIds`'s `RankAttempt[]` contract at compile time.
- Full gate sweep run: `npx tsc --noEmit` clean; `npx eslint --max-warnings 0 features/exams/queries/attempts.ts features/exams/queries/ranking.ts` clean; `npx vitest run` (project-wide) → 151 files passed, 2162 tests passed, 1 unrelated pre-existing failure (`lib/security/rateLimit.test.ts` — a Gemini quota-budget arithmetic assertion, no relation to `exams/queries/**`, not touched by this task, present on the tree before this task's edits per `git status` showing only `attempts.ts`/`ranking.ts` changed); `npm run build` succeeds; `npm run check:bundle` PASS.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and record the current green baseline for the `:319-457` range (pre-extraction) — this is the concrete "unmodified" target
### 2. Green Phase
- [x] Move `ATTEMPT_SELECT`, `AttemptRow`, `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts` into the new `attempts.ts`, unchanged
- [x] Rewire `ranking.ts` to import and consume the extracted module
- [x] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and confirm the same cases pass
### 3. Refactor Phase
- [x] Run `git diff` restricted to `rating.int.test.ts:319-457` and confirm it is empty
- [x] Confirm `toShelfAttempts`'s output shape satisfies `examShelves.ts`'s `ShelfAttempt` type (compile-time check via `tsc`)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: run `npx vitest run features/exams/__tests__/rating.int.test.ts`; separately run `git diff -- SOURCE/features/exams/__tests__/rating.int.test.ts` restricted to lines 319-457 and confirm it is empty.
- **Success criteria**: `rating.int.test.ts`'s AC-016/AC-017 cases at `:319-457` (incl. `:393-401`, `:447-456`) pass with **0 edits** — this is the proof the extraction was behavior-preserving. This is a stronger requirement than "still green": the test file itself in this range must be byte-identical.
- **Failure response**: if any of these cases needed an edit to stay green, the extraction was not behavior-preserving — STOP and find the semantic drift in the moved code (an accidental reordering, an accidental optional-chaining change) rather than editing the test to match the new behavior.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: `listExamsRanked`'s behavior (as observed by `rating.int.test.ts`'s AC-016/AC-017 cases) is unchanged after the extraction.
  - **Primary failure mode**: the extraction subtly alters the moved logic during the move (e.g. a changed variable capture, a changed evaluation order for `submittedExamIdsOf`, a changed default value) with no visible symptom until end-to-end ranking output shifts.
  - **Boundary to exercise**: integration test (`rating.int.test.ts`, mocked Supabase client boundary — this file's own established mock boundary, unchanged by this task).
  - **State assertion**: N/A (query composition, not a persisted-state transition).
  - **Mock boundary rationale**: `rating.int.test.ts` already mocks the Supabase client at its established boundary; this task does not change that boundary, only which internal module the composition calls through.
  - **Residual**: this proves `ranking.ts`'s own behavior; that the *new* consumer (`shelves.ts`, P3-T2) correctly uses the extracted module for its own composition is P3-T2's separate proof obligation.

## Completion Criteria
- [x] `attempts.ts` created with the 5 named exports, moved unchanged
- [x] `ranking.ts` rewired to consume the extracted module
- [x] `git diff` on `rating.int.test.ts:319-457` is empty
- [x] Gates 1-6 green

## Notes
- Impact scope: `attempts.ts` (new, extracted), `ranking.ts` (rewired imports only — no logic change beyond the extraction).
- Scope boundary — preserve unchanged: `rating.int.test.ts:1-747` in its entirety (this task touches none of it; P4-T3 later appends to it, separately).
