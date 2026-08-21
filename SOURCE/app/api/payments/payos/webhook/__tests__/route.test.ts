// Webhook payOS — CÁI VỎ MỎNG, và toàn bộ giá trị của nó nằm ở SỐ ĐẾM I/O.
// Backend DD § "app/api/payments/payos/webhook/route.ts — the thin shell",
// § Data Contracts (dòng `payOS → webhook route`), Integration Point I4;
// ADR-0014 § Decision 1-2 + § Implementation Guidance; PRD AC-030, AC-032,
// AC-034.
//
// "TRẢ 200" GẦN NHƯ VÔ GIÁ TRỊ Ở ĐÂY, và đó là điều phải nói ra trước tiên:
// route này trả 200 cho CẢ chữ ký đúng LẪN chữ ký sai (ADR-0014 — chính sách
// retry của payOS không có tài liệu, nên non-2xx dành riêng cho sự cố nội bộ).
// Thứ phân biệt hai ca không phải mã trạng thái mà là I/O: chữ ký sai phải tốn
// đúng một lượt HMAC và KHÔNG GÌ KHÁC. Vì thế mọi ca dưới đây khẳng định SỐ
// ĐẾM (`mock.calls.length`) chứ không phải `toHaveBeenCalled()`. Một
// implementation gọi `settleOrder` trước rồi mới xét chữ ký vẫn xanh mọi phép
// "đã-được-gọi"; nó đỏ ở những con số này.
//
// HAI `orderCode`, HAI GIÁ TRỊ KHÁC NHAU — CỐ Ý. Thân request mang
// `orderCode: 111222333`, còn adapter (đã mock) trả về `444555666`. Nếu hai số
// bằng nhau thì một implementation đọc thẳng `JSON.parse(rawBody).data
// .orderCode` — đúng cái ADR-0014 § Implementation Guidance cấm — sẽ không thể
// phân biệt được với implementation đúng. Chênh nhau thì nó đỏ ngay.
//
// BIÊN ĐƯỢC MOCK, và chỉ hai: `verifyWebhookSignature` (phép HMAC) và
// `settleOrder` (toàn bộ I/O phía dưới). Đường ĐỌC THÂN REQUEST để THẬT — nó
// chính là hành vi đang được kiểm (Roundtrip check của Connection Map: byte
// payOS ký phải là byte handler xác minh).
//
// KHÔNG GIÁ TRỊ KỲ VỌNG NÀO ĐƯỢC SUY RA TỪ THỨ ĐANG KIỂM: mọi số, mọi chuỗi lý
// do, mọi hình dạng log dưới đây là literal gõ tay trong chính file này.

import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_PATHS } from "@/lib/supabase/middleware";

vi.mock("server-only", () => ({}));

const verifyWebhookSignatureMock = vi.fn();
vi.mock("@/lib/billing/payos", () => ({
  verifyWebhookSignature: verifyWebhookSignatureMock,
}));

const settleOrderMock = vi.fn();
vi.mock("@/lib/billing/settleOrder", () => ({
  settleOrder: settleOrderMock,
}));

const { POST } = await import("../route");

/** Path công khai của route này, gõ tay. Cùng một literal được đối chiếu HAI
 *  chiều bên dưới: với `PUBLIC_PATHS` (middleware cho vào) và với vị trí thật
 *  của file `route.ts` (Next.js phục vụ ở đâu). Một mục `PUBLIC_PATHS` gõ sai
 *  hoặc bị nới rộng thành tiền tố cha sẽ đỏ ở chiều thứ nhất; một lần đổi chỗ
 *  thư mục route sẽ đỏ ở chiều thứ hai. */
const WEBHOOK_PATH = "/api/payments/payos/webhook";

/** `orderCode` NẰM TRONG THÂN — thứ handler KHÔNG được phép đọc. */
const PAYLOAD_ORDER_CODE = 111222333;
/** `orderCode` do adapter trả về sau khi chữ ký đã đúng — thứ DUY NHẤT được
 *  phép đi tiếp xuống `settleOrder()`. Khác hẳn số trên, xem docblock đầu file. */
const VERIFIED_ORDER_CODE = 444555666;

const PAYLOAD_SIGNATURE = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";

/** Các trường của nhà cung cấp KHÔNG được chạm tới log hay `settleOrder()`
 *  (P-1 normative, AC-034). `counterAccountNumber`/`counterAccountName` là dữ
 *  liệu định danh NGƯỜI TRẢ — đúng thứ AC-034 gọi tên. */
const PAYLOAD_AMOUNT = 39000;
const PAYLOAD_STATUS = "PAID";
const PAYLOAD_COUNTER_ACCOUNT = "0123456789";
const PAYLOAD_COUNTER_NAME = "NGUYEN VAN A";
const PAYLOAD_REFERENCE = "FT20260819XYZ";

/** Thân request NGUYÊN VĂN. Khoảng trắng và thứ tự khoá cố ý KHÔNG chuẩn tắc:
 *  một implementation đi qua `request.json()` rồi `JSON.stringify` lại sẽ dựng
 *  ra một chuỗi KHÁC, và ca "adapter nhận đúng byte đã tới" sẽ đỏ. */
const RAW_BODY =
  '{ "code":"00", "desc":"success", "signature": "' +
  PAYLOAD_SIGNATURE +
  '", "data" : { "orderCode":' +
  PAYLOAD_ORDER_CODE +
  ', "amount":' +
  PAYLOAD_AMOUNT +
  ', "status":"' +
  PAYLOAD_STATUS +
  '", "counterAccountNumber":"' +
  PAYLOAD_COUNTER_ACCOUNT +
  '", "counterAccountName":"' +
  PAYLOAD_COUNTER_NAME +
  '", "reference":"' +
  PAYLOAD_REFERENCE +
  '" } }';

/** Mọi chuỗi bị cấm xuất hiện trong BẤT KỲ đối số nào của BẤT KỲ lời gọi log
 *  nào. Gồm cả chính thân request. */
const FORBIDDEN_IN_LOGS = [
  RAW_BODY,
  PAYLOAD_SIGNATURE,
  String(PAYLOAD_ORDER_CODE),
  String(PAYLOAD_AMOUNT),
  PAYLOAD_STATUS,
  PAYLOAD_COUNTER_ACCOUNT,
  PAYLOAD_COUNTER_NAME,
  PAYLOAD_REFERENCE,
];

const CONSOLE_METHODS = ["error", "warn", "log", "info", "debug"] as const;

type LogCall = { method: string; args: unknown[] };
let logCalls: LogCall[] = [];

/** Gom MỌI chuỗi có thể quan sát được từ một giá trị đã log.
 *
 *  KHÔNG dùng `JSON.stringify` để làm việc này, và đó là điểm mấu chốt: một
 *  `console.error(msg, { error })` với `error` là `Error` cho ra `{"error":{}}`
 *  — `Error#message` KHÔNG enumerable, nên phép quét dựa trên `JSON.stringify`
 *  sẽ bỏ sót đúng cái nó đi tìm. Ở đây dùng `getOwnPropertyNames` cộng nhánh
 *  `Error` riêng, nên một thân request lọt vào `err.message` vẫn bị bắt. */
function collectStrings(value: unknown, out: string[], seen: Set<object>): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    out.push(String(value));
    return;
  }
  if (value === null || value === undefined) return;
  if (typeof value !== "object") {
    out.push(String(value));
    return;
  }
  if (seen.has(value)) return;
  seen.add(value);
  if (value instanceof Error) {
    out.push(value.message);
    if (value.stack) out.push(value.stack);
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    out.push(key);
    let nested: unknown;
    try {
      nested = (value as Record<string, unknown>)[key];
    } catch {
      continue;
    }
    collectStrings(nested, out, seen);
  }
}

function loggedStrings(): string[] {
  const out: string[] = [];
  const seen = new Set<object>();
  for (const call of logCalls) collectStrings(call.args, out, seen);
  return out;
}

function expectNothingSensitiveLogged(): void {
  const strings = loggedStrings();
  for (const forbidden of FORBIDDEN_IN_LOGS) {
    const leak = strings.find((s) => s.includes(forbidden));
    expect(
      leak === undefined,
      `chuỗi cấm ${JSON.stringify(forbidden)} xuất hiện trong log: ${JSON.stringify(leak)}`
    ).toBe(true);
  }
}

function webhookRequest(body: string): Request {
  return new Request(`https://ms-molar.example${WEBHOOK_PATH}`, { method: "POST", body });
}

beforeEach(() => {
  verifyWebhookSignatureMock.mockReset();
  settleOrderMock.mockReset();
  logCalls = [];
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logCalls.push({ method, args });
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fixture — sức phân biệt của chính bộ dữ liệu này", () => {
  it("RAW_BODY KHÔNG sống sót qua một vòng JSON round-trip", () => {
    // Nếu điều này sai thì ca "adapter nhận đúng byte đã tới" mất hết sức phân
    // biệt: một implementation `JSON.stringify(await request.json())` sẽ dựng
    // lại đúng chuỗi cũ và vẫn xanh.
    expect(JSON.stringify(JSON.parse(RAW_BODY))).not.toBe(RAW_BODY);
  });

  it("hai orderCode là hai giá trị KHÁC NHAU", () => {
    // Bằng nhau = một implementation đọc thân request trở nên vô hình.
    expect(PAYLOAD_ORDER_CODE).not.toBe(VERIFIED_ORDER_CODE);
  });
});

describe("chữ ký hợp lệ", () => {
  beforeEach(() => {
    verifyWebhookSignatureMock.mockReturnValue({ orderCode: VERIFIED_ORDER_CODE });
    settleOrderMock.mockResolvedValue({ settled: true, expiresAt: "2026-09-18T00:00:00.000Z" });
  });

  it("gọi settleOrder ĐÚNG MỘT LẦN, với ĐÚNG MỘT đối số là orderCode đã xác minh", async () => {
    await POST(webhookRequest(RAW_BODY));

    expect(settleOrderMock.mock.calls.length).toBe(1);
    // Deep-equal trên cả DÃY đối số: một implementation kèm thêm `amount` hay
    // `status` lấy từ thân (ADR-0014 Decision 1 cấm) sẽ đỏ vì độ dài ≠ 1, và
    // một implementation đọc `orderCode` từ thân sẽ đỏ vì giá trị ≠ 444555666.
    expect(settleOrderMock.mock.calls[0]).toEqual([VERIFIED_ORDER_CODE]);
  });

  it("trả 200", async () => {
    const response = await POST(webhookRequest(RAW_BODY));
    expect(response.status).toBe(200);
  });

  it("KHÔNG có trường nào của thân request chạm tới log", async () => {
    await POST(webhookRequest(RAW_BODY));
    expectNothingSensitiveLogged();
  });
});

describe("chữ ký sai hoặc vắng mặt — KHÔNG một lượt I/O nào", () => {
  beforeEach(() => {
    // `verifyWebhookSignature` trả `null` cho MỌI lối từ chối: thiếu khoá cấu
    // hình, JSON hỏng, thiếu `data`/`signature`, chữ ký sai, `orderCode` không
    // phải số nguyên an toàn (adapter § docblock).
    verifyWebhookSignatureMock.mockReturnValue(null);
  });

  it("settleOrder được gọi ĐÚNG 0 LẦN", async () => {
    await POST(webhookRequest(RAW_BODY));
    // ĐÂY là khẳng định mang toàn bộ AC-030. Mã trạng thái không phân biệt
    // được ca này với ca hợp lệ — con số này thì có.
    expect(settleOrderMock.mock.calls.length).toBe(0);
  });

  it("vẫn trả 200 (ADR-0014: non-2xx dành riêng cho sự cố nội bộ)", async () => {
    const response = await POST(webhookRequest(RAW_BODY));
    expect(response.status).toBe(200);
  });

  it("thân RỖNG cũng vậy: 0 lượt gọi, vẫn 200", async () => {
    const response = await POST(webhookRequest(""));
    expect(settleOrderMock.mock.calls.length).toBe(0);
    expect(response.status).toBe(200);
    expect(verifyWebhookSignatureMock.mock.calls).toEqual([[""]]);
  });

  it("ghi ĐÚNG MỘT dòng log, và dòng đó là một MÃ LÝ DO có cấu trúc", async () => {
    await POST(webhookRequest(RAW_BODY));

    // Hình dạng nguyên văn, gõ tay. Khẳng định trên HÌNH DẠNG chứ không trên
    // `JSON.stringify` của nó: một đối số thứ ba lén vào, hay một `{ error }`
    // mang thân request trong `message`, đều đỏ ở đây.
    expect(logCalls).toEqual([
      { method: "error", args: ["[payos/webhook] refused", '{"reason":"invalid_signature"}'] },
    ]);
  });

  it("KHÔNG có trường nào của thân request chạm tới log", async () => {
    await POST(webhookRequest(RAW_BODY));
    expectNothingSensitiveLogged();
  });
});

describe("thân request — byte đã tới, không phải byte dựng lại", () => {
  it("adapter nhận ĐÚNG chuỗi thô, đúng một lần, với đúng một đối số", async () => {
    verifyWebhookSignatureMock.mockReturnValue(null);

    await POST(webhookRequest(RAW_BODY));

    // Roundtrip check của Connection Map: byte payOS ký = byte handler xác
    // minh. `toEqual` trên toàn bộ `mock.calls` ghim luôn cả SỐ LƯỢT (một lần,
    // không hai) và SỐ ĐỐI SỐ (một, không kèm object đã parse hộ).
    expect(verifyWebhookSignatureMock.mock.calls).toEqual([[RAW_BODY]]);
  });

  it("adapter được gọi TRƯỚC settleOrder — thứ tự, không chỉ số đếm", async () => {
    const order: string[] = [];
    verifyWebhookSignatureMock.mockImplementation(() => {
      order.push("verify");
      return { orderCode: VERIFIED_ORDER_CODE };
    });
    settleOrderMock.mockImplementation(() => {
      order.push("settle");
      return Promise.resolve({ settled: false, reason: "unknown_order" });
    });

    await POST(webhookRequest(RAW_BODY));

    // ADR-0014 § Implementation Guidance: *"Verify the signature before
    // touching the database or the network."* Một implementation settle trước
    // rồi mới xét chữ ký vẫn đạt mọi con số ở trên khi chữ ký ĐÚNG; nó đỏ ở đây.
    expect(order).toEqual(["verify", "settle"]);
  });
});

describe("kết quả của settleOrder không đổi được mã trả về", () => {
  it("một lần TỪ CHỐI settlement vẫn là 200, và vẫn đúng một lượt gọi", async () => {
    verifyWebhookSignatureMock.mockReturnValue({ orderCode: VERIFIED_ORDER_CODE });
    settleOrderMock.mockResolvedValue({ settled: false, reason: "not_paid_yet" });

    const response = await POST(webhookRequest(RAW_BODY));

    expect(response.status).toBe(200);
    expect(settleOrderMock.mock.calls.length).toBe(1);
  });

  it("một SỰ CỐ NỘI BỘ lan ra ngoài — KHÔNG bị nuốt thành 200", async () => {
    verifyWebhookSignatureMock.mockReturnValue({ orderCode: VERIFIED_ORDER_CODE });
    settleOrderMock.mockRejectedValue(
      new Error("record_payment_settlement (order 444555666): boom")
    );

    // ADR-0014: non-2xx dành riêng cho "ta hỏng và một lượt thử lại có thể ăn
    // thua". Một `try/catch` bao trọn trả 200 sẽ biến một đơn mồ côi (D10)
    // thành sự im lặng — nên nó phải đỏ ở đây.
    await expect(POST(webhookRequest(RAW_BODY))).rejects.toThrow();
  });
});

describe("admission — mục PUBLIC_PATHS ứng đúng route này và không gì khác", () => {
  const routeDir = resolve(import.meta.dirname, "..");
  const appDir = resolve(import.meta.dirname, "..", "..", "..", "..", "..");

  it("file route.ts nằm đúng ở path được whitelist", () => {
    // Chiều thứ hai của phép đối chiếu: chuỗi trong `PUBLIC_PATHS` phải là path
    // mà Next.js THẬT SỰ phục vụ file này, chứ không phải một chuỗi trông giống.
    expect("/" + relative(appDir, routeDir).split(sep).join("/")).toBe(WEBHOOK_PATH);
    expect(existsSync(join(routeDir, "route.ts"))).toBe(true);
  });

  it("PUBLIC_PATHS mở ĐÚNG MỘT path dưới /api, và đó là path này", () => {
    // Một mục bị nới thành "/api" hay "/api/payments" sẽ đỏ ở đây, và cùng lúc
    // mở toang mọi route API tương lai — đúng cách hỏng ADR-0017 canh.
    expect(PUBLIC_PATHS.filter((p) => p.startsWith("/api"))).toEqual([WEBHOOK_PATH]);
  });
});
