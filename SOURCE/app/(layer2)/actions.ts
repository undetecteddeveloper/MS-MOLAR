// Logic Layer 2 — Writes / Server Actions (GĐ 2 M2.6).
// Persist attempt theo Q2=A (batch on submit): submitExam ghi toàn bộ answers +
// chấm điểm server-side một lần. Xem BACK-END-ARCHITECTURE-MAP.md Mục 4.2.
"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gradeEssaysForAttempt } from "@/lib/essay/gradeEssays";
import { recordExamResult, recordSkillMastery } from "@/lib/supabase/service-role";
import { guard } from "@/lib/security/rateLimit";
import { isValidPartScore } from "@/lib/rating";
import { computeScore } from "@/lib/scoring/computeScore";
import { LIMITS } from "@/lib/ugc/limits";
import type { ChoiceId, Question } from "@/types/question";

/**
 * Tạo attempt mới cho đề → trả attemptId thật từ DB (thay crypto.randomUUID GĐ 1).
 * user_id tự gán = auth.uid() (default cột + RLS). Redirect thẳng vào player.
 */
export async function startAttempt(examId: string) {
  const supabase = await createClient();

  // Đề phải ĐANG PUBLISHED mới cho bắt đầu làm (Security review 2026-08-03 Low).
  // Trước đây thiếu: attempts_insert_own chỉ soi user_id, còn FK chỉ đòi đề tồn
  // tại — nên tạo được attempt trên đề nháp/đề của người khác nếu biết id.
  // Tự nó không lộ dữ liệu (câu hỏi của đề chưa published vẫn bị RLS chặn, và
  // exam_answer_key §10a đòi published ở nhánh "đã nộp"), nhưng để lại attempt
  // rác trỏ vào đề không xem được, và lệch với guard "chỉ published" mà mọi
  // đường đọc khác đều áp. `.eq("status","published")` chồng lên RLS
  // exams_select_visible — RLS còn cho tác giả thấy đề nháp CỦA MÌNH, filter
  // này chặn cả trường hợp đó.
  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .eq("status", "published")
    .maybeSingle();
  if (examErr) throw examErr;
  if (!exam) redirect("/exams");

  const { data, error } = await supabase
    .from("exam_attempts")
    .insert({ exam_id: examId })
    .select("id")
    .single();
  if (error) throw error;

  redirect(`/exams/${examId}/attempt/${data.id}`);
}

/**
 * Nộp bài: khóa attempt + lấy đáp án (một RPC atomic), batch-insert answers,
 * chấm điểm server-side, lưu exam_results. Idempotent — đã nộp thì redirect
 * thẳng kết quả.
 */
export async function submitExam(
  attemptId: string,
  // v2.1: string — mcq "A".."D"; true_false "a:Đ,b:S,..."; short_answer text.
  answers: Record<string, string>
) {
  const supabase = await createClient();

  // 1. Lấy attempt (RLS đảm bảo thuộc về user hiện tại).
  const { data: attempt, error: attemptErr } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, status, user_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (attemptErr) throw attemptErr;
  if (!attempt) redirect("/exams");
  const examId = attempt.exam_id as string;

  // Rate limit (Security review Low). Khoá lấy từ chính dòng attempt vừa đọc —
  // RLS đã lọc về attempt của người gọi nên user_id này đáng tin, và không tốn
  // thêm round-trip nào (khác với gọi auth.getUser()).
  const rl = await guard("submitExam", attempt.user_id as string);
  if (!rl.ok) {
    throw new Error(
      `Too many submissions. Try again in ${rl.retryAfterSeconds} seconds.`
    );
  }

  // Đã nộp rồi → không chấm lại.
  if (attempt.status === "submitted") {
    redirect(`/exams/${examId}/attempt/${attemptId}/result`);
  }

  // 2. Thứ tự câu hỏi trong đề (đáp án lấy ở bước 3, không phải ở đây).
  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .select("question_ids")
    .eq("id", examId)
    .single();
  if (examErr) throw examErr;
  const questionIds = examRow.question_ids as string[];

  // 3. KHÓA attempt + lấy đáp án — một RPC, atomic (schema.sql §10b).
  //
  // Không select thẳng từ `questions` được nữa: correct_answer/sub_answers/
  // essay_answer đã bị REVOKE khỏi role `authenticated` (Security review
  // 2026-08-03 #1) vì Server Action này chạy bằng chính JWT của học sinh —
  // cái gì code này đọc được thì devtools cũng đọc được. claim_attempt_answer_
  // key() đóng attempt TRƯỚC rồi mới trả đáp án, nên "lấy được đáp án" và "còn
  // làm bài được" loại trừ lẫn nhau ở tầng DB, không phải ở tầng app.
  //
  // Hệ quả về thứ tự: attempt chuyển 'submitted' TẠI ĐÂY, không phải ở cuối
  // hàm nữa (bước 6 cũ đã bỏ). Câu trả lời + kết quả ghi sau — an toàn vì RLS
  // answers_insert_own/results_insert_own chỉ soi quyền sở hữu, không soi status.
  const { data: qRows, error: qErr } = await supabase.rpc("claim_attempt_answer_key", {
    p_attempt_id: attemptId,
  });
  if (qErr) throw qErr;
  // 0 dòng = attempt bị nộp mất giữa chừng bởi một request song song (bước 1 đã
  // xác nhận nó là của user và còn in_progress) → xử như nhánh idempotent ở trên.
  if (!qRows || (qRows as unknown[]).length === 0) {
    redirect(`/exams/${examId}/attempt/${attemptId}/result`);
  }

  const byId = new Map<string, Question>(
    (qRows as Array<Record<string, unknown>>).map((r) => [
      r.id as string,
      {
        id: r.id as string,
        content: r.content as string,
        choices: r.choices as Question["choices"],
        correctAnswer: r.correct_answer as ChoiceId,
        subject: r.subject as string,
        grade: r.grade as number,
        topic: r.topic as string,
        questionType: (r.question_type as Question["questionType"]) ?? "mcq",
        subAnswers: (r.sub_answers as Question["subAnswers"]) ?? undefined,
        essayAnswer: (r.essay_answer as string | null) ?? undefined,
        // B1 — trọng số câu, đọc từ `claim_attempt_answer_key()`. Cột là
        // `numeric` nên driver có thể trả về CHUỖI ("2.00"), không phải số:
        // chuẩn hoá ngay tại biên. Bỏ dòng này thì mọi đề chấm như nhau và cả
        // B1 im lặng không có tác dụng gì.
        points:
          typeof r.points === "number"
            ? r.points
            : typeof r.points === "string" && r.points.trim() !== "" && Number.isFinite(Number(r.points))
              ? Number(r.points)
              : undefined,
      } satisfies Question,
    ])
  );
  const questions = questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined);

  // 4. Batch-insert answers (null nếu bỏ trống; cắt khớp CHECK v2.1).
  // LIMITS.MAX_ATTEMPT_ANSWER thay số 500 viết cứng: ô nhập tự luận ở
  // QuestionRenderer đọc CÙNG hằng số đó để đếm ký tự còn lại — hai nơi lệch
  // nhau thì người làm bài gõ tới trần mà vẫn bị cắt âm thầm ở đây.
  const answerRows = questions.map((q) => ({
    attempt_id: attemptId,
    question_id: q.id,
    answer: answers[q.id]?.slice(0, LIMITS.MAX_ATTEMPT_ANSWER) ?? null,
  }));
  const { error: ansErr } = await supabase
    .from("attempt_answers")
    .upsert(answerRows, { onConflict: "attempt_id,question_id" });
  if (ansErr) throw ansErr;

  // 5. Chấm điểm server-side (tracer code computeScore — M1.6).
  //
  // Cờ chấm tự luận đọc Ở ĐÂY và truyền VÀO — `computeScore()` thuần và không
  // bao giờ tự đọc `process.env` (AC-013). Quy tắc đọc là fail-closed và giống
  // hệt ở cả ba chỗ đọc cờ: CHỈ chuỗi `"true"` đã trim mới là bật; mọi giá trị
  // khác, kể cả vắng mặt, là tắt. Tính năng ship ở trạng thái vắng mặt.
  const essayGrading = process.env.ESSAY_GRADING_ENABLED?.trim() === "true";
  const score = computeScore(questions, answers, { essayGrading });

  // 6. Lưu kết quả. KHÔNG ghi bằng `supabase` (JWT của học sinh) được nữa:
  // role `authenticated` đã mất hẳn INSERT trên exam_results (Security review
  // 2026-08-03 #2, schema.sql §11a) vì trước đây học sinh POST thẳng một dòng
  // điểm bịa vào REST API là xong. Điểm nay chỉ đi qua service role, và
  // record_exam_result() tự suy ra user_id từ attempt + đòi attempt đã
  // 'submitted' (§11b) — call site không tự khai được gì.
  const { error: resErr } = await recordExamResult(attemptId, score);
  if (resErr) {
    console.error("[submitExam] recordExamResult", resErr.code, resErr.message);
    throw new Error("Could not save your result. Try again.");
  }

  // 7. Cộng dồn mastery theo kỹ năng (Engine 1, ADR-0011) — BƯỚC RIÊNG, chạy
  // SAU khi điểm đã ghi xong, và ĐƯỢC PHÉP HỎNG. Không gộp vào
  // record_exam_result(): cùng một câu lệnh nghĩa là cùng một transaction, nên
  // một dữ liệu bất thường bên mastery sẽ rollback luôn dòng điểm — hỏng đường
  // load-bearing vì một lý do học sinh không liên quan gì.
  //
  // try/catch KHÔNG thừa dù recordSkillMastery() trả {error} thay vì ném: nó
  // vẫn ném được khi thiếu env service-role (serviceRoleClient()). Cả hai lối
  // đều chỉ log — nuốt ở đây là cơ chế DUY NHẤT giữ lời hứa "mastery hỏng không
  // làm hỏng nộp bài", nên đừng đổi thành throw.
  //
  // Hệ quả đã chấp nhận (ADR-0011): request chết giữa bước 6 và bước 7 để lại
  // bài đã chấm mà chưa có mastery, và nhánh idempotent ở trên nghĩa là nộp lại
  // KHÔNG tự chữa. Đó là khoảng hở hẹp đã ghi nhận, không phải chỗ để thêm cơ
  // chế bù — điểm thì không bao giờ bị rollback vì lý do này.
  try {
    const { error: masteryErr } = await recordSkillMastery(attemptId, score);
    if (masteryErr) {
      console.error("[submitExam] recordSkillMastery", masteryErr.code, masteryErr.message);
    }
  } catch (err) {
    console.error("[submitExam] recordSkillMastery", err);
  }

  // 8. Pass chấm tự luận — ĐĂNG KÝ TRƯỚC `redirect()`, và thứ tự đó là bắt
  // buộc chứ không phải sở thích: `redirect()` ném một control-flow exception,
  // nên mọi dòng SAU nó không bao giờ chạy. Đăng ký `after()` phía sau
  // `redirect()` nghĩa là KHÔNG BAO GIỜ đăng ký — và chế độ hỏng ấy vô hình
  // trong lúc cờ còn tắt, rồi lặng lẽ không chấm gì cả vào đúng ngày cờ được
  // bật. Tiền lệ và luật thành văn: `lib/support/actions.ts:122-127`.
  //
  // `supabase` được BẮT VÀO CLOSURE ở đây, chứ không dựng lại bên trong
  // callback (R-05): instance này mang JWT của học sinh, và đường telemetry
  // cần đúng danh tính đó — policy `telemetry_insert_own` là
  // `with check (user_id = auth.uid())`, nên một lượt ghi bằng service_role
  // với `user_id` null bị từ chối thẳng.
  //
  // Chỉ câu `essay` CÓ đáp án mẫu mới vào tập mục tiêu (AC-038/EG-BE-003) —
  // cùng guard ground-truth-presence mà `computeScore()` vừa dùng để quyết
  // định có phát khoá vòng đời hay không. Hai bên lệch nhau nghĩa là một câu
  // mang `pending` mà pass không bao giờ chạm tới, hoặc ngược lại.
  if (essayGrading) {
    const targets = questions
      .filter((q) => (q.questionType ?? "mcq") === "essay" && Boolean(q.essayAnswer?.trim()))
      .map((q) => ({
        questionId: q.id,
        questionContent: q.content,
        referenceAnswer: q.essayAnswer ?? "",
        studentAnswer: answers[q.id] ?? "",
      }));
    if (targets.length > 0) {
      // `attempt.user_id` chứ không phải một `auth.getUser()` mới: dòng attempt
      // đã qua RLS nên giá trị này ĐÚNG BẰNG `auth.uid()`, và telemetry của pass
      // chấm phải mang đúng danh tính đó để `telemetry_insert_own`
      // (`with check (user_id = auth.uid())`) không từ chối thẳng. Cùng lập luận
      // khoá rate-limit ở đầu hàm đã dùng, và không tốn thêm round-trip nào.
      const userId = attempt.user_id as string;
      after(() => gradeEssaysForAttempt({ attemptId, userId, targets, supabase }));
    }
  }

  redirect(`/exams/${examId}/attempt/${attemptId}/result`);
}

/**
 * Đánh giá độ khó đề (Rating System, ADR-0008 Decision 3). Trả status object
 * (KHÔNG redirect) để RatingRubric giữ nguyên 3 điểm đã nhập khi lỗi (AC-025).
 * UPSERT theo (exam_id,user_id) — 1 rating/user/đề, sửa được (AC-012).
 *
 * Eligibility precheck (đã có attempt 'submitted') chỉ là UX; RLS
 * insert/update-own mới là gate thật — with-check re-verify độc lập user_id/
 * published/submitted-attempt trên mọi lần ghi, nên bypass precheck (gọi
 * thẳng Supabase client) vẫn không ghi được (AC-008).
 */
export async function rateExam(
  examId: string,
  scores: { partI: number; partII: number; partIII: number }
): Promise<{ error?: "ineligible" | "invalid" | "rate_limited" | "server" }> {
  if (
    !isValidPartScore(scores.partI) ||
    !isValidPartScore(scores.partII) ||
    !isValidPartScore(scores.partIII)
  ) {
    return { error: "invalid" };
  }

  const supabase = await createClient();

  // Precheck UX (không phải gate): đã có attempt 'submitted' cho đề này chưa.
  // exam_attempts đã tự lọc về của chính mình qua RLS attempts_select_own
  // (cùng tiền lệ listMySubmittedExamIds) — không cần .eq("user_id", ...).
  //
  // Lấy user_id thay vì count-head (2026-08-03): cùng MỘT round-trip như trước,
  // nhưng trả luôn khoá cho rate limit bên dưới. Cách khác là gọi
  // auth.getUser() — thêm hẳn một round-trip mạng cho mỗi lần rate, đắt hơn
  // nhiều so với việc đổi hình dạng của query vốn đã phải chạy.
  const { data: eligible } = await supabase
    .from("exam_attempts")
    .select("user_id")
    .eq("exam_id", examId)
    .eq("status", "submitted")
    .limit(1)
    .maybeSingle();
  if (!eligible) return { error: "ineligible" };

  // Rate limit (Security review Low) — rateExam là UPSERT nên unique
  // (exam_id,user_id) KHÔNG chặn được việc gọi lại liên tục để sửa điểm.
  const rl = await guard("rateExam", eligible.user_id as string);
  if (!rl.ok) return { error: "rate_limited" };

  // user_id KHÔNG truyền vào — cột default auth.uid() (không nhận từ input).
  const { error } = await supabase.from("exam_difficulty_ratings").upsert(
    {
      exam_id: examId,
      score_part1: scores.partI,
      score_part2: scores.partII,
      score_part3: scores.partIII,
    },
    { onConflict: "exam_id,user_id" }
  );
  if (error) {
    // RLS chặn (không đủ điều kiện) hoặc lỗi hạ tầng — không lộ chi tiết.
    console.error("[rateExam]", error.code, error.message);
    return { error: "server" };
  }
  return {};
}

/**
 * Điểm 3 phần của chính user cho đề này, hoặc null nếu chưa đánh giá
 * (AC-013 — tiền điền form "đã đánh giá"). Chỉ đọc row của mình qua RLS
 * ratings_select_own (mirrors hasReported).
 */
export async function getMyRating(
  examId: string
): Promise<{ partI: number; partII: number; partIII: number } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_difficulty_ratings")
    .select("score_part1, score_part2, score_part3")
    .eq("exam_id", examId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { score_part1: number; score_part2: number; score_part3: number };
  return { partI: row.score_part1, partII: row.score_part2, partIII: row.score_part3 };
}
