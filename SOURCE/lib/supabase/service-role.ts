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
import type { TicketIntent, TicketStatus } from "@/lib/support/types";

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

/**
 * Cộng dồn mastery theo kỹ năng cho một attempt ĐÃ NỘP (ADR-0011, schema.sql §18).
 *
 * Anh em ruột của recordExamResult() ở trên, và CỐ Ý là một hàm RIÊNG chứ không
 * phải một tham số thêm của nó: gộp hai việc vào một câu lệnh SQL sẽ khiến một
 * lỗi bên mastery kéo rollback luôn dòng điểm — trong khi NFR nói rõ mastery
 * hỏng KHÔNG được làm hỏng việc nộp bài. Hai lời gọi, hai đường xử lý lỗi.
 *
 * KHÔNG nhận userId (record_skill_mastery() suy ra từ attempt + đòi 'submitted',
 * §18) và KHÔNG nhận skill_node_id: việc tra kỹ năng nằm trong SQL (join
 * questions.skill_node_id), nên tầng TS không có, và không cần có, khái niệm
 * "kỹ năng" nào ở đây.
 *
 * `score.perQuestion` truyền THẲNG, không nắn lại: §18 đọc từng phần tử bằng
 * `pq->>'questionId'` / `(pq->>'isCorrect')::boolean` /
 * `coalesce((pq->>'scored')::boolean, true)`. Đổi tên hay lọc bớt ở đây là cách
 * chắc chắn nhất để hai bên cùng "trông có vẻ đúng" mà lệch nhau.
 */
export async function recordSkillMastery(
  attemptId: string,
  score: ScoreResult
): Promise<{ error: { code?: string; message: string } | null }> {
  const { error } = await serviceRoleClient().rpc("record_skill_mastery", {
    p_attempt_id: attemptId,
    p_per_question: score.perQuestion,
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

// ---------------------------------------------------------------------------
// User Support System v1 (ADR-0012, schema.sql — support_tickets.notify_failed)
//
// Ghi cờ "gửi mail báo ticket thất bại" — CHỈ service_role ghi được cột này,
// vì `support_tickets` không có policy update nào cho `authenticated` (không
// mở surface cho student tự sửa ticket của mình). Gọi từ after()-scheduled
// callback của submitSupportTicket, sau khi sendSupportNotification thất bại
// — KHÔNG BAO GIỜ trên đường response của student (D5/AC-031).
// ---------------------------------------------------------------------------

/** Đánh dấu ticket có lần gửi mail báo thất bại (AC-032) — admin thấy cờ này ở hộp thư. */
export async function flagSupportTicketNotifyFailed(
  ticketId: string
): Promise<{ error: { message: string } | null }> {
  const { error } = await serviceRoleClient()
    .from("support_tickets")
    .update({ notify_failed: true })
    .eq("id", ticketId);
  return { error: error ? { message: error.message } : null };
}

// ---------------------------------------------------------------------------
// User Support System v1 — hộp thư admin (/admin/tickets). Người gọi PHẢI tự
// kiểm isAdminUserId() TRƯỚC (module-boundary precondition, giống
// listReportedExams) — các hàm dưới đây không tự kiểm được vì không biết ai
// đang gọi.
// ---------------------------------------------------------------------------

const SCREENSHOTS_BUCKET = "support-screenshots";
const SCREENSHOT_SIGNED_URL_TTL_SECONDS = 300;

export interface TicketWithNotes {
  id: string;
  intent: TicketIntent;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  screenshotUrl: string | null;
  status: TicketStatus;
  notifyFailed: boolean;
  createdAt: string;
  firstStatusTransitionAt: string | null;
  notes: Array<{ id: string; noteText: string; adminId: string | null; createdAt: string }>;
}

/**
 * Đọc TOÀN BỘ hộp thư — batched: 1 select support_tickets + 1 select
 * support_ticket_notes (where ticket_id in [...ids]), gộp trong JS. Mirror
 * listReportedExams's shape: KHÔNG join PostgREST, KHÔNG round trip theo
 * từng dòng. Screenshot ký URL ngắn hạn (~300s) mỗi ticket có screenshot_path
 * — bucket private, không policy select nào cho authenticated (AC-013), nên
 * chỉ service_role tạo được signed URL.
 */
export async function listSupportTickets(): Promise<TicketWithNotes[]> {
  const admin = serviceRoleClient();

  const { data: tickets, error: ticketsErr } = await admin
    .from("support_tickets")
    .select(
      "id, intent, message, page_url, user_agent, screen_width, screen_height, screenshot_path, status, notify_failed, created_at, first_status_transition_at"
    )
    .order("created_at", { ascending: false });
  if (ticketsErr) throw ticketsErr;

  const rows = (tickets ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);
  const { data: notes, error: notesErr } = await admin
    .from("support_ticket_notes")
    .select("id, ticket_id, note_text, admin_id, created_at")
    .in("ticket_id", ids)
    .order("created_at", { ascending: true });
  if (notesErr) throw notesErr;

  const notesByTicket = new Map<string, TicketWithNotes["notes"]>();
  for (const n of (notes ?? []) as Array<Record<string, unknown>>) {
    const ticketId = n.ticket_id as string;
    const list = notesByTicket.get(ticketId) ?? [];
    list.push({
      id: n.id as string,
      noteText: n.note_text as string,
      adminId: (n.admin_id as string | null) ?? null,
      createdAt: n.created_at as string,
    });
    notesByTicket.set(ticketId, list);
  }

  const withUrls = await Promise.all(
    rows.map(async (r) => {
      const screenshotPath = r.screenshot_path as string | null;
      let screenshotUrl: string | null = null;
      if (screenshotPath) {
        const { data } = await admin.storage
          .from(SCREENSHOTS_BUCKET)
          .createSignedUrl(screenshotPath, SCREENSHOT_SIGNED_URL_TTL_SECONDS);
        screenshotUrl = data?.signedUrl ?? null;
      }
      const ticket: TicketWithNotes = {
        id: r.id as string,
        intent: r.intent as TicketIntent,
        message: r.message as string,
        pageUrl: (r.page_url as string | null) ?? null,
        userAgent: (r.user_agent as string | null) ?? null,
        screenWidth: (r.screen_width as number | null) ?? null,
        screenHeight: (r.screen_height as number | null) ?? null,
        screenshotUrl,
        status: r.status as TicketStatus,
        notifyFailed: r.notify_failed as boolean,
        createdAt: r.created_at as string,
        firstStatusTransitionAt: (r.first_status_transition_at as string | null) ?? null,
        notes: notesByTicket.get(r.id as string) ?? [],
      };
      return ticket;
    })
  );

  return withUrls;
}

/**
 * Đổi status — LUÔN qua .rpc(), KHÔNG BAO GIỜ .from().update() (D002 v1.2
 * fix): chỉ hàm SQL change_support_ticket_status mới biểu đạt được CASE
 * atomic "chỉ stamp first_status_transition_at ở lần chuyển ĐẦU TIÊN khỏi
 * 'new'" (AC-047) — .update() không thể diễn tả điều kiện có-điều-kiện đó
 * trong một câu lệnh mà không đọc-rồi-ghi (race).
 */
export async function changeSupportTicketStatus(
  ticketId: string,
  nextStatus: TicketStatus
): Promise<{ status: TicketStatus; firstStatusTransitionAt: string | null } | { error: { message: string } }> {
  const { data, error } = await serviceRoleClient().rpc("change_support_ticket_status", {
    p_ticket_id: ticketId,
    p_status: nextStatus,
  });
  if (error) return { error: { message: error.message } };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { status: string; first_status_transition_at: string | null }
    | undefined;
  if (!row) return { error: { message: "change_support_ticket_status: không tìm thấy ticket" } };

  return {
    status: row.status as TicketStatus,
    firstStatusTransitionAt: row.first_status_transition_at,
  };
}

/**
 * Ghi 1 ghi chú nội bộ — ĐƯỜNG DUY NHẤT ghi được vào support_ticket_notes:
 * RLS revoke all cho authenticated (schema.sql §17, AC-048), nên chỉ
 * service_role còn quyền INSERT. `adminId` do CALLER (Server Action) tự suy
 * ra từ auth.uid() của chính phiên đăng nhập rồi truyền vào — hàm này không
 * tự xác thực ai đang gọi (module-boundary precondition, xem đầu khối).
 */
export async function addSupportTicketNote(
  ticketId: string,
  adminId: string,
  noteText: string
): Promise<{ error: { message: string } | null }> {
  const { error } = await serviceRoleClient().from("support_ticket_notes").insert({
    ticket_id: ticketId,
    admin_id: adminId,
    note_text: noteText,
  });
  return { error: error ? { message: error.message } : null };
}
