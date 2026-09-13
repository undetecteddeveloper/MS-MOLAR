// Engine 1 — Server Action của gia sư Socratic: GỢI Ý KHI ĐANG LÀM BÀI.
//
// 2026-09-13 (engineer, test trên điện thoại thật): "người ta cần gợi ý lúc
// đang bí — tức lúc làm bài — chứ không phải lúc đã làm xong". Trước đó action
// này là `explainStep()` ở trang Chi tiết kết quả, chỉ mở cho câu đã sai ở HAI
// lượt làm bài khác nhau (backend DD § explainStep(), AC-021). Cổng "sai hai
// lần" bỏ hẳn cùng lượt đọc lịch sử `exam_results`; thay bằng cổng "lượt làm
// bài CỦA MÌNH, ĐANG MỞ, và câu thuộc đề của lượt ấy". Câu tự luận nay ĐƯỢC kèm
// (prompt.ts nới union) — lý do loại trừ cũ (cổng "sai hai lần" cần vị từ nhị
// phân `isCorrect`) không còn khi không còn cổng ấy. Mọi thứ khác giữ nguyên:
// rate limit, hạn mức kỳ, bộ cột an toàn, telemetry, bốn mã lỗi đóng.
//
// Tách khỏi actions.ts CỐ Ý: file này là cửa duy nhất mở đường tới Gemini bằng
// phiên của học sinh, nên mọi thứ canh cửa (sở hữu attempt, trạng thái, rate
// limit, hạn mức, telemetry) nằm gọn trong một file đọc hết được một lượt, thay
// vì lẫn vào giữa luồng nộp bài.
//
// QUY ƯỚC LỖI: typed-result (`{error: "..."}`), KHÔNG throw, KHÔNG redirect —
// theo tiền lệ rateExam() (actions.ts) chứ không theo submitExam(): người gọi
// là một affordance nằm giữa thẻ câu hỏi đang làm, ném lỗi ở đây sẽ đánh sập
// cả màn làm bài vì một gợi ý không lấy được. Chi tiết lỗi thật chỉ đi ra
// console phía máy chủ; client luôn chỉ nhận đúng 4 mã đóng.
//
// ⏱ HẠN CHÓT vs. TRẦN THỜI GIAN CỦA NỀN TẢNG: `maxDuration` là cấu hình của
// ROUTE SEGMENT và với Server Action thì phải đặt Ở TRANG gọi nó (tài liệu
// Next.js 16 trong repo, route-segment-config/maxDuration.md). Trang mount
// affordance nay là màn làm bài — app/(exams)/exams/[id]/attempt/[attemptId]/
// page.tsx đã `export const maxDuration = 300`, bao trùm
// `TUTOR_CALL_DEADLINE_MS = 30_000` với biên 10×.
"use server";

import { consumeQuota } from "@/lib/billing/quota";
import { QUOTA_REFUSAL_TELEMETRY_CODE } from "@/lib/billing/quotaTelemetry";
import { readEntitlement } from "@/lib/billing/readEntitlement";
import { guard } from "@/lib/security/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { generateHint, TutorCallError } from "@/lib/tutor/callTutor";
import type { TutorPromptInput } from "@/lib/tutor/prompt";
import { buildTelemetryPayload, type TelemetryErrorCode } from "@/lib/tutor/telemetry";
import { GEMINI_CALLS_PER_OPERATION } from "@/lib/ugc/gemini";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Bốn mã đóng (backend DD § explainStep() Output — hợp đồng với UI không đổi
 *  khi action đổi cổng). CỐ Ý viết lại thành literal thay vì alias
 *  `TelemetryErrorCode`: đây là hợp đồng với UI, còn kia là CHECK constraint
 *  `telemetry_log_error_code_check` — hai chủ sở hữu khác nhau. Hai tập trùng
 *  nhau hôm nay, và chính lệnh ghi telemetry ở dưới là chỗ tsc bắt được nếu ai
 *  thêm mã thứ 5 chỉ ở một bên. */
export type TutorHintError = "not_eligible" | "rate_limited" | "gemini_unavailable" | "server";

export type TutorHintResult = { hint: string } | { error: TutorHintError };

/** Đúng bộ cột AN TOÀN cần cho prompt. `correct_answer`/`sub_answers`/
 *  `essay_answer` không có ở đây, và cũng không thể có: §10c đã REVOKE chúng
 *  khỏi role `authenticated` mà Server Action này chạy bằng. `skill_node_id`
 *  cũng KHÔNG đọc — gia sư cần nội dung câu hỏi, không cần nhãn kỹ năng (AC-029),
 *  và bất biến của sprint là cột đó không vượt ranh giới SQL sang tầng TS. */
const TUTOR_QUESTION_COLUMNS = "content, question_type, choices";

/** Một ý/lựa chọn như cột `choices` lưu — với true_false thì chính cột này chứa
 *  các ý a–d (quy ước v2.1, xem queries.ts). */
type LabelledOptionRow = { id: string; text: string };

const TUTOR_QUESTION_TYPES = ["mcq", "true_false", "short_answer", "essay"] as const;
type TutorQuestionType = (typeof TUTOR_QUESTION_TYPES)[number];

function isTutorQuestionType(value: string): value is TutorQuestionType {
  return (TUTOR_QUESTION_TYPES as readonly string[]).includes(value);
}

/**
 * Ghi nhận MỘT lượt gọi gia sư vào `telemetry_log` — best-effort tuyệt đối:
 * mọi lối thoát của hàm này đều không đổi kết quả trả cho người dùng (backend DD
 * § explainStep() Invariants).
 *
 * `userId` KHÔNG BAO GIỜ null ở call site này, dù `TelemetryEvent` cho phép:
 * policy `telemetry_insert_own` của `telemetry_log` là `with check (user_id =
 * auth.uid())`, nên một dòng user_id NULL sẽ bị RLS từ chối thẳng — ghi vào đó
 * là mất dòng chứ không phải "mất danh tính". Giá trị truyền vào luôn lấy từ
 * dòng `exam_attempts` đã qua RLS, tức đúng bằng `auth.uid()`. Những lối thoát
 * KHÔNG có userId (không tìm thấy attempt / đọc attempt hỏng) vì thế không ghi
 * gì cả — chúng cũng không phải một lượt gọi gia sư để mà đếm.
 */
async function recordTutorInvoke(
  supabase: SupabaseClient,
  event: { userId: string; questionId: string; success: boolean; errorCode?: TelemetryErrorCode }
): Promise<void> {
  try {
    const { error } = await supabase.from("telemetry_log").insert(
      buildTelemetryPayload({
        eventType: "tutor_invoke",
        userId: event.userId,
        questionId: event.questionId,
        success: event.success,
        errorCode: event.errorCode ?? null,
      })
    );
    if (error) console.warn("[hintDuringAttempt] telemetry_log:", error.code, error.message);
  } catch (err) {
    // Một lệnh ghi quan sát không bao giờ được trở thành điểm hỏng thứ hai của
    // luồng học sinh đang chờ (backend DD cấm tường minh).
    console.warn("[hintDuringAttempt] telemetry_log ném lỗi:", (err as Error)?.name);
  }
}

/**
 * Gợi ý Socratic cho MỘT câu trong lượt làm bài ĐANG MỞ của chính người gọi.
 *
 * @param attemptId lượt làm bài đang làm — thứ tự tham số là (attemptId,
 *   questionId, draftAnswer); hai id đều là string nên hoán vị sẽ biên dịch
 *   trót lọt, phía gọi có test riêng khoá đúng thứ tự này.
 * @param draftAnswer bài làm HIỆN TẠI của câu này trên client (chưa nộp nên
 *   không có ở DB) — chuỗi tự do, cắt trong buildTutorPrompt(). Giá trị không
 *   phải string (payload tự soạn) coi như rỗng.
 * @returns `{hint}` hoặc đúng một trong bốn mã lỗi có kiểu. Không bao giờ throw.
 *
 * THỨ TỰ CÁC CỔNG (và vì sao):
 *   1. Sở hữu + trạng thái — đọc `exam_attempts` qua RLS; dòng đọc được cũng
 *      chính là nguồn `userId`/`examId` cho các bước sau (không tốn thêm một
 *      round-trip `auth.getUser()`). Lượt đã nộp thì không còn "đang bí":
 *      `not_eligible` — trang kết quả không có cửa nào gọi tới đây nữa.
 *   2. Rate limit — TRƯỚC mọi thứ tốn kém, và bắt buộc trước mọi thứ chạm
 *      Gemini (AC-022). Khoá `explainStep` của RATE_LIMITS giữ tên cũ: đổi tên
 *      một khoá đếm đang chạy là reset ngầm bộ đếm của mọi người.
 *   3. Hạn mức kỳ + ngân sách ngày — cổng chi phí thứ hai, cũng đứng trước mọi
 *      thứ tốn kém. Bị từ chối thì client nhận `not_eligible`, còn LÝ DO thật
 *      chỉ đi vào `telemetry_log.error_code`.
 *   4. Câu thuộc đề của lượt — đọc `exams.question_ids`; một questionId tự soạn
 *      không kéo được gợi ý cho câu của đề khác (kể cả đề chưa xuất bản).
 *   5. Đọc câu hỏi bằng client thường (không phải claim_attempt_answer_key/
 *      exam_answer_key) → không thể nhận về đáp án.
 *   6. Gọi Gemini, rồi ghi telemetry cho MỌI lối thoát có danh tính người dùng.
 */
export async function hintDuringAttempt(
  attemptId: string,
  questionId: string,
  draftAnswer: string
): Promise<TutorHintResult> {
  const supabase = await createClient();

  // 1. Sở hữu + trạng thái. RLS `attempts_select_own` lọc về lượt của chính
  //    người gọi, nên không tìm thấy = không tồn tại HOẶC không phải của mình —
  //    hai ca này cố ý không phân biệt được từ phía client.
  const { data: attempt, error: attemptErr } = await supabase
    .from("exam_attempts")
    .select("user_id, exam_id, status")
    .eq("id", attemptId)
    .maybeSingle();
  if (attemptErr) {
    console.error("[hintDuringAttempt] đọc attempt thất bại:", attemptErr.code, attemptErr.message);
    return { error: "server" };
  }
  if (!attempt) return { error: "not_eligible" };
  const { user_id: userId, exam_id: examId, status } = attempt as {
    user_id: string;
    exam_id: string;
    status: string;
  };
  if (status !== "in_progress") {
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "not_eligible" });
    return { error: "not_eligible" };
  }

  // 2. Rate limit (AC-022) — cổng chi phí, luôn đứng trước Gemini.
  const rl = await guard("explainStep", userId);
  if (!rl.ok) {
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "rate_limited" });
    return { error: "rate_limited" };
  }

  // 3. Hạn mức kỳ + ngân sách ngày (I2 — AC-014/AC-015/AC-022/AC-023/AC-024).
  //    ĐỨNG SAU rate limit, cố ý: `consumeQuota()` INCR rồi mới so, nên gọi nó
  //    cho một lượt đã bị chặn là tính phí một suất cho một lượt không bao giờ
  //    chạm tới Gemini. Và đứng TRƯỚC mọi thứ tốn kém còn lại.
  //
  //    HAI MÃ, và chỉ một trong hai ra tới client: client nhận `not_eligible`
  //    (UI Spec UI-D3 — bốn mã render ra ĐÚNG MỘT câu; người dùng biết mình hết
  //    lượt TRƯỚC KHI BẤM, suy từ quyền lợi, C-05), còn `telemetry_log.error_code`
  //    nhận mã PHÂN BIỆT — chỗ DUY NHẤT sự phân biệt tồn tại (AC-047).
  const ent = await readEntitlement(userId);
  const consumed = await consumeQuota("tutor", userId, ent, GEMINI_CALLS_PER_OPERATION.tutor);
  if (!consumed.ok) {
    await recordTutorInvoke(supabase, {
      userId,
      questionId,
      success: false,
      errorCode: QUOTA_REFUSAL_TELEMETRY_CODE[consumed.reason],
    });
    return { error: "not_eligible" };
  }

  // 4. Câu phải thuộc đề của lượt này.
  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .select("question_ids")
    .eq("id", examId)
    .maybeSingle();
  if (examErr) {
    console.error("[hintDuringAttempt] đọc đề thất bại:", examErr.code, examErr.message);
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "server" });
    return { error: "server" };
  }
  const questionIds = (examRow as { question_ids: string[] | null } | null)?.question_ids ?? [];
  if (!questionIds.includes(questionId)) {
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "not_eligible" });
    return { error: "not_eligible" };
  }

  // 5. Nội dung câu hỏi — chỉ cột an toàn.
  const { data: question, error: questionErr } = await supabase
    .from("questions")
    .select(TUTOR_QUESTION_COLUMNS)
    .eq("id", questionId)
    .maybeSingle();
  if (questionErr) {
    console.error("[hintDuringAttempt] đọc câu hỏi thất bại:", questionErr.code, questionErr.message);
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "server" });
    return { error: "server" };
  }
  const questionRow = question as {
    content: string;
    question_type: string | null;
    choices: LabelledOptionRow[] | null;
  } | null;
  // Câu đã biến mất (bị xoá giữa chừng) hoặc mang một dạng lạ ngoài bốn dạng
  // prompt biết đọc: không có gì để kèm chứ không phải ta hỏng. Fail-closed.
  const questionType = questionRow?.question_type ?? "mcq";
  if (!questionRow || !isTutorQuestionType(questionType)) {
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "not_eligible" });
    return { error: "not_eligible" };
  }

  // 6. Gọi Gemini. KHÔNG gọi buildTutorPrompt() ở đây: generateHint() đã dựng
  //    prompt bên trong (callTutor.ts), gọi lần nữa là dựng hai lần cùng một
  //    chuỗi và mở đường cho hai bản prompt trôi lệch nhau.
  const options = questionRow.choices ?? [];
  const isTrueFalse = questionType === "true_false";
  const promptInput: TutorPromptInput = {
    questionContent: questionRow.content,
    questionType,
    choices: isTrueFalse ? undefined : options,
    // v2.1: các ý a–d của true_false nằm CÙNG cột `choices` (queries.ts).
    subItems: isTrueFalse ? options : undefined,
    // Bản nháp từ client, chưa có ở DB. Không phải string ⇒ rỗng; phép cắt 500
    // ký tự nằm trong buildTutorPrompt(), không ở đây.
    studentAnswer: typeof draftAnswer === "string" ? draftAnswer : "",
  };

  try {
    const hint = await generateHint(promptInput);
    await recordTutorInvoke(supabase, { userId, questionId, success: true });
    return { hint };
  } catch (err) {
    // generateHint() đã phân loại sẵn thất bại của nó thành mã của
    // `telemetry_log.error_code` và đã logTutorExit() kèm metadata; ở đây chỉ
    // chuyển thẳng, không có bảng ánh xạ thứ hai. Lỗi KHÔNG phải TutorCallError
    // = bug phía ta → "server"; chỉ log tên lỗi, không log message (message có
    // thể vọng lại nội dung câu hỏi UGC).
    const code: TutorHintError = err instanceof TutorCallError ? err.code : "server";
    if (!(err instanceof TutorCallError)) {
      console.error("[hintDuringAttempt] generateHint ném lỗi ngoài dự kiến:", (err as Error)?.name);
    }
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: code });
    return { error: code };
  }
}
