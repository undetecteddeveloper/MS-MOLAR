// @vitest-environment jsdom

// ExamTimer — hồi quy cho lượt trả TD-010 (2026-08-04).
//
// Component vừa đổi từ latest-ref ghi trong thân render (`ref.current = onTimeUp`,
// bị `react-hooks/refs` chặn) sang `useEffectEvent`. Hai tính chất PHẢI giữ
// nguyên, và đúng là hai tính chất mà latest-ref sinh ra để có:
//
//   1. `onTimeUp` fire ĐÚNG MỘT LẦN, đúng lúc đồng hồ chạm 0.
//   2. Bản được gọi là bản MỚI NHẤT lúc chạm 0 — không phải bản lúc mount.
//      Quan trọng vì `submit` của ExamPlayer đóng gói answers hiện tại: gọi
//      nhầm bản cũ = nộp bài trống.
//   3. Đổi identity của `onTimeUp` (xảy ra mỗi lần người làm bài gõ một ký tự,
//      vì ExamPlayer render lại) KHÔNG được làm đồng hồ chạy lại hay fire sớm.
//
// Đồng hồ tick bằng setTimeout lồng nhau (mỗi lần state đổi lại hẹn giờ mới),
// nên phải advance TỪNG GIÂY trong `act` riêng: một lần advance dài sẽ không có
// chỗ nào để React commit render và hẹn timeout kế tiếp.

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExamTimer } from "../ExamTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function tickSeconds(n: number) {
  for (let i = 0; i < n; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

function readout() {
  return screen.getByRole("timer").textContent;
}

describe("ExamTimer", () => {
  it("hiển thị MM:SS từ durationMinutes, có role=timer để screen reader đọc", () => {
    render(<ExamTimer durationMinutes={45} onTimeUp={() => {}} />);
    expect(readout()).toBe("45:00");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("Time remaining");
  });

  it("đếm lùi từng giây", () => {
    render(<ExamTimer durationMinutes={0.05} onTimeUp={() => {}} />); // 3 giây
    expect(readout()).toBe("00:03");
    tickSeconds(1);
    expect(readout()).toBe("00:02");
    tickSeconds(1);
    expect(readout()).toBe("00:01");
  });

  it("gọi onTimeUp đúng một lần, đúng lúc chạm 0 — không sớm hơn, không lặp", () => {
    const onTimeUp = vi.fn();
    render(<ExamTimer durationMinutes={0.05} onTimeUp={onTimeUp} />);

    tickSeconds(2);
    expect(readout()).toBe("00:01");
    expect(onTimeUp).not.toHaveBeenCalled();

    tickSeconds(1);
    expect(readout()).toBe("00:00");
    expect(onTimeUp).toHaveBeenCalledTimes(1);

    // Đồng hồ đã dừng: effect tick tự thoát ở `remaining <= 0`, nên advance
    // thêm không được sinh ra lần fire thứ hai.
    tickSeconds(5);
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it("fire bản onTimeUp MỚI NHẤT chứ không phải bản lúc mount", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(<ExamTimer durationMinutes={0.05} onTimeUp={stale} />);

    tickSeconds(2);
    rerender(<ExamTimer durationMinutes={0.05} onTimeUp={fresh} />);
    tickSeconds(1);

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("onTimeUp đổi identity mỗi render KHÔNG làm đồng hồ chạy lại hay fire sớm", () => {
    const calls: number[] = [];
    const { rerender } = render(
      <ExamTimer durationMinutes={0.05} onTimeUp={() => calls.push(0)} />
    );

    // Mô phỏng ExamPlayer render lại mỗi giây (người làm bài đang gõ đáp án):
    // callback là hàm MỚI mỗi lần.
    for (let i = 1; i <= 2; i++) {
      tickSeconds(1);
      rerender(<ExamTimer durationMinutes={0.05} onTimeUp={() => calls.push(i)} />);
    }

    // Sau 2 giây và 2 lần đổi callback, đồng hồ vẫn ở đúng 00:01 (không bị
    // reset về 00:03) và chưa fire lần nào.
    expect(readout()).toBe("00:01");
    expect(calls).toEqual([]);

    tickSeconds(1);
    expect(calls).toEqual([2]);
  });

  it("còn hơn một phút → màu thường", () => {
    render(<ExamTimer durationMinutes={2} onTimeUp={() => {}} />);
    expect(screen.getByRole("timer").className).toContain("text-foreground");
  });

  it("còn đúng một phút trở xuống → màu cảnh báo (UI-LAYER-MAP 4.2: đổi màu, KHÔNG nhấp nháy)", () => {
    render(<ExamTimer durationMinutes={1} onTimeUp={() => {}} />);
    expect(screen.getByRole("timer").className).toContain("text-destructive");
  });

  it("durationMinutes = 0 → fire ngay, không treo ở 00:00", () => {
    const onTimeUp = vi.fn();
    render(<ExamTimer durationMinutes={0} onTimeUp={onTimeUp} />);
    expect(readout()).toBe("00:00");
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  // --- Rà soát WCAG 2.2 AA (2026-08-06) ---------------------------------

  it("cảnh báo phút cuối có NHÃN CHỮ, không chỉ đổi màu (WCAG 1.4.1)", () => {
    // 1 phút 2 giây: còn trên ngưỡng → chưa cảnh báo.
    render(<ExamTimer durationMinutes={1.05} onTimeUp={() => {}} />);
    expect(screen.queryByText("Last minute")).toBeNull();

    // Đếm qua mốc 60s → nhãn xuất hiện. Màu đỏ là tín hiệu PHỤ; nhãn chữ mới là
    // tín hiệu người mù màu đỏ-lục đọc được.
    tickSeconds(3);
    expect(readout()).toBe("01:00");
    expect(screen.getByText("Last minute")).not.toBeNull();
  });

  it("chuỗi trong role=timer vẫn sạch MM:SS dù đã thêm nhãn cảnh báo", () => {
    // Nhãn "Last minute" và vùng live nằm NGOÀI phần tử role=timer, nếu lọt vào
    // trong thì trình đọc màn hình sẽ đọc "00:59 Last minute ..." thành một cục.
    render(<ExamTimer durationMinutes={1} onTimeUp={() => {}} />);
    expect(readout()).toBe("01:00");
  });

  it("đọc lên ở các MỐC chứ không phải từng giây (role=timer không tự announce)", () => {
    const { container } = render(<ExamTimer durationMinutes={0.6} onTimeUp={() => {}} />); // 36s
    const live = () => container.querySelector('[aria-live="polite"]')!.textContent;

    // 36s: chưa tới mốc nào → im lặng.
    expect(live()).toBe("");

    tickSeconds(6); // → 30s, đúng mốc
    expect(live()).toBe("30 seconds remaining");

    tickSeconds(1); // → 29s, giữa hai mốc → im lặng trở lại
    expect(live()).toBe("");

    tickSeconds(19); // → 10s, mốc cuối
    expect(live()).toBe("10 seconds remaining");
  });

  it("mốc phút dùng số nhiều đúng ngữ pháp", () => {
    const { container } = render(<ExamTimer durationMinutes={1.05} onTimeUp={() => {}} />); // 63s
    const live = () => container.querySelector('[aria-live="polite"]')!.textContent;

    tickSeconds(3); // → 60s
    expect(live()).toBe("1 minute remaining");
  });
});
