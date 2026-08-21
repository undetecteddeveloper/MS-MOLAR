// @vitest-environment jsdom

// IntentSelector — đúng 3 lựa chọn, không có lựa chọn thứ 4 (AC-001).
// No I18nProvider wrapping → useT() renders the "en" default strings.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntentSelector } from "@/components/support/IntentSelector";

afterEach(cleanup);

describe("IntentSelector", () => {
  it("renders exactly 3 role=radio options, no 4th option anywhere in markup", () => {
    render(<IntentSelector value={null} onChange={() => {}} error={null} disabled={false} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Bug report" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Suggestion" })).toBeDefined();
    expect(screen.getByRole("radio", { name: "Question" })).toBeDefined();
  });

  it("none pre-selected by default (Default state == Empty state, no separate affordance)", () => {
    render(<IntentSelector value={null} onChange={() => {}} error={null} disabled={false} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.getAttribute("aria-checked")).toBe("false");
    }
  });

  it("selecting an option calls onChange with that intent and marks it checked", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <IntentSelector value={null} onChange={onChange} error={null} disabled={false} />
    );
    screen.getByRole("radio", { name: "Suggestion" }).click();
    expect(onChange).toHaveBeenCalledWith("suggestion");

    rerender(<IntentSelector value="suggestion" onChange={onChange} error={null} disabled={false} />);
    expect(screen.getByRole("radio", { name: "Suggestion" }).getAttribute("aria-checked")).toBe("true");
  });

  it("a click while disabled does not call onChange (no-op guard)", () => {
    const onChange = vi.fn();
    render(<IntentSelector value={null} onChange={onChange} error={null} disabled={true} />);
    screen.getByRole("radio", { name: "Bug report" }).click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the validation error as role=alert, linked via aria-describedby", () => {
    render(
      <IntentSelector
        value={null}
        onChange={() => {}}
        error="Please pick a feedback type."
        disabled={false}
      />
    );
    expect(screen.getByRole("alert").textContent).toBe("Please pick a feedback type.");
    const group = screen.getByRole("radiogroup");
    expect(group.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  });
});
