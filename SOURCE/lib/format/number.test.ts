// Hợp đồng của lib/format/number.ts (UI Spec UI-D13, plan Task 2.3).
//
// Điểm chết người của khoá `billing.amount` nằm ở translate.ts:27: đường thay
// tham số là `String(values[name])` thô. Truyền thẳng SỐ vào `t()` sẽ in ra
// "39000 VNĐ" ngay cạnh một mã QR mang "39.000 VNĐ" — hai con số khác nhau
// trên màn hình thanh toán là chỗ người dùng dừng trả tiền. Nên ở đây có hẳn
// một case đối chứng dựng lại đúng lỗi đó, để test không chỉ khẳng định cái
// đúng mà còn khoá được cái sai.

import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi } from "@/lib/i18n/dictionaries/vi";
import { createTranslate } from "@/lib/i18n/translate";
import { formatVnd } from "./number";

describe("formatVnd", () => {
  it("nhóm hàng nghìn bằng DẤU CHẤM cho tiếng Việt", () => {
    expect(formatVnd(39000, "vi")).toBe("39.000");
  });

  it("nhóm hàng nghìn bằng DẤU PHẨY cho tiếng Anh", () => {
    // Cặp case này là chỗ tham số `locale` thực sự gánh việc: bỏ nó đi thì
    // một trong hai khẳng định chắc chắn sai, bất kể máy chạy test đang ở
    // ngôn ngữ mặc định nào.
    expect(formatVnd(39000, "en")).toBe("39,000");
  });

  it("nhóm đúng ở mốc bảy chữ số", () => {
    expect(formatVnd(1234567, "vi")).toBe("1.234.567");
    expect(formatVnd(1234567, "en")).toBe("1,234,567");
  });

  it('in số 0 thành "0", không phải "—" và không phải chuỗi rỗng', () => {
    // 0 là số hợp lệ, không phải giá trị thiếu — nhầm hai thứ này là biến một
    // đơn 0 đồng thành một ô trống không ai đọc được.
    expect(formatVnd(0, "vi")).toBe("0");
    expect(formatVnd(0, "en")).toBe("0");
  });

  it("giữ nguyên dấu âm của số tiền âm", () => {
    expect(formatVnd(-39000, "vi")).toBe("-39.000");
    expect(formatVnd(-39000, "en")).toBe("-39,000");
  });

  it('trả "—" cho NaN và Infinity, không ném', () => {
    expect(() => formatVnd(Number.NaN, "vi")).not.toThrow();
    expect(() => formatVnd(Number.POSITIVE_INFINITY, "en")).not.toThrow();
    expect(formatVnd(Number.NaN, "vi")).toBe("—");
    expect(formatVnd(Number.NaN, "en")).toBe("—");
    expect(formatVnd(Number.POSITIVE_INFINITY, "vi")).toBe("—");
    expect(formatVnd(Number.NEGATIVE_INFINITY, "en")).toBe("—");
  });
});

describe("formatVnd đi TRƯỚC t() — hợp đồng UI-D13", () => {
  const tVi = createTranslate(vi);
  const tEn = createTranslate(en);

  it("số đã format rồi mới thay vào billing.amount ra đúng đơn vị từng ngôn ngữ", () => {
    expect(tVi("billing.amount", { amount: formatVnd(39000, "vi") })).toBe("39.000 VNĐ");
    expect(tEn("billing.amount", { amount: formatVnd(39000, "en") })).toBe("39,000 VND");
  });

  it("truyền THẲNG số vào t() thì ra '39000' — đây chính là lỗi mà formatVnd tồn tại để chặn", () => {
    // Case đối chứng: nếu formatVnd trả về số thô, khẳng định ở case trên sẽ
    // trùng đúng chuỗi sai này. Giữ nó ở đây để cái sai có tên và có hình.
    expect(tVi("billing.amount", { amount: 39000 })).toBe("39000 VNĐ");
    expect(tVi("billing.amount", { amount: formatVnd(39000, "vi") })).not.toBe("39000 VNĐ");
  });
});
