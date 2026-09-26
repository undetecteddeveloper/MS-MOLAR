// @vitest-environment jsdom

// ReportedCommentItem — UI Spec § Component: ReportedCommentItem (C-39);
// frontend DD § Test Boundaries (task 38): "Admin hidden-comment item tests",
// "Admin visible-reported-comment `questionNumber` test", "Admin author-shape
// test", "Admin refusal tests" (comment half).
//
// Mock boundary: `@/features/solutions/adminActions` mocked at the module
// boundary; the mocked `moderateCommentAction` is handed to the component as
// its `onModerate` prop, exactly as `app/(admin)/admin/page.tsx` wires the
// real one (B4 — the component itself imports nothing from features/solutions).
// `ConfirmDialog` and `relativeTime` render for real.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminHiddenCommentItem as SolutionsHiddenCommentItem,
  AdminReportedAuthor as SolutionsReportedAuthor,
} from "@/features/solutions/adminActions";

const { moderateCommentActionMock } = vi.hoisted(() => ({ moderateCommentActionMock: vi.fn() }));

vi.mock("@/features/solutions/adminActions", () => ({
  moderateCommentAction: moderateCommentActionMock,
  moderateSolutionAction: vi.fn(),
  listCommunityReports: vi.fn(),
  getSolutionNotesForAdmin: vi.fn(),
}));

const { moderateCommentAction } = await import("@/features/solutions/adminActions");
const { ReportedCommentItem } = await import("@/features/admin/components/ReportedCommentItem");
type AdminReportedAuthor = import("@/features/admin/components/ReportedCommentItem").AdminReportedAuthor;
type AdminHiddenCommentItem = import("@/features/admin/components/ReportedCommentItem").AdminHiddenCommentItem;
type AdminReportedCommentItem = import("@/features/admin/components/ReportedCommentItem").AdminReportedCommentItem;

afterEach(cleanup);
beforeEach(() => {
  moderateCommentActionMock.mockReset();
});

const NOW = new Date("2026-09-27T10:00:00.000Z");

const LAN: AdminReportedAuthor = { displayName: "Lan", isAnonymousToReaders: false };

function hidden(overrides: Partial<AdminHiddenCommentItem> = {}): AdminHiddenCommentItem {
  return {
    id: "hc1",
    questionNumber: 4,
    body: "Nội dung bình luận bị ẩn",
    commenter: LAN,
    hiddenReason: "spam",
    hiddenAt: "2026-09-17T10:00:00Z",
    reportCount: 2,
    ...overrides,
  };
}

function reported(overrides: Partial<AdminReportedCommentItem> = {}): AdminReportedCommentItem {
  return {
    id: "rc1",
    questionNumber: 2,
    body: "Bình luận đang hiện bị báo cáo",
    commenter: LAN,
    reportCount: 3,
    reportReasons: ["Ngôn từ xúc phạm", "Lạc đề"],
    ...overrides,
  };
}

function renderHidden(item: AdminHiddenCommentItem) {
  return render(
    <ul>
      <ReportedCommentItem variant="hidden" item={item} now={NOW} onModerate={moderateCommentAction} />
    </ul>
  );
}

function renderReported(item: AdminReportedCommentItem) {
  return render(
    <ul>
      <ReportedCommentItem variant="reported" item={item} now={NOW} onModerate={moderateCommentAction} />
    </ul>
  );
}

/** Mọi nút văn bản có nội dung khớp `/^Câu \d/` — kiểm cả nút lá lẫn nút cha. */
function questionLabels(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("*")).filter((el) => /^Câu \d/.test(el.textContent ?? ""));
}

describe("ReportedCommentItem — Admin hidden-comment item tests (C-39, S5, AC-047, AC-107)", () => {
  it("questionNumber 4, không ẩn danh: 'Câu 4', 'Lan', KHÔNG có chú thích 'ẩn danh với người đọc'", () => {
    renderHidden(hidden());

    expect(screen.getByText("Câu 4")).toBeTruthy();
    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.queryByText(/ẩn danh với người đọc/)).toBeNull();
  });

  it("isAnonymousToReaders: true → 'Lan' VÀ 'ẩn danh với người đọc' cùng có; tên thật không bị thay", () => {
    renderHidden(hidden({ commenter: { displayName: "Lan", isAnonymousToReaders: true } }));

    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.getByText(/ẩn danh với người đọc/)).toBeTruthy();
    expect(screen.queryByText(/^Ẩn danh$/)).toBeNull();
  });

  it("questionNumber: null → không nhãn /^Câu \\d/ nào; thân, 'Lan', lý do, hiddenAt tương đối, số báo cáo, hai nút vẫn đủ", () => {
    const { container } = renderHidden(hidden({ questionNumber: null }));

    expect(questionLabels(container)).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Câu (null|undefined)/);
    expect(screen.getByText("Nội dung bình luận bị ẩn")).toBeTruthy();
    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.getByText("Bình luận đã bị ẩn bởi quản trị viên. Lý do: spam")).toBeTruthy();
    expect(screen.getByText("10 ngày trước")).toBeTruthy();
    expect(screen.getByText("2 báo cáo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Khôi phục" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeTruthy();
  });

  it("reportCount: 0 → vẫn đủ hai nút (bình luận có thể bị ẩn mà chưa từng bị báo cáo)", () => {
    renderHidden(hidden({ reportCount: 0 }));

    expect(screen.getByRole("button", { name: "Khôi phục" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeTruthy();
  });

  it("thân bình luận in dạng văn bản THUẦN — chuỗi trông như HTML hiện nguyên văn, không thành phần tử", () => {
    const { container } = renderHidden(hidden({ body: "<b>đậm</b> **md**" }));

    expect(screen.getByText("<b>đậm</b> **md**")).toBeTruthy();
    expect(container.querySelector("b")).toBeNull();
  });
});

describe("ReportedCommentItem — Admin visible-reported-comment questionNumber test (AC-047, v1.5)", () => {
  it("questionNumber: null → không /^Câu \\d/; thân, người bình luận, lý do, số báo cáo, hai nút vẫn đủ", () => {
    const { container } = renderReported(reported({ questionNumber: null }));

    expect(questionLabels(container)).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Câu (null|undefined)/);
    expect(screen.getByText("Bình luận đang hiện bị báo cáo")).toBeTruthy();
    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.getByText("Ngôn từ xúc phạm")).toBeTruthy();
    expect(screen.getByText("Lạc đề")).toBeTruthy();
    expect(screen.getByText("3 báo cáo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ẩn bình luận" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeTruthy();
  });

  it("questionNumber 2 → hiện 'Câu 2'; không có nút 'Khôi phục' ở bình luận đang hiện", () => {
    renderReported(reported());

    expect(screen.getByText("Câu 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Khôi phục" })).toBeNull();
  });
});

describe("ReportedCommentItem — Admin author-shape test (v1.5/v1.8: không avatarUrl)", () => {
  it("fixture tác giả đúng hai khoá; tsc từ chối avatarUrl trên CẢ type của admin lẫn type của adminActions", () => {
    const adminAuthor: AdminReportedAuthor = { displayName: "Lan", isAnonymousToReaders: false };
    const solutionsAuthor: SolutionsReportedAuthor = { displayName: "Lan", isAnonymousToReaders: true };

    // Bằng chứng lúc biên dịch: nếu ai đó thêm lại `avatarUrl` vào một trong
    // hai type, hai dòng `@ts-expect-error` dưới đây trở thành "unused" và
    // `npx tsc --noEmit` đỏ.
    const withAvatar: AdminReportedAuthor = {
      displayName: "Lan",
      isAnonymousToReaders: false,
      // @ts-expect-error — AdminReportedAuthor không có avatarUrl (v1.8)
      avatarUrl: "https://example.com/a.png",
    };
    const solutionsWithAvatar: SolutionsReportedAuthor = {
      displayName: "Lan",
      isAnonymousToReaders: false,
      // @ts-expect-error — adminActions' AdminReportedAuthor không có avatarUrl (v1.8)
      avatarUrl: "https://example.com/a.png",
    };

    expect(Object.keys(adminAuthor).sort()).toEqual(["displayName", "isAnonymousToReaders"]);
    expect(Object.keys(solutionsAuthor).sort()).toEqual(["displayName", "isAnonymousToReaders"]);
    expect(withAvatar.displayName).toBe("Lan");
    expect(solutionsWithAvatar.displayName).toBe("Lan");
  });

  it("type của admin và của adminActions khớp nhau theo cấu trúc (page truyền thẳng dữ liệu xuống)", () => {
    const fromServer: SolutionsHiddenCommentItem = hidden();
    const intoComponent: AdminHiddenCommentItem = fromServer;
    expect(intoComponent.id).toBe("hc1");
  });
});

describe("ReportedCommentItem — Admin refusal tests (nửa bình luận)", () => {
  it("lý do rỗng + 'Ẩn bình luận' → role=alert 'Bạn hãy nhập lý do.', không gọi action", () => {
    renderReported(reported());

    fireEvent.click(screen.getByRole("button", { name: "Ẩn bình luận" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(moderateCommentActionMock).not.toHaveBeenCalled();
  });

  it("lý do rỗng + 'Xoá hẳn' (bình luận đã ẩn) → alert, không mở hộp thoại, không gọi action", () => {
    renderHidden(hidden());

    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateCommentActionMock).not.toHaveBeenCalled();
  });

  it("lý do toàn khoảng trắng + 'Ẩn bình luận' → alert, không gọi action", () => {
    renderReported(reported());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bình luận" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(moderateCommentActionMock).not.toHaveBeenCalled();
  });

  it("lý do toàn khoảng trắng + 'Xoá hẳn' (bình luận đang hiện) → alert, không mở hộp thoại, không gọi action", () => {
    renderReported(reported());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateCommentActionMock).not.toHaveBeenCalled();
  });

  it("lý do toàn khoảng trắng + 'Xoá hẳn' (bình luận đã ẩn) → alert, không mở hộp thoại, không gọi action", () => {
    renderHidden(hidden());

    fireEvent.change(screen.getByLabelText("Lý do khôi phục (không bắt buộc)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateCommentActionMock).not.toHaveBeenCalled();
  });

  it("'Khôi phục' không cần lý do: gửi commentId (KHÔNG phải id), action=restore, reason rỗng", async () => {
    moderateCommentActionMock.mockResolvedValueOnce({ ok: true, status: "visible" });
    renderHidden(hidden({ id: "hc-42" }));

    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));

    await vi.waitFor(() => expect(moderateCommentActionMock).toHaveBeenCalledTimes(1));
    const formData = moderateCommentActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("commentId")).toBe("hc-42");
    expect(formData.has("id")).toBe(false);
    expect(formData.get("action")).toBe("restore");
    expect(formData.get("reason")).toBe("");
  });

  it("action trả lỗi → admin.solutions.actionError trong role=alert của mục; nút về trạng thái nghỉ", async () => {
    moderateCommentActionMock.mockResolvedValueOnce({ error: "admin.solutions.actionError" });
    renderReported(reported({ id: "rc-7" }));

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Xúc phạm" } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bình luận" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Thao tác chưa thành công. Bạn thử lại nhé.");
    const button = screen.getByRole("button", { name: "Ẩn bình luận" });
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.getAttribute("aria-disabled")).toBeNull();
    const formData = moderateCommentActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("commentId")).toBe("rc-7");
    expect(formData.get("action")).toBe("hide");
    expect(formData.get("reason")).toBe("Xúc phạm");
  });

  it("'Xoá hẳn' bình luận đi qua ConfirmDialog với đúng câu hệ quả; Huỷ → 0 lần gọi; xác nhận → 1 lần, action=delete", async () => {
    moderateCommentActionMock.mockResolvedValueOnce({ ok: true, status: "deleted" });
    renderReported(reported({ id: "rc-9" }));

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Spam lặp lại" } });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    const dialog = screen.getByRole("dialog", { name: "Xoá hẳn bình luận?" });
    expect(within(dialog).getByText("Bình luận này sẽ mất, không khôi phục được.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    expect(moderateCommentActionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));
    const reopened = screen.getByRole("dialog", { name: "Xoá hẳn bình luận?" });
    fireEvent.click(within(reopened).getByRole("button", { name: "Xoá hẳn" }));

    await vi.waitFor(() => expect(moderateCommentActionMock).toHaveBeenCalledTimes(1));
    const formData = moderateCommentActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("commentId")).toBe("rc-9");
    expect(formData.get("action")).toBe("delete");
    expect(formData.get("reason")).toBe("Spam lặp lại");
  });

  it("bấm nút xác nhận 'Xoá hẳn' hai lần cách nhau 1 tick khi action còn treo → action chỉ chạy ĐÚNG 1 lần", async () => {
    // Bật chiều đóng của hộp thoại (jsdom không có matchMedia) để panel còn
    // nằm trong DOM ở cú bấm thứ hai — jsdom bỏ qua `inert`, nên đây là ca
    // xấu nhất: chỉ còn chốt của chính ModerationReasonForm chặn lượt xoá thứ hai.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    try {
      let resolve!: (value: unknown) => void;
      moderateCommentActionMock.mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          })
      );
      moderateCommentActionMock.mockResolvedValue({ ok: true, status: "deleted" });
      renderReported(reported({ id: "rc-d" }));

      fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Spam" } });
      fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));
      const dialog = screen.getByRole("dialog", { name: "Xoá hẳn bình luận?" });
      const confirm = within(dialog).getByRole("button", { name: "Xoá hẳn" });

      fireEvent.click(confirm);
      await act(async () => {
        await Promise.resolve();
      });
      expect(confirm.isConnected).toBe(true);
      fireEvent.click(confirm);

      await vi.waitFor(() => expect(moderateCommentActionMock).toHaveBeenCalledTimes(1));
      resolve({ ok: true, status: "deleted" });
      await vi.waitFor(() =>
        expect(screen.getByRole("button", { name: "Ẩn bình luận" }).getAttribute("aria-disabled")).toBeNull()
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(moderateCommentActionMock).toHaveBeenCalledTimes(1);
      expect((moderateCommentActionMock.mock.calls[0][1] as FormData).get("commentId")).toBe("rc-d");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
