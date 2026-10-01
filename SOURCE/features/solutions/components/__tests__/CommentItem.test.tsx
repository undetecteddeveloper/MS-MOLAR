// @vitest-environment jsdom

// CommentItem — UI Spec § Component: CommentItem; frontend DD § Main
// Components. Required Tests (task 28): #2 (delete generic, DD-U3), #3
// (masked own row, AC-105/S4), #6 (hidden own comment, S19/UI-D19).
// Required Tests (task 37, frontend DD v1.6 § Test Boundaries "Already-reported
// tests → Task 37"): report affordance + `ReportDialog` wiring (comment
// variant) — items 1-8 below, in the order the task file lists them.
//
// Mock boundary: `@/features/solutions/actions` mocked at the module boundary
// (`deleteComment`, `reportComment` — this file never calls `postComment` or
// `reportSolution`); `ReportDialog` (task 36) renders for real, `identity.ts`
// and `RichText` stay real (task 28 binding instruction, unchanged by task 37).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionDetailComment } from "@/features/solutions/queries";

const { deleteCommentMock, reportCommentMock } = vi.hoisted(() => ({
  deleteCommentMock: vi.fn(),
  reportCommentMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  deleteComment: deleteCommentMock,
  reportComment: reportCommentMock,
}));

const { CommentItem } = await import("@/features/solutions/components/CommentItem");

afterEach(cleanup);
beforeEach(() => {
  deleteCommentMock.mockReset();
  reportCommentMock.mockReset();
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
        comment={comment({
          isMine: true,
          isHiddenByAdmin: true,
          hiddenReason: "Ngôn từ không phù hợp",
        })}
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

    render(
      <CommentItem comment={comment({ id: "c9", isMine: true })} now={NOW} onDeleted={onDeleted} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    const dialog = await screen.findByRole("dialog", { name: "Xoá bình luận này?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xoá" }));

    const alert = await screen.findByText("Chưa xoá được bình luận. Bạn thử lại nhé.");
    expect(alert).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Bình luận thường", {}, { timeout: 5000 })).toBeTruthy();
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

// ─── Task 37 — Báo cáo bình luận (Required Tests #1-8) ──────────────────────

describe("CommentItem — Báo cáo (Required Test #1: đã báo cáo sẵn, trơ)", () => {
  it("iReported: true -> 'Bạn đã báo cáo bình luận này.' aria-disabled=true, không disabled gốc, bấm không mở dialog, reportComment 0 lần", () => {
    render(
      <CommentItem
        comment={comment({ isMine: false, iReported: true })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    const control = screen.getByText("Bạn đã báo cáo bình luận này.");
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);

    fireEvent.click(control);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(reportCommentMock).not.toHaveBeenCalled();
  });
});

describe("CommentItem — Báo cáo (Required Test #2: mở dialog + lật phiên alreadyReported:false)", () => {
  it("iReported: false -> bấm 'Báo cáo' mở dialog; {ok:true, alreadyReported:false} đóng dialog + hiện 'Bạn đã báo cáo...'", async () => {
    reportCommentMock.mockResolvedValueOnce({ ok: true, alreadyReported: false });

    render(
      <CommentItem
        comment={comment({ id: "c2", isMine: false, iReported: false })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));
    expect(screen.getByRole("dialog", { name: "Báo cáo bình luận" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const control = screen.getByText("Bạn đã báo cáo bình luận này.");
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
  });
});

describe("CommentItem — Báo cáo (Required Test #3: DOM giống hệt cho cả hai giá trị alreadyReported)", () => {
  it("alreadyReported:true và alreadyReported:false lật ra CÙNG một DOM (một nhánh, không phải hai)", async () => {
    reportCommentMock.mockResolvedValueOnce({ ok: true, alreadyReported: false });
    const viaFalse = render(
      <CommentItem
        comment={comment({ isMine: false, iReported: false })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const falseFlipHtml = screen.getByText("Bạn đã báo cáo bình luận này.").outerHTML;
    viaFalse.unmount();
    cleanup();

    reportCommentMock.mockResolvedValueOnce({ ok: true, alreadyReported: true });
    render(
      <CommentItem
        comment={comment({ isMine: false, iReported: false })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Trùng lần trước" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const trueFlipHtml = screen.getByText("Bạn đã báo cáo bình luận này.").outerHTML;

    expect(trueFlipHtml).toBe(falseFlipHtml);
  });
});

describe("CommentItem — Báo cáo (Required Test #4: generic giữ dialog mở)", () => {
  it("{ ok: false, error: { code: 'generic' } } giữ dialog mở với report.errorGeneric, mục vẫn bấm được", async () => {
    reportCommentMock.mockResolvedValueOnce({ ok: false, error: { code: "generic" } });

    render(
      <CommentItem
        comment={comment({ isMine: false, iReported: false })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sai sự thật" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa gửi được báo cáo. Bạn thử lại sau nhé.");
    expect(screen.getByRole("dialog", { name: "Báo cáo bình luận" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Báo cáo" })).toBeTruthy();
  });
});

describe("CommentItem — Báo cáo (Required Test #5: hàng bị admin ẩn của chính mình — không control nào)", () => {
  it("isHiddenByAdmin:true, isMine:true, iReported:false -> UI-D19 + lý do, không Xoá, không Báo cáo, không 'Bạn đã báo cáo'", () => {
    render(
      <CommentItem
        comment={comment({
          isMine: true,
          isHiddenByAdmin: true,
          hiddenReason: "spam",
          iReported: false,
        })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    expect(screen.getByText("Bình luận đã bị ẩn bởi quản trị viên. Lý do: spam")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Báo cáo" })).toBeNull();
    expect(screen.queryByText(/Bạn đã báo cáo/)).toBeNull();
  });
});

describe("CommentItem — Báo cáo (Required Test #6: bình luận của tôi còn hiện — chỉ Xoá)", () => {
  it("isMine:true, isHiddenByAdmin vắng mặt -> hiện Xoá, không control báo cáo nào", () => {
    render(<CommentItem comment={comment({ isMine: true })} now={NOW} onDeleted={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Xoá" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Báo cáo" })).toBeNull();
    expect(screen.queryByText(/Bạn đã báo cáo/)).toBeNull();
  });
});

describe("CommentItem — Báo cáo (Required Test #7: đúng action, đúng id, đúng tiêu đề)", () => {
  it("gửi lý do gọi reportComment (không phải reportSolution) với id bình luận; tiêu đề dialog là report.commentTitle", () => {
    reportCommentMock.mockResolvedValueOnce({ ok: true, alreadyReported: false });

    render(
      <CommentItem
        comment={comment({ id: "c-xyz", isMine: false })}
        now={NOW}
        onDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));
    expect(screen.getByRole("dialog", { name: "Báo cáo bình luận" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ngôn từ không phù hợp" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    expect(reportCommentMock).toHaveBeenCalledWith("c-xyz", "Ngôn từ không phù hợp");
  });
});

describe("CommentItem — Báo cáo (Required Test #8: lý do rỗng, cùng luật với biến thể bài giải)", () => {
  it("lý do rỗng -> role=alert report.errorEmpty, KHÔNG gọi reportComment", () => {
    render(<CommentItem comment={comment({ isMine: false })} now={NOW} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Báo cáo" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy mô tả vấn đề trước khi gửi.");
    expect(reportCommentMock).not.toHaveBeenCalled();
  });
});
