// Route group (billing) — hai lệnh ĐỌC của màn "đơn của tôi" (S-05) và màn
// thanh toán (S-06). Server-only, theo đúng bốn module queries.ts đã ship
// ((HM), (exams), (layer3), (layer4)): mapping snake_case → camelCase xảy ra
// MỘT lần, ở tầng query, nên không component nào nhìn thấy tên cột CSDL.
// Frontend DD § Data-Fetching Plan; backend DD § "One mapper, not two" (I010)
// và Escalation E-02 (CL-01).
//
// MỘT ĐIỀU FILE NÀY KHÔNG ĐƯỢC LÀM, và nó là toàn bộ lý do CL-01 tồn tại:
// KHÔNG tự chiếu một dòng `payment_orders` thành `CheckoutOrder`. Quy ước bốn
// module kia — "mapping viết ngay trong tầng query" — bị lệch đi ở ĐÚNG một
// điểm tại đây, có chủ ý, vì hợp đồng `CheckoutOrder` có HAI bên sản xuất:
// `createOrder()` (đọc lại ngay trong câu ghi) và `getMyOrder()` bên dưới. Hai
// bên sản xuất mà hai mapping thì `pendingUntil` nói hai chuỗi khác nhau cho
// cùng một hạn chót — PostgREST giao `2099-11-30T23:59:59+00:00`, hợp đồng đòi
// `2099-11-30T23:59:59.000Z` — và người dùng thấy một hạn chót sau khi bấm mua,
// một hạn chót khác sau khi F5. Đó không phải giả thuyết: đo được ở INT-2 lúc
// bản cài đặt còn tự map (`tests/integration/subscription.int.test.ts`, ca (c)
// và (d)).
//
// `MyOrderRow` thì KHÁC và vẫn map tại chỗ: nó là hình chiếu DANH SÁCH, năm
// trường, chỉ có MỘT bên sản xuất là chính hàm dưới đây. Không có bên thứ hai
// để lệch với.
import "server-only";

import { toCheckoutOrder, type CheckoutOrder, type PaymentOrderRow } from "@/lib/billing/checkoutOrder";
import { readBounded } from "@/lib/supabase/boundedRead";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_ORDER_CHECKOUT_COLUMNS } from "@/lib/supabase/service-role";

// --- S-05: danh sách đơn của tôi -------------------------------------------

/** Một dòng trong danh sách "đơn của tôi" (S-05) — frontend DD § Data
 *  Representation Decision.
 *
 *  `status` để kiểu `string` chứ KHÔNG phải union bốn literal, và đó là toàn bộ
 *  ý nghĩa của kiểu này (UI Spec C-09). Giá trị băng qua một biên CSDL mà ràng
 *  buộc CHECK của nó đổi được không cần một dòng TypeScript nào đổi theo; khai
 *  union ở đây sẽ để một lần đổi CHECK ship thành một nhãn SAI lúc chạy mà
 *  không có lỗi biên dịch nào. Việc thu hẹp xảy ra đúng một lần, bên trong
 *  C-09, và nhánh "không nhận ra" là đích đến trung thực của nó. */
export type MyOrderRow = {
  orderCode: number;
  amountVnd: number;
  status: string;
  createdAt: string;
  pendingUntil: string;
};

/** Năm cột S-05 render — KHÔNG phải cả mười một cột của bảng, và cố ý KHÔNG
 *  phải tám cột của `PAYMENT_ORDER_CHECKOUT_COLUMNS`: danh sách không có mã QR
 *  và không có khối chuyển khoản, nên kéo chúng về đây chỉ là băng thông và một
 *  payload RSC to hơn cho thứ không ai render. Đổi lại nó cần `created_at`, thứ
 *  hợp đồng C-13 không có. */
const MY_ORDER_LIST_COLUMNS = "order_code, amount, status, created_at, pending_until";

/** Dòng đúng như PostgREST giao cho lượt đọc danh sách. */
type MyOrderListRow = {
  order_code: number;
  amount: number;
  status: string;
  created_at: string;
  pending_until: string;
};

/**
 * Mọi đơn của chính người gọi, MỚI NHẤT TRƯỚC.
 *
 * THỨ TỰ KHAI BẰNG SQL, đúng một lần, và không có lượt sắp lại nào ở JavaScript
 * — `.order("created_at", { ascending: false })` khớp thẳng chỉ mục
 * `payment_orders_user_created_idx (user_id, created_at desc)` (schema.sql).
 * Ngoại lệ sắp-ở-JS của `(HM)/queries.ts` KHÔNG áp dụng ở đây: nó tồn tại vì
 * `.order(col, { referencedTable })` là một no-op ĐO ĐƯỢC với embed to-one, còn
 * lượt đọc này phẳng, không embed. Và sắp ở JS sau một `readBounded` là chủ
 * động chọn sai: phần bị PostgREST cắt khi chạm trần sẽ là phần CHƯA sắp, nên
 * dòng biến mất là dòng không ai đoán trước được, thay vì dòng CŨ NHẤT.
 *
 * Biên tường minh (P3): lớn theo số lần MỘT người bấm mua. Chạm trần ở đây làm
 * mất những đơn CŨ NHẤT khỏi màn quản lý của chính chủ đơn — trong im lặng, và
 * chủ đơn là người duy nhất biết đơn đó từng tồn tại.
 *
 * KHÔNG có `.eq("user_id", …)` và KHÔNG có lượt `auth.getUser()`: policy
 * `orders_select_own` (`for select to authenticated using (user_id =
 * auth.uid())`) là lớp cưỡng chế THẬT, và nó phủ đúng bảng này cho đúng câu hỏi
 * này — cùng lập luận `recheckOrder()` đã ghi cho lượt đọc theo mã của nó. Một
 * phiên chưa đăng nhập đọc được 0 dòng, nên giá trị trả về là `[]`: rỗng là một
 * GIÁ TRỊ, không phải một lỗi.
 */
export async function listMyOrders(): Promise<MyOrderRow[]> {
  const supabase = await createClient();
  const rows = (await readBounded(
    "listMyOrders",
    supabase
      .from("payment_orders")
      .select(MY_ORDER_LIST_COLUMNS)
      .order("created_at", { ascending: false })
  )) as MyOrderListRow[];

  return rows.map((row) => ({
    // `Number()` dù kiểu đã khai là `number`: `order_code` là `bigint`, và cấu
    // hình PostgREST đổi được sang dạng CHUỖI mà không ai phải sửa một dòng
    // code nào. Cùng quy tắc `toCheckoutOrder()` đã ghim cho cùng cột ấy.
    orderCode: Number(row.order_code),
    amountVnd: row.amount,
    status: row.status,
    // Hai mốc thời gian đi ra NGUYÊN SI dạng PostgREST giao, đúng như
    // `listMyExams()`/`listMyHistory()` làm với các cột `timestamptz` của
    // chúng. Chuẩn hoá `…Z` là hợp đồng của `CheckoutOrder`, không phải của
    // hình chiếu này: hai trường dưới đây chỉ đi tới `formatDateTime()`, thứ
    // phân tích cả hai dạng, và tới một phép so mốc thời gian — không phép so
    // CHUỖI nào chạm tới chúng.
    createdAt: row.created_at,
    pendingUntil: row.pending_until,
  }));
}

// --- S-06: một đơn theo mã --------------------------------------------------

/**
 * Một đơn theo `orderCode`, cho màn thanh toán (S-06) — hoặc `null`.
 *
 * Đây là TOÀN BỘ đường đọc của S-06 trên một lần tải nguội: F5, link "tiếp tục
 * thanh toán" từ S-05, hay một bookmark đều không có lượt `createOrder()` nào
 * đi trước (backend DD FE-B-01). Bốn giá trị chuyển khoản là CỘT của
 * `payment_orders`, ghi một lần lúc tạo đơn, nên lượt đọc RLS mà UI Spec C-13
 * chỉ định là đủ và không cần một Server Action thứ hai.
 *
 * MÃ LẠ VÀ MÃ CỦA NGƯỜI KHÁC CÙNG TRẢ `null`, và sự không phân biệt được ấy là
 * CỐ Ý (C-13 § State × Display Matrix): `orders_select_own` lọc dòng của người
 * khác đi, nên nó về `null` bằng đúng con đường một mã không tồn tại về `null`.
 * Trả lời khác nhau cho hai đầu vào ấy sẽ biến hàm này thành một máy dò trên
 * một `bigint` do kẻ tấn công chọn.
 *
 * NÉM khi lượt đọc hỏng: "không đọc được" không phải "không có đơn nào", và
 * dịch cái trước thành cái sau sẽ render trạng thái Rỗng của C-13 cho một người
 * vừa chuyển tiền xong. Exception đi tới `error.tsx` của route.
 *
 * @returns `CheckoutOrder` tám trường, chiếu qua `toCheckoutOrder()` —
 *   MAPPER DUY NHẤT trong repo, dùng chung với `createOrder()`. Xem khối đầu
 *   file: viết một mapping thứ hai ở đây là lỗi CL-01, và INT-2 đỏ vì nó.
 */
export async function getMyOrder(orderCode: number): Promise<CheckoutOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_orders")
    // Cùng MỘT lời khai cột với đường đọc-lại của `createOrder()`
    // (`lib/supabase/service-role.ts`). Chép tám tên cột ra đây là cách chắc
    // chắn nhất để một đường trả về bảy trường còn đường kia trả về tám.
    .select(PAYMENT_ORDER_CHECKOUT_COLUMNS)
    .eq("order_code", orderCode)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return toCheckoutOrder(data as unknown as PaymentOrderRow);
}
