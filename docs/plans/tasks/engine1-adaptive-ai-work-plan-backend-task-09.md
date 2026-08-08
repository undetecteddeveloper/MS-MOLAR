# Task 09 (Backend): `hasBeenWrongTwice` mechanism — `lib/scoring/wrongTwice.ts` + `getResult()` integration (Work Plan Phase 3, Task 9)

Metadata:
- Dependencies: none (does not require backend-task-01's schema checkpoint — reads only existing `exam_results`/`attempt_answers`-derived data already in scope, no new table)
- Provides: `computeWrongTwiceQuestionIds()`, consumed by backend-task-10 (fixture-construction consistency), backend-task-13 (`explainStep()`'s server-side re-verification), frontend-task-01 (`ExplainStepAffordance`'s mount gate via `getResult()`'s output)
- Size: Medium (4 files: `wrongTwice.ts`, `queries.ts` extension, `types/result.ts` extension, `wrongTwice.test.ts`)

## Implementation Content

Implement `computeWrongTwiceQuestionIds()` (`SOURCE/lib/scoring/wrongTwice.ts`) — pure function, `Set<string>` of question IDs scored incorrect on ≥2 distinct attempt IDs across ALL of a user's submitted attempts (mirrors `computeScore.ts`'s `isScored()` convention exactly: `scored !== false`). Wire it into `getResult()` (`SOURCE/app/(layer2)/queries.ts`) via a new parallel (`Promise.all`) cross-attempt query, and add `PerQuestionResult.hasBeenWrongTwice?: boolean` (`SOURCE/types/result.ts`), computed only when `row.scored !== false && !row.isCorrect` (else `undefined`).

Convert `wrongTwice.test.ts`'s 3 already-generated tests into real vitest tests in the same commit:
- Test 1 (cross-attempt ≥2-distinct threshold)
- Test 2 (`scored:false` exclusion vs. `scored:undefined` inclusion parity)
- Test 3 (cross-exam global question identity)

## Target Files
- [ ] `SOURCE/lib/scoring/wrongTwice.ts` (new — `computeWrongTwiceQuestionIds()`)
- [ ] `SOURCE/app/(layer2)/queries.ts` (additive — new parallel cross-attempt query wired into `getResult()`)
- [ ] `SOURCE/types/result.ts` (additive — `PerQuestionResult.hasBeenWrongTwice?: boolean`)
- [ ] `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (fill in the existing skeleton's 3 tests)

## Investigation Targets
- `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (already generated — read in full: the contract-under-test comment, all 3 tests' exact annotations)
- `SOURCE/lib/scoring/computeScore.ts` (lines ~36-42, `isScored()` — the exact `scored !== false` convention this function must mirror; Code Inspection Evidence cited directly by the skeleton)
- `SOURCE/app/(layer2)/queries.ts` (`getResult()`, its existing `Promise.all` block around line 242, and `perQuestion: row.per_question` around line 358 — the exact wiring point for the new parallel query)
- `SOURCE/types/result.ts` (`PerQuestionResult` interface, its existing `scored?: boolean` field and its own doc-comment on the essay/scored convention)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/scoring/wrongTwice.ts` + `getResult()` integration; § Data Contracts — `computeWrongTwiceQuestionIds()` Consumer-side gating, verbatim source for the Reference Contract below; § Minimal Surface Alternatives Element 1 — computed on read, 0 new persistent state)

## Change Category

`Change Category: boundary-change`

This task extends `getResult()`'s existing published output shape (`ExamResult.perQuestion[].hasBeenWrongTwice`), consumed today by `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` and any other existing caller. Sweep required: confirm every pre-existing field of `PerQuestionResult`/`ExamResult` remains byte-identical for rows where `hasBeenWrongTwice` is `undefined` (i.e. this is a strictly additive extension, not a reshape) — check `getResult()`'s other callers/consumers beyond the result-detail page for any assumption about the exact key set of a `PerQuestionResult` row (e.g. exhaustive destructuring or `Object.keys()` usage) that a new optional field could break.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-backend-design.md (§ Data Contracts — `computeWrongTwiceQuestionIds()` Consumer-side gating) | derived-display | "hasBeenWrongTwice = (row.scored !== false \&\& !row.isCorrect) ? wrongTwiceSet.has(row.questionId) : undefined" | Does `getResult()`'s wiring compute `hasBeenWrongTwice` exactly per this formula (never set for `scored === false` or `isCorrect === true` rows, `undefined` in those cases) (Y/N)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets, in particular `computeScore.ts`'s `isScored()` and `wrongTwice.test.ts`'s 3 tests in full.
- [ ] Convert the 3 skeleton tests into real vitest tests, using the exact literal fixtures described in each test's Behavior/Proof-obligation annotation.
- [ ] Run the tests and confirm all 3 fail (no `wrongTwice.ts` implementation exists yet).

### 2. Green Phase
- [ ] Implement `computeWrongTwiceQuestionIds()` — cross-attempt aggregation by distinct `attemptId`, `scored !== false` gate, global (not per-exam) `questionId` identity.
- [ ] Run `npx vitest run lib/scoring/__tests__/wrongTwice.test.ts` — confirm all 3 pass.
- [ ] Wire the new parallel cross-attempt query into `getResult()`'s existing `Promise.all`, add `hasBeenWrongTwice` to the returned `perQuestion` rows per the Reference Contract formula above.
- [ ] Add `hasBeenWrongTwice?: boolean` to `PerQuestionResult` in `types/result.ts`.

### 3. Refactor Phase
- [ ] Confirm every pre-existing field of `getResult()`'s output is byte-identical for a fixture attempt with no wrong-twice questions (regression check per Change Category sweep above).

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `lib/scoring/wrongTwice.ts`

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/scoring/__tests__/wrongTwice.test.ts`; separately, compare `getResult()`'s output for a fixture attempt against its pre-change output shape (Output Comparison technique, this repo's own precedent from the History feature's `getResult()` extension).
- **Success criteria**: all 3 unit tests pass; `hasBeenWrongTwice` computed correctly and wired into `getResult()`'s existing output shape (byte-identical for all pre-existing fields) — Phase 3 Completion Criteria.
- **Failure response**: if the Output Comparison reveals any pre-existing field changed shape/value, treat as a regression — do not proceed to backend-task-10, which relies on `getResult()`'s stability for its own real-DB fixture construction.
- **Verification level**: L2 (new tests added and passing) plus an explicit Output Comparison regression check on the extended function.

## Proof Obligations
(Sourced verbatim from `wrongTwice.test.ts`'s own annotations.)
- **Claim**: Test 1 — a question scored incorrect on ≥2 distinct attempt IDs is included in the returned Set; a question wrong on only 1 attempt is excluded.
- **Primary failure mode**: the function counts wrong OCCURRENCES within a flattened list instead of DISTINCT attemptIds, over-including a once-attempted question; or treats "wrong on exactly 1 attempt" as satisfying "≥2" (off-by-one).
- **Boundary to exercise**: in-process unit (pure function, literal attempt/perQuestion fixtures).
- **State assertion**: N/A (pure function).
- **Mock boundary rationale**: none — no I/O.
- **Residual**: none at the pure-function level; the wiring into `getResult()`'s real cross-attempt query is proven by backend-task-10's use of the same fixture-construction convention, not by this file's own unit tests.
- **Claim**: Test 2 — `scored: false` rows are excluded even if wrong on 2 attempts; `scored: undefined` rows are included (mirrors `computeScore.ts`'s `isScored()` convention).
- **Primary failure mode**: the predicate is written as `scored === true` instead of `scored !== false`, silently excluding every question whose `scored` field was never explicitly set to `true`.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: Test 3 — a question shared by two different exams' attempts still counts toward the same ≥2-distinct-attempts threshold (global identity, not per-exam).
- **Primary failure mode**: the aggregation is accidentally scoped per-exam instead of globally by `questionId` across ALL of the user's attempts.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [ ] `wrongTwice.ts` implemented; all 3 `wrongTwice.test.ts` tests pass
- [ ] `getResult()` extended with `hasBeenWrongTwice`, Reference Contract Compliance Check `Y`, evidence recorded
- [ ] Output Comparison confirms all pre-existing `getResult()` fields byte-identical
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/lib/scoring/wrongTwice.ts` (new), `SOURCE/app/(layer2)/queries.ts` (additive), `SOURCE/types/result.ts` (additive).
- Scope boundary: do not modify `explainStep()` (backend-task-13, separate caller of this same function) or `ResultDetailPage`'s render (frontend-task-01) here.
