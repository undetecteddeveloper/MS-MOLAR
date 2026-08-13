// @vitest-environment jsdom

// InternalNotesPanel — noteFormAction adapter must forward the exact
// (ticketId, noteText) pair to addTicketNoteAction (AC-027); empty state.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InternalNotesPanel } from "@/app/(admin)/admin/tickets/InternalNotesPanel";
import { addTicketNoteAction } from "@/app/(admin)/admin/tickets/actions";

vi.mock("@/app/(admin)/admin/tickets/actions", () => ({
  addTicketNoteAction: vi.fn(async () => ({ info: "ok" })),
}));
const addTicketNoteActionMock = vi.mocked(addTicketNoteAction);

beforeEach(() => {
  addTicketNoteActionMock.mockClear();
});

afterEach(cleanup);

describe("InternalNotesPanel", () => {
  it("empty notes list shows the empty-state message, form still shown", () => {
    render(<InternalNotesPanel ticketId="ticket-1" notes={[]} />);
    expect(screen.getByText("No internal notes yet.")).toBeDefined();
    expect(screen.getByPlaceholderText(/Internal note/)).toBeDefined();
  });

  it("renders existing notes with text + admin id + timestamp", () => {
    render(
      <InternalNotesPanel
        ticketId="ticket-1"
        notes={[
          { id: "n1", noteText: "reproduced on Safari", adminId: "admin-1", createdAt: "2026-08-13T10:00:00.000Z" },
        ]}
      />
    );
    expect(screen.getByText("reproduced on Safari")).toBeDefined();
  });

  it("submitting a note forwards the exact (ticketId, noteText) pair to addTicketNoteAction", async () => {
    render(<InternalNotesPanel ticketId="ticket-42" notes={[]} />);
    const textarea = screen.getByPlaceholderText(/Internal note/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "a fresh note" } });

    await act(async () => {
      screen.getByRole("button", { name: /Save note|working/i }).click();
      await Promise.resolve();
    });

    expect(addTicketNoteActionMock).toHaveBeenCalledWith("ticket-42", "a fresh note");
  });
});
