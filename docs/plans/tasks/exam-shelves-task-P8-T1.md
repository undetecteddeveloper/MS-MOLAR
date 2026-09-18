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
- [ ] `SOURCE/supabase/verify-schema.ts`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Fact Disposition Table row `verify-schema.ts:rpc-and-fk-probes`)
- `SOURCE/supabase/verify-schema.ts` (`:1-4` stale header claim; `:448-493` the RPC-probe block; `:478-493` `search_exams`'s existing probe — the structural precedent to mirror; `:752` the fingerprint probe, already green since P0-T5)
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure — the actual current state of the migration tooling, for the header correction)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D1) | persistence | Grants: `revoke all ... from public, anon;` then `grant execute ... to authenticated, service_role;` | Does the new probe assert `exam_hot_counts` exists AND is executable by `authenticated`/`service_role` AND is denied (42501) to `anon`? |

## Investigation Notes
_(Record here: confirmation the new probe's boundary arguments are harmless — 0 real data mutation risk; confirmation the header correction avoids overclaiming, matching P0-T2's wording exactly for consistency.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Run `npm run verify:schema` and confirm the current probe suite has no `exam_hot_counts`-specific case (the P0-T5 baseline)
### 2. Green Phase
- [ ] Add the existence/EXECUTE probe for `exam_hot_counts`, mirroring `search_exams`'s structure
- [ ] Add the anon-42501 probe
- [ ] Correct the stale header claim, matching P0-T2's wording approach
### 3. Refactor Phase
- [ ] Run `npm run verify:schema` against dev and confirm both new probes pass

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
- [ ] Both new probes added, mirroring `search_exams`'s structure
- [ ] Header claim corrected without overclaiming
- [ ] `npm run verify:schema` exits 0 on dev, including both new probes
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Gates 1-2, 4 green for the TS changes

## Notes
- Impact scope: `verify-schema.ts`'s RPC-probe block + header comment only.
- Scope boundary — preserve unchanged: every other existing probe in this file.
