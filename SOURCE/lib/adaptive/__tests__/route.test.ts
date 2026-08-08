// recommendNextSkill() [unit] Test Skeleton
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-014/015/016/017/028)
// Generated: 2026-08-08
//
// NOT part of the integration/fixture-e2e/service-integration-e2e lane budget —
// this is Design-Doc-mandated unit coverage (backend DD Implementation Path
// Mapping: "SOURCE/lib/adaptive/__tests__/route.test.ts" covering AC-014-017,
// AC-028), selected by this generation run as one of the task's explicitly named
// highest-risk cross-layer contracts (heuristic routing feeds getSkillRecommendation()
// and, through it, SkillRecommendationCard's populated/cold-start rendering).
//
// Mock boundary (backend DD Test Boundaries — Mock Boundary Decisions):
// recommendNextSkill() itself — "No — real implementation, direct pure-function unit
// test; no I/O to mock." All state (nodes/edges/mastery/threshold) is injected per
// AC-016's own "no ambient reads" requirement — nothing here is mocked.
// Test data: literal, independently-authored fixture DAGs (NOT the real reviewed
// curriculum content, which is a content-authoring deliverable, not a test-authoring
// one — backend DD Data Layer Testing Strategy).
//
// Algorithm under test (backend DD § Data Contracts, recommendNextSkill()):
//   1. mastery.length === 0 -> return null (AC-028)
//   2. ratio(nodeId) = mastery row exists ? correctCount/totalCount : 0 (absent -> 0)
//   3. isCleared(nodeId) = every edge (nodeId -> prereq) has ratio(prereq) >= threshold
//   4. sortKey(node) = [ratio ASC, lastWrongAt DESC NULLS LAST, id ASC]  (AC-015/016)
//   5-8. walk from the raw weakest node down through unmet prerequisites until cleared
//   9. reasonCode = substituted ? "prerequisite-gate" : (tie-by-recency ? "recently-wrong" : "lowest-mastery")

// =============================================================================
// Test 1 — AC-014/AC-017: prerequisite-gate substitution returns the unmet
// prerequisite, never the raw weakest node whose own prerequisite is unmet
// =============================================================================
// AC-014: "Given a test user with seeded mastery, when routing runs, then the
//   returned node is DAG-valid (all prerequisites at/above threshold)."
// AC-017: "Given a user whose weakest node is blocked by an unmet prerequisite,
//   when routing runs, then it returns the prerequisite, not the blocked node."
// ROI: 73 (BV:8 x Freq:8 + Legal:0 + Defect:9)
// Behavior: recommendNextSkill(input) called with a literal 3-node fixture DAG
//   (node "A" requires node "B"; B's mastery ratio is below threshold) and mastery
//   skewed so "A" is the raw weakest-overall node by ratio -> the algorithm's
//   prerequisite-substitution walk (Algorithm step 8) must return "B" instead of
//   "A", with reasonCode "prerequisite-gate".
// @category: core-functionality
// @lane: unit
// @dependency: none (pure function; literal fixture DAG + mastery array, no I/O)
// @complexity: medium
// @real-dependency: N/A — no I/O boundary exists to mock or run for real.
// Primary failure mode: the substitution walk (step 8) is missing or short-
//   circuits, so the function returns the raw weakest node ("A") directly even
//   though A's own prerequisite ("B") sits below threshold — silently recommending
//   a skill the student cannot yet attempt because its prerequisite is unmet.
// Proof obligation: with the literal fixture described above, assert
//   recommendNextSkill() returns exactly { nodeId: "B", reasonCode: "prerequisite-gate" }
//   (labelVi per fixture), never "A". Separately, over a second literal fixture
//   where every node's own prerequisites already clear threshold, assert every
//   prerequisite of the RETURNED node has ratio >= threshold (AC-014's general
//   invariant), computed independently of the algorithm under test, not merely
//   re-asserting "whatever the function returned."

// =============================================================================
// Test 2 — AC-015/AC-016: recency tie-break + determinism across repeated calls
// =============================================================================
// AC-015: "Given two candidate nodes with comparable mastery, when one was
//   answered incorrectly more recently, then that node is preferred."
// AC-016: "Given the same input state, when routing runs twice, then it returns
//   the same node (deterministic, pure function)."
// ROI: 73 (BV:8 x Freq:8 + Legal:0 + Defect:9)
// Behavior: two nodes share an identical correctCount/totalCount ratio; one has a
//   non-null lastWrongAt strictly more recent than the other's -> the
//   more-recently-wrong node is selected, reasonCode "recently-wrong". Calling
//   recommendNextSkill() twice with structurally-identical input returns a
//   deep-equal result both times, and neither call mutates its input arguments.
// @category: core-functionality
// @lane: unit
// @dependency: none
// @complexity: medium
// @real-dependency: N/A
// Primary failure mode: a tied-ratio pair is broken by node array order or object
//   identity instead of lastWrongAt (silently wrong tie-break); OR the function
//   reads Date.now()/any ambient/mutable state, so two calls with byte-identical
//   input produce different output — breaking AC-016's "pure function" guarantee,
//   which getSkillRecommendation()'s own safety to call on every dashboard read
//   depends on.
// Proof obligation: assert the selected node's id equals the fixture's
//   more-recently-wrong node id (literal fixture value, independently computed
//   expected id — not re-derived from the implementation) and reasonCode ===
//   "recently-wrong". Separately, call recommendNextSkill() twice with the same
//   literal input (two structurally-identical object literals, not the same
//   object reference, to also catch accidental reliance on reference identity)
//   and assert toEqual on both outputs; assert the input objects themselves are
//   unchanged after each call (no in-place mutation of nodes/edges/mastery).

// =============================================================================
// Test 3 — AC-028: true cold start returns null, never a fabricated recommendation
// =============================================================================
// AC-028: "Given a user with zero mastery rows, when routing runs, then it
//   returns a defined result (null, mapped to the UI's explicit cold-start state
//   per UI Spec D6) — 0 crashes, 0 fabricated recommendations."
// ROI: 73 (BV:8 x Freq:8 + Legal:0 + Defect:9)
// Behavior: recommendNextSkill() called with mastery: [] against a non-trivial
//   nodes/edges fixture (not an empty DAG) -> returns null, never throws, never
//   returns an arbitrary/first/entry node.
// @category: edge-case
// @lane: unit
// @dependency: none
// @complexity: low
// @real-dependency: N/A
// Primary failure mode: the function falls through to its own "absent from
//   mastery = ratio 0" rule and returns SOME node instead of null for a
//   zero-mastery user — a fabricated recommendation for a user the system has no
//   real signal about, directly contradicting the PRD's "say less when it knows
//   less" framing and UI Spec D6's cold-start contract (SkillRecommendationCard
//   would then render a false populated state instead of the honest cold-start
//   message, AC-028's UI-facing consequence).
// Proof obligation: with a non-trivial nodes/edges fixture and mastery: [],
//   assert recommendNextSkill(...) === null (strict equality, not falsy-check) —
//   using a non-empty DAG specifically proves the null branch is the deliberate
//   "mastery.length === 0" check (Algorithm step 1), not an accidental side
//   effect of an empty graph.

// =============================================================================
// Test 4 — Data Contract invariant: node absent from mastery never crashes
// =============================================================================
// No PRD AC number — backend DD's own Data Contract invariant ("Node absent from
//   `mastery` never causes a crash or an undefined ratio (defaults to 0)").
//   Selected because it is the exact edge case a maintainer relying on AC-014's
//   correctness would silently regress.
// ROI: 60 (BV:7 x Freq:6 + Legal:0 + Defect:9)
// Behavior: a fixture DAG where mastery has rows for SOME but not ALL nodes -> a
//   fully-untouched node is treated as ratio 0 (the weakest possible) without
//   throwing.
// @category: edge-case
// @lane: unit
// @dependency: none
// @complexity: low
// @real-dependency: N/A
// Primary failure mode: accessing an untouched node's ratio throws (reading a
//   property off an undefined mastery-row lookup) instead of defaulting to 0, or
//   the untouched node is silently excluded from candidate selection entirely
//   rather than being ranked as the weakest — either breaks the "untouched
//   encourages first attempts" design intent.
// Proof obligation: with a 2-node fixture where only one node has a mastery row,
//   assert recommendNextSkill() does not throw, and (since the untouched node's
//   ratio-0 default makes it the weakest by construction) that it selects the
//   untouched node's id.
