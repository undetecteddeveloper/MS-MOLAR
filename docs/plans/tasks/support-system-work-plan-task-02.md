# Task 02: ⚠ MANUAL, BLOCKING — Apply schema.sql to Supabase + run verify:schema (Work Plan Phase 0, Task 0.2)

Metadata:
- Dependencies: support-system-work-plan-task-01 (Deliverable: staged, fingerprint-synced `schema.sql` + `schemaFingerprint.ts` + `verify-schema.ts`/`setup-storage.ts`)
- Provides: a real, applied dev-database schema for Task 03 (RLS harness) and every downstream task to build/test against
- Size: N/A (infrastructure step — no source files changed by this task itself)

## ⚠ MANUAL CHECKPOINT — READ BEFORE STARTING

**This task is entirely a human-in-the-loop step an executor agent cannot complete.** Task 01's staged DDL is ready to apply, but the actual **paste into the Supabase SQL Editor** and the subsequent `npm run verify:schema` run against a live Supabase project require interactive access to Supabase project credentials/the SQL Editor that no automated agent in this environment has. **Do not attempt to work around this** (e.g. by writing a script that connects to Supabase with found/guessed credentials, by fabricating a "pass" result, or by marking this task done without the human having run the apply). If you are an executor agent and reach this checkpoint, **stop, report that Task 01's DDL is staged and ready, and hand off explicitly** — do not proceed to Task 03 or any later task file until the human confirms this checkpoint passed.

**No Task 03 or later task may begin until this checkpoint's `verify:schema` run confirms no FK/fingerprint drift for at least the dev environment.**

## Implementation Content

Paste the entire `SOURCE/supabase/schema.sql` file into the Supabase SQL Editor for the **dev** environment (and again for **prod** before launch, per the backend DD's per-environment apply requirement — tracked separately, not blocking this dev-focused checkpoint). Run `npm run verify:schema` (and `SCHEMA_ENV_FILE=.env.local.prod-backup npm run verify:schema` for prod, when that later apply happens).

## Target Files
- [ ] None — this is a live-database operation, not a source-file change. (`schema.sql`/`schemaFingerprint.ts` were already finalized and committed in Task 01.)

## Investigation Targets
- `docs/design/support-system-backend-design.md` (§ Schema & DB Enforcement — apply order steps 6-7: per-environment manual SQL Editor paste, `verify:schema` run)
- `SOURCE/supabase/verify-schema.ts` (all 7 checks — what a pass/fail actually inspects)
- `docs/design/support-system-backend-design.md` (§ PRD Use Case 13 / Risk table — `ADMIN_USER_IDS` currently Production-scope only on Vercel, TD-014 — noted here as context only; the actual fix is Final Phase Task F.2/task-17, not this task)

## Implementation Steps

Given this is a manual infrastructure step, the standard Red-Green-Refactor cycle does not apply.

### Handoff Checklist (for an executor agent reaching this task)
- [ ] Confirm Task 01 is complete: `npm test` (schema fingerprint + FK-parser suites) green on the staged `schema.sql`.
- [ ] Report to the user: "Task 01's DDL is staged and fingerprint-synced. This task requires you to paste `SOURCE/supabase/schema.sql` into the Supabase SQL Editor for the dev project, then run `npm run verify:schema`. Please confirm once complete."
- [ ] Stop. Do not proceed to Task 03.

### ⚠ MANUAL CHECKPOINT (human-in-the-loop, not agent-completable)
- [ ] Engineer pastes the finalized `schema.sql` into the Supabase SQL Editor against the **dev** project.
- [ ] Engineer runs `npm run verify:schema` — confirms no FK/fingerprint drift for the dev environment.
- [ ] Do not begin Task 03 or any later task file until this passes.

## Quality Assurance Mechanisms
- `npm run verify:schema` (manual, not in CI) — Enforces: seven checks against a live DB incl. FK reconciliation and fingerprint match — Config: `SOURCE/supabase/verify-schema.ts` — this checkpoint's own acceptance gate

## Operation Verification Methods
- **Verification method**: `npm run verify:schema` run against the dev Supabase project immediately after the manual paste.
- **Success criteria**: all 7 `verify:schema` checks green — no FK/fingerprint drift for the dev environment.
- **Failure response**: if any check fails, do not proceed to Task 03 — re-examine the specific failing check against Task 01's staged DDL (e.g. a fingerprint mismatch means the paste didn't match the finalized text exactly) and re-apply before retrying.
- **Verification level**: L1 (the real dev DB shape exists and passes the project's own schema-parity tool).

## Completion Criteria
- [ ] `schema.sql` applied to the dev Supabase project via the SQL Editor
- [ ] `npm run verify:schema` confirms no FK/fingerprint drift for the dev environment
- [ ] Human engineer has explicitly confirmed this checkpoint passed
- [ ] No Task 03 or later task begun before this checkpoint is confirmed

## Notes
- Impact scope: the dev (and later prod) Supabase project's live schema only — no repo source file is touched by this task.
- Scope boundary: do not attempt to script around the missing interactive Supabase access; do not skip this step for any environment (TD-005's exact failure shape — a three-day dev/prod divergence already happened once in this repo from a missed manual-apply step, per the engine1 plan's own documented incident).
- The prod-environment apply is a separate, later occurrence of this same manual step (per the backend DD's per-environment requirement) — not repeated as its own task file here since it has no distinct code dependency chain; the engineer performs it before launch, using the same `schema.sql` this task already validated for dev.
