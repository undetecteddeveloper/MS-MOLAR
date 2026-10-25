// User Support System v1 — dữ liệu fixture + interface Driver cho hai
// skeleton fixture-e2e của hệ thống hỗ trợ (support-widget-visibility.fixture.e2e.test.ts,
// support-ticket-submission.fixture.e2e.test.ts).
//
// Repo này không có phụ thuộc `@playwright/test` và không có `playwright.config.ts`
// được commit (chỉ máy chủ tự động hoá trình duyệt Playwright MCP được cấu hình
// cho các phiên tương tác/thủ công) và không có lớp mock request/route (không MSW,
// không ghi đè truy vấn chế độ test). Nối dữ liệu fixture `submitSupportTicket`/`getCurrentUser`
// vào một trang đang chạy thật vì vậy là một PHẦN DƯ đã tài liệu hoá,
// giống hệt `rating.fixture.e2e.test.ts`/`history.fixture.e2e.test.ts`
// đã ghi cho các khoảng trống backend-fixture của chính chúng — không phải một chặn riêng của
// task này. Cơ chế mà repo này đã chốt (Mock
// Boundary Decision của chính frontend DD: "submitSupportTicket ... Yes (module boundary)") là một
// điểm ghi đè ranh giới module chỉ-cho-test mà task-09 (SupportWidget) được
// yêu cầu tôn trọng khi nối widget với action thật — ví dụ import
// `submitSupportTicket` qua một binding export lại mà module fixture này có thể
// ghi đè trong phiên Playwright MCP qua `page.route`/alias module, hoặc một
// prop tiêm phụ thuộc luồn xuống `SupportWidgetDialog`. Ghi quyết định
// ở đây (tương đương Investigation Notes) thay vì phát minh một giải pháp kiểu MSW
// vượt quá quy ước đã thiết lập của repo này.
//
// SupportDriver là một tập CON cấu trúc của API `Page`/`Locator` thật của Playwright
// (`goto`, `url`, `getByRole`, `getByLabelText`, `getByText`, `.click`,
// `.fill`, `.setInputFiles`, `.getAttribute`, `.first`, `.count`,
// `.textContent`, cộng `.boundingBox`/`setViewportSize` cho yêu cầu bố cục thật của
// Nghĩa vụ C) — một `Page` Playwright thật thoả interface này
// nguyên trạng, khớp đúng tiền lệ FE2Driver/HistoryDriver.

import type { SubmitTicketResult, TicketIntent } from "@/lib/support/types";

// --- Fixture user / routes --------------------------------------------------

export const FIXTURE_USER = { id: "support-fixture-user-1", email: "fixture-support@example.com" };

/** Bất kỳ route mount thật không phải route làm bài (UI-D1) — widget render ở đây khi đã đăng nhập. */
export const FIXTURE_MOUNTED_ROUTE = "/exams";

/** Hình dạng route làm bài `(exams)` — widget phải vắng mặt theo cấu trúc (AC-005, D1). */
export const FIXTURE_ATTEMPT_ROUTE = "/exams/exam-fixture/attempt/attempt-fixture";

// --- submitSupportTicket response fixtures ----------------------------------

export const FIXTURE_SHORT_REF = "ab12cd34";

export const FIXTURE_SUCCESS: SubmitTicketResult = { ok: true, shortRef: FIXTURE_SHORT_REF };

export const FIXTURE_REFUSALS = {
  invalid: { error: "invalid" },
  unauthenticated: { error: "unauthenticated" },
  rate_limited: { error: "rate_limited" },
  screenshot_rejected: { error: "screenshot_rejected" },
  server: { error: "server" },
} as const satisfies Record<string, SubmitTicketResult>;

/** Điều khiển cuộc đua timeout gửi ~20s phía client (AC-039) — không bao giờ settle. */
export function fixtureNeverResolvingSubmit(): Promise<SubmitTicketResult> {
  return new Promise(() => {});
}

export const FIXTURE_INTENTS: readonly TicketIntent[] = ["bug", "suggestion", "question"];
export const FIXTURE_INTENT_LABELS: Record<TicketIntent, string> = {
  bug: "Báo lỗi",
  suggestion: "Góp ý",
  question: "Câu hỏi",
};

// --- Driver (Playwright `Page`/`Locator` structural subset) ----------------

export interface SupportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SupportLocator {
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  setInputFiles(path: string): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  /** null = phần tử không có trong DOM / chưa được bố cục — ngữ nghĩa Playwright thật. */
  boundingBox(): Promise<SupportRect | null>;
  first(): SupportLocator;
  count(): Promise<number>;
  textContent(): Promise<string | null>;
  /** Giá trị hiện tại của input/textarea/select — phương thức Locator thật của Playwright. */
  inputValue(): Promise<string>;
}

export interface SupportDriver {
  goto(url: string): Promise<void>;
  url(): string;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  getByRole(role: string, options?: { name?: string | RegExp }): SupportLocator;
  getByLabelText(text: string | RegExp): SupportLocator;
  getByText(text: string | RegExp): SupportLocator;
  /**
   * Số đếm truy vấn DOM thô (không chỉ cây truy cập) — Nghĩa vụ B(b) cần
   * cái này để loại trừ một node `display:none`/`aria-hidden` mà một truy vấn
   * `getByRole` đơn thuần cũng có thể (đúng) báo là không, mà không chứng minh được
   * hoàn toàn không có node.
   */
  querySelectorCount(selector: string): Promise<number>;
}
