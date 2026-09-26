// @vitest-environment jsdom

// SolutionMenu (C-25, pin-only build, task 19) — frontend DD § Required Tests
// rows 5-8. Report item's two `iReported` states asserted HERE (same file as
// the pin items) per task file's explicit instruction, so the field cannot be
// dropped when task 36 lands. Mock boundary: only `@/features/solutions/actions`.
//
// Task 36 extends this file with the wired `ReportDialog` behind "Báo cáo bài
// giải" (AC-073, AC-074) and the in-session flip of the seeded `iReported`
// (frontend DD § Client State Design "Seeded-from-server state"). B4: no test
// here imports anything from `features/exams` — `ReportDialog` is modelled on
// `ReportExam`'s shape only, never its code (verified separately by
// `npm run lint`, not expressible as a vitest assertion).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setPinMock, reportSolutionMock } = vi.hoisted(() => ({
  setPinMock: vi.fn(),
  reportSolutionMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  setPin: setPinMock,
  reportSolution: reportSolutionMock,
}));

const { SolutionMenu } = await import("@/features/solutions/components/SolutionMenu");

afterEach(cleanup);
beforeEach(() => {
  setPinMock.mockReset();
  reportSolutionMock.mockReset();
});

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
}

describe("SolutionMenu — Required Test 5/6 (hai nhánh iReported)", () => {
  it("iReported: false -> mục 'Báo cáo bài giải' còn bấm được, không có chữ 'Bạn đã báo cáo'", () => {
    render(
      <SolutionMenu
        solutionId="S1"
        examId="E1"
        isPinned={false}
        isExamAuthor={false}
        isMine={false}
        iReported={false}
      />
    );
    openMenu();

    const item = screen.getByRole("menuitem", { name: "Báo cáo bài giải" });
    expect(item.getAttribute("aria-disabled")).not.toBe("true");
    expect(screen.queryByText(/Bạn đã báo cáo/)).toBeNull();
  });

  it("iReported: true -> 'Bạn đã báo cáo bài giải này.' với aria-disabled='true', không có disabled gốc, không còn mục 'Báo cáo bài giải'", () => {
    render(
      <SolutionMenu
        solutionId="S1"
        examId="E1"
        isPinned={false}
        isExamAuthor={false}
        isMine={false}
        iReported={true}
      />
    );
    openMenu();

    const item = screen.getByRole("menuitem", { name: "Bạn đã báo cáo bài giải này." });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByRole("menuitem", { name: "Báo cáo bài giải" })).toBeNull();
  });
});

describe("SolutionMenu — Required Test 7 (đích ghim)", () => {
  it("bấm 'Ghim bài này' -> setPin(examId, 'pin', <id của chính hàng>) — ba tham số", async () => {
    setPinMock.mockResolvedValueOnce({ ok: true, pinnedSolutionId: "S1" });

    render(
      <SolutionMenu
        solutionId="S1"
        examId="E1"
        isPinned={false}
        isExamAuthor={true}
        isMine={false}
        iReported={false}
      />
    );
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Ghim bài này" }));

    await waitFor(() => expect(setPinMock).toHaveBeenCalledTimes(1));
    expect(setPinMock).toHaveBeenNthCalledWith(1, "E1", "pin", "S1");
  });
});

describe("SolutionMenu — Required Test 8 (thất bại ghim)", () => {
  it("setPin generic -> dòng role=alert với solutions.menu.pinError trong bảng menu", async () => {
    setPinMock.mockResolvedValueOnce({ ok: false, error: { code: "generic" } });

    render(
      <SolutionMenu
        solutionId="S1"
        examId="E1"
        isPinned={false}
        isExamAuthor={true}
        isMine={false}
        iReported={false}
      />
    );
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Ghim bài này" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa ghim được bài này. Bạn thử lại nhé.");
  });
});

// Task 36 — AC-074 own-content exclusion: tác giả chính bài giải không bao
// giờ thấy mục báo cáo (dù trạng thái nào), chỉ thấy "Sửa bài giải".
describe("SolutionMenu — AC-074 own-content exclusion", () => {
  it("isMine: true -> không có mục 'Báo cáo bài giải' lẫn 'Bạn đã báo cáo...', chỉ có 'Sửa bài giải'", () => {
    render(
      <SolutionMenu
        solutionId="S1"
        examId="E1"
        isPinned={false}
        isExamAuthor={false}
        isMine={true}
        editHref="/de/E1/sua"
        iReported={false}
      />
    );
    openMenu();

    expect(screen.queryByRole("menuitem", { name: "Báo cáo bài giải" })).toBeNull();
    expect(screen.queryByText(/Bạn đã báo cáo/)).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Sửa bài giải" })).toBeTruthy();
    expect(reportSolutionMock).not.toHaveBeenCalled();
  });
});

// Task 36 — ReportDialog thật đằng sau mục báo cáo (AC-073, AC-074, AC-075).
// Boundary Context roundtrip (rate-limited `seconds` verbatim + reason giữ
// nguyên) và hai Proof Obligations (own-content exclusion + in-session flip;
// seeded-from-server state) được kiểm ở đây.
describe("SolutionMenu — ReportDialog (task 36)", () => {
  function renderMenu(iReported: boolean) {
    return render(
      <SolutionMenu
        solutionId="S1"
        examId="E1"
        isPinned={false}
        isExamAuthor={false}
        isMine={false}
        iReported={iReported}
      />
    );
  }

  function openReportDialog() {
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Báo cáo bài giải" }));
  }

  it("bấm 'Báo cáo bài giải' mở ReportDialog (variant solution) và đóng menu", () => {
    renderMenu(false);
    openReportDialog();

    expect(screen.getByRole("dialog", { name: "Báo cáo bài giải" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("lý do rỗng -> role=alert report.errorEmpty, KHÔNG gọi reportSolution", () => {
    renderMenu(false);
    openReportDialog();

    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    expect(screen.getByRole("alert").textContent).toBe("Bạn hãy mô tả vấn đề trước khi gửi.");
    expect(reportSolutionMock).not.toHaveBeenCalled();
  });

  it("rate-limited -> alert với {seconds} nguyên vẹn, lý do đã gõ được giữ nguyên (Boundary Context roundtrip)", async () => {
    reportSolutionMock.mockResolvedValueOnce({ ok: false, error: { code: "rateLimited", seconds: 42 } });
    renderMenu(false);
    openReportDialog();

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Đáp án sai câu 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Thao tác quá nhiều lần. Thử lại sau 42 giây.");
    expect(textarea.value).toBe("Đáp án sai câu 3");
    expect(reportSolutionMock).toHaveBeenCalledWith("S1", "Đáp án sai câu 3");
  });

  it("generic -> dialog vẫn mở với report.errorGeneric, lý do giữ nguyên, mục vẫn bấm được sau khi huỷ", async () => {
    reportSolutionMock.mockResolvedValueOnce({ ok: false, error: { code: "generic" } });
    renderMenu(false);
    openReportDialog();

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Sai công thức" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Chưa gửi được báo cáo. Bạn thử lại sau nhé.");
    expect(textarea.value).toBe("Sai công thức");
    expect(screen.getByRole("dialog", { name: "Báo cáo bài giải" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Báo cáo bài giải" })).toBeTruthy();
  });

  it("đã báo cáo sẵn (iReported: true) -> mục trơ, bấm không mở dialog, reportSolution 0 lần", () => {
    renderMenu(true);
    openMenu();

    const item = screen.getByRole("menuitem", { name: "Bạn đã báo cáo bài giải này." });
    fireEvent.click(item);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(reportSolutionMock).not.toHaveBeenCalled();
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.hasAttribute("disabled")).toBe(false);
  });

  it("lật trong phiên: {ok:true, alreadyReported:false} đóng dialog và chuyển menu sang nhánh 'đã báo cáo'", async () => {
    reportSolutionMock.mockResolvedValueOnce({ ok: true, alreadyReported: false });
    renderMenu(false);
    openReportDialog();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sai đáp án" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    openMenu();
    const item = screen.getByRole("menuitem", { name: "Bạn đã báo cáo bài giải này." });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.getAttribute("aria-live")).toBe("polite");
  });

  it("DOM giống hệt cho alreadyReported true và false — MỘT nhánh, không phải hai (frontend DD Element 10)", async () => {
    reportSolutionMock.mockResolvedValueOnce({ ok: true, alreadyReported: false });
    const flipped = renderMenu(false);
    openReportDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sai đáp án" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    openMenu();
    const flippedHtml = screen.getByRole("menuitem", { name: "Bạn đã báo cáo bài giải này." }).outerHTML;
    flipped.unmount();
    cleanup();

    renderMenu(true);
    openMenu();
    const seededHtml = screen.getByRole("menuitem", { name: "Bạn đã báo cáo bài giải này." }).outerHTML;

    expect(seededHtml).toBe(flippedHtml);
  });

  it("{ok:true, alreadyReported:true} cũng đóng dialog và chuyển sang cùng nhánh 'đã báo cáo'", async () => {
    reportSolutionMock.mockResolvedValueOnce({ ok: true, alreadyReported: true });
    renderMenu(false);
    openReportDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Trùng lần trước" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Bạn đã báo cáo bài giải này." })).toBeTruthy();
  });
});
