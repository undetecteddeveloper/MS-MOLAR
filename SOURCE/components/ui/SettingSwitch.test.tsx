// @vitest-environment jsdom

// SettingSwitch — công tắc `role="switch"` có nhãn, dòng phụ và chữ "Bật"/"Tắt"
// (UI Spec C-12, UI-D11; PRD AC-038). Bốn trạng thái của ma trận: bật, tắt,
// đang lưu, chỉ đọc.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingSwitch } from "@/components/ui/SettingSwitch";

afterEach(cleanup);

const BASE = {
  label: "Hiện hồ sơ",
  description: "Tắt thì bài hiện là Ẩn danh, không tên, không ảnh.",
  descriptionId: "setting-show-profile-sub",
};

describe("SettingSwitch", () => {
  it("bật: role=switch mang tên là nhãn, aria-checked=true, chữ 'Bật' hiện ra", () => {
    render(<SettingSwitch {...BASE} checked onCheckedChange={() => {}} />);
    const control = screen.getByRole("switch", { name: "Hiện hồ sơ" });
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.textContent).toContain("Bật");
    expect(control.textContent).not.toContain("Tắt");
  });

  it("tắt: aria-checked=false, chữ 'Tắt' hiện ra — trạng thái không chỉ bằng màu", () => {
    render(<SettingSwitch {...BASE} checked={false} onCheckedChange={() => {}} />);
    const control = screen.getByRole("switch", { name: "Hiện hồ sơ" });
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(control.textContent).toContain("Tắt");
    expect(control.textContent).not.toContain("Bật");
  });

  it("dòng phụ mang descriptionId và được công tắc trỏ tới qua aria-describedby", () => {
    render(<SettingSwitch {...BASE} checked onCheckedChange={() => {}} />);
    const control = screen.getByRole("switch", { name: "Hiện hồ sơ" });
    expect(control.getAttribute("aria-describedby")).toBe(BASE.descriptionId);
    expect(document.getElementById(BASE.descriptionId)?.textContent).toBe(BASE.description);
  });

  it("bấm gọi onCheckedChange với giá trị ĐẢO (tắt → bật, bật → tắt)", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <SettingSwitch {...BASE} checked={false} onCheckedChange={onCheckedChange} />
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    rerender(<SettingSwitch {...BASE} checked onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it("là <button type=button> thật — Enter/Space do trình duyệt lo, cao tối thiểu 44px", () => {
    render(<SettingSwitch {...BASE} checked onCheckedChange={() => {}} />);
    const control = screen.getByRole("switch");
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
    expect(control.className.split(/\s+/)).toContain("min-h-11");
  });

  it("đang lưu: aria-busy=true, vẫn hiện giá trị mới (lạc quan), vẫn bấm được", () => {
    const onCheckedChange = vi.fn();
    render(<SettingSwitch {...BASE} checked busy onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");
    expect(control.getAttribute("aria-busy")).toBe("true");
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.textContent).toContain("Bật");
    // Bận không khoá công tắc: cú bấm tiếp theo là ý muốn MỚI NHẤT của người
    // dùng, cha (hàng đợi lưu) quyết định gửi gì — nuốt nó ở đây là mất ý muốn.
    expect(control.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("chỉ đọc: aria-disabled=true, KHÔNG có disabled gốc (còn Tab tới được), bấm không đổi gì", () => {
    const onCheckedChange = vi.fn();
    render(<SettingSwitch {...BASE} checked disabled onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch");
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
    fireEvent.click(control);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("có lockReasonId: aria-describedby gồm cả descriptionId lẫn lockReasonId, theo đúng thứ tự", () => {
    render(
      <SettingSwitch
        {...BASE}
        checked
        disabled
        lockReasonId="moderation-reason-banner"
        onCheckedChange={() => {}}
      />
    );
    const control = screen.getByRole("switch", { name: "Hiện hồ sơ" });
    expect(control.getAttribute("aria-describedby")).toBe(`${BASE.descriptionId} moderation-reason-banner`);
  });

  it("không có lockReasonId: aria-describedby đúng bằng descriptionId, không khoảng trắng thừa", () => {
    render(<SettingSwitch {...BASE} checked onCheckedChange={() => {}} />);
    const control = screen.getByRole("switch", { name: "Hiện hồ sơ" });
    expect(control.getAttribute("aria-describedby")).toBe(BASE.descriptionId);
  });

  it("chỉ đọc giữ đủ tương phản và không có hoạt ảnh nào (núm đổi chỗ tức thì)", () => {
    const { container } = render(
      <SettingSwitch {...BASE} checked disabled onCheckedChange={() => {}} />
    );
    for (const el of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
      const tokens = (el.getAttribute("class") ?? "").split(/\s+/);
      expect(tokens.filter((token) => /opacity|transition|animate|motion-/.test(token))).toEqual(
        []
      );
    }
  });
});
