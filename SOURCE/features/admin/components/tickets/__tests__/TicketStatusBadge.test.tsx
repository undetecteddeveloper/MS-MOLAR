// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TicketStatusBadge } from "@/features/admin/components/tickets/TicketStatusBadge";
import type { TicketStatus } from "@/lib/support/types";

afterEach(cleanup);

describe("TicketStatusBadge", () => {
  it("renders a distinct glyph + distinct label per status, never color alone (AC-042)", () => {
    const statuses: TicketStatus[] = ["new", "in_progress", "resolved"];
    const rendered: Array<{ glyph: string; label: string }> = [];

    for (const status of statuses) {
      const { container, unmount } = render(<TicketStatusBadge status={status} />);
      const glyph = container.querySelector("[aria-hidden]")?.textContent ?? "";
      const label = container.textContent?.replace(glyph, "").trim() ?? "";
      rendered.push({ glyph, label });
      unmount();
    }

    const glyphs = rendered.map((r) => r.glyph);
    const labels = rendered.map((r) => r.label);
    expect(new Set(glyphs).size).toBe(3);
    expect(new Set(labels).size).toBe(3);
  });

  it("uses distinct glyphs from (authoring)/StatusBadge's own set (◌/◑/○/●/▲)", () => {
    const otherGlyphs = new Set(["◌", "◑", "○", "●", "▲"]);
    for (const status of ["new", "in_progress", "resolved"] as const) {
      const { container, unmount } = render(<TicketStatusBadge status={status} />);
      const glyph = container.querySelector("[aria-hidden]")?.textContent ?? "";
      expect(otherGlyphs.has(glyph)).toBe(false);
      unmount();
    }
  });

  it("falls back to the 'new' entry for an unrecognized status instead of rendering blank", () => {
    render(<TicketStatusBadge status={"weird" as unknown as TicketStatus} />);
    expect(screen.getByText("New")).toBeDefined();
  });
});
