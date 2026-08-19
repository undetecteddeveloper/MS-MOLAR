import "server-only";

import { getPaymentStatus, PayosCallError } from "@/lib/billing/payos";
import {
  readPaymentOrderForSettlement,
  recordPaymentSettlement,
} from "@/lib/supabase/service-role";

// Đường DUY NHẤT trong repo gia hạn được entitlement — backend DD § "lib/billing/
// settleOrder.ts — one function, two triggers", ADR-0014 Decision 1.
//
// HAI TRIGGER, MỘT HÀM: route webhook (không đăng nhập, do payOS gọi) và
// `recheckOrder()` (đã đăng nhập, PRD R10). Cả hai đi qua đúng bốn bước dưới
// đây, nên đường đắt-để-kiểm (webhook: chỉ có trên production, tốn tiền thật) và
// đường rẻ-để-kiểm (Server Action: chạy ở mọi môi trường) tập thể dục CÙNG một
// logic settlement.
//
// THỨ TỰ BỐN BƯỚC LÀ TÍNH ĐÚNG ĐẮN, KHÔNG PHẢI PHONG CÁCH. Không lượt ghi nào
// được phép đứng trước bước 2. Cấp tiền mà nhà cung cấp chưa nói là đã trả chính
// là sự cố mà trật tự này tồn tại để chặn — nên nếu một lần refactor nào đó làm
// bước 4 trôi lên trên bước 2, hãy dừng lại chứ đừng sửa test.
//
// KHÔNG KIỂM CHỦ SỞ HỮU Ở ĐÂY, và điều đó là cố ý (backend DD § recheckOrder() —
// ownership scoping, FE-B-02): webhook không có danh tính người gọi nào cả. Đặt
// phép kiểm ấy vào đây thì hoặc là phá webhook, hoặc là phải thêm một tham số
// "người gọi" nullable — tức một cờ chế độ nằm trên đường tiền. Việc kiểm nằm ở
// `recheckOrder()`, bằng client theo phiên, dưới `orders_select_own`.

/** Kết quả một lượt đối soát — backend DD § Main Components.
 *
 *  NĂM lý do từ chối, không phải ba. Mỗi lý do do MỘT nhánh riêng sinh ra và ứng
 *  một-một với một câu của bảng UI Spec C-10; hai lý do không bao giờ dùng chung
 *  một câu, vì "không với tới được nhà cung cấp" và "bạn chưa trả tiền" đòi hai
 *  hành động NGƯỢC NHAU ở phía người dùng. Bớt một literal ở đây là lặng lẽ xoá
 *  một dòng khỏi bảng đó — không ai render được câu ấy nữa. */
export type SettleResult =
  | { settled: true; expiresAt: string }
  | {
      settled: false;
      reason:
        | "unknown_order"
        | "not_pending"
        | "not_paid_yet"
        | "amount_mismatch"
        | "provider_unavailable";
    };

/**
 * Đối soát một đơn và, chỉ khi nhà cung cấp xác nhận, gia hạn entitlement.
 *
 * Tham số DUY NHẤT là `orderCode` (ADR-0014 Decision 1: *"No caller can pass a
 * payment amount, a status, or a user id into it"*). Webhook gọi tên được một
 * đơn; nó không mô tả được đơn đó.
 *
 * Mọi lối từ chối là một GIÁ TRỊ, không phải một exception — UI Spec C-10 render
 * từng lý do thành một câu. Ngoại lệ duy nhất đi ra ngoài là sự cố thật: DB đọc
 * hỏng, hoặc đơn mồ côi (dòng đã 'paid' mà không có người thụ hưởng) — cả hai
 * cần một con người, và nuốt chúng là xoá dấu vết duy nhất của chúng.
 */
export async function settleOrder(orderCode: number): Promise<SettleResult> {
  // Bước 1 — dòng đơn của CHÍNH TA quyết định trước. Một lượt phát lại vì thế
  // chỉ tốn một lượt đọc theo chỉ mục, không tốn một lượt gọi ra ngoài.
  const order = await readPaymentOrderForSettlement(orderCode);
  if (!order) return { settled: false, reason: "unknown_order" };
  if (order.status !== "pending") return { settled: false, reason: "not_pending" };

  // Bước 2 — BIÊN TIN CẬY. Nhà cung cấp, chứ không phải khoá bí mật của ta, là
  // lý do ta tin tiền đã chuyển (ADR-0014 Decision 2).
  let provider: { status: string; amount: number };
  try {
    provider = await getPaymentStatus(orderCode);
  } catch (err) {
    // Bắt HẸP, đúng một lớp lỗi. `provider_unavailable` là câu trả lời cho một
    // nhà cung cấp không với tới được — không phải cái thùng rác cho mọi lỗi
    // xảy ra trên đường đó. Một `catch` bắt tất sẽ biến một bug của chính ta
    // thành lời khuyên "thử lại lát nữa" gửi cho người dùng.
    if (err instanceof PayosCallError) {
      return { settled: false, reason: "provider_unavailable" };
    }
    throw err;
  }
  // Mọi literal khác `paid` — kể cả `unknown`, câu trả lời fail-closed của
  // adapter cho một literal nó chưa biết — đều dừng ở đây, KHÔNG ghi gì.
  if (provider.status !== "paid") return { settled: false, reason: "not_paid_yet" };

  // Bước 3 — so với DÒNG ĐƠN ĐÃ LƯU, không bao giờ với một hằng và không bao giờ
  // với payload. Một lần đổi giá không được phép vô hiệu hoá các đơn đang bay
  // được tạo ở giá cũ (ADR-0014 § Implementation Guidance). Đó cũng là lý do
  // `PREMIUM_PRICE_VND` không được import vào file này: nó đọc lúc TẠO đơn.
  if (provider.amount !== order.amount) {
    // Lối ra duy nhất mà tiền CÓ THỂ đã chuyển trong khi đường tự động đã dừng.
    // C-10 đưa nó tới một con người, cố ý.
    return { settled: false, reason: "amount_mismatch" };
  }

  // Bước 4 — lượt ghi. Cổng `status = 'pending'` nằm TRONG câu UPDATE của hàm
  // SQL, nên hai trigger bấm cùng lúc thì một bên thắng và bên kia khớp 0 dòng.
  const outcome = await recordPaymentSettlement(orderCode);
  if ("error" in outcome) {
    // Lan ra, không nuốt. Ca đáng sợ nhất ở đây là đơn mồ côi: dòng giờ là
    // 'paid' mà không ai được cấp quyền (D10).
    throw new Error(
      `record_payment_settlement (order ${orderCode}): ${outcome.error.message}`
    );
  }
  // `null` = một trigger khác đã settle xong trước. Đó là AC-031 hoạt động
  // đúng, không phải một lỗi.
  if (outcome.expiresAt === null) return { settled: false, reason: "not_pending" };

  return { settled: true, expiresAt: outcome.expiresAt };
}
