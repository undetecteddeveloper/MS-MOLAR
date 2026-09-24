// @vitest-environment jsdom

// SolutionSettingsPanel — hàng "Cài đặt bài giải" gập/mở chứa đúng hai công
// tắc (AC-038); mặc định bài mới: "Hiện hồ sơ" bật, "Hiện điểm và lựa chọn
// gốc" tắt (D45). Chỉ đọc: `lockReasonId` cộng vào `aria-describedby` của cả
// hai công tắc, sau `descriptionId` của chính nó.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolutionSettingsPanel } from "@/features/solutions/components/SolutionSettingsPanel";

afterEach(cleanup);

function baseProps() {
  return {
    showProfile: true,
    showScore: false,
    onShowProfileChange: vi.fn(),
    onShowScoreChange: vi.fn(),
  };
}

describe("SolutionSettingsPanel", () => {
  it("mặc định đóng: không thấy hai công tắc", () => {
    render(<SolutionSettingsPanel {...baseProps()} />);
    expect(screen.queryByRole("switch")).toBeNull();
    const toggle = screen.getByRole("button", { name: /Cài đặt bài giải/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("bấm mở: hiện đúng hai công tắc đúng mặc định bài mới (Hiện hồ sơ bật, Hiện điểm tắt)", () => {
    render(<SolutionSettingsPanel {...baseProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /Cài đặt bài giải/ }));

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);

    const showProfile = screen.getByRole("switch", { name: "Hiện hồ sơ" });
    expect(showProfile.getAttribute("aria-checked")).toBe("true");

    const showScore = screen.getByRole("switch", { name: "Hiện điểm và lựa chọn gốc" });
    expect(showScore.getAttribute("aria-checked")).toBe("false");
  });

  it("bấm công tắc gọi đúng callback với giá trị đảo", () => {
    const props = baseProps();
    render(<SolutionSettingsPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Cài đặt bài giải/ }));

    fireEvent.click(screen.getByRole("switch", { name: "Hiện hồ sơ" }));
    expect(props.onShowProfileChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("switch", { name: "Hiện điểm và lựa chọn gốc" }));
    expect(props.onShowScoreChange).toHaveBeenCalledWith(true);
  });

  it("có lockReasonId: cả hai công tắc chỉ đọc, aria-describedby cộng thêm id lý do sau descriptionId", () => {
    render(<SolutionSettingsPanel {...baseProps()} lockReasonId="reason-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Cài đặt bài giải/ }));

    for (const name of ["Hiện hồ sơ", "Hiện điểm và lựa chọn gốc"]) {
      const control = screen.getByRole("switch", { name });
      expect(control.getAttribute("aria-disabled")).toBe("true");
      expect(control.hasAttribute("disabled")).toBe(false);
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toMatch(/ reason-1$/);
    }
  });

  it("không có lockReasonId: cả hai công tắc bấm được bình thường", () => {
    render(<SolutionSettingsPanel {...baseProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /Cài đặt bài giải/ }));

    for (const name of ["Hiện hồ sơ", "Hiện điểm và lựa chọn gốc"]) {
      const control = screen.getByRole("switch", { name });
      expect(control.getAttribute("aria-disabled")).toBeNull();
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).not.toMatch(/\s/);
    }
  });
});
