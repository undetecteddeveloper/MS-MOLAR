// BACKFILL điểm sang luật mới (G2 — B1 + B2 + B3, 2026-09-01).
//
//   npx tsx scripts/backfill-scores.ts            # DRY-RUN, không ghi gì
//   npx tsx scripts/backfill-scores.ts --apply    # ghi thật
//
// ═══ VÌ SAO PHẢI CÓ ═══
//
// `computeScore()` được gọi ĐÚNG MỘT CHỖ — `features/exams/actions.ts`, lúc nộp
// bài. Không nơi nào tính lại; mọi bề mặt khác chỉ ĐỌC `exam_results.total_score`
// (lịch sử làm bài, xếp hạng đề gợi ý, analytics). Nên nếu không backfill thì
// HAI THANG ĐIỂM SỐNG CHUNG TRONG MỘT CỘT: lượt thi hôm qua chấm theo tỉ lệ,
// lượt thi ngày mai trên CÙNG một đề chấm theo trọng số, cùng đổ vào một biểu
// đồ, và không có gì đánh dấu số nào thuộc luật nào.
//
// ═══ VÌ SAO TÍNH LẠI ĐƯỢC MÀ KHÔNG CẦN LƯỢT THI GỐC ═══
//
// `per_question` đã lưu đủ lựa chọn của học sinh từng câu (`selected`). Cộng với
// câu hỏi đọc lại từ `questions`, `computeScore()` dựng lại được toàn bộ kết quả
// — không cần `attempt_answers`, không cần phiên làm bài.
//
// ═══ ĐƯỜNG LUI ═══
//
// Trước khi ghi đè, `total_score` cũ được chụp vào `total_score_legacy` (§8e).
// Chỉ chụp khi cột đó còn NULL, nên chạy lại script KHÔNG bao giờ đè mất ảnh
// chụp gốc bằng một giá trị đã-mới. Lùi lại:
//
//   update public.exam_results
//      set total_score = total_score_legacy, total_score_legacy = null
//    where total_score_legacy is not null;
//
// ═══ ĐIỀU SCRIPT NÀY CỐ Ý KHÔNG LÀM ═══
//
// KHÔNG đụng `correct`, `total`, `topic_breakdown`: ba giá trị đó giữ nguyên
// nghĩa qua B1/B2/B3 (đếm câu chấm tự động), nên tính lại chúng chỉ tạo cơ hội
// sai. KHÔNG đụng band tự luận đã ghi — nó là kết quả chấm thật, script chỉ
// quy nó về `earnedPoints` theo trọng số của câu.

import { createClient } from "@supabase/supabase-js";
import { computeScore, scoreFromPoints, sumPoints } from "@/lib/scoring/computeScore";
import { maxPointsOf } from "@/lib/scoring/questionPoints";
import { ESSAY_KEYS } from "@/lib/scoring/essayLifecycle";
import type { Question } from "@/types/question";
import type { PerQuestionResult } from "@/types/result";

const APPLY = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Nạp .env trước, ví dụ: npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-scores.ts",
  );
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

type ResultRow = {
  attempt_id: string;
  total_score: number;
  total_score_legacy: number | null;
  per_question: PerQuestionResult[];
  exam_attempts: { exam_id: string } | null;
};

/** Câu hỏi của một đề, khoá theo id. Cache theo `exam_id` — nhiều lượt thi dùng
 *  chung một đề, và mỗi lượt đọc lại cả đề là một round-trip thừa. */
const questionCache = new Map<string, Map<string, Question>>();

async function questionsOf(examId: string): Promise<Map<string, Question>> {
  const cached = questionCache.get(examId);
  if (cached) return cached;

  const { data: exam, error: eErr } = await db
    .from("exams")
    .select("question_ids")
    .eq("id", examId)
    .maybeSingle();
  if (eErr) throw eErr;

  const ids = (exam?.question_ids as string[] | undefined) ?? [];
  const { data, error } = await db
    .from("questions")
    .select(
      "id, content, choices, correct_answer, subject, grade, topic, question_type, sub_answers, essay_answer, points",
    )
    .in("id", ids);
  if (error) throw error;

  const map = new Map<string, Question>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(r.id as string, {
      id: r.id as string,
      content: r.content as string,
      choices: (r.choices ?? []) as Question["choices"],
      correctAnswer: r.correct_answer as Question["correctAnswer"],
      subject: r.subject as string,
      grade: r.grade as number,
      topic: r.topic as string,
      questionType: (r.question_type as Question["questionType"]) ?? "mcq",
      subAnswers: (r.sub_answers as Question["subAnswers"]) ?? undefined,
      essayAnswer: (r.essay_answer as string | null) ?? undefined,
      // `numeric` về từ driver có thể là CHUỖI — cùng phép chuẩn hoá mà
      // submitExam() dùng ở biên của nó.
      points: r.points == null ? undefined : Number(r.points),
    });
  }
  questionCache.set(examId, map);
  return map;
}

/** Điểm mới của một lượt thi, hoặc `null` khi không dựng lại được.
 *
 *  Band tự luận ĐÃ CHẤM được giữ nguyên và quy về `earnedPoints` theo trọng số
 *  của câu: `computeScore()` luôn phát `earnedPoints: 0` cho câu tự luận (lúc
 *  nộp thì chưa ai chấm), nên nếu chỉ dùng thẳng đầu ra của nó thì mọi bài văn
 *  đã chấm sẽ bị đưa về 0 — tức backfill sẽ XOÁ kết quả chấm thật. */
function recompute(row: ResultRow, questions: Map<string, Question>) {
  const ordered = row.per_question
    .map((entry) => questions.get(entry.questionId))
    .filter((q): q is Question => q !== undefined);
  if (ordered.length === 0) return null;

  const answers: Record<string, string> = {};
  for (const entry of row.per_question) {
    if (typeof entry.selected === "string") answers[entry.questionId] = entry.selected;
  }

  // Cờ BẬT khi dựng lại: một câu tự luận có đáp án mẫu thuộc về mẫu số của đề
  // bất kể biến môi trường đang bật hay tắt lúc script chạy — trạng thái của
  // một process vận hành không được phép quyết định thang điểm của học sinh.
  const fresh = computeScore(ordered, answers, { essayGrading: true });

  const bandByQuestion = new Map<string, { earned: number; state: string }>();
  for (const entry of row.per_question) {
    // Khoá vòng đời tới từ jsonb nên không nằm trong kiểu tĩnh — đọc qua
    // Reflect.get, cùng lối `essayLifecycle.storedValue()` đã dùng.
    //
    // Tên khoá lấy từ `ESSAY_KEYS`, KHÔNG gõ chuỗi: `essayLifecycle.test.ts`
    // quét mã nguồn và đỏ nếu sáu literal ấy xuất hiện ở file thứ hai — đúng
    // cổng đã bắt được file này lần đầu.
    const state = Reflect.get(entry, ESSAY_KEYS.state);
    const earned = Reflect.get(entry, ESSAY_KEYS.earned);
    if (typeof state === "string") {
      bandByQuestion.set(entry.questionId, {
        state,
        earned: typeof earned === "number" && Number.isFinite(earned) ? earned : 0,
      });
    }
  }

  const merged: PerQuestionResult[] = fresh.perQuestion.map((entry, i) => {
    const band = bandByQuestion.get(entry.questionId);
    if (!band) return entry;
    const q = ordered[i];
    // Giữ nguyên MỌI khoá vòng đời đã lưu (state/earned/max/attempts/gradedAt)
    // — chúng là kết quả chấm thật, script không được phép viết lại.
    const stored = row.per_question.find((e) => e.questionId === entry.questionId) ?? {};
    // AC-015 — câu tự luận CHƯA `graded` đứng ngoài CẢ tử lẫn mẫu. Cùng quy tắc
    // mà `record_essay_grade()` áp lúc tính lại, và cùng quy tắc mà
    // `summariseEssays()` áp cho dòng hiển thị. Ba chỗ phải nói một chuyện, nếu
    // không thì backfill và lượt chấm tiếp theo cho hai con số khác nhau trên
    // CÙNG một lượt thi.
    //
    // Bỏ hẳn `maxPoints` (chứ không ghi 0) để `sumPoints()` bỏ qua dòng — đó là
    // hợp đồng đã khai của nó.
    if (band.state !== "graded") {
      const rest: PerQuestionResult = { ...entry, ...stored };
      delete rest.maxPoints;
      delete rest.earnedPoints;
      return rest;
    }
    return {
      ...entry,
      ...stored,
      earnedPoints: band.earned * maxPointsOf(q),
      maxPoints: maxPointsOf(q),
    };
  });

  const points = sumPoints(merged);
  return { totalScore: scoreFromPoints(points.earnedPoints, points.maxPoints), merged };
}

async function main() {
  console.log(APPLY ? "== BACKFILL: GHI THẬT ==" : "== BACKFILL: DRY-RUN (không ghi gì) ==");

  const { data, error } = await db
    .from("exam_results")
    .select("attempt_id, total_score, total_score_legacy, per_question, exam_attempts!inner(exam_id)")
    .order("attempt_id");
  if (error) throw error;

  const rows = (data ?? []) as unknown as ResultRow[];
  console.log(`Đọc được ${rows.length} lượt thi đã chấm.\n`);

  let changed = 0;
  let unchanged = 0;
  let skipped = 0;
  const table: Array<[string, number, number, string]> = [];

  for (const row of rows) {
    const examId = row.exam_attempts?.exam_id;
    if (!examId) {
      skipped += 1;
      continue;
    }
    const questions = await questionsOf(examId);
    const next = recompute(row, questions);
    if (!next) {
      skipped += 1;
      continue;
    }

    const delta = Math.round((next.totalScore - row.total_score) * 100) / 100;
    if (delta === 0) {
      unchanged += 1;
      continue;
    }
    changed += 1;
    table.push([row.attempt_id.slice(0, 8), row.total_score, next.totalScore, examId]);

    if (APPLY) {
      const { error: uErr } = await db
        .from("exam_results")
        .update({
          total_score: next.totalScore,
          per_question: next.merged,
          // Chỉ chụp LẦN ĐẦU: chạy lại script không được đè ảnh chụp gốc bằng
          // một giá trị đã-mới, nếu không đường lui trỏ vào chính luật mới.
          ...(row.total_score_legacy === null && { total_score_legacy: row.total_score }),
        })
        .eq("attempt_id", row.attempt_id);
      if (uErr) {
        console.error(`  ✗ ${row.attempt_id}: ${uErr.message}`);
      }
    }
  }

  if (table.length > 0) {
    console.log("attempt   cũ  →  mới   đề");
    console.log("-".repeat(52));
    for (const [id, before, after, examId] of table) {
      const arrow = after > before ? "↑" : "↓";
      console.log(
        `${id}  ${before.toFixed(2).padStart(5)} → ${after.toFixed(2).padStart(5)} ${arrow}  ${examId}`,
      );
    }
    console.log();
  }

  console.log(`Đổi điểm : ${changed}`);
  console.log(`Giữ nguyên: ${unchanged}   (đề thuần trắc nghiệm cân bằng — đúng như thiết kế)`);
  console.log(`Bỏ qua   : ${skipped}   (không dựng lại được câu hỏi)`);
  if (!APPLY && changed > 0) {
    console.log("\nChưa ghi gì. Chạy lại với --apply để ghi thật.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
