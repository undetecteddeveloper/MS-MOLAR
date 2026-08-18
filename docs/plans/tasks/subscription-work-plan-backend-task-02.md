# Task: Create `vitest.localdb.config.ts` + the `test:localdb` script

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.2**
Layer: **backend** (repo build configuration — deterministic layer rule)

Metadata:
- Dependencies: none (parallel with plan Task 0.1 / backend-task-01)
- Provides: `SOURCE/vitest.localdb.config.ts`, the `test:localdb` npm script — consumed by plan Tasks 6.1 (SVC-1), 6.2 (SVC-2), 6.3
- Size: Small (2 files)
- `@category: e2e-setup` · `@lane: service-integration-e2e`

## Implementation Content

Create the service-integration-e2e Vitest configuration scoped to `SOURCE/tests/e2e/service/**`.

- New file `SOURCE/vitest.localdb.config.ts`: the same `resolve.alias` as `SOURCE/vitest.config.ts`, `test.environment: "node"`, `test.include: ["tests/e2e/service/**/*.test.{ts,tsx}"]`.
- `SOURCE/package.json`: add `"test:localdb": "vitest run --config vitest.localdb.config.ts"`.
- **Document in the config file header that schema gate B must be green on dev (plan Task 1.3) before this config is run at all** — running it against a database without the DDL produces failures that look like implementation defects and are not.
- `npm test` and `SOURCE/vitest.config.ts` are not modified.

## Target Files
- [ ] `SOURCE/vitest.localdb.config.ts` (new)
- [ ] `SOURCE/package.json` (one script entry added)

## Investigation Targets
- `SOURCE/vitest.config.ts` (the `resolve.alias` block and the `test.include` glob at `:19`)
- `SOURCE/package.json` (the `scripts` block)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (the comments-only SVC-1 / SVC-2 skeleton this config must collect)
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (the repository only existing service-lane test)
- `SOURCE/supabase/verify-schema.ts` (what gate B actually checks — referenced by the header comment this task writes)
- `docs/design/subscription-backend-design.md` (§ Verification Strategy)

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: the CI gate stays green and collects the same files — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` — Enforces: the new config file type-checks — Config: `SOURCE/tsconfig.json`
- `npm run lint` -> `eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs`

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Record the current `npm test` collected-file count as a baseline
- [ ] Confirm `npm run test:localdb` currently fails (script does not exist)
### 2. Green Phase
- [ ] Add the config, the script and the gate-B header comment; run `npm run test:localdb`
- [ ] Confirm it resolves the config and reports 0 tests
### 3. Refactor Phase
- [ ] Re-run `npm test` and compare against the baseline

## Operation Verification Methods
- **Verification method**: run `npm run test:localdb` from `SOURCE/`; then run `npm test` and compare the collected-file count against the pre-task baseline.
- **Success criteria**: `npm run test:localdb` resolves its config and reports 0 tests; `npm test` unchanged and green; the config header states the gate-B precondition in words a later reader can act on.
- **Failure response**: if `npm test` collection changed, revert the `vitest.config.ts` edit rather than narrowing the new config.
- **Verification level**: L3, with an L2 non-regression check on the existing suite.

## Proof Obligations
- **Claim**: the service lane is runnable on demand and invisible to CI.
- **Primary failure mode**: `SOURCE/tests/e2e/service/**` enters the CI glob and a missing database credential reds the build.
- **Boundary to exercise**: the two Vitest CLI invocations.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — both runs are real.
- **Residual**: does not prove SVC-1/SVC-2 pass; they execute only in Phase 6 (plan Tasks 6.1, 6.2).

## Completion Criteria
- [ ] `npm run test:localdb` resolves its config and reports 0 tests
- [ ] `npm test` collects the same file count as before this task and is green
- [ ] The config header records: **schema gate B must be green on dev (plan Task 1.3) before this config is run at all**
- [ ] `npm run lint` and `npx tsc --noEmit` pass

## Notes
- Impact scope: test tooling only; no product code.
- Scope boundary: `SOURCE/vitest.config.ts` unmodified; the service skeleton stays comments-only in this task.
