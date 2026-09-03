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
- [x] `SOURCE/vitest.integration.config.ts` (new)
- [x] `SOURCE/package.json` (one script entry added)

## Investigation Targets
- `SOURCE/vitest.config.ts` (the `resolve.alias` block and the `test.include` glob at `:19` — copy the alias, do not widen the glob)
- `SOURCE/package.json` (the `scripts` block; `test`, `verify:schema` and `check:bundle` are three separate scripts)
- `SOURCE/tests/integration/subscription.int.test.ts` (the comments-only skeleton this config must collect)
- `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts` (this repository's existing real-database test — the precedent for how a DB-touching test is written here)
- `docs/design/subscription-backend-design.md` (§ Test Boundaries)

## Investigation Notes

- `SOURCE/vitest.config.ts`: single alias entry `"@": fileURLToPath(new URL("./", import.meta.url))`; `test.environment: "node"`; `test.include` at `:19` = `["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"]`. Alias copied verbatim into the new config; the glob was **not** widened and the file is byte-identical after this task (`git diff --stat` empty).
- `SOURCE/package.json`: `test` (`vitest run`), `verify:schema` (`npx tsx supabase/verify-schema.ts`) and `check:bundle` (`node scripts/check-ai-key-bundle.mjs`) are three independent scripts — none is piped into another, so `test:integration` is added as a fourth independent entry beside `test:watch`.
- `SOURCE/tests/integration/subscription.int.test.ts`: comments only — no imports, no `describe`/`it`. Its header prescribes exactly the two artifacts this task creates (same alias, node env, `tests/integration/**` glob; the `vitest run --config …` script).
- `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts`: the repo precedent for a real-dev-database test. It lives **inside** the `app/**` CI glob and is credential-dependent; the subscription integration lane deliberately breaks with that placement (backend DD Implementation Approach Phase 4: "CI has no database"), which is the whole reason a second config exists.
- `docs/design/subscription-backend-design.md` § Test Boundaries (`:1121`): `record_payment_settlement`, `recheckOrder` ownership and `toCheckoutOrder()` are marked "nothing — real Postgres required", i.e. the three cases this lane will carry. Nothing in that table asks the CI gate to run them.
- **Observed behaviour of the new lane, recorded for the tasks that fill it**: with a comments-only file, `npm run test:integration` collects the file, reports `Tests no tests`, and exits **non-zero** with "No test suite found in file". `--passWithNoTests` would flip it to exit 0, and was deliberately **not** added to the config: the task and the skeleton both specify exactly three settings, and a permanent `passWithNoTests` would let an accidentally emptied INT file pass silently once Tasks 3.4 / 3.5 / 5.4 land. The non-zero exit is an accurate "the skeleton has no cases yet" signal, not a defect of the config.
- **Measured**: CI lane collects **89 files** before and after (`npx vitest list --filesOnly`), with **0** files under `tests/` in either run; `npm test` green at 914 pass / 10 skip (one run hit the known `ExplainStepAffordance.test.tsx` load flake, which passes alone and passed on the immediate re-run).

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: the CI gate stays green and collects the same files — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` — Enforces: the new config file type-checks — Config: `SOURCE/tsconfig.json`
- `npm run lint` -> `eslint --max-warnings 0` — Enforces: style and unused code — Config: `SOURCE/eslint.config.mjs`

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations (in particular the exact alias entries in `vitest.config.ts`)
- [x] Record the **current** `npm test` collected-file count from a baseline run, before making any change
- [x] Confirm `npm run test:integration` currently fails (script does not exist)

### 2. Green Phase
- [x] Add the config file and the script; run `npm run test:integration`
- [x] Confirm it resolves the config and reports **0 tests** (the skeleton is comments-only)

### 3. Refactor Phase
- [x] Re-run `npm test` and compare the collected-file count against the baseline recorded in the Red phase

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
- [x] All added tests pass (none added; both suites run clean)
- [x] `npm run test:integration` runs the file and reports 0 tests
- [x] `npm test` collects the same file count as before this task and is green
- [x] `SOURCE/vitest.config.ts` is unmodified
- [x] `npm run lint` and `npx tsc --noEmit` pass

## Notes
- Impact scope: test tooling only; no product code.
- Scope boundary: `SOURCE/vitest.config.ts` (unmodified — the CI glob is deliberate); `SOURCE/tests/integration/subscription.int.test.ts` (skeleton stays comments-only in this task).
- All `npm` scripts run from `SOURCE/`, not the repository root.
