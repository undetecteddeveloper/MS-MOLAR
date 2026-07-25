// Logic Layer 2 — Writes / Server Actions (GĐ 2 M2.6).
// Persist attempt theo Q2=A (batch on submit): submitExam ghi toàn bộ answers +
// chấm điểm server-side một lần. Xem BACK-END-ARCHITECTURE-MAP.md Mục 4.2.
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidPartScore } from "@/lib/rating";
import { computeScore } from "@/lib/scoring/computeScore";
import type { ChoiceId, Question } from "@/types/question";

/**
 * Tạo attempt mới cho đề → trả attemptId thật từ DB (thay crypto.randomUUID GĐ 1).
 * user_id tự gán = auth.uid() (default cột + RLS). Redirect thẳng vào player.
 */
export async function startAttempt(examId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_attempts")
    .insert({ exam_id: examId })
    .select("id")
    .single();
  if (error) throw error;

  redirect(`/exams/${examId}/attempt/${data.id}`);
}

/**
 * Nộp bài: batch-insert answers, chấm điểm server-side với đáp án từ DB,
 * lưu exam_results, khóa attempt. Idempotent — đã nộp thì redirect thẳng kết quả.
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
    .select("id, exam_id, status")
    .eq("id", attemptId)
    .maybeSingle();
  if (attemptErr) throw attemptErr;
  if (!attempt) redirect("/exams");
  const examId = attempt.exam_id as string;

  // Đã nộp rồi → không chấm lại.
  if (attempt.status === "submitted") {
    redirect(`/exams/${examId}/attempt/${attemptId}/result`);
  }

  // 2. Lấy câu hỏi ĐẦY ĐỦ (kèm correct_answer) theo thứ tự đề — server-only.
  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .select("question_ids")
    .eq("id", examId)
    .single();
  if (examErr) throw examErr;
  const questionIds = examRow.question_ids as string[];

  // v2.1: thêm question_type để computeScore biết câu nào KHÔNG chấm
  // (true_false/short_answer/essay — stored, not auto-scored).
  const { data: qRows, error: qErr } = await supabase
    .from("questions")
    // sub_answers: đáp án Đ/S từng ý của true_false — cần cho computeScore
    // chấm (v2.1 true_false auto-scored, 2026-07-21). Không lộ ra client player
    // (PublicQuestion Omit) — chỉ dùng server-side ngay trong hàm này.
    .select(
      "id, content, choices, correct_answer, subject, grade, topic, question_type, sub_answers"
    )
    .in("id", questionIds);
  if (qErr) throw qErr;

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
      } satisfies Question,
    ])
  );
  const questions = questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined);

  // 3. Batch-insert answers (null nếu bỏ trống; cắt 500 ký tự khớp CHECK v2.1).
  const answerRows = questions.map((q) => ({
    attempt_id: attemptId,
    question_id: q.id,
    answer: answers[q.id]?.slice(0, 500) ?? null,
  }));
  const { error: ansErr } = await supabase
    .from("attempt_answers")
    .upsert(answerRows, { onConflict: "attempt_id,question_id" });
  if (ansErr) throw ansErr;

  // 4. Chấm điểm server-side (tracer code computeScore — M1.6).
  const score = computeScore(questions, answers);

  // 5. Lưu kết quả (user_id default auth.uid()).
  const { error: resErr } = await supabase.from("exam_results").insert({
    attempt_id: attemptId,
    total_score: score.totalScore,
    correct: score.correct,
    total: score.total,
    per_question: score.perQuestion,
    topic_breakdown: score.topicBreakdown,
  });
  if (resErr) throw resErr;

  // 6. Khóa attempt.
  const { error: updErr } = await supabase
    .from("exam_attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (updErr) throw updErr;

  redirect(`/exams/${examId}/attempt/${attemptId}/result`);
}

/**
 * Đánh giá độ khó đề (Rating System, ADR-0008 Decision 3). Trả status object
 * (KHÔNG redirect) để modal giữ nguyên 3 điểm đã nhập khi lỗi (AC-025).
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
): Promise<{ error?: "ineligible" | "invalid" | "server" }> {
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
  const { count } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .eq("status", "submitted");
  if (!count) return { error: "ineligible" };

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
