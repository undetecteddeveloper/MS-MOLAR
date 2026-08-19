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
// Hình dạng dòng, khai MỘT chỗ (`lib/billing/checkoutOrder.ts`, plan Task 3.3).
// `import type` nên bị xoá sạch lúc biên dịch — không có phụ thuộc runtime nào
// từ tầng hạ tầng lên tầng billing.
import type { PaymentOrderRow } from "@/lib/billing/checkoutOrder";

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
 * Cộng dồn mastery theo kỹ năng cho một attempt ĐÃ NỘP (ADR-0011, schema.sql
 * khối "MASTERY WRITE" — schema.sql KHÔNG có mục §18 nào).
 *
 * Anh em ruột của recordExamResult() ở trên, và CỐ Ý là một hàm RIÊNG chứ không
 * phải một tham số thêm của nó: gộp hai việc vào một câu lệnh SQL sẽ khiến một
 * lỗi bên mastery kéo rollback luôn dòng điểm — trong khi NFR nói rõ mastery
 * hỏng KHÔNG được làm hỏng việc nộp bài. Hai lời gọi, hai đường xử lý lỗi.
 *
 * KHÔNG nhận userId (record_skill_mastery() suy ra từ attempt + đòi 'submitted',
 * khối MASTERY WRITE) và KHÔNG nhận skill_node_id: việc tra kỹ năng nằm trong
 * SQL (join questions.skill_node_id), nên tầng TS không có, và không cần có, khái niệm
 * "kỹ năng" nào ở đây.
 *
 * `score.perQuestion` truyền THẲNG, không nắn lại: khối đó đọc từng phần tử bằng
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

// ---------------------------------------------------------------------------
// SUBSCRIPTION — đường gia hạn entitlement (ADR-0014, schema.sql khối
// "SUBSCRIPTION — record_payment_settlement()")
//
// Hai thao tác hẹp, và chỉ hai, phục vụ `lib/billing/settleOrder.ts`: đọc dòng
// đơn để có thứ đem so, rồi gọi hàm SQL gia hạn. KHÔNG thao tác nào nhận user
// id — danh tính suy ra TRONG SQL từ chính dòng đơn (ADR-0014 Decision 3), y
// như record_exam_result() suy từ attempt.
// ---------------------------------------------------------------------------

/**
 * Đọc dòng `payment_orders` cho một lượt đối soát — CỐ Ý KHÔNG lọc theo chủ sở
 * hữu, và cái tên nói ra điều đó.
 *
 * `settleOrder()` có HAI trigger và một trong hai — webhook — không có phiên
 * đăng nhập nào (ADR-0014 Decision 1). Một vị từ `user_id` ở đây sẽ phá đúng
 * trigger đó. Việc kiểm chủ sở hữu nằm một tầng trên, trong `recheckOrder()`,
 * bằng client THEO PHIÊN dưới `orders_select_own` (backend DD § recheckOrder()
 * — ownership scoping, FE-B-02).
 *
 * Vì thế "ForSettlement" nằm trong tên: đây là một đường đọc bypass RLS. Dùng
 * lại nó ở một Server Action sẽ biến `recheckOrder` thành máy dò order_code —
 * đúng thứ FE-B-02 đóng lại.
 *
 * Trả về ĐÚNG hai cột: `status` (cổng 'pending' của bước 1) và `amount` (thứ
 * bước 3 đem so với số nhà cung cấp báo). KHÔNG đọc `user_id`: tầng TS không
 * có, và không cần có, khái niệm "người thụ hưởng".
 *
 * `status` để kiểu `string` chứ không phải union: literal hợp lệ do CHECK trong
 * schema quyết định, và một dòng mang literal ngoài dự kiến phải rơi vào nhánh
 * "không phải pending" chứ không phải làm hỏng phép ép kiểu.
 */
export async function readPaymentOrderForSettlement(
  orderCode: number
): Promise<{ status: string; amount: number } | null> {
  const { data, error } = await serviceRoleClient()
    .from("payment_orders")
    .select("status, amount")
    .eq("order_code", orderCode)
    .maybeSingle();
  // Ném, không nuốt: một sự cố đọc KHÔNG phải một trong năm lý do từ chối của
  // `SettleResult`. Biến nó thành `unknown_order` là nói với người đã trả tiền
  // rằng đơn của họ không tồn tại. Tiền lệ listReportedExams().
  if (error) throw error;
  if (!data) return null;

  const row = data as { status: string; amount: number };
  return { status: row.status, amount: row.amount };
}

/**
 * Gia hạn entitlement cho một đơn ĐÃ ĐƯỢC XÁC MINH — đường DUY NHẤT trong repo
 * ghi được vào `subscriptions` (ADR-0014 Decision 1).
 *
 * KHÔNG nhận userId, KHÔNG nhận số tiền, KHÔNG nhận trạng thái. Chỉ một
 * `orderCode`, và hàm SQL tự suy người thụ hưởng từ dòng đơn rồi tự cưỡng chế
 * cổng `status = 'pending'`. Nghĩa là kể cả khi hàm này bị gọi sai ở đâu đó
 * trong tương lai, nó vẫn không cấp được quyền cho người khác hay cho một đơn
 * chưa được xác minh — luật nằm trong DB, không nằm ở call site.
 *
 * KHÔNG truyền `p_period_days`: hàm SQL khai `default 30` ngay cạnh phép cộng
 * dùng nó, nên độ dài kỳ có ĐÚNG MỘT lời khai. Gõ lại 30 ở đây là dựng cái đồng
 * hồ thứ hai mà ADR-0013 đã một lần cấm cho cửa sổ đơn chờ.
 *
 * `expiresAt === null` KHÔNG phải lỗi: `update … where status='pending'` không
 * khớp dòng nào, tức một trigger khác đã settle xong trước (AC-031). Người gọi
 * đọc nó thành `not_pending`.
 *
 * Lỗi TRẢ VỀ chứ không ném — I6 khai `{ expiresAt } | { error }` — nhưng người
 * gọi có nghĩa vụ LAN nó ra: nhánh `raise exception` không-người-thụ-hưởng là
 * một dòng đã 'paid' mà không ai được cấp quyền, đúng trạng thái cần một con
 * người đối soát bằng tay (D10). Nuốt nó là xoá dấu vết duy nhất của ca đó.
 */
export async function recordPaymentSettlement(
  orderCode: number
): Promise<{ expiresAt: string | null } | { error: { code?: string; message: string } }> {
  const { data, error } = await serviceRoleClient().rpc("record_payment_settlement", {
    p_order_code: orderCode,
  });
  if (error) return { error: { code: error.code, message: error.message } };
  if (data === null || data === undefined) return { expiresAt: null };

  // MỘT hợp đồng, MỘT dạng chuỗi. PostgREST serialize timestamptz ra dạng
  // `+00:00`, `toISOString()` ra dạng `…Z` — cùng một thời điểm, hai chuỗi khác
  // nhau, và chuỗi mới là thứ C-10 đem hiển thị. Chuẩn hoá tại đúng chỗ giá trị
  // rời DB, cùng luật CL-01 đặt cho `pendingUntil`.
  return { expiresAt: new Date(data as string).toISOString() };
}

/** Tám cột của `PaymentOrderRow` — ĐÚNG những cột hợp đồng `CheckoutOrder` cần,
 *  không phải cả mười một cột của bảng.
 *
 *  MỘT lời khai cho HAI chỗ đọc hình dạng ấy: câu đọc-lại của lệnh insert ngay
 *  dưới đây, và bước (0) của `createOrder()` (`lib/billing/orderActions.ts`),
 *  chạy bằng client THEO PHIÊN. Viết ra hai lần là cách chắc chắn nhất để một
 *  đường trả về bảy trường còn đường kia trả về tám mà không ai thấy — đúng loại
 *  lệch mà `toCheckoutOrder()` được dựng lên để chặn.
 *
 *  `user_id`, `created_at` và `settled_at` cố ý VẮNG MẶT: chúng không đi vào
 *  C-13, nên khai chúng ở đây chỉ tạo thêm thứ để trôi lệch (cùng lý lẽ với
 *  `readPaymentOrderForSettlement()` chỉ đọc hai cột). */
export const PAYMENT_ORDER_CHECKOUT_COLUMNS =
  "order_code, amount, status, pending_until, qr_payload, account_number, account_name, memo";

/**
 * Ghi MỘT dòng `payment_orders` và trả lại chính dòng vừa ghi.
 *
 * Đường DUY NHẤT trong repo tạo được một đơn: `revoke insert, update, delete on
 * public.payment_orders from anon, authenticated` (schema.sql) đóng hẳn lối ghi
 * từ client, nên lượt ghi phải mang danh tính khác (backend DD § "Who writes the
 * row").
 *
 * KHÁC `recordPaymentSettlement()`, hàm này KHÔNG đi qua một hàm SQL, và điều đó
 * là cố ý: nó không cấp cho ai cái gì. Dòng nó viết ra là một chứng từ trơ cho
 * tới khi `record_payment_settlement()` giành lấy — nên không có luật nào cần
 * cưỡng chế trong DB, và thêm một hàm SECURITY DEFINER thứ hai chỉ để chạy một
 * câu INSERT là mở rộng bề mặt đặc quyền mà không đổi lấy được gì.
 *
 * `userId` do NGƯỜI GỌI suy ra từ phiên đăng nhập của chính lời gọi ấy
 * (`createOrder()` đọc nó từ `auth.getUser()`), không bao giờ từ một tham số của
 * client — cùng luật ADR-0010/0011 đặt cho danh tính. Đây là điểm khác biệt so
 * với `recordExamResult()`/`recordPaymentSettlement()`, và lý do khác biệt ấy
 * chấp nhận được: hai hàm kia CẤP thứ gì đó nên phải tự suy chủ nhân trong SQL,
 * còn hàm này chỉ ghi một dòng chờ.
 *
 * `pendingUntil` là mốc NHÀ CUNG CẤP vừa trả về, chuyển thẳng xuống. Hàm này
 * không biết cửa sổ đơn chờ dài bao nhiêu và không được phép biết: ADR-0013
 * § Implementation Guidance đòi đúng MỘT hằng nuôi cả `expiredAt` lẫn
 * `pending_until`, nên mọi phép tính hạn chót nằm ở adapter, một chỗ.
 *
 * Lỗi TRẢ VỀ chứ không ném, cùng hình dạng `recordPaymentSettlement()` dùng:
 * `createOrder()` phải dịch nó thành một giá trị từ chối cho màn hình, không
 * phải một exception băng qua biên Server Action.
 */
export async function recordPaymentOrder(order: {
  orderCode: number;
  userId: string;
  amountVnd: number;
  pendingUntil: string;
  qrPayload: string;
  accountNumber: string;
  accountName: string;
  memo: string;
}): Promise<{ row: PaymentOrderRow } | { error: { code?: string; message: string } }> {
  const { data, error } = await serviceRoleClient()
    .from("payment_orders")
    .insert({
      order_code: order.orderCode,
      user_id: order.userId,
      amount: order.amountVnd,
      pending_until: order.pendingUntil,
      qr_payload: order.qrPayload,
      account_number: order.accountNumber,
      account_name: order.accountName,
      memo: order.memo,
    })
    // Đọc lại NGAY trong câu ghi: `status` và `created_at` do DEFAULT của bảng
    // đặt, nên dựng giá trị trả về từ tham số đầu vào sẽ là đoán mò về thứ CSDL
    // thực sự đã lưu. Một lượt đọc riêng thì tốn thêm một vòng và mở ra một cửa
    // sổ để dòng đổi giữa chừng.
    .select(PAYMENT_ORDER_CHECKOUT_COLUMNS)
    .single();
  if (error) return { error: { code: error.code, message: error.message } };
  return { row: data as unknown as PaymentOrderRow };
}
