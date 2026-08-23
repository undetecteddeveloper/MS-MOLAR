// @vitest-environment jsdom

// AttemptPdfTemplate — Binding Decisions (history-work-plan-task-08.md):
//  - ADR-0009 (§ Implementation Guidance): this component's styles must resolve
//    exclusively to plain hex/rgb(a) — no components/ui/button.tsx composition,
//    no Tailwind slash-opacity/color-mix utility, anywhere in this subtree.
// Proof Obligations (AC-006, AC-008): guard test proves the styling constraint
// at the jsdom/inline-style level via a real render (no mock boundary) plus a
// source-text inspection for `className`; full html2canvas rasterization proof
// is Task 11's Early Verification Point, not this test's.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttemptPdfTemplate, type AttemptPdfTemplateProps } from "./AttemptPdfTemplate";

const SOURCE_PATH = join(process.cwd(), "components/pdf/AttemptPdfTemplate.tsx");
const SOURCE_TEXT = readFileSync(SOURCE_PATH, "utf-8");

const BASE_PROPS: AttemptPdfTemplateProps = {
  subject: "Math",
  examTitle: "Mock Exam #3",
  totalScore: 8.5,
  examineeName: "Nguyen Phat",
  submittedDateLabel: "12/07/2026",
  submittedTimeLabel: "09:00",
  correct: 8,
  total: 10,
};

describe("AttemptPdfTemplate", () => {
  it("renders with all required fields", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} />);

    expect(container.textContent).toContain("Math");
    expect(container.textContent).toContain("Mock Exam #3");
    expect(container.textContent).toContain("8.5");
    expect(container.textContent).toContain("/10");
    expect(container.textContent).toContain("Nguyen Phat");
    expect(container.textContent).toContain("12/07/2026");
    expect(container.textContent).toContain("09:00");
    // correct=8, total=10 → wrong=2, computed internally (not a caller prop).
    expect(container.textContent).toContain("8");
    expect(container.textContent).toContain("2");
  });

  it("formats totalScore internally via toFixed(1), not pre-formatted by the caller", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} totalScore={10} />);
    expect(container.textContent).toContain("10.0");
  });

  it("plain-hex/rgb guard (ADR-0009): rendered inline styles never resolve through oklch()/color-mix(), and the source has zero className attributes", () => {
    const { container } = render(<AttemptPdfTemplate {...BASE_PROPS} />);

    // Real-render inline-style output — no mock boundary (per Proof Obligations).
    const renderedHtml = container.innerHTML;
    expect(renderedHtml).not.toContain("oklch(");
    expect(renderedHtml).not.toContain("color-mix(");

    // Source-text inspection — the component must never carry a `className`
    // attribute (Tailwind class or otherwise) anywhere in its subtree. Matches
    // only the JSX attribute form (`className=`), not the word appearing in
    // this file's own prose comments documenting the constraint.
    expect(SOURCE_TEXT).not.toMatch(/className=/);

    // ADR-0009's confirmed-unsafe pattern from components/ui/button.tsx must
    // never be imported into or reproduced within this component.
    expect(SOURCE_TEXT).not.toMatch(/from ["']@\/components\/ui\/button["']/);
    expect(SOURCE_TEXT).not.toContain("color-mix(");
    expect(SOURCE_TEXT).not.toContain("oklch(");
  });

  it("structural AC-006 guard: AttemptPdfTemplateProps has no field capable of carrying per-question content", () => {
    // Fixed, exhaustive key list mirroring the frontend DD's Data Contract
    // (`docs/design/history-frontend-design.md` § Data Contracts). A future
    // prop addition (e.g. `questions`/`answers`) changes this set and fails
    // this assertion, forcing a conscious review against AC-006.
    const props: AttemptPdfTemplateProps = BASE_PROPS;
    expect(Object.keys(props).sort()).toEqual(
      [
        "correct",
        "examTitle",
        "examineeName",
        "subject",
        "submittedDateLabel",
        "submittedTimeLabel",
        "total",
        "totalScore",
      ].sort()
    );
  });

  it("never mounts components/ui/button.tsx (ADR-0009 — confirmed-unsafe color-mix hover state)", () => {
    expect(SOURCE_TEXT).not.toMatch(/import\s+.*Button.*from/);
  });
});
