# Task 08 (Backend): `getSkillRecommendation()` + `types/adaptive.ts` (Work Plan Phase 2, Task 8)

Metadata:
- Dependencies: backend-task-07 (`recommendNextSkill()`)
- Provides: `getSkillRecommendation()`, consumed by frontend-task-02 (`SkillRecommendationCard`/`DashboardPage` mount); `SkillRecommendation` type shape frontend-task-02 renders
- Size: Medium (3 files: `queries.ts` extension, `types/adaptive.ts`, `getSkillRecommendation.int.test.ts`)

## Implementation Content

Implement `SkillRecommendation` type (`{skillLabel, reasonCode} | null`) in `SOURCE/types/adaptive.ts`, and `getSkillRecommendation()` in `SOURCE/app/(layer3)/queries.ts` — fetches nodes/edges + this user's mastery rows (RLS-scoped), calls `recommendNextSkill()`, maps `{nodeId, labelVi, reasonCode}` → `{skillLabel: labelVi, reasonCode}` **dropping `nodeId` entirely**, attempts a best-effort `telemetry_log` insert (`event_type='adaptive_route'`) whose failure never alters the returned value.

Convert `getSkillRecommendation.int.test.ts`'s 3 already-generated tests into real vitest tests against a mocked Supabase client boundary (matching `getResult.int.test.ts`/`rating.int.test.ts`'s sanctioned mock precedent):
- Test 1 (AC-012, telemetry insert fires)
- Test 2 (AC-028, cold-start strict-`null` + fire-and-forget telemetry-failure isolation)
- Test 3 (AC-014-017/031, mapping fidelity — exact `toEqual`, `nodeId` provably absent via `not.toHaveProperty`)

## Target Files
- [ ] `SOURCE/types/adaptive.ts` (new — `SkillRecommendation` type)
- [ ] `SOURCE/app/(layer3)/queries.ts` (additive — `getSkillRecommendation()`)
- [ ] `SOURCE/app/(layer3)/__tests__/getSkillRecommendation.int.test.ts` (fill in the existing skeleton's 3 tests)

## Investigation Targets
- `SOURCE/app/(layer3)/__tests__/getSkillRecommendation.int.test.ts` (already generated — read in full: Mock Boundary Decisions note, all 3 tests' exact annotations)
- `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` or `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (the sanctioned mocked-Supabase-client-boundary precedent this file's mocking style must match)
- `SOURCE/lib/adaptive/route.ts` (backend-task-07 — `recommendNextSkill()`, real, in-process, not mocked)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `app/(layer3)/queries.ts` — `getSkillRecommendation()` + `types/adaptive.ts`; § Minimal Surface Alternatives Element 4 — `reasonCode` computed at read time, not cached; § Field Propagation Map)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets, in particular the skeleton's Mock Boundary Decisions and all 3 tests.
- [ ] Convert the 3 skeleton tests into real vitest tests against a mocked Supabase client, using the sanctioned precedent's exact mocking style.
- [ ] Run the tests and confirm all 3 fail (no `getSkillRecommendation()` implementation exists yet).

### 2. Green Phase
- [ ] Implement `SkillRecommendation` type in `types/adaptive.ts`.
- [ ] Implement `getSkillRecommendation()`: fetch nodes/edges + RLS-scoped mastery rows, call `recommendNextSkill()` (real, in-process), map the result dropping `nodeId`, best-effort telemetry insert (`event_type='adaptive_route'`) that never affects the return value on failure.
- [ ] Run `npx vitest run app/\(layer3\)/__tests__/getSkillRecommendation.int.test.ts` — confirm all 3 pass.

### 3. Refactor Phase
- [ ] Confirm the telemetry-insert failure path is genuinely fire-and-forget (re-run Test 2's telemetry-reject case to confirm the returned value is unaffected).

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `app/(layer3)/__tests__/`

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/adaptive app/\(layer3\)/__tests__/getSkillRecommendation.int.test.ts` against the mocked Supabase boundary.
- **Success criteria**: all 3 tests pass; `getSkillRecommendation()`'s contract matches the backend DD exactly (`nodeId` dropped, `null` on cold start, telemetry fire-and-forget) — Phase 2 Completion Criteria.
- **Failure response**: if Test 3's `toEqual`/`not.toHaveProperty("nodeId")` assertion fails, treat as a shape-drift regression — do not adjust the test to match an accidentally-widened return shape; fix the mapping instead.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
(Sourced verbatim from `getSkillRecommendation.int.test.ts`'s own annotations.)
- **Claim**: Test 1 — a `telemetry_log` insert with `event_type='adaptive_route'` fires exactly once per invocation (AC-012, routing half of R4).
- **Primary failure mode**: the telemetry insert is implemented only for the tutor path (`explainStep()`) and silently omitted for the routing path.
- **Boundary to exercise**: integration, mocked Supabase client boundary; `recommendNextSkill()` real, in-process.
- **State assertion**: N/A (write-call-shape assertion via the mocked builder, not a real DB read-back).
- **Mock boundary rationale**: Supabase client mocked per this project's sanctioned `getResult.int.test.ts`/`rating.int.test.ts` precedent; `recommendNextSkill()` runs for real to prove the actual mapping, not merely a mock's stubbed return.
- **Residual**: none.
- **Claim**: Test 2 — cold start (`mastery: []`) resolves strictly `null`; a telemetry-insert failure never alters the returned recommendation (AC-028, fire-and-forget).
- **Primary failure mode**: a cold-start user causes an unhandled property access and the function throws instead of resolving `null`; OR a telemetry-insert failure propagates and changes/rejects the returned recommendation.
- **Boundary to exercise**: integration, mocked Supabase client boundary.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: none.
- **Claim**: Test 3 — populated recommendation mapping fidelity: `{nodeId, labelVi, reasonCode}` → `{skillLabel: labelVi, reasonCode}`, `nodeId` dropped entirely (AC-014-017/031).
- **Primary failure mode**: the mapping accidentally leaks `nodeId` into the returned object, or maps `labelVi` to the wrong field name.
- **Boundary to exercise**: integration, mocked Supabase client boundary; `recommendNextSkill()` real, in-process.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: this test proves the JS mapping layer's shape fidelity; it does not itself prove `SkillRecommendationCard`'s render of that shape — that is frontend-task-02's own proof obligation.

## Completion Criteria
- [ ] `types/adaptive.ts`/`getSkillRecommendation()` implemented; all 3 `getSkillRecommendation.int.test.ts` tests pass
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode

## Notes
- Impact scope: `SOURCE/types/adaptive.ts` (new), `SOURCE/app/(layer3)/queries.ts` (additive extension only).
- Scope boundary: do not modify `SkillRecommendationCard.tsx`/`DashboardPage` (frontend-task-02's responsibility); do not modify `recommendNextSkill()` itself (backend-task-07, read-only dependency here).
