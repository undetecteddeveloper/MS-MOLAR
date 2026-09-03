// @vitest-environment jsdom

// `EssayRegradeControl` — sáu trạng thái (UI Spec § Component:
// EssayRegradeControl): Idle, Busy, Done-refused (cả NĂM lý do), Done-success,
// Threw, Exhausted.
//
// TỪ ĐIỂN LÀ THẬT — mỗi ca khẳng định đúng KHOÁ giải ra đúng CHUỖI. Server
// Action và `useRouter` được mock ở biên của chúng.
//
// MỌI CA CÓ ÍT NHẤT MỘT KHẲNG ĐỊNH DƯƠNG.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// `vi.hoisted` chu khong `const` thuong: factory cua `vi.mock` duoc hoist len
// dau file nen no doc hai bien nay TRUOC dong khai bao — dung khuon ma
// `gradeEssays.test.ts` da dung.
const { retryMock, refreshMock } = vi.hoisted(() => ({
  retryMock: vi.fn(),
  refreshMock: vi.fn(),
}));
vi.mock("@/features/exams/essayActions", () => ({ retryEssayGrading: retryMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { EssayRegradeControl } from "@/features/exams/components/EssayRegradeControl";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/translate";

const DICT = getDictionary(DEFAULT_LOCALE);
const ATTEMPT = "a1";
const QUESTION = "q1";

function renderControl(exhausted = false) {
  return render(
    <EssayRegradeControl attemptId={ATTEMPT} questionId={QUESTION} exhausted={exhausted} />
  );
}

beforeEach(() => {
  retryMock.mockReset().mockResolvedValue({ ok: true });
  refreshMock.mockReset();
});
afterEach(cleanup);

describe("Idle", () => {
  it("hiện nhãn 'chấm lại', KHÔNG `disabled`, KHÔNG node kết cục nào", () => {
    const { container } = renderControl();
    const button = screen.getByRole("button");

    expect(button.textContent).toContain(DICT["result.essay.retry"]);
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("Busy", () => {
  it("đang chạy ⇒ aria-busy, nhãn bận, và LÝ DO bận đọc được", async () => {
    let resolve: (v: unknown) => void = () => {};
    retryMock.mockReturnValue(new Promise((r) => (resolve = r)));

    const { container } = renderControl();
    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
    expect(button.textContent).toContain(DICT["result.essay.retryBusy"]);
    const reason = container.querySelector(`#${button.getAttribute("aria-describedby")}`);
    expect(reason?.textContent).toBe(DICT["result.essay.retryBusyReason"]);

    resolve({ ok: true });
  });

  it("bấm hai lần liên tiếp ⇒ action được gọi ĐÚNG MỘT lần", async () => {
    // Chốt phải là một `ref` ĐỒNG BỘ: một chốt bằng state đọc giá trị của lượt
    // render TRƯỚC, nên cú bấm thứ hai trong cùng một tick vẫn lọt qua.
    let resolve: (v: unknown) => void = () => {};
    retryMock.mockReturnValue(new Promise((r) => (resolve = r)));

    renderControl();
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);

    expect(retryMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
  });
});

describe("Done-refused — NĂM lý do, NĂM câu, không hai câu nào trùng", () => {
  it.each([
    ["not_found", "profile.error.sessionExpired"],
    ["not_failed", "result.essay.retryAlreadyGraded"],
    ["exhausted", "result.essay.retryExhausted"],
    ["budget", "result.essay.retryBudgetOut"],
    ["server", "profile.error.generic"],
  ] as const)("lý do %o ⇒ đúng câu %o trong một node role=alert", async (reason, key) => {
    retryMock.mockResolvedValue({ ok: false, reason });

    renderControl();
    fireEvent.click(screen.getByRole("button"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(DICT[key]);
  });

  it("năm lý do cho năm câu PHÂN BIỆT được với nhau", async () => {
    // Nếu hai lý do giải ra cùng một câu thì học sinh không biết mình đang ở
    // tình cảnh nào, và cả năm ca ở trên vẫn xanh.
    const reasons = ["not_found", "not_failed", "exhausted", "budget", "server"] as const;
    const seen: string[] = [];
    for (const reason of reasons) {
      retryMock.mockResolvedValue({ ok: false, reason });
      renderControl();
      fireEvent.click(screen.getByRole("button"));
      const alert = await screen.findByRole("alert");
      seen.push(alert.textContent ?? "");
      cleanup();
    }
    expect(new Set(seen).size).toBe(5);
  });
});

describe("Done-success", () => {
  it("thành công ⇒ KHÔNG node lỗi, và `router.refresh()` ĐƯỢC gọi", async () => {
    const { container } = renderControl();
    fireEvent.click(screen.getByRole("button"));

    // MÁY CHỦ quyết định band. Không vá state tại chỗ — một lượt vá sẽ để
    // `EssayScoreLine` phía trên nói một đằng còn thẻ câu hỏi nói một nẻo.
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    // Khẳng định dương: nút vẫn ở đó, đã hết bận.
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("false");
  });
});

describe("Threw", () => {
  it("exception ⇒ DÙNG LẠI câu của `server`, và console CHỈ mang digest", async () => {
    const PG = "THONG_DIEP_POSTGRES_CO_THE_VONG_LAI_BAI_LAM";
    const err = Object.assign(new Error(PG), { digest: "abc123" });
    retryMock.mockRejectedValue(err);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderControl();
    fireEvent.click(screen.getByRole("button"));

    const alert = await screen.findByRole("alert");
    // Cùng một sự thật nói cho cùng một người, đến bằng hai đường — nên KHÔNG
    // có câu thứ hai nào để trôi lệch khỏi câu thứ nhất.
    expect(alert.textContent).toBe(DICT["profile.error.generic"]);

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("abc123");
    expect(logged).not.toContain(PG);
    consoleError.mockRestore();
  });
});

describe("Exhausted (RS-6) — FE-AC-08", () => {
  it("bấm ⇒ KHÔNG gọi action, KHÔNG pha bận, KHÔNG node kết cục", () => {
    const { container } = renderControl(true);
    const button = screen.getByRole("button");

    fireEvent.click(button);

    expect(retryMock).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    // Khẳng định dương: nút VẪN ở trong cây.
    expect(button.textContent).toContain(DICT["result.essay.retry"]);
  });

  it("KHÔNG `disabled` gốc — vẫn focus được, và LÝ DO đọc được", () => {
    const { container } = renderControl(true);
    const button = screen.getByRole("button");

    // `disabled` gỡ nút khỏi thứ tự tab VÀ đẩy lý do ra ngoài tầm với của trình
    // đọc màn hình — đúng hai thứ AC-064 muốn có.
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    button.focus();
    expect(document.activeElement).toBe(button);

    const reason = container.querySelector(`#${button.getAttribute("aria-describedby")}`);
    expect(reason?.textContent).toBe(DICT["result.essay.retryExhausted"]);
  });
});

describe("FE-AC-21 — KHÔNG `disabled` ở BẤT KỲ trạng thái nào", () => {
  it.each([false, true])("exhausted=%o: không phần tử nào mang `disabled`", (exhausted) => {
    const { container } = renderControl(exhausted);

    expect(container.querySelector("[disabled]")).toBeNull();
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("KHÔNG chuỗi nào nêu SỐ LƯỢT còn lại (UI-D9)", () => {
    const { container } = renderControl(true);
    // Con số ấy tụt vì những lý do học sinh không gây ra.
    expect(container.textContent).not.toMatch(/\b[0-9]+\s*(lượt|attempts?|tries)\b/i);
    expect(container.textContent).toContain(DICT["result.essay.retry"]);
  });
});
