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
- [x] `SOURCE/lib/adaptive/constants.ts`
- [x] `SOURCE/lib/adaptive/examShelves.ts` (new)
- [x] `SOURCE/lib/adaptive/__tests__/examShelves.test.ts` (new)

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

**Investigation Targets read:**
- Backend DD `:407-467` "The ladder" pseudocode — 5 functions (`pickHotShelf`, `pickWeakestSubject`, `pickDominantGrade`, `pickExploreShelf`, `orderIdsByHotCount`), exact signatures, exact sort keys, exact comparison operator (`>=` for the `minCards` boundary — confirmed by cross-reading Operation Verification Methods' failure-response line, which says re-check `>=` vs `>` rather than adjust the test).
- DD `:326-336` "Query layer / The four types" — `HotRung` (6-value union), `HotCounts {recent, wide, total}`, `ShelfCandidate extends RankExamCandidate {school}`, `ShelfAttempt extends RankAttempt {school}`, declared once in `lib/adaptive/examShelves.ts` (this task's file).
- DD `:559-566` Minimal Surface Alternatives, Element 2 — confirms `examShelves.ts` is "one pure module + 3 exported helpers, 2 callers" (actually 5 exported functions per the pseudocode — the "3 exported helpers" phrase in the alternatives table refers to the 3 *reused* `rankExams.ts` helpers, not this module's own export count); rejected alternatives (a) inline in `shelves.ts` (2nd copy), (b) recompute weakness in `shelves.ts` (fails AC-016), (c) fold into `rankExamIds` (fails AC-025 + purity).
- DD `:555-557` Data Representation Decision — `ShelfAttempt extends RankAttempt` (lifecycle fit "yes"), `ShelfCandidate` needed because `RankExamCandidate` has no `school`.
- `constants.ts` (existing) — JSDoc precedent: each constant gets a block stating (1) what PRD/ADR decision fixed the number, (2) the observation/measurement behind it, (3) what breaks if set wrong. Followed for all 4 new constants.
- `rankExams.ts` — confirmed exported: `buildRepresentativeAttempts(attempts) -> Map<string, RankAttempt>`, `buildGradeShares(attempts) -> Map<number, number> | null`, `buildSubjectWeakness(representatives: Iterable<RankAttempt>) -> Map<string, SubjectWeakness> | null` (widened return, `SubjectWeakness = {weakness, scoredAttempts}`). Also confirmed: `isLater()` (null-always-loses helper) is **not** exported — `rankExams.ts` is not a Target File for this task, so it cannot be edited to export it; `pickDominantGrade` needs the identical "null submittedAt always loses" convention and re-implements it locally as a 3-line private helper (unavoidable, since the alternative — editing `rankExams.ts` — is out of scope).

**Composition-layer boundary (important for Binding Decision D2 below):** the DD's "Data Flow — the body of `listExamShelves()`" pseudocode (`:181-208`, in the query layer, not this module) shows `buildRepresentativeAttempts`/`buildSubjectWeakness`/`buildGradeShares` and `rankExamIds` all called in the **composition** function (`shelves.ts`, P3-T2 — out of scope here), which then passes the **already-computed** `weakness`/`shares` Maps into `pickWeakestSubject(weakness)`/`pickDominantGrade(shares, attempts)`. This matches "The ladder" pseudocode's own signatures verbatim (`pickWeakestSubject(weakness) -> ...`, not `pickWeakestSubject(attempts) -> ...`). So `examShelves.ts` in this task imports only the **types** it needs from `rankExams.ts` (`RankExamCandidate`, `RankAttempt`, `SubjectWeakness`) — it does not call `buildSubjectWeakness`/`buildGradeShares`/`buildRepresentativeAttempts` itself, because those calls belong to the composition layer this task does not implement.

**Binding Decisions — planned approach and compliance:**
- **Axis `data_flow`** (D2, rank-then-cut): planned approach — every `pick*` function computes its full ordered candidate pool first (array `.sort()` over the complete filtered set), then slices to `maxCards`/`minCards`-bounded output; the module has zero Supabase/DB access, zero `.limit()`/`.range()` calls (it never touches a query builder at all). Evaluation: **Y** — no SQL surface exists in this file to violate the rule.
- **Axis `dependency_direction`** (D2, one personalised ranking / no parallel weakness copy): planned approach — `pickWeakestSubject` and `pickDominantGrade` consume the `Map` types (`SubjectWeakness`, grade-share) that `rankExams.ts`'s exported helpers produce (imported as TS types), and perform **only** the AC-015/dominant-grade **selection** (tie-break sort) over an already-computed map — they never recompute a weakness or grade-share arithmetic from raw attempts themselves (that arithmetic lives solely in `buildSubjectWeakness`/`buildGradeShares`). This is the "reuse, don't reimplement" contract satisfied at the data/type level, consistent with the DD's own Data Flow pseudocode which calls those 3 helpers only in the composition layer (outside this task's files). Evaluation: **Y** — verified no parallel weakness/share arithmetic exists in `examShelves.ts`; only selection/tie-break logic.
- **Axis `placement`** (D4, clock read once in query layer, never in `lib/adaptive`): planned approach — every function takes `now`-derived facts (`counts: Map<string, HotCounts>` already keyed by pre-computed windows, `dominantGrade`, `minCards`/`maxCards`) as parameters; zero `Date.now()`/`new Date()` calls anywhere in the file; the only date-related call is `Date.parse(candidate.createdAt)` inside `pickExploreShelf`'s AC-048 sort key, which parses an existing ISO string field, not the current time. Evaluation: **Y**.

**Reference Contracts — planned approach and compliance:**
- **AC-048 explore order**: planned approach — `pickExploreShelf` precomputes 4 sort keys per candidate (`attemptedSubjects.has(subject) ? 1 : 0`, `school !== null && !attemptedSchools.has(school) ? 0 : 1`, `-Date.parse(createdAt)` with unparsable treated as oldest via a `Number.NEGATIVE_INFINITY` sentinel — never `NaN`, so the comparator stays total-order — , `id`), then a single stable `.sort()` on the precomputed keys, then `.slice(0, maxCards)`. Evaluation: **Y**.
- **AC-018 hot order**: planned approach — `orderIdsByHotCount` sorts by `counts.get(id)?.total ?? 0` DESC then `id` ASC, over whatever `candidates`/`counts` the caller passes (the caller — `shelves.ts`/`ranking.ts`, out of scope — is responsible for passing the cross-user aggregate's `counts` map, not a per-caller count; this module has no way to compute a per-caller count itself since it receives `counts` as an opaque `ReadonlyMap` parameter). Evaluation: **Y**.

**AC-025 (no-demotion) note:** `pickHotShelf`'s signature (`{counts, candidates, dominantGrade, minCards, maxCards}`) never receives `attempts` or a submitted-id set at all, so there is no code path by which the demotion band could be consulted — the guarantee holds by construction (absence of the input), not by a conditional skip.

**Adjacent Case Sweep (Change Category: boundary-change):** `P2-T4` (`queries/attempts.ts`) and `P3-T2` (`queries/shelves.ts`) both consume `ShelfAttempt`, but neither file exists yet in this worktree — there is no adjacent file within this task's own scope to read or extend. The residual is exactly what the task description already names: `ShelfAttempt`/`ShelfCandidate` here are typed verbatim to the DD's declared shape (`:334-335`, `extends RankAttempt`/`extends RankExamCandidate` respectively, `school: string | null` the only added field on each), so a future mismatch would be a downstream authoring error, not something this task's test suite can pre-empt — recorded here per the sweep's own instruction ("verified by their own test suites once they land").

**Exit Gate re-evaluation (post-implementation, against the final code in `examShelves.ts`):**
- Binding Decision `data_flow`: **Y** — `grep` for `.limit(`/`.range(`/`supabase`/`from(` in `examShelves.ts` returns nothing; the module imports only types from `rankExams.ts`.
- Binding Decision `dependency_direction`: **Y** — `pickWeakestSubject`/`pickDominantGrade` take `weakness: ReadonlyMap<string, SubjectWeakness> | null` / `shares: ReadonlyMap<number, number> | null` as parameters (types imported from `rankExams.ts`) and only sort/select over them; no arithmetic on raw `totalScore`/`attempts` counts appears anywhere in this file.
- Binding Decision `placement`: **Y** — `grep -n "Date.now\|new Date"` on `examShelves.ts` matches only the header comment's prose (the literal strings "Date.now()"/"new Date()" appear inside a Vietnamese sentence, not as code); the only date API call in the file is `Date.parse(c.createdAt)` inside `createdAtSortKey`, parsing an input field, not the clock.
- Reference Contract AC-048: **Y** — `pickExploreShelf` test group (Test 7/8/9) exercises all 4 keys independently plus the `school === null` and unparsable-`createdAt` edge cases; all pass.
- Reference Contract AC-018: **Y** — `orderIdsByHotCount` test group (Test 3) confirms `total DESC, id ASC` and that the function reads only the injected `counts` map, never a per-caller count (no `attempts` parameter exists on this function at all).
- Full `lib/adaptive/__tests__/examShelves.test.ts` run: 41/41 passed. Full `lib/adaptive/` regression run (incl. unmodified `rankExams.test.ts`): 159/159 passed. `npx tsc --noEmit`: clean. `npx eslint lib/adaptive/examShelves.ts lib/adaptive/constants.ts lib/adaptive/__tests__/examShelves.test.ts --max-warnings 0`: clean.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing cases for: ladder rung order incl. the U3 three-rung cold-start branch, `HOT_SHELF_MIN_CARDS` boundary at 4/5/6 qualifying exams, AC-018 order, AC-025 no-demotion, AC-015 tie-breaks, dominant-grade tie-breaks, AC-048 explore order, AC-029 dedup, cut-to-10, determinism on shuffled input
- [x] Run and confirm all fail because the module does not yet exist
### 2. Green Phase
- [x] Add the 4 constants to `constants.ts`
- [x] Implement `examShelves.ts`'s types and 5 functions per the DD pseudocode
- [x] Run tests and confirm all pass
### 3. Refactor Phase
- [x] Confirm `pickWeakestSubject` genuinely calls P1-T3's exported helpers (not a parallel re-implementation) — resolved as: it consumes the `Map` type those helpers produce (per DD's own Data Flow pseudocode, which calls the helpers in the composition layer, out of this task's scope), never recomputing weakness arithmetic itself. See Investigation Notes.
- [x] Confirm 0 `Date.now()`/`new Date()` calls exist in this file

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
- [x] All added tests pass, covering the full case list above
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green — L2 gates run and green for this task's scope (`tsc --noEmit`, `eslint --max-warnings 0`, `vitest run lib/adaptive/`); `npm run build` / `test:fixture` / `test:localdb` are project-wide gates owned by the quality-assurance process per this agent's Responsibility Boundaries, not re-run here

## Notes
- Impact scope: `constants.ts` (additive), `examShelves.ts` (new), its test file (new).
- Scope boundary — preserve unchanged: existing constants in `constants.ts`; no DB or clock access anywhere in this module (ADR-0021 D4).
