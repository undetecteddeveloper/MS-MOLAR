# Task: Create `vitest.integration.config.ts` + the `test:integration` script

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.1**
Layer: **backend** (repo build configuration — deterministic layer rule)

Metadata:
- Dependencies: none (first task of the plan)
- Provides: `SOURCE/vitest.integration.config.ts`, the `test:integration` npm script — consumed by plan Tasks 3.4 (INT-3), 3.5 (INT-2), 5.4 (INT-1), 6.3
- Size: Small (2 files)
- `@category: e2e-setup` (harness)

## Implementation Content

Create a second Vitest configuration scoped to `SOURCE/tests/integration/**` so the integration lane can run against the **real dev database** without putting a DB-touching assertion into the CI gate.

- New file `SOURCE/vitest.integration.config.ts`: the **same `resolve.alias`** as `SOURCE/vitest.config.ts`, `test.environment: "node"`, `test.include: ["tests/integration/**/*.test.{ts,tsx}"]`.
- `SOURCE/package.json`: add `"test:integration": "vitest run --config vitest.integration.config.ts"`.
- **`npm test` and `SOURCE/vitest.config.ts:19` are not modified.** `SOURCE/tests/**` stays outside the CI glob deliberately, because INT-2 and INT-3 need the real dev database and the backend Design Doc states CI has no database.

## Target Files
- [ ] `SOURCE/vitest.integration.config.ts` (new)
- [ ] `SOURCE/package.json` (one script entry added)

## Investigation Targets
- `SOURCE/vitest.config.ts` (the `resolve.alias` block and the `test.include` glob at `:19` — copy the alias, do not widen the glob)
- `SOURCE/package.json` (the `scripts` block; `test`, `verify:schema` and `check:bundle` are three separate scripts)
- `SOURCE/tests/integration/subscription.int.test.ts` (the comments-only skeleton this config must collect)
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (this repository's existing real-database test — the precedent for how a DB-touching test is written here)
- `docs/design/subscription-backend-design.md` (§ Test Boundaries)

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: the CI gate stays green and collects the same files — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` — Enforces: the new config file type-checks — Config: `SOURCE/tsconfig.json`
- `npm run lint` -> `eslint --max-warnings 0` — Enforces: style and unused code — Config: `SOURCE/eslint.config.mjs`

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations (in particular the exact alias entries in `vitest.config.ts`)
- [ ] Record the **current** `npm test` collected-file count from a baseline run, before making any change
- [ ] Confirm `npm run test:integration` currently fails (script does not exist)

### 2. Green Phase
- [ ] Add the config file and the script; run `npm run test:integration`
- [ ] Confirm it resolves the config and reports **0 tests** (the skeleton is comments-only)

### 3. Refactor Phase
- [ ] Re-run `npm test` and compare the collected-file count against the baseline recorded in the Red phase

## Operation Verification Methods
- **Verification method**: run `npm run test:integration` from `SOURCE/`, then run `npm test` from `SOURCE/` and compare the collected-file count against the pre-task baseline.
- **Success criteria**: `npm run test:integration` resolves `vitest.integration.config.ts` and reports 0 tests; `npm test` collects **the same file count as before this task** and stays green (measured baseline: 914 pass / 10 skip).
- **Failure response**: if `npm test` now collects `SOURCE/tests/**`, the CI glob was widened — revert the change to `vitest.config.ts` rather than adjusting the skeleton.
- **Verification level**: L3 (build/run success) with an L2 non-regression check on the existing suite.

## Proof Obligations
- **Claim**: adding the integration config does not change what the CI gate collects.
- **Primary failure mode**: `SOURCE/tests/**` gets pulled into `npm test`, turning a missing database credential into a red CI build.
- **Boundary to exercise**: the two Vitest CLI invocations (`npm test`, `npm run test:integration`) — process boundary, not in-process.
- **State assertion**: N/A (no persisted state).
- **Mock boundary rationale**: none — both runs are real.
- **Residual**: proves the configs are disjoint; does not prove any integration case passes (INT-1…INT-3 are filled by plan Tasks 5.4 / 3.5 / 3.4).

## Completion Criteria
- [ ] All added tests pass (none added; both suites run clean)
- [ ] `npm run test:integration` runs the file and reports 0 tests
- [ ] `npm test` collects the same file count as before this task and is green
- [ ] `SOURCE/vitest.config.ts` is unmodified
- [ ] `npm run lint` and `npx tsc --noEmit` pass

## Notes
- Impact scope: test tooling only; no product code.
- Scope boundary: `SOURCE/vitest.config.ts` (unmodified — the CI glob is deliberate); `SOURCE/tests/integration/subscription.int.test.ts` (skeleton stays comments-only in this task).
- All `npm` scripts run from `SOURCE/`, not the repository root.
