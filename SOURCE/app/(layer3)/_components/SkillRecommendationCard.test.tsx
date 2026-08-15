// SkillRecommendationCard [integration] Test Skeleton
// Design Doc: docs/design/engine1-adaptive-ai-frontend-design.md (v1.0) §
//   Main Components (SkillRecommendationCard), § Assumed Behaviors
// UI Spec: docs/ui-spec/engine1-adaptive-ai-ui-spec.md (v1.0) — S-02/D3/D6
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-028, AC-031)
// Generated: 2026-08-08 | Budget Used: integration 2/3 (frontend sub-budget)
//
// IMPLEMENTER NOTE (unprecedented technique, flagged explicitly by the frontend
//   DD's own Assumed Behaviors / Risks tables): SkillRecommendationCard is an
//   async Server Component (no "use client", per UI Spec D2's zero-JS mandate —
//   its only interactivity is native <details>/<summary>). Render it via
//   `render(await SkillRecommendationCard({ recommendation }))`, mirroring
//   DifficultyBadge.test.tsx's render-assertion style adapted for an async
//   component. This technique has NO prior precedent in this repository's test
//   suite (ExamCard/ExamBrowser, this repo's other async Server Components, have
//   ZERO test coverage today). If this technique proves incompatible with this
//   repo's RTL/vitest/jsdom versions at implementation time (e.g. `getTranslate()`
//   internally calling a `next/headers` API that jsdom cannot satisfy), fall back
//   to manual/Playwright-only verification for this component — matching the
//   ExamCard/ExamBrowser precedent of zero RTL coverage for untested async
//   Server Components — rather than reopening UI Spec's server-component
//   decision to force testability (frontend DD § Alternative Solutions, last row).
// IMPLEMENTER NOTE: add `// @vitest-environment jsdom` as the real file's first
//   line at implementation time.
//
// Mock boundary (frontend DD Test Boundaries — Mock Boundary Decisions):
//   getSkillRecommendation — N/A for this file; the component receives
//   `recommendation` as an already-resolved prop and never imports the query
//   itself, so there is nothing to mock inside this test (DashboardPage's own
//   Promise.all wiring is verified by the manual/Playwright pass instead,
//   matching the "Server Component pages are not RTL-tested" convention).
//   BentoCell — No, real render. getTranslate() — No, real call (reads the
//   locale cookie via next/headers; if incompatible with jsdom at
//   implementation time, stub next/headers' cookies() the same way any other
//   server-only API would be stubbed in a vitest test — see Implementer Note
//   above for the broader fallback if this proves untenable).

// =============================================================================
// Test 1 — AC-031: populated state renders eyebrow, plain-text skillLabel (not
// a dictionary key), and a closed-by-default <details> disclosure
// =============================================================================
// AC-031: "...SkillRecommendationCard shall render the populated state:
//   eyebrow, the skill's Vietnamese label (plain text, not a dictionary key),
//   and a closed-by-default <details> disclosure whose <summary> reveals the
//   localized reason text mapped from reasonCode."
// ROI: 48 (BV:6 x Freq:7 + Legal:0 + Defect:6)
// Behavior: render SkillRecommendationCard with recommendation =
//   { skillLabel: "Lũy thừa", reasonCode: "lowest-mastery" } -> assert the
//   rendered output contains the literal string "Lũy thừa" VERBATIM (proving the
//   component renders the server-provided label as-is, never re-bucketing or
//   re-deriving it — mirrors DifficultyBadge's own "never re-buckets" contract),
//   the eyebrow/title text, and a <details> element that is closed by default
//   (no `open` attribute) containing a <summary>.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer3)/_components/SkillRecommendationCard.tsx +
//   real getTranslate() + real BentoCell
// @complexity: medium
// @real-dependency: none beyond getTranslate()'s own next/headers call (see
//   Implementer Note above for the fallback if this proves incompatible with
//   jsdom).
// Primary failure mode: the component re-derives or re-buckets the label (e.g.
//   applying its own formatting/truncation) instead of rendering skillLabel
//   verbatim, silently diverging from whatever the backend actually computed;
//   or the <details> element defaults to OPEN, immediately exposing the reason
//   text UI Spec intends to be a deliberate, user-initiated disclosure.
// Proof obligation: assert the rendered container's text content includes
//   "Lũy thừa" exactly; assert a <details> element exists in the container and
//   its `open` property/attribute is falsy (closed by default); assert a
//   <summary> child element exists within that <details>.

// =============================================================================
// Test 2 — AC-031: reasonCode-to-copy mapping — all three reasonCode values
// resolve to their own distinct localized reason text inside the disclosure
// =============================================================================
// ROI: 45 (BV:6 x Freq:6 + Legal:0 + Defect:6)
// Behavior: render SkillRecommendationCard three times, once per reasonCode
//   ("prerequisite-gate" | "lowest-mastery" | "recently-wrong") -> assert each
//   render's disclosure body text is DISTINCT from the other two and matches
//   the reasonCode-specific i18n key's expected literal value (analytics.
//   recommendReasonPrerequisiteGate / recommendReasonLowestMastery /
//   recommendReasonRecentlyWrong).
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1
// @complexity: low
// @real-dependency: none
// Primary failure mode: the REASON_KEY lookup table is missing a member or maps
//   two different reasonCode values to the same i18n key, silently showing the
//   student the wrong (or an identical, uninformative) explanation for why a
//   given skill was recommended.
// Proof obligation: for each of the 3 reasonCode fixture values, assert the
//   rendered disclosure body's text content equals the expected literal string
//   for THAT reasonCode's dictionary key (independently authored expected
//   values, not re-derived from the dictionary file itself), and assert the 3
//   resulting strings are pairwise distinct.

// =============================================================================
// Test 3 — AC-028: cold start renders an honest "not enough data yet" message
// — never blank, never a crash, never indistinguishable from a loading/broken
// state
// =============================================================================
// AC-028: "When getSkillRecommendation() returns null (zero mastery rows / cold
//   start), SkillRecommendationCard shall render an honest 'not enough data
//   yet' message — never a blank card, never a crash, never indistinguishable
//   from a loading/broken state."
// ROI: 48 (BV:6 x Freq:7 + Legal:0 + Defect:6)
// Behavior: render SkillRecommendationCard with recommendation = null -> the
//   component does not throw, and the rendered container contains the
//   analytics.recommendColdStart copy (a real, human-readable sentence, not an
//   empty string or a raw i18n key literal).
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1
// @complexity: low
// @real-dependency: none
// Primary failure mode: `recommendation === null` causes an unhandled property
//   access (e.g. `recommendation.skillLabel` on null) and the component throws,
//   breaking DashboardPage's render for every brand-new/cold-start user — the
//   single highest-frequency real-world case (every new signup has zero mastery
//   rows initially).
// Proof obligation: render with recommendation: null and assert no exception is
//   thrown during render; assert the rendered container's text content equals
//   (or includes) the expected cold-start copy literal, and assert the
//   populated-state-only elements (skillLabel text, <details>/<summary>
//   disclosure) are ABSENT in this render — proving the cold-start branch is a
//   genuinely different, honest render, not a partially-populated fallback.

// TD-018: component under test (SkillRecommendationCard.tsx) does not exist
// yet — .todo keeps this suite valid (vitest gate green) while keeping the 3
// planned tests above visible in `vitest run` output as owed.
import { describe, it } from "vitest";

describe("SkillRecommendationCard", () => {
  it.todo(
    "AC-031: populated state renders eyebrow, plain-text skillLabel (verbatim), closed-by-default <details>",
  );
  it.todo(
    "AC-031: reasonCode-to-copy mapping — 3 reasonCode values resolve to 3 distinct localized texts",
  );
  it.todo(
    "AC-028: cold start renders an honest 'not enough data yet' message — never throws, never blank",
  );
});
