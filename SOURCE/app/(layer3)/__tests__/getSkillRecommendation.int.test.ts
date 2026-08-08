// getSkillRecommendation() [integration] Test Skeleton
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-012/014-017/028/031)
// Generated: 2026-08-08 | Budget Used: integration 2/3 (backend sub-budget — see
//   tutorActions.int.test.ts's header for the full sub-budget rationale)
//
// Mock boundary (backend DD Test Boundaries — Mock Boundary Decisions): Supabase
//   client inside getSkillRecommendation() — Yes, mock, for integration tests —
//   matches the project's sanctioned getResult.int.test.ts / rating.int.test.ts
//   precedent. recommendNextSkill() is NOT mocked — it runs for real, in-process
//   (the exact function under separate unit test in
//   SOURCE/lib/adaptive/__tests__/route.test.ts), so this file proves
//   getSkillRecommendation() actually calls it with the right fixture-derived
//   data and maps its result correctly, not merely that a mock returned the
//   right shape.

// =============================================================================
// Test 1 — AC-012 (routing half of R4): adaptive_route telemetry insert fires
// =============================================================================
// AC-012: "...record an event sufficient to answer 'how many tutor calls
//   happened, for whom, and how many failed' via a telemetry_log query" — the
//   routing half of R4 ("Adaptive-routing and tutor events are recorded"),
//   proven equivalently here, per backend DD's own cross-reference to this file.
// ROI: 57 (BV:7 x Freq:7 + Legal:0 + Defect:8)
// Behavior: getSkillRecommendation() called against a mocked Supabase boundary
//   with a populated mastery fixture -> asserts exactly one telemetry_log insert
//   call fires with event_type='adaptive_route', mirroring
//   tutorActions.int.test.ts's own query-based proof for the tutor half of R4.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer3)/queries.ts (getSkillRecommendation) + mocked
//   Supabase client + recommendNextSkill() (real, in-process) +
//   MASTERY_CLEARED_THRESHOLD (real constant)
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the telemetry insert is implemented only for the tutor
//   path (explainStep()) and silently omitted for the routing path, leaving R4's
//   "adaptive-routing events are recorded" half unimplemented despite AC-012's
//   text nominally covering both — the schema's own §19 CHECK constraint already
//   names 'adaptive_route' as a valid event_type specifically to prevent this gap.
// Proof obligation: assert the mocked insert builder recorded a call with
//   event_type: "adaptive_route" and a user_id matching the fixture caller,
//   exactly once per getSkillRecommendation() invocation.

// =============================================================================
// Test 2 — AC-028: cold start resolves null, and a telemetry-write failure never
// alters the returned recommendation (fire-and-forget)
// =============================================================================
// AC-028: "...it returns a defined result (null, mapped to the UI's explicit
//   cold-start state per UI Spec D6) — 0 crashes, 0 fabricated recommendations."
// ROI: 57 (BV:7 x Freq:7 + Legal:0 + Defect:8)
// Behavior: mocked Supabase boundary returns zero mastery rows ->
//   getSkillRecommendation() resolves exactly null (never throws, never an
//   empty-object stand-in). A second case within this test: the mocked
//   telemetry-insert call is made to reject/error -> the returned value is
//   UNCHANGED (still exactly null, or still exactly the populated recommendation
//   in a populated-fixture variant), proving the "a write failure never blocks or
//   alters the returned SkillRecommendation" contract (backend DD § Main
//   Components, getSkillRecommendation()).
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1
// @complexity: low
// @real-dependency: none
// Primary failure mode: a cold-start user (0 mastery rows — every brand-new
//   signup, the single highest-frequency case in production) causes
//   getSkillRecommendation() to throw (e.g. an unhandled property access on a
//   null recommendNextSkill() result) instead of resolving the documented null,
//   breaking DashboardPage's own Promise.all fetch for every new user; OR a
//   telemetry-insert failure is allowed to propagate and change/reject the
//   returned recommendation, turning an observability write into a second point
//   of failure for a user-facing read (the exact anti-pattern this function's
//   own design explicitly rejects).
// Proof obligation: mocked mastery fetch returns [] -> assert
//   getSkillRecommendation() resolves strictly to null (not undefined, does not
//   throw). Separately, with a mocked telemetry-insert call configured to reject,
//   assert the function's resolved value is unaffected (still exactly null in the
//   cold-start variant, or still exactly the expected populated object in a
//   populated-fixture variant) — proving the fire-and-forget contract.

// =============================================================================
// Test 3 — AC-014-017/031: populated recommendation mapping fidelity
// (nodeId dropped, labelVi -> skillLabel, reasonCode passthrough)
// =============================================================================
// AC-031: "...SkillRecommendationCard shall render the populated state: eyebrow,
//   the skill's Vietnamese label..., and a closed-by-default <details>
//   disclosure..." — this backend-level test proves the DATA getSkillRecommendation()
//   hands to that component is correctly shaped, per the backend DD's own Field
//   Propagation Map.
// ROI: 51 (BV:7 x Freq:6 + Legal:0 + Defect:9)
// Behavior: mocked Supabase boundary returns a fixture DAG + mastery rows ->
//   getSkillRecommendation() calls the real recommendNextSkill() and maps its
//   {nodeId, labelVi, reasonCode} result to the UI Spec's exact
//   {skillLabel: labelVi, reasonCode} shape, DROPPING nodeId entirely (Field
//   Propagation Map: "nodeId itself is NOT propagated to the UI Spec's
//   SkillRecommendation type... the DAG-internal identifier stays a backend
//   concern").
// @category: core-functionality
// @lane: integration
// @dependency: same as Test 1
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the mapping accidentally leaks nodeId into the returned
//   object (widening the UI-Spec-locked SkillRecommendation shape without a
//   Minimal Surface Alternatives pass), or maps labelVi to the wrong field name
//   — breaking SkillRecommendationCard's render silently (a missing/misnamed key
//   renders as nothing, not a crash — exactly the kind of schema/shape drift
//   testing-principles' "Mock Limitations for Data Layer" warns passes through
//   undetected without an explicit shape assertion, applied here to the JS
//   mapping layer).
// Proof obligation: with a literal fixture producing recommendNextSkill() output
//   {nodeId: "node-x", labelVi: "Lũy thừa", reasonCode: "lowest-mastery"}, assert
//   getSkillRecommendation() resolves toEqual EXACTLY
//   {skillLabel: "Lũy thừa", reasonCode: "lowest-mastery"} — and separately assert
//   the resolved object does NOT have a "nodeId" property
//   (expect(result).not.toHaveProperty("nodeId")).
