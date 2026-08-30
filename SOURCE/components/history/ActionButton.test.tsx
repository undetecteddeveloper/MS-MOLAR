// @vitest-environment jsdom

// ActionButton [integration] — the shared Save/Share atom, a 4-phase state
// machine (idle/busy/error/fallback-confirmed) consumed identically by
// HistoryRow and ResultActions (AC-007's single-implementation requirement).
// Design Doc: docs/design/history-frontend-design.md (v1.3) § ActionButton —
//   Deep Dive, § State Transitions, § Data Contracts.
// UI Spec: docs/ui-spec/history-ui-spec.md (v1.1 — D1/D2/D4, ActionButton
//   state x display matrix + interaction table).
// PRD: docs/prd/history-prd.md (v1.3, AC-007/009/010/011/012/013/018)
//
// Mock boundary (frontend DD Test Boundaries): generateAttemptPdfFile,
// downloadPdfFile, canShareFile (SOURCE/lib/pdf/generateAttemptPdf.ts) are ALL
// mocked here — this file isolates ActionButton's own state-machine/click-
// guard/DOM-shape logic from the real PDF pipeline (that pipeline's own
// call-construction/control-flow, including its URL.createObjectURL /
// revokeObjectURL call order, is already proven separately by
// generateAttemptPdf.test.ts — Task 09). navigator.share/navigator.canShare
// are also mocked (jsdom does not implement the Web Share API) — the only way
// to deterministically drive the 3-branch Share decision (native share /
// canShareFile-false fallback / user-cancelled AbortError) without a real
// browser.
//
// This repo's vitest.config.ts wires no `@testing-library/jest-dom` setup
// file (no `test.setupFiles`), so `expect(...).toHaveAttribute(...)`-style
// jest-dom matchers are unavailable here — assertions below read raw DOM
// properties/attributes directly (same convention as
// AttemptPdfTemplate.test.tsx/DifficultyBadge.test.tsx).
//
// render() also does not auto-cleanup between tests in this file (no
// `test.globals`, so @testing-library/react's afterEach-based auto-cleanup
// never registers — same convention as
// DifficultyBadge.test.tsx/QuestionFigure.test.tsx) — every query below is
// scoped to its own render()'s returned `container` via `within`, never the
// global `screen`.

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

/** Direct children of the render root that are NOT the always-present sr-only reason span. */
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
    const button = within(container).getByRole("button", { name: "Save" });

    fireEvent.click(button); // idle -> busy (busyRef true, synchronously, before the promise settles)
    fireEvent.click(button); // rapid second click, still busy — must be a no-op

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");

    resolveGenerate(mockFile());
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));
    expect(mockGenerate).toHaveBeenCalledTimes(1); // still 1 after the busy window closes
  });

  it("(b) AC-011: Share success calls navigator.share with the exact resolved File and returns to idle", async () => {
    const file = mockFile();
    mockGenerate.mockResolvedValue(file);
    mockCanShare.mockReturnValue(true);
    const shareMock = vi.mocked(navigator.share);
    shareMock.mockResolvedValue(undefined);

    const { container } = render(<ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="b" blockedReason={null} />);
    const button = within(container).getByRole("button", { name: "Share" });

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
    const button = within(container).getByRole("button", { name: "Share" });

    fireEvent.click(button);
    await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
    expect(mockDownload).toHaveBeenCalledWith(file);
    expect(vi.mocked(navigator.share)).not.toHaveBeenCalled();

    const status = await within(container).findByRole("status");
    expect(status.textContent).toBe("Downloaded — sharing isn't supported in this browser.");
    expect(status.getAttribute("aria-live")).toBe("polite");

    // Persists through a no-op re-render (no auto-dismiss timer, D1).
    rerender(<ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="c" blockedReason={null} />);
    expect(within(container).getByRole("status")).not.toBeNull();

    // Clears only on the next Save/Share activation on this same instance.
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
    const button = within(container).getByRole("button", { name: "Share" });

    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("false"));

    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(within(container).queryByRole("alert")).toBeNull();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("(e) AC-018: a non-AbortError rejection sets error phase with role=alert; a follow-up click retries and succeeds", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("network blip"));

    const { container } = render(<ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="e" blockedReason={null} />);
    const button = within(container).getByRole("button", { name: "Save" });

    fireEvent.click(button);

    const alert = await within(container).findByRole("alert");
    expect(alert.textContent).toBe("Couldn't generate the PDF. Try again.");
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");

    // Retry — busyRef must not be left stuck true after the failure.
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
      const button = within(container).getByRole("button", { name: "Save" });
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
      const button = within(container).getByRole("button", { name: "Save" });
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
      const button = within(container).getByRole("button", { name: "Share" });
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
      const shareButton = within(shareRender.container).getByRole("button", { name: "Share" });
      fireEvent.click(shareButton);
      await waitFor(() => expect(shareButton.getAttribute("aria-busy")).toBe("false"));

      // canShareFile-false fallback branch.
      mockCanShare.mockReturnValue(false);
      const fallbackRender = render(
        <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="g-fallback" blockedReason={null} />
      );
      fireEvent.click(within(fallbackRender.container).getByRole("button", { name: "Share" }));
      await within(fallbackRender.container).findByRole("status");

      // Save branch.
      const saveRender = render(
        <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="g-save" blockedReason={null} />
      );
      const saveButton = within(saveRender.container).getByRole("button", { name: "Save" });
      fireEvent.click(saveButton);
      await waitFor(() => expect(saveButton.getAttribute("aria-busy")).toBe("false"));

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // (g, cross-file half) AC-007 structural tripwire — updated for the
  // front-adjust ⋯-menu consolidation: HistoryRow.tsx no longer renders
  // ActionButton directly (it now renders HistoryRowMenu, components/history/
  // HistoryRowMenu.tsx), but both call sites still share exactly ONE
  // PDF-generation entry point — usePdfAction (components/history/usePdfAction.ts), which
  // is the sole importer of generateAttemptPdfFile. The tripwire this
  // obligation guards against — "a second, parallel PDF-generation import
  // path forms across call sites" — is checked directly: neither UI call site
  // (ActionButton.tsx, HistoryRowMenu.tsx) may import generateAttemptPdfFile
  // itself, both must import usePdfAction from the identical specifier, and
  // HistoryRow.tsx must route through HistoryRowMenu (not ActionButton).
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
      join(process.cwd(), "app/(HM)/history/_components/HistoryRow.tsx"),
      "utf-8"
    );

    const importsGenerateAttemptPdfFileDirectly = (source: string) =>
      /import\s*\{[^}]*\bgenerateAttemptPdfFile\b[^}]*\}\s*from/.test(source);

    // Primary failure mode: a second, parallel PDF-generation import path
    // forming at either UI call site instead of going through usePdfAction.
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
  const REASON = "Đang chấm tự luận. Lưu và chia sẻ PDF sẽ mở lại khi chấm xong.";

  it("bị chặn ⇒ KHÔNG gọi generateAttemptPdfFile, và KHÔNG pha bận nào", () => {
    const { container } = render(
      <ActionButton action="save" pdfInput={PDF_INPUT} idPrefix="blk1" blockedReason={REASON} />
    );
    const button = within(container).getByRole("button", { name: /Save/ });

    fireEvent.click(button);

    // Chặn nằm TRƯỚC chốt bận, nên không có lượt tạo tệp nào VÀ giao diện
    // không nhấp qua "đang tạo" rồi mới dừng.
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("false");
    // Khẳng định dương: nút vẫn ở đó và vẫn đọc được tên.
    expect(button.textContent).toContain("Save");
  });

  it("KHÔNG BAO GIỜ thuộc tính `disabled` gốc — nút vẫn tới được bằng bàn phím", () => {
    const { container } = render(
      <ActionButton action="share" pdfInput={PDF_INPUT} idPrefix="blk2" blockedReason={REASON} />
    );
    const button = within(container).getByRole("button", { name: /Share/ });

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
    const button = within(container).getByRole("button", { name: /Save/ });

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
    const button = within(container).getByRole("button", { name: /Save/ });

    fireEvent.click(button);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});
