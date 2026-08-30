// Chấm tự luận (ADR-0018 Decision 6) — bộ đếm ngân sách Groq theo NGÀY, cho cả
// DỰ ÁN.
//
// Đây là cổng DUY NHẤT trên chi tiêu Groq. Nó cố ý KHÔNG dùng chung đường nào
// với `consumeQuota()`: giới hạn free tier là chuyện của DỰ ÁN chứ không của
// người dùng (ADR-0006), nên ở đây không có `Entitlement`, không có `Plan`,
// không có tách suất theo gói. Một trần, một khoá, cả dự án (AC-066).
//
// VÌ SAO KHOÁ RIÊNG chứ không dùng lại `ai:budget:`: hai nhà cung cấp có hai
// hạn mức độc lập. Gộp chung nghĩa là một ngày chấm tự luận nhiều sẽ chặn
// trích xuất Gemini của tất cả mọi người, và không có gì đỏ ở đâu để nói vì
// sao. Hai tiền tố khác nhau NGAY Ở KÝ TỰ ĐẦU (`a` vs `g`) nên AC-030 đứng
// được bằng CẤU TRÚC TÊN, không phải bằng kỷ luật của người viết.
//
// MẪU KHOÁ VIẾT NGUYÊN VẸN Ở ĐÂY, và chỉ ở đây — cùng kỷ luật mà `quota.ts`
// giữ cho `ai:budget:`, và vì cùng lý do đã ghi ở `budgetDay.ts:35-60`: một
// hàm dựng khoá nhận prefix sẽ vô hiệu hoá phép quét văn bản nguồn canh
// "đúng một chỗ dựng", và biến dấu hai chấm cuối thành một hợp đồng không ai
// cưỡng chế được. Phần NGÀY thì import — hai lần suy ra độc lập lệch nhau ở
// một phép làm tròn là một bộ đếm bị chia đôi mà không có gì đỏ.

import "server-only";
import { Redis } from "@upstash/redis";
import { BUDGET_TTL_SECONDS, pacificDay } from "@/lib/billing/budgetDay";

export type BudgetResult = { ok: true } | { ok: false; reason: "project_budget" | "unavailable" };

/**
 * Trần chi Groq mỗi ngày cho cả dự án, hoặc `null` khi không dùng được.
 *
 * `null` ⇒ TỪ CHỐI, không phải "không giới hạn" (AC-031) — cùng lối fail-closed
 * mà `dailyBudgetLimit()` của `quota.ts` dùng cho `AI_BUDGET_DAILY_LIMIT`. Điều
 * kiện hợp lệ trùng với `checkEnv.ts` một cách CỐ Ý và hai chỗ không dùng chung
 * code: `checkEnv` trả lời "có nói ra lúc khởi động không", hàm này trả lời "có
 * phục vụ lượt chấm này không".
 */
function dailyLimit(): number | null {
  const raw = process.env.GROQ_BUDGET_DAILY_LIMIT?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Đặt chỗ `calls` request Groq cho pass sắp chạy.
 *
 * `calls` BẮT BUỘC, không có giá trị mặc định — đúng lý do
 * `GEMINI_CALLS_PER_OPERATION` bắt buộc ở `quota.ts:302-306`: một mặc định `1`
 * tái tạo IM LẶNG đúng cái under-count mà cả hai bộ đếm sinh ra để sửa. Người
 * gọi truyền `GROQ_CALLS_PER_ESSAY`, tức TRƯỜNG HỢP XẤU NHẤT, và truyền nó
 * TRƯỚC request đầu tiên.
 *
 * Tiền điều kiện: người gọi đã claim thành công (AC-072 — uỷ quyền trước đo
 * đếm). Module này không kiểm điều đó; nó không biết gì về vòng đời.
 */
export async function reserveGroqBudget(calls: number, now: Date): Promise<BudgetResult> {
  // Trần được kiểm TRƯỚC mọi phép ghi: một deploy quên biến môi trường không
  // được phép đốt bộ đếm trong lúc từ chối phục vụ.
  const limit = dailyLimit();
  if (limit === null) return { ok: false, reason: "unavailable" };

  // Đọc env LÚC GỌI và không cache client giữa các lượt, cùng lý do `quota.ts`
  // ghi ở chỗ tương ứng: `next build` nạp module với env giả của CI, và một
  // client dựng lúc đó sẽ ghim cấu hình sai.
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return { ok: false, reason: "unavailable" };

  const key = `groq:budget:${pacificDay(now)}`;

  try {
    const redis = new Redis({ url, token });

    // `INCRBY` rồi so, chứ không đọc rồi ghi: hai pass song song cùng đọc
    // `limit − 1` rồi cùng ghi sẽ vượt trần mà không lệnh nào sai.
    //
    // MỘT lệnh, với TOÀN BỘ trường hợp xấu nhất, phát TRƯỚC request đầu tiên.
    // Không tích từng lượt gọi: tích dần nghĩa là một pass phải retry hai lần
    // đã đặt chỗ ít hơn mức nó có thể tiêu, và trần thôi ràng buộc chi tiêu
    // thật — đúng chế độ hỏng mà `gemini.ts:43-71` mô tả.
    const spent = await redis.incrby(key, calls);
    await redis.expire(key, BUDGET_TTL_SECONDS);

    if (spent > limit) {
      // Hoàn lại đúng số đã cộng: một lượt bị chặn không được tự kéo dài thời
      // gian bị chặn của chính nó (cùng hình dạng quota.ts:373-377).
      await redis.decrby(key, calls);
      return { ok: false, reason: "project_budget" };
    }

    // KHÔNG hoàn lại khi pass thành công ngay lần đầu. Đặt chỗ dư kéo thông
    // lượng ngày xuống dưới trần danh nghĩa, và đó là đánh đổi ĐÃ GHI NHẬN
    // (ADR-0018 D6): đếm dư chỉ làm ta phục vụ ít hơn, đếm thiếu là sự cố.
    return { ok: true };
  } catch {
    // Không log `err`: nó có thể mang chuỗi kết nối. Lối này phải là `false` —
    // một `catch` trả về `{ ok: true }` biến một sự cố Redis thành chi tiêu
    // KHÔNG GIỚI HẠN, và đó là đúng hướng sai mà AC-031 đặt tên.
    return { ok: false, reason: "unavailable" };
  }
}
