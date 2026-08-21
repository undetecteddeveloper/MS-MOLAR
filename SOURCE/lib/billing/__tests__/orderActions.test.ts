// `createOrder()` / `recheckOrder()` — TRẬT TỰ CÁC BƯỚC, SỐ LƯỢT GỌI NHÀ CUNG CẤP
// và SỐ LƯỢT GHI.
// Backend DD § "`createOrder()`'s order of operations — step (0) reuse precedes
// the provider call", § "`recheckOrder()` — ownership scoping (FE-B-02)",
// § Data Contracts (hai dòng `createOrder()` và `recheckOrder()`);
// ADR-0013 § Implementation Guidance; PRD AC-026 / AC-027 / AC-037.
//
// LỐI HỎNG CHÍNH mà file này tồn tại để bắt, chép từ khối chú thích INT-3
// (`tests/integration/subscription.int.test.ts`): *"Two of the four sub-claims
// are INVISIBLE to a value-only assertion. The adapter invocation count and the
// byte-identity of `pendingUntil` must both be asserted, or the naive
// implementation ships green."* Bản cài đặt ngây thơ — gọi lại nhà cung cấp, vứt
// kết quả đi, rồi trả về dòng cũ — XANH mọi phép so `orderCode`. Nó chỉ đỏ ở
// SỐ ĐẾM và ở DÃY `callLog`.
//
// VÌ THẾ MỌI CA DƯỚI ĐÂY KHẲNG ĐỊNH `callLog` — dãy các lượt chạm biên theo đúng
// thứ tự xảy ra — chứ không phải `toHaveBeenCalled()`. Tiền lệ trực tiếp:
// `settleOrder.test.ts` cùng thư mục, cùng lý lẽ.
//
// BIÊN ĐƯỢC MOCK, và chỉ ba:
//   1. `createPaymentRequest` / `getPaymentStatus` của adapter payOS — I/O ngoài,
//      dịch vụ TRẢ TIỀN. `PayosCallError` để THẬT (spread `importOriginal`), vì
//      nó là thứ implementation phân loại trên đó.
//   2. `createClient` của `@/lib/supabase/server` — client THEO PHIÊN. Đây là
//      biên duy nhất mang danh tính người gọi, và là thứ `orders_select_own` bám
//      vào ở production.
//   3. `createClient` của `@supabase/supabase-js` — biên I/O thật sự của
//      `service-role.ts`. Cố ý KHÔNG mock nguyên module `@/lib/supabase/
//      service-role`: mock cả module đi thì hình dạng câu INSERT (tên bảng, tên
//      cột, danh sách giá trị) không còn gì kiểm, mà đó chính là chỗ "user_id
//      lấy từ phiên, không từ tham số" quan sát được.
//   `settleOrder()` để THẬT. Đó là lựa chọn có chủ đích: nghĩa vụ FE-B-02 là
//   "KHÔNG lượt gọi nhà cung cấp nào" chứ không phải "settleOrder không được
//   gọi", và đếm trên chính adapter payOS đo đúng điều được khẳng định. Để
//   `settleOrder()` thật còn làm ca M4 (dời phép kiểm chủ sở hữu xuống
//   `settleOrder()`) lộ ra trong `callLog`: lượt đọc service_role sẽ xuất hiện
//   TRƯỚC hoặc THAY CHO lượt đọc theo phiên.
//
// SỐ LIỆU KỲ VỌNG GÕ TAY. `AMOUNT_VND` là literal `39000`, KHÔNG import
// `PREMIUM_PRICE_VND`: import hằng lên thì phép khẳng định đồng ý với MỌI lần đổi
// giá trong tương lai, tức đúng thứ trôi lệch mà literal tồn tại để bắt. Cùng lý
// do, không giá trị kỳ vọng nào dưới đây được dựng bằng cách gọi `toCheckoutOrder`
// hay gọi lại chính hàm đang kiểm.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createPaymentRequestMock = vi.fn();
const getPaymentStatusMock = vi.fn();
vi.mock("@/lib/billing/payos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/payos")>()),
  createPaymentRequest: createPaymentRequestMock,
  getPaymentStatus: getPaymentStatusMock,
}));

const guardMock = vi.fn();
vi.mock("@/lib/security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/rateLimit")>()),
  guard: guardMock,
}));

/** Client THEO PHIÊN — `@/lib/supabase/server`. */
const sessionFromMock = vi.fn();
const getUserMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: sessionFromMock, auth: { getUser: getUserMock } }),
}));

/** Client SERVICE_ROLE — biên thật của `service-role.ts`. */
const serviceFromMock = vi.fn();
const serviceRpcMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: serviceFromMock, rpc: serviceRpcMock })),
}));

const { PayosCallError } = await import("@/lib/billing/payos");
const { createOrder, recheckOrder } = await import("@/lib/billing/orderActions");

// --- Hằng của fixture, gõ tay --------------------------------------------

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ORDER_CODE = 1755518400777;

/** Giá đang bán, LITERAL. Xem đầu file vì sao không import `PREMIUM_PRICE_VND`. */
const AMOUNT_VND = 39000;

/** Dạng PostgREST giao `timestamptz`: offset `+00:00`, không có mili giây. Cố ý
 *  KHÁC dạng `…Z` mà hợp đồng `CheckoutOrder` cam kết — chỉ khi hai dạng khác
 *  nhau thì phép so `pendingUntil` mới quan sát được BƯỚC CHUẨN HOÁ của mapper
 *  thay vì quan sát lại chính đầu vào của mình. */
const STORED_PENDING_UNTIL_PG = "2026-08-19T10:30:00+00:00";
/** CÙNG khoảnh khắc ấy ở dạng hợp đồng. Gõ tay, KHÔNG tính bằng `new Date(...)`. */
const STORED_PENDING_UNTIL_ISO = "2026-08-19T10:30:00.000Z";

/** Mốc adapter trả về cho một đơn MỚI. Nó là NGUỒN DUY NHẤT của `pending_until`
 *  (ADR-0013 § Implementation Guidance: một hằng, hai chỗ tiêu thụ), nên ca
 *  roundtrip so thẳng giá trị ghi xuống với chuỗi này. */
const PROVIDER_EXPIRES_AT = "2026-08-19T11:00:00.000Z";

const REUSABLE_ROW = {
  order_code: 1755518400123,
  amount: AMOUNT_VND,
  status: "pending",
  pending_until: STORED_PENDING_UNTIL_PG,
  qr_payload: "00020101021238570010A00000072701270006970436QRIBFTTA",
  account_number: "0011001234567",
  account_name: "CONG TY TNHH MS MOLAR",
  memo: "MSMOLAR 1755518400123",
};

/** `CheckoutOrder` mà bước (0) PHẢI trả về cho `REUSABLE_ROW` — tám trường gõ
 *  tay, không dựng bằng `toCheckoutOrder()`. Một kỳ vọng dựng bằng chính mapper
 *  đang nằm trên đường đi sẽ xanh kể cả khi mapper hỏng. */
const REUSED_CHECKOUT_ORDER = {
  orderCode: 1755518400123,
  amountVnd: AMOUNT_VND,
  status: "pending",
  pendingUntil: STORED_PENDING_UNTIL_ISO,
  qrPayload: "00020101021238570010A00000072701270006970436QRIBFTTA",
  accountNumber: "0011001234567",
  accountName: "CONG TY TNHH MS MOLAR",
  memo: "MSMOLAR 1755518400123",
};

const PROVIDER_RESULT = {
  qrPayload: "00020101021238570010A00000072701270006970436NEWORDER",
  accountNumber: "0011001234567",
  accountName: "CONG TY TNHH MS MOLAR",
  memo: "MSMOLAR 1755518400999",
  orderCode: 1755518400999,
  amount: AMOUNT_VND,
  expiresAt: PROVIDER_EXPIRES_AT,
};

// --- Dụng cụ quan sát ------------------------------------------------------

/** Dãy các lượt chạm biên, theo đúng thứ tự xảy ra. `rls:` = client theo phiên
 *  (danh tính người gọi, `orders_select_own`); `svc:` = service_role (bypass
 *  RLS); `payos:` = nhà cung cấp. Ba tiền tố phân biệt được vì ba thứ chúng nói
 *  là ba nghĩa vụ khác nhau. */
let callLog: string[] = [];
/** Mọi vị từ `.eq()` / `.gt()` client theo phiên áp lên bước (0). */
let sessionFilters: Array<[string, string, unknown]> = [];
/** Chuỗi cột của mỗi `.select()` trên client theo phiên. */
let sessionSelects: string[] = [];
/** Mọi hàng được INSERT qua service_role, đúng như nó rời TypeScript. */
let insertedRows: Array<Record<string, unknown>> = [];

function writeCount(): number {
  return insertedRows.length;
}

function providerCallCount(): number {
  return createPaymentRequestMock.mock.calls.length + getPaymentStatusMock.mock.calls.length;
}

/** Kết quả một lượt đọc theo phiên: một dòng, `null`, hoặc một lỗi PostgREST.
 *  Ba khả năng ấy là đúng ba thứ biên này trả về được. */
type SessionReadResult =
  | { data: Record<string, unknown> | null; error: null }
  | { data: null; error: { code: string; message: string } };

/** Fake builder PostgREST cho client THEO PHIÊN. Ghi lại mọi vị từ, vì "vị từ
 *  nào" chính là nội dung của quyết định tái dùng (`pending_until > now()`, KHÔNG
 *  phải `created_at > now() - 30 phút`). */
function installSessionRead(label: string, result: SessionReadResult): void {
  sessionFromMock.mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {
      select: (columns: string) => {
        sessionSelects.push(columns);
        return builder;
      },
      eq: (column: string, value: unknown) => {
        sessionFilters.push(["eq", column, value]);
        return builder;
      },
      gt: (column: string, value: unknown) => {
        sessionFilters.push(["gt", column, value]);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => {
        callLog.push(`rls:${label}:${table}`);
        return result;
      },
    };
    return builder;
  });
}

/** Fake builder cho client SERVICE_ROLE: `settleOrder()` đọc bằng `.maybeSingle()`,
 *  `recordPaymentOrder()` ghi bằng `.insert().select().single()`. */
function installServiceRole(options: {
  readRow?: { status: string; amount: number } | null;
  insertFails?: { code: string; message: string };
}): void {
  serviceFromMock.mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => {
        callLog.push(`svc:read:${table}`);
        return { data: options.readRow ?? null, error: null };
      },
      insert: (row: Record<string, unknown>) => {
        callLog.push(`svc:insert:${table}`);
        insertedRows.push(row);
        return {
          select: () => ({
            // Đọc-lại trả về TÁM cột của `PaymentOrderRow`, và `status` do
            // DEFAULT của bảng đặt chứ không do lệnh ghi truyền vào — fake phải
            // nói được điều đó, nếu không nó sẽ hợp thức hoá một bản cài đặt tự
            // dựng giá trị trả về từ chính tham số đầu vào.
            single: async () =>
              options.insertFails
                ? { data: null, error: options.insertFails }
                : {
                    data: {
                      order_code: row.order_code,
                      amount: row.amount,
                      status: "pending",
                      pending_until: row.pending_until,
                      qr_payload: row.qr_payload,
                      account_number: row.account_number,
                      account_name: row.account_name,
                      memo: row.memo,
                    },
                    error: null,
                  },
          }),
        };
      },
    };
    return builder;
  });
}

function givenSignedInUser(userId: string | null): void {
  getUserMock.mockImplementation(async () => ({ data: { user: userId ? { id: userId } : null } }));
}

function givenGuardAllows(): void {
  guardMock.mockImplementation(async () => ({ ok: true, retryAfterSeconds: 0 }));
}

function givenGuardRefuses(): void {
  guardMock.mockImplementation(async () => ({ ok: false, retryAfterSeconds: 42 }));
}

/** Adapter TRẢ LẠI `orderCode` và `description` của chính draft (đúng như payOS
 *  làm, và đúng như `createPaymentRequest()` khai). Một stub trả mã CỐ ĐỊNH sẽ
 *  che mất việc `createOrder()` ghi mã NÀO xuống dòng. */
function givenProviderCreates(result: typeof PROVIDER_RESULT): void {
  createPaymentRequestMock.mockImplementation(
    async (draft: { orderCode: number; memo: string }) => {
      callLog.push("payos:createPaymentRequest");
      return { ...result, orderCode: draft.orderCode, memo: draft.memo };
    }
  );
}

function givenProviderUnreachable(site: string): void {
  createPaymentRequestMock.mockImplementation(async () => {
    callLog.push("payos:createPaymentRequest");
    throw new PayosCallError(site);
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role-key";
  callLog = [];
  sessionFilters = [];
  sessionSelects = [];
  insertedRows = [];
  createPaymentRequestMock.mockReset();
  getPaymentStatusMock.mockReset();
  guardMock.mockReset();
  sessionFromMock.mockReset();
  serviceFromMock.mockReset();
  serviceRpcMock.mockReset();
  getUserMock.mockReset();
  givenSignedInUser(USER_ID);
  givenGuardAllows();
  installServiceRole({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =========================================================================
// createOrder — bước (0) đứng TRƯỚC mọi thứ khác
// =========================================================================
describe("createOrder — bước (0): đơn pending còn hạn được TÁI DÙNG, không gọi nhà cung cấp, không ghi", () => {
  it("đơn còn hạn ⇒ trả lại CHÍNH nó, ĐÚNG MỘT lượt chạm biên: lượt đọc theo phiên", async () => {
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });
    givenProviderCreates(PROVIDER_RESULT);

    const result = await createOrder();

    // Tám trường gõ tay — không dựng bằng mapper (xem REUSED_CHECKOUT_ORDER).
    expect(result).toEqual(REUSED_CHECKOUT_ORDER);
    // Dãy có ĐÚNG một phần tử: bước (1)(2)(3) đã không xảy ra. Đây là phép
    // khẳng định giết bản vá "gọi lại payOS rồi vứt kết quả đi", thứ mà mọi
    // phép so `orderCode` đều bỏ lọt.
    expect(callLog).toEqual(["rls:reuse:payment_orders"]);
    expect(createPaymentRequestMock).toHaveBeenCalledTimes(0);
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("`pendingUntil` là mốc ĐÃ LƯU của dòng, chuẩn hoá — không bao giờ `now() + 30 phút`", async () => {
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });

    const result = await createOrder();

    // Chuỗi gõ tay. Một bản cài đặt tính lại hạn chót sẽ trả về một mốc quanh
    // "bây giờ" và đỏ ở đây — đó là AC-027 nửa "đồng hồ đếm ngược KHÔNG BAO GIỜ
    // được khởi động lại", và nó là một thay đổi hạn chót người dùng NHÌN THẤY.
    expect((result as { pendingUntil: string }).pendingUntil).toBe(STORED_PENDING_UNTIL_ISO);
    // Và nó KHÁC dạng thô PostgREST giao: bước chuẩn hoá của mapper có thật.
    expect((result as { pendingUntil: string }).pendingUntil).not.toBe(STORED_PENDING_UNTIL_PG);
  });

  it("HAI lượt gọi liên tiếp ⇒ CÙNG `orderCode`, `pendingUntil` GIỐNG NHAU TỪNG BYTE, tổng cộng 0 lượt gọi nhà cung cấp", async () => {
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });

    const first = await createOrder();
    const second = await createOrder();

    // So HAI GIÁ TRỊ TRẢ VỀ với nhau, không so với một mốc tính lại.
    expect((second as { orderCode: number }).orderCode).toBe(
      (first as { orderCode: number }).orderCode
    );
    expect((second as { pendingUntil: string }).pendingUntil).toBe(
      (first as { pendingUntil: string }).pendingUntil
    );
    expect((second as { qrPayload: string }).qrPayload).toBe(
      (first as { qrPayload: string }).qrPayload
    );
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("vị từ tái dùng là `pending_until > <bây giờ>`, KHÔNG phải `created_at > <bây giờ − 30 phút>`", async () => {
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });

    await createOrder();

    // Ba vị từ, đúng ba: chủ sở hữu, trạng thái, hạn chót.
    expect(sessionFilters).toEqual([
      ["eq", "user_id", USER_ID],
      ["eq", "status", "pending"],
      ["gt", "pending_until", expect.any(String)],
    ]);
    // `created_at` KHÔNG được xuất hiện ở bất kỳ vị từ nào: một vị từ dựng lại
    // cửa sổ từ `created_at` cộng một hằng sẽ phân loại lại các đơn ĐANG BAY
    // mỗi lần cửa sổ đổi, thay vì để chúng giữ đúng cửa sổ chúng được bán.
    expect(sessionFilters.map((f) => f[1])).not.toContain("created_at");
  });

  it("bước (0) đọc bằng client THEO PHIÊN (RLS), không bằng service_role", async () => {
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });

    await createOrder();

    // Không lượt đọc service_role nào: dòng dùng lại phải đi qua
    // `orders_select_own`, nên một `user_id` sai không thể tự khớp.
    expect(callLog.filter((entry) => entry.startsWith("svc:"))).toEqual([]);
    // Tám cột của `PaymentOrderRow`, không phải `*`: `user_id` và `settled_at`
    // không đi vào hợp đồng C-13.
    expect(sessionSelects).toEqual([
      "order_code, amount, status, pending_until, qr_payload, account_number, account_name, memo",
    ]);
  });

  it("lượt đọc bước (0) HỎNG ⇒ lỗi LAN RA — không bị dịch thành 'chưa có đơn nào' rồi mint đơn mới", async () => {
    // "Không có đơn nào còn hạn" và "không đọc được" là HAI trạng thái khác nhau.
    // Nuốt lỗi đọc thành `null` sẽ tạo đơn thứ hai cho một người đã có đơn còn
    // sống — đúng lối hỏng AC-027 cấm, chỉ khác là nó xảy ra lúc CSDL trục trặc.
    installSessionRead("reuse", {
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });
    givenProviderCreates(PROVIDER_RESULT);

    await expect(createOrder()).rejects.toMatchObject({ code: "57014" });
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });
});

describe("createOrder — không có đơn nào dùng lại được: (1) suy ra → (2) nhà cung cấp → (3) ghi", () => {
  beforeEach(() => {
    installSessionRead("reuse", { data: null, error: null });
    givenProviderCreates(PROVIDER_RESULT);
  });

  it("thứ tự PROVIDER-FIRST: đọc, gọi nhà cung cấp, RỒI MỚI ghi — đúng một lượt mỗi thứ", async () => {
    await createOrder();

    expect(callLog).toEqual([
      "rls:reuse:payment_orders",
      "payos:createPaymentRequest",
      "svc:insert:payment_orders",
    ]);
    expect(createPaymentRequestMock).toHaveBeenCalledTimes(1);
    expect(writeCount()).toBe(1);
  });

  it("số tiền là literal 39000 ở CẢ hai phía: gửi cho nhà cung cấp và ghi xuống dòng", async () => {
    await createOrder();

    expect(createPaymentRequestMock.mock.calls[0][0]).toMatchObject({ amountVnd: 39000 });
    expect(insertedRows[0]).toMatchObject({ amount: 39000 });
  });

  it("`user_id` lấy từ PHIÊN, và `createOrder()` không nhận tham số nào để lấy nó từ chỗ khác", async () => {
    await createOrder();

    expect(insertedRows[0]).toMatchObject({ user_id: USER_ID });
    // Arity 0: không có tham số nào cho một client truyền `user_id` vào.
    expect(createOrder.length).toBe(0);
  });

  it("`pending_until` ghi xuống là ĐÚNG mốc adapter trả về — một hằng, hai chỗ tiêu thụ", async () => {
    await createOrder();

    // ADR-0013 § Implementation Guidance: cửa sổ đơn chờ và `expiredAt` của nhà
    // cung cấp phải là CÙNG MỘT SỐ. Adapter tính mốc ấy từ
    // `ORDER_PENDING_WINDOW_MS` rồi trả lại nó; ghi thẳng giá trị đó xuống là
    // cách duy nhất không dựng cái đồng hồ thứ hai.
    expect(insertedRows[0]).toMatchObject({ pending_until: PROVIDER_EXPIRES_AT });
  });

  it("bốn giá trị chuyển khoản ghi xuống NGUYÊN SI như nhà cung cấp giao", async () => {
    await createOrder();

    expect(insertedRows[0]).toMatchObject({
      qr_payload: PROVIDER_RESULT.qrPayload,
      account_number: PROVIDER_RESULT.accountNumber,
      account_name: PROVIDER_RESULT.accountName,
    });
    // `memo` là chuỗi ta ĐỀ NGHỊ và nhà cung cấp echo lại; nó mang chính mã đơn,
    // nên một lần đối soát tay lần ra được dòng. Cùng một chuỗi ở cả hai phía.
    expect(insertedRows[0].memo).toBe(`MSMOLAR ${insertedRows[0].order_code}`);
    expect(createPaymentRequestMock.mock.calls[0][0].memo).toBe(insertedRows[0].memo);
  });

  it("trả về `CheckoutOrder` chiếu từ chính dòng vừa ghi — `status` lấy từ dòng, không từ tham số", async () => {
    const result = await createOrder();
    const written = insertedRows[0];

    // Bảy trường gõ tay. `status: "pending"` là điểm mấu chốt của ca này: lệnh
    // ghi KHÔNG truyền `status` (DEFAULT của bảng đặt nó), nên một bản cài đặt
    // dựng giá trị trả về từ tham số đầu vào sẽ trả `undefined` ở đây.
    expect(result).toEqual({
      orderCode: expect.any(Number),
      amountVnd: AMOUNT_VND,
      status: "pending",
      pendingUntil: PROVIDER_EXPIRES_AT,
      qrPayload: PROVIDER_RESULT.qrPayload,
      accountNumber: PROVIDER_RESULT.accountNumber,
      accountName: PROVIDER_RESULT.accountName,
      memo: `MSMOLAR ${written.order_code}`,
    });

    // `orderCode` do chính hàm sinh ra nên không gõ tay được — thứ gõ tay được
    // là DÂY CHUYỀN của nó: một mã, ba chỗ. Mã gửi cho nhà cung cấp, mã ghi
    // xuống dòng và mã trả về màn hình phải là CÙNG một số; hai chỗ lệch nhau là
    // một người dùng đọc một mã mà bộ phận hỗ trợ tra không ra.
    const returnedCode = (result as { orderCode: number }).orderCode;
    expect(createPaymentRequestMock.mock.calls[0][0].orderCode).toBe(returnedCode);
    expect(written.order_code).toBe(returnedCode);
    expect(Number.isSafeInteger(returnedCode)).toBe(true);
    expect(returnedCode).toBeGreaterThan(0);
  });
});

describe("createOrder — nhà cung cấp hỏng thì KHÔNG dòng nào tồn tại", () => {
  it("adapter ném ⇒ `provider_unavailable`, và số dòng ghi được là 0", async () => {
    installSessionRead("reuse", { data: null, error: null });
    givenProviderUnreachable("createPaymentRequest:transport");

    const result = await createOrder();

    expect(result).toEqual({ error: "provider_unavailable" });
    // Thứ tự provider-first là thứ làm bốn cột chuyển khoản `not null` cưỡng chế
    // được: ghi trước rồi gọi sau sẽ để lại một dòng có khối chuyển khoản TRỐNG
    // mà một lần F5 đọc thấy — đúng sự cố AC-028 tồn tại để chặn.
    expect(writeCount()).toBe(0);
    expect(callLog).toEqual(["rls:reuse:payment_orders", "payos:createPaymentRequest"]);
  });

  it("lượt ghi hỏng ⇒ `server`, KHÔNG ném và KHÔNG trả về một đơn nửa vời", async () => {
    installSessionRead("reuse", { data: null, error: null });
    installServiceRole({ insertFails: { code: "23505", message: "duplicate key" } });
    givenProviderCreates(PROVIDER_RESULT);

    const result = await createOrder();

    expect(result).toEqual({ error: "server" });
  });
});

describe("createOrder — hai cổng chạy TRƯỚC mọi thứ", () => {
  it("chưa đăng nhập ⇒ `unauthenticated`, 0 lượt gọi nhà cung cấp, 0 lượt ghi, 0 lượt đọc", async () => {
    givenSignedInUser(null);
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });
    givenProviderCreates(PROVIDER_RESULT);

    expect(await createOrder()).toEqual({ error: "unauthenticated" });
    expect(callLog).toEqual([]);
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("vượt trần ⇒ `rate_limited`, 0 lượt gọi nhà cung cấp, 0 lượt ghi — bấm dồn không khuếch đại được ra payOS", async () => {
    givenGuardRefuses();
    installSessionRead("reuse", { data: null, error: null });
    givenProviderCreates(PROVIDER_RESULT);

    expect(await createOrder()).toEqual({ error: "rate_limited" });
    expect(callLog).toEqual([]);
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("cổng trần đọc đúng khoá `createOrder` với id của phiên", async () => {
    installSessionRead("reuse", { data: REUSABLE_ROW, error: null });

    await createOrder();

    expect(guardMock).toHaveBeenCalledTimes(1);
    expect(guardMock.mock.calls[0]).toEqual(["createOrder", USER_ID]);
  });
});

// =========================================================================
// recheckOrder — FE-B-02: hai lời từ chối GIỐNG NHAU TỪNG BYTE
// =========================================================================
describe("recheckOrder — đơn của người khác và đơn không tồn tại là MỘT lời từ chối", () => {
  it("đơn KHÔNG TỒN TẠI ⇒ unknown_order, 0 lượt gọi nhà cung cấp, 0 lượt ghi", async () => {
    // Client theo phiên trả `null` vì không có dòng nào mang mã đó.
    installSessionRead("owner", { data: null, error: null });

    const result = await recheckOrder(OTHER_ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "unknown_order" });
    expect(callLog).toEqual(["rls:owner:payment_orders"]);
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("đơn của NGƯỜI KHÁC ⇒ unknown_order, 0 lượt gọi nhà cung cấp, 0 lượt ghi", async () => {
    // `orders_select_own` làm dòng của người khác VÔ HÌNH: cùng một `null`.
    installSessionRead("owner", { data: null, error: null });
    // Dòng ấy CÓ THẬT dưới service_role — nếu phép kiểm chủ sở hữu bị dời xuống
    // `settleOrder()` thì lượt đọc bypass RLS này sẽ thấy nó và trả về một lý do
    // KHÁC (`not_pending`), làm ca này đỏ.
    installServiceRole({ readRow: { status: "paid", amount: AMOUNT_VND } });

    const result = await recheckOrder(OTHER_ORDER_CODE);

    expect(result).toEqual({ settled: false, reason: "unknown_order" });
    expect(callLog).toEqual(["rls:owner:payment_orders"]);
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("hai lời từ chối GIỐNG NHAU HOÀN TOÀN — cùng giá trị, cùng dãy lượt chạm biên", async () => {
    // Đây là phép khẳng định mà "cả hai đều trả unknown_order" KHÔNG thay thế
    // được: một máy dò danh sách đơn có thể trả cùng một literal mà vẫn lộ ra
    // qua một trường thừa, một lượt gọi nhà cung cấp, hay một độ trễ khác.
    installSessionRead("owner", { data: null, error: null });
    installServiceRole({ readRow: { status: "paid", amount: AMOUNT_VND } });
    const foreign = await recheckOrder(OTHER_ORDER_CODE);
    const foreignLog = [...callLog];
    const foreignProviderCalls = providerCallCount();

    callLog = [];
    createPaymentRequestMock.mockClear();
    getPaymentStatusMock.mockClear();
    installSessionRead("owner", { data: null, error: null });
    installServiceRole({ readRow: null });
    const nonexistent = await recheckOrder(9007199254740991);
    const nonexistentLog = [...callLog];

    expect(foreign).toEqual(nonexistent);
    expect(foreignLog).toEqual(nonexistentLog);
    expect(foreignProviderCalls).toBe(0);
    expect(providerCallCount()).toBe(0);
    expect(writeCount()).toBe(0);
  });

  it("lượt đọc chủ sở hữu chỉ xin `order_code` và lọc theo đúng mã ấy", async () => {
    installSessionRead("owner", { data: null, error: null });

    await recheckOrder(OTHER_ORDER_CODE);

    expect(sessionSelects).toEqual(["order_code"]);
    expect(sessionFilters).toEqual([["eq", "order_code", OTHER_ORDER_CODE]]);
  });
});

describe("recheckOrder — chỉ khi lượt đọc theo phiên trả về một dòng thì mới đối soát", () => {
  it("đơn CỦA MÌNH ⇒ đi tiếp vào settleOrder: đọc theo phiên TRƯỚC, rồi mới tới service_role", async () => {
    installSessionRead("owner", { data: { order_code: OTHER_ORDER_CODE }, error: null });
    installServiceRole({ readRow: { status: "cancelled", amount: AMOUNT_VND } });

    const result = await recheckOrder(OTHER_ORDER_CODE);

    // `cancelled` dừng ở bước 1 của `settleOrder()` — đủ để chứng minh đường đi,
    // mà không phải dựng một lượt gia hạn giả.
    expect(result).toEqual({ settled: false, reason: "not_pending" });
    // TRẬT TỰ là nội dung: lượt đọc mang danh tính người gọi đứng TRƯỚC lượt đọc
    // bypass RLS. Dời phép kiểm xuống `settleOrder()` sẽ đảo hoặc xoá phần tử
    // đầu của dãy này.
    expect(callLog).toEqual(["rls:owner:payment_orders", "svc:read:payment_orders"]);
  });

  it("chưa đăng nhập ⇒ `unauthenticated`, không lượt đọc nào, không lượt gọi nhà cung cấp nào", async () => {
    givenSignedInUser(null);
    installSessionRead("owner", { data: { order_code: OTHER_ORDER_CODE }, error: null });

    expect(await recheckOrder(OTHER_ORDER_CODE)).toEqual({ error: "unauthenticated" });
    expect(callLog).toEqual([]);
    expect(providerCallCount()).toBe(0);
  });

  it("vượt trần ⇒ `rate_limited` TRƯỚC lượt đọc — kẻ dò tiêu chính suất của mình", async () => {
    givenGuardRefuses();
    installSessionRead("owner", { data: { order_code: OTHER_ORDER_CODE }, error: null });

    expect(await recheckOrder(OTHER_ORDER_CODE)).toEqual({ error: "rate_limited" });
    expect(callLog).toEqual([]);
    expect(providerCallCount()).toBe(0);
  });

  it("cổng trần đọc đúng khoá `recheckOrder` với id của phiên", async () => {
    installSessionRead("owner", { data: null, error: null });

    await recheckOrder(OTHER_ORDER_CODE);

    expect(guardMock.mock.calls[0]).toEqual(["recheckOrder", USER_ID]);
  });
});

// =========================================================================
// Hằng số cửa sổ: ĐÚNG MỘT lời khai, và nó không nằm ở đây
// =========================================================================
describe("orderActions.ts — không có con số cửa sổ thứ hai nào trong file", () => {
  it("mã nguồn (đã bỏ chú thích) không chứa phép tính cửa sổ nào", () => {
    const source = readFileSync(resolve(__dirname, "../orderActions.ts"), "utf8");
    // Bỏ chú thích trước khi soi: khối chú thích của file CÓ nhắc tên hằng, và
    // nhắc tới nó bằng lời không phải là dựng lại nó bằng số.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");

    // Ba dạng viết lại cửa sổ 30 phút mà một lần "dọn dẹp" có thể đẻ ra.
    expect(code).not.toMatch(/30\s*\*\s*60/);
    expect(code).not.toMatch(/1_?800_?000/);
    // Và cả tên hằng: `createOrder()` KHÔNG tự tính hạn chót, nó ghi lại mốc
    // adapter đã tính. Import hằng lên đây là bước đầu tiên của cái đồng hồ
    // thứ hai mà ADR-0013 § Implementation Guidance cấm.
    expect(code).not.toMatch(/ORDER_PENDING_WINDOW_MS/);
  });
});
