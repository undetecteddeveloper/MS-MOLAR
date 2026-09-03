// @vitest-environment jsdom

// TicketDetailPanel — security-critical: message/URL/user-agent render as
// inert text (R12/AC-037/AC-038), screenshot renders exclusively via a plain
// <img src> (AC-014, closes document review finding I002).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketDetailPanel } from "@/features/admin/components/tickets/TicketDetailPanel";
import type { TicketWithNotes } from "@/lib/supabase/service-role";

// TicketStatusControl/InternalNotesPanel import Server Actions from "./actions"
// (a "use server" module transitively pulling in server-only deps) — mocked
// away, matching this repo's established boundary for component tests whose
// concern is rendering, not the action's own behavior (task-06/09 precedent).
vi.mock("@/features/admin/ticketActions", () => ({
  changeTicketStatusAction: vi.fn(),
  addTicketNoteAction: vi.fn(),
}));

afterEach(cleanup);

function fixtureTicket(overrides: Partial<TicketWithNotes> = {}): TicketWithNotes {
  return {
    id: "ticket-1",
    intent: "bug",
    message: "plain message",
    pageUrl: "https://example.com/exams/abc",
    userAgent: "Mozilla/5.0",
    screenWidth: 390,
    screenHeight: 844,
    screenshotUrl: null,
    status: "new",
    notifyFailed: false,
    createdAt: "2026-08-13T10:00:00.000Z",
    firstStatusTransitionAt: null,
    notes: [],
    ...overrides,
  };
}

describe("TicketDetailPanel", () => {
  it("renders a <script>-shaped message as inert text, never interpreted as markup (AC-037)", () => {
    const xss = '<script>alert(1)</script><img src=x onerror="alert(2)">';
    const { container } = render(<TicketDetailPanel ticket={fixtureTicket({ message: xss })} />);

    // The literal characters appear as TEXT content...
    expect(container.textContent).toContain(xss);
    // ...and no actual <script> element or an injected onerror-bearing <img>
    // was created anywhere in the rendered tree.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img[onerror]")).toBeNull();
  });

  it("renders pageUrl/userAgent as plain text, URL never becomes a clickable <a> (AC-038)", () => {
    const { container } = render(
      <TicketDetailPanel
        ticket={fixtureTicket({ pageUrl: "https://evil.example.com/x", userAgent: "<b>bold</b>" })}
      />
    );
    expect(container.textContent).toContain("https://evil.example.com/x");
    expect(container.textContent).toContain("<b>bold</b>");
    expect(container.querySelector("a[href='https://evil.example.com/x']")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("with no screenshotUrl, renders no <img> element at all", () => {
    render(<TicketDetailPanel ticket={fixtureTicket({ screenshotUrl: null })} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("with a screenshotUrl, renders it exclusively via a plain <img src> bound to the signed URL verbatim (AC-014)", () => {
    const signedUrl = "https://fixture.supabase.co/storage/v1/object/sign/support-screenshots/x.png?token=abc";
    render(<TicketDetailPanel ticket={fixtureTicket({ screenshotUrl: signedUrl })} />);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe(signedUrl);
  });
});
