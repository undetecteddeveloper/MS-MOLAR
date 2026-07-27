// @vitest-environment jsdom

// ScoreScale — roving tabindex, Arrow/Home/End/Space/Enter, aria-checked, no
// out-of-range value representable (AC-002/024). Harness owns the value state
// (parent-controlled component, matching ScoreScaleProps.value/onChange).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { PartScore } from "@/lib/rating";
import { ScoreScale } from "./ScoreScale";

afterEach(cleanup);

function Harness({ initial }: { initial?: PartScore }) {
  const [value, setValue] = useState<PartScore | undefined>(initial);
  return (
    <>
      <span id="scale-label">Rate difficulty</span>
      <ScoreScale value={value} onChange={setValue} labelledBy="scale-label" />
    </>
  );
}

describe("ScoreScale", () => {
  it("renders exactly ten radios labelled 1..10 in order — no out-of-range value representable", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(10);
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1))
    );
  });

  it("container is a radiogroup labelled by the given labelledBy id", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("aria-labelledby")).toBe("scale-label");
  });

  it("default: none checked, roving tabindex sits on circle 1 (group entered at the start)", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    radios.forEach((r) => expect(r.getAttribute("aria-checked")).toBe("false"));
    expect(radios[0].tabIndex).toBe(0);
    radios.slice(1).forEach((r) => expect(r.tabIndex).toBe(-1));
  });

  it("prefilled value: that circle is checked and holds the roving tabindex", () => {
    render(<Harness initial={7 as PartScore} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[6].getAttribute("aria-checked")).toBe("true");
    expect(radios[6].tabIndex).toBe(0);
    radios.forEach((r, i) => {
      if (i !== 6) expect(r.tabIndex).toBe(-1);
    });
  });

  it("ArrowRight moves selection to the next circle — checked follows focus", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowRight" });
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].tabIndex).toBe(0);
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
    expect(radios[0].tabIndex).toBe(-1);
    expect(document.activeElement).toBe(radios[1]);
  });

  it("ArrowDown behaves like ArrowRight", () => {
    render(<Harness initial={2 as PartScore} />);
    const radios = screen.getAllByRole("radio");
    radios[1].focus();
    fireEvent.keyDown(radios[1], { key: "ArrowDown" });
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowRight wraps from circle 10 to circle 1", () => {
    render(<Harness initial={10 as PartScore} />);
    const radios = screen.getAllByRole("radio");
    radios[9].focus();
    fireEvent.keyDown(radios[9], { key: "ArrowRight" });
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
  });

  it("ArrowLeft/ArrowUp moves to the previous circle and wraps from 1 to 10", () => {
    render(<Harness initial={1 as PartScore} />);
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowLeft" });
    expect(radios[9].getAttribute("aria-checked")).toBe("true");
  });

  it("Home selects circle 1, End selects circle 10", () => {
    render(<Harness initial={5 as PartScore} />);
    const radios = screen.getAllByRole("radio");
    radios[4].focus();
    fireEvent.keyDown(radios[4], { key: "End" });
    expect(radios[9].getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(radios[9], { key: "Home" });
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
  });

  it("Space selects the focused (unchecked) circle", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    radios[2].focus();
    fireEvent.keyDown(radios[2], { key: " " });
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
  });

  it("Enter selects the focused (unchecked) circle", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    radios[8].focus();
    fireEvent.keyDown(radios[8], { key: "Enter" });
    expect(radios[8].getAttribute("aria-checked")).toBe("true");
  });

  it("clicking a circle selects it directly", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[5]);
    expect(radios[5].getAttribute("aria-checked")).toBe("true");
  });
});
