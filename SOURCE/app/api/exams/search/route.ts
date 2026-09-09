// GET /api/exams/search?q= — gợi ý đề khi gõ vào ô tìm trên header (ADR-0020).
//
// Đường ĐỌC, chỉ cho người đã đăng nhập: kho đề nằm sau RLS `exams_select_visible`
// (`to authenticated`), nên với khách câu trả lời đúng là 401 chứ không phải một
// danh sách rỗng trông như "không có đề nào". Ô tìm không hiện với khách
// (SiteHeader), 401 chỉ là hàng rào thứ hai cho lượt gọi thẳng.
//
// Thứ tự kiểm tra là thứ tự CHI PHÍ: đọc phiên (đã cache theo request) → chuẩn
// hoá từ khoá (thuần, không tốn gì; rỗng/quá ngắn trả [] mà KHÔNG chạm rate
// limit lẫn DB — gõ một chữ không phải là một lượt tìm) → rate limit (RAM rồi
// Redis) → RPC. Một vòng lặp tự động vì thế trả tiền cho đúng thứ nó định lạm
// dụng: truy vấn trigram.
//
// Route handler chứ không phải Server Action: ô tìm gọi theo từng nhịp gõ và
// cần HUỶ được (AbortController) khi từ khoá đổi — fetch GET làm việc đó tự
// nhiên, Server Action thì không. Cache riêng tư 30 giây để gõ lùi rồi gõ lại
// cùng từ khoá không tốn thêm một lượt.

import { searchExamTitles } from "@/features/exams/queries";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { toSearchTerm } from "@/lib/search/normalize";
import { guard } from "@/lib/security/rateLimit";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  }

  const term = toSearchTerm(new URL(request.url).searchParams.get("q"));
  if (!term) {
    return Response.json({ items: [] }, { headers: NO_STORE });
  }

  const limit = await guard("searchExams", user.id);
  if (!limit.ok) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const items = await searchExamTitles(term);
    return Response.json({ items }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (err) {
    // Chỉ mã lý do, không thân lỗi DB — cùng kỷ luật với webhook payOS. Ô tìm
    // hiện "Chưa tìm được lúc này" và Enter vẫn mở Kho đề (đường không phụ thuộc
    // RPC), nên một sự cố ở đây không chặn ai khỏi việc tìm đề.
    console.error("[exams/search] failed", { term, err });
    return Response.json({ error: "search_failed" }, { status: 500, headers: NO_STORE });
  }
}
