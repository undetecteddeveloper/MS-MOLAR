// @vitest-environment jsdom

// SolutionEditorHeader — tiêu đề, nút "Bảng câu hỏi", thanh tiến độ, huy hiệu
// trạng thái (AC-027, AC-030); nhánh 0 câu hiện hành (DD-U4, UI Spec `C-21`
// "Rỗng"); Reference Contract UI-D26 — `cells[]` mang đúng cặp ký hiệu + tên
// trợ năng.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolutionEditorHeader } from "@/features/solutions/components/SolutionEditorHeader";

afterEach(cleanup);

function openPalette() {
  const trigger = screen.getByRole("button", { name: "Bảng câu hỏi" });
  fireEvent.click(trigger);
  return trigger;
}

describe("SolutionEditorHeader — mặc định (N > 0)", () => {
  it("hiện tiêu đề, thanh tiến độ và dòng a/N câu đã ghi chú", () => {
    render(
      <SolutionEditorHeader
        status="draft"
        questionStates={["noted", "noted", "missing", "short"]}
        onJump={() => {}}
      />
    );
    expect(screen.getByRole("heading", { name: "Bài giải của bạn" })).toBeTruthy();
    expect(screen.getByText("2/4 câu đã ghi chú")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
  });

  it.each([
    ["draft", "Nháp"],
    ["published", "Đã đăng"],
    ["hidden", "Bị ẩn"],
  ] as const)("huy hiệu trạng thái %s hiện chữ %j", (status, label) => {
    render(<SolutionEditorHeader status={status} questionStates={["noted"]} onJump={() => {}} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("status null: không render huy hiệu nào", () => {
    render(<SolutionEditorHeader status={null} questionStates={["missing"]} onJump={() => {}} />);
    expect(screen.queryByText("Nháp")).toBeNull();
    expect(screen.queryByText("Đã đăng")).toBeNull();
    expect(screen.queryByText("Bị ẩn")).toBeNull();
  });
});

describe("SolutionEditorHeader — Reference Contract UI-D26 (cells[])", () => {
  it.each([
    ["noted", "Câu 1, đã ghi chú", "lucide-check"],
    ["missing", "Câu 2, chưa ghi chú", "lucide-minus"],
    ["short", "Câu 3, chưa đủ 15 từ", "lucide-minus"],
    ["changed", "Câu 4, câu hỏi đã thay đổi", "lucide-refresh-cw"],
  ] as const)("ô câu %s mang tên trợ năng %j kèm ký hiệu %s", (_state, name, iconClass) => {
    render(
      <SolutionEditorHeader
        status="draft"
        questionStates={["noted", "missing", "short", "changed"]}
        onJump={() => {}}
      />
    );
    openPalette();
    const cell = screen.getByRole("button", { name });
    const icon = cell.querySelector("svg");
    expect(icon).toBeTruthy();
    expect(icon?.classList.contains(iconClass)).toBe(true);
  });

  it("chọn một ô gọi onJump với đúng index", () => {
    const onJump = vi.fn();
    render(
      <SolutionEditorHeader
        status="draft"
        questionStates={["noted", "missing", "short", "changed"]}
        onJump={onJump}
      />
    );
    openPalette();
    fireEvent.click(screen.getByRole("button", { name: "Câu 3, chưa đủ 15 từ" }));
    expect(onJump).toHaveBeenCalledWith(2);
  });
});

describe("SolutionEditorHeader — Rỗng (0 câu hiện hành, DD-U4)", () => {
  it("không mount QuestionPaletteDock: nút tĩnh, aria-disabled, không disabled gốc, mở không panel nào", () => {
    render(<SolutionEditorHeader status="draft" questionStates={[]} onJump={() => {}} />);

    const trigger = screen.getByRole("button", { name: "Bảng câu hỏi" });
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(trigger.hasAttribute("disabled")).toBe(false);
    expect(trigger.hasAttribute("aria-expanded")).toBe(false);
    expect(trigger.hasAttribute("aria-controls")).toBe(false);

    const describedById = trigger.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById!)?.textContent).toBe(
      "Đề này hiện không còn câu hỏi nào."
    );

    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: "Bảng câu hỏi" })).toBeNull();
  });

  it("thanh tiến độ ẩn khi N = 0", () => {
    render(<SolutionEditorHeader status="draft" questionStates={[]} onJump={() => {}} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
