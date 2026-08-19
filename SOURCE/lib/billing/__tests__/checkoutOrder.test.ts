// `toCheckoutOrder()` — MỘT hình dạng dòng, ĐÚNG MỘT dạng serialize.
// Backend DD § "One mapper, not two — and it is not 'byte-identical by
// construction'" (I010); UI Spec § Component `PaymentPanel` (C-13), khai báo
// tám trường chuẩn tắc cho backend.
//
// THỨ ĐANG ĐƯỢC KIỂM LÀ DẠNG CHUỖI, KHÔNG PHẢI "CÙNG MỘT THỜI ĐIỂM".
// PostgREST render `timestamptz` thành `2026-08-18T17:30:00+00:00`;
// `new Date(x).toISOString()` render CÙNG thời điểm ấy thành
// `2026-08-18T17:30:00.000Z`. Hai chuỗi KHÁC NHAU cho một khoảnh khắc — và
// AC-027 so sánh CHUỖI. Vì thế mọi khẳng định dưới đây so `toBe`/`toEqual` trên
// chuỗi, không dùng `new Date(a).getTime() === new Date(b).getTime()`: phép so
// theo thời điểm xanh với đúng cái bug mà file này tồn tại để chặn.
//
// GIÁ TRỊ KỲ VỌNG GÕ TAY, KHÔNG SUY RA TỪ THỨ ĐANG KIỂM. Không dòng nào dưới
// đây gọi `new Date(...).toISOString()`, gọi `toCheckoutOrder()` lần thứ hai,
// hay đọc lại một trường của kết quả để làm kỳ vọng cho trường khác. Mọi chuỗi
// `…Z` là hằng viết thẳng, quy đổi bằng tay. Một kỳ vọng tính theo đúng cách
// implementation tính sẽ TRÔI THEO BUG và xanh vĩnh viễn.
//
// MÚI GIỜ: máy dev chạy `Asia/Saigon`, trùng múi mà `lib/format/datetime.ts`
// ghim. Nên mốc thời gian ở ca 1 được chọn sao cho NGÀY LỊCH ở UTC (18/08) khác
// ngày lịch ở ICT (19/08, vì 17:30Z = 00:30 hôm sau). Một implementation dựng
// chuỗi theo giờ ĐỊA PHƯƠNG đỏ ngay tại đây; một mốc chỉ lệch nhau vài giờ
// trong cùng một ngày thì không phát hiện được rò rỉ giờ địa phương.
//
// KHÔNG MOCK GÌ CẢ: mapping thuần, đầu vào là literal, không I/O, không đồng hồ.

import { describe, expect, it } from "vitest";

import { toCheckoutOrder, type PaymentOrderRow } from "@/lib/billing/checkoutOrder";

/** Một dòng `payment_orders` đúng như PostgREST giao nó: snake_case, `bigint` và
 *  `integer` là số JSON, `timestamptz` mang offset `+00:00`.
 *
 *  Bốn giá trị `text` cố ý KHÁC NHAU ĐÔI MỘT (payload QR, số tài khoản, tên chủ
 *  tài khoản, memo). Đó là điều kiện để một implementation HOÁN VỊ hai trường
 *  text cho nhau bị bắt: nếu hai bên của phép so đến từ cùng một nguồn hoặc
 *  trùng giá trị, một cú tráo vẫn xanh. */
const POSTGREST_ROW: PaymentOrderRow = {
  order_code: 1755518400001,
  amount: 39000,
  status: "pending",
  pending_until: "2026-08-18T17:30:00+00:00",
  qr_payload:
    "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN62190815MSMOLAR17555184006304A1B2",
  account_number: "0011001234567",
  account_name: "CONG TY TNHH MS MOLAR",
  memo: "MSMOLAR 1755518400001",
};

describe("toCheckoutOrder", () => {
  it("chuẩn hoá `pending_until` dạng `+00:00` của PostgREST thành dạng `…Z` CÓ mili giây", () => {
    const order = toCheckoutOrder(POSTGREST_ROW);

    // 2026-08-18T17:30:00+00:00 là 17:30:00.000 UTC — quy đổi bằng tay, gõ
    // thẳng ra đây. Ca này loại bỏ ba implementation sai:
    //   (a) trả `row.pending_until` nguyên xi  → "…+00:00", sai đuôi;
    //   (b) cắt mili giây                      → "2026-08-18T17:30:00Z";
    //   (c) dựng chuỗi theo giờ địa phương     → ngày 19/08 dưới ICT.
    expect(order.pendingUntil).toBe("2026-08-18T17:30:00.000Z");
  });

  it("quy đổi THỜI ĐIỂM chứ không vá chuỗi: offset khác 0 và mili giây rút gọn", () => {
    const order = toCheckoutOrder({
      ...POSTGREST_ROW,
      pending_until: "2026-08-18T23:45:00.5+07:00",
    });

    // 23:45:00.5 ở +07:00 là 16:45:00.500 UTC (trừ 7 giờ, vẫn ngày 18) — quy
    // đổi bằng tay. Ca này loại bỏ hai implementation mà ca trên còn để lọt:
    //   (d) `row.pending_until.replace("+00:00", ".000Z")` — cắt dán chuỗi, để
    //       nguyên giờ 23:45 sai mất 7 tiếng;
    //   (e) luôn nối ".000Z" — làm mất phần thập phân .5 thật của dòng.
    expect(order.pendingUntil).toBe("2026-08-18T16:45:00.500Z");
  });

  it("trả ĐÚNG tám trường C-13, đúng tên và đúng thứ tự, không thừa không thiếu", () => {
    const order = toCheckoutOrder(POSTGREST_ROW);

    // Thứ tự lẫn danh sách đều là hợp đồng (UI Spec C-13). Khẳng định trên
    // `Object.keys` bắt được cả trường thừa lọt ra (vd `amount` snake_case còn
    // sót) lẫn trường thiếu — thứ mà phép kiểm từng-trường-một không thấy.
    expect(Object.keys(order)).toEqual([
      "orderCode",
      "amountVnd",
      "status",
      "pendingUntil",
      "qrPayload",
      "accountNumber",
      "accountName",
      "memo",
    ]);
  });

  it("bốn trường text đi thẳng, `amount` chỉ ĐỔI TÊN thành `amountVnd`, `order_code` ra number", () => {
    const order = toCheckoutOrder(POSTGREST_ROW);

    // Toàn bộ giá trị kỳ vọng gõ thẳng, không lấy lại từ `POSTGREST_ROW` và
    // không đọc từ `order`. Bốn chuỗi text khác nhau đôi một nên một cú tráo
    // (account_number ↔ memo, account_name ↔ qr_payload…) làm đỏ ca này.
    expect(order).toEqual({
      orderCode: 1755518400001,
      amountVnd: 39000,
      status: "pending",
      pendingUntil: "2026-08-18T17:30:00.000Z",
      qrPayload:
        "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN62190815MSMOLAR17555184006304A1B2",
      accountNumber: "0011001234567",
      accountName: "CONG TY TNHH MS MOLAR",
      memo: "MSMOLAR 1755518400001",
    });
    // `amountVnd` KHÔNG được định dạng ở đây (backend DD: "never formatted
    // here"): một chuỗi "39.000" lọt ra là đổi luôn kiểu của hợp đồng.
    expect(typeof order.amountVnd).toBe("number");
    expect(typeof order.orderCode).toBe("number");
  });

  it("status ngoài CHECK vẫn đi thẳng — mapper không phán xét, đó là việc của chỗ đọc", () => {
    // 'refunded' không nằm trong bốn literal của CHECK và không code path nào
    // đặt được nó (D10: hoàn tiền là thao tác ngân hàng + SQL sửa tay). Nó chỉ
    // tới được bằng schema drift, và UI Spec UI-D15 render nhánh "không nhận
    // ra" — nhánh ấy chỉ tồn tại nếu mapper CHUYỂN NGUYÊN giá trị lạ thay vì
    // quy nó về 'pending' hay ném lỗi.
    const order = toCheckoutOrder({ ...POSTGREST_ROW, status: "refunded" });

    expect(order.status).toBe("refunded");
  });
});
