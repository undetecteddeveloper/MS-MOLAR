// Supabase service-role client — DANH TÍNH ĐẶC QUYỀN, chỉ dùng server-side.
// Security review 2026-08-03 Critical #2 (schema.sql §11).
//
// ⚠ ĐỌC TRƯỚC KHI THÊM BẤT CỨ THỨ GÌ VÀO FILE NÀY ⚠
//
// service_role key bypass TOÀN BỘ RLS. Nó không phải "client mạnh hơn" mà là
// một danh tính khác hẳn: mọi kiểm soát an toàn của dự án này (RLS, quyền cột
// §10c, policy tác giả) đều KHÔNG áp dụng cho nó. Vì thế file này cố ý:
//
//   1. KHÔNG export client. `serviceRoleClient()` là private. Ra ngoài chỉ có
//      những thao tác hẹp, đã đặt tên rõ ràng — không ai import được "một
//      client admin" rồi dùng nó cho việc khác.
//   2. Mỗi thao tác uỷ quyền phần cưỡng chế cho một hàm SQL tự validate, chứ
//      không tự ý tin tham số đầu vào (xem record_exam_result §11b: user_id
//      suy ra từ attempt, không nhận từ tham số).
//   3. `import "server-only"` — build FAIL ngay nếu có client component lỡ
//      import. Lưới thứ hai: scripts/check-ai-key-bundle.mjs quét bundle tìm
//      cả giá trị key lẫn marker "SUPABASE_SERVICE_ROLE_KEY".
//
// Vì sao phải dùng tới nó: submitExam() nối Postgres bằng chính JWT của học
// sinh, nên DB không thể phân biệt server của mình với devtools của học sinh.
// Muốn "điểm chỉ do server ghi" thì việc ghi phải mang một danh tính khác.
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ScoreResult } from "@/types/result";

/** Private — xem cảnh báo đầu file. KHÔNG export. */
function serviceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Không log giá trị key. Thiếu env là lỗi cấu hình deploy, không phải lỗi user.
    throw new Error(
      "service-role: thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Ghi kết quả chấm điểm của một attempt ĐÃ NỘP.
 *
 * Đây là đường DUY NHẤT còn ghi được vào exam_results — role `authenticated` đã
 * mất hẳn INSERT (§11a), nên học sinh không thể tự POST điểm bịa nữa.
 *
 * KHÔNG nhận userId: record_exam_result() suy ra chủ nhân từ chính attempt và
 * từ chối attempt chưa 'submitted' (§11b). Nghĩa là kể cả khi hàm này bị gọi
 * sai ở đâu đó trong tương lai, nó vẫn không ghi được điểm cho người khác hay
 * cho bài chưa nộp — luật nằm trong DB, không nằm ở call site.
 *
 * Trả về lỗi thay vì throw để submitExam giữ nguyên kiểu xử lý lỗi sẵn có.
 */
export async function recordExamResult(
  attemptId: string,
  score: ScoreResult
): Promise<{ error: { code?: string; message: string } | null }> {
  const { error } = await serviceRoleClient().rpc("record_exam_result", {
    p_attempt_id: attemptId,
    p_total_score: score.totalScore,
    p_correct: score.correct,
    p_total: score.total,
    p_per_question: score.perQuestion,
    p_topic_breakdown: score.topicBreakdown,
  });
  return { error: error ? { code: error.code, message: error.message } : null };
}

// ---------------------------------------------------------------------------
// Takedown UGC (Security review Medium #7, schema.sql §14)
//
// Cần service_role vì RLS cố tình không cho ai sửa đề của người khác — và
// ADR-0001 chốt không tạo role admin trong DB, nên "quyền admin" chỉ tồn tại ở
// tầng app. Người gọi PHẢI tự kiểm isAdminUserId() TRƯỚC; hàm dưới đây không
// tự kiểm được (nó không biết ai đang đăng nhập).
// ---------------------------------------------------------------------------

/** Đề đã bị gỡ / được khôi phục, kèm số report — dữ liệu cho trang /admin. */
export interface ModeratableExam {
  id: string;
  title: string;
  status: string;
  authorDisplayName: string | null;
  createdAt: string;
  reportCount: number;
  reasons: string[];
}

/**
 * Danh sách đề CÓ report, kèm số lượng và lý do. Đọc bằng service_role vì
 * `reports_select_own` chỉ cho mỗi người đọc report của chính họ — không có
 * đường nào để quản trị viên thấy toàn bộ qua client thường.
 */
export async function listReportedExams(): Promise<ModeratableExam[]> {
  const admin = serviceRoleClient();

  const { data: reports, error: repErr } = await admin
    .from("exam_reports")
    .select("exam_id, reason, created_at")
    .order("created_at", { ascending: false });
  if (repErr) throw repErr;

  const rows = (reports ?? []) as Array<{ exam_id: string; reason: string }>;
  if (rows.length === 0) return [];

  const byExam = new Map<string, string[]>();
  for (const r of rows) {
    const list = byExam.get(r.exam_id) ?? [];
    list.push(r.reason);
    byExam.set(r.exam_id, list);
  }

  const { data: exams, error: exErr } = await admin
    .from("exams")
    .select("id, title, status, author_display_name, created_at")
    .in("id", [...byExam.keys()]);
  if (exErr) throw exErr;

  return ((exams ?? []) as Array<Record<string, unknown>>)
    .map((e) => {
      const reasons = byExam.get(e.id as string) ?? [];
      return {
        id: e.id as string,
        title: e.title as string,
        status: e.status as string,
        authorDisplayName: (e.author_display_name as string | null) ?? null,
        createdAt: e.created_at as string,
        reportCount: reasons.length,
        reasons,
      };
    })
    // Nhiều report nhất lên đầu — thứ tự cần xử lý.
    .sort((a, b) => b.reportCount - a.reportCount);
}

/**
 * Gỡ ('remove') hoặc khôi phục ('restore') một đề, kèm ghi nhật ký.
 *
 * `actorId` được ghi vào exam_moderation_log để biết AI đã bấm — lý do chính
 * chọn allowlist-theo-tài-khoản thay vì mật khẩu chung cho trang admin.
 * Khôi phục đưa về 'draft' chứ KHÔNG thẳng lên 'published': tác giả phải tự
 * publish lại, để việc khôi phục không vô tình đẩy nội dung ra công khai.
 */
export async function moderateExam(
  examId: string,
  action: "remove" | "restore",
  actorId: string,
  reason?: string
): Promise<{ error: { message: string } | null }> {
  const admin = serviceRoleClient();
  const nextStatus = action === "remove" ? "removed" : "draft";

  const { error: updErr } = await admin
    .from("exams")
    .update({ status: nextStatus })
    .eq("id", examId);
  if (updErr) return { error: { message: updErr.message } };

  const { error: logErr } = await admin.from("exam_moderation_log").insert({
    exam_id: examId,
    action,
    actor_id: actorId,
    reason: reason?.trim() || null,
  });
  // Nhật ký hỏng KHÔNG được nuốt: gỡ mà không có vết là đúng thứ mục #7 phàn nàn.
  if (logErr) return { error: { message: `Đã đổi trạng thái nhưng ghi log lỗi: ${logErr.message}` } };

  return { error: null };
}
