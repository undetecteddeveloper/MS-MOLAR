// @vitest-environment jsdom

// CommentSheet — trả lời một cấp, hướng C (docs/design/community-solutions-comment-replies.md,
// AC-R1/R2/R4/R6/R8/R9). Mock boundary giống CommentSheet.test.tsx: chỉ
// `@/features/solutions/actions`; RichText/identity chạy thật.

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionDetailComment } from "@/features/solutions/queries";

const { postCommentMock, deleteCommentMock, reportCommentMock } = vi.hoisted(() => ({
  postCommentMock: vi.fn(),
  deleteCommentMock: vi.fn(),
  reportCommentMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  postComment: postCommentMock,
  deleteComment: deleteCommentMock,
  reportComment: reportCommentMock,
}));

const { CommentSheet } = await import("@/features/solutions/components/CommentSheet");

afterEach(cleanup);
beforeEach(() => {
  postCommentMock.mockReset();
  deleteCommentMock.mockReset();
  reportCommentMock.mockReset();
});

const NOW = new Date("2026-09-26T10:00:00.000Z");

function comment(
  overrides: Partial<SolutionDetailComment> & { id: string }
): SolutionDetailComment {
  return {
    author: { kind: "named", displayName: "Lê Hoàng" },
    isSolutionAuthor: false,
    isMine: false,
    body: `Nội dung ${overrides.id}`,
    iReported: false,
    createdAt: "2026-09-26T09:00:00.000Z",
    parentId: null,
    replyToId: null,
    ...overrides,
  };
}

const ROOT = comment({ id: "root", body: "Sao đỉnh lại là (2; −1) vậy ạ?" });
const REPLY_A = comment({
  id: "ra",
  parentId: "root",
  replyToId: "root",
  author: { kind: "named", displayName: "AnhPhat" },
  isSolutionAuthor: true,
  body: "Thay x = 2 vào nhé",
});
const REPLY_B = comment({
  id: "rb",
  parentId: "root",
  replyToId: "ra",
  author: { kind: "anonymous" },
  body: "Mình cũng nhầm chỗ này",
});

function baseProps(overrides: Partial<ComponentProps<typeof CommentSheet>> = {}) {
  return {
    solutionId: "s1",
    questionId: "q1",
    questionNumber: 2,
    comments: [ROOT, REPLY_A, REPLY_B, comment({ id: "other", body: "Một bình luận khác" })],
    lockedAnonymous: false,
    viewerIdentity: { kind: "named", displayName: "Phạm Văn C" } as const,
    viewerIsSolutionAuthor: false,
    now: NOW,
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("CommentSheet — danh sách chỉ hiện bình luận gốc (AC-R1)", () => {
  it("không liệt kê câu trả lời; gốc có trả lời hiện nút '2 trả lời', gốc không có thì không", async () => {
    render(<CommentSheet {...baseProps()} />);

    // Lượt đầu của file nạp chunk RichText thật — cho thêm thời gian hơn mặc định 1s.
    expect(
      await screen.findByText("Sao đỉnh lại là (2; −1) vậy ạ?", {}, { timeout: 5000 })
    ).toBeTruthy();
    expect(screen.getByText("Một bình luận khác")).toBeTruthy();
    expect(screen.queryByText("Thay x = 2 vào nhé")).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: /trả lời$/ })
        .filter((b) => /^\d+ trả lời/.test(b.textContent ?? ""))
    ).toHaveLength(1);
    expect(screen.getByRole("button", { name: "2 trả lời" })).toBeTruthy();
  });
});

describe("CommentSheet — mạch trả lời (AC-R1, AC-R2, AC-R9)", () => {
  it("bấm '2 trả lời' → tiêu đề 'Trả lời · Câu 2', gốc + trả lời hiện, nút ← và ô nhập mang tên người được trả lời", async () => {
    render(<CommentSheet {...baseProps()} />);
    await screen.findByText("Sao đỉnh lại là (2; −1) vậy ạ?");

    fireEvent.click(screen.getByRole("button", { name: "2 trả lời" }));

    expect(await screen.findByRole("heading", { name: "Trả lời · Câu 2" })).toBeTruthy();
    expect(await screen.findByText("Thay x = 2 vào nhé")).toBeTruthy();
    expect(screen.getByText("Mình cũng nhầm chỗ này")).toBeTruthy();
    expect(screen.queryByText("Một bình luận khác")).toBeNull();
    expect(screen.getByRole("button", { name: "Về danh sách bình luận" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Trả lời Lê Hoàng…")).toBeTruthy();
  });

  it("gửi trả lời ở mạch: postComment nhận id gốc; hàng mới hiện trong mạch với parentId/replyToId của server", async () => {
    postCommentMock.mockResolvedValueOnce({
      ok: true,
      comment: {
        id: "new1",
        createdAt: "2026-09-26T10:00:00.000Z",
        solutionId: "s1",
        questionId: "q1",
        body: "Cảm ơn bạn",
        isAnonymous: false,
        parentId: "root",
        replyToId: "root",
      },
    });
    render(<CommentSheet {...baseProps()} />);
    await screen.findByText("Sao đỉnh lại là (2; −1) vậy ạ?");
    fireEvent.click(screen.getByRole("button", { name: "2 trả lời" }));

    fireEvent.change(await screen.findByPlaceholderText("Trả lời Lê Hoàng…"), {
      target: { value: "Cảm ơn bạn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));

    expect(await screen.findByText("Cảm ơn bạn")).toBeTruthy();
    expect(postCommentMock).toHaveBeenCalledWith("s1", "q1", "Cảm ơn bạn", false, "root");
  });

  it("'Trả lời' trên một câu trả lời → điền '@Tên ' và gửi với replyToId là câu đó (người ẩn danh → @Ẩn danh)", async () => {
    postCommentMock.mockResolvedValueOnce({
      ok: true,
      comment: {
        id: "new2",
        createdAt: "2026-09-26T10:00:00.000Z",
        solutionId: "s1",
        questionId: "q1",
        body: "@Ẩn danh ok",
        isAnonymous: false,
        parentId: "root",
        replyToId: "rb",
      },
    });
    render(<CommentSheet {...baseProps()} />);
    await screen.findByText("Sao đỉnh lại là (2; −1) vậy ạ?");
    fireEvent.click(screen.getByRole("button", { name: "2 trả lời" }));
    const mine = await screen.findByText("Mình cũng nhầm chỗ này");

    const row = mine.closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Trả lời" }));

    const box = screen.getByPlaceholderText("Trả lời Lê Hoàng…") as HTMLTextAreaElement;
    expect(box.value).toBe("@Ẩn danh ");
    fireEvent.change(box, { target: { value: "@Ẩn danh ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));

    await screen.findByText("@Ẩn danh ok");
    expect(postCommentMock).toHaveBeenCalledWith("s1", "q1", "@Ẩn danh ok", false, "rb");
  });

  it("nút ← và Escape lùi một tầng về danh sách (không đóng tấm trượt); nút X đóng", async () => {
    const onClose = vi.fn();
    render(<CommentSheet {...baseProps({ onClose })} />);
    await screen.findByText("Sao đỉnh lại là (2; −1) vậy ạ?");
    fireEvent.click(screen.getByRole("button", { name: "2 trả lời" }));
    await screen.findByRole("heading", { name: "Trả lời · Câu 2" });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(await screen.findByRole("heading", { name: "Bình luận · Câu 2" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "2 trả lời" }));
    fireEvent.click(await screen.findByRole("button", { name: "Về danh sách bình luận" }));
    expect(await screen.findByRole("heading", { name: "Bình luận · Câu 2" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("initialThreadId khớp một gốc → mở thẳng mạch (AC-R8); không khớp → mở danh sách", async () => {
    const { unmount } = render(<CommentSheet {...baseProps({ initialThreadId: "root" })} />);
    expect(await screen.findByRole("heading", { name: "Trả lời · Câu 2" })).toBeTruthy();
    unmount();

    render(<CommentSheet {...baseProps({ initialThreadId: "ra" })} />);
    expect(await screen.findByRole("heading", { name: "Bình luận · Câu 2" })).toBeTruthy();
  });
});

describe("CommentSheet — xoá gốc còn trả lời (AC-R4, AC-R6)", () => {
  it("gốc của tôi còn trả lời → thành dòng mờ không nút, trả lời còn nguyên; gốc không còn trả lời → biến mất", async () => {
    deleteCommentMock.mockResolvedValue({ ok: true });
    render(
      <CommentSheet
        {...baseProps({
          comments: [
            comment({ id: "root", isMine: true, body: "Gốc của tôi" }),
            REPLY_A,
            comment({ id: "solo", isMine: true, body: "Gốc không ai trả lời" }),
          ],
        })}
      />
    );
    const mine = await screen.findByText("Gốc của tôi");

    const row = mine.closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Xoá" }));
    const dialog = await screen.findByRole("dialog", { name: "Xoá bình luận này?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xoá" }));

    const placeholder = await screen.findByText("Bình luận đã bị xoá.");
    expect(screen.queryByText("Gốc của tôi")).toBeNull();
    const placeholderRow = placeholder.closest("li") as HTMLElement;
    expect(within(placeholderRow).queryByRole("button", { name: "Trả lời" })).toBeNull();
    expect(within(placeholderRow).queryByRole("button", { name: "Xoá" })).toBeNull();
    expect(within(placeholderRow).queryByRole("button", { name: "Báo cáo" })).toBeNull();
    expect(within(placeholderRow).getByRole("button", { name: "1 trả lời" })).toBeTruthy();

    const soloRow = screen.getByText("Gốc không ai trả lời").closest("li") as HTMLElement;
    fireEvent.click(within(soloRow).getByRole("button", { name: "Xoá" }));
    const dialog2 = await screen.findByRole("dialog", { name: "Xoá bình luận này?" });
    fireEvent.click(within(dialog2).getByRole("button", { name: "Xoá" }));
    await vi.waitFor(() => expect(screen.queryByText("Gốc không ai trả lời")).toBeNull());
  });

  it("dòng mờ 'bị ẩn bởi quản trị viên' từ server hiện đúng chữ, không danh tính, vẫn mở được mạch", async () => {
    render(
      <CommentSheet
        {...baseProps({
          comments: [
            comment({ id: "root", placeholder: "hidden", body: "", author: { kind: "anonymous" } }),
            REPLY_A,
          ],
        })}
      />
    );

    expect(await screen.findByText("Bình luận đã bị ẩn bởi quản trị viên.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1 trả lời" }));
    expect(await screen.findByText("Thay x = 2 vào nhé")).toBeTruthy();
    expect(screen.getByPlaceholderText("Viết câu trả lời…")).toBeTruthy();
  });
});
