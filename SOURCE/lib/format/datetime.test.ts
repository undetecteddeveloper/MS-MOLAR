// lib/format/datetime.ts — múi giờ ghim Asia/Ho_Chi_Minh, locale ghim vi-VN,
// hợp đồng lỗi "—" và không bao giờ ném.

import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./datetime";

/** 2026-08-18T17:30:00Z = 19/08/2026 00:30 giờ Việt Nam — qua nửa đêm ICT
 *  nhưng vẫn là 18/08 theo UTC. Đây là ca phân biệt "ghim múi giờ" với "để
 *  runtime tự quyết". */
const CROSSES_ICT_MIDNIGHT = "2026-08-18T17:30:00.000Z";
/** 2026-08-18T17:00:00Z = đúng 00:00 ngày 19/08 ICT. */
const EXACTLY_ICT_MIDNIGHT = "2026-08-18T17:00:00.000Z";
/** 2026-08-18T07:32:00Z = 18/08/2026 14:32 ICT. */
const MIDDAY = "2026-08-18T07:32:00.000Z";

describe("formatDate — hợp đồng lỗi", () => {
  it("null → '—', không ném", () => {
    expect(() => formatDate(null)).not.toThrow();
    expect(formatDate(null)).toBe("—");
  });
  it("chuỗi rỗng → '—', không ném", () => {
    expect(() => formatDate("")).not.toThrow();
    expect(formatDate("")).toBe("—");
  });
  it("chuỗi không phân tích được → '—', không ném", () => {
    expect(() => formatDate("not-a-date")).not.toThrow();
    expect(formatDate("not-a-date")).toBe("—");
  });
});

describe("formatDate — múi giờ Việt Nam, định dạng DD/MM/YYYY", () => {
  it("instant qua nửa đêm ICT rơi vào ngày hôm sau theo lịch Việt Nam", () => {
    expect(formatDate(CROSSES_ICT_MIDNIGHT)).toBe("19/08/2026");
  });
  it("đúng 00:00 ICT là ngày mới", () => {
    expect(formatDate(EXACTLY_ICT_MIDNIGHT)).toBe("19/08/2026");
  });
  it("giữ DD/MM/YYYY — locale ngầm định (en-US) sẽ ra MM/DD/YYYY", () => {
    expect(formatDate(MIDDAY)).toBe("18/08/2026");
  });
});

describe("formatDateTime", () => {
  it("cùng hợp đồng lỗi với formatDate", () => {
    expect(() => formatDateTime(null)).not.toThrow();
    expect(() => formatDateTime("")).not.toThrow();
    expect(() => formatDateTime("not-a-date")).not.toThrow();
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("")).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });
  it("'DD/MM/YYYY HH:mm' theo giờ Việt Nam, 24 giờ, nối bằng một dấu cách", () => {
    expect(formatDateTime(CROSSES_ICT_MIDNIGHT)).toBe("19/08/2026 00:30");
    expect(formatDateTime(MIDDAY)).toBe("18/08/2026 14:32");
  });
});
