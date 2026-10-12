// @vitest-environment jsdom

// app/(analytics)/me/dashboard/page.tsx — khách chưa đăng nhập (brief 20261012 T3).
// Biểu đồ và thẻ gợi ý là component nặng, không phải đối tượng của test này:
// stub, chỉ kiểm khung trang, thẻ cần đăng nhập và việc KHÔNG đọc thống kê.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

vi.mock("server-only", () => ({}));

const { getCurrentUserMock, getAnalyticsMock, redirectMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getAnalyticsMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  usePathname: () => "/me/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/analytics/queries", () => ({ getAnalyticsByRange: getAnalyticsMock }));
vi.mock("@/features/analytics/components/AnalyticsDashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="dashboard-stub" />,
}));
vi.mock("@/features/analytics/components/SkillRecommendationCard", () => ({
  SkillRecommendationCard: () => <div data-testid="suggestions-stub" />,
}));

import DashboardPage from "@/app/(analytics)/me/dashboard/page";

beforeEach(() => {
  vi.clearAllMocks();
  getAnalyticsMock.mockResolvedValue({
    statsByRange: {},
    skillBreakdownByRange: {},
    suggestions: [],
  });
});

describe("DashboardPage", () => {
  it("khách: không redirect, không đọc thống kê, hiện thẻ cần đăng nhập với next=/me/dashboard", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { container } = await renderServerTree(await DashboardPage());

    expect(redirectMock).not.toHaveBeenCalled();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
    expect(container.querySelector("h1")?.textContent).toBe("Thống kê");
    expect(container.querySelector("[data-testid='dashboard-stub']")).toBeNull();
    expect(
      container.querySelector("[data-testid='login-required'] a")?.getAttribute("href")
    ).toBe("/?auth=signin&next=%2Fme%2Fdashboard");
  });

  it("người đã đăng nhập: đọc thống kê, dựng biểu đồ, không có thẻ cần đăng nhập", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "u1" });

    const { container } = await renderServerTree(await DashboardPage());

    expect(getAnalyticsMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-testid='dashboard-stub']")).not.toBeNull();
    expect(container.querySelector("[data-testid='login-required']")).toBeNull();
  });
});
