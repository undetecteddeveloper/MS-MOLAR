// @vitest-environment jsdom

// SkillRecommendationCard [integration]
// Design Doc: docs/design/engine1-adaptive-ai-frontend-design.md (v1.0) §
//   Main Components (SkillRecommendationCard), § Assumed Behaviors
// UI Spec: docs/ui-spec/engine1-adaptive-ai-ui-spec.md (v1.0) — S-02/D3/D6
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-028, AC-031)
//
// Async Server Component render technique (no prior precedent in this repo's
// suite — ExamCard/ExamBrowser have zero coverage): `render(await
// SkillRecommendationCard({ recommendation }))`, mirroring DifficultyBadge's
// render-assertion style. Probed on a minimal case before this suite was
// written; it works under React 19 / RTL 16 / vitest 4 / jsdom once the two
// server-runtime imports below are stubbed, so the documented
// manual/Playwright-only fallback was NOT needed.
//
// Mock boundary (frontend DD Test Boundaries — Mock Boundary Decisions):
//   getSkillRecommendation — N/A; the component receives `recommendation` as an
//   already-resolved prop and never imports the query (DashboardPage's own
//   Promise.all wiring is verified by the manual/Playwright pass instead).
//   BentoCell — No, real render. getTranslate() — No, real call, so the
//   assertions below run against the REAL dictionary; only the two things it
//   needs from the Next server runtime are stubbed: the `server-only` marker
//   (established precedent, getSkillRecommendation.int.test.ts:27) and
//   next/headers' `cookies()`, which throws outside a request scope
//   (established precedent, tickets/__tests__/actions.int.test.ts:86). Absent
//   cookie => DEFAULT_LOCALE ("en"), so the expected copy below is English.
//
//   This repo's vitest.config.ts wires no @testing-library/jest-dom setup file,
//   so this file reads raw DOM properties/attributes directly, and render() does
//   not auto-cleanup between tests — every query is scoped to its own render()'s
//   `container` (ActionButton.test.tsx / ExplainStepAffordance.test.tsx
//   precedent).
//
// Generated: 2026-08-08 | Budget Used: integration 2/3 (frontend sub-budget)

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SkillRecommendation } from "@/types/adaptive";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { SkillRecommendationCard } from "@/features/analytics/components/SkillRecommendationCard";

// Expected copy authored here independently of the dictionary file, so a silent
// edit to en.ts fails these tests instead of being re-derived into agreement.
const EYEBROW = "What to practise next"; // analytics.recommendTitle (en)
const WHY_LABEL = "Why this skill?"; // analytics.recommendWhy (en)
const COLD_START =
  "Not enough data yet — practise a Math exam to get your first recommendation."; // analytics.recommendColdStart (en)
const REASON_COPY = {
  "prerequisite-gate": "A skill you haven't mastered yet comes before this one.",
  "lowest-mastery": "This is the skill you're weakest at right now.",
  "recently-wrong": "You got this one wrong recently.",
} as const;

const SKILL_LABEL = "Lũy thừa"; // curriculum content, never routed through i18n

describe("SkillRecommendationCard", () => {
  // ===========================================================================
  // Test 1 — AC-031: populated state renders eyebrow, plain-text skillLabel
  // (verbatim, never re-derived/re-bucketed), and a closed-by-default <details>
  // ===========================================================================
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
  // @dependency: SOURCE/features/analytics/components/SkillRecommendationCard.tsx +
  //   real getTranslate() + real BentoCell
  // @complexity: medium
  // @real-dependency: none beyond getTranslate()'s own next/headers call
  // Primary failure mode: the component re-derives or re-buckets the label
  // instead of rendering skillLabel verbatim, silently diverging from whatever
  // the backend computed; or <details> defaults to OPEN, immediately exposing
  // reason text the UI Spec intends to be a deliberate, user-initiated
  // disclosure.
  it("AC-031: populated state renders eyebrow, plain-text skillLabel (verbatim), closed-by-default <details>", async () => {
    const recommendation: SkillRecommendation = {
      skillLabel: SKILL_LABEL,
      reasonCode: "lowest-mastery",
    };

    const { container } = render(await SkillRecommendationCard({ recommendation }));

    expect(container.textContent).toContain(SKILL_LABEL);
    expect(container.textContent).toContain(EYEBROW);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    // Closed by default: neither the `open` property nor the attribute is set.
    expect(details?.open).toBe(false);
    expect(details?.hasAttribute("open")).toBe(false);

    const summary = details?.querySelector("summary");
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain(WHY_LABEL);
  });

  // ===========================================================================
  // Test 2 — AC-031: all three reasonCode values resolve to their own distinct
  // localized reason text inside the disclosure
  // ===========================================================================
  // ROI: 45 (BV:6 x Freq:6 + Legal:0 + Defect:6)
  // Behavior: render SkillRecommendationCard three times, once per reasonCode
  //   ("prerequisite-gate" | "lowest-mastery" | "recently-wrong") -> assert each
  //   render's disclosure body text is DISTINCT from the other two and matches
  //   the reasonCode-specific i18n key's expected literal value.
  // @category: edge-case
  // @lane: integration
  // @dependency: same as Test 1
  // @complexity: low
  // @real-dependency: none
  // Primary failure mode: the REASON_KEY lookup is missing a member or maps two
  // different reasonCode values to the same i18n key, silently showing the
  // student the wrong (or an identical, uninformative) explanation.
  it("AC-031: reasonCode-to-copy mapping — 3 reasonCode values resolve to 3 distinct localized texts", async () => {
    const rendered: string[] = [];

    for (const reasonCode of ["prerequisite-gate", "lowest-mastery", "recently-wrong"] as const) {
      const { container } = render(
        await SkillRecommendationCard({ recommendation: { skillLabel: SKILL_LABEL, reasonCode } })
      );

      const details = container.querySelector("details");
      const summaryText = details?.querySelector("summary")?.textContent ?? "";
      // Disclosure body = the <details> text minus its <summary> label.
      const bodyText = (details?.textContent ?? "").replace(summaryText, "").trim();

      expect(bodyText).toBe(REASON_COPY[reasonCode]);
      rendered.push(bodyText);
    }

    expect(new Set(rendered).size).toBe(3);
  });

  // ===========================================================================
  // Test 3 — AC-028: cold start renders an honest "not enough data yet" message
  // — never blank, never a crash, never a partially-populated fallback
  // ===========================================================================
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
  // access and the component throws, breaking DashboardPage's render for every
  // brand-new/cold-start user — the single highest-frequency real-world case.
  it("AC-028: cold start renders an honest 'not enough data yet' message — never throws, never blank", async () => {
    const element = await SkillRecommendationCard({ recommendation: null });
    const { container } = render(element);

    expect(container.textContent).toContain(COLD_START);
    expect(container.textContent).toContain(EYEBROW);

    // Populated-only elements are absent: this is a genuinely different render,
    // not a partially-populated fallback.
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
    expect(container.textContent).not.toContain(SKILL_LABEL);
    expect(container.textContent).not.toContain(WHY_LABEL);
  });
});
