// Telemetry-write payload builder [unit] Test Skeleton (AC-013)
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-013, Success Criteria #13
//   "Telemetry never carries answer-key material")
// Generated: 2026-08-08
//
// NOT part of the integration/fixture-e2e/service-integration-e2e lane budget —
// Design-Doc-mandated unit coverage (backend DD Implementation Path Mapping:
// "SOURCE/lib/tutor/__tests__/telemetry.test.ts", AC-013). Selected as one of
// this task's explicitly named highest-risk gaps ("the telemetry containment").
//
// Implementer note: the backend DD's Implementation Path Mapping does not name a
// standalone exported "payload builder" function distinct from explainStep()'s /
// getSkillRecommendation()'s own inline insert-call construction — per this
// document's own precedent ("matching AC-018's own 'unit test on the builder,
// not just an integration check' precedent"), extract the telemetry insert
// payload construction into its own small, pure, unit-testable function (e.g.
// `buildTelemetryPayload(...)` in SOURCE/lib/tutor/telemetry.ts or co-located
// with callTutor.ts) so this file can unit-test it in isolation from the
// Supabase call itself — mirroring buildTutorPrompt()'s own pure-function shape.
//
// Mock boundary (backend DD Test Boundaries / Mock Boundary Decisions, applied
//   here to the payload-construction step specifically): No I/O — pure
//   payload-construction function; the actual DB insert call is a SEPARATE
//   concern exercised by tutorActions.int.test.ts / getSkillRecommendation.int.test.ts
//   (mocked Supabase boundary) at the integration level.

// =============================================================================
// Test 1 — AC-013: 0 occurrences of answer-key material in the constructed
// telemetry_log insert payload, across a fixture battery including simulated
// error paths
// =============================================================================
// AC-013: "Given any telemetry_log row, it shall contain no answer-key material
//   — asserted by a unit test on the telemetry-write payload builder, not by the
//   schema's column-shape exclusion alone."
// ROI: 69 (BV:10 x Freq:6 + Legal:0 + Defect:9)
// Behavior: the telemetry payload builder is invoked across a battery of fixture
//   inputs — success/failure outcomes, both event_type values
//   ('tutor_invoke'/'adaptive_route'), and a simulated caught Error whose
//   .message field contains a sentinel answer-key-shaped string (mirroring
//   prompt.test.ts's sentinel technique) — assert the constructed insert payload
//   object has 0 occurrences of the sentinel in ANY field, for every fixture in
//   the battery.
// @category: core-functionality
// @lane: unit
// @dependency: none (pure payload-construction function; no I/O)
// @complexity: medium
// @real-dependency: N/A
// Primary failure mode: a future maintainer routes a caught exception's
//   `err.message` (which could echo attacker-influenced UGC question content, per
//   Security Considerations) into `error_code` or any other telemetry column
//   instead of the constrained 4-member enum — reopening exactly the leak path
//   the schema's own CHECK constraint (`error_code in (...)`) and this unit test
//   both exist to prevent, per the schema's stated design intent ("Mã có cấu
//   trúc, KHÔNG BAO GIỜ free-text/exception message").
// Proof obligation: for each fixture (success/failure x tutor_invoke/adaptive_route),
//   assert every field of the constructed payload is either a structurally-safe
//   value (uuid, boolean, timestamp, or a closed enum member) or, for the one
//   string-shaped field capable of holding free text (error_code), assert it is
//   STRICTLY one of the 4 named literals ('gemini_unavailable' | 'rate_limited' |
//   'server' | 'not_eligible') and never the raw simulated Error's .message —
//   over a fixture battery that includes a simulated Error whose .message
//   contains the sentinel string, proving that string never reaches the payload
//   under any exercised code path.
