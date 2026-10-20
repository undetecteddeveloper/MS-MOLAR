// @vitest-environment jsdom

// OrderStatusBadge — nhãn trạng thái đơn thanh toán.
//
// Nghĩa vụ chứng minh: một status ngoài bốn giá trị schema cho phép phải hiện
// nhãn RIÊNG ("Không xác định") và KHÔNG BAO GIỜ bị ép về một nhãn hợp lệ. Trên
// màn hình tiền, status lạ hiện thành "Chờ thanh toán" là bảo một người đã trả
// đi trả lần nữa.
//
// Chữ được ghim bằng CHUỖI CỐ ĐỊNH chứ không tra lại `copy`: nếu hai giá trị
// trong `copy` bị hoán cho nhau, phép so với chính `copy` vẫn xanh.
//
// render() không tự dọn (vitest.config.ts không có setupFiles) nên có cleanup.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrderStatusBadge } from "./OrderStatusBadge";

afterEach(cleanup);

/** Đọc badge đã render. NÉM khi không có gì được render — một helper trả "" sẽ
 *  làm mọi khẳng định "khác X" xanh trên một cây DOM rỗng. */
function badgeOf(status: string): { text: string; className: string } {
  const { container } = render(<OrderStatusBadge status={status} />);
  const badge = container.firstElementChild;
  if (!(badge instanceof HTMLElement)) throw new Error("OrderStatusBadge rendered nothing");
  const text = badge.textContent ?? "";
  if (text === "") throw new Error("OrderStatusBadge rendered an empty label");
  cleanup();
  return { text, className: badge.className };
}

describe("bốn status được schema cho phép", () => {
  it.each([
    ["pending", "Chờ thanh toán"],
    ["paid", "Đã thanh toán"],
    ["expired", "Hết hiệu lực"],
    ["cancelled", "Đã huỷ"],
  ])("%s đọc ra đúng chữ đã duyệt", (status, expected) => {
    expect(badgeOf(status).text).toBe(expected);
  });

  it("bốn nhãn đôi một khác nhau — đặc biệt expired và cancelled là hai sự thật khác nhau", () => {
    const words = ["pending", "paid", "expired", "cancelled"].map((s) => badgeOf(s).text);
    expect(new Set(words).size).toBe(4);
  });
});

describe("status không nhận ra — nhánh thứ năm, không bao giờ bị ép về nhánh hợp lệ", () => {
  // "refunded" được chọn CỐ Ý: schema KHÔNG có trạng thái này (hoàn tiền là thao
  // tác ngân hàng), nhưng là giá trị trông hợp lý nhất mà người đọc code tưởng
  // là được chấp nhận.
  it.each(["refunded", "", " ", "PENDING", "Paid", "unknown"])(
    "giá trị %j hiện 'Không xác định'",
    (status) => {
      expect(badgeOf(status).text).toBe("Không xác định");
    }
  );

  it("không đọc thành pending hay paid, và diện mạo khác hẳn hai nhánh đó", () => {
    const unknown = badgeOf("refunded");
    const pending = badgeOf("pending");
    const paid = badgeOf("paid");
    expect(unknown.text).not.toBe(pending.text);
    expect(unknown.text).not.toBe(paid.text);
    expect(unknown.className).not.toBe(pending.className);
    expect(unknown.className).not.toBe(paid.className);
  });

  it("các giá trị prototype ('constructor', 'toString') không lọt vào bảng cấu hình", () => {
    // `value in CONFIG` đúng với khoá thừa kế từ Object.prototype; nếu bảng là
    // object thường thì "constructor" bị coi là status hợp lệ và crash lúc render.
    expect(badgeOf("constructor").text).toBe("Không xác định");
    expect(badgeOf("toString").text).toBe("Không xác định");
  });
});
