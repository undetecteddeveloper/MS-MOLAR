// @vitest-environment jsdom

// ReportedSolutionRow — UI Spec § Component: ReportedSolutionRow (C-38);
// frontend DD § Test Boundaries (task 38): anonymous row (S5/AC-081), plain-text
// report reasons, busy state (`aria-disabled`, never native `disabled`),
// "Admin notes `<details>` tests" (Reference Contract Value #16 / Element 11),
// "Admin refusal tests" (solution half), and Proof Obligation #2 (AC-082 /
// AC-106: reason required + confirm step with the exact consequence line).
//
// Mock boundary: `@/features/solutions/adminActions` mocked at the module
// boundary; the mocked Server Actions are passed as props exactly as
// `app/(admin)/admin/page.tsx` passes the real ones (B4). `ConfirmDialog`
// renders for real.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { moderateSolutionActionMock, moderateCommentActionMock } = vi.hoisted(() => ({
  moderateSolutionActionMock: vi.fn(),
  moderateCommentActionMock: vi.fn(),
}));

vi.mock("@/features/solutions/adminActions", () => ({
  moderateSolutionAction: moderateSolutionActionMock,
  moderateCommentAction: moderateCommentActionMock,
  listCommunityReports: vi.fn(),
  getSolutionNotesForAdmin: vi.fn(),
}));

const { moderateSolutionAction, moderateCommentAction } = await import("@/features/solutions/adminActions");
const { ReportedSolutionRow } = await import("@/features/admin/components/ReportedSolutionRow");
type AdminReportedSolution = import("@/features/admin/components/ReportedSolutionRow").AdminReportedSolution;
type AdminSolutionNote = import("@/features/admin/components/ReportedSolutionRow").AdminSolutionNote;

afterEach(cleanup);
beforeEach(() => {
  moderateSolutionActionMock.mockReset();
  moderateCommentActionMock.mockReset();
});

const NOW = new Date("2026-09-27T10:00:00.000Z");

function solution(overrides: Partial<AdminReportedSolution> = {}): AdminReportedSolution {
  return {
    id: "s1",
    examId: "e1",
    examTitle: "Đề Toán 12 — Giữa kỳ",
    author: { displayName: "Minh", isAnonymousToReaders: false },
    status: "published",
    reportCount: 2,
    reportReasons: ["Sai kiến thức", "Chép bài"],
    reportedComments: [],
    hiddenComments: [],
    ...overrides,
  };
}

function renderRow(row: AdminReportedSolution, notes: AdminSolutionNote[] = []) {
  return render(
    <ul>
      <ReportedSolutionRow
        row={row}
        notes={notes}
        now={NOW}
        onModerate={moderateSolutionAction}
        onModerateComment={moderateCommentAction}
      />
    </ul>
  );
}

function detailsBySummary(container: HTMLElement, summary: string): HTMLDetailsElement {
  const match = Array.from(container.querySelectorAll("details")).find(
    (d) => d.querySelector("summary")?.textContent === summary
  );
  if (!match) throw new Error(`no <details> with summary "${summary}"`);
  return match;
}

describe("ReportedSolutionRow — tác giả ẩn danh (S5, AC-081)", () => {
  it("bài ẩn danh: hiện tên THẬT + 'ẩn danh với người đọc'", () => {
    renderRow(solution({ author: { displayName: "Minh", isAnonymousToReaders: true } }));

    expect(screen.getByText("Minh")).toBeTruthy();
    expect(screen.getByText(/ẩn danh với người đọc/)).toBeTruthy();
  });

  it("bài không ẩn danh: tên thật, không chú thích", () => {
    renderRow(solution());

    expect(screen.getByText("Minh")).toBeTruthy();
    expect(screen.queryByText(/ẩn danh với người đọc/)).toBeNull();
  });
});

describe("ReportedSolutionRow — lý do báo cáo là văn bản thuần", () => {
  it("lý do trông như HTML hiện nguyên văn trong <details> 'Lý do báo cáo', không thành phần tử", () => {
    const { container } = renderRow(solution({ reportReasons: ['<img src=x onerror="alert(1)">'] }));

    const details = detailsBySummary(container, "Lý do báo cáo");
    expect(within(details).getByText('<img src=x onerror="alert(1)">')).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("ReportedSolutionRow — Admin notes <details> tests (Reference Contract Value #16, Element 11)", () => {
  const NOTES: AdminSolutionNote[] = [
    { questionNumber: 1, questionId: "q1", body: "Giải thích dài… **đậm** $x^2$" },
    { questionNumber: 3, questionId: "q3", body: "Ghi chú hai" },
  ];

  it("<details> 'Ghi chú của bài giải' có; mở ra: 'Câu 1' trước 'Câu 3', thân in nguyên văn (kể cả dấu markdown)", () => {
    const { container } = renderRow(solution(), NOTES);

    const details = detailsBySummary(container, "Ghi chú của bài giải");
    fireEvent.click(details.querySelector("summary")!);
    details.open = true;

    const q1 = within(details).getByText("Câu 1");
    const q3 = within(details).getByText("Câu 3");
    expect(q1.compareDocumentPosition(q3) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(details).getByText("Giải thích dài… **đậm** $x^2$")).toBeTruthy();
    expect(within(details).getByText("Ghi chú hai")).toBeTruthy();
    // Không RichText trên /admin: không <strong>, không nút KaTeX nào được dựng.
    expect(details.querySelector("strong, .katex, [data-rich-text]")).toBeNull();
    // questionId chỉ là key — không bao giờ in ra.
    expect(details.textContent).not.toMatch(/q1|q3/);
  });

  it("notes: [] → <details> VẪN có và chứa 'Chưa có lời giải'", () => {
    const { container } = renderRow(solution(), []);

    const details = detailsBySummary(container, "Ghi chú của bài giải");
    expect(within(details).getByText("Chưa có lời giải")).toBeTruthy();
  });

  it("giữ đúng thứ tự mảng — component không tự sắp xếp", () => {
    const reversed: AdminSolutionNote[] = [NOTES[1], NOTES[0]];
    const { container } = renderRow(solution(), reversed);

    const details = detailsBySummary(container, "Ghi chú của bài giải");
    const q1 = within(details).getByText("Câu 1");
    const q3 = within(details).getByText("Câu 3");
    expect(q3.compareDocumentPosition(q1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("ReportedSolutionRow — nút theo trạng thái (R17, AC-082, AC-109)", () => {
  it("published: [Ẩn bài giải] đứng TRƯỚC [Xoá hẳn]; không có 'Khôi phục', không có 'Bỏ qua'", () => {
    renderRow(solution());

    const hide = screen.getByRole("button", { name: "Ẩn bài giải" });
    const del = screen.getByRole("button", { name: "Xoá hẳn" });
    expect(hide.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Khôi phục" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Bỏ qua/ })).toBeNull();
    expect(screen.getByText("Đã đăng")).toBeTruthy();
  });

  it("hidden: [Khôi phục] + [Xoá hẳn], nhãn ô lý do 'không bắt buộc', huy hiệu 'Bị ẩn'", () => {
    renderRow(solution({ status: "hidden" }));

    expect(screen.getByRole("button", { name: "Khôi phục" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xoá hẳn" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ẩn bài giải" })).toBeNull();
    expect(screen.getByLabelText("Lý do khôi phục (không bắt buộc)")).toBeTruthy();
    expect(screen.getByText("Bị ẩn")).toBeTruthy();
  });

  it("các nút hành động cao ≥ 44px (h-11)", () => {
    renderRow(solution());

    for (const name of ["Ẩn bài giải", "Xoá hẳn"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/\bh-11\b/);
    }
  });
});

describe("ReportedSolutionRow — Proof Obligation #2 (AC-082 / AC-106)", () => {
  it("lý do rỗng + 'Ẩn bài giải' → alert 'Bạn hãy nhập lý do.', 0 lần gọi", () => {
    renderRow(solution());

    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài giải" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
  });

  it("lý do chỉ toàn khoảng trắng cũng bị chặn", () => {
    renderRow(solution());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài giải" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
  });

  it("lý do rỗng + 'Xoá hẳn' → alert, KHÔNG mở hộp thoại, 0 lần gọi", () => {
    renderRow(solution());

    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
  });

  it("lý do toàn khoảng trắng + 'Xoá hẳn' → alert, KHÔNG mở hộp thoại, 0 lần gọi", () => {
    renderRow(solution());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
  });

  it("có lý do + 'Xoá hẳn' → ConfirmDialog với ĐÚNG câu hệ quả; Huỷ → 0 lần; xác nhận → đúng 1 lần, action=delete, solutionId", async () => {
    moderateSolutionActionMock.mockResolvedValueOnce({ ok: true, status: "deleted" });
    renderRow(solution({ id: "sol-77" }));

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Đạo văn" } });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    const dialog = screen.getByRole("dialog", { name: "Xoá hẳn bài giải?" });
    expect(
      within(dialog).getByText(
        "Bài giải, mọi ghi chú và mọi bình luận dưới bài (của mọi người) sẽ mất, không khôi phục được."
      )
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));
    const reopened = screen.getByRole("dialog", { name: "Xoá hẳn bài giải?" });
    fireEvent.click(within(reopened).getByRole("button", { name: "Xoá hẳn" }));

    await vi.waitFor(() => expect(moderateSolutionActionMock).toHaveBeenCalledTimes(1));
    const formData = moderateSolutionActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("solutionId")).toBe("sol-77");
    expect(formData.has("id")).toBe(false);
    expect(formData.get("action")).toBe("delete");
    expect(formData.get("reason")).toBe("Đạo văn");
  });

  it("Enter trong ô lý do gửi hành động chính (hide) với solutionId", async () => {
    moderateSolutionActionMock.mockResolvedValueOnce({ ok: true, status: "hidden" });
    renderRow(solution({ id: "sol-5" }));

    const input = screen.getByLabelText("Lý do (bắt buộc)");
    fireEvent.change(input, { target: { value: "Sai lệch" } });
    fireEvent.submit(input.closest("form")!);

    await vi.waitFor(() => expect(moderateSolutionActionMock).toHaveBeenCalledTimes(1));
    const formData = moderateSolutionActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("solutionId")).toBe("sol-5");
    expect(formData.get("action")).toBe("hide");
    expect(formData.get("reason")).toBe("Sai lệch");
  });

  it("hàng 'Đã ẩn': 'Khôi phục' không cần lý do → action=restore", async () => {
    moderateSolutionActionMock.mockResolvedValueOnce({ ok: true, status: "published" });
    renderRow(solution({ id: "sol-h", status: "hidden" }));

    fireEvent.click(screen.getByRole("button", { name: "Khôi phục" }));

    await vi.waitFor(() => expect(moderateSolutionActionMock).toHaveBeenCalledTimes(1));
    const formData = moderateSolutionActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("solutionId")).toBe("sol-h");
    expect(formData.get("action")).toBe("restore");
  });
});

// Hàng 'Đã ẩn' có hành động chính là restore (lý do KHÔNG bắt buộc) — phải khoá
// riêng rằng "Xoá hẳn" từ CHÍNH hàng này vẫn bắt buộc lý do + hộp thoại. Đây là
// đường Reference Contract Value #26 nhắm tới: admin xoá hẳn một bài đã ẩn sau
// khi báo cáo đã hết.
describe("ReportedSolutionRow — 'Xoá hẳn' từ hàng 'Đã ẩn' (Reference Contract Value #26, AC-106)", () => {
  it("lý do rỗng + 'Xoá hẳn' → alert 'Bạn hãy nhập lý do.', KHÔNG mở hộp thoại, 0 lần gọi", () => {
    renderRow(solution({ id: "sol-h", status: "hidden", reportCount: 0, reportReasons: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
  });

  it("lý do toàn khoảng trắng + 'Xoá hẳn' → alert, KHÔNG mở hộp thoại, 0 lần gọi", () => {
    renderRow(solution({ id: "sol-h", status: "hidden", reportCount: 0, reportReasons: [] }));

    fireEvent.change(screen.getByLabelText("Lý do khôi phục (không bắt buộc)"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy nhập lý do.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
  });

  it("có lý do + 'Xoá hẳn' → ConfirmDialog với ĐÚNG câu hệ quả; xác nhận → đúng 1 lần, solutionId=sol-h, action=delete, đúng reason", async () => {
    moderateSolutionActionMock.mockResolvedValueOnce({ ok: true, status: "deleted" });
    renderRow(solution({ id: "sol-h", status: "hidden", reportCount: 0, reportReasons: [] }));

    fireEvent.change(screen.getByLabelText("Lý do khôi phục (không bắt buộc)"), {
      target: { value: "Vi phạm lặp lại" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xoá hẳn" }));

    const dialog = screen.getByRole("dialog", { name: "Xoá hẳn bài giải?" });
    expect(
      within(dialog).getByText(
        "Bài giải, mọi ghi chú và mọi bình luận dưới bài (của mọi người) sẽ mất, không khôi phục được."
      )
    ).toBeTruthy();
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Xoá hẳn" }));

    await vi.waitFor(() => expect(moderateSolutionActionMock).toHaveBeenCalledTimes(1));
    const formData = moderateSolutionActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("solutionId")).toBe("sol-h");
    expect(formData.get("action")).toBe("delete");
    expect(formData.get("reason")).toBe("Vi phạm lặp lại");
  });
});

describe("ReportedSolutionRow — đang xử lý dùng aria-disabled, không bao giờ disabled gốc", () => {
  it("trong lúc chờ: nút đang chạy aria-busy + aria-disabled, KHÔNG có thuộc tính disabled; bấm lại không gọi thêm", async () => {
    let resolve!: (value: unknown) => void;
    moderateSolutionActionMock.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    renderRow(solution());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài giải" }));

    const busy = await screen.findByRole("button", { name: "Đang xử lý…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.hasAttribute("disabled")).toBe(false);
    const del = screen.getByRole("button", { name: "Xoá hẳn" });
    expect(del.getAttribute("aria-disabled")).toBe("true");
    expect(del.hasAttribute("disabled")).toBe(false);

    fireEvent.click(busy);
    fireEvent.click(del);
    expect(moderateSolutionActionMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();

    resolve({ ok: true, status: "hidden" });
    await screen.findByRole("button", { name: "Ẩn bài giải" });
  });
});

describe("ReportedSolutionRow — Admin refusal tests (nửa bài giải)", () => {
  it("action trả lỗi → 'Thao tác chưa thành công. Bạn thử lại nhé.' trong role=alert; nút về nghỉ; huy hiệu trạng thái không đổi", async () => {
    moderateSolutionActionMock.mockResolvedValueOnce({ error: "admin.solutions.actionError" });
    renderRow(solution());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài giải" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Thao tác chưa thành công. Bạn thử lại nhé.");
    const hide = screen.getByRole("button", { name: "Ẩn bài giải" });
    expect(hide.getAttribute("aria-busy")).toBeNull();
    expect(hide.getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByText("Đã đăng")).toBeTruthy();
    expect(screen.queryByText("Bị ẩn")).toBeNull();
  });

  it("bị rate-limit → câu profile.error.rateLimited với số giây từ server", async () => {
    moderateSolutionActionMock.mockResolvedValueOnce({ error: "profile.error.rateLimited", seconds: 30 });
    renderRow(solution());

    fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: "Spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài giải" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Thao tác quá nhiều lần. Thử lại sau 30 giây.");
  });
});

describe("ReportedSolutionRow — mục con 'Bình luận đã ẩn' và bình luận bị báo cáo (AC-107)", () => {
  it("hiddenComments: [] → không có mục con; bình luận bị báo cáo lồng trong hàng dùng moderateCommentAction", async () => {
    moderateCommentActionMock.mockResolvedValueOnce({ ok: true, status: "hidden" });
    renderRow(
      solution({
        reportedComments: [
          {
            id: "rc1",
            questionNumber: 2,
            body: "Bình luận xấu",
            commenter: { displayName: "Hà", isAnonymousToReaders: true },
            reportCount: 1,
            reportReasons: ["Xúc phạm"],
          },
        ],
      })
    );

    expect(screen.queryByText("Bình luận đã ẩn")).toBeNull();
    expect(screen.getByText("Hà")).toBeTruthy();
    expect(screen.getAllByText(/ẩn danh với người đọc/)).toHaveLength(1);

    const inputs = screen.getAllByLabelText("Lý do (bắt buộc)");
    // Ô thứ nhất thuộc bình luận (đứng trước form của chính hàng).
    fireEvent.change(inputs[0], { target: { value: "Xúc phạm" } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bình luận" }));

    await vi.waitFor(() => expect(moderateCommentActionMock).toHaveBeenCalledTimes(1));
    expect(moderateSolutionActionMock).not.toHaveBeenCalled();
    const formData = moderateCommentActionMock.mock.calls[0][1] as FormData;
    expect(formData.get("commentId")).toBe("rc1");
  });
});
