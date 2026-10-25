// @vitest-environment jsdom

// TicketDetailPanel — quan trọng về bảo mật: message/URL/user-agent render dưới dạng
// chữ vô hại (R12/AC-037/AC-038), ảnh chụp màn hình chỉ render qua
// <img src> thuần (AC-014, đóng phát hiện review tài liệu I002).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketDetailPanel } from "@/features/admin/components/tickets/TicketDetailPanel";
import type { TicketWithNotes } from "@/lib/supabase/service-role";

// TicketStatusControl/InternalNotesPanel import Server Action từ "./actions"
// (một module "use server" kéo theo các phụ thuộc server-only) — được mock
// đi, theo ranh giới đã thiết lập của repo này cho test component mà mối quan tâm
// là render, không phải hành vi của chính action (tiền lệ task-06/09).
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

    // Các ký tự nguyên văn xuất hiện dưới dạng nội dung TEXT...
    expect(container.textContent).toContain(xss);
    // ...và không có phần tử <script> thật hay <img> mang onerror được chèn
    // nào được tạo ở bất kỳ đâu trong cây đã render.
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
