// @vitest-environment jsdom

// SolutionMenu (C-25, pin-only build, task 19) — frontend DD § Required Tests
// rows 5-8. Report item's two `iReported` states asserted HERE (same file as
// the pin items) per task file's explicit instruction, so the field cannot be
// dropped when task 36 lands. Mock boundary: only `@/features/solutions/actions`.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setPinMock } = vi.hoisted(() => ({
  setPinMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  setPin: setPinMock,
}));

const { SolutionMenu } = await import("@/features/solutions/components/SolutionMenu");

afterEach(cleanup);
beforeEach(() => {
  setPinMock.mockReset();
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
