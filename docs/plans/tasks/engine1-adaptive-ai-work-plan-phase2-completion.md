# Phase 2 Completion: Adaptive Routing

Covers Work Plan Phase 2 (Tasks 7-8 / `engine1-adaptive-ai-work-plan-backend-task-07.md`, `engine1-adaptive-ai-work-plan-backend-task-08.md`).

## All-Task Completion Checklist

- [x] backend-task-07 (T7 — `route.ts`) complete (commit `1c2c02d`): `route.test.ts` 9/9 green (the 4 skeleton tests expanded — Test 2 split into 4 assertions covering tie-break, array-order independence, repeat-call determinism and no-input-mutation). All 3 Reference Contracts' Compliance Checks `Y`.
- [x] backend-task-08 (T8 — `getSkillRecommendation()`) complete (commit `795ab38`): `getSkillRecommendation.int.test.ts` 10/10 green (3 skeleton tests expanded — fire-and-forget covered for both the returned-`error` path and the thrown-exception path, which are separate failure routes).

## Test Skeleton Paths for Verification

- `SOURCE/lib/adaptive/__tests__/route.test.ts` — expect 4/4 tests passing (prerequisite-gate, recency+determinism, cold start, node-absent-from-mastery)
- `SOURCE/features/analytics/__tests__/getSkillRecommendation.int.test.ts` — expect 3/3 tests passing (telemetry insert, cold-start+fire-and-forget, mapping fidelity)

## Phase Completion Criteria (verbatim from Work Plan)

- [x] `recommendNextSkill()` is DAG-valid and deterministic on all unit test fixtures
- [x] `getSkillRecommendation()`'s contract matches the backend DD exactly (`nodeId` dropped — asserted via `not.toHaveProperty`, `null` on cold start, telemetry fire-and-forget)

## Verification Commands

```
cd SOURCE && npx vitest run "lib/adaptive" "features/analytics/__tests__/getSkillRecommendation.int.test.ts"
```

## Implementation Notes (2026-08-15)

**Three deviations from a literal transcription of the pseudocode**, each closing a real defect:

1. `totalCount === 0` yields ratio `0`, not `NaN`. `NaN` compares false against everything, so a `NaN` ratio reaching the sort would make ordering depend on initial array position — destroying exactly the determinism AC-016 exists to guarantee. Covered by its own test.
2. The sort runs on a copy (`[...nodes]`). `Array.sort` mutates in place, and `nodes` belongs to the caller. Test 2 asserts no input mutation.
3. The third sort key (`id ASC`) is load-bearing, not decoration: without it, two nodes tied on both ratio and `lastWrongAt` fall through to `Array.sort`'s stability behaviour.

**The defensive `visited` set in the substitution walk is deliberate** even though AC-001 guarantees an acyclic DAG. The data reaching this function comes from the `skill_prerequisites` table, so a hand-edit could introduce a cycle and hang the walk. The `validateDag()` gate lives at seed time; this function does not trust that gate blindly.

**Telemetry fires on every routing call, including cold start.** R4 counts routing invocations, and cold start is the largest cohort (every new signup) — skipping it would erase that group from the metrics entirely. `user_id` therefore comes from `auth.getUser()` rather than being derived from a mastery row, since the cold-start case has no mastery rows at all.

**`buildTelemetryPayload()` is reused rather than re-implemented.** The answer-key containment barrier (AC-013) lives inside that function; a second hand-rolled insert path into the same table would leave the barrier guarding only half the writes.

**`recommendNextSkill()` runs for real in the integration tests** (only the Supabase client is mocked). One fixture has the weakest node blocked by an unmet prerequisite, so mocking the algorithm or re-deriving it inline would fail that case immediately.

## Next Phase Gate

Phase 3 (backend-task-09 through backend-task-13) does not depend on Phase 2's outputs — it depends on backend-task-01 (schema checkpoint) and, internally, on backend-task-09's `computeWrongTwiceQuestionIds()`. Phase 3 may start in parallel with Phase 2, or before it, per the work plan's own Task Dependency Diagram (no edge from T7/T8 into T9-T13). Phase 4's frontend-task-02 (`SkillRecommendationCard`) is the actual consumer of this phase's output and is gated on backend-task-08.
