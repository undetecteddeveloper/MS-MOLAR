# Task 14 (Backend): Full regression + ⚠ BLOCKING prod schema apply (A3) (Work Plan Final Phase, Task 22)

Metadata:
- Dependencies: `engine1-adaptive-ai-work-plan-phase2-completion.md` (Task 2, RLS suite must be green), backend-task-06 (Task 6, batch tagger must have completed on dev), `engine1-adaptive-ai-work-plan-phase5-completion.md` (Task 21, 10-case tone eval must have passed)
- Provides: verified, shippable dev state + a matching, verified prod DB — the final gate before Final-Phase Tasks 23-27 (security review, coverage, risk walk, AC walk, doc updates, folded into `engine1-adaptive-ai-work-plan-phase6-completion.md`)
- Size: Small (0 new files — regression run + DDL re-apply of backend-task-01's already-verified content)

## ⚠ MANUAL CHECKPOINT — READ BEFORE STARTING (the second and final one in this plan)

**This task ends at a human-in-the-loop step an executor agent cannot complete.** The agent may run and report on every automated regression command below. The **prod apply itself** — pasting the identical, already-verified DDL into the Supabase SQL Editor against the **production** project, and running `npm run verify:schema` against prod — must be performed by the human engineer. **Do not attempt to work around this.** If you are an executor agent and reach this checkpoint, stop, report the dev-side regression results, and hand off explicitly for the prod apply.

This is A3 explicitly closing the interim dev/prod drift the work plan permits during the sprint — not a step to silently skip because dev already looks correct.

## Implementation Content

Re-run the full regression suite:
```
npm run verify:schema           # dev
npx tsx supabase/test-rls.ts    # full suite incl. Phần 7
npx vitest run                  # all unit + integration
tsc --noEmit
eslint --max-warnings 0
next build
```

⚠ **MANUAL CHECKPOINT (A3, human-in-the-loop)**: once all dev-side work is verified, the engineer manually applies the identical, already-verified DDL (from backend-task-01) to the **prod** Supabase project and runs `npm run verify:schema` against prod, confirming the §17 fingerprint there matches the fingerprint committed to git.

## Target Files
(None — this task re-applies backend-task-01's already-committed `schema.sql` DDL to a second environment; it modifies no source file itself.)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (the final, committed §9b/§10c/§18/§19/§17 content from backend-task-01 — the exact DDL to re-apply to prod, unchanged)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT` — the value prod's `verify:schema` must match)
- `docs/prd/engine1-adaptive-ai-prd.md` (§ Constraints — A3, "Schema applied to prod at ship time, verified as one batch")
- All prior task files' Completion Criteria (backend-task-01 through frontend-task-02, plus Phase 1-5 completion files) — the aggregate state this regression run re-confirms

## Change Category

`Change Category: state-change, boundary-change`

Applying the identical DDL to prod is, by definition, a state/boundary change of the production system — the same class of change backend-task-01 made to dev. Sweep required: since this is the **same DDL, unchanged**, no new adjacent-defect sweep is needed beyond re-confirming backend-task-01's own sweep still holds (no drift between what was committed and what is being applied).

## Implementation Steps

### 1. Dev-side regression (agent-completable)
- [ ] Run `npm run verify:schema` against dev — confirm 7/7 still green (no drift since backend-task-01).
- [ ] Run `npx tsx supabase/test-rls.ts` — confirm full suite (incl. Phần 7) exits 0.
- [ ] Run `npx vitest run` — confirm all unit + integration tests green (this now includes every test file filled in by backend-task-04 through frontend-task-02).
- [ ] Run `tsc --noEmit` — confirm 0 errors.
- [ ] Run `eslint --max-warnings 0` — confirm 0 warnings/errors.
- [ ] Run `next build` — confirm production build succeeds.
- [ ] Report all 6 results explicitly; do not proceed to the checkpoint below if any fails — fix and re-run first.

### 2. ⚠ MANUAL CHECKPOINT (human-in-the-loop, not agent-completable)
- [ ] Engineer pastes the identical, unchanged DDL into the Supabase SQL Editor against the **prod** project.
- [ ] Engineer runs `npm run verify:schema` against prod — all 7 checks must pass.
- [ ] Engineer confirms prod's §17 fingerprint matches the fingerprint committed to git (`SCHEMA_FINGERPRINT` in `schemaFingerprint.ts`).

## Quality Assurance Mechanisms
- ESLint (`--max-warnings 0`, CI-blocking) — project-wide
- `tsc --noEmit` (strict) — project-wide
- `vitest run` — project-wide (full suite, all covered directories)
- `next build` — project-wide
- `npm run verify:schema` — Covered: `public.questions`, all new FKs, §17 fingerprint — run against BOTH dev (re-confirm) and prod (the checkpoint)
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` / `schemaFingerprint.test.ts` — re-run as part of the full `vitest run`
- `SOURCE/supabase/test-rls.ts` (manual, not CI) — full suite re-run

## Operation Verification Methods
- **Verification method**: run all 6 dev-side regression commands; then the human engineer applies to prod and runs `verify:schema` against prod.
- **Success criteria**: all 6 dev-side commands pass with 0 errors; prod's `verify:schema` reports 7/7 green with fingerprint agreement.
- **Failure response**: if any dev-side regression command fails, this is a real regression introduced somewhere across Phases 1-5 — bisect via the Phase completion files' own individual verification commands to isolate which task's work regressed, fix, and re-run the full regression before attempting the prod checkpoint. If the prod `verify:schema` fails after apply, do NOT re-apply blindly — diagnose against the same failure modes named in backend-task-01 (check #1 §10c-parser-trap, check #7 fingerprint) since this is the identical DDL that already passed on dev.
- **Verification level**: L1 (functional — both dev and prod DBs verified against the real project tooling) as the target for the full plan's closing gate.

## Proof Obligations
- **Claim** (Failure Mode Checklist `missing-sort-key ordering`, regression re-run) — `recommendNextSkill()`'s three-key deterministic tie-break (backend-task-07) still holds after all subsequent Phase 3/4/5 work.
- **Primary failure mode**: an unrelated later change (e.g. a refactor while reconciling backend-task-12's telemetry builder, or a lint/type fix elsewhere) accidentally altered `route.ts`'s sort comparator.
- **Boundary to exercise**: the full `vitest run` re-execution of `route.test.ts`'s 4 tests, unchanged since backend-task-07.
- **State assertion**: N/A (pure function re-verification).
- **Mock boundary rationale**: none — same as backend-task-07's own.
- **Residual**: none once this regression run is green.
- **Claim**: A3 — the schema applied to prod at ship time is verified as one batch, matching what dev already verified.
- **Primary failure mode**: partial/staged application to prod, or an out-of-band prod edit made between backend-task-01's dev apply and this checkpoint, causing dev and prod to diverge despite this task's intent to keep them identical.
- **Boundary to exercise**: real prod Postgres instance (the manual checkpoint itself).
- **State assertion**: before = prod lacks Engine 1's schema additions; after = prod has the identical DDL applied, `verify:schema` 7/7 green, fingerprint matching git.
- **Mock boundary rationale**: none.
- **Residual**: none once confirmed.

## Completion Criteria
- [ ] All 6 dev-side regression commands pass with 0 errors
- [ ] ⚠ MANUAL CHECKPOINT confirmed by the human engineer: prod `verify:schema` 7/7 green, fingerprint matches git
- [ ] Dev/prod schema drift closed (A3)
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: no `SOURCE/**` file is modified by this task itself; it re-applies backend-task-01's already-committed DDL to a second environment (prod).
- Scope boundary: do not alter `schema.sql`'s content here — any drift discovered must be traced back to and fixed in the originating task (backend-task-01 through frontend-task-02), not patched ad hoc at this final gate.
