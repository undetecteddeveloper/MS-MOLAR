// @vitest-environment jsdom

// TicketStatusControl — statusFormAction adapter must forward the exact
// (ticketId, status) pair extracted from FormData to changeTicketStatusAction
// (Boundary Context roundtrip check, AC-023).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketStatusControl } from "@/app/(admin)/admin/tickets/TicketStatusControl";
import { changeTicketStatusAction } from "@/app/(admin)/admin/tickets/actions";

vi.mock("@/app/(admin)/admin/tickets/actions", () => ({
  changeTicketStatusAction: vi.fn(async () => ({ info: "ok" })),
}));
const changeTicketStatusActionMock = vi.mocked(changeTicketStatusAction);

beforeEach(() => {
  changeTicketStatusActionMock.mockClear();
});

afterEach(cleanup);

describe("TicketStatusControl", () => {
  it("submitting a new status forwards the exact (ticketId, status) pair to changeTicketStatusAction", async () => {
    render(<TicketStatusControl ticketId="ticket-42" status="new" />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "resolved" } });

    await act(async () => {
      screen.getByRole("button", { name: /Save|working/i }).click();
      await Promise.resolve();
    });

    expect(changeTicketStatusActionMock).toHaveBeenCalledWith("ticket-42", "resolved");
  });

  it("renders all three status options, showing the ticket's current status selected", () => {
    render(<TicketStatusControl ticketId="ticket-1" status="in_progress" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("in_progress");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });
});
