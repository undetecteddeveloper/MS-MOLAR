// @vitest-environment jsdom

// HistoryRowMenu [integration] — front-adjust: menu ⋯ gộp thay thế
// 3 điều khiển riêng trước đây của HistoryRow (2x ActionButton +
// "Xem chi tiết" Link). Save/Share still route through usePdfAction
// (components/history/usePdfAction.ts) — cùng hook mà ActionButton.tsx dùng — nên file này
// tập trung vào hành vi MỚI mà component này thêm lên trên máy trạng thái
// đã được chứng minh đó (ActionButton.test.tsx phủ đầy đủ busy/error/
// fallback/AC-010): mở-đóng nút kích hoạt/menu, render từng mục,
// tự đóng khi thành công, giữ mở khi lỗi/dự phòng, và link
// Xem chi tiết.
//
// Ranh giới mock + quy ước giống ActionButton.test.tsx: mock
// generateAttemptPdfFile/downloadPdfFile/canShareFile + navigator.share, không dùng
// matcher jest-dom. Khẳng định về nút kích hoạt vẫn giới hạn qua `within
// (container)` (không ảnh hưởng, không bao giờ portal) — nhưng chính panel `role="menu"`
// được render qua `createPortal(..., document.body)` từ 2026-08-09
// (HistoryRowMenu.tsx: sửa lỗi bị cắt bởi bottom-sheet/BottomNav, xem comment đầu của file đó),
// nên nó không còn là con cháu của `container` và phải
// được truy vấn qua `screen` (phạm vi document.body). File này GIỜ có
// gọi `cleanup()` ở mỗi test (khác phần còn lại của bộ test) chính vì
// `screen` truy vấn cả tài liệu — thiếu nó, một menu chưa đóng
// còn mount từ test này sẽ rò sang truy vấn `screen` của test kế
// và phá giả định chỉ-một-kết-quả của `getByRole`. `within(container)`
// ở nơi khác trong codebase chưa bao giờ cần vì nó chưa từng
// bị gắn với phạm vi tài liệu.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryRowMenu } from "./HistoryRowMenu";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

vi.mock("@/lib/pdf/generateAttemptPdf", () => ({
  generateAttemptPdfFile: vi.fn(),
  downloadPdfFile: vi.fn(),
  canShareFile: vi.fn(),
}));

import {
  canShareFile,
  downloadPdfFile,
  generateAttemptPdfFile,
} from "@/lib/pdf/generateAttemptPdf";

const mockGenerate = vi.mocked(generateAttemptPdfFile);
const mockDownload = vi.mocked(downloadPdfFile);
const mockCanShare = vi.mocked(canShareFile);

const PDF_INPUT: AttemptPdfData = {
  subject: "Vật lý",
  examTitle: "Đề Vật Lý 10",
  totalScore: 7,
  examineeName: "Nguyen Phat",
  submittedAt: "2026-07-01T00:10:00.000Z",
  correct: 7,
  total: 10,
  // ADR-0018 (Task B2.3) — bat buoc tren AttemptPdfData. `false` la gia tri
  // dung o day: khong fixture nao trong file nay co cau tu luan.
  hasIncompleteEssay: false,
};

function mockFile(): File {
  return new File(["pdf-bytes"], "mock-exam.pdf", { type: "application/pdf" });
}

function renderMenu() {
  return render(
    <HistoryRowMenu
      pdfInput={PDF_INPUT}
      resultHref="/exams/exam-1/attempt/attempt-1/result"
      examTitle={PDF_INPUT.examTitle} blockedReason={null}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window.navigator, "share", {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  // @ts-expect-error — test-only cleanup of the stubbed Web Share API surface
  delete window.navigator.share;
  cleanup(); // unmount (kể cả menu portal) — xem comment đầu file
});

describe("HistoryRowMenu", () => {
  it("(a) renders a single trigger with an exam-specific accessible name; menu is closed by default", () => {
    const { container } = render(
      <HistoryRowMenu
        pdfInput={PDF_INPUT}
        resultHref="/x"
        examTitle="Đề Vật Lý 10" blockedReason={null}
      />
    );
    const trigger = within(container).getByRole("button", {
      name: "Thao tác khác cho Đề Vật Lý 10",
    });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(within(container).queryByRole("menu")).toBeNull();
  });

  it("(b) clicking the trigger opens a menu containing Save, Share, and View details", () => {
    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Lưu/ })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: /Xuất PDF/ })).toBeTruthy();
    const link = within(menu).getByRole("menuitem", { name: "Xem chi tiết" });
    expect(link.getAttribute("href")).toBe("/exams/exam-1/attempt/attempt-1/result");
  });

  it("(c) Save success calls generateAttemptPdfFile + downloadPdfFile and auto-closes the menu", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Lưu/ }));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(file));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("(d) Share success (native) calls navigator.share and auto-closes the menu", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(true);
    vi.mocked(navigator.share).mockResolvedValue(undefined);

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Xuất PDF/ }));

    await waitFor(() => expect(navigator.share).toHaveBeenCalledWith({ files: [file] }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("(e) Share fallback (canShareFile false) downloads instead, shows a status line, and keeps the menu open", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(false);

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Xuất PDF/ }));

    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(file));
    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("Đã tải về — trình duyệt này không hỗ trợ chia sẻ.");
    expect(screen.getByRole("menu")).not.toBeNull(); // stays open
  });

  it("(f) a generation failure shows an inline alert inside the menu and keeps it open for retry", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("network blip"));

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Lưu/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Không tạo được file PDF. Thử lại nhé.");
    expect(screen.getByRole("menu")).not.toBeNull(); // stays open

    // Thử lại thành công rồi tự đóng.
    const file = mockFile();
    mockGenerate.mockResolvedValueOnce(file);
    fireEvent.click(screen.getByRole("menuitem", { name: /Lưu/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("(g) clicking the scrim (outside the menu) closes it without triggering an action", () => {
    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));
    expect(screen.getByRole("menu")).not.toBeNull();

    const scrim = container.querySelector('button[aria-hidden="true"]');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim!);

    expect(screen.queryByRole("menu")).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("(h) AC-010: two rapid Save clicks while busy invoke generateAttemptPdfFile at most once", async () => {
    let resolveGenerate!: (file: File) => void;
    mockGenerate.mockImplementation(
      () =>
        new Promise<File>((resolve) => {
          resolveGenerate = resolve;
        })
    );

    const { container } = renderMenu();
    fireEvent.click(within(container).getByRole("button", { name: /Thao tác khác cho/ }));
    const saveItem = screen.getByRole("menuitem", { name: /Lưu/ });
    fireEvent.click(saveItem);
    fireEvent.click(screen.getByRole("menuitem", { name: /Đang lưu/ }));

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    resolveGenerate(mockFile());
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
