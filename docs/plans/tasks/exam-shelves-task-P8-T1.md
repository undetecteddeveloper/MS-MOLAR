# Task P8-T1 — `verify-schema.ts`: `exam_hot_counts` existence/EXECUTE/anon-42501 probes + header correction

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 8 (Backend Verification Hardening), Task P8-T1**
Layer: backend (`SOURCE/supabase/verify-schema.ts`)

Metadata:
- Dependencies: P0-T6 (Early Verification Point passed), P5-T2, P6-T1, P7-T1 (full feature wired)
- Blocks: none downstream within Phase 8 (P8-T2/T3/T4 are independent of this task, though all feed the same phase-completion gate)
- Size: Small (1 file)
- Verification level: L2 (TS changes) + live-dev run

## Implementation Content
Extend `SOURCE/supabase/verify-schema.ts` — the RPC-probe block at `:448-493` gains an existence/EXECUTE probe for `exam_hot_counts` with harmless boundary arguments plus an anon-42501 probe, mirroring `search_exams` at `:478-493`. Same commit: correct the stale header claim (lines ~1-4, "không có migration tool") — a migration **procedure** now exists (schema:plan → migration file → CLI apply on dev) even though prod apply is still manual/statement-by-statement; reword without overclaiming.

## Target Files
- [x] `SOURCE/supabase/verify-schema.ts`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Fact Disposition Table row `verify-schema.ts:rpc-and-fk-probes`)
- `SOURCE/supabase/verify-schema.ts` (`:1-4` stale header claim; `:448-493` the RPC-probe block; `:478-493` `search_exams`'s existing probe — the structural precedent to mirror; `:752` the fingerprint probe, already green since P0-T5)
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure — the actual current state of the migration tooling, for the header correction)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D1) | persistence | Grants: `revoke all ... from public, anon;` then `grant execute ... to authenticated, service_role;` | Does the new probe assert `exam_hot_counts` exists AND is executable by `authenticated`/`service_role` AND is denied (42501) to `anon`? |

## Investigation Notes
- **`docs/design/exam-shelves-backend-design.md` Fact Disposition Table row `verify-schema.ts:rpc-and-fk-probes`**: confirms the RPC-probe block lives at `:448-493` (cited by anchor, not check number), gains an existence/EXECUTE probe for `exam_hot_counts` with harmless boundary arguments plus an anon-42501 probe, mirroring `search_exams`. No FK added, so `:650` (FK check) untouched; fingerprint probe (`:752`, now `:762` after this edit shifts nothing above it) is state-dependent and was already green (confirmed by the Red-phase baseline run below — dev already carries the migration).
- **`SOURCE/supabase/verify-schema.ts:1-4` stale header**: pre-edit text claimed `schema.sql được paste tay vào Supabase SQL Editor — không có migration tool`. Reworded to state the actual current state (dev has a migration procedure since 2026-08-31: `schema:plan` → migration file → CLI apply; prod apply stays manual, statement-by-statement; no tooling auto-detects prod drift), matching P0-T2's correction approach in `SOURCE/lib/schema/schemaFingerprint.ts:21-27` (same substance: names the procedure, names what it still is not, references the backend design doc's Migration Procedure section, keeps the TD-005 pointer).
- **`SOURCE/supabase/verify-schema.ts:448-493` `search_exams`'s existing probe** — the structural precedent mirrored: (1) `probe.rpc(fn, harmlessArgs)` asserting `!error && Array.isArray(data)` = existence + authenticated EXECUTE, (2) `anonClient.rpc(fn, harmlessArgs)` asserting `error.code === "42501"` = anon denial. `search_exams` uses `max_results: 1` as its harmless boundary; `exam_hot_counts` mirrors with `p_max_rows: 1` (the lower boundary of `greatest(coalesce(p_max_rows, 500), 1)` in the function body, schema.sql §20c) plus two epoch timestamps for the required `p_since_recent`/`p_since_wide` params.
- **`SOURCE/supabase/verify-schema.ts:752` (now further down after the edit) the fingerprint probe** — already green since P0-T5; confirmed unaffected (still passes in both Red- and Green-phase runs below).
- **Boundary-argument harmlessness**: `exam_hot_counts` (schema.sql §20c) is `language sql stable security definer` — a pure `select ... group by ... order by ... limit` with **no INSERT/UPDATE/DELETE** anywhere in its body. `p_max_rows: 1` only shrinks the returned row count (`limit least(greatest(coalesce(p_max_rows,500),1),1000)`); the two `1970-01-01` timestamps only narrow the `count(*) filter` windows. 0 mutation risk — same class of harmlessness as `search_exams`'s `max_results: 1` probe, which this task's probe mirrors.
- **Binding Decision (ADR-0021-cross-user-hot-aggregate-and-attempt-source.md § D1)** read in full: grants follow the **`search_exams` idiom**, not `exam_rating_aggregate`'s — `revoke all ... from public, anon;` then `grant execute ... to authenticated, service_role;` (no anon grant, unlike the rating aggregate, because nothing anonymous calls this function). Planned approach: mirror `search_exams`'s two-assertion structure (authenticated-executes, anon-denied) and add a third assertion — an `admin` (service_role) client call — because `exam_hot_counts` is SECURITY DEFINER and the Compliance Check explicitly names `authenticated`/`service_role` together, whereas `search_exams`'s own probe never separately proves service_role (the `admin` client already exists in `main()`'s scope, at zero new setup cost). Compliance Check evaluation: **Y** — the new probe asserts (a) existence (via the authenticated call not erroring with PGRST202-shaped failure), (b) EXECUTE by `authenticated` (probe client call succeeds) AND by `service_role` (admin client call succeeds), AND (c) denial (42501) to `anon` (anonClient call). All three assertions passed against live dev in the Green-phase run below.
- **Red-phase run** (`npm run verify:schema`, before edit): exit 0, target `hynwleaxtbtjzkvpjsug` (dev), full "Probe RPC" section shows only `exam_answer_key`, `claim_attempt_answer_key`, `search_exams` (authenticated + anon) — no `exam_hot_counts` case anywhere in the output, confirming the P0-T5 baseline the task describes.
- **Green-phase run** (`npm run verify:schema`, after edit): exit 0, three new lines appear under "Probe RPC": `✓ exam_hot_counts tồn tại và authenticated gọi được`, `✓ exam_hot_counts gọi được bằng service_role`, `✓ exam_hot_counts: anon bị từ chối (42501) — EXECUTE chỉ authenticated/service_role`. All other pre-existing assertions (columns, FKs, fingerprint, subject canonical, SUBSCRIPTION write-denial, essay grading) unchanged and still green — confirms dev's `exam_hot_counts` grants already match ADR-0021 D1 (Phase 0-7 already wired this on dev).
- **Quality gates**: `npx tsc --noEmit` exit 0 (project-wide); `npx eslint supabase/verify-schema.ts --max-warnings 0` exit 0; `npm run build` exit 0, all 22 routes generated; `git status --porcelain` after build shows only `SOURCE/supabase/verify-schema.ts` modified (Next.js did not regenerate `AGENTS.md` this run).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Run `npm run verify:schema` and confirm the current probe suite has no `exam_hot_counts`-specific case (the P0-T5 baseline)
### 2. Green Phase
- [x] Add the existence/EXECUTE probe for `exam_hot_counts`, mirroring `search_exams`'s structure
- [x] Add the anon-42501 probe
- [x] Correct the stale header claim, matching P0-T2's wording approach
### 3. Refactor Phase
- [x] Run `npm run verify:schema` against dev and confirm both new probes pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run verify:schema` (extended) — Enforces: live-dev RPC existence/EXECUTE/anon-denial probes — Config: `SOURCE/supabase/verify-schema.ts:448-493`

## Operation Verification Methods
- **Verification method**: `npx tsc --noEmit`/`eslint` for the TS changes; `npm run verify:schema` against live dev for the probes themselves.
- **Success criteria**: `verify:schema` exits 0, with the 2 new probes (existence/EXECUTE, anon-42501) both passing.
- **Failure response**: if the anon probe does not return 42501, the grant set on dev may have drifted from what P0-T1/P0-T4 established — re-verify against P0-T4's read-back rather than adjusting the probe's expected status code.
- **Verification level**: L2 for the TS/type-check portion; the probe run itself is a real-dev functional check.

## Proof Obligations
- **Claim** (Failure Mode: missing config): `exam_hot_counts` exists, is executable by `authenticated`/`service_role`, and is denied (42501) to `anon` — checked automatically on every `verify:schema` run from now on, not just at P0-T4's one-time read-back.
  - **Primary failure mode**: a future schema change accidentally alters or drops the grant, and without this automated probe, the regression would only surface when a real anonymous request happens to hit the RPC.
  - **Boundary to exercise**: live dev Postgres, via `verify-schema.ts`'s probe execution.
  - **State assertion**: N/A (read-only probes).
  - **Mock boundary rationale**: none — this is deliberately a real-dev check, mirroring the existing `search_exams` probe's own real-dev pattern.
  - **Residual**: this automates the check going forward; P8-T2's HS-e provides the same proof from the RLS-harness angle, and P8-T4's obligation (f) provides it again from the service-e2e angle — 3 independent layers proving the same grant boundary, per the plan's defense-in-depth design.

## Completion Criteria
- [x] Both new probes added, mirroring `search_exams`'s structure
- [x] Header claim corrected without overclaiming
- [x] `npm run verify:schema` exits 0 on dev, including both new probes
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Gates 1-2, 4 green for the TS changes

  Evidence: `npx tsc --noEmit` exit 0 (Gate 1, project-wide); `npx eslint supabase/verify-schema.ts --max-warnings 0` exit 0 (Gate 2); `npm run build` exit 0, 22 routes generated (Gate 4); `npm run verify:schema` exit 0 against dev (`hynwleaxtbtjzkvpjsug`), 3 new probe lines green: `exam_hot_counts tồn tại và authenticated gọi được`, `exam_hot_counts gọi được bằng service_role`, `exam_hot_counts: anon bị từ chối (42501)`. `git status --porcelain` confirms only `SOURCE/supabase/verify-schema.ts` and this task file modified.

## Notes
- Impact scope: `verify-schema.ts`'s RPC-probe block + header comment only.
- Scope boundary — preserve unchanged: every other existing probe in this file.
