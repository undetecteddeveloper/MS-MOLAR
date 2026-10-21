// @vitest-environment jsdom

// HeaderProfile — menu tài khoản. Ghim thứ tự và đích của các mục. Gói và Lịch sử
// mua nằm trong tab "Gói" của /profile (2026-10-21) nên KHÔNG có mục riêng ở menu.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import { HeaderProfile } from "@/components/shared/HeaderProfile";

afterEach(cleanup);

function openMenu() {
  render(<HeaderProfile displayName="Anh Phát" avatarUrl={null} />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { expanded: false }));
  });
  return screen.getAllByRole("menuitem");
}

describe("menu tài khoản", () => {
  it("đóng thì không có mục nào; mở thì hiện đủ ba mục theo thứ tự", () => {
    render(<HeaderProfile displayName="Anh Phát" avatarUrl={null} />);
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    cleanup();

    const items = openMenu();
    expect(items.map((el) => el.textContent)).toEqual([
      "Hồ sơ",
      "Đề của tôi",
      "Đăng xuất",
    ]);
  });

  it("hai mục đầu là liên kết tới đúng đích, không còn lối vào /pricing hay /me/orders", () => {
    const items = openMenu();
    expect(items.slice(0, 2).map((el) => el.getAttribute("href"))).toEqual([
      "/profile",
      "/me/exams",
    ]);
    const hrefs = items.map((el) => el.getAttribute("href"));
    expect(hrefs).not.toContain("/pricing");
    expect(hrefs).not.toContain("/me/orders");
  });

  it("Đăng xuất là nút gửi form, đứng cuối và không phải liên kết", () => {
    const items = openMenu();
    const last = items[items.length - 1];
    expect(last.tagName).toBe("BUTTON");
    expect(last.getAttribute("type")).toBe("submit");
    expect(last.getAttribute("href")).toBeNull();
  });
});
