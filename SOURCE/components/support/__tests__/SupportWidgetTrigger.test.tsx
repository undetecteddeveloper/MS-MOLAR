// @vitest-environment jsdom
// No I18nProvider wrapping → useT() renders the "en" default strings.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupportWidgetTrigger } from "@/components/support/SupportWidgetTrigger";

afterEach(cleanup);

describe("SupportWidgetTrigger", () => {
  it("renders a labelled button that calls onOpen on click", () => {
    const onOpen = vi.fn();
    render(<SupportWidgetTrigger onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: "Send feedback" });
    button.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("has no state of its own — purely presentational (no side effect beyond onOpen)", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<SupportWidgetTrigger onOpen={onOpen} />);
    rerender(<SupportWidgetTrigger onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
