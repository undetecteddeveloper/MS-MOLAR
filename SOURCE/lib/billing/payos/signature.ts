import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Chữ ký payOS — nửa TIN CẬY của đường tiền (ADR-0014).
//
// HAI CHỖ DÙNG CHUNG MỘT PHÉP CHUẨN HOÁ, và đó là lý do file này tồn tại tách
// khỏi index.ts: webhook đi vào được xác minh, payment request đi ra được ký,
// cả hai bằng cùng một hàm `toSignedString()`. Hai bản dựng chuỗi song song là
// con đường ngắn nhất tới hai kết luận khác nhau về cùng một thân dữ liệu.
//
// CHUỖI ĐƯỢC KÝ LÀ GÌ — nguồn: `docs/design/subscription-backend-design.md`
// § Data Contracts, dòng `payOS → webhook route`: *"raw JSON body + `signature`
// over sorted `key=value&…` of `data`"*; ADR-0014 `:16` và
// `docs/project-context/external-resources.md` § Payment Gateway nói cùng một
// câu: **HMAC-SHA256 trên chuỗi `key=value&…` của object `data`, khoá xếp theo
// ALPHABET, khoá tính bằng checksum key xoay được của tích hợp.** Digest hex.
//
// "TRÊN BYTE THÔ" NGHĨA LÀ GÌ Ở ĐÂY, VÌ HAI CÂU TRONG DD CĂNG NHAU VÀ CHỖ NÀY
// LÀ CHỖ PHẢI GIẢI:
//   Consumer Parse Rule viết *"HMAC verified over the raw body bytes, never
//   over re-serialised parsed JSON"*, trong khi Serialized Format ở CÙNG dòng
//   nói chữ ký phủ chuỗi `key=value` xếp khoá của `data`. Không thể vừa băm
//   nguyên byte thân JSON vừa băm chuỗi `key=value` — băm thẳng `rawBody` sẽ
//   TỪ CHỐI MỌI giao hàng thật. Điều luật thứ nhất thực sự cấm là thứ khác, và
//   nó cụ thể: **không bao giờ băm `JSON.stringify(JSON.parse(rawBody))`** —
//   một lần tái tuần tự hoá CẢ THÂN có thể đổi thứ tự khoá, đổi cách viết số
//   (1.50 → 1.5), đổi escape unicode, và một chữ ký như thế chỉ đúng với những
//   giá trị sống sót qua vòng JSON round-trip: xanh trong test, đỏ trên dây.
//   Nên: `rawBody` là ĐẦU VÀO (adapter tự parse đúng MỘT lần, không nhận object
//   ai đó đã parse hộ), và thứ được băm là chuỗi chuẩn hoá theo đúng luật nhà
//   cung cấp công bố — không phải một bản tuần tự hoá lại của thân.
//
// KHÔNG CÓ MỘT DÒNG LOG NÀO TRONG FILE NÀY. Thân webhook, chữ ký và checksum
// key đều không được phép chạm tới log (PRD AC-034, ADR-0014 § Implementation
// Guidance). Một lần từ chối là `null`, và người gọi tự ghi mã lý do của mình.

/** Thứ DUY NHẤT của payload đi tiếp lên trên (ADR-0014: *"Read `orderCode`, and
 *  nothing else"*). Đây là bản thu hẹp của `PayosWebhookData` mà backend DD
 *  § Main Components khai trong chữ ký hàm nhưng không định nghĩa nội dung:
 *  webhook là một GỢI Ý rằng `orderCode` có thể đã đổi trạng thái, không bao
 *  giờ là một chỉ thị, nên số tiền/trạng thái/người dùng trong thân không có
 *  chỗ nào đọc tới. */
export type PayosWebhookData = { orderCode: number };

function checksumKey(): string {
  return process.env.PAYOS_CHECKSUM_KEY?.trim() ?? "";
}

/** Luật tuần tự hoá giá trị của payOS, chép đúng bản tham chiếu nhà cung cấp
 *  công bố cho phía NHẬN: null/undefined thành chuỗi rỗng (khoá vẫn có mặt),
 *  chuỗi giữ nguyên văn — KHÔNG url-encode — còn lại là dạng chuỗi của giá trị.
 *
 *  Nhánh object/array hôm nay không với tới được: `data` của webhook phẳng. Nó
 *  ở đây vì cách hỏng khi payOS thêm một trường lồng là ĐẶC BIỆT tệ —
 *  `String({})` cho `[object Object]`, không digest nào khớp, và mọi webhook
 *  chết lặng (ADR-0014 ghi nhận "im lặng" là hình dạng hỏng đắt nhất của khoá
 *  sai). */
function serialiseValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** `key=value&…`, khoá xếp theo alphabet. Một chỗ duy nhất dựng chuỗi này. */
function toSignedString(fields: Record<string, unknown>): string {
  return Object.keys(fields)
    .sort()
    .filter((key) => fields[key] !== undefined)
    .map((key) => `${key}=${serialiseValue(fields[key])}`)
    .join("&");
}

function hmacHex(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

/** So sánh hai digest hex mà không thoát sớm ở byte đầu tiên khác nhau.
 *
 *  `timingSafeEqual` NÉM khi hai buffer khác độ dài, nên độ dài phải được xử lý
 *  trước — và một chữ ký bị cắt ngắn là ca thật, không phải ca giả tưởng: nó
 *  đúng là thứ mà một phép so sánh `startsWith` sẽ chấp nhận. */
function equalsDigest(received: string, expected: string): boolean {
  const a = Buffer.from(received.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Xác minh một lần giao hàng webhook payOS.
 *
 * @param rawBody thân request NGUYÊN VĂN như đã nhận trên dây. Không nhận
 *   object đã parse: xem docblock đầu file — người gọi parse hộ là chỗ mà một
 *   vòng round-trip JSON lẻn vào giữa dây và digest.
 * @returns `{ orderCode }` khi chữ ký hợp lệ; **`null`** cho mọi lối từ chối —
 *   thiếu khoá cấu hình, JSON hỏng, thiếu `data`/`signature`, chữ ký sai,
 *   `orderCode` không phải số nguyên an toàn. KHÔNG BAO GIỜ ném: route ở tầng
 *   trên rẽ nhánh trên giá trị này chứ không bắt lỗi (backend DD § adapter).
 */
export function verifyWebhookSignature(rawBody: string): PayosWebhookData | null {
  const key = checksumKey();
  // Thiếu khoá thì không có phép xác minh nào để làm. checkEnv.ts đã nói to ca
  // này lúc khởi động; ở đây nó là một lần từ chối như mọi lần khác.
  if (!key) return null;

  const body = parseJsonObject(rawBody);
  if (!body) return null;

  const signature = body.signature;
  const data = body.data;
  if (typeof signature !== "string" || signature.length === 0) return null;
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;

  const expected = hmacHex(key, toSignedString(data as Record<string, unknown>));
  if (!equalsDigest(signature, expected)) return null;

  // Đọc SAU khi chữ ký đã đúng, và chỉ đọc đúng một trường.
  const orderCode = (data as Record<string, unknown>).orderCode;
  if (typeof orderCode !== "number" || !Number.isSafeInteger(orderCode)) return null;

  return { orderCode };
}

/**
 * Ký năm trường mà payOS bắt buộc payment request phải mang chữ ký
 * (`amount`, `cancelUrl`, `description`, `orderCode`, `returnUrl`) — cùng phép
 * chuẩn hoá với đường xác minh ở trên. `expiredAt` KHÔNG nằm trong tập được ký:
 * nhà cung cấp không đưa nó vào chuỗi ký.
 *
 * @returns digest hex, hoặc `null` khi `PAYOS_CHECKSUM_KEY` chưa cấu hình —
 *   người gọi (index.ts) biến nó thành lỗi có kiểu, vì đường TẠO ĐƠN không có
 *   nhánh "im lặng bỏ qua" như đường webhook.
 */
export function signRequestFields(fields: Record<string, unknown>): string | null {
  const key = checksumKey();
  if (!key) return null;
  return hmacHex(key, toSignedString(fields));
}
