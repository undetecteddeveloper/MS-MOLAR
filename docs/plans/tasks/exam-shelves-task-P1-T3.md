# Task P1-T3 — `rankExams.ts`: export + widen `buildSubjectWeakness`, `buildRepresentativeAttempts`, `buildGradeShares`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T3**
Layer: backend (`SOURCE/lib/adaptive/`)

Metadata:
- Dependencies: none within Phase 1
- Blocks: P1-T4 (`examShelves.ts`'s weakest-subject pick reuses `buildSubjectWeakness`), P2-T4 (indirectly, as part of the shared foundation)
- Size: Small (2 files)
- Verification level: L2 — existing cases pass unmodified; new cases prove widened semantics

## Implementation Content
Export 3 helpers from `SOURCE/lib/adaptive/rankExams.ts`: `buildRepresentativeAttempts`, `buildGradeShares`, `buildSubjectWeakness` (widened return `Map<string, SubjectWeakness> | null`). Update the single in-file caller (`:186-187` → `.get(subject)?.weakness ?? 0`). Extend `SOURCE/lib/adaptive/__tests__/rankExams.test.ts` with new cases for the exported helpers (null-vs-0 semantics, `scoredAttempts` counting, representative = latest `submittedAt`, input-array immutability) — **existing cases must pass unmodified**.

## Target Files
- [x] `SOURCE/lib/adaptive/rankExams.ts`
- [x] `SOURCE/lib/adaptive/__tests__/rankExams.test.ts`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Query layer "Changes to rankExams.ts")
- `docs/design/exam-shelves-backend-design.md` (Interface Change Matrix — `buildSubjectWeakness` export + widened return type row)
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — `rankExams.test.ts` extension row)
- `docs/design/exam-shelves-backend-design.md` (Minimal Surface Alternatives, Element 2 — `examShelves.ts` + widened weakness, selected: one pure module, 3 helpers, 2 callers)
- `SOURCE/lib/adaptive/rankExams.ts` (`:186-187` the single in-file caller of `buildSubjectWeakness`; the full current, unexported implementations of all 3 helpers)
- `SOURCE/lib/adaptive/__tests__/rankExams.test.ts` (every existing case — this is the file whose diff must stay empty for pre-existing cases)

## Change Category
`Change Category: boundary-change`

`buildSubjectWeakness`'s return type widens from an internal-only shape to an exported `Map<string, SubjectWeakness> | null` contract that a second caller (`examShelves.ts`, P1-T4) will consume. Sweep the adjacent case: the single existing in-file caller at `:186-187` must be updated to the new `null`-vs-`0` semantics in the same commit, and no other file currently imports these 3 helpers (confirm via search) that would also need updating.

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D2) | dependency_direction | One personalised ranking — `rankExamIds` is reused for Cần luyện, never re-implemented | Does `examShelves.ts` (P1-T4) import and call `rankExamIds`/these exported helpers rather than re-implementing weakness/representative-attempt logic? (Evaluated fully once P1-T4 lands; this task's compliance is exporting the helpers in a form P1-T4 can import without duplication.) |

## Investigation Notes

**Investigation Targets read:**
- `exam-shelves-backend-design.md` § Query layer / Interface Change Matrix / Minimal Surface Alternatives Element 2: `buildSubjectWeakness(...): Map<string, number> | null` (private) widens to `export ... Map<string, SubjectWeakness> | null` where `SubjectWeakness = { weakness: number; scoredAttempts: number }`. Sole in-repo caller (`rankExams.ts:186-187`) updated in the same change to `.get(subject)?.weakness ?? 0`. `buildRepresentativeAttempts` is the loop currently inlined at `:148-154`, extracted+exported so P1-T4's AC-015 tie-break reads the same representative map. `buildGradeShares` exported unchanged (no semantic widening). Selected alternative (d): "one pure module + 3 exported helpers, 2 callers" — rejected alternatives were inlining the selection in `shelves.ts` (duplicate hot order) and recomputing weakness there (fails AC-016, second "weakest" definition).
- `rankExams.ts` (pre-change): confirmed `buildGradeShares`/`buildSubjectWeakness` were module-private; `buildSubjectWeakness`'s only caller was the local `subjectWeaknessOf` at `:186-187` reading `.get(subject) ?? 0`; the representative-selection loop was inlined directly in `rankExamIds` (no standalone function existed yet — `buildRepresentativeAttempts` needed to be extracted, not merely exported).
- `rankExams.test.ts`: baseline run before any edit — `31 passed (31)`. Every existing `describe` block (Test 1–8) uses `rankExamIds` only, none imports the 3 helpers directly, so widening could only regress existing behavior through the one in-file caller.

**Implementation:**
- Extracted the inline representative-selection loop (`:148-154` pre-change) into `export function buildRepresentativeAttempts(attempts: readonly RankAttempt[]): Map<string, RankAttempt>`, called from `rankExamIds` unchanged in effect.
- Added `export` to `buildGradeShares` — no signature or semantic change.
- Widened `buildSubjectWeakness` to `export function buildSubjectWeakness(representatives: Iterable<RankAttempt>): Map<string, SubjectWeakness> | null`, added `export interface SubjectWeakness { weakness: number; scoredAttempts: number }`. `null`-when-`sums.size===0` semantics, `clamp01`, and the "skip null subject / null / non-finite score" filter are all unchanged; only the map's value shape widened from a bare number to `{ weakness, scoredAttempts: count }`.
- Updated the sole in-file caller: `git diff` shows the caller changed from `subjectWeaknessBySubject.get(subject) ?? 0` to `subjectWeaknessBySubject.get(subject)?.weakness ?? 0` (reformatted across 3 lines for the added `?.weakness`, semantically identical to the task's prescribed change) — confirmed via `git diff -- SOURCE/lib/adaptive/rankExams.ts`, no other line in `rankExamIds`'s affinity/band/priorScore logic touched.

**Confirmations:**
- `git diff -- SOURCE/lib/adaptive/__tests__/rankExams.test.ts`: the only changes are (1) the import statement gaining 3 new named imports (no existing import removed/reordered), and (2) one new `describe("Test 9 — ...")` block appended after the closing brace of Test 8. Zero bytes changed inside Test 1–8's bodies.
- `grep -rn "from ['\"].*rankExams['\"]" SOURCE`: only `SOURCE/features/exams/queries/ranking.ts:16` (`import { rankExamIds } from "@/lib/adaptive/rankExams"` — unaffected, still imports only `rankExamIds`) and the test file itself. No other file imports `buildSubjectWeakness`/`buildGradeShares`/`buildRepresentativeAttempts` yet, confirming the adjacent-case sweep for this Change Category: P1-T4 will be the second caller.
- `npx tsc --noEmit -p SOURCE/tsconfig.json`: clean, zero errors — the widened return type does not break any other consumer.
- `npx vitest run lib/adaptive/__tests__/rankExams.test.ts` (post-change): `38 passed (38)` — 31 pre-existing + 7 new, 0 failed, 0 skipped.

**Binding Decision evaluation** (ADR-0021 § Decision D2, dependency_direction axis — "One personalised ranking — `rankExamIds` is reused for Cần luyện, never re-implemented"):
- Planned/actual approach: this task only exports the 3 helpers in importable form (`buildRepresentativeAttempts`, `buildGradeShares`, `buildSubjectWeakness` + `SubjectWeakness` type) with `rankExamIds` itself unchanged in behavior; it does not implement `examShelves.ts` or its caller (that is P1-T4).
- Evaluation: **Y** — the Compliance Check is explicitly scoped by its own text to "this task's compliance is exporting the helpers in a form P1-T4 can import without duplication," which is satisfied: the 3 helpers are now `export`ed with signatures matching the design doc's Interface Change Matrix exactly, and no parallel/duplicate implementation of weakness or representative-attempt logic was introduced anywhere in this change. Full compliance (whether `examShelves.ts` actually imports them instead of re-implementing) is deferred to P1-T4 as the row itself states.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Run `npx vitest run lib/adaptive/__tests__/rankExams.test.ts` and record the current green baseline (pre-change) so the "unmodified" claim can be verified against something concrete — `31 passed (31)`
- [x] Write new failing test cases for: null-vs-0 semantics of the widened `buildSubjectWeakness` return, `scoredAttempts` counting, representative = latest `submittedAt`, input-array immutability — confirmed RED (`7 failed | 31 passed (38)`, all failures `TypeError: ... is not a function`)
### 2. Green Phase
- [x] Export the 3 helpers and widen `buildSubjectWeakness`'s return type
- [x] Update the single in-file caller at `:186-187`
- [x] Run the new cases and confirm they pass
### 3. Refactor Phase
- [x] Run `git diff` restricted to pre-existing test case line ranges and confirm it is empty
- [x] Run the full `rankExams.test.ts` suite and confirm all existing + new cases green — `38 passed (38)`

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `lib/adaptive/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/adaptive/__tests__/rankExams.test.ts`; separately run `git diff` scoped to the pre-existing test case line ranges and confirm it is empty.
- **Success criteria**: all existing cases pass with 0 diff; new cases pass and specifically assert the `null`-when-nothing-scored semantics (not `0`, not `undefined`).
- **Failure response**: if an existing case's assertion needed to change to stay green, the widening was not backward-compatible — STOP and re-examine the return-type change rather than editing the existing case to match new behavior.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: `rankExams.test.ts`'s pre-existing cases pass with 0 edits after the export + widening.
  - **Primary failure mode**: the widened `buildSubjectWeakness` return type silently changes behavior for the existing single in-file caller (e.g. `null` now propagates where `0` used to), causing an existing personalised-ranking case to regress without any test file edit revealing it.
  - **Boundary to exercise**: in-process unit test (`rankExams.test.ts`'s existing suite, run unmodified).
  - **State assertion**: N/A (pure functions, no state transition).
  - **Mock boundary rationale**: none — pure computation, no I/O.
  - **Residual**: this proves `rankExams.ts`'s own existing test suite is unaffected; that `listExamsRanked`'s end-to-end output is also unaffected is P2-T4's proof obligation (`rating.int.test.ts:319-457` unmodified).
- **Claim**: the widened `SubjectWeakness` map preserves `null`-when-nothing-scored semantics — a subject with 0 scored attempts is `null`, never `0` or a synthesized zero-weakness entry.
  - **Primary failure mode**: the widening collapses "no data" and "data with zero weakness" into the same representation, which would make `examShelves.ts`'s weakest-subject pick (P1-T4) unable to distinguish "student has no data for this subject" from "student is doing fine in this subject."
  - **Boundary to exercise**: in-process unit test, new cases added in this task.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this is a pure-function contract proof, fully closed by the unit test.

## Completion Criteria
- [x] All added tests pass
- [x] `git diff` on pre-existing `rankExams.test.ts` cases is empty
- [x] Every Binding Decision's Compliance Check evaluates to `Y` (fully evaluable once P1-T4 lands and imports these helpers)
- [x] Gates 1-6 green

## Notes
- Impact scope: `rankExams.ts` (export + widen + 1 caller update), `rankExams.test.ts` (additive new cases).
- Scope boundary — preserve unchanged: every pre-existing test case's assertions and inputs in `rankExams.test.ts`.
