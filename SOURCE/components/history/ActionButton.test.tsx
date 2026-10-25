// @vitest-environment jsdom

// ActionButton [integration] — nguyên tử Lưu/Chia sẻ dùng chung, một máy trạng thái
// 4 pha (idle/busy/error/fallback-confirmed) được HistoryRow và ResultActions
// dùng giống hệt nhau (yêu cầu một-bản-cài-đặt của AC-007).
// Design Doc: docs/design/history-frontend-design.md (v1.3) § ActionButton —
//   Deep Dive, § State Transitions, § Data Contracts.
// UI Spec: docs/ui-spec/history-ui-spec.md (v1.1 — D1/D2/D4, ma trận trạng thái x hiển thị
//   của ActionButton + bảng tương tác).
// PRD: docs/prd/history-prd.md (v1.3, AC-007/009/010/011/012/013/018)
//
// Ranh giới mock (Test Boundaries của frontend DD): generateAttemptPdfFile,
// downloadPdfFile, canShareFile (SOURCE/lib/pdf/generateAttemptPdf.ts) ĐỀU
// bị mock ở đây — file này cô lập logic máy-trạng-thái/chặn-click/hình-dạng-DOM của
// chính ActionButton khỏi đường ống PDF thật (luồng điều khiển/cách dựng lời gọi của
// đường ống đó, kể cả thứ tự gọi URL.createObjectURL /
// revokeObjectURL, đã được chứng minh riêng bởi
// generateAttemptPdf.test.ts — Task 09). navigator.share/navigator.canShare
// cũng bị mock (jsdom không cài Web Share API) — cách duy nhất để điều khiển
// xác định nhánh Chia sẻ 3 hướng (chia sẻ gốc / canShareFile-false dự phòng /
// người dùng huỷ AbortError) mà không cần trình duyệt thật.
//
//vitest.config.ts của repo này không nối file setup `@testing-library/jest-dom`
// nào (không có `test.setupFiles`), nên các matcher kiểu jest-dom như
// `expect(...).toHaveAttribute(...)` không dùng được ở đây — các khẳng định bên dưới
// đọc thẳng thuộc tính/attribute DOM thô (cùng quy ước với
// AttemptPdfTemplate.test.tsx/DifficultyBadge.test.tsx).
//
//render() cũng không tự cleanup giữa các test trong file này (không có
// `test.globals`, nên auto-cleanup dựa trên afterEach của @testing-library/react
// không bao giờ được đăng ký — cùng quy ước với
// DifficultyBadge.test.tsx/QuestionFigure.test.tsx) — mọi truy vấn bên dưới được giới hạn trong
// `container` do chính render() đó trả về qua `within`, không bao giờ dùng `screen` toàn cục.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionButton } from "./ActionButton";
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
  subject: "Math",
  examTitle: "Mock Exam #3",
  totalScore: 8.5,
  examineeName: "Nguyen Phat",
  submittedAt: "2026-07-01T00:10:00.000Z",
  correct: 8,
  total: 10,
  // ADR-0018 (Task B2.3) — bat buoc tren AttemptPdfData. `false` la gia tri
  // dung o day: khong fixture nao trong file nay co cau tu luan.
  hasIncompleteEssay: false,
};

function mockFile(): File {
  return new File(["pdf-bytes"], "mock-exam.pdf", { type: "application/pdf" });
}

/** Con trực tiếp của gốc render KHÔNG phải span lý do sr-only luôn có mặt. */
function inFlowChildren(container: HTMLElement): Element[] {
  return Array.from(container.children).filter(
    (el) => !(el.getAttribute("class") ?? "").split(/\s+/).includes("sr-only")
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
});

describe("ActionButton", () => {
  it("(a) AC-010: two rapid clicks while phase===busy invoke generateAttemptPdfFile at most once", async () => {
    let resolveGenerate!: (file: File) => void;
    mockGenerate.mockImplementation(
      () =>
        new Promise<File>((resolve) => {
          resolveGenerate = resolve;
        })
    );

    const { container } = render(<ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="a" blockedReason={null} />);
    const button = within(container).getByRole("button", { name: "Lưu" });

    fireEvent.click(button); // idle -> busy (busyRef true, đồng bộ, trước khi promise hoàn tất)
    fireEvent.click(button); // bấm lần hai quá nhanh, vẫn đang bận — phải là no-op

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");

    resolveGenerate(mockFile());
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
    expect(mockGenerate).toHaveBeenCalledTimes(1); // vẫn là 1 sau khi cửa sổ bận đóng
  });

  it("(b) AC-011: Share success calls navigator.share with the exact resolved File and returns to idle", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(true);
    const shareMock = vi.mocked(navigator.share);
    shareMock.mockResolvedValue(undefined);

    const { container } = render(<ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="b" blockedReason={null} />);
    const button = within(container).getByRole("button", { name: "Xuất PDF" });

    fireEvent.click(button);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));

    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock).toHaveBeenCalledWith({ files: [file] });
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(within(container).queryByRole("alert")).toBeNull();
    expect(within(container).queryByRole("status")).toBeNull();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("(c) AC-012: canShareFile-false falls back to downloadPdfFile and shows a persistent confirmation", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(false);

    const { container, rerender } = render(
      <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="c" blockedReason={null} />
    );
    const button = within(container).getByRole("button", { name: "Xuất PDF" });

    fireEvent.click(button);
    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    expect(mockDownload).toHaveBeenCalledWith(file);
    expect(vi.mocked(navigator.share)).not.toHaveBeenCalled();

    const status = await within(container).findByRole("status");
    expect(status.textContent).toBe("Đã tải về — trình duyệt này không hỗ trợ chia sẻ.");
    expect(status.getAttribute("aria-live")).toBe("polite");

    // Tồn tại qua một lần render lại no-op (không có bộ đếm tự tắt, D1).
    rerender(<ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="c" blockedReason={null} />);
    expect(within(container).getByRole("status")).not.toBeNull();

    // Chỉ xoá ở lần kích hoạt Lưu/Chia sẻ kế tiếp trên chính instance này.
    mockGenerate.mockResolvedValue(file);
    fireEvent.click(button);
    expect(within(container).queryByRole("status")).toBeNull();
  });

  it("(d) Share-cancellation: navigator.share rejecting with AbortError resolves phase back to idle, not error", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(true);
    const shareMock = vi.mocked(navigator.share);
    shareMock.mockRejectedValue(new DOMException("User cancelled the share", "AbortError"));

    const { container } = render(<ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="d" blockedReason={null} />);
    const button = within(container).getByRole("button", { name: "Xuất PDF" });

    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));

    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(within(container).queryByRole("alert")).toBeNull();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("(e) AC-018: a non-AbortError rejection sets error phase with role=alert; a follow-up click retries and succeeds", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("network blip"));

    const { container } = render(<ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="e" blockedReason={null} />);
    const button = within(container).getByRole("button", { name: "Lưu" });

    fireEvent.click(button);

    const alert = await within(container).findByRole("alert");
    expect(alert.textContent).toBe("Không tạo được file PDF. Thử lại nhé.");
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");

    // Thử lại — busyRef không được để kẹt ở true sau lỗi.
    const file = mockFile();
    mockGenerate.mockResolvedValueOnce(file);
    fireEvent.click(button);

    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    expect(mockDownload).toHaveBeenCalledWith(file);
    expect(within(container).queryByRole("alert")).toBeNull();
  });

  it("(f) DOM-shape invariant: every phase contributes exactly one in-flow child element to the parent", async () => {
    // Idle.
    {
      const { container } = render(
        <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="f-idle" blockedReason={null} />
      );
      const flowChildren = inFlowChildren(container);
      expect(flowChildren).toHaveLength(1);
      expect(flowChildren[0].tagName).toBe("BUTTON");
    }

    // Busy.
    {
      let resolveGenerate!: (file: File) => void;
      mockGenerate.mockImplementation(
        () =>
          new Promise<File>((resolve) => {
            resolveGenerate = resolve;
          })
      );
      const { container } = render(
        <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="f-busy" blockedReason={null} />
      );
      const button = within(container).getByRole("button", { name: "Lưu" });
      fireEvent.click(button);
      expect(button.getAttribute("aria-busy")).toBe("true");

      const flowChildren = inFlowChildren(container);
      expect(flowChildren).toHaveLength(1);
      expect(flowChildren[0].tagName).toBe("BUTTON");

      resolveGenerate(mockFile());
      await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
    }

    // Error.
    {
      mockGenerate.mockRejectedValueOnce(new Error("boom"));
      const { container } = render(
        <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="f-error" blockedReason={null} />
      );
      const button = within(container).getByRole("button", { name: "Lưu" });
      fireEvent.click(button);
      await within(container).findByRole("alert");

      const flowChildren = inFlowChildren(container);
      expect(flowChildren).toHaveLength(1);
      expect(flowChildren[0].tagName).toBe("BUTTON");
    }

    // FallbackConfirmed.
    {
      mockGenerate.mockResolvedValue(mockFile());
      mockCanShare.mockReturnValue(false);
      const { container } = render(
        <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="f-fallback" blockedReason={null} />
      );
      const button = within(container).getByRole("button", { name: "Xuất PDF" });
      fireEvent.click(button);
      await within(container).findByRole("status");

      const flowChildren = inFlowChildren(container);
      expect(flowChildren).toHaveLength(1);
      expect(flowChildren[0].tagName).toBe("BUTTON");
    }
  });

  it("(g) AC-013/no-public-link: ActionButton's own code never calls fetch/XHR across the Share flow", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    try {
      // Native share branch.
      mockGenerate.mockResolvedValue(mockFile());
      mockCanShare.mockReturnValue(true);
      vi.mocked(navigator.share).mockResolvedValue(undefined);
      const shareRender = render(
        <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="g-share" blockedReason={null} />
      );
      const shareButton = within(shareRender.container).getByRole("button", { name: "Xuất PDF" });
      fireEvent.click(shareButton);
      await waitFor(() => expect(shareButton.getAttribute("aria-busy")).toBe("false"));

      // canShareFile-false fallback branch.
      mockCanShare.mockReturnValue(false);
      const fallbackRender = render(
        <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="g-fallback" blockedReason={null} />
      );
      fireEvent.click(within(fallbackRender.container).getByRole("button", { name: "Xuất PDF" }));
      await within(fallbackRender.container).findByRole("status");

      // Save branch.
      const saveRender = render(
        <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="g-save" blockedReason={null} />
      );
      const saveButton = within(saveRender.container).getByRole("button", { name: "Lưu" });
      fireEvent.click(saveButton);
      await waitFor(() => expect(saveButton.getAttribute("aria-busy")).toBe("false"));

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // (g, nửa xuyên-file) Chốt chặn cấu trúc của AC-007 — cập nhật cho
  // việc gộp menu ⋯ của front-adjust: HistoryRow.tsx không còn render
  // ActionButton trực tiếp (giờ nó render HistoryRowMenu, components/history/
  // HistoryRowMenu.tsx), nhưng cả hai nơi gọi vẫn dùng chung đúng MỘT
  // điểm vào tạo PDF — usePdfAction (components/history/usePdfAction.ts), là
  // nơi duy nhất import generateAttemptPdfFile. Chốt chặn mà nghĩa vụ này
  // canh giữ — "một đường import tạo-PDF thứ hai, song song hình thành giữa các nơi gọi" —
  // được kiểm trực tiếp: không nơi gọi UI nào (ActionButton.tsx, HistoryRowMenu.tsx) được
  // import chính generateAttemptPdfFile, cả hai phải import usePdfAction từ cùng một
  // specifier, và HistoryRow.tsx phải đi qua HistoryRowMenu (không phải ActionButton).
  it("(g cross-file) ActionButton.tsx and HistoryRowMenu.tsx never import generateAttemptPdfFile directly — both route through the identical shared usePdfAction specifier", () => {
    const actionButtonSource = readFileSync(
      join(process.cwd(), "components/history/ActionButton.tsx"),
      "utf-8"
    );
    const historyRowMenuSource = readFileSync(
      join(process.cwd(), "components/history/HistoryRowMenu.tsx"),
      "utf-8"
    );
    const historyRowSource = readFileSync(
      join(process.cwd(), "features/history/components/HistoryRow.tsx"),
      "utf-8"
    );

    const importsGenerateAttemptPdfFileDirectly = (source: string) =>
      /import\s*\{[^}]*\bgenerateAttemptPdfFile\b[^}]*\}\s*from/.test(source);

    // Kiểu hỏng chính: một đường import tạo-PDF thứ hai, song song hình
    // thành ở một trong hai nơi gọi UI thay vì đi qua usePdfAction.
    expect(importsGenerateAttemptPdfFileDirectly(actionButtonSource)).toBe(false);
    expect(importsGenerateAttemptPdfFileDirectly(historyRowMenuSource)).toBe(false);

    const usePdfActionImport = /import\s*\{[^}]*\busePdfAction\b[^}]*\}\s*from\s*"([^"]+)"/;
    const actionButtonMatch = actionButtonSource.match(usePdfActionImport);
    const historyRowMenuMatch = historyRowMenuSource.match(usePdfActionImport);

    expect(actionButtonMatch?.[1]).toBe("@/components/history/usePdfAction");
    expect(historyRowMenuMatch?.[1]).toBe("@/components/history/usePdfAction");
    expect(actionButtonMatch?.[1]).toBe(historyRowMenuMatch?.[1]);

    const historyRowMenuImport = /import\s*\{[^}]*\bHistoryRowMenu\b[^}]*\}\s*from\s*"([^"]+)"/;
    expect(historyRowSource.match(historyRowMenuImport)?.[1]).toBe(
      "@/components/history/HistoryRowMenu"
    );
    expect(historyRowSource.includes("ActionButton")).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// CỔNG CHẶN XUẤT PDF (ADR-0018 / AC-058 / UI-D5) — Task F-B2
//
// Thứ được kiểm ở đây KHÔNG phải "nút có bị mờ đi không" mà là BA tính chất
// mà một `disabled` gốc sẽ phá cả ba: nút vẫn TỚI ĐƯỢC bằng bàn phím, LÝ DO
// vẫn ĐỌC ĐƯỢC bằng trình đọc màn hình, và một lượt bấm bị chặn KHÔNG sinh pha
// bận nào. Repo đã sửa đúng lỗi `disabled` này HAI LẦN.
// ═══════════════════════════════════════════════════════════════════════════

describe("ActionButton — trạng thái BỊ CHẶN (AC-058)", () => {
  const REASON = "Đang chấm tự luận. Lưu và xuất PDF sẽ mở lại khi chấm xong.";

  it("bị chặn ⇒ KHÔNG gọi generateAttemptPdfFile, và KHÔNG pha bận nào", () => {
    const { container } = render(
      <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="blk1" blockedReason={REASON} />
    );
    const button = within(container).getByRole("button", { name: /Lưu/ });

    fireEvent.click(button);

    // Chặn nằm TRƯỚC chốt bận, nên không có lượt tạo tệp nào VÀ giao diện
    // không nhấp qua "đang tạo" rồi mới dừng.
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("false");
    // Khẳng định dương: nút vẫn ở đó và vẫn đọc được tên.
    expect(button.textContent).toContain("Lưu");
  });

  it("KHÔNG BAO GIỜ thuộc tính `disabled` gốc — nút vẫn tới được bằng bàn phím", () => {
    const { container } = render(
      <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="blk2" blockedReason={REASON} />
    );
    const button = within(container).getByRole("button", { name: /Xuất PDF/ });

    // `disabled` gỡ phần tử khỏi thứ tự tab VÀ đẩy lý do ra ngoài tầm với của
    // trình đọc màn hình — đúng hai thứ AC-058 muốn có.
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("[disabled]")).toBeNull();
  });

  it("LÝ DO đọc được qua aria-describedby, không phải chỉ một nút mờ đi", () => {
    const { container } = render(
      <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="blk3" blockedReason={REASON} />
    );
    const button = within(container).getByRole("button", { name: /Lưu/ });

    const reasonId = button.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    const reason = container.querySelector(`#${reasonId}`);
    expect(reason?.textContent).toBe(REASON);
  });

  it("`blockedReason` null ⇒ hành vi y như trước, có gọi tạo tệp", () => {
    // Nửa còn lại của cổng: nó phải MỞ khi không có gì để chặn, nếu không thì
    // ba ca trên xanh một cách vô nghĩa.
    const { container } = render(
      <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="blk4" blockedReason={null} />
    );
    const button = within(container).getByRole("button", { name: /Lưu/ });

    fireEvent.click(button);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});
