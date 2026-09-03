// Engine 1 — Server Action của gia sư Socratic (backend DD § explainStep()).
//
// Tách khỏi actions.ts CỐ Ý: file này là cửa duy nhất mở đường tới Gemini bằng
// phiên của học sinh, nên mọi thứ canh cửa (sở hữu attempt, tái kiểm tra điều
// kiện sai-hai-lần, rate limit, telemetry) nằm gọn trong một file đọc hết được
// một lượt, thay vì lẫn vào giữa luồng nộp bài.
//
// QUY ƯỚC LỖI: typed-result (`{error: "..."}`), KHÔNG throw, KHÔNG redirect —
// theo tiền lệ rateExam() (actions.ts:177) chứ không theo submitExam(): người
// gọi là một affordance nằm giữa trang Chi tiết đã render xong, ném lỗi ở đây
// sẽ đánh sập cả trang vì một gợi ý không lấy được. Chi tiết lỗi thật chỉ đi ra
// console phía máy chủ; client luôn chỉ nhận đúng 4 mã đóng của backend DD § explainStep() Output.
//
// ⏱ HẠN CHÓT vs. TRẦN THỜI GIAN CỦA NỀN TẢNG (backend DD § Assumed Behaviors —
// mục này ĐÃ ĐÓNG, kiểm chứng khi làm task 13):
//   - `maxDuration` là cấu hình của ROUTE SEGMENT (`layout.tsx | page.tsx |
//     route.ts`), và tài liệu Next.js 16 kèm trong repo
//     (node_modules/next/dist/docs/.../route-segment-config/maxDuration.md) nói
//     rõ: với Server Action thì phải đặt Ở TRANG gọi nó. Một file "use server"
//     KHÔNG phải route segment (và chỉ được export hàm async), nên không có
//     cách nào khai `maxDuration` hiệu lực TẠI ĐÂY.
//   - Không cần khai: tài liệu Vercel (`/docs/functions/configuring-functions/
//     duration`, đọc 2026-08-14) ghi mức MẶC ĐỊNH với fluid compute (bật sẵn) là
//     300s cho cả Hobby/Pro/Enterprise — `TUTOR_CALL_DEADLINE_MS = 30_000` nằm
//     trong đó với biên 10×, và SOURCE/vercel.json không có mục `functions` nào
//     hạ trần xuống.
//   - CÒN LẠI (không đọc được từ repo): ô "Default Max Duration" trong dashboard
//     của project. Nếu ai đó hạ nó xuống dưới 30s, hoặc tắt fluid compute, thì
//     trang mount ExplainStepAffordance (app/(exams)/exams/[id]/attempt/
//     [attemptId]/result/detail/page.tsx) phải `export const maxDuration = 30`
//     trở lên — nếu không, nền tảng cắt trước khi AbortSignal của
//     generateHint() kịp chạy và lỗi hiện ra dưới dạng khác (không còn là mã có
//     kiểu ở dưới nữa).
"use server";

import { consumeQuota } from "@/lib/billing/quota";
import { QUOTA_REFUSAL_TELEMETRY_CODE } from "@/lib/billing/quotaTelemetry";
import { readEntitlement } from "@/lib/billing/readEntitlement";
import { guard } from "@/lib/security/rateLimit";
import { computeWrongTwiceQuestionIds, type WrongTwiceAttempt } from "@/lib/scoring/wrongTwice";
import { createClient } from "@/lib/supabase/server";
import { generateHint, TutorCallError } from "@/lib/tutor/callTutor";
import type { TutorPromptInput } from "@/lib/tutor/prompt";
import { buildTelemetryPayload, type TelemetryErrorCode } from "@/lib/tutor/telemetry";
import { GEMINI_CALLS_PER_OPERATION } from "@/lib/ugc/gemini";
import type { PerQuestionResult } from "@/types/result";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Bốn mã đóng của backend DD § explainStep() Output. CỐ Ý viết lại thành literal
 *  thay vì alias `TelemetryErrorCode`: đây là hợp đồng với UI, còn kia là CHECK
 *  constraint `telemetry_log_error_code_check` — hai chủ sở hữu khác nhau. Hai tập trùng nhau hôm nay, và
 *  chính lệnh ghi telemetry ở dưới là chỗ tsc bắt được nếu ai thêm mã thứ 5 chỉ ở
 *  một bên. */
export type ExplainStepError = "not_eligible" | "rate_limited" | "gemini_unavailable" | "server";

export type ExplainStepResult = { hint: string } | { error: ExplainStepError };

// Ánh xạ OK-04 (`consumeQuota()` reason → `telemetry_log.error_code`) sống ở
// `@/lib/billing/quotaTelemetry` — MỘT bản khai duy nhất, dùng chung với cổng
// upload trong `features/authoring/actions.ts`. Trước đây mỗi file giữ một bản sao
// literal và không có gì ghim chúng vào nhau; xem khối chú thích của module ấy
// để biết vì sao chỗ hợp nhất phải là một module KHÔNG `"use server"`.

/** Đúng bộ cột AN TOÀN cần cho prompt. `correct_answer`/`sub_answers`/
 *  `essay_answer` không có ở đây, và cũng không thể có: §10c đã REVOKE chúng
 *  khỏi role `authenticated` mà Server Action này chạy bằng. `skill_node_id`
 *  cũng KHÔNG đọc — gia sư cần nội dung câu hỏi, không cần nhãn kỹ năng (AC-029),
 *  và bất biến của sprint là cột đó không vượt ranh giới SQL sang tầng TS. */
const TUTOR_QUESTION_COLUMNS = "content, question_type, choices";

/** Một ý/lựa chọn như cột `choices` lưu — với true_false thì chính cột này chứa
 *  các ý a–d (quy ước v2.1, xem queries.ts:250). */
type LabelledOptionRow = { id: string; text: string };

/**
 * Toàn bộ lịch sử làm bài ĐÃ NỘP của chính người gọi, rút gọn còn đúng phần
 * `computeWrongTwiceQuestionIds()` cần. `null` = đọc HỎNG.
 *
 * KHÔNG lọc user_id: policy `results_select_own` đã giới hạn `user_id =
 * auth.uid()` (cùng lý lẽ với fetchWrongTwiceAttempts() trong queries.ts).
 *
 * KHÁC BIỆT CÓ CHỦ Ý so với bản trong queries.ts, và là lý do không tái dùng
 * hàm ấy (nó cũng không được export): ở đó, đọc hỏng thì suy giảm mềm về `[]`
 * vì dữ liệu chỉ làm giàu một cờ hiển thị. Ở đây, cùng lệnh đọc ấy LÀ RANH GIỚI
 * BẢO MẬT: `[]` vẫn fail-closed (không câu nào đủ điều kiện) nhưng sẽ nói dối
 * người dùng bằng mã "not_eligible" trong khi sự thật là ta không kiểm tra
 * được. Trả `null` để caller trả về "server". Phần dùng chung thật sự — phép
 * gộp "sai hai lần" — vẫn là đúng một hàm duy nhất (wrongTwice.ts).
 */
async function fetchOwnAttemptHistory(supabase: SupabaseClient): Promise<WrongTwiceAttempt[] | null> {
  const { data, error } = await supabase.from("exam_results").select("attempt_id, per_question");
  if (error) {
    // Chỉ code + message: `details`/`hint` của PostgREST có thể vọng lại giá trị
    // của chính dòng dữ liệu (UGC), không được đưa vào log.
    console.error("[explainStep] đọc lịch sử wrong-twice thất bại:", error.code, error.message);
    return null;
  }
  const rows = (data ?? []) as unknown as {
    attempt_id: string;
    per_question: PerQuestionResult[] | null;
  }[];
  return rows.map((r) => ({ attemptId: r.attempt_id, perQuestion: r.per_question ?? [] }));
}

/**
 * Ghi nhận MỘT lượt gọi gia sư vào `telemetry_log` — best-effort tuyệt đối:
 * mọi lối thoát của hàm này đều không đổi kết quả trả cho người dùng (backend DD
 * § explainStep() Invariants).
 *
 * `userId` KHÔNG BAO GIỜ null ở call site này, dù `TelemetryEvent` cho phép:
 * policy `telemetry_insert_own` của `telemetry_log` là `with check (user_id = auth.uid())`, nên
 * một dòng user_id NULL sẽ bị RLS từ chối thẳng — ghi vào đó là mất dòng chứ
 * không phải "mất danh tính". Giá trị truyền vào luôn lấy từ dòng `exam_attempts`
 * đã qua RLS, tức đúng bằng `auth.uid()`. Những lối thoát KHÔNG có userId (không
 * tìm thấy attempt / đọc attempt hỏng) vì thế không ghi gì cả — chúng cũng không
 * phải một lượt gọi gia sư để mà đếm.
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
    if (error) console.warn("[explainStep] telemetry_log:", error.code, error.message);
  } catch (err) {
    // Một lệnh ghi quan sát không bao giờ được trở thành điểm hỏng thứ hai của
    // luồng học sinh đang chờ (backend DD cấm tường minh).
    console.warn("[explainStep] telemetry_log ném lỗi:", (err as Error)?.name);
  }
}

/**
 * Gợi ý Socratic cho MỘT câu học sinh đã sai ở hai lượt làm bài khác nhau.
 *
 * @param attemptId lượt làm bài đang xem — thứ tự tham số là (attemptId,
 *   questionId), cả hai đều là string nên hoán vị sẽ biên dịch trót lọt; phía
 *   gọi có test riêng khoá đúng thứ tự này.
 * @returns `{hint}` hoặc đúng một trong bốn mã lỗi có kiểu. Không bao giờ throw.
 *
 * THỨ TỰ CÁC CỔNG (và vì sao):
 *   1. Sở hữu — đọc `exam_attempts` qua RLS; dòng đọc được cũng chính là nguồn
 *      `userId` cho hai bước sau (đúng lối submitExam()/rateExam(): không tốn
 *      thêm một round-trip `auth.getUser()`).
 *   2. Rate limit — TRƯỚC mọi thứ tốn kém, và bắt buộc trước mọi thứ chạm
 *      Gemini (AC-022). DD liệt kê bước này ở vị trí 3 trong danh sách
 *      Validation; đặt lên trước phần tái kiểm tra là chặt hơn chứ không lỏng
 *      hơn (mọi bất biến của DD vẫn giữ), và giữ cho một vòng lặp tự động chỉ
 *      tốn một lệnh đọc thay vì một lần quét toàn bộ lịch sử.
 *   3. Hạn mức kỳ + ngân sách ngày — cổng chi phí thứ hai, và cũng đứng trước
 *      mọi thứ tốn kém. Bị từ chối thì client nhận `not_eligible` (một trong
 *      bốn mã đóng), còn LÝ DO thật chỉ đi vào `telemetry_log.error_code`.
 *   4. Tái kiểm tra sai-hai-lần PHÍA SERVER — cổng bảo mật thật. Cờ
 *      `hasBeenWrongTwice` mà UI dùng chỉ là tiện ích hiển thị (UI Spec D1);
 *      hàm này tự tính lại từ lịch sử trong DB, không tin bất cứ thứ gì người
 *      gọi khai.
 *   5. Đọc câu hỏi bằng client thường (không phải claim_attempt_answer_key/
 *      exam_answer_key) → không thể nhận về đáp án.
 *   6. Gọi Gemini, rồi ghi telemetry cho MỌI lối thoát có danh tính người dùng.
 */
export async function explainStep(attemptId: string, questionId: string): Promise<ExplainStepResult> {
  const supabase = await createClient();

  // 1. Sở hữu. RLS `attempts_select_own` lọc về lượt của chính người gọi, nên
  //    không tìm thấy = không tồn tại HOẶC không phải của mình — hai ca này cố ý
  //    không phân biệt được từ phía client (không xác nhận id của người khác).
  const { data: attempt, error: attemptErr } = await supabase
    .from("exam_attempts")
    .select("user_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (attemptErr) {
    console.error("[explainStep] đọc attempt thất bại:", attemptErr.code, attemptErr.message);
    return { error: "server" };
  }
  if (!attempt) return { error: "not_eligible" };
  const userId = (attempt as { user_id: string }).user_id;

  // 2. Rate limit (AC-022) — cổng chi phí, luôn đứng trước Gemini.
  const rl = await guard("explainStep", userId);
  if (!rl.ok) {
    await recordTutorInvoke(supabase, {
      userId,
      questionId,
      success: false,
      errorCode: "rate_limited",
    });
    return { error: "rate_limited" };
  }

  // 3. Hạn mức kỳ + ngân sách ngày (I2 — AC-014/AC-015/AC-022/AC-023/AC-024).
  //    ĐỨNG SAU rate limit, cố ý: `consumeQuota()` INCR rồi mới so, nên gọi nó
  //    cho một lượt đã bị chặn là tính phí một suất cho một lượt không bao giờ
  //    chạm tới Gemini. Và đứng TRƯỚC mọi thứ tốn kém còn lại, vì đây là cổng
  //    chi phí thứ hai — một lượt bị từ chối phải phát ĐÚNG 0 request Gemini.
  //
  //    HAI MÃ, và chỉ một trong hai ra tới client:
  //      · client nhận `not_eligible` — MỘT trong bốn mã đóng ở `:51`, đúng mã
  //        nhánh tái kiểm tra ở dưới trả. Bắt buộc, không phải sở thích (UI Spec
  //        UI-D3): bốn mã ấy render ra ĐÚNG MỘT câu, nên tách "hết lượt" thành
  //        mã thứ năm sẽ để lộ ngược lại rằng phía server có vòng tái kiểm tra
  //        điều kiện. Người dùng biết mình hết lượt TRƯỚC KHI BẤM, suy từ quyền
  //        lợi (AC-041, C-05 `ExplainStepAffordance.tsx:96-99`) — không phải từ
  //        một mã lỗi SAU khi bấm.
  //      · `telemetry_log.error_code` nhận mã PHÂN BIỆT. Đó là chỗ DUY NHẤT sự
  //        phân biệt tồn tại, và là thứ AC-047 truy vấn được.
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

  // 4. Tái kiểm tra phía server (AC-021).
  const history = await fetchOwnAttemptHistory(supabase);
  if (!history) {
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "server" });
    return { error: "server" };
  }

  const currentRow = history
    .find((a) => a.attemptId === attemptId)
    ?.perQuestion.find((r) => r.questionId === questionId);
  // Hai điều kiện, KHÔNG thay thế cho nhau: (a) câu này trong CHÍNH lượt đang
  // xem phải là câu có chấm và đang sai — cùng công thức gating mà getResult()
  // dùng để bật affordance; (b) nó phải nằm trong tập sai-hai-lần tính lại từ
  // toàn bộ lịch sử.
  const eligibleInThisAttempt =
    currentRow !== undefined && currentRow.scored !== false && !currentRow.isCorrect;
  if (!eligibleInThisAttempt || !computeWrongTwiceQuestionIds(history).has(questionId)) {
    await recordTutorInvoke(supabase, {
      userId,
      questionId,
      success: false,
      errorCode: "not_eligible",
    });
    return { error: "not_eligible" };
  }

  // 5. Nội dung câu hỏi — chỉ cột an toàn.
  const { data: question, error: questionErr } = await supabase
    .from("questions")
    .select(TUTOR_QUESTION_COLUMNS)
    .eq("id", questionId)
    .maybeSingle();
  if (questionErr) {
    console.error("[explainStep] đọc câu hỏi thất bại:", questionErr.code, questionErr.message);
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: "server" });
    return { error: "server" };
  }
  const questionRow = question as {
    content: string;
    question_type: string | null;
    choices: LabelledOptionRow[] | null;
  } | null;
  // Câu đã biến mất (bị xoá sau khi học sinh làm) hoặc là câu tự luận: không có
  // gì để kèm chứ không phải ta hỏng. Lý do loại trừ essay đã ĐỔI kể từ
  // ADR-0018 — nó KHÔNG còn là "essay không bao giờ được chấm", vì tự luận nay
  // được chấm và mang một band. Lý do đúng: "sai hai lần" đọc `isCorrect`, một
  // vị từ NHỊ PHÂN mà một band không trả lời được, nên câu tự luận không bao giờ
  // đủ điều kiện gọi gia sư. Nhánh này chỉ là lưới, và cũng là chỗ thu hẹp kiểu
  // cho TutorPromptInput (vốn loại trừ essay ngay từ kiểu).
  const questionType = questionRow?.question_type ?? "mcq";
  if (
    !questionRow ||
    (questionType !== "mcq" && questionType !== "true_false" && questionType !== "short_answer")
  ) {
    await recordTutorInvoke(supabase, {
      userId,
      questionId,
      success: false,
      errorCode: "not_eligible",
    });
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
    // v2.1: các ý a–d của true_false nằm CÙNG cột `choices` (queries.ts:250).
    subItems: isTrueFalse ? options : undefined,
    // Bỏ trống vẫn có thể "sai hai lần"; chuỗi rỗng để khối bài làm hiện ra là
    // trống thay vì mất hẳn ngữ cảnh.
    studentAnswer: currentRow?.selected ?? "",
  };

  try {
    const hint = await generateHint(promptInput);
    await recordTutorInvoke(supabase, { userId, questionId, success: true });
    return { hint };
  } catch (err) {
    // generateHint() đã phân loại sẵn thất bại của nó thành mã của `telemetry_log.error_code` và đã
    // logTutorExit() kèm metadata; ở đây chỉ chuyển thẳng, không có bảng ánh xạ
    // thứ hai. Lỗi KHÔNG phải TutorCallError = bug phía ta → "server"; chỉ log
    // tên lỗi, không log message (message có thể vọng lại nội dung câu hỏi UGC).
    const code: ExplainStepError = err instanceof TutorCallError ? err.code : "server";
    if (!(err instanceof TutorCallError)) {
      console.error("[explainStep] generateHint ném lỗi ngoài dự kiến:", (err as Error)?.name);
    }
    await recordTutorInvoke(supabase, { userId, questionId, success: false, errorCode: code });
    return { error: code };
  }
}
