# Task P8-T2 — `test-rls.ts` Phần 10 (HS-a through HS-g)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 8, Task P8-T2**
Layer: backend (`SOURCE/supabase/test-rls.ts`)

Metadata:
- Dependencies: P0-T6 (Early Verification Point passed) — otherwise independent within Phase 8
- Blocks: none downstream within Phase 8
- Size: Small-Medium (1 file, 7 cases)
- Verification level: L2 on live dev — `npx tsx supabase/test-rls.ts` run manually against dev, all 7 cases pass

## Implementation Content
Extend `SOURCE/supabase/test-rls.ts` with Phần 10 (cases HS-a through HS-g) per backend DD § Test Boundaries and Placement.

## Target Files
- [ ] `SOURCE/supabase/test-rls.ts`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — "test-rls.ts Phần 10" verbatim case list)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Implementation Guidance — "Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values")
- `SOURCE/supabase/test-rls.ts` (existing Phần structure — the pattern this new Phần 10 must follow for consistency; the two-seeded-user pattern already established, reused here)
- `SOURCE/supabase/schema.sql` (P0-T1's `exam_hot_counts()`, `exam_attempts.source` + CHECK, `attempts_insert_own` policy — the objects under test)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D1) | persistence | Grants: `revoke all ... from public, anon;` then `grant execute ... to authenticated, service_role;` | Does HS-e assert `anon`→42501, `authenticated`→array, matching this grant decision exactly? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Implementation Guidance) | contract_schema | Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values | Does HS-c assert the returned row's key set is EXACTLY the 4 declared columns, using an exhaustive key-set comparison (not just value spot-checks)? |

## Investigation Notes
_(Record here: the full test-rls.ts run output for all 7 cases, verbatim; confirmation HS-g's `source='hacked'` insert genuinely returns Postgres error code 23514.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Confirm Phần 10 does not yet exist in `test-rls.ts`
### 2. Green Phase
- [ ] Implement HS-a through HS-g per the verbatim case list below
- [ ] Run `npx tsx supabase/test-rls.ts` against dev and iterate until all 7 pass
### 3. Refactor Phase
- [ ] Confirm the full test-rls.ts suite (all Phần, not just Phần 10) still exits 0 — this task must not regress any earlier Phần

## Quality Assurance Mechanisms
- `SOURCE/supabase/test-rls.ts` Phần 10 (extended) — Enforces: RLS isolation + no-identity-leak proof (HS-a..HS-g) — Config: `SOURCE/supabase/test-rls.ts`

## Operation Verification Methods
- **Verification method**: `npx tsx supabase/test-rls.ts` run manually against dev.
- **Success criteria**: all 7 cases (HS-a..HS-g) pass, and the full suite (all Phần) still exits 0.
- **Failure response**: if HS-c's key-set assertion fails, this is the exact leak class ADR-0021 D1 exists to prevent — re-open the ADR per the plan's own Early Verification Point failure response, do not patch the assertion to accept extra keys.
- **Verification level**: L2 on live dev.

## Proof Obligations
- **Claim** (HS-a, positive control): student A sees 0 of student B's `exam_attempts` rows via direct table access post-DDL — RLS is unweakened by this feature's schema changes.
  - **Primary failure mode**: the new column/index/function additions accidentally interact with RLS policy evaluation (e.g. a policy referencing the new column incorrectly), breaking the pre-existing isolation guarantee.
  - **Boundary to exercise**: live dev Postgres, two real seeded users, direct table SELECT.
  - **State assertion**: before → B has attempts; after → A's direct SELECT of `exam_attempts` returns 0 of B's rows.
  - **Mock boundary rationale**: none — real Postgres, real RLS evaluation.
  - **Residual**: none.
- **Claim** (HS-b, cross-user proof): `total_count>=1` for an exam only B submitted, read by A via the RPC — the same claim P0-T6 proved once manually, now automated and repeatable.
  - **Primary failure mode**: same as P0-T6's.
  - **Boundary to exercise**: live dev Postgres, real RPC call.
  - **State assertion**: N/A beyond the count check.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this closes P0-T6's manual check into a repeatable automated one.
- **Claim** (HS-c, leak proof): the returned row's key set is EXACTLY the 4 declared columns.
  - **Primary failure mode**: a future schema edit widens the function's `returns table(...)` and this is the only place that would catch it before it reaches production.
  - **Boundary to exercise**: live dev Postgres, real RPC call, exhaustive key-set comparison.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none — per ADR-0021's own Implementation Guidance, this is the harness that specifically must assert the key set, not just values.
- **Claim** (HS-d): unpublished exams are excluded from the aggregate.
  - **Primary failure mode**: the function's `exams.status='published'` predicate is dropped or loosened.
  - **Boundary to exercise**: live dev Postgres.
  - **State assertion**: before → an unpublished exam has submitted attempts; after → it contributes 0 to any `exam_hot_counts` result.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (HS-e): `anon`→42501, `authenticated`→array.
  - **Primary failure mode**: the grant set drifts (same class as P8-T1's automated probe, proven here from the RLS-harness angle instead).
  - **Boundary to exercise**: live dev Postgres, real anon and authenticated calls.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (HS-f): banned-author exclusion + reappearance after unban.
  - **Primary failure mode**: the `not is_author_banned(author_id)` predicate is evaluated once and cached, or the reappearance-after-unban case is never actually tested (a common gap — ban is tested, unban is not).
  - **Boundary to exercise**: live dev Postgres, a real ban/unban state transition.
  - **State assertion**: before ban → exam contributes to counts; during ban → excluded; after unban → reappears.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (HS-g, state-change negative): `source='hacked'` on insert → Postgres error 23514 (CHECK violation); writing on B's `user_id` → refused by `attempts_insert_own`.
  - **Primary failure mode**: the CHECK constraint's literal value set is wrong (e.g. missing a value or too permissive), or `attempts_insert_own`'s policy was accidentally weakened by this feature's schema changes.
  - **Boundary to exercise**: live dev Postgres, real insert attempts.
  - **State assertion**: before → attempt to insert `source='hacked'`; after → insert rejected with 23514, 0 row written.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this is application-layer normalisation's (P1-T5) last-line defense, now proven at the DB layer.

## Completion Criteria
- [ ] All 7 cases (HS-a..HS-g) implemented and passing on dev
- [ ] Full `test-rls.ts` suite (all Phần) still exits 0
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Gates 1-2, 4 green for the TS changes; the test-rls.ts run itself verified separately

## Notes
- Impact scope: `test-rls.ts` Phần 10 (new section) only.
- Scope boundary — preserve unchanged: every earlier Phần in this file.
