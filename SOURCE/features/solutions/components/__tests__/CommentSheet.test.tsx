// @vitest-environment jsdom

// CommentSheet — UI Spec § Component: CommentSheet; frontend DD § Main
// Components/§ Comment-authoring contract. Required Tests (task 28): #1 (send
// generic), #4 (lockedAnonymous, hàng lạc quan Ẩn danh), #8 (dirty-close
// DD-U5, Reference Contract Value #24), #9 (rate limit), #10 (empty body).
// Required Test #12 (task 28) originally asserted NO report control here —
// task 28's own file pinned that as a task-37 placeholder ("task 37 adds
// 'Báo cáo'"); task 37 supersedes it below with the actual rendered branch,
// proven at the `CommentItem` unit level and re-checked here because
// `CommentSheet` mounts real `CommentItem` rows.
//
// Mock boundary: `@/features/solutions/actions` mocked ở module boundary
// (postComment/deleteComment/reportComment) — `identity.ts` và `RichText`
// chạy THẬT.

import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionDetailComment } from "@/features/solutions/queries";
import type { AuthorIdentity } from "@/lib/solutions/identity";

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
const VIEWER_NAMED: AuthorIdentity = { kind: "named", displayName: "Phạm Văn C" };

function baseProps(overrides: Partial<ComponentProps<typeof CommentSheet>> = {}) {
  return {
    solutionId: "s1",
    questionId: "q1",
    questionNumber: 2,
    comments: [] as SolutionDetailComment[],
    lockedAnonymous: false,
    viewerIdentity: VIEWER_NAMED,
    viewerIsSolutionAuthor: false,
    now: NOW,
    onClose: vi.fn(),
    ...overrides,
  };
}

// jsdom KHÔNG có `matchMedia` — cố ý không polyfill (cùng quy ước
// `SolutionEditorScreen.test.tsx`'s dirty-close test): `usePresence` tự đóng
// NGAY (không chờ hiệu ứng thoát) khi `matchMedia` vắng mặt, nên hộp thoại
// biến mất tức thì trong test thay vì đứng "closing" chờ `setTimeout`.

async function waitForComposer() {
  return screen.findByPlaceholderText("Viết bình luận cho câu này…");
}

describe("CommentSheet — tiêu đề + trạng thái Báo cáo của hàng bình luận (task 37 thay Required Test #12)", () => {
  it("tiêu đề 'Bình luận · Câu 2'; iReported: true -> hiện 'Bạn đã báo cáo bình luận này.' trơ, không gọi reportComment", async () => {
    render(
      <CommentSheet
        {...baseProps({
          comments: [
            {
              id: "c1",
              author: { kind: "named", displayName: "Nguyễn Văn A" },
              isSolutionAuthor: false,
              isMine: false,
              body: "Bình luận có sẵn",
              iReported: true,
              createdAt: "2026-09-26T09:00:00.000Z",
            },
          ],
        })}
      />
    );

    expect(await screen.findByRole("heading", { name: "Bình luận · Câu 2" })).toBeTruthy();
    await screen.findByText("Bình luận có sẵn", {}, { timeout: 5000 });
    const control = screen.getByText("Bạn đã báo cáo bình luận này.");
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("button", { name: "Báo cáo" })).toBeNull();

    fireEvent.click(control);
    expect(screen.queryByRole("dialog", { name: "Báo cáo bình luận" })).toBeNull();
    expect(reportCommentMock).not.toHaveBeenCalled();
  });
});

describe("CommentSheet — gửi generic (Required Test #1)", () => {
  it("postComment generic: hiện đúng chữ, textarea + checkbox không đổi", async () => {
    postCommentMock.mockResolvedValueOnce({ ok: false, error: { code: "generic" } });
    render(<CommentSheet {...baseProps()} />);

    const textarea = await waitForComposer();
    fireEvent.change(textarea, { target: { value: "Bình luận của tôi" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));

    expect(await screen.findByText("Chưa gửi được bình luận. Bạn thử lại nhé.")).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe("Bình luận của tôi");
    expect((screen.getByRole("checkbox", { name: "Ẩn danh" }) as HTMLInputElement).checked).toBe(
      false
    );
  });
});

describe("CommentSheet — rate limit (Required Test #9)", () => {
  it("postComment rateLimited: hiện chữ verbatim với seconds", async () => {
    postCommentMock.mockResolvedValueOnce({
      ok: false,
      error: { code: "rateLimited", seconds: 42 },
    });
    render(<CommentSheet {...baseProps()} />);

    const textarea = await waitForComposer();
    fireEvent.change(textarea, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));

    expect(await screen.findByText("Thao tác quá nhiều lần. Thử lại sau 42 giây.")).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe("abc");
  });
});

describe("CommentSheet — bình luận rỗng (Required Test #10)", () => {
  it("gửi chuỗi khoảng trắng: hiện lỗi rỗng, không gọi postComment", async () => {
    render(<CommentSheet {...baseProps()} />);

    const textarea = await waitForComposer();
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));

    expect(await screen.findByText("Bạn hãy viết nội dung trước khi gửi.")).toBeTruthy();
    expect(postCommentMock).not.toHaveBeenCalled();
  });
});

describe("CommentSheet — lockedAnonymous (Required Test #4, S4)", () => {
  it("checkbox khoá bật + hàng lạc quan sau khi gửi thành công là Ẩn danh", async () => {
    postCommentMock.mockResolvedValueOnce({
      ok: true,
      comment: {
        id: "new1",
        createdAt: "2026-09-26T10:00:01.000Z",
        solutionId: "s1",
        questionId: "q1",
        body: "Bình luận của người viết",
        isAnonymous: true,
      },
    });

    render(
      <CommentSheet
        {...baseProps({ lockedAnonymous: true, viewerIsSolutionAuthor: true, comments: [] })}
      />
    );

    const checkbox = (await screen.findByRole("checkbox", { name: "Ẩn danh" })) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute("aria-disabled")).toBe("true");

    // Cố tình bấm vào checkbox đã khoá: giá trị gửi đi vẫn phải là true dù có
    // ai đó cố ép đổi — không chỉ đúng lúc render ban đầu.
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute("aria-disabled")).toBe("true");

    const textarea = await waitForComposer();
    fireEvent.change(textarea, { target: { value: "Bình luận của người viết" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));

    expect(postCommentMock).toHaveBeenCalledWith("s1", "q1", "Bình luận của người viết", true);
    await screen.findByText("Bình luận của người viết");
    const row = within(screen.getByRole("list"));
    expect(row.getByText("Ẩn danh")).toBeTruthy();
    expect(row.getByText("Người viết")).toBeTruthy();
    // Không tên thật nào của người viết bị lộ qua hàng vừa gửi.
    expect(screen.queryByText("Phạm Văn C")).toBeNull();
  });
});

describe("CommentSheet — dirty-close (Required Test #8, DD-U5/Reference Contract #24)", () => {
  it("Lưu hỏng: hộp thoại vẫn mở với lỗi TRONG nó, tấm trượt giữ chữ + Ẩn danh; Lưu lần 2 thành công đóng cả hai", async () => {
    postCommentMock
      .mockResolvedValueOnce({ ok: false, error: { code: "generic" } })
      .mockResolvedValueOnce({
        ok: true,
        comment: {
          id: "new2",
          createdAt: "2026-09-26T10:05:00.000Z",
          solutionId: "s1",
          questionId: "q1",
          body: "Chưa gửi xong",
          isAnonymous: false,
        },
      });
    const onClose = vi.fn();

    render(<CommentSheet {...baseProps({ onClose })} />);

    const textarea = await waitForComposer();
    fireEvent.change(textarea, { target: { value: "Chưa gửi xong" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Ẩn danh" }));

    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    const dialog = await screen.findByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));

    expect(
      await within(dialog).findByText("Chưa gửi được bình luận. Bạn thử lại nhé.")
    ).toBeTruthy();
    // Lỗi CHỈ hiện MỘT chỗ (trong hộp thoại) — dòng alert của composer không
    // đổi (Reference Contract Value #24: "not the sheet's").
    expect(screen.getAllByText("Chưa gửi được bình luận. Bạn thử lại nhé.").length).toBe(1);
    expect(within(dialog).getByRole("button", { name: "Lưu" })).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Chưa gửi xong");
    expect((screen.getByRole("checkbox", { name: "Ẩn danh" }) as HTMLInputElement).checked).toBe(
      true
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // "dialog" của chính CommentSheet (OverlaySheet) vẫn còn trong DOM ở bài
    // test này vì `onClose` chỉ là spy — cha thật (SolutionViewScreen) mới là
    // nơi gỡ hẳn component khỏi cây; ở đây chỉ cần hộp thoại BA LỰA CHỌN biến
    // mất, đúng ý "Lưu lần hai thành công đóng cả hai lớp".
    expect(screen.queryByRole("dialog", { name: "Bạn có thay đổi chưa lưu" })).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(postCommentMock).toHaveBeenCalledTimes(2);
  });
});
