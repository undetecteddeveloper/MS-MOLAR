// @vitest-environment jsdom

// CommentItem — UI Spec § Component: CommentItem; frontend DD § Main
// Components. Required Tests (task 28): #2 (delete generic, DD-U3), #3
// (masked own row, AC-105/S4), #6 (hidden own comment, S19/UI-D19), #12 (no
// report control here — task 37's scope).
//
// Mock boundary: `@/features/solutions/actions` mocked at the module boundary
// (deleteComment only — this file never calls postComment); `identity.ts` and
// `RichText` stay real (task 28 binding instruction).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionDetailComment } from "@/features/solutions/queries";

const { deleteCommentMock } = vi.hoisted(() => ({ deleteCommentMock: vi.fn() }));

vi.mock("@/features/solutions/actions", () => ({ deleteComment: deleteCommentMock }));

const { CommentItem } = await import("@/features/solutions/components/CommentItem");

afterEach(cleanup);
beforeEach(() => {
  deleteCommentMock.mockReset();
});

const NOW = new Date("2026-09-26T10:00:00.000Z");

function comment(overrides: Partial<SolutionDetailComment> = {}): SolutionDetailComment {
  return {
    id: "c1",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isSolutionAuthor: false,
    isMine: false,
    body: "Bình luận thường",
    iReported: false,
    createdAt: "2026-09-26T09:00:00.000Z",
    ...overrides,
  };
}

describe("CommentItem — hàng bị che danh tính của chính người bình luận (Required Test #3, AC-105/S4)", () => {
  it("kind anonymous + isSolutionAuthor + isMine cùng lúc: hiện Ẩn danh, Người viết, Xoá — không tên nào", () => {
    render(
      <CommentItem
        comment={comment({ author: { kind: "anonymous" }, isSolutionAuthor: true, isMine: true })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    expect(screen.getByText("Ẩn danh")).toBeTruthy();
    expect(screen.getByText("Người viết")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xoá" })).toBeTruthy();
    expect(screen.queryByText(/Nguyễn|Trần/)).toBeNull();
  });
});

describe("CommentItem — bình luận bị admin ẩn (Required Test #6, S19/UI-D19)", () => {
  it("isHiddenByAdmin: hiện lý do, không nút Xoá", () => {
    render(
      <CommentItem
        comment={comment({ isMine: true, isHiddenByAdmin: true, hiddenReason: "Ngôn từ không phù hợp" })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    expect(
      screen.getByText("Bình luận đã bị ẩn bởi quản trị viên. Lý do: Ngôn từ không phù hợp")
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });
});

describe("CommentItem — xoá không lạc quan (Required Test #2, DD-U3)", () => {
  it("xoá hỏng (generic): hộp thoại đóng, hàng vẫn còn, dòng lỗi + Thử lại gọi lại đúng id", async () => {
    deleteCommentMock.mockResolvedValueOnce({ ok: false, error: { code: "generic" } });
    const onDeleted = vi.fn();

    render(<CommentItem comment={comment({ id: "c9", isMine: true })} now={NOW} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    const dialog = await screen.findByRole("dialog", { name: "Xoá bình luận này?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xoá" }));

    const alert = await screen.findByText("Chưa xoá được bình luận. Bạn thử lại nhé.");
    expect(alert).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Bình luận thường")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();

    deleteCommentMock.mockResolvedValueOnce({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith("c9"));
    expect(deleteCommentMock).toHaveBeenCalledTimes(2);
    expect(deleteCommentMock).toHaveBeenNthCalledWith(1, "c9");
    expect(deleteCommentMock).toHaveBeenNthCalledWith(2, "c9");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Chưa xoá được bình luận. Bạn thử lại nhé.")).toBeNull();
  });
});

describe("CommentItem — không có nút Báo cáo ở task này (Required Test #12)", () => {
  it("kể cả với iReported: true, không render Báo cáo hay Bạn đã báo cáo", () => {
    render(
      <CommentItem comment={comment({ isMine: false, iReported: true })} now={NOW} onDeleted={vi.fn()} />
    );

    expect(screen.queryByText(/Báo cáo/)).toBeNull();
    expect(screen.queryByText(/Bạn đã báo cáo/)).toBeNull();
  });
});
