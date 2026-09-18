# Task P0-T5 — `verify:schema` full mode green on dev

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T5**
Layer: backend (dev database verification — no source files changed)

Metadata:
- Dependencies: P0-T4 (dev must carry the applied migration)
- Blocks: P0-T6 (Early Verification Point runs against the same verified dev state)
- Size: Small (0 files changed; 1 command run)
- Verification level: L3 (tool exit code)

## Implementation Content
Run `npm run verify:schema` in full mode against dev from `SOURCE/`. The fingerprint probe at `verify-schema.ts:752` turns green now that P0-T4 has applied the migration. Confirm exit code 0.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `SOURCE/supabase/verify-schema.ts` (`:752` the fingerprint probe; the RPC-probe block around `:448-493` — note: the `exam_hot_counts`-specific probes are **not yet added** here, that is P8-T1's task; this run exercises the existing generic probes against the new dev state)
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure step 8)

## Investigation Notes
_(Record here: the full `verify:schema` output; confirm exit code 0; note that `exam_hot_counts`-specific probes are absent until P8-T1 and that is expected at this point.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read Investigation Targets and record key observations
- [ ] Note the pre-P0-T4 baseline behavior of `verify:schema`'s fingerprint probe (red, since dev didn't carry the fingerprint) for contrast
### 2. Green Phase
- [ ] Run `npm run verify:schema` full mode from `SOURCE/`
- [ ] Confirm exit code 0
### 3. Refactor Phase
- [ ] N/A — this task changes no source files

## Quality Assurance Mechanisms
- `npm run verify:schema` (extended) — Enforces: live-dev RPC existence/EXECUTE/anon-denial probes — Config: `SOURCE/supabase/verify-schema.ts:448-493`

## Operation Verification Methods
- **Verification method**: run `npm run verify:schema` (full mode) from `SOURCE/` against dev.
- **Success criteria**: exit code 0.
- **Failure response**: if non-zero, read the specific failing probe's output — most likely the fingerprint probe if P0-T4's apply did not fully land, or a pre-existing unrelated probe failure. Do not proceed to P0-T6 until this is green.
- **Verification level**: L3 (tool exit-code verification against a real, live dev database — stronger than a typical L3 build check since it exercises real infrastructure).

## Proof Obligations
- **Claim**: dev's schema state, as observed through `verify:schema`'s full probe suite, is internally consistent (fingerprint matches, no probe regressions) after P0-T4's apply.
  - **Primary failure mode**: the migration partially applied (e.g. one of the 7 statements failed silently, or the tool used a cached/stale connection), leaving dev in an inconsistent state that only a fresh full-probe run would catch.
  - **Boundary to exercise**: live dev Postgres via `verify-schema.ts`'s existing probe suite.
  - **State assertion**: before P0-T4, fingerprint probe red; after P0-T4 + this task, fingerprint probe green and no other probe regressed.
  - **Mock boundary rationale**: none.
  - **Residual**: this run does not yet exercise `exam_hot_counts`-specific probes (existence/EXECUTE/anon-42501) — those are added in P8-T1 and run again there.

## Completion Criteria
- [ ] `npm run verify:schema` full mode exits 0 against dev
- [ ] Investigation Notes record the full command output

## Notes
- Impact scope: verification only, dev database.
- Scope boundary: no source files touched.
