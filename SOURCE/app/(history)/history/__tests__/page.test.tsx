// @vitest-environment jsdom

// app/(history)/history/page.tsx — khách chưa đăng nhập (brief 20261012 T3).
//
// Bất biến: vào được trang (không redirect), thấy khung + thẻ "cần đăng nhập",
// và KHÔNG có lượt đọc lịch sử nào (AC-016: 0 hàng lượt làm bị fetch cho khách).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

vi.mock("server-only", () => ({}));

const { getProfileMock, listMyHistoryMock, redirectMock } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
  listMyHistoryMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUserProfile: getProfileMock }));
vi.mock("@/features/history/queries", () => ({ listMyHistory: listMyHistoryMock }));

import HistoryPage from "@/app/(history)/history/page";

beforeEach(() => {
  vi.clearAllMocks();
  listMyHistoryMock.mockResolvedValue([]);
});

describe("HistoryPage — khách chưa đăng nhập", () => {
  beforeEach(() => getProfileMock.mockResolvedValue(null));

  it("không redirect, không đọc lịch sử, hiện thẻ cần đăng nhập với next=/history", async () => {
    const { container } = await renderServerTree(
      <HistoryPage searchParams={Promise.resolve({})} />
    );

    expect(redirectMock).not.toHaveBeenCalled();
    expect(listMyHistoryMock).not.toHaveBeenCalled();

    expect(container.querySelector("h1")?.textContent).toBe("Lịch sử");
    const card = container.querySelector("[data-testid='login-required']");
    expect(card).not.toBeNull();
    expect(card?.querySelector("a")?.getAttribute("href")).toBe(
      "/?auth=signin&next=%2Fhistory"
    );
  });
});

describe("HistoryPage — người đã đăng nhập", () => {
  it("đọc lịch sử và KHÔNG hiện thẻ cần đăng nhập", async () => {
    getProfileMock.mockResolvedValue({ id: "u1", displayName: "An" });

    const { container } = await renderServerTree(
      <HistoryPage searchParams={Promise.resolve({})} />
    );

    expect(listMyHistoryMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-testid='login-required']")).toBeNull();
  });
});
