// @vitest-environment jsdom

// SolutionPublishBar — draft-incomplete / ready / published / publish-
// rejected / rate-limited (AC-028, AC-029, AC-030, AC-101). "Đăng" không bao
// giờ mang `disabled` gốc (UI-D25, Proof Obligation).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolutionPublishBar } from "@/features/solutions/components/SolutionPublishBar";

afterEach(cleanup);

function baseProps() {
  return {
    status: "draft" as const,
    totalCount: 12,
    incompleteCount: 0,
    saving: false,
    publishing: false,
    onSaveDraft: vi.fn(),
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    viewHref: "/exams/E1/solutions/S1",
  };
}

describe("SolutionPublishBar — draft-incomplete (X > 0)", () => {
  it("Đăng: aria-disabled=true, aria-describedby trỏ dòng nhắc chứa số câu còn thiếu, không disabled gốc", () => {
    render(<SolutionPublishBar {...baseProps()} incompleteCount={3} totalCount={12} />);
    const publish = screen.getByRole("button", { name: "Đăng" });
    expect(publish.getAttribute("aria-disabled")).toBe("true");
    expect(publish.hasAttribute("disabled")).toBe(false);

    const describedBy = publish.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Còn 3 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được."
    );
  });

  it("bấm Đăng khi đang chặn: không gọi onPublish", () => {
    const props = baseProps();
    render(<SolutionPublishBar {...props} incompleteCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(props.onPublish).not.toHaveBeenCalled();
  });
});

describe("SolutionPublishBar — ready (X = 0)", () => {
  it("Đăng bấm được (aria-disabled=false/absent), dòng nhắc đổi thành 'Đủ N câu'", () => {
    render(<SolutionPublishBar {...baseProps()} incompleteCount={0} totalCount={12} />);
    const publish = screen.getByRole("button", { name: "Đăng" });
    const disabledAttr = publish.getAttribute("aria-disabled");
    expect(disabledAttr === null || disabledAttr === "false").toBe(true);
    expect(publish.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Đủ 12 câu. Bạn có thể đăng.")).toBeTruthy();
  });

  it("bấm Đăng gọi onPublish", () => {
    const props = baseProps();
    render(<SolutionPublishBar {...props} incompleteCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Đăng" }));
    expect(props.onPublish).toHaveBeenCalledTimes(1);
  });

  it("bấm Lưu nháp gọi onSaveDraft", () => {
    const props = baseProps();
    render(<SolutionPublishBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(props.onSaveDraft).toHaveBeenCalledTimes(1);
  });
});

describe("SolutionPublishBar — published", () => {
  it("hiện 'Gỡ về nháp' và 'Xem bài giải', không còn 'Lưu nháp'/'Đăng'", () => {
    render(<SolutionPublishBar {...baseProps()} status="published" />);
    expect(screen.getByRole("button", { name: "Gỡ về nháp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xem bài giải" }).getAttribute("href")).toBe(
      "/exams/E1/solutions/S1"
    );
    expect(screen.queryByRole("button", { name: "Đăng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu nháp" })).toBeNull();
  });

  it("bấm 'Gỡ về nháp' gọi onUnpublish", () => {
    const props = baseProps();
    render(<SolutionPublishBar {...props} status="published" />);
    fireEvent.click(screen.getByRole("button", { name: "Gỡ về nháp" }));
    expect(props.onUnpublish).toHaveBeenCalledTimes(1);
  });
});

describe("SolutionPublishBar — hidden", () => {
  it("không render thanh đáy nào", () => {
    const { container } = render(<SolutionPublishBar {...baseProps()} status="hidden" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SolutionPublishBar — publish-rejected (AC-029)", () => {
  it("role=alert hiện số câu thật từ server, không phải số client tính (0)", () => {
    render(
      <SolutionPublishBar
        {...baseProps()}
        incompleteCount={0}
        totalCount={12}
        error="Còn 5 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được."
      />
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Còn 5 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được.");
  });
});

describe("SolutionPublishBar — rate-limited (AC-101)", () => {
  it("role=alert chứa số giây", () => {
    render(
      <SolutionPublishBar
        {...baseProps()}
        error="Thao tác quá nhiều lần. Thử lại sau 42 giây."
      />
    );
    expect(screen.getByRole("alert").textContent).toContain("42");
  });
});

describe("SolutionPublishBar — đang lưu / đang đăng", () => {
  it("đang lưu: nút Lưu nháp aria-busy + nhãn 'Đang lưu…', nút Đăng giữ nguyên", () => {
    render(<SolutionPublishBar {...baseProps()} saving incompleteCount={0} />);
    const save = screen.getByRole("button", { name: "Đang lưu…" });
    expect(save.getAttribute("aria-busy")).toBe("true");
    expect(save.getAttribute("aria-disabled")).toBe("true");
    const publish = screen.getByRole("button", { name: "Đăng" });
    expect(publish.getAttribute("aria-disabled")).not.toBe("true");
  });

  it("đang đăng: nút Đăng aria-busy + nhãn 'Đang đăng…'", () => {
    render(<SolutionPublishBar {...baseProps()} publishing incompleteCount={0} />);
    const publish = screen.getByRole("button", { name: "Đang đăng…" });
    expect(publish.getAttribute("aria-busy")).toBe("true");
    expect(publish.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("SolutionPublishBar — data-bottom-bar", () => {
  it("mang data-bottom-bar để SupportWidgetTrigger nhấc lên trên", () => {
    const { container } = render(<SolutionPublishBar {...baseProps()} />);
    expect(container.querySelector("[data-bottom-bar]")).toBeTruthy();
  });
});
