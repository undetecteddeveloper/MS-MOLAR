// @vitest-environment jsdom

// ProfileTabs — AC-095 đòi CẢ HAI: `aria-pressed` phản chiếu ô đang chọn VÀ
// URL phản chiếu nó (round-trip: `?tab=comments` ↔ ô Bình luận). Bấm "Bình
// luận" còn gọi `markCommentsRead()` như một side-effect nền IM LẶNG (frontend
// DD § UI Action - API Contract Mapping, hàng `communityCommentsMarkRead`:
// "silent retry-next-visit — no user-blocking error UI") — thất bại không
// được phép hiện bất kỳ UI lỗi nào.

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pushMock, markCommentsReadMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  markCommentsReadMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/solutions/actions", () => ({
  markCommentsRead: markCommentsReadMock,
}));

import { ProfileTabs } from "@/features/solutions/components/ProfileTabs";

afterEach(() => {
  cleanup();
  pushMock.mockClear();
  markCommentsReadMock.mockReset();
});

describe("ProfileTabs — AC-095, URL và aria-pressed đổi cùng lúc", () => {
  it("từ ô Tài khoản, bấm Bình luận → router.push('...?tab=comments') và chip Bình luận aria-pressed=true; bấm lại Tài khoản → bỏ tham số", () => {
    markCommentsReadMock.mockResolvedValue({ ok: true });
    render(<ProfileTabs activeTab="account" />);

    const accountChip = screen.getByRole("button", { name: "Tài khoản" });
    const commentsChip = screen.getByRole("button", { name: "Bình luận" });
    expect(accountChip.getAttribute("aria-pressed")).toBe("true");
    expect(commentsChip.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      commentsChip.click();
    });

    expect(pushMock).toHaveBeenCalledWith("/profile?tab=comments", { scroll: false });
    expect(commentsChip.getAttribute("aria-pressed")).toBe("true");
    expect(accountChip.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      accountChip.click();
    });

    expect(pushMock).toHaveBeenCalledWith("/profile", { scroll: false });
    expect(accountChip.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ProfileTabs — commentCount đổi tên trợ năng của chip (task 45, AC-091/AC-092)", () => {
  it("commentCount=3: tên trợ năng 'Bình luận, 3 bình luận mới', kèm chấm aria-hidden", () => {
    markCommentsReadMock.mockResolvedValue({ ok: true });
    const { container } = render(<ProfileTabs activeTab="account" commentCount={3} />);

    expect(screen.getByRole("button", { name: "Bình luận, 3 bình luận mới" })).toBeTruthy();
    const dot = container.querySelector("button[aria-label] span[aria-hidden].bg-destructive.size-2.rounded-full");
    expect(dot).toBeTruthy();
  });

  it("commentCount=0: tên trợ năng giữ nguyên 'Bình luận', không chấm", () => {
    markCommentsReadMock.mockResolvedValue({ ok: true });
    render(<ProfileTabs activeTab="account" commentCount={0} />);

    expect(screen.getByRole("button", { name: "Bình luận" })).toBeTruthy();
  });

  it("không truyền commentCount: tên trợ năng giữ nguyên 'Bình luận', không chấm (hành vi cũ của task 44 không đổi)", () => {
    markCommentsReadMock.mockResolvedValue({ ok: true });
    render(<ProfileTabs activeTab="account" />);

    expect(screen.getByRole("button", { name: "Bình luận" })).toBeTruthy();
  });
});

describe("ProfileTabs — markCommentsRead là side-effect nền im lặng", () => {
  it("bấm Bình luận gọi markCommentsRead đúng một lần", () => {
    markCommentsReadMock.mockResolvedValue({ ok: true });
    render(<ProfileTabs activeTab="account" />);

    act(() => {
      screen.getByRole("button", { name: "Bình luận" }).click();
    });

    expect(markCommentsReadMock).toHaveBeenCalledTimes(1);
  });

  it("markCommentsRead thất bại (reject) → không có UI lỗi nào (không role=alert, không thay đổi chip)", async () => {
    markCommentsReadMock.mockRejectedValue(new Error("rate limited"));
    render(<ProfileTabs activeTab="account" />);

    await act(async () => {
      screen.getByRole("button", { name: "Bình luận" }).click();
      // Đợi promise bị reject giải quyết xong trong cùng lượt act().
      await Promise.resolve().then(() => Promise.resolve());
    });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Bình luận" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});

describe("ProfileTabs — chip Bài giải (2026-10-03)", () => {
  it("bấm Bài giải → router.push('...?tab=solutions'), chip aria-pressed=true, KHÔNG gọi markCommentsRead", () => {
    render(<ProfileTabs activeTab="account" />);

    const solutionsChip = screen.getByRole("button", { name: "Bài giải" });
    expect(solutionsChip.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      solutionsChip.click();
    });

    expect(pushMock).toHaveBeenCalledWith("/profile?tab=solutions", { scroll: false });
    expect(solutionsChip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Tài khoản" }).getAttribute("aria-pressed")).toBe("false");
    expect(markCommentsReadMock).not.toHaveBeenCalled();
  });

  it("activeTab='solutions': chỉ chip Bài giải được chọn; thứ tự chip là Tài khoản, Bài giải, Bình luận", () => {
    render(<ProfileTabs activeTab="solutions" />);

    const chips = screen.getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["Tài khoản", "Bài giải", "Bình luận"]);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
  });
});
