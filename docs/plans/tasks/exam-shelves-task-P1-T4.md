# Task P1-T4 — `lib/adaptive/examShelves.ts` (the ladder) + 4 new constants

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T4**
Layer: backend (`SOURCE/lib/adaptive/`)

Metadata:
- Dependencies: none directly within Phase 1 (consumes P1-T3's exported `buildSubjectWeakness` conceptually, but is committed independently — the import binds correctly once both land)
- Blocks: P2-T3 (ExamShelf consumes these types), P2-T4 (attempts.ts extraction uses `ShelfAttempt`), P3-T1 (`hotCounts.ts` uses the constants), P4-T2 (`orderIdsByHotCount` reused in the `?sort=hot` branch)
- Size: Small-Medium (3 files)
- Verification level: L2

## Implementation Content
Add 4 named constants to `SOURCE/lib/adaptive/constants.ts` (`HOT_SHELF_MIN_CARDS=5`, `SHELF_MAX_CARDS=10`, `HOT_WINDOW_RECENT_DAYS=7`, `HOT_WINDOW_WIDE_DAYS=30`, each with a JSDoc block sized like the shipped weights'). Create `SOURCE/lib/adaptive/examShelves.ts` (pure module: `HotRung` type, `HotCounts`/`ShelfCandidate`/`ShelfAttempt` interfaces, `pickHotShelf`, `pickWeakestSubject`, `pickDominantGrade`, `pickExploreShelf`, `orderIdsByHotCount`, per the backend DD § The ladder pseudocode). Create `SOURCE/lib/adaptive/__tests__/examShelves.test.ts`.

## Target Files
- [ ] `SOURCE/lib/adaptive/constants.ts`
- [ ] `SOURCE/lib/adaptive/examShelves.ts` (new)
- [ ] `SOURCE/lib/adaptive/__tests__/examShelves.test.ts` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The ladder (pseudocode — `SOURCE/lib/adaptive/examShelves.ts`, pure), `:407-467` incl. the "Decisions, not incidentals" comment block)
- `docs/design/exam-shelves-backend-design.md` (§ Query layer "The four types")
- `docs/design/exam-shelves-backend-design.md` (Minimal Surface Alternatives, Element 2)
- `docs/design/exam-shelves-backend-design.md` (Data Representation Decision — `ShelfAttempt` extends `RankAttempt`)
- `SOURCE/lib/adaptive/constants.ts` (existing weight constants — JSDoc style precedent to match)
- `SOURCE/lib/adaptive/rankExams.ts` (P1-T3's exported `buildSubjectWeakness`, `buildRepresentativeAttempts`, `buildGradeShares` — the helpers this module reuses, never re-implements)

## Change Category
`Change Category: boundary-change`

The Data Representation Decision (extending `RankAttempt` → `ShelfAttempt`, adding 3 shelf types) is a contract-change per the plan's Design-to-Plan Traceability table. Sweep the adjacent case: `P2-T4`'s `attempts.ts` extraction and `P3-T2`'s `shelves.ts` both consume `ShelfAttempt` — confirm the type shape defined here matches what both downstream consumers expect (verified by their own test suites once they land).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D2) | data_flow | Rank-then-cut stays binding — no `.limit()`/`.range()` in `fetchExamRows`; every shelf cut to 10 in Node after ordering | Does every `pick*` function order its full candidate set before applying `SHELF_MAX_CARDS`, with 0 SQL-level `LIMIT` anywhere in this module (this module has no DB access at all)? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D2) | dependency_direction | One personalised ranking — `rankExamIds` is reused for Cần luyện, never re-implemented | Does `pickWeakestSubject` call into `rankExams.ts`'s exported `buildSubjectWeakness`/`buildGradeShares`/`buildRepresentativeAttempts` rather than reimplementing weakness computation? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D4) | placement | The ladder is evaluated in Node; the clock is read once, in the query layer — never inside `lib/adaptive` | Does every function in `examShelves.ts` take `now`/window boundaries as a parameter rather than calling `Date.now()`/`new Date()` internally? |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-048) | structure-order | "the total order is [subject never attempted by this student DESC, school never attempted by this student DESC, exams.created_at DESC, exam id ASC], cut to 10 in Node" | Does `pickExploreShelf` sort candidates in exactly this 4-key order before cutting to `SHELF_MAX_CARDS`? |
| docs/prd/exam-shelves-prd.md (§ AC-018) | structure-order | "submitted attempt count DESC, exam id ASC, where the count includes attempts by all students, not only the caller" | Does `orderIdsByHotCount` sort by `total_count DESC, exam id ASC`, using the cross-user aggregate's count (not a per-caller count)? |

## Investigation Notes
_(Record here: confirmation `pickWeakestSubject` calls into P1-T3's exported helpers rather than duplicating logic; confirmation no `Date.now()`/`new Date()` call exists anywhere in this module.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write failing cases for: ladder rung order incl. the U3 three-rung cold-start branch, `HOT_SHELF_MIN_CARDS` boundary at 4/5/6 qualifying exams, AC-018 order, AC-025 no-demotion, AC-015 tie-breaks, dominant-grade tie-breaks, AC-048 explore order, AC-029 dedup, cut-to-10, determinism on shuffled input
- [ ] Run and confirm all fail because the module does not yet exist
### 2. Green Phase
- [ ] Add the 4 constants to `constants.ts`
- [ ] Implement `examShelves.ts`'s types and 5 functions per the DD pseudocode
- [ ] Run tests and confirm all pass
### 3. Refactor Phase
- [ ] Confirm `pickWeakestSubject` genuinely calls P1-T3's exported helpers (not a parallel re-implementation)
- [ ] Confirm 0 `Date.now()`/`new Date()` calls exist in this file

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `lib/adaptive/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run lib/adaptive/__tests__/examShelves.test.ts`; independently hand-compute expected literals for the AC-018/AC-048/AC-015 orderings rather than deriving expectations from the implementation itself.
- **Success criteria**: all cases green, including the boundary cases at exactly 4/5/6 qualifying exams for `HOT_SHELF_MIN_CARDS`, and a determinism case that shuffles input order and asserts identical output order.
- **Failure response**: if a boundary case (4/5/6) is off by one, re-check the ladder's rung condition against the DD pseudocode's exact comparison operator (`>=` vs `>`) rather than adjusting the test's expected boundary.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (AC-019–AC-022, same-value / missing-sort-key ordering): the ladder widens at the correct boundary — exactly 4 qualifying exams does not widen the rung, exactly 5 does.
  - **Primary failure mode**: off-by-one at the 4/5/6 boundary — the single highest-risk defect class in this module per the plan's own Failure Mode Checklist.
  - **Boundary to exercise**: in-process unit test, literal boundary cases.
  - **State assertion**: N/A (pure function).
  - **Mock boundary rationale**: none.
  - **Residual**: none within this module; the composition-level wiring of these rungs into a live count is P3-T2's.
- **Claim** (AC-018/AC-048/AC-015, missing-sort-key ordering): tie-break order is deterministic and correct when counts/dates are equal.
  - **Primary failure mode**: array sort with an unstable or missing tie-break comparator, producing input-order-dependent output.
  - **Boundary to exercise**: in-process unit test, including a shuffled-input determinism case.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (AC-025): the hot shelf never demotes an exam the student already submitted — the demotion band is never consulted for the hot shelf specifically.
  - **Primary failure mode**: the demotion band (used elsewhere in `rankExams.ts`'s personalised ranking) is accidentally applied to the hot-shelf pick, hiding an exam the student should still see.
  - **Boundary to exercise**: in-process unit test.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [ ] All added tests pass, covering the full case list above
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `constants.ts` (additive), `examShelves.ts` (new), its test file (new).
- Scope boundary — preserve unchanged: existing constants in `constants.ts`; no DB or clock access anywhere in this module (ADR-0021 D4).
