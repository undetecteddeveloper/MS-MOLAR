// lib/format/number.ts — nhóm hàng nghìn kiểu Việt Nam (dấu chấm), hợp đồng
// lỗi "—" cho giá trị không hữu hạn, và quy tắc "định dạng TRƯỚC, dịch SAU".

import { describe, expect, it } from "vitest";
import { t } from "@/lib/copy";
import { formatVnd } from "./number";

describe("formatVnd", () => {
  it("nhóm hàng nghìn bằng dấu chấm", () => {
    expect(formatVnd(39000)).toBe("39.000");
    expect(formatVnd(1234567)).toBe("1.234.567");
  });
  it("0 là số tiền hợp lệ", () => {
    expect(formatVnd(0)).toBe("0");
  });
  it("số âm giữ dấu", () => {
    expect(formatVnd(-39000)).toBe("-39.000");
  });
  it("giá trị không hữu hạn → '—', không ném", () => {
    expect(() => formatVnd(Number.NaN)).not.toThrow();
    expect(() => formatVnd(Number.POSITIVE_INFINITY)).not.toThrow();
    expect(formatVnd(Number.NaN)).toBe("—");
    expect(formatVnd(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatVnd(Number.NEGATIVE_INFINITY)).toBe("—");
  });
});

describe("định dạng TRƯỚC, dịch SAU (UI-D13)", () => {
  it("số đã định dạng đi vào t() thành chuỗi hoàn chỉnh", () => {
    expect(t("billing.amount", { amount: formatVnd(39000) })).toBe("39.000 VNĐ");
  });
  it("đưa số thô vào t() sẽ ra chuỗi sai — đúng lý do hàm này tồn tại", () => {
    expect(t("billing.amount", { amount: 39000 })).toBe("39000 VNĐ");
    expect(t("billing.amount", { amount: formatVnd(39000) })).not.toBe("39000 VNĐ");
  });
});
