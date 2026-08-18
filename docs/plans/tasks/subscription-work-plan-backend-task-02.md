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
- [x] `SOURCE/vitest.localdb.config.ts` (new)
- [x] `SOURCE/package.json` (one script entry added)

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
- [x] Read all Investigation Targets and record key observations
- [x] Record the current `npm test` collected-file count as a baseline
- [x] Confirm `npm run test:localdb` currently fails (script does not exist)
### 2. Green Phase
- [x] Add the config, the script and the gate-B header comment; run `npm run test:localdb`
- [x] Confirm it resolves the config and reports 0 tests
### 3. Refactor Phase
- [x] Re-run `npm test` and compare against the baseline

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
- [x] `npm run test:localdb` resolves its config and reports 0 tests
- [x] `npm test` collects the same file count as before this task and is green
- [x] The config header records: **schema gate B must be green on dev (plan Task 1.3) before this config is run at all**
- [x] `npm run lint` and `npx tsc --noEmit` pass

## Notes
- Impact scope: test tooling only; no product code.
- Scope boundary: `SOURCE/vitest.config.ts` unmodified; the service skeleton stays comments-only in this task.

## Investigation Notes

Recorded during Step 2 (all six Investigation Targets read in full).

- `SOURCE/vitest.config.ts:19` — CI glob is `lib/**`, `components/**`, `app/**` only. `tests/**` sits outside it entirely, so adding a config that targets `tests/e2e/service/**` cannot change CI collection. The alias block is a single entry, `"@" -> fileURLToPath(new URL("./", import.meta.url))`; copied verbatim so both lanes resolve modules identically.
- `SOURCE/vitest.integration.config.ts` (plan Task 0.1, the sibling this task mirrors) — same alias, `environment: "node"`, only `test.include` differs. Header carries the why-it-is-separate rationale in Vietnamese. No `--passWithNoTests`. This file is the shape precedent followed here.
- `SOURCE/package.json` — `scripts` block; `test:integration` at the line above the new entry. `test` stays `vitest run` (untouched). `verify:schema` is `npx tsx supabase/verify-schema.ts`, standalone and not chained into `check:bundle`; the header comment names it exactly as invoked.
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` — comments-only skeleton, no imports/describe/it. Its "HOW THIS FILE IS RUN" block dictates this task's three requirements (alias, node env, include glob; the script name; the blocking gate-B precondition), and its wording of the precondition is the source the header paraphrases.
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` — the repo's only existing service-lane test; lives under `app/**` and therefore inside the CI glob, but is a real-dev-DB test. Read for lane semantics only; not a target of this task and left untouched.
- `SOURCE/supabase/verify-schema.ts` — gate B: eight read-only checks against the live DB via production credentials; item 6 (every FK's `on delete` from the live catalog) and item 7 (schema fingerprint, TD-005) are the ones the header's precondition depends on. Run command per its own header: `cd SOURCE && npx tsx supabase/verify-schema.ts`.
- `docs/design/subscription-backend-design.md` § Verification Strategy — the gate A / gate B table states the sequence "gate A green -> hand-apply to dev -> **gate B green on dev** -> only then write TypeScript against the schema", and that this checkpoint "has failed silently three times in this repository's history". That is the fact the config header must make actionable, and it is stated there as a blocking precondition with an explicit "fix the database, not the test" instruction.

### Verification evidence

| Step | Result |
|---|---|
| Baseline `npm test` (before change) | 89 files (88 passed, 1 skipped), 924 tests (914 passed, 10 skipped), exit 0 |
| Red: `npm run test:localdb` before change | `npm error Missing script: "test:localdb"`, exit 1 |
| Green: `npm run test:localdb` after change | Config resolved, collected `tests/e2e/service/subscription.service.e2e.test.ts`, **0 tests**, exit 1 with "No test suite found in file" |
| Sibling `npm run test:integration` | Identical shape (1 file, no tests, exit 1) — confirms the exit code is the established Task 0.1 precedent for a comments-only skeleton, not a defect of this config |
| Refactor: `npm test` (after change) | 89 files (88 passed, 1 skipped), 924 tests (914 passed, 10 skipped), exit 0 — **identical to baseline** |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |

`SOURCE/vitest.config.ts` was not modified, so the failure response in Operation Verification Methods was not triggered.
