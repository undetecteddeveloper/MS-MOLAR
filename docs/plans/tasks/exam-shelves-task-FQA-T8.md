# Task FQA-T8 — Coverage check

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T8**
Layer: cross-cutting (verification only — no source files changed)

Metadata:
- Dependencies: Phase 8 complete
- Blocks: none
- Size: Small (0 files; 1 coverage report review)
- Verification level: L2

## Implementation Content
Coverage check — confirm new/changed files meet the project's coverage configuration. Per the testing-principles guidance, coverage is a diagnostic signal for finding untested areas, not a target to be gamed — use it to spot genuinely untested logic, not to justify adding trivial assertions.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `SOURCE/vitest.config.ts` (the project's coverage configuration, if any threshold is declared)
- every new/changed file listed in the plan's Design-to-Plan Traceability table (the full set introduced or modified by P0-T1 through P8-T4)

## Investigation Notes

**Coverage tooling — not configured.** `SOURCE/vitest.config.ts` declares no `test.coverage` block (no threshold). `npx vitest run --coverage` fails fast with `MISSING DEPENDENCY '@vitest/coverage-v8'` — neither `@vitest/coverage-v8` nor `@vitest/coverage-istanbul` is a devDependency, and neither package exists under `node_modules/@vitest`. Installing one to produce a percentage would add a new dependency, which conflicts with this same feature's own AC-045 ("0 new dependencies") and is out of scope for a 0-file verification-only task. Per the task's own Red-Phase instruction ("run the coverage command **if configured**") and the Operation Verification Method ("review the report for genuinely untested critical paths, **not just the raw percentage**"), this task proceeds as a manual/structural review against the plan's Design-to-Plan Traceability table (`docs/plans/20260918-feature-exam-shelves.md` lines 73-142) and the three critical-path categories the Success Criteria name explicitly.

**Full unit/integration suite** (`npx vitest run`, from `SOURCE/`): 158 passed test files / 1 failed / 1 skipped file; 2207 tests passed, 1 failed, 10 skipped. The 1 failure is `lib/security/rateLimit.test.ts` — `33 <= 20` — the plan's documented pre-existing baseline failure (work plan line 71), unrelated to exam shelves, unchanged. The 10 skipped tests all belong to `lib/tutor/__tests__/toneEval.manual.test.ts` (a different feature, manual/live-API-gated), 0 of them in any exam-shelves file. `npm run test:fixture`: 2 files / 10 tests, all passed (includes `exam-shelves.fixture.e2e.test.ts`, filled in, not a skeleton).

**Ladder boundary conditions** (Success Criteria item 1) — `lib/adaptive/__tests__/examShelves.test.ts` (691 lines, 10 `describe` blocks): Test 2 asserts the exact off-by-one boundary of `HOT_SHELF_MIN_CARDS` at 4 (widens), 5 (stops, `=== min`), and 6 (stops, `> min`) qualifying exams — the highest-risk class the plan's own Failure Mode Checklist names. Test 1 covers rung-order incl. the AC-023 cold-start 3-step-only branch. Test 9 covers the `SHELF_MAX_CARDS` cut-after-rank boundary at 15 candidates -> 10. Tests 3/4/5/6/7/8 cover tie-breaks, determinism-under-shuffle, and the AC-025 "no demotion band leak" case. No gap found.

**Normalisation functions** (Success Criteria item 2) — `lib/exams/attemptSource.ts` (`toAttemptSource`) and `lib/exams/browseParams.ts` (`hasBrowseParam`): both are small pure functions with edge-case-exhaustive tests — `attemptSource.test.ts` covers all 4 valid literals (`it.each`), `undefined`/`null`/empty-string/wrong-case/injection-string/array/empty-array all resolving to `'none'` without throwing (AC-041). `browseParams.test.ts` covers all 10 `BROWSE_PARAM_KEYS` present (`it.each`), absent-key and unrelated-key `false` cases, and the "present but malformed value still counts as present" cases (`?sort=garbage`, `?page=abc`, lone `?dir`, empty string, array value) plus the `{ key: undefined }` false case. No gap found.

**Composition budget checks** (Success Criteria item 3) — `features/exams/__tests__/shelves.int.test.ts` Candidate 1 asserts `listExamShelves()` issues exactly 4 boundary calls (3 `.from` + 1 `.rpc`) all fired before any settles (deferred-gate technique), the RPC's `p_max_rows` argument is the imported `LIST_ROW_CEILING + 1` (not a hand-copied literal), and the `readBounded` label is exact. Candidate 2 proves the 0-card-shelf-is-`null` structural rule (AC-051/AC-013/AC-024), `listHotExams`'s 3-call budget (no `exam_results` read) with `submittedExamIds` sourced from the same read, the F-001 guard-pattern issuing 0 calls, and AC-049/D13 cross-shelf overlap (practice ∩ hot allowed, not deduped). The `?sort=hot` / `?sort=garbage` budget (F-005, the 4th `Promise.all` member on the existing `listExamsRanked` path) is the 3rd candidate, appended to `rating.int.test.ts` (`describe("listExamsRanked — ?sort=hot / ?sort=garbage composition budget...")`, lines ~840-934) exactly where the plan's Selection section places it. `features/exams/queries/__tests__/hotCounts.test.ts` (160 lines, 11 tests) separately covers the shared window/RPC-shape module all three call sites consume. No gap found.

**Other Design-to-Plan Traceability rows spot-checked**: `rankExams.test.ts` Test 9 (P1-T3, `buildSubjectWeakness`/`buildGradeShares`/`buildRepresentativeAttempts` export + widened `scoredAttempts` field, incl. the null-vs-0-map distinction). `features/exams/queries/attempts.ts` (P2-T4) has no standalone `attempts.test.ts`: its `gradeOfAttempt`/`subjectOfAttempt`/`embeddedExam` logic is a verbatim move from `ranking.ts` (already proven by the pre-existing `rating.int.test.ts` before this feature), and its new thin wrappers (`readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts`, incl. the new `school` facet) are exercised through `shelves.int.test.ts`'s fixture builders (`attemptRow()` embeds `school`) — assessed as a non-issue (thin extraction/wrapper, exercised transitively), not a genuine gap. Frontend component/e2e files confirmed non-placeholder by line/case count: `ExamCard.snapshot.test.tsx` (74 lines/3 cases), `ExamShelf.test.tsx` (320 lines/16 cases), `exam-shelves.fixture.e2e.test.ts` (536 lines/5 cases, green under `test:fixture`), `exam-hot-counts.service.e2e.test.ts` (332 lines/6 cases; not re-run here — live-dev-DB-gated, same constraint FQA-T5/T6 already documented and deferred, out of this task's scope to re-litigate).

**Conclusion**: no genuinely untested critical path found. No targeted test added — none of the Success Criteria's three named categories (ladder boundaries, normalisation functions, composition budget checks) has a gap, and the plan's own Traceability table already marks all rows `covered`. Consistent with the testing-principles guardrail against gaming a coverage percentage, no trivial/tautological test was added since there is no numeric percentage to move and no real gap to close.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Run the project's coverage command (if configured) restricted to or filtered for this feature's changed files — not configured (see Investigation Notes); ran `npx vitest run` and `npm run test:fixture` instead as the substantive substitute evidence
### 2. Green Phase
- [x] Review the report; for any file below threshold, determine whether the untested lines represent a real gap (add a targeted test) or a non-issue (e.g. an unreachable branch, a type-narrowing guard) — no threshold exists; manual review against the plan's Traceability table and the 3 named critical-path categories found no gap
### 3. Refactor Phase
- [x] Do not add trivial/tautological tests solely to raise a percentage — per the testing-principles guidance, prioritize meaningful assertions over the coverage number — no test added; none was needed

## Operation Verification Methods
- **Verification method**: run the project's configured coverage tooling against the feature's changed file set; review the report for genuinely untested critical paths (not just the raw percentage).
- **Success criteria**: no critical business-logic path (the ladder's boundary conditions, the normalisation functions, the composition budget checks) is left without a test exercising it; the project's configured threshold, if any, is met or any shortfall is explained.
- **Failure response**: if a critical path is found untested, add a targeted test for it (this may require reopening the relevant earlier task) rather than adding an unrelated trivial test elsewhere to satisfy a percentage.
- **Verification level**: L2.

## Completion Criteria
- [x] Coverage report reviewed for the full changed-file set — no coverage tool configured; manual structural review substituted (see Investigation Notes)
- [x] Every critical path (per the review) confirmed exercised by an existing test, or a targeted test added — all 3 named categories (ladder boundaries, normalisation functions, composition budget checks) confirmed exercised; no gap, no test added
- [x] Investigation Notes record the coverage summary and any judgment calls made

## Notes
- Impact scope: none expected; if a genuine gap is found, closing it may require a follow-up edit to an earlier task's test file.
- Scope boundary: do not add tests purely to game the coverage percentage.
