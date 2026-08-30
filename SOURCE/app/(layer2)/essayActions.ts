// Chấm lại tự luận (ADR-0018) — Server Action do HỌC SINH bấm.
//
// Tách khỏi `actions.ts` CỐ Ý, cùng lý do `tutorActions.ts:1-6` đã ghi: file này
// là cửa thứ hai mở đường tới một nhà cung cấp AI bằng phiên của học sinh, nên
// mọi thứ canh cửa (sở hữu attempt, trạng thái câu, trần lượt, rate limit, cờ
// tính năng, telemetry) nằm gọn trong MỘT file đọc hết được một lượt thay vì
// lẫn vào giữa luồng nộp bài.
//
// ═══ QUY ƯỚC LỖI: typed-result, KHÔNG throw, KHÔNG redirect ═══
//
// Theo tiền lệ `rateExam()`/`explainStep()` (`tutorActions.ts:8-12`): người gọi
// là một affordance nằm giữa trang Chi tiết ĐÃ render xong. Ném ở đây sẽ đánh
// sập cả trang vì một nút phụ. Client luôn chỉ nhận đúng NĂM mã đóng.
//
// ═══ THỨ TỰ SÁU BƯỚC — UỶ QUYỀN TRƯỚC ĐO ĐẾM (AC-072) ═══
//
//   1. rate limit theo user        2. đọc attempt (RLS)      3. đọc kết quả + suy trạng thái
//   4. CLAIM (service_role)        5. đặt chỗ ngân sách      6. gọi provider, settle
//
// Bước 1-3 chạy bằng client CỦA HỌC SINH; bước 4-6 bằng `service_role`. Ranh
// giới ấy là chỗ DUY NHẤT trong hàm mà đặc quyền được nâng lên, và nó nằm SAU
// toàn bộ phần kiểm tra.
//
// BƯỚC 3 VÀ BƯỚC 4 TRÙNG LẶP CÓ CHỦ Ý. Bước 3 là một PHÉP KIỂM TRA ĐỌC, tồn tại
// để chọn được ĐÚNG CÂU TỪ CHỐI cho học sinh; bước 4 là CƯỠNG CHẾ trong SQL, tồn
// tại để một call site sai vẫn không ghi được gì. Bỏ bước 3 thì mọi từ chối đều
// thành một câu chung chung; bỏ bước 4 thì luật nằm ở call site — đúng điều
// ADR-0010 đã bác bỏ.
//
// ═══ VÌ SAO KHÔNG GỌI `gradeEssaysForAttempt()` ═══
//
// Nó điều phối NHIỀU câu dưới một trần đồng thời và một trần đồng hồ, NUỐT mọi
// kết cục và trả `void`. Đường chấm lại cần đúng ngược lại: MỘT câu, và một KẾT
// CỤC CÓ KIỂU để trả về màn hình. Thứ được dùng chung là bốn primitive bên dưới
// (claim, budget, provider, settle) — cùng bốn module, cùng một thứ tự — và
// chính thứ tự ấy được ghim lại bằng `mock.invocationCallOrder` ở CẢ HAI lối
// vào, vì đảo nó ở lối nào cũng mở ra cùng một lỗ hổng.
//
// ═══ QUY TẮC LOG: KHÔNG BAO GIỜ MỘT THÔNG ĐIỆP (AC-056) ═══
//
// Đúng pattern `RecheckOrderControl.tsx:181-184`. Cấm log `err` nguyên vẹn:
// thông điệp lỗi Postgres đi qua biên này CÓ THỂ vọng lại nội dung bài làm, và
// `Error#message` KHÔNG enumerable nên một lượt rò kiểu đó không lộ ra dưới
// `JSON.stringify` — nó chỉ lộ ra ở console thật, tức là muộn.
//
// Cái được phép log là ba thứ, và cả ba đều KHÔNG THỂ mang văn bản tự do:
// `digest` (`logDigest()`), một SQLSTATE (`error.code`), và tên lớp lỗi
// (`Error#name`). Cái bị cấm là `message`, `details`, `hint`, prompt, response
// thô, và bài làm.
//
// *(Sửa nhãn 2026-08-30, Final §4.) Tiêu đề cũ ghi "CHỈ `digest`", nhưng hai
// chỗ log ở `recordRetryTelemetry()` ghi `error.code` và `Error#name` — cả hai
// đều an toàn, nên đây là bản mô tả sai chứ không phải mã sai. Vẫn phải sửa:
// một quy tắc nói quá lên là quy tắc người sau đọc rồi thấy mã vi phạm ngay
// dòng dưới, và từ đó thôi tin cả quy tắc. Cách phát biểu mới nêu đúng cái bất
// biến đang thực sự được giữ — không có THÔNG ĐIỆP nào bị log — và nó bao đúng
// cả ba chỗ.*

"use server";

import { ESSAY_GRADER_MODEL } from "@/lib/ai/models";
import { reserveGroqBudget } from "@/lib/essay/budget";
import { GROQ_CALLS_PER_ESSAY, groqChatCompletion } from "@/lib/essay/groqClient";
import { parseGrade } from "@/lib/essay/parseGrade";
import { buildEssayPrompt } from "@/lib/essay/prompt";
import { guard } from "@/lib/security/rateLimit";
import { deriveEssayView, ESSAY_MAX_POINTS } from "@/lib/scoring/essayLifecycle";
import { createClient } from "@/lib/supabase/server";
import { claimEssayGradingAttempt, recordEssayGrade } from "@/lib/supabase/service-role";
import { buildTelemetryPayload, type TelemetryErrorCode } from "@/lib/tutor/telemetry";
import type { PerQuestionResult } from "@/types/result";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** NĂM mã đóng của backend DD § essayActions Output.
 *
 *  CỐ Ý viết lại thành literal thay vì alias một kiểu telemetry — đây là hợp
 *  đồng với UI (`EssayRegradeControl` ánh xạ qua `Record<RetryRefusal, …>`),
 *  còn kia là CHECK constraint của database. Hai chủ sở hữu khác nhau. */
export type RetryRefusal = "not_found" | "not_failed" | "exhausted" | "budget" | "server";

export type RetryResult = { ok: true } | { ok: false; reason: RetryRefusal };

/** Ánh xạ `ClaimReason` (SQL) → `RetryRefusal` (UI). `Record` chứ không `switch`
 *  có `default`: thêm một lý do SQL là một lỗi BIÊN DỊCH ở đây, không phải một
 *  nhánh im lặng rơi vào câu chữ của lý do khác.
 *
 *  `already_graded` → `not_failed` là ca đáng đọc kỹ nhất, và nó KHÔNG phải một
 *  lỗi: dưới AC-063, một lượt chấm lại trên câu đã có band là kết cục BÌNH
 *  THƯỜNG của cuộc đua mà bộ poll thắng trong lúc học sinh đang bấm. UI nói
 *  "Câu này đã có điểm rồi." chứ không nói một câu thất bại. */
const CLAIM_REFUSAL: Record<string, RetryRefusal> = {
  not_submitted: "not_found",
  no_element: "not_found",
  already_graded: "not_failed",
  bad_state: "not_failed",
  exhausted: "exhausted",
};

function logDigest(stage: string, err: unknown) {
  console.error("[retryEssayGrading]", {
    stage,
    digest: (err as { digest?: string } | null)?.digest,
  });
}

/**
 * Ghi MỘT dòng `telemetry_log` cho MỘT lượt chấm lại — best-effort tuyệt đối.
 *
 * Qua client CỦA HỌC SINH: `telemetry_insert_own` là
 * `with check (user_id = auth.uid())`, nên một lượt ghi `service_role` với
 * `user_id` null bị từ chối thẳng.
 *
 * Những lối thoát CHƯA có `userId` (cờ tắt, không tìm thấy attempt, đọc attempt
 * hỏng) KHÔNG ghi gì cả — cùng quy ước `recordTutorInvoke()` đã ghi ra thành
 * lời: chúng cũng không phải một lượt chấm lại để mà đếm.
 *
 * Giới hạn phân giải giống hệt đường tự động (ADR-0018 Escalation 2):
 * `telemetry_log` không có `attempt_id`, nên một dòng ở đây chỉ quy được về
 * `(user_id, question_id, NGÀY)` — KHÔNG quy được về một lượt thi cụ thể.
 */
async function recordRetryTelemetry(
  supabase: SupabaseClient,
  userId: string,
  questionId: string,
  errorCode: TelemetryErrorCode | null
): Promise<void> {
  try {
    const { error } = await supabase.from("telemetry_log").insert(
      buildTelemetryPayload({
        eventType: "essay_grade",
        userId,
        questionId,
        // Tính năng này không đụng kỹ năng (D7).
        skillNodeId: null,
        success: errorCode === null,
        errorCode,
      })
    );
    if (error) console.error("[retryEssayGrading]", { stage: "telemetry", code: error.code });
  } catch (err) {
    console.error("[retryEssayGrading]", { stage: "telemetry", name: (err as Error)?.name });
  }
}

/**
 * Chấm lại MỘT câu tự luận đang ở trạng thái `failed`.
 *
 * @param attemptId lượt làm bài. KHÔNG TIN CẬY — đến từ client.
 * @param questionId câu cần chấm lại. KHÔNG TIN CẬY — đến từ client.
 * @returns `{ ok: true }` hoặc đúng một trong năm mã từ chối. Không bao giờ ném,
 *   không bao giờ redirect.
 *
 * TIỀN ĐIỀU KIỆN: KHÔNG CÓ. Server Action là một endpoint độc lập — việc UI ẩn
 * hay vô hiệu hoá nút KHÔNG PHẢI một cơ chế cưỡng chế.
 */
export async function retryEssayGrading(attemptId: string, questionId: string): Promise<RetryResult> {
  try {
    // ── CỜ TÍNH NĂNG — chỗ đọc 2/3, và là một CỔNG HÀNH VI.
    //    Bỏ nó thì tắt cờ vẫn để nút chấm lại đốt ngân sách Groq. Quy tắc đọc
    //    fail-closed giống hệt hai chỗ còn lại: CHỈ chuỗi `"true"` đã trim mới
    //    là bật; mọi giá trị khác, kể cả vắng mặt, là tắt.
    if (process.env.ESSAY_GRADING_ENABLED?.trim() !== "true") return { ok: false, reason: "server" };

    const supabase = await createClient();

    // ── BƯỚC 2. ĐỌC ATTEMPT qua client của HỌC SINH. RLS là hàng rào: nó lọc
    //    về đúng attempt của người gọi, nên "không thấy" và "không phải của
    //    bạn" là CÙNG một câu trả lời — và đó là điều đúng đắn, vì phân biệt
    //    hai ca đó cho người ngoài biết một attemptId có tồn tại hay không.
    const { data: attempt, error: attemptErr } = await supabase
      .from("exam_attempts")
      .select("id, exam_id, status, user_id")
      .eq("id", attemptId)
      .maybeSingle();
    if (attemptErr) {
      logDigest("attempt", attemptErr);
      return { ok: false, reason: "server" };
    }
    if (!attempt || attempt.status !== "submitted") return { ok: false, reason: "not_found" };

    const userId = attempt.user_id as string;

    // ── BƯỚC 1. RATE LIMIT. Đứng SAU lượt đọc trên chứ không trước, và đó là
    //    lối `submitExam()` đã đi (`actions.ts:75`) kèm lý do: khoá phải lấy từ
    //    dòng attempt ĐÃ qua RLS. Nhận `userId` từ client sẽ cho một người tiêu
    //    sạch xô rate-limit của người khác — một lượt từ chối dịch vụ nhắm đích.
    const rl = await guard("retryEssayGrading", userId);
    if (!rl.ok) {
      // KHÔNG có mã `rate_limited` trong hợp đồng năm mã với UI. `server` là mã
      // duy nhất mang nghĩa "bị từ chối vì lý do không thuộc bốn ca kia"; ánh xạ
      // vào `budget` sẽ nói dối học sinh rằng ngân sách DỰ ÁN đã hết trong khi
      // thứ chạm trần là xô của riêng họ.
      await recordRetryTelemetry(supabase, userId, questionId, "rate_limited");
      return { ok: false, reason: "server" };
    }

    // ── BƯỚC 3. ĐỌC KẾT QUẢ + SUY TRẠNG THÁI. `deriveEssayView()` là bản suy
    //    diễn DUY NHẤT trong repo; gọi lại nó ở đây (thay vì tự so `essayState`)
    //    là thứ giữ cho lời từ chối của action khớp với thứ màn hình đang hiện.
    const { data: resultRow, error: resultErr } = await supabase
      .from("exam_results")
      .select("per_question, created_at")
      .eq("attempt_id", attemptId)
      .maybeSingle();
    if (resultErr) {
      logDigest("result", resultErr);
      await recordRetryTelemetry(supabase, userId, questionId, "server");
      return { ok: false, reason: "server" };
    }
    if (!resultRow) {
      await recordRetryTelemetry(supabase, userId, questionId, "not_eligible");
      return { ok: false, reason: "not_found" };
    }

    const perQuestion = (resultRow.per_question ?? []) as PerQuestionResult[];
    const entry = perQuestion.find((r) => r.questionId === questionId);
    const view = entry ? deriveEssayView(entry, resultRow.created_at as string, new Date()) : null;
    if (!view) {
      // Câu không tồn tại trong lượt thi này, hoặc không phải câu tự luận chấm
      // được. Cả hai đều là "không có thứ đó để chấm lại".
      await recordRetryTelemetry(supabase, userId, questionId, "not_eligible");
      return { ok: false, reason: "not_found" };
    }
    if (view.state !== "failed") {
      // `graded` (AC-063 — bộ poll đã thắng cuộc đua) hoặc `pending` (đang chấm).
      await recordRetryTelemetry(supabase, userId, questionId, "not_eligible");
      return { ok: false, reason: "not_failed" };
    }
    if (!view.retryAvailable) {
      await recordRetryTelemetry(supabase, userId, questionId, "not_eligible");
      return { ok: false, reason: "exhausted" };
    }

    // ── Tài liệu chấm. `essay_answer` đã bị REVOKE khỏi role `authenticated`,
    //    nên KHÔNG đọc thẳng `questions` được; `exam_answer_key()` chỉ nhả đáp
    //    án cho tác giả hoặc người ĐÃ nộp đề đó (schema.sql §10a) — đúng điều
    //    kiện của một lượt chấm lại sau khi nộp.
    const { data: keyRows, error: keyErr } = await supabase.rpc("exam_answer_key", {
      p_exam_id: attempt.exam_id as string,
    });
    if (keyErr) {
      logDigest("answer_key", keyErr);
      await recordRetryTelemetry(supabase, userId, questionId, "server");
      return { ok: false, reason: "server" };
    }
    const question = ((keyRows ?? []) as Array<{ id: string; content: string; essay_answer: string | null }>)
      .find((q) => q.id === questionId);
    const referenceAnswer = question?.essay_answer?.trim();
    if (!question || !referenceAnswer) {
      // Không có ground truth ⇒ câu này chưa bao giờ đủ điều kiện chấm tự động
      // (AC-038). Từ chối TRƯỚC claim: đốt một trong ba lượt cho một câu không
      // thể chấm là mất trắng.
      await recordRetryTelemetry(supabase, userId, questionId, "not_eligible");
      return { ok: false, reason: "not_found" };
    }

    // ═══ RANH GIỚI ĐẶC QUYỀN. Mọi thứ dưới đây chạy bằng `service_role`. ═══

    // ── BƯỚC 4. CLAIM. Trần lượt được tiêu Ở ĐÂY, trước khi nhà cung cấp được
    //    liên hệ, và không bao giờ bị giảm (ADR-0018 D4).
    const claimed = await claimEssayGradingAttempt(attemptId, questionId);
    if (!claimed.claimed) {
      await recordRetryTelemetry(supabase, userId, questionId, "not_eligible");
      if (claimed.error) return { ok: false, reason: "server" };
      return { ok: false, reason: CLAIM_REFUSAL[claimed.reason ?? ""] ?? "server" };
    }

    // ── BƯỚC 5. ĐẶT CHỖ NGÂN SÁCH — worst case, MỘT lần, trước request đầu.
    //
    //    CHI PHÍ ĐÃ CHẤP NHẬN, ghi ra chứ không giảm nhẹ: một lượt bị từ chối ở
    //    đây VẪN tiêu một trong ba lượt, vì D4 tiêu lượt lúc claim và AC-072 bắt
    //    claim chạy trước đo đếm. Đảo thứ tự là mở đúng lỗ hổng AC-072 tồn tại
    //    để đóng. UI-D9 đã lường trước bằng cách KHÔNG hiển thị con số lượt.
    const reserved = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, new Date());
    if (!reserved.ok) {
      const projectBudget = reserved.reason === "project_budget";
      await recordRetryTelemetry(
        supabase,
        userId,
        questionId,
        projectBudget ? "project_budget_exhausted" : "server"
      );
      // `unavailable` (counter store hỏng) KHÔNG phải `budget`: nói với học sinh
      // "hết ngân sách hôm nay" khi thật ra Upstash đang chết là một câu sai, và
      // nó bảo họ chờ tới mai cho một sự cố sẽ được sửa trong mười phút.
      return { ok: false, reason: projectBudget ? "budget" : "server" };
    }

    // ── BƯỚC 6. GỌI PROVIDER rồi SETTLE. KHÔNG settle `failed` ở các nhánh hỏng
    //    dưới đây: câu này ĐÃ ở `failed` (bước 3 đòi thế), nên một lượt ghi nữa
    //    chỉ đẩy `essayGradedAt` tới mà không đổi thứ gì học sinh nhìn thấy.
    const res = await groqChatCompletion({
      prompt: buildEssayPrompt({
        questionContent: question.content,
        referenceAnswer,
        studentAnswer: entry?.selected ?? "",
      }),
      model: ESSAY_GRADER_MODEL,
    });
    if (!res.ok) {
      await recordRetryTelemetry(
        supabase,
        userId,
        questionId,
        res.kind === "rate_limited" ? "rate_limited" : "groq_unavailable"
      );
      return { ok: false, reason: "server" };
    }

    const parsed = parseGrade(res.text);
    if (!parsed.ok) {
      // KHÔNG BAO GIỜ thành band 0 (AC-007): một output bị từ chối là một câu bị
      // kẹt, không phải một điểm 0 trông như bài làm dở.
      await recordRetryTelemetry(supabase, userId, questionId, "invalid_output");
      return { ok: false, reason: "server" };
    }

    const done = await recordEssayGrade(
      attemptId,
      questionId,
      "graded",
      parsed.band,
      ESSAY_MAX_POINTS,
      parsed.lowConfidence
    );
    if (!done.written) {
      // Ghi-lần-đầu-thắng đã từ chối một bản trùng — cuộc đua AC-063 được phân
      // xử đúng như thiết kế. Học sinh KHÔNG được báo lỗi: band kia là thật, và
      // `router.refresh()` ở phía client sẽ hiện nó ra.
      await recordRetryTelemetry(supabase, userId, questionId, "duplicate_write");
      return { ok: false, reason: "not_failed" };
    }

    await recordRetryTelemetry(supabase, userId, questionId, null);
    return { ok: true };
  } catch (err) {
    logDigest("unexpected", err);
    return { ok: false, reason: "server" };
  }
}
