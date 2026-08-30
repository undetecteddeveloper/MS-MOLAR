// Chấm tự luận (ADR-0018) — ĐIỀU PHỐI PASS, chạy bên trong `after()`.
//
// Module này composes bốn thứ đã có: hai thao tác đặc quyền của
// `service-role.ts`, bộ đếm ngân sách của `budget.ts`, điểm phát của
// `groqClient.ts`, và hai hàm thuần `prompt.ts` / `parseGrade.ts`. Nó không tự
// làm việc của cái nào trong số đó.
//
// ═══ THỨ TỰ LÀ MỘT TÍNH CHẤT BẢO MẬT, KHÔNG PHẢI MỘT TINH CHỈNH ═══
//
//   claim → đặt chỗ ngân sách → gọi provider → settle          (AC-072)
//
// Đảo BẤT KỲ cặp nào là một khuyết tật. Cặp nguy hiểm nhất là hai bước đầu:
// bộ đếm ngân sách là MỘT, dùng chung cho cả dự án (U1/AC-066), nên nếu đo đếm
// chạy trước uỷ quyền thì một người gọi không có quyền, với một `attemptId` tự
// soạn, đốt sạch được ngân sách NGÀY và chặn chấm bài của MỌI học sinh — cộng
// thêm một đường chấm chéo tài khoản. Đó là lý do bộ test đo thứ tự bằng
// `mock.invocationCallOrder` chứ không bằng "cả bốn đều được gọi": câu sau
// đúng cả trong thứ tự hỏng.
//
// ═══ MỌI LỐI THOÁT BỊ NUỐT ═══
//
// ADR-0011 § Implementation Guidance: đường ghi điểm là đường chịu lực, mọi thứ
// gắn vào nó được phép hỏng. Pass này chạy SAU `recordExamResult()` và
// `recordSkillMastery()`, trong `after()`, tức sau khi response đã trả từ lâu.
// Một lượt ném ở đó là một lỗi runtime KHÔNG AI ĐỌC, trên một request đã kết
// thúc — nên hàm này không bao giờ để exception thoát ra.
//
// ═══ BA QUY TẮC LOG (AC-056) ═══
//
// `console.error` ở đây chỉ mang `questionId` và một MÃ CÓ CẤU TRÚC. Không bao
// giờ: bài làm của học sinh, prompt, response thô, hay `err.message` của nhà
// cung cấp. Cả bốn thứ đó là văn bản tự do, và dữ liệu ở đây là bài viết của
// một trẻ vị thành niên nộp trong một kỳ thi.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ESSAY_GRADER_MODEL } from "@/lib/ai/models";
import { ESSAY_MAX_POINTS } from "@/lib/scoring/essayLifecycle";
import { claimEssayGradingAttempt, recordEssayGrade } from "@/lib/supabase/service-role";
import { buildTelemetryPayload, type TelemetryErrorCode } from "@/lib/tutor/telemetry";
import { reserveGroqBudget } from "./budget";
import { GROQ_CALLS_PER_ESSAY, groqChatCompletion } from "./groqClient";
import { parseGrade } from "./parseGrade";
import { buildEssayPrompt } from "./prompt";

/** Số request đang bay tối đa (AC-036).
 *
 *  CỠ THEO TPM, KHÔNG THEO RPM. 30 RPM là con số đúng nhưng nó chưa bao giờ là
 *  giới hạn ràng buộc; TPM 8K mới là. Số học để người sau tính lại được: một
 *  bài 4000 ký tự tiếng Việt ≈ 1.200 token, cộng đáp án tham chiếu, đề bài và
 *  rubric ⇒ ~2.500–3.500 token/request. Vậy 8K TPM ÷ ~3K ≈ 2–3 request/phút.
 *  Đồng thời 4 bắn ~12K vào trần 8K — vượt trần ở MỌI lượt pass, một cách có
 *  hệ thống — và retry KHÔNG cứu nổi chuyện đó: nó chỉ biến một khuyết tật cấu
 *  hình thành một vòng lặp chậm. Đồng thời 2 ⇒ ~6K mỗi burst, dưới 8K.
 *
 *  CHƯA ĐO — OQ-1 sở hữu con số này tới Task E5. */
export const GROQ_MAX_CONCURRENCY = 2;

/** Trần đồng hồ của cả pass (80% của trần nền tảng 300 s).
 *
 *  Chạm mốc này thì orchestrator NGỪNG KHỞI ĐỘNG câu mới và trả về. Lý do
 *  không phải mỹ học: một câu đã CLAIM mà pass bị nền tảng cắt trước lúc settle
 *  sẽ tiêu một trong ba lượt của học sinh mà KHÔNG GHI GÌ (ADR-0018 D4).
 *  Dừng chủ động giữ số câu "đã claim, chưa settle" bị chặn trần; để nền tảng
 *  cắt thì không. */
export const ESSAY_PASS_BUDGET_MS = 240_000;

export interface EssayTarget {
  questionId: string;
  /** Đề bài, nguyên văn — `buildEssayPrompt()` cần nó. */
  questionContent: string;
  /** `questions.essay_answer`. Người gọi ĐÃ lọc: câu không có ground truth
   *  không bao giờ vào tập này (AC-038/EG-BE-003). */
  referenceAnswer: string;
  /** Bài làm của học sinh. NỘI DUNG KHÔNG TIN CẬY. */
  studentAnswer: string;
}

export interface GradePassInput {
  attemptId: string;
  /** `auth.uid()` của học sinh, lấy từ dòng `exam_attempts` mà `submitExam()`
   *  ĐÃ đọc qua RLS — KHÔNG từ một `auth.getUser()` mới.
   *
   *  RLS đã lọc dòng ấy về đúng người gọi, nên giá trị này bằng `auth.uid()`
   *  theo định nghĩa; gọi lại `auth.getUser()` bên trong `after()` chỉ tốn một
   *  round-trip mạng để ra cùng một chuỗi. Đây đúng là lập luận `submitExam()`
   *  đã viết sẵn cho khoá rate-limit của chính nó (`actions.ts`). */
  userId: string;
  targets: EssayTarget[];
  /** Client của CHÍNH HỌC SINH, đã dựng ở `submitExam()` TRƯỚC khi `after()`
   *  được đăng ký và bắt vào closure — KHÔNG dựng lại bên trong callback
   *  (Risks R-05). Task B3.1 là chỗ nó trở thành load-bearing: telemetry ghi
   *  qua client của học sinh, vì policy `telemetry_insert_own` là
   *  `with check (user_id = auth.uid())` nên một lượt ghi bằng `service_role`
   *  với `user_id` null bị từ chối thẳng. Khai từ bây giờ để B1.5 không phải
   *  đổi chữ ký khi B3.1 tới. */
  supabase: SupabaseClient;
}

/** Mã log CÓ CẤU TRÚC — danh sách đóng. Không mã nào mang văn bản tự do. */
type LogCode =
  | "claim_refused"
  | "budget_refused"
  | "provider_failed"
  | "invalid_output"
  | "settle_refused"
  | "settle_error"
  | "telemetry_refused"
  | "unexpected";

function log(questionId: string, code: LogCode, detail?: string) {
  // Chỉ ba thứ, và cả ba đều là giá trị thuộc tập đóng hoặc một id. `detail`
  // luôn đến từ một union đã khai (lý do từ chối claim, `kind` của provider,
  // `reason` của parseGrade) — không bao giờ từ một chuỗi do nhà cung cấp hay
  // học sinh soạn.
  console.error("[gradeEssays]", { questionId, code, detail });
}

/** Ngữ cảnh dùng chung cho mọi câu của MỘT pass. Gộp lại thành một tham số vì
 *  cả ba đi cùng nhau xuống tận `recordGradeTelemetry()`. */
interface PassContext {
  attemptId: string;
  userId: string;
  supabase: SupabaseClient;
}

/**
 * Ghi MỘT dòng `telemetry_log` cho MỘT lượt chấm (AC-054).
 *
 * ═══ GIỚI HẠN PHÂN GIẢI — ĐỌC TRƯỚC KHI ĐẾM BẤT CỨ THỨ GÌ TỪ BẢNG NÀY ═══
 *
 * `telemetry_log` KHÔNG có cột `attempt_id`, và tính năng này CỐ Ý không thêm
 * (ADR-0018 Escalation 2 — giữ ngân sách hai-thay-đổi-schema của PRD, dưới cái
 * bóng của TD-005 đã nổ bốn lần). Hệ quả, nói thẳng để không ai phải suy ra:
 *
 *   Một dòng ở đây chỉ quy được về `(user_id, question_id, NGÀY)` — KHÔNG quy
 *   được về một lượt thi cụ thể. Hai lượt `duplicate_write` trên CÙNG một câu,
 *   của CÙNG một học sinh, trong CÙNG một ngày là KHÔNG PHÂN BIỆT ĐƯỢC, dù
 *   chúng thuộc hai lượt thi khác nhau.
 *
 * Chế độ hỏng cần chặn: một phiên làm việc sau này đếm `duplicate_write` rồi
 * suy ra một tỉ lệ TRÊN MỖI LƯỢT THI. Con số đó không tồn tại và không tái dựng
 * được từ dữ liệu này. Ai cần nó phải THÊM CỘT — một thay đổi schema thủ công
 * thứ ba dưới TD-005, tức một quyết định phải nêu ra, không phải một tiện tay.
 *
 * ═══ BEST-EFFORT TUYỆT ĐỐI ═══
 *
 * Nuốt cả `error` trả về lẫn exception ném ra — hai đường hỏng khác nhau, phải
 * chặn cả hai. Một lượt ghi QUAN SÁT không bao giờ được trở thành điểm hỏng thứ
 * hai của đường chấm; điểm của học sinh đã nằm trong `exam_results` từ trước.
 *
 * Chỉ `error.code`/`err.name` được ra console: thông điệp lỗi Postgres đi qua
 * đây có thể VỌNG LẠI nội dung dòng bị từ chối — tức bài làm (AC-056).
 */
async function recordGradeTelemetry(
  ctx: PassContext,
  questionId: string,
  errorCode: TelemetryErrorCode | null
): Promise<void> {
  try {
    // `success` được SUY từ `errorCode` chứ không nhận làm tham số thứ hai:
    // định nghĩa là "settle được `graded`", và mọi nhánh settle được `graded`
    // đều không có mã. Hai tham số độc lập chỉ tạo chỗ cho chúng trôi khỏi nhau.
    const { error } = await ctx.supabase.from("telemetry_log").insert(
      buildTelemetryPayload({
        eventType: "essay_grade",
        userId: ctx.userId,
        questionId,
        // Tính năng này không đụng kỹ năng (D7).
        skillNodeId: null,
        success: errorCode === null,
        errorCode,
      })
    );
    if (error) log(questionId, "telemetry_refused", error.code);
  } catch (err) {
    log(questionId, "telemetry_refused", (err as Error)?.name);
  }
}

/**
 * Chấm MỘT câu, theo đúng thứ tự bất biến.
 *
 * Không ném — mọi lối thoát trả về sau khi đã ghi log. Người gọi chạy nhiều
 * lượt của hàm này song song và một câu hỏng không được phép kéo theo câu khác
 * (AC-035).
 */
async function gradeOne(ctx: PassContext, t: EssayTarget): Promise<void> {
  const { attemptId } = ctx;
  try {
    // ── Bài làm RỖNG: band 0 NGAY, không claim, không đặt chỗ, không provider.
    //    (AC-037) Không claim là nửa quan trọng: một ô trống không có gì để
    //    thử lại, nên đốt một trong ba lượt cho nó là mất trắng. Band 0 cho ô
    //    trống là kết quả CUỐI CÙNG và đúng đắn — khác hẳn `failed`.
    if (t.studentAnswer.trim() === "") {
      const blank = await recordEssayGrade(attemptId, t.questionId, "graded", 0, ESSAY_MAX_POINTS, false);
      if (!blank.written) log(t.questionId, "settle_refused", "blank");
      // Ô trống settle được `graded` là một THÀNH CÔNG, không phải một thất bại
      // — đếm nó thành `success: false` sẽ thổi phồng mọi tỉ lệ hỏng đọc từ
      // bảng này bằng đúng số ô học sinh bỏ trống. Nhánh này KHÔNG được miễn
      // trừ khỏi `duplicate_write`: nó đi qua CÙNG vị từ ghi-lần-đầu-thắng.
      await recordGradeTelemetry(ctx, t.questionId, blank.written ? null : "duplicate_write");
      return;
    }

    // ── 1. CLAIM. Uỷ quyền trước đo đếm (AC-072). Trần lượt được tiêu ở đây,
    //    trước khi nhà cung cấp được liên hệ, và không bao giờ bị giảm.
    const claimed = await claimEssayGradingAttempt(attemptId, t.questionId);
    if (!claimed.claimed) {
      // KHÔNG settle. Ở nhánh `already_graded`, một settle sẽ ghi đè `graded`
      // bằng `failed` — tức xoá điểm thật của học sinh vì một lượt chạy thừa.
      log(t.questionId, "claim_refused", claimed.reason ?? claimed.error?.code ?? "unknown");
      // KHÔNG telemetry ở đường TỰ ĐỘNG, và đó là một quyết định, không phải
      // một chỗ sót. Không claim được thì không có gì được đặt chỗ, không có gì
      // được gọi, không có gì được ghi — đây chưa từng là một lượt chấm để mà
      // đếm, và một dòng ở đây chỉ thổi phồng mẫu số của mọi tỉ lệ đọc từ bảng
      // này. Mã `not_eligible` thuộc về entry point CHẤM LẠI (Task B3.2), nơi
      // một con người vừa bấm nút và xứng đáng có một câu trả lời.
      return;
    }

    // ── 2. ĐẶT CHỖ NGÂN SÁCH. Một INCRBY của TRƯỜNG HỢP XẤU NHẤT, trước
    //    request đầu tiên. Vòng retry bên dưới nằm DƯỚI lượt đặt chỗ này, nên
    //    bộ đếm nhìn thấy toàn bộ chi phí xấu nhất trước khi nó phát sinh.
    const reserved = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, new Date());
    if (!reserved.ok) {
      log(t.questionId, "budget_refused", reserved.reason);
      await settleFailed(attemptId, t.questionId);
      // HAI lý do từ chối của CÙNG một cổng, và tách chúng ra là toàn bộ giá
      // trị của dòng log này: `project_budget` = "đã tiêu hết tiền hôm nay"
      // (chờ tới mai), `unavailable` = "counter store đang hỏng" (gọi người
      // trực, AC-031). Gộp thành một mã thì không truy vấn nào tách lại được.
      await recordGradeTelemetry(
        ctx,
        t.questionId,
        reserved.reason === "project_budget" ? "project_budget_exhausted" : "server"
      );
      return;
    }

    // ── 3. GỌI PROVIDER. `groqChatCompletion()` không bao giờ ném; nó trả một
    //    thành viên của union đóng.
    const res = await groqChatCompletion({
      prompt: buildEssayPrompt({
        questionContent: t.questionContent,
        referenceAnswer: t.referenceAnswer,
        studentAnswer: t.studentAnswer,
      }),
      model: ESSAY_GRADER_MODEL,
    });
    if (!res.ok) {
      log(t.questionId, "provider_failed", res.kind);
      await settleFailed(attemptId, t.questionId);
      // `rate_limited` là mã TÁI DÙNG ("đã chạm trần nhịp"), `groq_unavailable`
      // là mã MỚI ("Groq hỏng") — hai kết luận vận hành khác hẳn nhau. Và cả
      // hai đều KHÔNG được gộp vào `gemini_unavailable`: metric #7 của PRD đọc
      // theo mã Gemini để chứng minh hai provider tách ngân sách, nên gộp sẽ
      // phá đúng phép đo tồn tại vì lý do đó.
      await recordGradeTelemetry(
        ctx,
        t.questionId,
        res.kind === "rate_limited" ? "rate_limited" : "groq_unavailable"
      );
      return;
    }

    // ── 4. VALIDATE rồi SETTLE. `parseGrade()` không bao giờ ném và không bao
    //    giờ "cứu vãn" một output méo — đó là thứ khiến một cú tiêm chích
    //    THÀNH CÔNG vẫn không dịch được thành điểm.
    const parsed = parseGrade(res.text);
    if (!parsed.ok) {
      log(t.questionId, "invalid_output", parsed.reason);
      await settleFailed(attemptId, t.questionId);
      // Tín hiệu DUY NHẤT phân biệt "tấn công / model trôi" với "provider hỏng"
      // (R-a/AC-042). Gộp vào `server` là giấu đúng cái phải nhìn.
      await recordGradeTelemetry(ctx, t.questionId, "invalid_output");
      return;
    }

    const done = await recordEssayGrade(
      attemptId,
      t.questionId,
      "graded",
      parsed.band,
      ESSAY_MAX_POINTS,
      parsed.lowConfidence
    );
    // `written: false` KHÔNG phải lỗi — ghi-lần-đầu-thắng đã từ chối một bản
    // trùng, đúng kết cục bình thường của cuộc đua AC-063.
    if (!done.written) log(t.questionId, "settle_refused", done.error?.code ?? "duplicate");
    // `written: false` ⇒ `duplicate_write`, và `success: false` ở đó KHÔNG có
    // nghĩa "có sự cố": nó có nghĩa lượt NÀY không ghi được band nào, vì cuộc
    // đua AC-063 đã được phân xử đúng như thiết kế. Không mã sẵn có nào mang
    // được nghĩa đó, nên nó là một trong ba mã mới.
    await recordGradeTelemetry(ctx, t.questionId, done.written ? null : "duplicate_write");
  } catch {
    // Không log đối tượng lỗi: `err.message` có thể mang văn bản của nhà cung
    // cấp, và qua đó mang bài làm của học sinh.
    log(t.questionId, "unexpected");
    await recordGradeTelemetry(ctx, t.questionId, "server");
  }
}

/** Settle `failed` với band NULL.
 *
 *  KHÔNG BAO GIỜ band 0: một câu HỎNG không phải một câu ĐƯỢC 0 ĐIỂM. Ghi 0 sẽ
 *  kéo điểm thật của học sinh xuống vì một sự cố hạ tầng, và không có gì trên
 *  màn hình phân biệt được hai chuyện đó. */
async function settleFailed(attemptId: string, questionId: string): Promise<void> {
  const r = await recordEssayGrade(attemptId, questionId, "failed", null, null, false);
  if (!r.written) log(questionId, "settle_error", r.error?.code ?? "not_written");
}

/**
 * Chạy một pass chấm cho toàn bộ câu tự luận của một lượt thi.
 *
 * Fire-and-forget: trả `void`, không bao giờ ném.
 *
 * TRẦN ĐỒNG HỒ LÀ MỘT SUY GIẢM CÓ THIẾT KẾ, không phải một sự cố. Khi hết giờ,
 * các câu CHƯA được khởi động giữ nguyên `essayAttempts: 0` và học sinh chấm
 * lại được đầy đủ; phép suy lúc đọc lo phần trình bày. Ghi lại ở đây để phiên
 * sau không đọc nó thành một thất bại cần "sửa".
 */
export async function gradeEssaysForAttempt(input: GradePassInput): Promise<void> {
  const { attemptId, userId, targets, supabase } = input;
  const ctx: PassContext = { attemptId, userId, supabase };
  const startedAt = Date.now();
  let next = 0;

  // Pool cố định: mỗi worker nhận câu kế tiếp cho tới khi hết câu hoặc hết
  // giờ. Kiểm trần đồng hồ TRƯỚC khi nhận câu mới — đó là thứ giữ cho số câu
  // "đã claim, chưa settle" bị chặn trần.
  async function worker(): Promise<void> {
    for (;;) {
      if (Date.now() - startedAt > ESSAY_PASS_BUDGET_MS) return;
      const index = next;
      next += 1;
      if (index >= targets.length) return;
      await gradeOne(ctx, targets[index]);
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(GROQ_MAX_CONCURRENCY, targets.length) }, () => worker())
    );
  } catch {
    // `gradeOne()` đã nuốt mọi thứ của riêng nó; lưới này bắt phần còn lại của
    // chính vòng điều phối. Không có lối nào để một exception thoát ra
    // `after()`.
    console.error("[gradeEssays]", { attemptId, code: "unexpected" });
  }
}
