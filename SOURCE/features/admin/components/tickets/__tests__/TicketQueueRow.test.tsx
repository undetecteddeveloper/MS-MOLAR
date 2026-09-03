// @vitest-environment jsdom

// TicketQueueRow — collapsed summary always visible; NotificationFailureFlag
// visible WITHOUT expanding (AC-022 UI half, AC-032); expand reveals
// TicketDetailPanel; collapse state is local, not persisted.

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketQueueRow } from "@/features/admin/components/tickets/TicketQueueRow";
import type { TicketWithNotes } from "@/lib/supabase/service-role";

vi.mock("@/features/admin/ticketActions", () => ({
  changeTicketStatusAction: vi.fn(),
  addTicketNoteAction: vi.fn(),
}));

afterEach(cleanup);

function fixtureTicket(overrides: Partial<TicketWithNotes> = {}): TicketWithNotes {
  return {
    id: "ticket-1",
    intent: "bug",
    message: "the button freezes",
    pageUrl: null,
    userAgent: null,
    screenWidth: null,
    screenHeight: null,
    screenshotUrl: null,
    status: "new",
    notifyFailed: false,
    createdAt: "2026-08-13T10:00:00.000Z",
    firstStatusTransitionAt: null,
    notes: [],
    ...overrides,
  };
}

describe("TicketQueueRow", () => {
  it("collapsed by default: TicketDetailPanel is not rendered", () => {
    render(<TicketQueueRow ticket={fixtureTicket()} />);
    expect(screen.queryByRole("combobox")).toBeNull(); // TicketStatusControl's <select> only exists when expanded
  });

  it("notify_failed flag is visible in the collapsed row WITHOUT expanding (AC-022, AC-032)", () => {
    render(<TicketQueueRow ticket={fixtureTicket({ notifyFailed: true })} />);
    expect(screen.getByText("Notification email failed")).toBeDefined();
  });

  it("no notify_failed flag when the ticket's notification succeeded", () => {
    render(<TicketQueueRow ticket={fixtureTicket({ notifyFailed: false })} />);
    expect(screen.queryByText("Notification email failed")).toBeNull();
  });

  it("clicking the row expands it, revealing TicketDetailPanel's status control", () => {
    render(<TicketQueueRow ticket={fixtureTicket()} />);
    act(() => {
      screen.getByRole("button", { name: /the button freezes/ }).click();
    });
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("collapsed row always shows intent, message excerpt, status badge, created time", () => {
    render(<TicketQueueRow ticket={fixtureTicket()} />);
    expect(screen.getByText("Bug report")).toBeDefined();
    expect(screen.getByText("the button freezes")).toBeDefined();
    expect(screen.getByText("New")).toBeDefined();
  });
});
