// @vitest-environment jsdom

// ProfilePage — task 44: khung ProfileTabs + `getMyReputation()` cho
// `reputationSlot` (AC-096: lỗi hoặc ném ⇒ không có khối, không băng lỗi, mọi
// hành vi khác của thẻ tài khoản giữ nguyên). Gọi thẳng hàm async của Server
// Component, KHÔNG qua Next runtime thật — cùng khuôn
// `exams/[id]/attempt/[attemptId]/solution/__tests__/page.test.tsx`.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserProfile } from "@/lib/auth/getCurrentUser";

const { getCurrentUserProfileMock, getMyReputationMock, markCommentsReadMock } = vi.hoisted(() => ({
  getCurrentUserProfileMock: vi.fn(),
  getMyReputationMock: vi.fn(),
  markCommentsReadMock: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
}));
vi.mock("@/features/solutions/queries", () => ({
  getMyReputation: getMyReputationMock,
}));
vi.mock("@/features/solutions/actions", () => ({
  markCommentsRead: markCommentsReadMock,
}));
// ProfileCard (rendered on the account tab) imports these at module top level.
vi.mock("@/features/auth/actions", () => ({
  changeAvatar: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const { default: ProfilePage } = await import("@/app/(analytics)/profile/page");

const USER: CurrentUserProfile = {
  id: "u1",
  email: "an.nguyen@example.com",
  displayName: "an.nguyen",
  avatarUrl: null,
};

afterEach(cleanup);
beforeEach(() => {
  getCurrentUserProfileMock.mockReset();
  getMyReputationMock.mockReset();
  markCommentsReadMock.mockReset();
  getCurrentUserProfileMock.mockResolvedValue(USER);
});

describe("ProfilePage — getMyReputation() thất bại hoặc ném (AC-096)", () => {
  it("kết quả { ok: false } ⇒ không có khối uy tín, không băng lỗi, thẻ tài khoản vẫn đầy đủ", async () => {
    getMyReputationMock.mockResolvedValue({ ok: false });

    const jsx = await ProfilePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.queryByText("Điểm uy tín")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("an.nguyen")).toBeDefined();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeDefined();
  });

  it("getMyReputation() ném lỗi ⇒ cũng không có khối uy tín, không băng lỗi", async () => {
    getMyReputationMock.mockRejectedValue(new Error("boom"));

    const jsx = await ProfilePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.queryByText("Điểm uy tín")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeDefined();
  });
});
