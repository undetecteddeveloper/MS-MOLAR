# Task P8-T4 — Fill in `exam-hot-counts.service.e2e.test.ts` (6 obligations) — gate 6 first meaningful run

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 8, Task P8-T4**
Layer: backend (`SOURCE/tests/e2e/service/`)

Metadata:
- Dependencies: P8-T3 (`examHotCountsFixtures.ts`)
- Blocks: none downstream (last task before Final Phase, alongside P8-T1/T2)
- Size: Small (1 file, pre-committed skeleton fill-in)
- Verification level: L2 on live dev — `npm run test:localdb` green, exercising this feature's real-Postgres surface for the first time

## Implementation Content
Fill in `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (already committed as `it.todo`, 6 obligations) — wrap the top-level `describe` in `describe.skipIf(!HAS_LIVE_DB)` (importing `HAS_LIVE_DB` from P8-T3), replace each `it.todo` with a real `it`.

## Target Files
- [ ] `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (fill-in — pre-committed skeleton)

## Investigation Targets
- `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (the full pre-committed skeleton — read every `Proof obligation`/`Primary failure mode` comment block before writing any assertion)
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — service e2e row; skeleton's own Proof Obligation list)
- `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (P8-T3 — the fixtures this task consumes)
- `SOURCE/lib/adaptive/constants.ts` (`LIST_ROW_CEILING`, `POSTGREST_MAX_ROWS` — imported for the clamp assertion, never hand-copied)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Implementation Guidance — key-set-exact proof)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Implementation Guidance) | contract_schema | Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values | Does obligation (b) assert the returned row's key set EXACTLY, mirroring P8-T2's HS-c from the service-e2e angle? |

## Investigation Notes
_(Record here: the full `npm run test:localdb` output for this file; the exact row-ceiling clamp value observed vs. `LIST_ROW_CEILING`; confirmation the hour-snap boundary cases used real timestamps 1s before/after `date_trunc('hour', p_since_recent)`.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, including every comment block in the pre-committed skeleton
- [ ] Confirm all 6 obligations currently run as `it.todo`
### 2. Green Phase
- [ ] Wrap the top-level `describe` in `describe.skipIf(!HAS_LIVE_DB)`, importing `HAS_LIVE_DB` from P8-T3's fixtures module
- [ ] Replace each `it.todo` with a real `it` implementing obligations (a)-(f) below
- [ ] Run `npm run test:localdb` and iterate until all pass
### 3. Refactor Phase
- [ ] Confirm the row-ceiling clamp assertion imports `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`, not a hand-copied literal
- [ ] Confirm `examHotCountsFixtures.ts`'s `tearDown` runs cleanly after this file's full suite

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run test:localdb` — Enforces: real-Postgres service e2e (RLS isolation, grants, hour-snap) — Config: `SOURCE/vitest.localdb.config.ts:4-31`; Covered: `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts`

## Operation Verification Methods
- **Verification method**: `npm run test:localdb` — this is gate 6, and this task is the first case that makes it meaningful for this feature (the plan header's own caveat: "Gate 6 requires the dev database to carry the new schema fingerprint... implementation step 1 must land before a gate run means anything" — this task is where that finally closes the loop).
- **Success criteria**: all 6 obligations pass; the `describe.skipIf(!HAS_LIVE_DB)` guard correctly skips the suite in environments without live-DB access rather than failing.
- **Failure response**: if obligation (e)'s clamp assertion fails, re-check it is comparing against the imported constant's actual current value, not a value that was correct when the skeleton was authored but has since been retuned elsewhere.
- **Verification level**: L2 on live dev.

## Proof Obligations
- **Claim (a)** (from skeleton, verbatim): HS-b cross-user proof via real JWT.
  - **Primary failure mode**: same class as P0-T6/P8-T2's HS-b — automated here as the 3rd independent proof of the same cross-user aggregate claim.
  - **Boundary to exercise**: live dev Postgres, real second-user JWT, via this test file's own client setup (not `test-rls.ts`'s).
  - **State assertion**: N/A beyond the count check.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (b)** (from skeleton, verbatim): HS-c key-set-exact proof.
  - **Primary failure mode**: same class as P8-T2's HS-c and ADR-0021's Implementation Guidance — automated here as an independent, service-lane assertion (distinct test infrastructure from `test-rls.ts`, so a bug in one harness doesn't hide a regression the other would catch).
  - **Boundary to exercise**: live dev Postgres, real RPC call.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (c)** (from skeleton, verbatim): `in_progress`/unpublished/banned-author exclusion + banned-author reappearance after unban.
  - **Primary failure mode**: same class as P8-T2's HS-d/HS-f, from the service-e2e angle.
  - **Boundary to exercise**: live dev Postgres, real state transitions (unban).
  - **State assertion**: before ban → included; during ban → excluded; after unban → reappears.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (d)** (from skeleton, verbatim, Failure Mode: unavailable boundary / hour-snap): attempt 1s before `date_trunc('hour', p_since_recent)` excluded, 1s after included.
  - **Primary failure mode**: the window boundary is computed with a non-hour-snapped or off-by-one comparison, causing an attempt exactly at the boundary to be misclassified — a defect that would only surface at specific real-world timestamps, making it easy to miss without an explicit boundary test.
  - **Boundary to exercise**: live dev Postgres, real timestamps seeded 1s before and 1s after the hour-snap boundary.
  - **State assertion**: before → 2 attempts seeded, one on each side of the boundary; after → RPC call's counts reflect the boundary correctly (1 included, 1 excluded, or vice versa per direction).
  - **Mock boundary rationale**: none — window-boundary arithmetic must be proven against the real SQL `date_trunc` behavior, not a JS re-implementation.
  - **Residual**: none.
- **Claim (e)** (from skeleton, verbatim, Failure Mode: unavailable boundary / row-ceiling clamp): `p_max_rows` clamp asserted against IMPORTED `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`, not hand-copied literals.
  - **Primary failure mode**: the clamp assertion hand-copies today's constant value as a literal, silently passing even after a future retune of `LIST_ROW_CEILING` desyncs the test from the real constant.
  - **Boundary to exercise**: live dev Postgres, seeded with more rows than the ceiling to force the clamp to actually engage.
  - **State assertion**: before → more candidate exams than `LIST_ROW_CEILING`; after → RPC response row count is clamped at the imported constant's current value.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (f)** (from skeleton, verbatim, Failure Mode: missing config): `anon`→42501, `service_role`→array.
  - **Primary failure mode**: same class as P8-T1's probe and P8-T2's HS-e — the 4th independent layer proving the same grant boundary (verify-schema probe, RLS harness, service e2e, and — deferred to FQA-T7 — prod catalogue read).
  - **Boundary to exercise**: live dev Postgres, real anon and service_role clients.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: prod's equivalent grant state is FQA-T7's separate, deploy-time obligation.

## Completion Criteria
- [ ] `describe.skipIf(!HAS_LIVE_DB)` wraps the suite correctly
- [ ] All 6 obligations (a)-(f) converted from `it.todo` to `it`, passing on dev
- [ ] `npm run test:localdb` green
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Gates 1-2, 4, 6 green

## Notes
- Impact scope: `exam-hot-counts.service.e2e.test.ts` fill-in only — the skeleton's structure/comments are not this task's to redesign, only to satisfy.
- Scope boundary: no production source files are touched by this task; fixture teardown must leave dev clean (verified jointly with P8-T3).
