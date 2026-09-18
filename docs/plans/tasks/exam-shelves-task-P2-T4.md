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
- [ ] `SOURCE/features/exams/queries/attempts.ts` (new)
- [ ] `SOURCE/features/exams/queries/ranking.ts`

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
_(Record here: confirmation the moved code is byte-identical to the pre-extraction `:27-64`, save for import/export syntax; the exact `git diff` result on `rating.int.test.ts:319-457`.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and record the current green baseline for the `:319-457` range (pre-extraction) — this is the concrete "unmodified" target
### 2. Green Phase
- [ ] Move `ATTEMPT_SELECT`, `AttemptRow`, `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts` into the new `attempts.ts`, unchanged
- [ ] Rewire `ranking.ts` to import and consume the extracted module
- [ ] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and confirm the same cases pass
### 3. Refactor Phase
- [ ] Run `git diff` restricted to `rating.int.test.ts:319-457` and confirm it is empty
- [ ] Confirm `toShelfAttempts`'s output shape satisfies `examShelves.ts`'s `ShelfAttempt` type (compile-time check via `tsc`)

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
- [ ] `attempts.ts` created with the 5 named exports, moved unchanged
- [ ] `ranking.ts` rewired to consume the extracted module
- [ ] `git diff` on `rating.int.test.ts:319-457` is empty
- [ ] Gates 1-6 green

## Notes
- Impact scope: `attempts.ts` (new, extracted), `ranking.ts` (rewired imports only — no logic change beyond the extraction).
- Scope boundary — preserve unchanged: `rating.int.test.ts:1-747` in its entirety (this task touches none of it; P4-T3 later appends to it, separately).
