import "server-only";

import { ORDER_PENDING_WINDOW_MS } from "@/lib/billing/pricing";

import { signRequestFields } from "./signature";

// Adapter payOS — TỪ NGỮ NHÀ CUNG CẤP DỪNG LẠI Ở THƯ MỤC NÀY.
//
// ADR-0013 § Architecture Impact: *"One provider boundary, and everything
// provider-specific behind it. `orderCode`, `checksum key`, signature format,
// `expiredAt`, and the `PENDING`/`SUCCEEDED`/`CANCELLED` vocabulary belong
// inside a single payOS adapter module. Nothing above that line … may reference
// a payOS type."* Đó là điều biến tiêu chí rời bỏ payOS (SePay) thành một lần
// thay adapter thay vì một lần viết lại — nên mọi chuỗi `PENDING`/`SUCCEEDED`/
// `CANCELLED`, mọi `x-client-id`, mọi `qrCode` chỉ được xuất hiện dưới đây.
//
// KHÔNG SDK, CỐ Ý (backend DD § Dependency verification): bề mặt dùng tới là ba
// endpoint và một HMAC — nhỏ hơn cái giá thẩm định và ghim một dependency nằm
// trên đường tiền; thêm dependency ở repo này cần một ADR (tiền lệ ADR-0009).
//
// HÌNH DẠNG LỖI VÀ LOG chép từ `lib/tutor/callTutor.ts` — lời gọi dịch vụ ngoài
// tự dựng duy nhất đang có trong repo: một lớp lỗi CÓ KIỂU mà `message` chỉ
// mang `site` (hằng do chính file này đặt), và một hàm log chỉ ghi metadata an
// toàn phía máy chủ. Ở đây điều đó chặt hơn một bậc: PRD AC-034 và P-1 cấm mọi
// trường của nhà cung cấp — đặc biệt `transactions[]` — chạm tới bất kỳ log
// nào, nên log dưới đây ghi đúng ba thứ: site, mã HTTP, thời gian.

/** Host production duy nhất payOS công bố (`external-resources.md` § Payment
 *  Gateway — không có sandbox nào được ghi nhận; PRD U1 đã chốt "không có"). */
const PAYOS_BASE_URL = "https://api-merchant.payos.vn";

/** Hạn chót một lời gọi. Ngắn hơn mốc 30s của gia sư: cả hai chỗ gọi adapter
 *  (webhook và `recheckOrder()`) đều có người hoặc một retry đứng chờ, và
 *  `settleOrder()` đã có nhánh `provider_unavailable` để rơi vào. */
const PAYOS_CALL_DEADLINE_MS = 15_000;

/** Trạng thái đơn, đã dịch sang từ ngữ của CHÚNG TA. `unknown` không phải một
 *  giá trị rác: nó là câu trả lời fail-closed cho một literal nhà cung cấp trả
 *  về mà bảng dịch dưới đây chưa biết — không đường nào biến nó thành `paid`. */
export type PaymentStatus = "pending" | "paid" | "cancelled" | "unknown";

/** Đơn hàng cần tạo, bằng từ ngữ của chúng ta. `memo` là thứ payOS gọi là
 *  `description`; phép dịch nằm ở chính hàm tạo đơn bên dưới, đúng một chỗ. */
export type OrderDraft = {
  orderCode: number;
  amountVnd: number;
  memo: string;
  returnUrl: string;
  cancelUrl: string;
};

/** Bảy giá trị `createOrder()` ghi xuống dòng đơn. Tên trường theo backend DD
 *  § Main Components; `amount`/`orderCode` giữ nguyên tên nhà cung cấp vì DD
 *  khai như thế và vì chúng là cùng một khái niệm ở cả hai phía. */
export type PaymentRequestResult = {
  qrPayload: string;
  accountNumber: string;
  accountName: string;
  memo: string;
  orderCode: number;
  amount: number;
  expiresAt: string;
};

/**
 * Lỗi có kiểu của một lời gọi payOS. `message` cố ý chỉ mang `site` — không bao
 * giờ mang thân response, `desc` của nhà cung cấp hay bất kỳ giá trị nào của
 * `transactions[]`: message của một Error rất dễ bị người gọi ghi thẳng vào log.
 *
 * `settleOrder()` bắt nó và trả `provider_unavailable`; `createOrder()` bắt nó
 * và KHÔNG ghi dòng `payment_orders` nào (thứ tự provider-first).
 */
export class PayosCallError extends Error {
  readonly site: string;

  constructor(site: string) {
    super(`payos call failed (${site})`);
    this.name = "PayosCallError";
    this.site = site;
  }
}

/** Log chẩn đoán phía máy chủ. Chỉ metadata an toàn — KHÔNG thân, KHÔNG chữ ký,
 *  KHÔNG khoá, KHÔNG một trường nào của nhà cung cấp (P-1, AC-034). `orderCode`
 *  là định danh của CHÚNG TA (nó nằm sẵn trong `payment_orders`), nên nó ở lại:
 *  không có nó thì một sự cố thanh toán không truy được về đơn nào. */
function logPayosExit(site: string, detail: Record<string, number | string>): void {
  console.error(`[payos] ${site}`, JSON.stringify(detail));
}

function credentials(): { clientId: string; apiKey: string } | null {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim() ?? "";
  const apiKey = process.env.PAYOS_API_KEY?.trim() ?? "";
  if (!clientId || !apiKey) return null;
  return { clientId, apiKey };
}

type PayosEnvelope = { code?: unknown; data?: unknown };

/**
 * Một lời gọi HTTP tới payOS, trả về `data` của envelope đã kiểm.
 *
 * Mọi lối thất bại đều NÉM: mạng hỏng, HTTP khác 2xx, JSON hỏng, envelope
 * `code` khác `"00"`, thiếu `data`. Không có nhánh nào trả về giá trị mặc định
 * — một câu trả lời bịa ra ở đây là một quyết định về tiền lấy từ chỗ không ai
 * hỏi (fail-fast; `settleOrder()`/`createOrder()` mới là chỗ có quyền quyết
 * định hệ quả nghiệp vụ).
 */
async function payosRequest(
  site: string,
  url: string,
  init: { method: "GET" | "POST"; body?: string },
  logContext: Record<string, number | string>
): Promise<Record<string, unknown>> {
  const creds = credentials();
  if (!creds) {
    logPayosExit(`${site}:credentials`, logContext);
    throw new PayosCallError(`${site}:credentials`);
  }

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        "x-client-id": creds.clientId,
        "x-api-key": creds.apiKey,
        "content-type": "application/json",
      },
      body: init.body,
      signal: AbortSignal.timeout(PAYOS_CALL_DEADLINE_MS),
      cache: "no-store",
    });
  } catch {
    // Thân của lỗi mạng không được ghi lại: nó có thể mang URL kèm tham số.
    logPayosExit(`${site}:transport`, { ...logContext, elapsedMs: Date.now() - startedAt });
    throw new PayosCallError(`${site}:transport`);
  }

  if (!response.ok) {
    logPayosExit(`${site}:http`, {
      ...logContext,
      httpStatus: response.status,
      elapsedMs: Date.now() - startedAt,
    });
    throw new PayosCallError(`${site}:http`);
  }

  let envelope: PayosEnvelope;
  try {
    envelope = JSON.parse(await response.text()) as PayosEnvelope;
  } catch {
    logPayosExit(`${site}:parse`, { ...logContext, elapsedMs: Date.now() - startedAt });
    throw new PayosCallError(`${site}:parse`);
  }

  // `"00"` là mã "thành công" của payOS; bất kỳ mã nào khác nghĩa là nhà cung
  // cấp KHÔNG trả lời câu hỏi ta hỏi. `desc` đi kèm là văn bản của họ và không
  // được ghi lại — mã envelope là đủ để phân biệt ca cấu hình sai với ca sự cố.
  if (envelope.code !== "00") {
    logPayosExit(`${site}:envelope`, {
      ...logContext,
      providerCode: String(envelope.code),
      elapsedMs: Date.now() - startedAt,
    });
    throw new PayosCallError(`${site}:envelope`);
  }

  const data = envelope.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    logPayosExit(`${site}:shape`, { ...logContext, elapsedMs: Date.now() - startedAt });
    throw new PayosCallError(`${site}:shape`);
  }
  return data as Record<string, unknown>;
}

/** Bảng dịch DUY NHẤT giữa từ ngữ payOS và từ ngữ của chúng ta.
 *
 *  Ba literal nguồn là ba literal `docs/adr/ADR-0013…` § References ghi nhận từ
 *  `payos.vn/docs/api` (đọc 2026-08-16). Mọi literal khác rơi về `unknown` —
 *  hướng hỏng luôn là KHÔNG kích hoạt thuê bao, không bao giờ là kích hoạt
 *  nhầm. Nếu giao dịch thật ở plan Task 6.7 cho thấy một literal khác cho ca
 *  "đã trả", ĐÂY là dòng duy nhất phải sửa. */
function toPaymentStatus(providerStatus: unknown): PaymentStatus {
  switch (String(providerStatus).trim().toUpperCase()) {
    case "PENDING":
      return "pending";
    case "SUCCEEDED":
      return "paid";
    case "CANCELLED":
      return "cancelled";
    default:
      return "unknown";
  }
}

/**
 * Hỏi payOS về một đơn — biên TIN CẬY của cả tính năng (ADR-0014: nhà cung cấp,
 * không phải khoá bí mật của ta, là lý do ta tin tiền đã chuyển).
 *
 * @returns ĐÚNG HAI thuộc tính: `status` và `amount`. **P-1 (normative)** của
 *   backend DD § Sensitivity: không trường nào của `transactions[]` được phép
 *   chạm tới một cột hay một dòng log, và hình dạng hẹp này là thứ giữ điều đó
 *   bằng CẤU TRÚC thay vì bằng kỷ luật — trường duy nhất của nhà cung cấp có
 *   thể rò rỉ là trường được viết ra ở đây.
 * @throws {PayosCallError} mọi lối thất bại của lời gọi.
 */
export async function getPaymentStatus(
  orderCode: number
): Promise<{ status: PaymentStatus; amount: number }> {
  const data = await payosRequest(
    "getPaymentStatus",
    `${PAYOS_BASE_URL}/v2/payment-requests/${orderCode}`,
    { method: "GET" },
    { orderCode }
  );

  const rawAmount = data.amount;
  return {
    status: toPaymentStatus(data.status),
    // Số tiền nhà cung cấp báo, KHÔNG phải số tiền ta mong đợi: bước 3 của
    // `settleOrder()` so nó với dòng đơn đã lưu. Một response thiếu `amount`
    // cho 0, và 0 không bao giờ khớp một đơn thật — fail-closed.
    amount: typeof rawAmount === "number" && Number.isFinite(rawAmount) ? rawAmount : 0,
  };
}

function requireString(data: Record<string, unknown>, key: string, site: string): string {
  const value = data[key];
  if (typeof value !== "string" || value.length === 0) throw new PayosCallError(site);
  return value;
}

function requireNumber(data: Record<string, unknown>, key: string, site: string): number {
  const value = data[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new PayosCallError(site);
  return value;
}

/**
 * Tạo một payment request và trả về BỐN giá trị chuyển khoản cộng ba giá trị
 * định danh mà `payment_orders` ghi xuống. payOS chỉ trả nhóm này lúc TẠO, không
 * trả lúc GET (backend DD § "S-06's read path"), nên đây là nguồn duy nhất.
 *
 * Phép dịch từ ngữ xảy ra ở đúng đây: `qrCode` → `qrPayload`,
 * `description` → `memo`. Không tên nào của nhà cung cấp đi tiếp lên trên.
 *
 * `expiredAt` gửi đi và `expiresAt` trả về là CÙNG MỘT MỐC, tính từ
 * `ORDER_PENDING_WINDOW_MS` — cùng hằng đặt `payment_orders.pending_until`
 * (ADR-0013 § Implementation Guidance: hai đồng hồ lệch nhau sinh ra một QR mà
 * một bên coi là còn sống, bên kia coi là đã chết). Mốc được làm tròn xuống
 * GIÂY trước khi tách làm hai, vì payOS nhận `expiredAt` theo giây — làm tròn
 * sau khi tách là cách để hai giá trị lệch nhau dưới một giây mà không ai thấy.
 *
 * @throws {PayosCallError} lời gọi thất bại, hoặc response thiếu một trong các
 *   trường bắt buộc — không có nhánh nào trả về một đơn nửa vời.
 */
export async function createPaymentRequest(draft: OrderDraft): Promise<PaymentRequestResult> {
  const expiresAtSec = Math.floor((Date.now() + ORDER_PENDING_WINDOW_MS) / 1000);

  // Đúng năm trường payOS đưa vào chuỗi ký, và chỉ năm trường đó.
  const signedFields = {
    amount: draft.amountVnd,
    cancelUrl: draft.cancelUrl,
    description: draft.memo,
    orderCode: draft.orderCode,
    returnUrl: draft.returnUrl,
  };
  const signature = signRequestFields(signedFields);
  if (!signature) {
    logPayosExit("createPaymentRequest:credentials", { orderCode: draft.orderCode });
    throw new PayosCallError("createPaymentRequest:credentials");
  }

  const data = await payosRequest(
    "createPaymentRequest",
    `${PAYOS_BASE_URL}/v2/payment-requests`,
    {
      method: "POST",
      body: JSON.stringify({ ...signedFields, expiredAt: expiresAtSec, signature }),
    },
    { orderCode: draft.orderCode }
  );

  const site = "createPaymentRequest:shape";
  return {
    qrPayload: requireString(data, "qrCode", site),
    accountNumber: requireString(data, "accountNumber", site),
    accountName: requireString(data, "accountName", site),
    memo: requireString(data, "description", site),
    orderCode: requireNumber(data, "orderCode", site),
    amount: requireNumber(data, "amount", site),
    expiresAt: new Date(expiresAtSec * 1000).toISOString(),
  };
}

export { verifyWebhookSignature } from "./signature";
export type { PayosWebhookData } from "./signature";
