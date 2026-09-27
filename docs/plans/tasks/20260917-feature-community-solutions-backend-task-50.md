# Task 50: Full local quality gate

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`. **Layer determination**: verification-only task with no target files; its six gates plus the integration regression lane span both lanes, and the backend lane is selected because the gate set includes the DB-lane `test:localdb`, the real-Supabase `test:integration` and the repo-wide `tsc`/`lint`/`vitest`/`build` sequence the backend quality-fixer already runs.
- **Plan task**: P5-T11
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T11)
- **Dependencies**: all prior tasks (01–49)
- **Provides**: the aggregate commit-gate result for the whole feature (six gates + the `test:integration` regression lane)
- **Size**: Small (no files)

## Implementation Content

Run, in this order, from inside `SOURCE/`:
1. `npx tsc --noEmit`
2. `npm run lint` (`eslint --max-warnings 0`)
3. `npm test` (`vitest run`)
4. `npm run build` (`next build`)
5. `npm run test:fixture`
6. `npm run test:localdb` (no exclude — task 47 implemented the SE skeleton)
7. `npm run test:integration` (regression lane; must exit 0)

Every R1 skeleton exclusion has ended by this task (tasks 04, 23 and 47 gave the three skeletons their first real suites), so **no command in this list carries an `--exclude` flag**. The integration lane already runs green since commit `707df1f`: `SOURCE/vitest.integration.config.ts` excludes the INT-1 quota tests by name (they live in `SOURCE/tests/integration/pending/subscription-quota.int.test.ts`, quarantined under TD-034 because the upload quota gate was switched off on purpose). This task does not edit that config, does not move INT-1 back, and does not re-enable it. This feature adds no file under `SOURCE/tests/integration/`.

Deterministic handling rules:
- If step 1 fails **only** on generated `.next` route-type errors for the new routes, run `npm run build` once, then restart the sequence from step 1 (project memory: build before tsc after route additions/renames).
- If step 6 or step 7 fails on a timeout while other files pass, re-run the failing file alone once before treating it as a defect (project memory: localdb flakes when dev DB is slow).
- If step 7 goes red on an INT-2 or INT-3 case, that is a real regression (the lane was green at `707df1f`); route the fix to its owning task. Never restore an `--exclude`, edit `vitest.integration.config.ts`, or weaken an assertion to get the lane green.
- `npm run verify:schema` must be green on dev before step 6.
- Also run `npm run check:bundle` (confirms `SUPABASE_SERVICE_ROLE_KEY` absent from the client bundle; this feature adds no `service-role.ts` usage).

## Acceptance Criteria

From the plan (§ P5-T11): **whole-feature regression coverage**.

Carried hard constraints that apply to this task:
- All six gates green with **zero** warnings/errors, **and** `npm run test:integration` exits 0; no gate or lane is skipped, disabled, or run with an exclude flag.
- `SOURCE/vitest.integration.config.ts` and `SOURCE/tests/integration/pending/subscription-quota.int.test.ts` are unchanged by this task (INT-1 stays quarantined, TD-034).
- No test assertion is weakened to make a gate pass.
- **TD-029 (global)**: `serviceRoleSurface.test.ts` green within step 3; zero diff to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] None (verification-only). Record results in this file's Investigation Notes.

## Investigation Targets
- `SOURCE/package.json` (scripts: `lint`, `test`, `build`, `test:fixture`, `test:localdb`, `test:integration`, `verify:schema`, `check:bundle`)
- `SOURCE/vitest.config.ts`, `SOURCE/vitest.fixture.config.ts`, `SOURCE/vitest.localdb.config.ts`, `SOURCE/vitest.integration.config.ts` (read only; INT-1 excluded by name)
- `TECH-DEBT.md` (TD-034 — read only; the engineer's uncommitted file, never staged by this task)
- `.github/workflows/ci.yml` (CI gate set incl. `bundle-secrets` job)
- `docs/prd/community-solutions-prd.md` (§ Ràng buộc — commit gate list)
- `docs/design/community-solutions-backend-design.md` (§ Quality Assurance Mechanisms)
- `docs/design/community-solutions-frontend-design.md` (§ Quality Assurance Mechanisms)

## Investigation Notes
(Append: gate | command | result | duration | notes.)

Run 2026-09-27, branch `feat/community-solutions` at HEAD `51f3ab5`, inside `SOURCE/`, one ordered sequence, no `--exclude` flag, no handling rule triggered (no route-type restart, no flake re-run).

| gate | command | result | duration | notes |
|---|---|---|---|---|
| pre-6 | `npm run verify:schema` | PASS (exit 0) | 32s | dev DB matches schema.sql; Phase 4 (task 32) and Phase 5 (tasks 40, 41) EXECUTE probes all ✓ |
| 1 | `npx tsc --noEmit` | PASS (exit 0, 0 errors) | 17s | no `.next` route-type errors, so the build-then-restart rule did not fire |
| 2 | `npm run lint` | PASS (exit 0, 0 warnings) | 21s | `eslint --max-warnings 0` |
| 3 | `npm test` | PASS (exit 0) | 75s | 203 files passed + 1 skipped (204); 2643 tests passed + 10 skipped. The skip is `lib/tutor/__tests__/toneEval.manual.test.ts` (`describe.skipIf(!ENABLED)`, manual Gemini eval, from commit `16c789f`, not this feature). `serviceRoleSurface.test.ts` 6/6 green (re-run alone to confirm) |
| 4 | `npm run build` | PASS (exit 0) | 33s | compiled in 12.6s, 22/22 static pages, no warning/error lines |
| 5 | `npm run test:fixture` | PASS (exit 0) | 5s | 2 files, 16 tests |
| 6 | `npm run test:localdb` | PASS (exit 0) | 63s | 8 files, 47 tests, no exclude (includes the task 47 SE suite); no timeout |
| 7 | `npm run test:integration` | PASS (exit 0) | 11s | 2 files, 21 tests (INT-2/INT-3); INT-1 stays quarantined by name (TD-034) |
| extra | `npm run check:bundle` | PASS (exit 0) | 1s | "8 server-only secrets absent from client"; the script's list includes `SUPABASE_SERVICE_ROLE_KEY` |

Total time for the gates: about 258s (~4.3 min).

Constraint checks:
- `git diff --stat` on `SOURCE/vitest.integration.config.ts`, `SOURCE/tests/integration/pending/subscription-quota.int.test.ts`, `SOURCE/lib/supabase/service-role.ts`: empty (TD-029, TD-034 hold).
- No assertion changed, no source file changed by this task.
- Caveat: the working tree includes the engineer's uncommitted `SOURCE/app/layout.tsx` (+9 lines), so the gates ran against HEAD plus that diff. Not staged or touched.

## Implementation Steps
- [x] Confirm `npm run verify:schema` green on dev
- [x] Run steps 1–7 in order applying the handling rules, with no `--exclude` flag anywhere; run `check:bundle`
- [x] Record each result; for any real failure, route the fix to the owning task's layer as a follow-up commit, then restart from step 1 (no real failure)

## Quality Assurance Mechanisms
- Commit gate list (`tsc`, `eslint`, `vitest run`, `build`, `test:fixture`, `test:localdb`, run inside `SOURCE/`) — Enforces: full local gate before commit
- `npm run test:integration` — Config: `SOURCE/vitest.integration.config.ts` — Enforces: the real-Supabase integration lane stays exit 0 (INT-2/INT-3 pass; INT-1 quarantined by name, TD-034)
- `npm run check:bundle` — Enforces: service-role key absent from client bundle — Config: `.github/workflows/ci.yml` `bundle-secrets` job
- `serviceRoleSurface.test.ts`, `rateLimit.test.ts`, schema tests, `RichText.xss.test.tsx`, `ProfileCard.test.tsx`, `ActionButton.test.tsx`/`HistoryRowMenu.test.tsx` — all collected by step 3

## Operation Verification Methods
- **Verification method**: the ordered six-gate sequence, then `npm run test:integration`, plus `check:bundle`.
- **Success criteria**: all six gates green with zero warnings/errors in one sequence; `npm run test:integration` exits 0; `check:bundle` green; no `--exclude` flag used.
- **Failure response**: fix in the owning component/module (never by disabling a rule, skipping a test, editing `vitest.integration.config.ts`, or adding an exclude), then restart from step 1.
- **Verification level**: L2 + L3 (all tests pass; build succeeds)

## Proof Obligations
(None beyond "all six pass and `test:integration` exits 0" — this is the aggregate gate, not a claim-specific proof.)

## Completion Criteria
- [x] All six gates green in one ordered sequence, with no `--exclude` flag, results recorded
- [x] `npm run test:integration` exits 0 (INT-1 still quarantined under TD-034), result recorded
- [x] `check:bundle` green

## Notes
- Impact scope: whole `SOURCE/`.
- Scope boundary: no source changes in this task.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`.
