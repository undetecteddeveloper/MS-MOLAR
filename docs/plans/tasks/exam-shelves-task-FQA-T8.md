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
_(Record here: the coverage report's summary for the changed file set; any file found below the project's configured threshold, with an assessment of whether the gap is a genuinely untested path or an artifact of the metric (e.g. an unreachable defensive branch).)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Run the project's coverage command (if configured) restricted to or filtered for this feature's changed files
### 2. Green Phase
- [ ] Review the report; for any file below threshold, determine whether the untested lines represent a real gap (add a targeted test) or a non-issue (e.g. an unreachable branch, a type-narrowing guard)
### 3. Refactor Phase
- [ ] Do not add trivial/tautological tests solely to raise a percentage — per the testing-principles guidance, prioritize meaningful assertions over the coverage number

## Operation Verification Methods
- **Verification method**: run the project's configured coverage tooling against the feature's changed file set; review the report for genuinely untested critical paths (not just the raw percentage).
- **Success criteria**: no critical business-logic path (the ladder's boundary conditions, the normalisation functions, the composition budget checks) is left without a test exercising it; the project's configured threshold, if any, is met or any shortfall is explained.
- **Failure response**: if a critical path is found untested, add a targeted test for it (this may require reopening the relevant earlier task) rather than adding an unrelated trivial test elsewhere to satisfy a percentage.
- **Verification level**: L2.

## Completion Criteria
- [ ] Coverage report reviewed for the full changed-file set
- [ ] Every critical path (per the review) confirmed exercised by an existing test, or a targeted test added
- [ ] Investigation Notes record the coverage summary and any judgment calls made

## Notes
- Impact scope: none expected; if a genuine gap is found, closing it may require a follow-up edit to an earlier task's test file.
- Scope boundary: do not add tests purely to game the coverage percentage.
