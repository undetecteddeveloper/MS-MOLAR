// `settleOrder()` — THỨ TỰ BỐN BƯỚC và SỐ LƯỢT GHI.
// Backend DD § "lib/billing/settleOrder.ts — one function, two triggers",
// § Sensitivity (P-1, normative), Integration Point I6; ADR-0014 § Decision +
// § Implementation Guidance; UI Spec § Component `RecheckOrderControl` (C-10).
//
// KHẲNG ĐỊNH Ở ĐÂY LÀ VỀ TRẬT TỰ VÀ SỐ ĐẾM, KHÔNG PHẢI VỀ "CÓ GỌI HAY KHÔNG".
// Backend DD § Verification Strategy đã đặt tên đúng lối hỏng của chính file
// này: *"a test asserting `settleOrder` was called does not prove the amount was
// compared; a test asserting settlement succeeded does not prove the second
// replay wrote nothing"*. Vì thế mọi ca dưới đây khẳng định `callLog` — dãy các
// lượt chạm biên theo đúng thứ tự xảy ra — chứ không phải `toHaveBeenCalled()`.
// Một implementation ghi TRƯỚC khi hỏi nhà cung cấp vẫn xanh mọi phép
// "đã-được-gọi"; nó đỏ ở dãy này.
//
// BIÊN ĐƯỢC MOCK, và chỉ hai:
//   1. `getPaymentStatus` của adapter payOS — I/O ngoài. `PayosCallError` để
//      THẬT (spread `importOriginal`), vì nó là thứ implementation phân loại
//      trên đó; một lớp lỗi tự chế sẽ để lọt một implementation bắt tất.
//   2. `createClient` của `@supabase/supabase-js` — biên I/O THẬT SỰ của
//      `service-role.ts`. Cố ý KHÔNG mock nguyên module `@/lib/supabase/
//      service-role`: mock cả module đi thì hình dạng lời gọi RPC (tên hàm SQL,
//      danh sách tham số) không còn gì kiểm, mà đó chính là chỗ ADR-0014
//      Decision 3 nói "không tham số nào mang user_id". Tiền lệ:
//      `features/admin/__tests__/ticketActions.int.test.ts` Group 1.
//   Logic nhánh của `settleOrder()` để THẬT — nó là thứ đang được kiểm.
//
// SỐ LIỆU KỲ VỌNG GÕ TAY. Không giá trị kỳ vọng nào dưới đây được dựng bằng
// cách gọi `settleOrder()`, gọi adapter, hay đọc lại từ mock: năm literal lý do
// và mọi số tiền đem so đều là hằng viết thẳng trong file này. Một kỳ vọng suy
// ra từ chính thứ đang kiểm sẽ trôi theo bug và xanh mãi mãi.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getPaymentStatusMock = vi.fn();
vi.mock("@/lib/billing/payos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/payos")>()),
  getPaymentStatus: getPaymentStatusMock,
}));

const rpcMock = vi.fn();
const fromMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: rpcMock, from: fromMock })),
}));

const { PayosCallError } = await import("@/lib/billing/payos");
const { settleOrder } = await import("@/lib/billing/settleOrder");
const { readPaymentOrderForSettlement, recordPaymentSettlement } = await import(
  "@/lib/supabase/service-role"
);

type SettleResult = Awaited<ReturnType<typeof settleOrder>>;
type RefusalReason = Extract<SettleResult, { settled: false }>["reason"];

/** NĂM literal, gõ tay, KHÔNG đọc ra từ implementation. `satisfies` là sợi dây
 *  biên dịch: bớt một lý do khỏi union ⇒ khoá thừa ở đây ⇒ lỗi tsc; thêm một lý
 *  do ⇒ khoá thiếu ⇒ lỗi tsc. Đó là phép kiểm vét cạn mà Completion Criteria
 *  đòi, và nó bắt được đúng thứ một khẳng định runtime không bắt được: một
 *  nhánh biến mất khỏi union kéo theo một câu của bảng C-10 không ai render
 *  được nữa. */
const ALL_REFUSAL_REASONS = {
  unknown_order: true,
  not_pending: true,
  not_paid_yet: true,
  amount_mismatch: true,
  provider_unavailable: true,
} as const satisfies Record<RefusalReason, true>;

/** Cùng năm chuỗi đó, dạng dãy đã sắp — vế runtime của phép vét cạn. */
const FIVE_REASONS_SORTED = [
  "amount_mismatch",
  "not_paid_yet",
  "not_pending",
  "provider_unavailable",
  "unknown_order",
];

const ORDER_CODE = 2026081900;
/** Giá đang bán (khớp `PREMIUM_PRICE_VND`) — gõ tay, không import. */
const STORED_AMOUNT = 39000;
/** Giá của một đơn ĐANG BAY được tạo ở bảng giá cũ. Nó KHÁC hằng giá hiện tại,
 *  và đó là toàn bộ sức phân biệt của ca "so với dòng đơn, không so với hằng".
 *
 *  ĐỪNG "dọn dẹp" số này cho bằng `STORED_AMOUNT`. Ca *"đơn bán ở giá CŨ vẫn
 *  settle"* là ca DUY NHẤT trong file phân biệt được một implementation so số
 *  tiền với một HẰNG (39 000) khỏi một implementation so với DÒNG ĐƠN: nó chỉ
 *  làm được vậy khi cả dòng đơn lẫn số nhà cung cấp báo đều khác hằng đó. Hai
 *  hằng này bằng nhau ⇒ mọi ca đều dùng 39 000 ⇒ bản vá "so với hằng" xanh hết,
 *  và tính đúng đắn mà ADR-0014 § Implementation Guidance đòi mất người canh. */
const LEGACY_STORED_AMOUNT = 45000;

/** Dãy các lượt chạm biên, theo đúng thứ tự xảy ra. */
let callLog: string[] = [];
/** Mọi bảng `from()` chạm tới — bằng chứng `subscriptions` không có đường ghi
 *  thứ hai đi vòng qua hàm SQL. */
let fromTables: string[] = [];
/** Mọi cặp (cột, giá trị) của `.eq()` — bằng chứng vị từ đọc là `order_code`. */
let eqCalls: Array<[string, unknown]> = [];
/** Mọi chuỗi cột của `.select()`. */
let selectedColumns: string[] = [];

function settlementWriteCount(): number {
  return rpcMock.mock.calls.filter((call) => call[0] === "record_payment_settlement").length;
}

/** Kết quả một lượt `maybeSingle()` — hoặc một dòng, hoặc `null`, hoặc một lỗi
 *  của PostgREST. Ba khả năng đó là đúng ba thứ biên này trả về được, nên fake
 *  phải nói được cả ba: một fake chỉ nói được `{ data, error: null }` để nhánh
 *  `if (error) throw error` không có ca nào chạm tới. */
type FakeReadResult =
  | { data: FakeOrderRow | null; error: null }
  | { data: null; error: { code: string; message: string } };

/** Dòng như PostgREST TRẢ VỀ nó, chứ không như TS mong đợi. `user_id` có mặt ở
 *  đây vì nó CÓ THẬT trong bảng (`payment_orders:1610-1648`) và là giá trị KHÔNG
 *  được đi tiếp: chỉ khi fake mang được một cột thứ ba thì phép so "trả về đúng
 *  hai trường" mới quan sát được phép chiếu của implementation, thay vì quan sát
 *  lại chính đầu vào của mình. */
type FakeOrderRow = { status: string; amount: number; user_id?: string };

function installReadFake(result: FakeReadResult): void {
  fromMock.mockImplementation((table: string) => {
    fromTables.push(table);
    const builder = {
      select: (columns: string) => {
        selectedColumns.push(columns);
        return builder;
      },
      eq: (column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return builder;
      },
      maybeSingle: async () => {
        callLog.push(`read:${table}`);
        return result;
      },
    };
    return builder;
  });
}

/** Dòng `payment_orders` mà `service_role` đọc được, hoặc `null` cho "không có
 *  đơn nào". Fake dựng theo đúng chuỗi builder PostgREST mà implementation dùng. */
function givenOrderRow(row: FakeOrderRow | null): void {
  installReadFake({ data: row, error: null });
}

/** Lượt đọc bước 1 HỎNG — sự cố hạ tầng, không phải "đơn không tồn tại". Đây là
 *  ca `givenOrderRow` không diễn tả được: nó luôn nói `error: null`. */
function givenOrderReadFails(code: string, message: string): void {
  installReadFake({ data: null, error: { code, message } });
}

function givenProviderSays(status: string, amount: number): void {
  getPaymentStatusMock.mockImplementation(async () => {
    callLog.push("payos:getPaymentStatus");
    return { status, amount };
  });
}

function givenProviderUnreachable(site: string): void {
  getPaymentStatusMock.mockImplementation(async () => {
    callLog.push("payos:getPaymentStatus");
    throw new PayosCallError(site);
  });
}

function givenSettlementReturns(expiresAt: string | null): void {
  rpcMock.mockImplementation(async (fn: string) => {
    callLog.push(`rpc:${fn}`);
    return { data: expiresAt, error: null };
  });
}

function givenSettlementRaises(code: string, message: string): void {
  rpcMock.mockImplementation(async (fn: string) => {
    callLog.push(`rpc:${fn}`);
    return { data: null, error: { code, message } };
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";
  callLog = [];
  fromTables = [];
  eqCalls = [];
  selectedColumns = [];
  rpcMock.mockReset();
  fromMock.mockReset();
  getPaymentStatusMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("settleOrder — bước 1: dòng đơn của CHÍNH TA quyết định trước, trước mọi lượt gọi ngoài", () => {
  it("đơn không tồn tại ⇒ unknown_order, KHÔNG lượt gọi nhà cung cấp nào, KHÔNG lượt ghi nào", async () => {
    givenOrderRow(null);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "unknown_order" });
    // Dãy có ĐÚNG một phần tử: mọi thứ sau bước 1 đã không xảy ra.
    expect(callLog).toEqual(["read:payment_orders"]);
    expect(getPaymentStatusMock).toHaveBeenCalledTimes(0);
    expect(settlementWriteCount()).toBe(0);
  });

  it("lượt đọc bước 1 HỎNG ⇒ lỗi LAN RA, KHÔNG bị dịch thành unknown_order", async () => {
    // "Không tìm thấy đơn" và "không đọc được đơn" là HAI trạng thái khác nhau,
    // và ca này là ca duy nhất phân biệt được chúng. Một implementation nuốt lỗi
    // đọc (`if (error) return null`) sẽ nói với NGƯỜI ĐÃ TRẢ TIỀN, bằng đúng câu
    // C-10 dành cho đơn lạ, rằng đơn của họ không tồn tại — trong khi sự thật là
    // CSDL vừa timeout — và xoá luôn dấu vết duy nhất của sự cố. Một sự cố hạ
    // tầng không phải một trong năm lý do từ chối; C-10 để exception cho
    // `error.tsx` của route.
    givenOrderReadFails("57014", "canceling statement due to statement timeout");

    await expect(settleOrder(ORDER_CODE)).rejects.toMatchObject({
      code: "57014",
      message: "canceling statement due to statement timeout",
    });
    // Dừng NGAY tại bước 1: nhà cung cấp không bị hỏi, và không lượt ghi nào.
    expect(callLog).toEqual(["read:payment_orders"]);
    expect(getPaymentStatusMock).toHaveBeenCalledTimes(0);
    expect(settlementWriteCount()).toBe(0);
  });

  it("đơn đã 'paid' ⇒ not_pending tại bước 1 — không hỏi lại nhà cung cấp, không ghi", async () => {
    givenOrderRow({ status: "paid", amount: STORED_AMOUNT });

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_pending" });
    expect(callLog).toEqual(["read:payment_orders"]);
    expect(settlementWriteCount()).toBe(0);
  });

  it("đơn 'expired' ⇒ not_pending, không hỏi, không ghi", async () => {
    givenOrderRow({ status: "expired", amount: STORED_AMOUNT });

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_pending" });
    expect(callLog).toEqual(["read:payment_orders"]);
    expect(settlementWriteCount()).toBe(0);
  });

  it("đơn 'cancelled' ⇒ not_pending, không hỏi, không ghi", async () => {
    givenOrderRow({ status: "cancelled", amount: STORED_AMOUNT });

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_pending" });
    expect(callLog).toEqual(["read:payment_orders"]);
    expect(settlementWriteCount()).toBe(0);
  });

  it("đọc bằng service_role KHÔNG lọc theo chủ sở hữu, và vị từ là order_code", async () => {
    givenOrderRow(null);

    await settleOrder(ORDER_CODE);

    expect(fromTables).toEqual(["payment_orders"]);
    // ĐÚNG MỘT vị từ, và nó là order_code — một `.eq("user_id", …)` lẻn vào đây
    // sẽ phá webhook (trigger không có phiên đăng nhập nào để suy ra user).
    expect(eqCalls).toEqual([["order_code", ORDER_CODE]]);
    expect(selectedColumns).toEqual(["status, amount"]);
  });
});

describe("settleOrder — bước 2: nhà cung cấp là biên tin cậy, và không lượt ghi nào đi trước nó", () => {
  it("nhà cung cấp nói 'pending' ⇒ not_paid_yet, dừng SAU khi hỏi và TRƯỚC khi ghi", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("pending", STORED_AMOUNT);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_paid_yet" });
    expect(callLog).toEqual(["read:payment_orders", "payos:getPaymentStatus"]);
    expect(settlementWriteCount()).toBe(0);
  });

  it("nhà cung cấp nói 'cancelled' ⇒ not_paid_yet, không ghi", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("cancelled", STORED_AMOUNT);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_paid_yet" });
    expect(settlementWriteCount()).toBe(0);
  });

  it("nhà cung cấp trả một literal lạ ('unknown') ⇒ KHÔNG BAO GIỜ cấp — not_paid_yet, không ghi", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("unknown", STORED_AMOUNT);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_paid_yet" });
    expect(settlementWriteCount()).toBe(0);
  });

  it("adapter không gọi được ⇒ provider_unavailable — KHÔNG PHẢI not_paid_yet, và không phải một exception", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderUnreachable("getPaymentStatus:transport");
    // Lượt ghi được DỰNG SẴN cho chạy được: "0 lượt ghi" chỉ là một bằng chứng
    // khi lượt ghi ấy đã có thể xảy ra. Đếm 0 trên một mock không ghi nổi thì
    // chứng minh về cái mock, không phải về implementation.
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    expect(settlementWriteCount()).toBe(0);
    const result = await settleOrder(ORDER_CODE);
    expect(settlementWriteCount()).toBe(0);

    // Hai nửa, và nửa sau mới là nửa quan trọng: C-10 gán cho hai lý do này hai
    // HÀNH ĐỘNG NGƯỢC NHAU ("thử lại lát nữa" vs "hãy chuyển khoản"), nên nhầm
    // lẫn chúng là nói sai với người dùng chứ không phải sai một nhãn.
    expect(result).toEqual({ settled: false, reason: "provider_unavailable" });
    expect(result).not.toEqual({ settled: false, reason: "not_paid_yet" });
    expect(callLog).toEqual(["read:payment_orders", "payos:getPaymentStatus"]);
  });

  it("một lỗi KHÔNG phải PayosCallError không bị nuốt thành provider_unavailable", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    getPaymentStatusMock.mockImplementation(async () => {
      callLog.push("payos:getPaymentStatus");
      throw new TypeError("adapter bug");
    });

    // Fail-fast: `provider_unavailable` là câu trả lời cho một NHÀ CUNG CẤP
    // không với tới được, không phải cái thùng rác cho mọi lỗi trên đường đó.
    await expect(settleOrder(ORDER_CODE)).rejects.toThrow("adapter bug");
    expect(settlementWriteCount()).toBe(0);
  });
});

describe("settleOrder — bước 3: số tiền so với DÒNG ĐƠN ĐÃ LƯU", () => {
  it("nhà cung cấp báo số tiền khác dòng đơn ⇒ amount_mismatch, số lượt ghi 0 trước và 0 sau", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", 45000);
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    expect(settlementWriteCount()).toBe(0);
    const result = await settleOrder(ORDER_CODE);
    expect(settlementWriteCount()).toBe(0);

    expect(result).toEqual({ settled: false, reason: "amount_mismatch" });
    expect(callLog).toEqual(["read:payment_orders", "payos:getPaymentStatus"]);
  });

  it("một đơn ĐANG BAY bán ở giá CŨ vẫn settle được khi nhà cung cấp khớp DÒNG ĐƠN", async () => {
    // Đây là ca phân biệt "so với dòng đơn" khỏi "so với hằng giá": cả hai số
    // dưới đây là 45000, KHÁC hằng 39000. Một implementation so với hằng trả
    // amount_mismatch ở đây và đỏ; một implementation so với dòng đơn xanh.
    givenOrderRow({ status: "pending", amount: LEGACY_STORED_AMOUNT });
    givenProviderSays("paid", LEGACY_STORED_AMOUNT);
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: true, expiresAt: "2026-09-18T12:00:00.000Z" });
    expect(settlementWriteCount()).toBe(1);
  });

  it("một đơn ở giá HIỆN TẠI mà nhà cung cấp báo theo giá CŨ ⇒ amount_mismatch", async () => {
    // Nửa còn lại của cùng phép phân biệt, ngược chiều: implementation so với
    // hằng 39000 sẽ thấy dòng đơn 39000 và... vẫn phải đỏ, vì nhà cung cấp báo
    // 45000. Hai ca cùng nhau khoá cả hai chiều nhầm lẫn.
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", LEGACY_STORED_AMOUNT);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "amount_mismatch" });
    expect(settlementWriteCount()).toBe(0);
  });

  it("response thiếu `amount` (adapter cho 0) không bao giờ khớp một đơn thật", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", 0);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "amount_mismatch" });
    expect(settlementWriteCount()).toBe(0);
  });

  it("chỉ đọc `status` và `amount` từ giá trị adapter trả về (P-1)", async () => {
    const readKeys: string[] = [];
    const response = {};
    Object.defineProperty(response, "status", {
      enumerable: true,
      get: () => {
        readKeys.push("status");
        return "paid";
      },
    });
    Object.defineProperty(response, "amount", {
      enumerable: true,
      get: () => {
        readKeys.push("amount");
        return STORED_AMOUNT;
      },
    });
    // Trường P-1 cấm. Nó ĐỌC ĐƯỢC và có ghi lại lượt đọc — nên một implementation
    // spread cả object, log cả object hay chép nó sang chỗ khác sẽ hiện ra ở đây.
    Object.defineProperty(response, "transactions", {
      enumerable: true,
      get: () => {
        readKeys.push("transactions");
        return [{ counterAccountNumber: "0123456789", counterAccountName: "NGUYEN VAN A" }];
      },
    });

    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    getPaymentStatusMock.mockImplementation(async () => {
      callLog.push("payos:getPaymentStatus");
      return response;
    });
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: true, expiresAt: "2026-09-18T12:00:00.000Z" });
    expect([...new Set(readKeys)].sort()).toEqual(["amount", "status"]);
  });
});

describe("settleOrder — bước 4: lượt ghi duy nhất, và cái giá của một lượt phát lại", () => {
  it("đơn đã xác minh ⇒ đọc → hỏi → ghi, ĐÚNG thứ tự đó, đúng MỘT lượt ghi", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", STORED_AMOUNT);
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: true, expiresAt: "2026-09-18T12:00:00.000Z" });
    // Dãy đầy đủ: lượt ghi đứng CUỐI. Đảo bước 4 lên trước bước 2 vẫn xanh mọi
    // phép "đã-được-gọi"; nó đỏ ở đúng dòng này.
    expect(callLog).toEqual([
      "read:payment_orders",
      "payos:getPaymentStatus",
      "rpc:record_payment_settlement",
    ]);
    expect(settlementWriteCount()).toBe(1);
    // `subscriptions` không có đường ghi thứ hai: bảng duy nhất chạm qua
    // PostgREST là `payment_orders` (đọc), phần còn lại đi qua hàm SQL.
    expect(fromTables).toEqual(["payment_orders"]);
  });

  it("thua cuộc đua (RPC trả null) ⇒ not_pending, KHÔNG phải lỗi, không exception", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", STORED_AMOUNT);
    givenSettlementReturns(null);

    const result = await settleOrder(ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "not_pending" });
    expect(settlementWriteCount()).toBe(1);
  });

  it("phát lại: lượt thứ hai của cùng một đơn KHÔNG ghi thêm gì và báo not_pending", async () => {
    // Trạng thái thật: hàm SQL lật dòng sang 'paid' trong chính lượt đầu, nên
    // lượt hai bị bước 1 chặn. Fake dưới đây mô phỏng đúng chuyển trạng thái đó.
    const row = { status: "pending", amount: STORED_AMOUNT };
    givenOrderRow(row);
    givenProviderSays("paid", STORED_AMOUNT);
    rpcMock.mockImplementation(async (fn: string) => {
      callLog.push(`rpc:${fn}`);
      row.status = "paid";
      return { data: "2026-09-18T12:00:00.000Z", error: null };
    });

    const first = await settleOrder(ORDER_CODE);
    const writesAfterFirst = settlementWriteCount();
    const second = await settleOrder(ORDER_CODE);

    expect(first).toEqual({ settled: true, expiresAt: "2026-09-18T12:00:00.000Z" });
    expect(second).toEqual({ settled: false, reason: "not_pending" });
    expect(writesAfterFirst).toBe(1);
    // KHÔNG ghi thêm — đây là nửa mà một khẳng định "lượt hai trả not_pending"
    // một mình không chứng minh được.
    expect(settlementWriteCount()).toBe(1);
    expect(getPaymentStatusMock).toHaveBeenCalledTimes(1);
  });

  it("đơn mồ côi: exception của SQL LAN RA, không bị nuốt thành một refusal", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", STORED_AMOUNT);
    givenSettlementRaises("23514", "settlement for order 2026081900 has no beneficiary");

    await expect(settleOrder(ORDER_CODE)).rejects.toThrow(
      "settlement for order 2026081900 has no beneficiary"
    );
  });
});

describe("settleOrder — hình dạng hợp đồng", () => {
  it("nhận ĐÚNG MỘT tham số, và không tham số nào của lời gọi SQL mang danh tính", async () => {
    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("paid", STORED_AMOUNT);
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    await settleOrder(ORDER_CODE);

    // ADR-0014 Decision 1: "No caller can pass an amount, a status, or a user id
    // into it — only an `orderCode`".
    expect(settleOrder.length).toBe(1);
    expect(rpcMock).toHaveBeenCalledWith("record_payment_settlement", {
      p_order_code: ORDER_CODE,
    });
    // Danh tính suy ra TRONG SQL (Decision 3). Danh sách tham số phải rỗng ngoài
    // order code — `toHaveBeenCalledWith` ở trên đã là phép so KHỚP TOÀN BỘ
    // object, nên một `p_user_id` lẻn vào sẽ đỏ.
    expect(Object.keys(rpcMock.mock.calls[0][1] as object)).toEqual(["p_order_code"]);
  });

  it("cả năm literal lý do đều tới được, và union không có literal thứ sáu", async () => {
    const produced: SettleResult[] = [];

    givenOrderRow(null);
    produced.push(await settleOrder(ORDER_CODE));

    givenOrderRow({ status: "paid", amount: STORED_AMOUNT });
    produced.push(await settleOrder(ORDER_CODE));

    givenOrderRow({ status: "pending", amount: STORED_AMOUNT });
    givenProviderSays("pending", STORED_AMOUNT);
    produced.push(await settleOrder(ORDER_CODE));

    givenProviderSays("paid", LEGACY_STORED_AMOUNT);
    produced.push(await settleOrder(ORDER_CODE));

    givenProviderUnreachable("getPaymentStatus:http");
    produced.push(await settleOrder(ORDER_CODE));

    // Một nhánh lỡ trả `settled: true` sẽ cho `undefined` ở đây và làm phép so
    // dưới đỏ — chứ không lặng lẽ biến mất khỏi dãy.
    const reasons = produced.map((result) => Reflect.get(result, "reason") as string);
    expect([...reasons].sort()).toEqual(FIVE_REASONS_SORTED);
    // Vế biên dịch của cùng một khẳng định (xem docblock của ALL_REFUSAL_REASONS).
    expect(Object.keys(ALL_REFUSAL_REASONS).sort()).toEqual(FIVE_REASONS_SORTED);
  });
});

describe("service-role.ts — hình dạng lời gọi của hai thao tác hẹp (I6)", () => {
  it("recordPaymentSettlement gọi ĐÚNG hàm SQL, với ĐÚNG order code và không gì khác", async () => {
    givenSettlementReturns("2026-09-18T12:00:00.000Z");

    const outcome = await recordPaymentSettlement(ORDER_CODE);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("record_payment_settlement", {
      p_order_code: ORDER_CODE,
    });
    expect(outcome).toEqual({ expiresAt: "2026-09-18T12:00:00.000Z" });
  });

  it("chuẩn hoá dạng `+00:00` của PostgREST về dạng `…Z` — một hợp đồng, một dạng chuỗi", async () => {
    // Cùng lối hỏng CL-01 mô tả cho `pendingUntil`: cùng một thời điểm, hai
    // chuỗi khác nhau. Giá trị kỳ vọng gõ tay, không tính từ đầu vào.
    rpcMock.mockResolvedValueOnce({ data: "2026-09-18T12:00:00+00:00", error: null });

    const outcome = await recordPaymentSettlement(ORDER_CODE);

    expect(outcome).toEqual({ expiresAt: "2026-09-18T12:00:00.000Z" });
  });

  it("null của SQL đi thẳng ra ngoài dưới dạng expiresAt null, không thành lỗi", async () => {
    givenSettlementReturns(null);

    const outcome = await recordPaymentSettlement(ORDER_CODE);

    expect(outcome).toEqual({ expiresAt: null });
  });

  it("lỗi của SQL thành nhánh { error } mang nguyên mã và thông điệp, không thành null", async () => {
    givenSettlementRaises("23514", "settlement for order 2026081900 has no beneficiary");

    const outcome = await recordPaymentSettlement(ORDER_CODE);

    expect(outcome).toEqual({
      error: { code: "23514", message: "settlement for order 2026081900 has no beneficiary" },
    });
  });

  it("readPaymentOrderForSettlement đọc đúng hai cột, theo order_code, và không dòng nào thì null", async () => {
    givenOrderRow(null);

    const row = await readPaymentOrderForSettlement(ORDER_CODE);

    expect(row).toBeNull();
    expect(fromTables).toEqual(["payment_orders"]);
    expect(selectedColumns).toEqual(["status, amount"]);
    expect(eqCalls).toEqual([["order_code", ORDER_CODE]]);
  });

  it("readPaymentOrderForSettlement trả về ĐÚNG hai trường, không mang user_id đi tiếp", async () => {
    // Dòng fake mang CỘT THỨ BA, và đó là toàn bộ sức phân biệt của ca này: nếu
    // fake chỉ dựng được hai khoá thì hai phép so dưới đây đúng vì cách chính ca
    // này dựng đầu vào, chứ không vì implementation có chiếu. Với `user_id` nằm
    // trong `data`, một `return data` trả nguyên dòng sẽ đỏ — và đó đúng là lối
    // hỏng đáng sợ: `user_id` là thứ tầng TS không được có (FE-B-02), một khi nó
    // đi tiếp thì call site sau này chỉ cần đọc nó là có ngay danh tính người
    // thụ hưởng ở nơi ADR-0014 Decision 3 nói phải suy TRONG SQL.
    givenOrderRow({
      status: "pending",
      amount: STORED_AMOUNT,
      user_id: "11111111-2222-3333-4444-555555555555",
    });

    const row = await readPaymentOrderForSettlement(ORDER_CODE);

    expect(row).toEqual({ status: "pending", amount: STORED_AMOUNT });
    expect(Object.keys(row as object).sort()).toEqual(["amount", "status"]);
  });
});
