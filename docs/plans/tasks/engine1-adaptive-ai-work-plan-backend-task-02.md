# Task 02 (Backend): RLS regression cases — `test-rls.ts` Phần 7 (Work Plan Phase 1, Task 2)

Metadata:
- Dependencies: backend-task-01 (⚠ dev apply checkpoint must have passed — this task exercises the real `user_skill_mastery`/`telemetry_log`/`record_skill_mastery()` DB objects)
- Provides: `MM-a`/`MM-b`/`TL-a`/`TL-b` case names, cross-referenced directly by `recordSkillMastery.int.test.ts`'s own header (backend-task-10)
- Size: Small (1 file)

## Implementation Content

Append a new phased comment block (`Phần 7 — Engine 1 Adaptive AI (Mastery + Telemetry)`) to `SOURCE/supabase/test-rls.ts`, following the file's existing fixture-ID-prefix + phased-comment-block convention. Four cases:
- **`MM-a`**: a second user cannot SELECT another user's `user_skill_mastery` row.
- **`MM-b`**: a student's own JWT cannot invoke `record_skill_mastery()` via `.rpc(...)` — must fail permission-denied. Complements `recordSkillMastery.int.test.ts`'s Test 2 (backend-task-10), which name-references `MM-b` directly in its own header.
- **`TL-a`**: an authenticated user cannot SELECT any `telemetry_log` row, including their own.
- **`TL-b`**: `anon` cannot INSERT into `telemetry_log`.

## Target Files
- [ ] `SOURCE/supabase/test-rls.ts` (append-only — new Phần 7 block)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (an existing Phần block in full, e.g. the most recent one before this addition — for the exact fixture-ID-prefix + setup/cleanup/assert structural convention to mirror)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ Test Boundaries / Integration Verification Points — "new `test-rls.ts` cases... for `user_skill_mastery`... and `telemetry_log`")
- `SOURCE/supabase/schema.sql` (§18/§19 — the exact RLS policies and grants these cases must exercise, as landed by backend-task-01)
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (header — its own Test 2 explicitly cross-references `MM-a`/`MM-b`)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets; record the exact fixture-prefix convention and setup/cleanup helper pattern from the most recent existing Phần block.
- [ ] Confirm backend-task-01's checkpoint is green (dev DB has §18/§19 landed) before writing cases that would otherwise fail against a stale schema for the wrong reason.
- [ ] Author the 4 cases (`MM-a`/`MM-b`/`TL-a`/`TL-b`) as failing/unverified stubs first if this file's convention supports incremental case addition, or directly as complete cases per the file's own single-pass convention (follow whichever the existing Phần blocks actually do — record the observation in Investigation Notes).

### 2. Green Phase
- [ ] Complete all 4 cases with real assertions (permission-denied / empty-result expectations as appropriate per case).
- [ ] Run `cd SOURCE && npx tsx supabase/test-rls.ts` — full suite (all prior Phần blocks + new Phần 7) green.

### 3. Refactor Phase
- [ ] Clean up naming/fixture-prefix consistency with the rest of the file; confirm no fixture ID collides with any existing Phần block's prefixes.

## Quality Assurance Mechanisms
- `SOURCE/supabase/test-rls.ts` (manual, not CI) — Enforces: DB-level RLS/constraint behavior against real Postgres — Config: `SOURCE/supabase/test-rls.ts` — Covered: `user_skill_mastery` + `telemetry_log` policies (this task)
- ESLint / `tsc --noEmit` — Enforces: style/types — Config: `SOURCE/eslint.config.mjs` / `SOURCE/tsconfig.json` (project-wide)

## Operation Verification Methods
- **Verification method**: run `cd SOURCE && npx tsx supabase/test-rls.ts` against the real dev Postgres instance (post backend-task-01's apply) and inspect the exit code + per-case output.
- **Success criteria**: full suite (all prior Phần blocks + new Phần 7's 4 cases) exits 0; each of `MM-a`/`MM-b`/`TL-a`/`TL-b` individually reports pass.
- **Failure response**: if `MM-b` fails (i.e. the student JWT's `.rpc()` call unexpectedly succeeds), treat as a live security regression — escalate immediately, do not proceed to backend-task-10 or later Phase 3 work until backend-task-01's §18 revoke statement is re-verified and re-applied.
- **Verification level**: L1 (real dev-Postgres functional verification) — this is the project's own sanctioned real-DB RLS proof mechanism, manual/not-CI by convention.

## Proof Obligations
- **Claim**: a second user cannot SELECT another user's `user_skill_mastery` row (table-level RLS isolation).
- **Primary failure mode**: `user_skill_mastery`'s select policy is missing a `user_id = auth.uid()` predicate (or uses an incorrect operator), letting any authenticated user read any other user's mastery counters.
- **Boundary to exercise**: real Postgres RLS policy evaluation via the Supabase client, under two distinct real user JWTs.
- **State assertion**: before = fixture rows exist for user A; action = user B's client selects from `user_skill_mastery`; after = the query returns 0 rows for user A's data (or errors), never user A's real row.
- **Mock boundary rationale**: none — RLS correctness cannot be mocked (testing-principles, Data Layer Testing).
- **Residual**: none for this specific case.
- **Claim**: a student's own JWT cannot invoke `record_skill_mastery()` directly (function-level EXECUTE-grant boundary, `MM-b`).
- **Primary failure mode**: the §18 `revoke all ... from public, anon, authenticated` statement is missing, mistyped, or targets the wrong function signature/overload.
- **Boundary to exercise**: real Postgres function-level GRANT/REVOKE enforcement via `.rpc("record_skill_mastery", ...)` under a real non-service-role student JWT.
- **State assertion**: N/A (negative proof — the call must error, not mutate state).
- **Mock boundary rationale**: none.
- **Residual**: complements, but does not replace, backend-task-10's `recordSkillMastery.int.test.ts` Test 2 (a second, independent proof of the same boundary at the integration-test level, not the manual-RLS-suite level) — both are required per the work plan's own dual-coverage design.
- **Claim**: an authenticated user cannot SELECT any `telemetry_log` row, including their own (`TL-a`), and `anon` cannot INSERT into `telemetry_log` (`TL-b`).
- **Primary failure mode**: `telemetry_log` accidentally ships with a select policy for `authenticated` (even an own-row-scoped one, which the design explicitly says should not exist), or the insert policy is scoped too broadly to `anon`.
- **Boundary to exercise**: real Postgres RLS policy evaluation.
- **State assertion**: N/A (both are negative proofs).
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [ ] All 4 cases (`MM-a`/`MM-b`/`TL-a`/`TL-b`) implemented and passing against real dev Postgres
- [ ] Full `test-rls.ts` suite (incl. all prior Phần blocks) exits 0
- [ ] Each Proof Obligation is met: the case turns red under its primary failure mode and exercises the real DB boundary

## Notes
- Impact scope: `SOURCE/supabase/test-rls.ts` only, append-only.
- Scope boundary: do not modify any existing Phần block; do not re-run or alter backend-task-01's DDL from this task.
