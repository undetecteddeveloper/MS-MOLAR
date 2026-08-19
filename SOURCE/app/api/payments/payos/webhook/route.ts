// Webhook payOS — ĐƯỜNG GHI CHƯA-ĐĂNG-NHẬP ĐẦU TIÊN CỦA DỰ ÁN.
// Backend DD § "app/api/payments/payos/webhook/route.ts — the thin shell",
// Integration Point I4; ADR-0014 toàn văn; PRD R9 (AC-030…AC-034).
//
// File này CỐ Ý không có nghiệp vụ nào. Nó là một cái vỏ: đọc thân, hỏi adapter
// chữ ký có đúng không, và nếu đúng thì gọi ĐÚNG MỘT hàm với ĐÚNG MỘT số. Mọi
// quyết định về tiền nằm trong `settleOrder()`, và `settleOrder()` không tin
// thân request — nó hỏi lại payOS (ADR-0014 Decision 1-2).
//
// BA ĐIỀU LUẬT, và cả ba đều là bảo mật chứ không phải phong cách:
//
//  1. CHỮ KÝ SAI ⇒ KHÔNG MỘT LƯỢT I/O NÀO. Không đọc DB, không gọi ra ngoài.
//     Chữ ký ở đây KHÔNG phải biên tin cậy (biên tin cậy là câu trả lời của
//     payOS ở bước 2 của `settleOrder()`); nó là một bộ lọc RẺ đứng chặn để
//     internet không sai khiến được server ta gọi ra ngoài. TD-013 còn mở —
//     không có rate limit nào phía sau đường này — nên bộ lọc ấy là thứ duy
//     nhất giới hạn chi phí một lượt tấn công.
//
//  2. CHỈ `orderCode` ĐI TIẾP. ADR-0014 § Implementation Guidance: *"Never read
//     `amount`, `status`, or any user identifier from the webhook payload for
//     decision-making. Read `orderCode`, and nothing else."* Điều đó được giữ ở
//     đây bằng CẤU TRÚC chứ không bằng kỷ luật: file này không bao giờ parse
//     thân request. Chuỗi thô đi thẳng vào adapter, và thứ đi ra là một object
//     có đúng một trường. Không có biến nào ở đây để mà đọc nhầm.
//
//  3. 200 CHO MỌI QUYẾT ĐỊNH ĐÃ ĐI TỚI, kể cả từ chối. Chính sách retry của
//     payOS không có tài liệu (Assumed Behavior A-6, `Confirmed: No`), nên một
//     non-2xx trên một thân vĩnh viễn sai có thể sinh bão retry vào đúng đường
//     không có rate limit. Non-2xx chỉ dành cho "TA hỏng và thử lại có thể ăn
//     thua" — xem chú thích ở nhánh `settleOrder()` bên dưới.
//
// CÁI GIÁ ĐÃ ĐƯỢC GHI NHẬN, không giấu: một khoá checksum cấu hình sai làm mọi
// giao hàng bị từ chối và trông y hệt sự im lặng. Đó là lựa chọn có chủ đích
// của ADR-0014, và thứ bù lại là DÒNG LOG dưới đây cộng với `recheckOrder()` —
// đường settlement thứ hai, do người dùng bấm. Nên dòng log ấy không phải trang
// trí: nó là tín hiệu vận hành DUY NHẤT của ca đó.

import { verifyWebhookSignature } from "@/lib/billing/payos";
import { settleOrder } from "@/lib/billing/settleOrder";

/** Tập mã lý do ĐÓNG của route này — hôm nay đúng một mã, theo tiền lệ
 *  closed-enum của `telemetry_log.error_code` (ADR-0014: *"a structured reason
 *  code, never free text and never the payload"*).
 *
 *  MỘT mã cho mọi lối từ chối là CỐ Ý, không phải lười: `verifyWebhookSignature`
 *  trả `null` cho khoá thiếu, JSON hỏng, thiếu `data`/`signature`, digest sai
 *  và `orderCode` không hợp lệ — và nó cố ý không nói lối nào, vì nói ra là kể
 *  cho người gửi biết họ đang sai ở đâu. Phân biệt được năm lối ấy trong log
 *  đòi adapter phải trả về lý do, tức đòi bề mặt rộng hơn để đổi lấy thông tin
 *  mà chính người tấn công cũng đọc được. */
const REFUSED_INVALID_SIGNATURE = "invalid_signature";

export async function POST(request: Request): Promise<Response> {
  // `.text()`, KHÔNG `.json()`. Byte payOS đã ký phải là byte ta đem xác minh:
  // một vòng `JSON.parse` rồi `JSON.stringify` có thể đổi thứ tự khoá, đổi cách
  // viết số và đổi escape unicode — một chữ ký như thế chỉ đúng với những giá
  // trị sống sót qua vòng round-trip đó (xem `lib/billing/payos/signature.ts`
  // § docblock). Adapter nhận chuỗi thô và tự parse đúng MỘT lần.
  const rawBody = await request.text();

  const data = verifyWebhookSignature(rawBody);
  if (!data) {
    // Log NGAY TẠI ĐÂY và chỉ mã lý do. Không thân, không chữ ký, không độ dài
    // thân, không IP — AC-034 và P-1. `console.error` chứ không `warn` vì ca
    // đắt nhất mà dòng này đại diện là khoá checksum sai, và đó là việc của
    // người vận hành, không phải tiếng ồn.
    console.error("[payos/webhook] refused", JSON.stringify({ reason: REFUSED_INVALID_SIGNATURE }));
    return new Response(null, { status: 200 });
  }

  // KHÔNG `try/catch` ở đây, và đó là một quyết định. `settleOrder()` trả GIÁ
  // TRỊ cho mọi lối từ chối nghiệp vụ (đơn lạ, chưa trả, lệch tiền, nhà cung
  // cấp không với tới được) — không lối nào trong số đó ném. Thứ DUY NHẤT ném
  // ra khỏi nó là sự cố thật: DB đọc hỏng, hoặc đơn mồ côi (dòng đã 'paid' mà
  // không ai được cấp quyền, D10). Đúng ca "ta hỏng và thử lại có thể ăn thua"
  // mà ADR-0014 dành non-2xx cho. Bọc nó lại thành 200 là xoá dấu vết duy nhất
  // của một sự cố cần tới một con người.
  await settleOrder(data.orderCode);

  return new Response(null, { status: 200 });
}
