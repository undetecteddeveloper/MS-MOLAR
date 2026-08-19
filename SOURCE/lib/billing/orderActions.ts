// Hai Server Action của đường mua gói — backend DD § "`createOrder()`'s order of
// operations — step (0) reuse precedes the provider call" và § "`recheckOrder()`
// — ownership scoping (FE-B-02)"; PRD AC-026 / AC-027 / AC-037.
//
// HAI TRẬT TỰ, VÀ CẢ HAI ĐỀU LÀ TÍNH ĐÚNG ĐẮN, KHÔNG PHẢI PHONG CÁCH:
//
//   1. BƯỚC (0) ĐỨNG TRƯỚC LƯỢT GỌI NHÀ CUNG CẤP. Một đơn được dùng lại KHÔNG
//      được sinh ra payment request thứ hai: payOS sẽ giữ hai link sống cho một
//      lần mua, mỗi link một `expiredAt`, và mã QR người dùng đang nhìn thôi
//      không còn là thứ duy nhất bản ghi của ta trỏ tới. Đó cũng là thứ làm
//      nhánh tái dùng tốn ĐÚNG 0 vòng ra ngoài, nên bấm mua dồn dập không biến
//      thành máy khuếch đại nhắm vào payOS.
//   2. GỌI NHÀ CUNG CẤP TRƯỚC KHI GHI (provider-first). Ghi dòng `pending`
//      trước rồi gọi sau sẽ để lại một khoảng thời gian mà dòng tồn tại với bốn
//      cột chuyển khoản TRỐNG — một lần F5 trong khoảng ấy render một khối
//      chuyển khoản rỗng, đúng sự cố AC-028 tồn tại để chặn. Thứ tự này cũng là
//      thứ cho phép bốn cột ấy `not null`, tức biến "màn hình luôn render được"
//      thành một ràng buộc của CSDL chứ không phải một quy ước.
//
// KHÔNG CÓ CON SỐ CỬA SỔ NÀO TRONG FILE NÀY, và sự vắng mặt ấy là cố ý.
// ADR-0013 § Implementation Guidance: *"Keep the pending-order window and the
// provider's `expiredAt` the same number, set from one shared constant"*. Adapter
// tính mốc ấy từ `ORDER_PENDING_WINDOW_MS` và TRẢ LẠI nó; bước (3) ghi thẳng giá
// trị được trả về xuống `pending_until`. Tự tính lại ở đây — dù bằng đúng hằng
// đó — là dựng cái đồng hồ thứ hai, và hai đồng hồ lệch nhau đẻ ra một QR mà bên
// này tưởng còn sống, bên kia tưởng đã chết.
//
// PHÉP KIỂM CHỦ SỞ HỮU NẰM Ở `recheckOrder()`, KHÔNG PHẢI Ở `settleOrder()`.
// `settleOrder()` có hai trigger (ADR-0014 Decision 1) và một trong hai —
// webhook — không có danh tính người gọi nào cả. Dời phép kiểm xuống đó thì hoặc
// phá webhook, hoặc phải thêm một tham số "người gọi" nullable, tức một cờ chế
// độ nằm trên đường tiền. Và KHÔNG có phép kiểm phía client hay phía trang nào
// thay thế được: đó sẽ là quyết định phân quyền thứ hai ở một chỗ thứ hai, trong
// khi chỗ có thẩm quyền là máy chủ.
//
// MỌI LỐI TỪ CHỐI LÀ MỘT GIÁ TRỊ, không phải một exception băng qua biên Server
// Action (backend DD § Data Contracts, cột Failure clause). Ngoại lệ duy nhất
// được phép đi ra ngoài là sự cố thật — một lượt đọc CSDL hỏng — vì nuốt nó
// thành "chưa có đơn nào" sẽ mint một đơn thứ hai cho người đã có đơn còn sống.

"use server";

import {
  toCheckoutOrder,
  type CheckoutOrder,
  type PaymentOrderRow,
} from "@/lib/billing/checkoutOrder";
import { createPaymentRequest, PayosCallError } from "@/lib/billing/payos";
import { PREMIUM_PRICE_VND } from "@/lib/billing/pricing";
import { settleOrder, type SettleResult } from "@/lib/billing/settleOrder";
import { guard } from "@/lib/security/rateLimit";
import { SITE_URL } from "@/lib/siteUrl";
import {
  PAYMENT_ORDER_CHECKOUT_COLUMNS,
  recordPaymentOrder,
} from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

/** Lối tạo đơn thất bại — bốn mã, mỗi mã một câu khác nhau ở S-01.
 *
 *  `rate_limited` tách khỏi `server` vì hai lý do ấy đòi hai hành động NGƯỢC
 *  nhau ở phía người dùng ("chờ một lát rồi thử lại" so với "báo hỗ trợ"), đúng
 *  luật mà bảng lý do của `SettleResult` đã đặt cho đường đối soát.
 *  `provider_unavailable` dùng LẠI literal của `SettleResult` cho cùng một tình
 *  huống — payOS không với tới được — để hai đường không đặt hai cái tên cho một
 *  sự việc. */
export type CreateOrderError =
  | "unauthenticated"
  | "rate_limited"
  | "provider_unavailable"
  | "server";

/** Thành công là CHÍNH `CheckoutOrder`, không phải một phong bì bọc quanh nó.
 *
 *  Tám trường ấy là hợp đồng UI Spec C-13 đã đóng băng, và `getMyOrder()` (đường
 *  đọc nguội của S-06) trả về đúng hình dạng đó — nên hai đường vào cùng một màn
 *  hình nói cùng một thứ tiếng. Phân biệt hai nhánh bằng `"error" in result`. */
export type CreateOrderOutcome = CheckoutOrder | { error: CreateOrderError };

/** Kết quả một lượt đối soát do NGƯỜI DÙNG bấm.
 *
 *  Năm lý do của `SettleResult` cộng đúng hai lối từ chối mà chỉ lớp bọc-đã-đăng
 *  nhập này mới có. `settleOrder()` không biết tới cả hai, và không được biết:
 *  trigger còn lại của nó là webhook, thứ không có phiên và không có trần.
 *
 *  Đây là hình dạng mà `tests/e2e/fixture/subscriptionFixtureData.ts` neo vào
 *  (`FIXTURE_RECHECK_OUTCOMES … satisfies Record<string, RecheckOutcome>`), nên
 *  thêm/bớt một nhánh ở đây là một lỗi biên dịch ở đó chứ không phải một lần
 *  trôi lệch im lặng giữa fixture và đường tiền. */
export type RecheckOutcome = SettleResult | { error: "unauthenticated" | "rate_limited" };

/** Nội dung chuyển khoản người dùng gõ vào máy ATM/app ngân hàng, và là chuỗi
 *  payOS đối soát theo. `MSMOLAR <orderCode>` — 21 ký tự với một mã 13 chữ số,
 *  nằm gọn dưới trần 25 ký tự của trường `description` bên payOS, và mang chính
 *  mã đơn nên một lần đối soát tay cũng lần ra được dòng.
 *
 *  KHÔNG dấu, KHÔNG khoảng trắng thừa: nhiều app ngân hàng lọc bỏ ký tự có dấu,
 *  và một nội dung bị lọc là một lần chuyển tiền không đơn nào nhận. */
function transferMemo(orderCode: number): string {
  return `MSMOLAR ${orderCode}`;
}

/** Mã đơn mới — mốc epoch tính bằng mili giây.
 *
 *  payOS đòi một SỐ NGUYÊN, và cột `order_code` là `bigint primary key`. Mốc
 *  thời gian cho ba thứ cùng lúc: đơn điệu tăng (dễ đọc khi đối soát tay), thừa
 *  chỗ dưới `Number.MAX_SAFE_INTEGER`, và nằm HẲN dưới dải mã dành riêng cho
 *  fixture (`tests/e2e/service/subscriptionServiceFixtures.ts` chọn nền
 *  8_000_000_000_000 chính vì "a real `createOrder()` derives its codes from
 *  epoch-milliseconds"), nên một dòng fixture không bao giờ va vào một dòng thật
 *  và lệnh xoá theo khối của lane ấy không với tới được dữ liệu thật.
 *
 *  VA CHẠM thì sao: hai đơn sinh trong CÙNG một mili giây vi phạm khoá chính,
 *  lệnh ghi hỏng, và người gọi nhận `server` — KHÔNG có dòng nào và không có
 *  quyền lợi nào được cấp. Ca đáng lo duy nhất (một người bấm mua hai lần thật
 *  nhanh) đã bị bước (0) triệt trước khi tới được đây. */
function freshOrderCode(): number {
  return Date.now();
}

/** Lượt đọc bước (0): đơn `pending` CÒN HẠN của chính người gọi.
 *
 *  Vị từ là `pending_until > now()`, KHÔNG phải `created_at > now() - 30 phút`.
 *  Hôm nay hai vị từ chỉ cùng một khoảnh khắc vì cùng một hằng nuôi cả hai; suy
 *  từ mốc ĐÃ LƯU thì các đơn đang bay giữ đúng cửa sổ chúng được bán, còn dựng
 *  lại từ `created_at` cộng một hằng sẽ phân loại lại chúng ngay lần đầu cửa sổ
 *  đổi — và phân loại lại một đơn đang bay là đổi hạn chót người dùng đang nhìn.
 *
 *  Client THEO PHIÊN, không phải service_role: `orders_select_own` là lớp cưỡng
 *  chế thật, còn `.eq("user_id", …)` bên dưới là lớp thứ hai nói rõ ý định ngay
 *  tại chỗ đọc.
 *
 *  `order(created_at desc).limit(1)`: cuộc đua hai lượt `createOrder()` song
 *  song (backend DD § Concurrency, cố ý KHÔNG khoá) để lại được HAI dòng còn
 *  hạn. `.maybeSingle()` không có `.limit(1)` sẽ NÉM trong ca đó — biến một
 *  trạng thái đã được chấp nhận thành một sự cố. Lấy dòng mới nhất, và chỉ mục
 *  `payment_orders_user_created_idx (user_id, created_at desc)` phục vụ đúng
 *  thứ tự này. */
async function findReusableOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<PaymentOrderRow | null> {
  const { data, error } = await supabase
    .from("payment_orders")
    .select(PAYMENT_ORDER_CHECKOUT_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "pending")
    .gt("pending_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // NÉM, không nuốt. "Không có đơn nào còn hạn" và "không đọc được" là hai
  // trạng thái khác nhau, và dịch cái sau thành cái trước sẽ mint một đơn thứ
  // hai cho người đã có đơn còn sống — đúng kết cục AC-027 cấm, chỉ khác là nó
  // xảy ra lúc CSDL trục trặc.
  if (error) throw error;
  return (data as unknown as PaymentOrderRow | null) ?? null;
}

/**
 * Tạo đơn mua gói Premium, hoặc trả lại đơn chờ còn hạn mà người dùng đã có.
 *
 * KHÔNG NHẬN THAM SỐ NÀO, và đó là một quyết định về an toàn chứ không phải về
 * tiện lợi: `user_id` và số tiền đều suy ra bên trong hàm — từ phiên đăng nhập
 * và từ `PREMIUM_PRICE_VND` — nên không có chỗ nào cho một client nói mình là ai
 * hay phải trả bao nhiêu (cùng luật ADR-0010/0011 đặt cho danh tính).
 *
 * Bốn bước, đúng thứ tự này:
 *   (0) đơn `pending` còn hạn của chính mình ⇒ trả lại NGUYÊN NÓ và DỪNG —
 *       0 lượt gọi nhà cung cấp, 0 lượt ghi, và `pendingUntil` là mốc ĐÃ LƯU
 *       (đồng hồ đếm ngược không bao giờ khởi động lại — AC-027);
 *   (1) sinh `orderCode` mới, số tiền lấy từ `PREMIUM_PRICE_VND`;
 *   (2) `createPaymentRequest()` — lượt gọi payOS duy nhất của đường này;
 *   (3) ghi ĐÚNG MỘT dòng, mang bốn giá trị nhà cung cấp vừa trả về.
 *
 * @returns `CheckoutOrder` tám trường (chiếu qua `toCheckoutOrder()`, mapper duy
 *   nhất trong repo), hoặc `{ error }` cho mỗi lối từ chối.
 */
export async function createOrder(): Promise<CreateOrderOutcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Không redirect: một redirect làm mất trạng thái trang mua và băng qua biên
  // action như một exception. Tiền lệ `lib/support/actions.ts`, cùng tầng.
  if (!user) return { error: "unauthenticated" };

  // Cổng trần đứng TRƯỚC cả bước (0): một vòng lặp tự động không được phép tiêu
  // dù chỉ một lượt đọc của ta cho mỗi lần nện (AC-037).
  const rl = await guard("createOrder", user.id);
  if (!rl.ok) return { error: "rate_limited" };

  // --- Bước (0) ---------------------------------------------------------
  const reusable = await findReusableOrder(supabase, user.id);
  if (reusable) return toCheckoutOrder(reusable);

  // --- Bước (1) ---------------------------------------------------------
  const orderCode = freshOrderCode();
  const memo = transferMemo(orderCode);

  // --- Bước (2) ---------------------------------------------------------
  let payment;
  try {
    payment = await createPaymentRequest({
      orderCode,
      amountVnd: PREMIUM_PRICE_VND,
      memo,
      // Hai đường quay về sau khi rời app ngân hàng. `SITE_URL` là origin công
      // khai đã có sẵn trong repo; hai route do UI-D11 đóng băng.
      returnUrl: `${SITE_URL}/pricing/checkout?order=${orderCode}`,
      cancelUrl: `${SITE_URL}/pricing`,
    });
  } catch (err) {
    // Bắt HẸP, đúng một lớp lỗi — cùng luật `settleOrder()` bước 2 dùng. Một
    // `catch` bắt tất sẽ biến một bug của chính ta thành lời khuyên "thử lại
    // lát nữa" gửi cho người dùng.
    if (err instanceof PayosCallError) return { error: "provider_unavailable" };
    throw err;
  }

  // --- Bước (3) ---------------------------------------------------------
  const written = await recordPaymentOrder({
    orderCode,
    userId: user.id,
    amountVnd: PREMIUM_PRICE_VND,
    // Mốc CỦA NHÀ CUNG CẤP, chuyển thẳng xuống. Xem khối đầu file.
    pendingUntil: payment.expiresAt,
    qrPayload: payment.qrPayload,
    accountNumber: payment.accountNumber,
    accountName: payment.accountName,
    memo: payment.memo,
  });
  if ("error" in written) {
    // Link thanh toán ở phía payOS còn sống mà dòng của ta không tồn tại — dư
    // chấn đã ghi nhận của thứ tự provider-first (backend DD § "The residual
    // risk of provider-first"). Tự giới hạn: người dùng không bao giờ nhìn thấy
    // QR của một đơn không có dòng, nên không có gì mời họ chuyển tiền, và
    // `expiredAt` của chính payOS thu hồi link trong cùng cửa sổ ấy.
    console.error("[createOrder] record_payment_order", written.error.message);
    return { error: "server" };
  }

  return toCheckoutOrder(written.row);
}

/**
 * Đối soát lại một đơn theo yêu cầu của NGƯỜI DÙNG (PRD R10, UI Spec C-10).
 *
 * Lớp bọc đã-đăng-nhập quanh `settleOrder()`, và toàn bộ giá trị nó thêm vào là
 * PHẠM VI CHỦ SỞ HỮU: đơn của người khác VÔ HÌNH với lượt đọc dưới đây, vì
 * `orders_select_own` lọc nó đi. `.maybeSingle()` trả `null` — đúng cái `null`
 * mà một mã không tồn tại trả về — nên hai đầu vào đi chung MỘT nhánh, trả về
 * MỘT giá trị, tốn ĐÚNG MỘT lượt đọc theo chỉ mục và 0 lượt gọi nhà cung cấp.
 *
 * Vì sao phải như thế (FE-B-02): màn hình render năm câu khác nhau cho năm lý do
 * của `SettleResult`, và phép ánh xạ ấy chỉ an toàn khi action từ chối trả lời
 * về đơn người gọi không sở hữu. Nếu không, `recheckOrder` thành một máy dò trên
 * một `bigint` do kẻ tấn công chọn, và một người đã đăng nhập học được đơn nào
 * tồn tại, đơn nào đang chờ, đơn nào đã trả — trạng thái thanh toán của người
 * khác, qua một nút bấm bình thường của giao diện.
 *
 * Không phân biệt được ở GIÁ TRỊ là chưa đủ, phải không phân biệt được ở CHI
 * PHÍ: cả hai nhánh tốn đúng một lượt đọc và 0 lượt gọi ra ngoài, nên độ trễ
 * cũng không tách được "không phải của bạn" khỏi "không tồn tại". Cổng trần chạy
 * trước cả hai, nên dò cũng tiêu chính suất của kẻ dò.
 */
export async function recheckOrder(orderCode: number): Promise<RecheckOutcome> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const rl = await guard("recheckOrder", user.id);
  if (!rl.ok) return { error: "rate_limited" };

  // Chỉ xin `order_code`: câu hỏi ở đây là "dòng này có nhìn thấy được không",
  // không phải "dòng này nói gì". Đọc thêm cột nào cũng chỉ tạo thêm thứ có thể
  // rò ra ngoài qua một lần refactor sau này.
  const { data, error } = await supabase
    .from("payment_orders")
    .select("order_code")
    .eq("order_code", orderCode)
    .maybeSingle();
  if (error) throw error;

  // MỘT nhánh cho cả hai đầu vào, và nó nằm TRƯỚC mọi lượt gọi nhà cung cấp.
  if (!data) return { settled: false, reason: "unknown_order" };

  // Chỉ khi lượt đọc mang danh tính người gọi trả về một dòng thì mới đối soát.
  // `settleOrder()` giữ nguyên chữ ký một-tham-số: nó không biết ai đang gọi, và
  // không được biết.
  return settleOrder(orderCode);
}
