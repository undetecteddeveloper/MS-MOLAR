// User Support System v1 — dữ liệu fixture admin-triage + cơ chế
// override-boundary, dùng lại mẫu SupportDriver của task-07 (supportFixtureData.ts).
// Được support-admin-triage.fixture.e2e.test.ts (task-15) tiêu thụ.
//
// Cùng phần dư đã tài liệu hoá như supportFixtureData.ts: repo này không có lớp MSW/
// tiêm mock, nên nối dữ liệu fixture listSupportTickets/changeTicketStatusAction/
// addTicketNoteAction vào một trang đang chạy thật là phần dư cho
// ai dựng harness Playwright — Mock Boundary Decision của chính frontend DD
// ("Yes (module boundary)") nêu cùng điểm ghi đè ở ranh giới module chỉ-cho-test
// mà file này tài liệu hoá.
//
// TicketWithNotes ở đây là hình dạng hợp đồng đã chép của task-13
// (kiểu trả về listSupportTickets của support-system-backend-design.md) — sẽ
// được đối chiếu với kiểu export thật từ service-role.ts khi task-13
// tồn tại (lỗi biên dịch tsc là chế độ hỏng an toàn, dự kiến khi lệch,
// theo ghi chú R-F2 của chính frontend DD).

import type { TicketIntent, TicketStatus } from "@/lib/support/types";
import type { SupportDriver } from "./supportFixtureData";

export interface FixtureTicketNote {
  id: string;
  noteText: string;
  adminId: string | null;
  createdAt: string;
}

export interface FixtureTicketWithNotes {
  id: string;
  intent: TicketIntent;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  screenshotUrl: string | null;
  status: TicketStatus;
  notifyFailed: boolean;
  createdAt: string;
  firstStatusTransitionAt: string | null;
  notes: FixtureTicketNote[];
}

// Bộ nhiều-trạng-thái, mới-nhất-trước (AC-041 kỳ vọng created_at giảm dần từ
// backend thật — fixture này đã theo thứ tự đó nên một phép kiểm "không có
// sắp xếp lại" ở mức driver so sánh trực tiếp được với thứ tự mảng).
// Ticket A mang notify_failed=true (cờ hàng thu gọn AC-022/AC-032,
// nhìn thấy không cần mở rộng) và một ghi chú nội bộ; B/C thao tác hai
// trạng thái còn lại; D không có ghi chú (kiểm trạng thái rỗng, đối chiếu AC-027).
export const FIXTURE_ADMIN_TICKETS: readonly FixtureTicketWithNotes[] = [
  {
    id: "ticket-a-notify-failed",
    intent: "bug",
    message: "The submit button freezes on iPhone Safari.",
    pageUrl: "https://example.com/exams/abc/attempt/xyz",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    screenWidth: 390,
    screenHeight: 844,
    screenshotUrl: "https://fixture.example.com/signed/ticket-a.png",
    status: "in_progress",
    notifyFailed: true,
    createdAt: "2026-08-13T09:00:00.000Z",
    firstStatusTransitionAt: "2026-08-13T09:15:00.000Z",
    notes: [
      {
        id: "note-a-1",
        noteText: "Reproduced on Safari 17 — investigating.",
        adminId: "admin-1",
        createdAt: "2026-08-13T09:20:00.000Z",
      },
    ],
  },
  {
    id: "ticket-b-new",
    intent: "suggestion",
    message: "Would love a dark mode toggle for late-night study sessions.",
    pageUrl: "https://example.com/exams",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    screenWidth: 1920,
    screenHeight: 1080,
    screenshotUrl: null,
    status: "new",
    notifyFailed: false,
    createdAt: "2026-08-13T08:00:00.000Z",
    firstStatusTransitionAt: null,
    notes: [],
  },
  {
    id: "ticket-c-resolved",
    intent: "question",
    message: "How is the difficulty rating calculated?",
    pageUrl: "https://example.com/exams/def",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    screenWidth: 1440,
    screenHeight: 900,
    screenshotUrl: null,
    status: "resolved",
    notifyFailed: false,
    createdAt: "2026-08-12T14:00:00.000Z",
    firstStatusTransitionAt: "2026-08-12T14:30:00.000Z",
    notes: [
      {
        id: "note-c-1",
        noteText: "Explained via email, closing.",
        adminId: "admin-2",
        createdAt: "2026-08-12T14:30:00.000Z",
      },
    ],
  },
  {
    id: "ticket-d-no-notes",
    intent: "bug",
    message: "Screenshot upload spins forever on slow connections.",
    pageUrl: null,
    userAgent: null,
    screenWidth: null,
    screenHeight: null,
    screenshotUrl: null,
    status: "new",
    notifyFailed: false,
    createdAt: "2026-08-11T10:00:00.000Z",
    firstStatusTransitionAt: null,
    notes: [],
  },
];

export const FIXTURE_STATUS_CHANGE_SUCCESS = { info: "Status updated." };
export const FIXTURE_NOTE_ADD_SUCCESS = { info: "Note saved." };
export const FIXTURE_STATUS_CHANGE_ERROR = { error: "Couldn't update status. Please try again." };
export const FIXTURE_NOTE_ADD_ERROR = { error: "Couldn't save the note. Please try again." };

/** Tập con cấu trúc được export lại cho script driver của task-15 — cùng
 *  interface với SupportDriver hướng học sinh (cùng quy ước tập-con-Playwright),
 *  import ở đây dưới tên riêng cho rõ ở trang admin. */
export type { SupportDriver as SupportAdminDriver };
