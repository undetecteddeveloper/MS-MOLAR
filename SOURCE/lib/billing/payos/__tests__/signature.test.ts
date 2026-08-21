// Xác minh chữ ký webhook payOS — backend DD § "lib/billing/payos/ — the adapter",
// ADR-0014 § Implementation Guidance ("Verify the signature BEFORE touching the
// database or the network", "Read `orderCode`, and nothing else").
//
// FIXTURE LÀ LITERAL, VÀ DIGEST KHÔNG DO CODE NÀY SINH RA. Chuỗi ký kỳ vọng
//   được tính bằng `openssl dgst -sha256 -hmac <key>` trên chuỗi chuẩn hoá GÕ
//   TAY (xem CANONICAL_STRING trong docblock dưới), không phải bằng cách gọi
//   `verifyWebhookSignature()` rồi chép kết quả ra. Một digest do chính
//   implementation sinh ra không chứng minh được implementation đúng: nó chỉ
//   chứng minh implementation nhất quán với chính nó.
//
// BA CA ÂM ĐỀU LÀ THÂN JSON HỢP LỆ, và đó là điều kiện để chúng có sức phân
//   biệt. Một fixture "hỏng" (JSON sai cú pháp, thiếu trường, sai kiểu) bị
//   implementation từ chối vì một LÝ DO KHÁC — nó kiểm parser, không kiểm MAC.
//   Ca `TAMPERED_AMOUNT` và `TAMPERED_COUNTER_NAME` chỉ khác fixture thật đúng
//   một GIÁ TRỊ mà HMAC có phủ, mọi thứ còn lại y nguyên kể cả `signature`.
//
// MỖI CA LOẠI ĐƯỢC NHỮNG IMPLEMENTATION SAI NÀO (viết ra để lần sau còn đọc lại):
//   · GENUINE (đơn PAID, khoá `data` xếp LỘN XỘN trên dây)
//       – loại impl băm `JSON.stringify(JSON.parse(rawBody))` (băm cả thân đã
//         tái tuần tự hoá) → digest khác hoàn toàn;
//       – loại impl băm thẳng `rawBody`;
//       – loại impl ghép `key=value` theo THỨ TỰ CHÈN thay vì theo alphabet →
//         thứ tự trên dây khác thứ tự alphabet nên chuỗi chuẩn hoá khác;
//       – loại impl URL-encode giá trị (`MB%20Bank`) — fixture cố ý có dấu cách.
//   · REORDERED (cùng giá trị, khoá `data` xếp ĐÚNG alphabet, CÙNG chữ ký)
//       – nhân chứng thứ hai cho luật sắp xếp: một impl dùng thứ tự chèn sẽ
//         xanh ở ca này và đỏ ở GENUINE, nên hai ca cùng nhau ghim đúng luật.
//   · TAMPERED_AMOUNT (39000 → 3900000, JSON hợp lệ, đúng kiểu số)
//       – loại impl chỉ ký một TẬP CON các khoá "quan trọng" mà bỏ sót amount;
//       – loại impl bỏ qua verify khi `code === "00"`.
//   · TAMPERED_COUNTER_NAME (NGUYEN VAN A → B)
//       – loại impl chỉ đưa vào chuỗi chuẩn hoá những trường NÓ QUAN TÂM
//         (orderCode/amount/status). Trường này không chỗ nào đọc, nên đây là
//         ca duy nhất bắt được kiểu "allowlist khoá" đó.
//   · TRUNCATED_SIGNATURE (32 ký tự đầu của chữ ký thật)
//       – loại impl so sánh bằng `startsWith`/`==` trên tiền tố; so sánh đủ độ
//         dài phải trả về null.
//
// KHÔNG có ca nào ở đây gọi mạng: `verifyWebhookSignature` thuần CPU, đó chính
// là lý do ADR-0014 đặt nó làm bộ lọc trước mọi I/O.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verifyWebhookSignature } from "../signature";

// ───────────────────────────── Fixture literal ─────────────────────────────
// Khoá tính tiền của fixture. Không phải khoá thật của bất kỳ môi trường nào.
const CHECKSUM_KEY = "b5c3f1a9e7d2b4a6c8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4";

// Chuỗi chuẩn hoá tương ứng với `data` của GENUINE — 16 cặp, khoá xếp theo
// alphabet, giá trị NGUYÊN VĂN (không URL-encode), nối bằng "&":
//
//   accountNumber=0123456789&amount=39000&code=00&counterAccountBankId=970422&
//   counterAccountBankName=MB Bank&counterAccountName=NGUYEN VAN A&
//   counterAccountNumber=0987654321&currency=VND&desc=success&
//   description=MSMOLAR 2026081900&orderCode=2026081900&
//   paymentLinkId=7f3d2a1b9c4e&reference=FT26081912345&
//   transactionDateTime=2026-08-19 10:15:00&virtualAccountName=MS MOLAR&
//   virtualAccountNumber=V3CAS0123456789
//
// (402 byte, không xuống dòng.) Digest kỳ vọng, tính NGOÀI dự án này:
//   printf '%s' "<chuỗi trên>" | openssl dgst -sha256 -hmac "<CHECKSUM_KEY>"
//   => 7b50211951b67fb19d5e1472709ac363716e0df45d32ef84b1eba45f7dfa2b95
const EXPECTED_SIGNATURE =
  "7b50211951b67fb19d5e1472709ac363716e0df45d32ef84b1eba45f7dfa2b95";

// Thân thật của một lần giao hàng đã thanh toán. Khoá trong `data` cố ý KHÔNG
// theo alphabet — đó là thứ làm ca này phân biệt được impl dùng thứ tự chèn.
const RAW_GENUINE =
  '{"code":"00","desc":"success","success":true,"data":{"orderCode":2026081900,"amount":39000,"description":"MSMOLAR 2026081900","reference":"FT26081912345","transactionDateTime":"2026-08-19 10:15:00","virtualAccountName":"MS MOLAR","virtualAccountNumber":"V3CAS0123456789","counterAccountBankId":"970422","counterAccountBankName":"MB Bank","counterAccountName":"NGUYEN VAN A","counterAccountNumber":"0987654321","accountNumber":"0123456789","currency":"VND","paymentLinkId":"7f3d2a1b9c4e","code":"00","desc":"success"},"signature":"' +
  EXPECTED_SIGNATURE +
  '"}';

// Cùng 16 khoá, cùng 16 giá trị, khác THỨ TỰ trên dây (ở đây: đúng alphabet).
// Cùng một chữ ký phải verify được — chuẩn hoá xếp khoá trước khi băm.
const RAW_REORDERED =
  '{"code":"00","desc":"success","success":true,"data":{"accountNumber":"0123456789","amount":39000,"code":"00","counterAccountBankId":"970422","counterAccountBankName":"MB Bank","counterAccountName":"NGUYEN VAN A","counterAccountNumber":"0987654321","currency":"VND","desc":"success","description":"MSMOLAR 2026081900","orderCode":2026081900,"paymentLinkId":"7f3d2a1b9c4e","reference":"FT26081912345","transactionDateTime":"2026-08-19 10:15:00","virtualAccountName":"MS MOLAR","virtualAccountNumber":"V3CAS0123456789"},"signature":"' +
  EXPECTED_SIGNATURE +
  '"}';

// Đúng MỘT byte-vùng đổi so với GENUINE: `"amount":39000` → `"amount":3900000`.
// JSON vẫn hợp lệ, `amount` vẫn là số, chữ ký giữ nguyên.
const RAW_TAMPERED_AMOUNT = RAW_GENUINE.replace('"amount":39000', '"amount":3900000');

// Đổi một trường KHÔNG chỗ nào trong repo đọc tới — nhưng HMAC có phủ.
const RAW_TAMPERED_COUNTER_NAME = RAW_GENUINE.replace("NGUYEN VAN A", "NGUYEN VAN B");

// Chữ ký thật, cắt còn 32 ký tự đầu.
const RAW_TRUNCATED_SIGNATURE = RAW_GENUINE.replace(
  EXPECTED_SIGNATURE,
  EXPECTED_SIGNATURE.slice(0, 32)
);

// Một lần giao hàng có trường `null` — hình dạng THẬT của mọi delivery chưa có
// người chuyển tiền (payOS để trống nhóm `counterAccount*`/`reference`). Luật
// chuẩn hoá của nhà cung cấp: null ⇒ chuỗi rỗng, khoá VẪN có mặt trong chuỗi ký.
// Chuỗi chuẩn hoá (8 cặp):
//   accountNumber=0123456789&amount=39000&code=00&counterAccountName=&
//   desc=success&description=MSMOLAR 2026081902&orderCode=2026081902&reference=
// => 4fe6c06179de9ee21c40c08d2209f30f56451b55704c633df2ea1a95d3d75adf (openssl)
const RAW_GENUINE_WITH_NULLS =
  '{"code":"00","desc":"success","success":true,"data":{"orderCode":2026081902,"amount":39000,"description":"MSMOLAR 2026081902","accountNumber":"0123456789","reference":null,"counterAccountName":null,"code":"00","desc":"success"},"signature":"4fe6c06179de9ee21c40c08d2209f30f56451b55704c633df2ea1a95d3d75adf"}';

beforeEach(() => {
  vi.stubEnv("PAYOS_CHECKSUM_KEY", CHECKSUM_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyWebhookSignature — chấp nhận", () => {
  it("verify được một lần giao hàng thật và chỉ trả về orderCode", () => {
    const result = verifyWebhookSignature(RAW_GENUINE);

    expect(result).toEqual({ orderCode: 2026081900 });
    // P-1 ở nửa webhook: KHÔNG trường nào khác của payload đi tiếp. Đếm thuộc
    // tính, không chỉ kiểm sự hiện diện của orderCode.
    expect(Object.getOwnPropertyNames(result)).toHaveLength(1);
  });

  it("cùng giá trị, khác thứ tự khoá trên dây, cùng chữ ký ⇒ vẫn verify", () => {
    expect(verifyWebhookSignature(RAW_REORDERED)).toEqual({ orderCode: 2026081900 });
  });

  it("verify được thân có trường null — null chuẩn hoá thành chuỗi rỗng, khoá vẫn được ký", () => {
    expect(verifyWebhookSignature(RAW_GENUINE_WITH_NULLS)).toEqual({
      orderCode: 2026081902,
    });
  });
});

describe("verifyWebhookSignature — từ chối (JSON hợp lệ, chỉ khác giá trị HMAC có phủ)", () => {
  it("từ chối khi `amount` bị sửa", () => {
    expect(verifyWebhookSignature(RAW_TAMPERED_AMOUNT)).toBeNull();
  });

  it("từ chối khi một trường không ai đọc bị sửa (`counterAccountName`)", () => {
    expect(verifyWebhookSignature(RAW_TAMPERED_COUNTER_NAME)).toBeNull();
  });

  it("từ chối chữ ký bị cắt ngắn — so sánh phải đủ độ dài, không phải tiền tố", () => {
    expect(verifyWebhookSignature(RAW_TRUNCATED_SIGNATURE)).toBeNull();
  });
});

describe("verifyWebhookSignature — TRẢ NULL, không bao giờ ném", () => {
  // Bốn ca dưới đây kiểm HỢP ĐỒNG "null thay vì throw" (route ở Task 4.1 rẽ
  // nhánh chứ không bắt lỗi). Chúng KHÔNG kiểm MAC — một fixture hỏng cú pháp
  // bị từ chối vì lý do khác — và được đặt riêng khỏi nhóm trên vì thế.
  it.each([
    ["JSON hỏng", "{not json"],
    ["thân rỗng", ""],
    ["thiếu trường signature", '{"code":"00","data":{"orderCode":1}}'],
    ["thiếu object data", '{"code":"00","signature":"' + EXPECTED_SIGNATURE + '"}'],
  ])("trả null với %s", (_label, raw) => {
    expect(() => verifyWebhookSignature(raw)).not.toThrow();
    expect(verifyWebhookSignature(raw)).toBeNull();
  });

  it("trả null khi orderCode không phải số nguyên an toàn, dù chữ ký đúng", () => {
    // Chuỗi chuẩn hoá của `{"orderCode":"abc"}` là `orderCode=abc`; digest dưới
    // đây tính bằng openssl trên đúng chuỗi đó, nên ca này ĐI QUA được cổng
    // chữ ký rồi mới rơi ở cổng kiểu — đúng chỗ cần kiểm.
    const sig = "0862165880711a72cd3d83ecc440d6df3e7f42e2e7bed1a7502ba7d80834d9b1";
    const raw = '{"data":{"orderCode":"abc"},"signature":"' + sig + '"}';
    expect(verifyWebhookSignature(raw)).toBeNull();
  });

  it("trả null khi PAYOS_CHECKSUM_KEY chưa cấu hình — im lặng fail-closed", () => {
    // checkEnv.ts đã nói to ca này lúc khởi động; ở đây điều được ghim là
    // KHÔNG có đường nào verify được khi thiếu khoá.
    vi.stubEnv("PAYOS_CHECKSUM_KEY", "");
    expect(verifyWebhookSignature(RAW_GENUINE)).toBeNull();
  });
});
