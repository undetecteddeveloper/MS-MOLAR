// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketQueueList } from "@/app/(admin)/admin/tickets/TicketQueueList";
import type { TicketWithNotes } from "@/lib/supabase/service-role";

vi.mock("@/app/(admin)/admin/tickets/actions", () => ({
  changeTicketStatusAction: vi.fn(),
  addTicketNoteAction: vi.fn(),
}));

afterEach(cleanup);

function fixtureTicket(overrides: Partial<TicketWithNotes> = {}): TicketWithNotes {
  return {
    id: "ticket-1",
    intent: "bug",
    message: "hello",
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

describe("TicketQueueList", () => {
  it("empty array renders the documented empty-state message (empty input Failure Mode)", () => {
    render(<TicketQueueList tickets={[]} />);
    expect(screen.getByText("No feedback yet.")).toBeDefined();
  });

  it("non-empty array renders one row per ticket", () => {
    render(
      <TicketQueueList
        tickets={[fixtureTicket({ id: "t1" }), fixtureTicket({ id: "t2", message: "second" })]}
      />
    );
    expect(screen.getByText("hello")).toBeDefined();
    expect(screen.getByText("second")).toBeDefined();
  });
});
