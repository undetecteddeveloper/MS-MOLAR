// @vitest-environment jsdom

// ProfilePage — task 44: khung ProfileTabs + `getMyReputation()` cho
// `reputationSlot` (AC-096: lỗi hoặc ném ⇒ không có khối, không băng lỗi, mọi
// hành vi khác của thẻ tài khoản giữ nguyên). Task 45: `getMyUnreadCommentCount()`
// (không lọc theo bài) đúng MỘT lần mỗi lượt render, BẤT KỂ tab, truyền vào
// chip "Bình luận" của `ProfileTabs`; ô "Bình luận" render `ProfileCommentsTab`
// (Required Test #3, task 45 task file § Required Tests). Gọi thẳng hàm async
// của Server Component, KHÔNG qua Next runtime thật — cùng khuôn
// `exams/[id]/attempt/[attemptId]/solution/__tests__/page.test.tsx`.
//
// Mock boundary: `@/features/solutions/queries` mocked hoàn toàn.
// `ProfileCommentsTab` (task 45) là Server Component ASYNC — `ReactDOM.render`
// thường (RTL, không phải trình dựng RSC thật của Next) KHÔNG dựng được một
// component con async lồng trong cây JSX đã trả về (khác lượt gọi trực tiếp +
// await ở CHÍNH `ProfilePage`, việc `renderPage()` này đã làm). Mock nó ở
// boundary module — hành vi THẬT của `ProfileCommentsTab` có bộ test riêng
// (`ProfileCommentsTab.test.tsx`); file này chỉ cần xác nhận trang TRUYỀN đúng
// `page` prop và render nó ở đúng nhánh tab.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUserProfile } from "@/lib/auth/getCurrentUser";

const {
  getCurrentUserProfileMock,
  getMyReputationMock,
  getMyUnreadCommentCountMock,
  markCommentsReadMock,
  profileCommentsTabMock,
  profileSolutionsTabMock,
} = vi.hoisted(() => ({
  getCurrentUserProfileMock: vi.fn(),
  getMyReputationMock: vi.fn(),
  getMyUnreadCommentCountMock: vi.fn(),
  markCommentsReadMock: vi.fn(),
  profileCommentsTabMock: vi.fn((props: { page: number }) => (
    <div data-testid="profile-comments-tab" data-page={props.page} />
  )),
  profileSolutionsTabMock: vi.fn(() => <div data-testid="profile-solutions-tab" />),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
}));
vi.mock("@/features/solutions/queries", () => ({
  getMyReputation: getMyReputationMock,
  getMyUnreadCommentCount: getMyUnreadCommentCountMock,
}));
vi.mock("@/features/solutions/actions", () => ({
  markCommentsRead: markCommentsReadMock,
}));
vi.mock("@/features/solutions/components/ProfileCommentsTab", () => ({
  ProfileCommentsTab: profileCommentsTabMock,
}));
// Cùng lý do với ProfileCommentsTab: Server Component async, hành vi thật có bộ
// test riêng (`ProfileSolutionsTab.test.tsx`).
vi.mock("@/features/solutions/components/ProfileSolutionsTab", () => ({
  ProfileSolutionsTab: profileSolutionsTabMock,
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
  getMyUnreadCommentCountMock.mockReset();
  markCommentsReadMock.mockReset();
  profileCommentsTabMock.mockClear();
  profileSolutionsTabMock.mockClear();
  getCurrentUserProfileMock.mockResolvedValue(USER);
  getMyUnreadCommentCountMock.mockResolvedValue(0);
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

describe("ProfilePage — getMyUnreadCommentCount() cho chip 'Bình luận' (task 45, AC-091/AC-092, Required Test #3)", () => {
  it("tab 'account': gọi đúng MỘT lần, số truyền vào tên trợ năng của chip", async () => {
    getMyReputationMock.mockResolvedValue({ ok: false });
    getMyUnreadCommentCountMock.mockResolvedValue(3);

    const jsx = await ProfilePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(getMyUnreadCommentCountMock).toHaveBeenCalledTimes(1);
    expect(getMyUnreadCommentCountMock).toHaveBeenCalledWith();
    expect(screen.getByRole("button", { name: "Bình luận, 3 bình luận mới" })).toBeTruthy();
  });

  it("tab 'comments': vẫn gọi getMyUnreadCommentCount đúng MỘT lần — chip cần số này bất kể tab đang mở", async () => {
    getMyUnreadCommentCountMock.mockResolvedValue(5);

    const jsx = await ProfilePage({ searchParams: Promise.resolve({ tab: "comments" }) });
    render(jsx);

    expect(getMyUnreadCommentCountMock).toHaveBeenCalledTimes(1);
    expect(getMyReputationMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Bình luận, 5 bình luận mới" })).toBeTruthy();
  });

  it("k = 0: tên trợ năng chip giữ nguyên 'Bình luận', không có số", async () => {
    getMyReputationMock.mockResolvedValue({ ok: false });
    getMyUnreadCommentCountMock.mockResolvedValue(0);

    const jsx = await ProfilePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByRole("button", { name: "Bình luận" })).toBeTruthy();
  });
});

describe("ProfilePage — ô 'Bình luận' render ProfileCommentsTab với đúng page (task 45)", () => {
  it("tab=comments, không có ?cpage: ProfileCommentsTab nhận page=1, ProfileCard KHÔNG render", async () => {
    getMyUnreadCommentCountMock.mockResolvedValue(0);

    const jsx = await ProfilePage({ searchParams: Promise.resolve({ tab: "comments" }) });
    render(jsx);

    expect(profileCommentsTabMock).toHaveBeenCalledTimes(1);
    expect(profileCommentsTabMock.mock.calls[0][0]).toEqual({ page: 1 });
    expect(screen.getByTestId("profile-comments-tab")).toBeTruthy();
    expect(screen.queryByText("an.nguyen")).toBeNull();
  });

  it("?cpage=3: ProfileCommentsTab nhận page=3", async () => {
    getMyUnreadCommentCountMock.mockResolvedValue(0);

    const jsx = await ProfilePage({
      searchParams: Promise.resolve({ tab: "comments", cpage: "3" }),
    });
    render(jsx);

    expect(profileCommentsTabMock.mock.calls[0][0]).toEqual({ page: 3 });
  });

  it("?cpage không parse được: rơi về page=1, không lỗi", async () => {
    getMyUnreadCommentCountMock.mockResolvedValue(0);

    const jsx = await ProfilePage({
      searchParams: Promise.resolve({ tab: "comments", cpage: "abc" }),
    });
    render(jsx);

    expect(profileCommentsTabMock.mock.calls[0][0]).toEqual({ page: 1 });
  });

  it("tab='account': ProfileCommentsTab KHÔNG được gọi", async () => {
    getMyUnreadCommentCountMock.mockResolvedValue(0);
    getMyReputationMock.mockResolvedValue({ ok: false });

    const jsx = await ProfilePage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(profileCommentsTabMock).not.toHaveBeenCalled();
  });
});

describe("ProfilePage — ô 'Bài giải' render ProfileSolutionsTab (2026-10-03)", () => {
  it("tab=solutions: render ProfileSolutionsTab, KHÔNG render ProfileCard/ProfileCommentsTab, không đọc uy tín", async () => {
    const jsx = await ProfilePage({ searchParams: Promise.resolve({ tab: "solutions" }) });
    render(jsx);

    expect(profileSolutionsTabMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("profile-solutions-tab")).toBeTruthy();
    expect(profileCommentsTabMock).not.toHaveBeenCalled();
    expect(getMyReputationMock).not.toHaveBeenCalled();
    expect(screen.queryByText("an.nguyen")).toBeNull();
    // Chip "Bình luận" vẫn cần số chưa đọc dù đang ở ô khác.
    expect(getMyUnreadCommentCountMock).toHaveBeenCalledTimes(1);
  });

  it("tab='account' và tab='comments': ProfileSolutionsTab KHÔNG được gọi", async () => {
    getMyReputationMock.mockResolvedValue({ ok: false });

    render(await ProfilePage({ searchParams: Promise.resolve({}) }));
    cleanup();
    render(await ProfilePage({ searchParams: Promise.resolve({ tab: "comments" }) }));

    expect(profileSolutionsTabMock).not.toHaveBeenCalled();
  });
});
