// @vitest-environment jsdom

// `EssayGradingPoller` — năm trạng thái (UI Spec § Component:
// EssayGradingPoller): default (polling), stopped-at-cap, hidden-tab,
// resolved, not-mounted.
//
// HẠI HARNESS ĐƯỢC GHIM SẴN Ở TASK FILE, không ca nào tự bịa ra kiểu riêng:
//   · fake timers
//   · `tick(ms)` = `act(() => vi.advanceTimersByTime(ms))`
//   · ĐẨY TỪNG NHỊP MỘT — timer ở đây LỒNG NHAU, nên một lượt đẩy dài duy nhất
//     không để React chỗ nào commit để hẹn timeout kế tiếp
//     (`ExamTimer.test.tsx:17-19`).
//   · KHÔNG `waitFor` ở đâu trong file này — `waitFor` cộng fake timers là lượt
//     treo kinh điển của repo này.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import {
  EssayGradingPoller,
  ESSAY_POLL_FAST_INTERVAL_MS,
  ESSAY_POLL_FAST_TICKS,
  ESSAY_POLL_SLOW_INTERVAL_MS,
  ESSAY_POLL_MAX_REFRESHES,
  ESSAY_POLL_MAX_ELAPSED_MS,
} from "../EssayGradingPoller";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/translate";

const DICT = getDictionary(DEFAULT_LOCALE);

beforeEach(() => {
  vi.useFakeTimers();
  refreshMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Đẩy `n` nhịp NHANH, từng nhịp một. */
function fastTicks(n: number) {
  for (let i = 0; i < n; i += 1) tick(ESSAY_POLL_FAST_INTERVAL_MS);
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
}

describe("nhịp hai pha", () => {
  it("mỗi nhịp NHANH gọi đúng một `router.refresh()`", () => {
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    fastTicks(3);

    expect(refreshMock).toHaveBeenCalledTimes(3);
  });

  it("sau ESSAY_POLL_FAST_TICKS, nhịp chuyển sang CHẬM", () => {
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);
    fastTicks(ESSAY_POLL_FAST_TICKS);
    expect(refreshMock).toHaveBeenCalledTimes(ESSAY_POLL_FAST_TICKS);

    // Một nhịp NHANH nữa không đủ để kích hoạt lượt kế — nó đã dài bằng nhịp CHẬM.
    tick(ESSAY_POLL_FAST_INTERVAL_MS);
    expect(refreshMock).toHaveBeenCalledTimes(ESSAY_POLL_FAST_TICKS);

    // Đủ phần còn lại của nhịp chậm thì mới có lượt tiếp theo.
    tick(ESSAY_POLL_SLOW_INTERVAL_MS - ESSAY_POLL_FAST_INTERVAL_MS);
    expect(refreshMock).toHaveBeenCalledTimes(ESSAY_POLL_FAST_TICKS + 1);
  });
});

describe("tab ẩn — bỏ qua nhịp, KHÔNG tốn ngân sách, nhưng ĐỒNG HỒ VẪN CHẠY", () => {
  afterEach(() => setHidden(false));

  it("tab ẩn ⇒ KHÔNG refresh nào", () => {
    setHidden(true);
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    fastTicks(5);

    // Làm mới một trang không ai đang nhìn là trả tiền pin và dữ liệu cho không.
    expect(refreshMock).not.toHaveBeenCalled();
    // Khẳng định dương: component vẫn ở trong cây và vẫn có vùng aria-live.
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("hiện lại ⇒ tiếp tục refresh, không có CHÙM nào bị dồn", () => {
    setHidden(true);
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);
    fastTicks(5);
    expect(refreshMock).not.toHaveBeenCalled();

    setHidden(false);
    fastTicks(2);

    // Đúng HAI, không phải bảy: chuỗi `setTimeout` không gộp tick như
    // `setInterval` — đó là toàn bộ lý do chọn nó.
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});

describe("hai trần ĐỘC LẬP", () => {
  it("trần SỐ LƯỢT: dừng ở ESSAY_POLL_MAX_REFRESHES", () => {
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    // 12 nhanh rồi phần còn lại chậm, từng nhịp một.
    fastTicks(ESSAY_POLL_FAST_TICKS);
    for (let i = 0; i < ESSAY_POLL_MAX_REFRESHES; i += 1) tick(ESSAY_POLL_SLOW_INTERVAL_MS);

    expect(refreshMock.mock.calls.length).toBeLessThanOrEqual(ESSAY_POLL_MAX_REFRESHES);
    expect(screen.getByText(DICT["result.essay.pollStopped"])).toBeTruthy();
  });

  it("trần ĐỒNG HỒ chạy KỂ CẢ khi tab ẩn suốt — dừng mà không refresh lần nào", () => {
    setHidden(true);
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    // Đẩy quá trần đồng hồ bằng các nhịp nhanh liên tiếp.
    fastTicks(Math.ceil(ESSAY_POLL_MAX_ELAPSED_MS / ESSAY_POLL_FAST_INTERVAL_MS) + 1);
    setHidden(false);

    // Một tab ẩn không tốn ngân sách refresh, nhưng thời gian vẫn trôi và pass
    // chấm vẫn hết giờ đúng lúc nó hết giờ — sau mốc đó mọi refresh là chắc
    // chắn vô ích.
    expect(refreshMock).not.toHaveBeenCalled();
    expect(screen.getByText(DICT["result.essay.pollStopped"])).toBeTruthy();
  });
});

describe("trạng thái DỪNG và nút làm mới thủ công", () => {
  function driveToStop() {
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);
    fastTicks(ESSAY_POLL_FAST_TICKS);
    for (let i = 0; i < ESSAY_POLL_MAX_REFRESHES; i += 1) tick(ESSAY_POLL_SLOW_INTERVAL_MS);
  }

  it("dừng ⇒ hiện câu 'đã ngừng tự cập nhật' và một <button> THẬT", () => {
    driveToStop();

    expect(screen.getByText(DICT["result.essay.pollStopped"])).toBeTruthy();
    const button = screen.getByRole("button", { name: DICT["result.essay.pollRefresh"] });
    expect(button.tagName).toBe("BUTTON");
  });

  it("bấm 'Cập nhật' ⇒ một refresh, và NẠP LẠI cả hai ngân sách", () => {
    driveToStop();
    const before = refreshMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: DICT["result.essay.pollRefresh"] }));
    expect(refreshMock.mock.calls.length).toBe(before + 1);

    // Nạp lại ngân sách là nửa quan trọng: thiếu nó, lượt bấm thứ hai sẽ dừng
    // ngay lập tức và nút thành vô dụng sau đúng một lần dùng.
    expect(screen.queryByText(DICT["result.essay.pollStopped"])).toBeNull();
    fastTicks(2);
    expect(refreshMock.mock.calls.length).toBe(before + 3);
  });
});

describe("vùng aria-live (AC-023)", () => {
  it("RỖNG ở lượt render đầu — một vùng đã có chữ sẵn có thể không được đọc lên", () => {
    const { container } = render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toBe("");
  });

  it("còn câu đang chấm ⇒ câu tiến độ mang ĐÚNG hai con số", () => {
    const { container, rerender } = render(
      <EssayGradingPoller pendingCount={2} gradedCount={0} />
    );
    act(() => {
      rerender(<EssayGradingPoller pendingCount={1} gradedCount={2} />);
    });

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(
      DICT["result.essay.announceProgress"].replace("{done}", "2").replace("{pending}", "1")
    );
  });

  it("hết câu đang chấm ⇒ câu 'đã xong toàn bộ' ĐƯỢC đọc lên", () => {
    // Đây là ca mà điều kiện mount `pendingCount > 0` sẽ PHÁ: ở đúng lượt
    // render giải quyết câu cuối, component sẽ unmount và vùng aria-live rời
    // khỏi DOM TRONG CÙNG commit mà câu này lẽ ra được chèn vào — nên không bao
    // giờ có gì để đọc. Người dùng nhìn thấy không nhận ra, nên không ai báo.
    const { container, rerender } = render(
      <EssayGradingPoller pendingCount={1} gradedCount={1} />
    );
    act(() => {
      rerender(<EssayGradingPoller pendingCount={0} gradedCount={2} />);
    });

    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(DICT["result.essay.announceAllDone"]);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// FE-AC-12 — cho tới 2026-08-30 đây là tiêu chí DUY NHẤT của tính năng không
// được thoả, và KHÔNG test nào bắt được: `router.refresh()` được gọi TRẦN,
// `schedule()` đứng ngay sau nó, nên một cú ném ĐỒNG BỘ nhảy qua `schedule()`
// và poller chết vĩnh viễn mà `stopped` không bao giờ được đặt — học sinh mất
// CẢ trang tự cập nhật LẪN nút làm mới thủ công.
//
// Nó cũng là muc DUY NHẤT trong danh sách FE-AC không mang back-reference
// `(AC-xxx)`, tức không lượt đối chiếu nào ở mức PRD chạm tới được. Bốn ca
// dưới đây là lưới chặn thay cho điều đó.
// ═══════════════════════════════════════════════════════════════════════════

function spyOnConsoleError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("FE-AC-12 — một `router.refresh()` NÉM không được giết chuỗi poll", () => {
  let errorSpy: ReturnType<typeof spyOnConsoleError>;

  beforeEach(() => {
    errorSpy = spyOnConsoleError();
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("ném ở một nhịp ⇒ GHI LOG và VẪN hẹn nhịp kế tiếp", () => {
    refreshMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    tick(ESSAY_POLL_FAST_INTERVAL_MS);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // ĐÂY là khẳng định của FE-AC-12, và là ca giết bản CŨ: trước bản vá con
    // số này đứng yên ở 1 vĩnh viễn, vì cú ném đã nhảy qua `schedule()`.
    tick(ESSAY_POLL_FAST_INTERVAL_MS);
    expect(refreshMock).toHaveBeenCalledTimes(2);
    tick(ESSAY_POLL_FAST_INTERVAL_MS);
    expect(refreshMock).toHaveBeenCalledTimes(3);
  });

  it("KHÔNG gì hiện ra cho học sinh", () => {
    refreshMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { container } = render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);
    tick(ESSAY_POLL_FAST_INTERVAL_MS);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(DICT["result.essay.pollStopped"])).toBeNull();
    expect(container.textContent).not.toContain("boom");
  });

  it("log mang DUY NHẤT `digest` — không thông điệp lỗi", () => {
    const leaky = Object.assign(new Error("bai lam cua hoc sinh co the vong lai o day"), {
      digest: "abc123",
    });
    refreshMock.mockImplementationOnce(() => {
      throw leaky;
    });
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);
    tick(ESSAY_POLL_FAST_INTERVAL_MS);

    expect(errorSpy).toHaveBeenCalledWith("[EssayGradingPoller] router.refresh() threw", {
      digest: "abc123",
    });

    // Khẳng định PHỦ ĐỊNH, và nó cần cách kiểm riêng: `Error#message` KHÔNG
    // enumerable, nên một lượt rò kiểu này KHÔNG lộ ra dưới `JSON.stringify`.
    // Quét cả dạng chuỗi hoá lẫn từng đối số thô.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("bai lam cua hoc sinh");
    for (const call of errorSpy.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toContain("bai lam cua hoc sinh");
      }
    }
  });

  it("ném LIÊN TỤC ⇒ chạm trần rồi xuống thang thành nút thủ công, KHÔNG quay vô hạn", () => {
    refreshMock.mockImplementation(() => {
      throw new Error("boom");
    });
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);

    fastTicks(ESSAY_POLL_FAST_TICKS);
    for (let i = 0; i < ESSAY_POLL_MAX_REFRESHES; i += 1) tick(ESSAY_POLL_SLOW_INTERVAL_MS);

    // Lượt hỏng VẪN tiêu một suất trong trần 30 — cố ý. Không tiêu thì chuỗi
    // này quay mãi mỗi 5–10 giây trên đúng thiết bị yếu nhất, và cái giá của
    // bản vá sẽ là một vòng lặp vô hạn thay cho một lượt chết im lặng.
    expect(refreshMock.mock.calls.length).toBeLessThanOrEqual(ESSAY_POLL_MAX_REFRESHES);
    expect(screen.getByText(DICT["result.essay.pollStopped"])).toBeTruthy();
    expect(
      screen.getByRole("button", { name: DICT["result.essay.pollRefresh"] }).tagName
    ).toBe("BUTTON");
  });

  it("nút 'Cập nhật' ném ⇒ ghi log, không vỡ, và ngân sách VẪN được nạp lại", () => {
    render(<EssayGradingPoller pendingCount={2} gradedCount={0} />);
    fastTicks(ESSAY_POLL_FAST_TICKS);
    for (let i = 0; i < ESSAY_POLL_MAX_REFRESHES; i += 1) tick(ESSAY_POLL_SLOW_INTERVAL_MS);
    const before = refreshMock.mock.calls.length;

    refreshMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    fireEvent.click(screen.getByRole("button", { name: DICT["result.essay.pollRefresh"] }));

    expect(errorSpy).toHaveBeenCalledTimes(1);

    // `resetBudgets()` chạy TRƯỚC lượt refresh, nên chuỗi khởi động lại kể cả
    // khi chính cú bấm ấy ném — nút không tự biến mình thành một cú bấm chết.
    expect(screen.queryByText(DICT["result.essay.pollStopped"])).toBeNull();
    fastTicks(2);
    expect(refreshMock.mock.calls.length).toBe(before + 3);
  });
});
