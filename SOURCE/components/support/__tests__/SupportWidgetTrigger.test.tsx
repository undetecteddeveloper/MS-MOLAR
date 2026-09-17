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
    const button = screen.getByRole("button", { name: "Gửi phản hồi" });
    button.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("has no state of its own — purely presentational (no side effect beyond onOpen)", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<SupportWidgetTrigger onOpen={onOpen} />);
    rerender(<SupportWidgetTrigger onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
  });

  // UI-D28: the trigger (z-45) hides while a FilterSheet (`data-filter-sheet`)
  // or an OverlaySheet (`data-app-overlay`) is open. jsdom does not build
  // Tailwind's CSS, so `display: none` cannot be measured here; what can be
  // proven is that the `:has()` variant class for each marker sits on the
  // button — without that class Tailwind emits no rule and the trigger stays
  // visible over the overlay.
  it.each([
    ["data-filter-sheet", "FilterSheet"],
    ["data-app-overlay", "OverlaySheet"],
  ])("carries the [body:has([%s])_&]:hidden class (%s)", (marker) => {
    render(<SupportWidgetTrigger onOpen={() => {}} />);
    const button = screen.getByRole("button", { name: "Gửi phản hồi" });
    expect(button.className.split(/\s+/)).toContain(`[body:has([${marker}])_&]:hidden`);
  });
});
