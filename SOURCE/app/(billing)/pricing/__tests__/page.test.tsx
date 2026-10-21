// /pricing — đã gộp vào Hồ sơ (2026-10-21). Route còn lại chỉ để link cũ và
// `cancelUrl` payOS đã nhận tới đúng tab "Gói".

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import PricingPage from "../page";

describe("/pricing", () => {
  it("chuyển sang tab Gói của Hồ sơ", () => {
    expect(() => PricingPage()).toThrow("NEXT_REDIRECT:/profile?tab=plans");
    expect(mocks.redirect).toHaveBeenCalledWith("/profile?tab=plans");
  });
});
