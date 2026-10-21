// @vitest-environment jsdom

// HeaderProfile — menu tài khoản. Ghim thứ tự và đích của các mục, đặc biệt hai
// lối vào thanh toán (/pricing, /me/orders): chúng đứng liền nhau, TRƯỚC Đăng
// xuất, và luôn hiện (kể cả khi Premium chưa mở bán — /pricing tự khoá nút mua).

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
  it("đóng thì không có mục nào; mở thì hiện đủ năm mục theo thứ tự", () => {
    render(<HeaderProfile displayName="Anh Phát" avatarUrl={null} />);
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    cleanup();

    const items = openMenu();
    expect(items.map((el) => el.textContent)).toEqual([
      "Hồ sơ",
      "Đề của tôi",
      "Gói & thanh toán",
      "Đơn hàng của bạn",
      "Đăng xuất",
    ]);
  });

  it("bốn mục đầu là liên kết tới đúng đích", () => {
    const items = openMenu();
    expect(items.slice(0, 4).map((el) => el.getAttribute("href"))).toEqual([
      "/profile",
      "/me/exams",
      "/pricing",
      "/me/orders",
    ]);
  });

  it("Đăng xuất là nút gửi form, đứng cuối và không phải liên kết", () => {
    const items = openMenu();
    const last = items[items.length - 1];
    expect(last.tagName).toBe("BUTTON");
    expect(last.getAttribute("type")).toBe("submit");
    expect(last.getAttribute("href")).toBeNull();
  });
});
