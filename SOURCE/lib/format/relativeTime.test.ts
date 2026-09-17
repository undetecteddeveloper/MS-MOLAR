// lib/format/relativeTime.ts — "Vừa xong" / "n phút trước" / "n giờ trước" /
// "Hôm qua" / "n ngày trước", quá 30 ngày thì về formatDate (UI Spec § Chuỗi
// tiếng Việt cần thêm, `time.*`). Mỗi ranh giới được kiểm ở CẢ HAI phía.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { relativeTime } from "./relativeTime";

// Ghim múi giờ của RUNTIME về UTC (như Vercel): máy dev ở Việt Nam thì giờ
// runtime trùng giờ VN, nên một bản cài đọc ngày lịch theo múi giờ runtime vẫn
// xanh ở các ca "ngày theo lịch Việt Nam" bên dưới. "UTC" chứ không phải tên
// IANA — Node trên Windows bỏ qua TZ dạng IANA.
beforeAll(() => {
  vi.stubEnv("TZ", "UTC");
  // Ghim chỉ ăn ở pool mặc định `forks` của vitest — ghim không ăn thì đỏ ngay tại đây.
  expect(NOW.getTimezoneOffset()).toBe(0);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 17/09/2026 08:00 giờ Việt Nam (= 01:00Z) — đã sang ngày 17 theo lịch VN,
 *  cũng đã là ngày 17 theo UTC. */
const NOW = new Date("2026-09-17T01:00:00.000Z");

function before(ms: number, now: Date = NOW): string {
  return new Date(now.getTime() - ms).toISOString();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("relativeTime — hợp đồng lỗi giống formatDate", () => {
  it.each([null, "", "not-a-date"])("%j → '—', không ném", (input) => {
    expect(() => relativeTime(input, NOW)).not.toThrow();
    expect(relativeTime(input, NOW)).toBe("—");
  });
});

describe("relativeTime — dưới một phút", () => {
  it("0 giây và 59 giây → 'Vừa xong'", () => {
    expect(relativeTime(before(0), NOW)).toBe("Vừa xong");
    expect(relativeTime(before(59 * SECOND), NOW)).toBe("Vừa xong");
  });

  it("mốc ở TƯƠNG LAI (đồng hồ máy lệch) → 'Vừa xong', không ra số âm", () => {
    expect(relativeTime(before(-5 * MINUTE), NOW)).toBe("Vừa xong");
  });
});

describe("relativeTime — phút và giờ", () => {
  it("đúng 1 phút → '1 phút trước'; 59 phút 59 giây → '59 phút trước'", () => {
    expect(relativeTime(before(MINUTE), NOW)).toBe("1 phút trước");
    expect(relativeTime(before(59 * MINUTE + 59 * SECOND), NOW)).toBe("59 phút trước");
  });

  it("đúng 1 giờ → '1 giờ trước'; 23 giờ 59 phút → '23 giờ trước'", () => {
    expect(relativeTime(before(HOUR), NOW)).toBe("1 giờ trước");
    expect(relativeTime(before(23 * HOUR + 59 * MINUTE), NOW)).toBe("23 giờ trước");
  });
});

describe("relativeTime — ngày theo LỊCH Việt Nam", () => {
  it("đủ 24 giờ, là hôm qua theo lịch → 'Hôm qua'", () => {
    expect(relativeTime(before(DAY), NOW)).toBe("Hôm qua");
  });

  it("16/09 06:00 giờ VN (= 15/09 theo UTC) → 'Hôm qua', không phải '2 ngày trước'", () => {
    // Theo UTC hai mốc cách nhau HAI ngày lịch (15 → 17); theo giờ Việt Nam chỉ
    // một (16 → 17). Ca này đỏ nếu ngày lịch bị tính theo múi giờ của runtime.
    expect(relativeTime("2026-09-15T23:00:00.000Z", NOW)).toBe("Hôm qua");
  });

  it("26 giờ nhưng đã qua HAI nửa đêm giờ VN → '2 ngày trước', không phải 'Hôm qua'", () => {
    // 17/09 01:00 giờ VN; 26 giờ trước là 15/09 23:00 giờ VN. Đếm theo số giờ
    // trôi qua (26 / 24 = 1) sẽ nói "Hôm qua" — sai với người đọc ở Việt Nam.
    const justAfterMidnight = new Date("2026-09-16T18:00:00.000Z");
    expect(relativeTime(before(26 * HOUR, justAfterMidnight), justAfterMidnight)).toBe(
      "2 ngày trước"
    );
  });

  it("30 ngày lịch → '30 ngày trước'; 31 ngày → ngày tháng của formatDate", () => {
    expect(relativeTime(before(30 * DAY), NOW)).toBe("30 ngày trước");
    expect(relativeTime(before(31 * DAY), NOW)).toBe("17/08/2026");
  });
});

describe("relativeTime — mặc định đọc giờ hiện tại", () => {
  it("không truyền `now` → so với Date.now()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(relativeTime(before(5 * MINUTE))).toBe("5 phút trước");
  });
});
