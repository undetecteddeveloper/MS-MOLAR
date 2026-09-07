// formatDurationShort [unit] — nhãn thời gian "1g23p" của vòng tròn Thống kê
// (docs/design/ui-refactor-san-truong-design.md §3 "Thống kê", 2026-09-06).

import { describe, expect, it } from "vitest";
import { formatDurationShort } from "../formatDuration";

describe("formatDurationShort", () => {
  it("giờ + phút, phút luôn hai chữ số để '1g05p' không đọc nhầm thành 15 phút", () => {
    expect(formatDurationShort(1 * 3600 + 23 * 60)).toBe("1g23p");
    expect(formatDurationShort(1 * 3600 + 5 * 60)).toBe("1g05p");
    expect(formatDurationShort(2 * 3600)).toBe("2g00p");
  });

  it("dưới một giờ chỉ có phút", () => {
    expect(formatDurationShort(45 * 60)).toBe("45p");
    expect(formatDurationShort(59 * 60 + 29)).toBe("59p");
  });

  it("làm tròn tới phút; 59p30s lên thành 1g00p", () => {
    expect(formatDurationShort(59 * 60 + 30)).toBe("1g00p");
    expect(formatDurationShort(90)).toBe("2p");
  });

  it("tổng dương rất nhỏ vẫn là '1p'; 0, âm, NaN là '0p'", () => {
    expect(formatDurationShort(20)).toBe("1p");
    expect(formatDurationShort(0)).toBe("0p");
    expect(formatDurationShort(-5)).toBe("0p");
    expect(formatDurationShort(Number.NaN)).toBe("0p");
  });
});
