// /me/orders — đã gộp vào Hồ sơ (2026-10-21): danh sách đơn nay là phần "Lịch sử
// mua" của tab "Gói". Route còn lại chỉ để link cũ không chết.

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import MyOrdersPage from "../page";

describe("/me/orders", () => {
  it("chuyển sang tab Gói của Hồ sơ", () => {
    expect(() => MyOrdersPage()).toThrow("NEXT_REDIRECT:/profile?tab=plans");
    expect(mocks.redirect).toHaveBeenCalledWith("/profile?tab=plans");
  });
});
