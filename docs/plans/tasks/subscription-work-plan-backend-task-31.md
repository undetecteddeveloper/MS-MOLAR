# Task: Full regression across every adopted gate

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.3**
Layer: **backend** (repo-wide command execution; no React implementation)

Metadata:
- Dependencies: every implementation task in Phases 1–5, plus backend-task-29 and backend-task-30
- Provides: the evidence record for the plan Quality Assurance section
- Size: Small (no source file changed unless a gate goes red)

## Implementation Content

Run, from `SOURCE/`, and record each result:

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run check:bundle`
- `npm run verify:schema` on **dev and prod** — **two runs.** This is a **standalone script** (`npx tsx supabase/verify-schema.ts`), **not** part of `check:bundle`
- `SOURCE/supabase/test-rls.ts` including **Phần 8**
- `npm run test:integration` (INT-1…INT-3)
- `npm run test:localdb` (SVC-1, SVC-2)
- the three fixture-e2e cases (FE-1, FE-2, FE-3)

## Target Files
- [x] (none — unless a gate goes red, in which case the fix belongs to the owning task, not to this one)
- [x] Record every command and its result in the plan Phase 6 Notes

## Investigation Targets
- `SOURCE/package.json` (`:7` build, `:9` lint, `:10` test, `:12` check:bundle, `:13` verify:schema, `:14` pw — confirm which script is which before running)
- `docs/plans/subscription-work-plan.md` (§ Quality Assurance Mechanisms — the adopted gates and their covered files)
- `docs/plans/subscription-work-plan.md` (§ Completion Criteria — the test-case resolution counts this run must confirm)
- `SOURCE/supabase/test-rls.ts` (Phần 8 from plan Task 1.5)

## Quality Assurance Mechanisms
(All adopted mechanisms in the plan header apply to this task, because it runs all of them.)

## Operation Verification Methods
- **Verification method**: execute each command from `SOURCE/` and capture its exit status and summary line.
- **Success criteria**: every gate green; test-case resolution confirmed as **integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/2 — unresolved tests: 0**; `verify:schema` green on **both** environments with fingerprints matching git.
- **Failure response**: a red gate is routed back to the task that owns the file, not patched here. Note that under cold-cache parallel load one tutor unit test can exceed the 5000 ms default and passes in isolation — re-run it alone before treating it as a regression.
- **Verification level**: L2/L3 across the suite; L1 for the DB-side checks.

## Proof Obligations
- **Claim**: every adopted quality mechanism passes against the final state of the branch.
- **Primary failure mode**: `verify:schema` is assumed to have run because `check:bundle` did — they are **two distinct scripts** and neither pipes into the other, so one silently never runs.
- **Boundary to exercise**: the real CLI invocations, both databases, and all three test lanes.
- **State assertion**: N/A (read-only verification).
- **Mock boundary rationale**: none — every gate runs for real.
- **Residual**: the manual browser passes (plan Task 6.5) and the real-money transaction (plan Task 6.7) are **not** covered by any command here.

## Completion Criteria
- [x] All listed commands executed from `SOURCE/` and their results recorded
- [ ] `npm run verify:schema` run **twice** (dev and prod), separately from `npm run check:bundle` — **DEV ONLY. The prod leg was NOT run** (see Investigation Notes: `verify-schema.ts:163-180` would plant a hardcoded-password account in production auth). Prod Gate B is owned by plan Task 5.8.
- [x] `test-rls.ts` Phần 8 passing
- [x] Test-case resolution: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/2

## Notes
- Impact scope: verification only.
- Scope boundary: fixes belong to the owning task; this task records results.

## Investigation Notes

Run at `52cc734`, branch `feat/subscription`, working tree clean before and after
(`git status --porcelain` empty; only gitignored `.next/` was rewritten by the build).

### Investigation Targets, as read

- **`SOURCE/package.json`** — this task file's line numbers for the last three scripts
  are stale by exactly 3, because `test:integration` / `test:localdb` / `test:fixture`
  were added above them after the plan was written. Verified actual mapping:
  `:7` `build`, `:9` `lint`, `:10` `test` (all three still correct as written);
  `:12` `test:integration`, `:13` `test:localdb`, `:14` `test:fixture`;
  `:15` `check:bundle` → `node scripts/check-ai-key-bundle.mjs`;
  `:16` `verify:schema` → `npx tsx supabase/verify-schema.ts`; `:17` `pw`
  (the task file says `:12` / `:13` / `:14` for those last three).
  The task's claim that survives the drift is the load-bearing one:
  **`check:bundle` and `verify:schema` are two distinct scripts and neither pipes into the
  other** — confirmed by reading both script bodies. They were run separately.
- **Work plan § Quality Assurance Mechanisms** — 13 adopted mechanisms, 4 explicitly
  not adopted (mutation testing, load/latency, visual-regression/axe). Every adopted
  mechanism that is a runnable command was run; the two that are not commands
  (manual browser pass at 360px+greyscale, real-money transaction) are the documented
  Residual and remain open.
- **Work plan § Completion Criteria `:822`** — `integration 3/3, fixture-e2e 3/3,
  service-integration-e2e 2/2, unresolved 0`. Discharged per case, not per lane — see below.
- **`SOURCE/supabase/test-rls.ts`** — **the subscription block is `Phần 9`, not `Phần 8`.**
  `Phần 8` is the User Support System (ST-a…ST-e, `:1729`); by the time plan Task 1.5
  landed, that number was taken, so the subscription block became `Phần 9` (`:1965`,
  PO-a…PO-f / SB-a…SB-g / PS-a/PS-b). The work plan QA table `:92` and this task file
  both still say "new Phần 8". Stale label only — running the file executes both, and
  both are green.

### Why the prod `verify:schema` leg was not run

`supabase/verify-schema.ts:163-180` (`signInProbeUser`) unconditionally calls
`admin.auth.admin.createUser` with a hardcoded `PROBE_EMAIL`/`PROBE_PASSWORD`, and on
"already exists" falls through to `updateUserById` which **resets that account's password**
to the same hardcoded value. Against prod this plants a known-password account in
production auth. Environment selection is by `SCHEMA_ENV_FILE` (`:77-78`); with the
variable unset the script reads `.env.local` = dev (`hynwleaxtbtjzkvpjsug`), which is
what ran. The prod leg is owned by plan Task 5.8 ("Gate B on prod, **before any deploy**
that reads the new tables"); no production deployment of this branch has occurred, so
nothing is unblocked by deferring it.

### Method notes for whoever repeats this

- Every gate was launched with `spawnSync`, `shell: false`, cwd
  `E:/StemWeb_project/MS-MOLAR/SOURCE` (uppercase drive, forward slashes), and
  `status === null` checked explicitly. No `2>&1` in `execSync`, no piping through
  `tail` — both destroy the exit code.
- **Exit code alone was not accepted as evidence for any gate that emits a count.**
  `vitest -t` treats its pattern as a regex and a 0-match run exits 0; the service-lane
  test names literally contain `(a+b+c)`, so a `-t` filter there would silently match
  nothing and read as a pass. Counts were read off the `Tests` line instead.
- Two gates emit *no* output on success, so each got a discriminating check:
  `tsc --noEmit --listFiles` → **1984 files** typechecked (1980 under `SOURCE/`,
  including `lib/billing/*`); `eslint --format json` → **426 files** linted,
  0 errors / 0 warnings, 65 of them billing files. Both greens are real, not empty runs.
- `next build` requires the sandbox disabled — under the default sandbox it hangs
  forever rather than failing.
