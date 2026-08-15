// ExplainStepAffordance [integration] Test Skeleton
// (covers useTutorAction's phase-transition state machine — no separate hook
// test file is named by the frontend Design Doc's own Implementation Path
// Mapping; the hook is exercised through the component it drives, matching
// ActionButton.test.tsx's own precedent of testing usePdfAction through
// ActionButton rather than in isolation.)
// Design Doc: docs/design/engine1-adaptive-ai-frontend-design.md (v1.0) §
//   State Machine Detail — useTutorAction, § Accessibility Implementation
// UI Spec: docs/ui-spec/engine1-adaptive-ai-ui-spec.md (v1.0) — state x display
//   matrix for ExplainStepAffordance, S-01
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-018-020 UI half, AC-021,
//   AC-025, AC-026, AC-029)
// Generated: 2026-08-08 | Budget Used: integration 1/3 (frontend sub-budget —
//   see backend tutorActions.int.test.ts's header for the sub-budget rationale
//   this pairs with)
//
// IMPLEMENTER NOTE (to add at implementation time, first line of the real
//   file): `// @vitest-environment jsdom` — required for @testing-library/react
//   to render into a DOM, matching ActionButton.test.tsx's own first line.
//
// Mock boundary (frontend DD Test Boundaries — Mock Boundary Decisions):
//   `explainStep` (imported into useTutorAction) — Yes, mock — I/O boundary
//   (network/Gemini round trip), mirrors ActionButton.test.tsx's mocking of
//   generateAttemptPdfFile/downloadPdfFile/canShareFile. RichText — No, real
//   render (already covered by its own RichText.xss.test.tsx, reused unmodified
//   here). BentoCell, Button — No, real render (pure display primitives).
//   useT() — No, real (no-provider DEFAULT_LOCALE fallback, matching
//   ActionButton.test.tsx's convention — no I18nProvider wrapper needed).
//   This repo's vitest.config.ts wires no @testing-library/jest-dom setup file,
//   so jest-dom matchers (toHaveAttribute etc.) are unavailable — read raw DOM
//   properties/attributes directly, same convention as ActionButton.test.tsx.
//   render() does not auto-cleanup between tests in this file's sibling
//   convention files — scope every query to its own render()'s returned
//   container via `within`, never the global `screen` (ActionButton.test.tsx
//   precedent).

// =============================================================================
// Test 1 — AC-025: busyRef synchronous double-activation guard — a second
// activation while busy is a verified no-op (at most 1 explainStep() call)
// =============================================================================
// AC-025: "...A second activation while busy shall be a no-op (checked via
//   busyRef synchronously, before any React state update)."
// ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
// Behavior: render ExplainStepAffordance with a mocked explainStep() that never
//   resolves (a pending Promise, held open) -> fire two rapid activations
//   (click, or a second click) on the button while phase==="busy" -> assert the
//   mocked explainStep() was called AT MOST ONCE.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/components/tutor/ExplainStepAffordance.tsx +
//   SOURCE/components/tutor/useTutorAction.ts + mocked
//   SOURCE/app/(layer2)/tutorActions.ts (explainStep)
// @complexity: medium
// @real-dependency: none — sanctioned mock boundary (frontend DD Mock Boundary
//   Decisions: explainStep is the I/O boundary; useTutorAction's own
//   phase/busyRef control flow runs for real, in-process).
// Primary failure mode: the busyRef guard is implemented as a React state check
//   (`phase === "busy"`) instead of a synchronous ref check, so a second click
//   fired in the same tick (before React's state update flushes) is NOT blocked
//   — firing a second explainStep() call, another Gemini round trip, another
//   rate-limit consumption for the same click gesture.
// Proof obligation: with generateHint (mocked explainStep) held pending via an
//   unresolved Promise, fire two activation events on the button in immediate
//   succession -> assert mockExplainStep.mock.calls.length === 1 (never 2),
//   using a literal call-count assertion, not merely "the UI still looks busy."

// =============================================================================
// Test 2 — argument-order proof: explainStep is called with (attemptId,
// questionId), never the swapped ExplainStepAffordanceProps declaration order
// =============================================================================
// No standalone AC number — frontend DD's own top-named Risk: "explainStep(
//   attemptId, questionId) vs. ExplainStepAffordanceProps' (questionId,
//   attemptId) declaration order — a silent argument swap since both are
//   strings," mitigated explicitly by "a literal-fixture unit test in
//   ExplainStepAffordance.test.tsx asserting toHaveBeenCalledWith(
//   '<attemptId-fixture>', '<questionId-fixture>') with two distinguishable
//   fixture values, so a swap fails the assertion."
// ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
// Behavior: render ExplainStepAffordance with two DISTINGUISHABLE literal string
//   props (e.g. attemptId="attempt-fixture-111", questionId="question-fixture-222"
//   — deliberately NOT symmetric/interchangeable-looking) -> activate the button
//   -> assert the mocked explainStep was called with the arguments in the exact
//   order (attemptId, questionId), not (questionId, attemptId).
// @category: core-functionality
// @lane: integration
// @dependency: same as Test 1
// @complexity: low
// @real-dependency: none
// Primary failure mode: useTutorAction.ts's call site swaps the two string
//   arguments (both plain strings, so TypeScript compiles either order without
//   error) — every tutor invocation silently targets the wrong
//   attempt/question pair, an undetectable-by-type-system regression this test
//   is the SOLE guard against.
// Proof obligation: `expect(mockExplainStep).toHaveBeenCalledWith(
//   "attempt-fixture-111", "question-fixture-222")` — using two fixture values
//   that would fail this assertion if swapped (not, e.g., two identical or
//   easily-confusable strings).

// =============================================================================
// Test 3 — AC-018/019/020 UI half + D5: hint-shown state renders the hint via
// RichText and removes the re-invoke control for this question in this render
// =============================================================================
// AC (D5, UI half): "...no control to re-invoke the tutor shall exist in this
//   state for this question in this render."
// ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:7)
// Behavior: mocked explainStep resolves { hint: "<fixture hint text>" } -> after
//   the state settles, the rendered container contains the hint text (rendered
//   through RichText, real render) and does NOT contain the "explain this step"
//   button/control anymore for this render.
// @category: core-functionality
// @lane: integration
// @dependency: same as Test 1, RichText (real, unmocked)
// @complexity: medium
// @real-dependency: none — RichText itself is exercised for real per Mock
//   Boundary Decisions ("already covered by its own hardened-pipeline tests...
//   reused unmodified here, not re-tested" — this test only proves
//   ExplainStepAffordance routes the hint INTO RichText, not RichText's own
//   sanitize correctness).
// Primary failure mode: the hint is rendered through a competing plain-text/
//   dangerouslySetInnerHTML path instead of RichText (reopening an output-side
//   sanitization gap ADR-0002/D4 exist to close), or the button remains mounted
//   alongside the hint panel, allowing a second, redundant tutor invocation for
//   the same already-answered question.
// Proof obligation: after the mocked explainStep resolves with a fixture hint
//   string, assert the container's text content includes the fixture hint
//   string, and assert no `role="button"`-equivalent "explain this step"
//   control remains queryable within the same container.

// =============================================================================
// Test 4 — AC-021: failure path re-labels to retry, mounts a role="alert" error
// paragraph, and the rest of the page (this component's own DOM) stays
// interactive
// =============================================================================
// AC-021: "...the button shall re-label to common.retry, and a role='alert'
//   paragraph reading tutor.error shall mount below it; the rest of the result
//   page shall remain fully interactive."
// ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:7)
// Behavior: mocked explainStep resolves { error: "gemini_unavailable" } (and,
//   as a second case, mocked explainStep REJECTS/throws) -> the button's
//   accessible label changes to the retry copy, and a `role="alert"` element
//   with the generic tutor.error copy mounts; the button remains enabled/
//   focusable (never native `disabled`) so a retry activation is possible.
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the button is set to native `disabled` on error
//   (removing it from the tab order — the exact bug already fixed twice in this
//   codebase, RateButton then ActionButton, per frontend DD's own Applicable
//   Standards), permanently blocking a retry via keyboard; or the error
//   paragraph lacks `role="alert"`, so assistive technology never announces the
//   failure.
// Proof obligation: for BOTH the typed-error-resolution case and the
//   rejected-Promise case, assert an element with role="alert" is present and
//   its text content matches the generic tutor.error copy, and assert the
//   button element has no native `disabled` attribute/property set (still
//   focusable) in either failure case.

// =============================================================================
// Test 5 — AC-023/024/029: mount condition is gated solely by hasBeenWrongTwice,
// never by skill_node_id presence (untagged questions render identically)
// =============================================================================
// AC-024: "When r.hasBeenWrongTwice is false or undefined, ResultDetailPage
//   shall not mount ExplainStepAffordance for that question."
// AC-029 (UI half): "...ExplainStepAffordance shall render and function
//   identically — it is gated solely by hasBeenWrongTwice, never by skill-tag
//   presence."
// ROI: 45 (BV:6 x Freq:6 + Legal:0 + Defect:7)
// Behavior: this is a mount-condition proof, exercised at the ResultDetailPage
//   call-site level conceptually, but testable here as: ExplainStepAffordance
//   itself carries no internal gating logic on skill_node_id/hasBeenWrongTwice
//   (those fields are not part of ExplainStepAffordanceProps at all — the
//   gating happens at the CALLER, ResultDetailPage, per IP-1's own note that
//   ResultDetailPage itself has "no RTL coverage... matching the ExamCard/
//   ExamBrowser untested-Server-Component precedent"). This test instead proves
//   the COMPONENT's own behavior is independent of any skill-tag-shaped prop —
//   i.e. rendering ExplainStepAffordance with only {questionId, attemptId}
//   (its actual, minimal Props surface) functions fully, with no additional
//   prop required or consulted for a skill tag.
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1
// @complexity: low
// @real-dependency: none
// Primary failure mode: a future maintainer widens ExplainStepAffordanceProps to
//   accept a skill-tag-shaped field and conditions rendering/behavior on it,
//   silently breaking AC-029's "needs question content, not a skill tag"
//   contract for untagged questions.
// Proof obligation: render ExplainStepAffordance with only its documented
//   {questionId, attemptId} props (no additional prop) and assert the idle-state
//   button renders and is activatable, proving no other prop is required for the
//   component to function — the mount/no-mount DECISION itself (AC-023/024) is
//   ResultDetailPage's own responsibility and is out of RTL scope per IP-1,
//   verified instead by the manual Playwright pass (frontend DD Integration
//   Verification Points).

// TD-018: component under test (ExplainStepAffordance.tsx + useTutorAction.ts)
// does not exist yet — .todo keeps this suite valid (vitest gate green) while
// keeping the 5 planned tests above visible in `vitest run` output as owed.
import { describe, it } from "vitest";

describe("ExplainStepAffordance", () => {
  it.todo(
    "AC-025: busyRef synchronous double-activation guard — a second activation while busy is a no-op (at most 1 explainStep() call)",
  );
  it.todo(
    "argument-order proof: explainStep called with (attemptId, questionId), never the swapped declaration order",
  );
  it.todo(
    "AC-018/019/020 UI half + D5: hint-shown state renders the hint via RichText and removes the re-invoke control",
  );
  it.todo(
    "AC-021: failure path re-labels to retry, mounts a role=alert error paragraph, stays interactive",
  );
  it.todo(
    "AC-023/024/029: mount condition gated solely by hasBeenWrongTwice, never by skill_node_id presence",
  );
});
