// Biên nhà cung cấp — backend DD § "lib/billing/payos/ — the adapter", § Sensitivity
// (P-1, normative) và Connection Map hai dòng `createOrder() → payOS create request`
// / `webhook route ← payOS status query`.
//
// BA ĐIỀU ĐƯỢC GHIM Ở ĐÂY, cả ba đều hỏng IM LẶNG nếu không ai đếm:
//
//   1. P-1 — `getPaymentStatus()` trả về ĐÚNG HAI thuộc tính. Không phải "có
//      status và amount": ĐẾM. Một adapter trả nguyên payload nhà cung cấp vẫn
//      có đủ hai trường đó, vẫn xanh mọi khẳng định kiểu "có chứa", và vẫn để
//      `transactions[]` (số tài khoản, tên người chuyển, mã tham chiếu ngân
//      hàng) chạm tới một cột hoặc một dòng log. Fixture dưới đây CÓ
//      `transactions[]` đầy đủ, đúng để phép đếm có gì mà bắt.
//   2. DỊCH TỪ NGỮ TẠI BIÊN — `qrCode` → `qrPayload`, `description` → `memo`.
//      Ca này khẳng định cả hai chiều: tên mới CÓ, và tên cũ KHÔNG còn trong
//      object trả về (bỏ nửa sau thì một adapter trả cả hai tên vẫn xanh).
//   3. `expiredAt` GỬI ĐI đọc từ `ORDER_PENDING_WINDOW_MS` — cùng hằng đặt
//      `payment_orders.pending_until` (ADR-0013 § Implementation Guidance: hai
//      đồng hồ lệch nhau sinh ra một QR mà một bên coi là sống, bên kia coi là
//      chết). Phép khẳng định giá trị KHÔNG phân biệt được "đọc hằng" với "gõ
//      lại 1800000 ở đây" — hai số bằng nhau thì runtime không nói gì — nên ca
//      cuối cùng của file này đọc MÃ NGUỒN, theo đúng tiền lệ
//      `readEntitlement.test.ts:475`. Nó bắt được đúng một thứ: một literal cửa
//      sổ thời gian viết lại trong adapter. Nó không bắt được một cách tính
//      vòng vo khác, và không tự nhận là bắt được.
//
// CHỮ KÝ CỦA PAYMENT REQUEST cũng là literal + digest tính bằng openssl ngoài
// dự án (xem docblock tại chỗ), cùng kỷ luật với signature.test.ts.
//
// BIÊN ĐƯỢC MOCK: `fetch` — I/O ngoài, đúng chỗ nên mock. HMAC để THẬT: nó là
// hành vi đang được kiểm, không phải phụ thuộc.

import path from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ORDER_PENDING_WINDOW_MS } from "@/lib/billing/pricing";
import { createPaymentRequest, getPaymentStatus, PayosCallError } from "../index";

const CHECKSUM_KEY = "b5c3f1a9e7d2b4a6c8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4";

// Mốc thời gian ghim: 2026-08-19T10:00:00.000Z. Hai con số dưới đây gõ tay,
// KHÔNG tính từ hằng của implementation:
const PINNED_NOW_MS = 1787133600000; // Date.parse("2026-08-19T10:00:00.000Z")
const EXPECTED_EXPIRED_AT_SEC = 1787135400; // = mốc trên + 30 phút, theo giây
const EXPECTED_EXPIRES_AT_ISO = "2026-08-19T10:30:00.000Z";

// Một response `GET /v2/payment-requests/{id}` như payOS trả về — CÓ
// `transactions[]` với đúng những trường P-1 cấm đi tiếp.
const STATUS_RESPONSE_PAID = {
  code: "00",
  desc: "success",
  data: {
    id: "7f3d2a1b9c4e",
    orderCode: 2026081900,
    amount: 39000,
    amountPaid: 39000,
    amountRemaining: 0,
    status: "SUCCEEDED",
    createdAt: "2026-08-19T10:00:00+07:00",
    canceledAt: null,
    cancellationReason: null,
    transactions: [
      {
        reference: "FT26081912345",
        amount: 39000,
        accountNumber: "0123456789",
        description: "MSMOLAR 2026081900",
        transactionDateTime: "2026-08-19 10:15:00",
        virtualAccountName: "MS MOLAR",
        virtualAccountNumber: "V3CAS0123456789",
        counterAccountBankId: "970422",
        counterAccountBankName: "MB Bank",
        counterAccountName: "NGUYEN VAN A",
        counterAccountNumber: "0987654321",
      },
    ],
  },
  signature: "8a1f0c2d",
};

const CREATE_RESPONSE = {
  code: "00",
  desc: "success",
  data: {
    bin: "970422",
    accountNumber: "0123456789",
    accountName: "NGUYEN VAN CHU SHOP",
    amount: 39000,
    description: "MSMOLAR 2026081901",
    orderCode: 2026081901,
    currency: "VND",
    paymentLinkId: "7f3d2a1b9c4e",
    status: "PENDING",
    checkoutUrl: "https://pay.payos.vn/web/7f3d2a1b9c4e",
    qrCode: "00020101021238570010A000000727012700069704220113VQRQADRTM97540208QRIBFTTA5303704540739000",
  },
  signature: "9b2e1d3c",
};

const ORDER_DRAFT = {
  orderCode: 2026081901,
  amountVnd: 39000,
  memo: "MSMOLAR 2026081901",
  returnUrl: "https://ms-molar.vn/pricing/checkout",
  cancelUrl: "https://ms-molar.vn/pricing",
};

// Chuỗi chuẩn hoá của payment request — 5 trường payOS quy định, xếp alphabet:
//   amount=39000&cancelUrl=https://ms-molar.vn/pricing&
//   description=MSMOLAR 2026081901&orderCode=2026081901&
//   returnUrl=https://ms-molar.vn/pricing/checkout
// Digest tính NGOÀI dự án:
//   printf '%s' "<chuỗi trên>" | openssl dgst -sha256 -hmac "<CHECKSUM_KEY>"
const EXPECTED_REQUEST_SIGNATURE =
  "34c04ada4f3d841f981e4b3b69179429bc26236b10723a3e4243311c27ca5d94";

function stubFetchOnce(body: unknown, init?: { ok?: boolean; status?: number }) {
  const fetchMock = vi.fn(async () => ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => JSON.stringify(body),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestBodyOf(fetchMock: ReturnType<typeof stubFetchOnce>): Record<string, unknown> {
  const call = fetchMock.mock.calls[0] as unknown as [string, { body?: string }] | undefined;
  return JSON.parse(call?.[1]?.body ?? "{}");
}

beforeEach(() => {
  vi.stubEnv("PAYOS_CLIENT_ID", "client-id-fixture");
  vi.stubEnv("PAYOS_API_KEY", "api-key-fixture");
  vi.stubEnv("PAYOS_CHECKSUM_KEY", CHECKSUM_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getPaymentStatus — P-1: đúng hai thuộc tính rời khỏi biên", () => {
  it("trả về ĐÚNG { status, amount } và không gì khác", async () => {
    stubFetchOnce(STATUS_RESPONSE_PAID);

    const result = await getPaymentStatus(2026081900);

    expect(result).toEqual({ status: "paid", amount: 39000 });
    // Phép ĐẾM, không phải phép "có chứa": đây là nửa P-1 giữ được bằng cấu
    // trúc thay vì bằng kỷ luật.
    expect(Object.getOwnPropertyNames(result)).toHaveLength(2);
    expect(Object.keys(result).sort()).toEqual(["amount", "status"]);
    // Và một khẳng định về NỘI DUNG, phòng ca một trường bị đổi tên rồi tuồn
    // qua: không giá trị nào của `transactions[]` xuất hiện trong giá trị trả về.
    expect(JSON.stringify(result)).not.toContain("0987654321");
    expect(JSON.stringify(result)).not.toContain("NGUYEN VAN A");
  });

  it.each([
    ["SUCCEEDED", "paid"],
    ["PENDING", "pending"],
    ["CANCELLED", "cancelled"],
    ["EXPIRED", "unknown"],
    ["", "unknown"],
  ])("dịch trạng thái %s ⇒ %s", async (providerStatus, expected) => {
    stubFetchOnce({
      ...STATUS_RESPONSE_PAID,
      data: { ...STATUS_RESPONSE_PAID.data, status: providerStatus },
    });

    const result = await getPaymentStatus(2026081900);

    expect(result.status).toBe(expected);
  });

  it("hỏi đúng orderCode, kèm hai credential trên header", async () => {
    const fetchMock = stubFetchOnce(STATUS_RESPONSE_PAID);

    await getPaymentStatus(2026081900);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://api-merchant.payos.vn/v2/payment-requests/2026081900");
    expect(init.headers["x-client-id"]).toBe("client-id-fixture");
    expect(init.headers["x-api-key"]).toBe("api-key-fixture");
  });

  it("HTTP 500 ⇒ ném PayosCallError (settleOrder dịch thành provider_unavailable)", async () => {
    stubFetchOnce({}, { ok: false, status: 500 });

    await expect(getPaymentStatus(2026081900)).rejects.toBeInstanceOf(PayosCallError);
  });

  it("ném PayosCallError khi thiếu credential — không đoán, không im lặng trả pending", async () => {
    vi.stubEnv("PAYOS_API_KEY", "");
    stubFetchOnce(STATUS_RESPONSE_PAID);

    await expect(getPaymentStatus(2026081900)).rejects.toBeInstanceOf(PayosCallError);
  });
});

describe("createPaymentRequest — từ ngữ nhà cung cấp dừng lại ở đây", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PINNED_NOW_MS);
  });

  it("dịch qrCode → qrPayload và description → memo, và KHÔNG giữ lại tên cũ", async () => {
    stubFetchOnce(CREATE_RESPONSE);

    const result = await createPaymentRequest(ORDER_DRAFT);

    expect(result.qrPayload).toBe(CREATE_RESPONSE.data.qrCode);
    expect(result.memo).toBe("MSMOLAR 2026081901");
    // Nửa thứ hai: một adapter trả về CẢ HAI tên vẫn xanh nếu chỉ kiểm nửa trên.
    expect("qrCode" in result).toBe(false);
    expect("description" in result).toBe(false);
    expect("checkoutUrl" in result).toBe(false);
  });

  it("trả về đúng bảy trường hợp đồng, không thừa một trường nào của nhà cung cấp", async () => {
    stubFetchOnce(CREATE_RESPONSE);

    const result = await createPaymentRequest(ORDER_DRAFT);

    expect(Object.keys(result).sort()).toEqual([
      "accountName",
      "accountNumber",
      "amount",
      "expiresAt",
      "memo",
      "orderCode",
      "qrPayload",
    ]);
    expect(result).toEqual({
      qrPayload: CREATE_RESPONSE.data.qrCode,
      accountNumber: "0123456789",
      accountName: "NGUYEN VAN CHU SHOP",
      memo: "MSMOLAR 2026081901",
      orderCode: 2026081901,
      amount: 39000,
      expiresAt: EXPECTED_EXPIRES_AT_ISO,
    });
  });

  it("gửi expiredAt = mốc hiện tại + cửa sổ đơn chờ, và trả về CÙNG mốc đó", async () => {
    const fetchMock = stubFetchOnce(CREATE_RESPONSE);

    const result = await createPaymentRequest(ORDER_DRAFT);

    const body = requestBodyOf(fetchMock);
    expect(body.expiredAt).toBe(EXPECTED_EXPIRED_AT_SEC);
    // Một mốc, hai chỗ dùng: cái gửi cho payOS và cái sẽ thành
    // `payment_orders.pending_until` phải là CÙNG một thời điểm.
    expect(Date.parse(result.expiresAt) / 1000).toBe(EXPECTED_EXPIRED_AT_SEC);
    // Và mốc đó đúng bằng hằng dùng chung, đọc từ pricing.ts ngay trong test.
    expect(Date.parse(result.expiresAt) - PINNED_NOW_MS).toBe(ORDER_PENDING_WINDOW_MS);
  });

  it("ký payment request bằng HMAC-SHA256 trên năm trường payOS quy định", async () => {
    const fetchMock = stubFetchOnce(CREATE_RESPONSE);

    await createPaymentRequest(ORDER_DRAFT);

    const body = requestBodyOf(fetchMock);
    expect(body.signature).toBe(EXPECTED_REQUEST_SIGNATURE);
    expect(body).toMatchObject({
      orderCode: 2026081901,
      amount: 39000,
      description: "MSMOLAR 2026081901",
      returnUrl: "https://ms-molar.vn/pricing/checkout",
      cancelUrl: "https://ms-molar.vn/pricing",
    });
  });

  it("payOS trả code khác '00' ⇒ ném, KHÔNG trả về một đơn nửa vời", async () => {
    stubFetchOnce({ code: "231", desc: "invalid signature", data: null });

    await expect(createPaymentRequest(ORDER_DRAFT)).rejects.toBeInstanceOf(PayosCallError);
  });
});

describe("cửa sổ đơn chờ có đúng MỘT lời khai", () => {
  // Khẳng định trên mã nguồn, vì hai số bằng nhau thì runtime im lặng. Tiền lệ:
  // `lib/billing/__tests__/readEntitlement.test.ts:475`.
  it("adapter đọc ORDER_PENDING_WINDOW_MS chứ không gõ lại con số 30 phút", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/billing/payos/index.ts"),
      "utf8"
    );

    expect(source).toContain("ORDER_PENDING_WINDOW_MS");
    // Mọi cách viết lại 30 phút mà một người "dọn dẹp import" hay dùng.
    expect(source).not.toMatch(/\b1_?800_?000\b/);
    expect(source).not.toMatch(/\b1800\b/);
    expect(source).not.toMatch(/30\s*\*\s*60/);
  });
});
