// Kết quả một lượt thi + màn Chi tiết sau khi nộp.
//
// Đây là nơi DUY NHẤT trong thư mục được đọc đáp án, và chỉ qua RPC
// `exam_answer_key()` — hàm đó tự kiểm người gọi là tác giả hay đã nộp bài.
//
// Tách khỏi `features/exams/queries.ts` (835 dòng) ngày 2026-09-03, mục 7 của
// đợt refactor. Đường import ngoài KHÔNG đổi — `@/features/exams/queries` nay
// phân giải vào `queries/index.ts`.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { computeWrongTwiceQuestionIds, type WrongTwiceAttempt } from "@/lib/scoring/wrongTwice";
import {
  deriveEssayView,
  hasIncompleteEssay,
  summariseEssays,
  type EssaySummary,
} from "@/lib/scoring/essayLifecycle";
import { resolveSignedImageUrls } from "@/lib/ugc/imageUrl";
import type { Choice } from "@/types/question";
import type { PerQuestionResult, ScoreResult } from "@/types/result";


type ResultRow = {
  total_score: number;
  correct: number;
  total: number;
  per_question: ScoreResult["perQuestion"];
  topic_breakdown: ScoreResult["topicBreakdown"];
  /** Mốc bắt đầu của hạn chờ chấm tự luận (ADR-0018/AC-026). KHÔNG có trong
   *  select trước ADR-0018 — D-02. `exam_attempts.submitted_at` KHÔNG thay thế
   *  được: hai mốc lệch nhau đúng bằng thời gian `record_exam_result()` chạy,
   *  và AC-026 nêu đích danh `exam_results.created_at`. */
  created_at: string;
};

/** Nội dung một câu để render màn Chi tiết (post-submit nên kèm được lựa chọn).
 * v2.1: kèm loại câu + đáp án lưu trữ của câu KHÔNG chấm (true_false/short/
 * essay) — màn Chi tiết là SAU KHI NỘP, xem được đáp án (như mcq đã hiển thị
 * correct từ per_question). subItems của true_false nằm trong cột choices. */
export type ResultQuestion = {
  content: string;
  choices: Choice[];
  questionType: "mcq" | "essay" | "true_false" | "short_answer";
  subItems?: { id: "a" | "b" | "c" | "d"; text: string }[];
  subAnswers?: Partial<Record<"a" | "b" | "c" | "d", boolean>>;
  essayAnswer?: string;
  /** Hình thân câu, ĐÃ ký (signed URL) — `undefined` khi câu không có hình
   *  hoặc không ký được. Bucket exam-images PRIVATE nên URL lưu trong DB
   *  KHÔNG render được trực tiếp: `<img>` không gửi được header auth, ảnh về
   *  400 và trình duyệt chỉ hiện icon vỡ. Đây là lý do trường này tồn tại
   *  riêng thay vì để trang tự đọc `image_url` — cùng hợp đồng với
   *  `PublicQuestion.imageUrl` mà `getExamForPlayer()` đã trả cho màn làm bài. */
  imageUrl?: string;
  /** NGỮ LIỆU DÙNG CHUNG (A1) — nội dung bài đọc mà câu này tham chiếu, đã
   *  GIẢI SẴN từ `exam.passages`. Trang Chi tiết nhận chuỗi chứ không nhận
   *  khoá: nó dò lại từng câu một, và bắt nó tự tra một bảng thứ hai chỉ để
   *  hiện đúng đoạn văn là mời gọi cái bug "câu này mất bài đọc". */
  passageText?: string;
  passageTitle?: string;
};

export type ExamResult = {
  examId: string;
  examTitle: string;
  subject: string;
  result: ScoreResult;
  /** questionId → nội dung + lựa chọn (để render Chi tiết từng câu, Task 4). */
  questions: Record<string, ResultQuestion>;
  /** Luôn có mặt — exam_attempts.started_at NOT NULL DEFAULT now() (History). */
  startedAt: string;
  /** null khi truy cập trực tiếp URL attempt trong khoảng hở trước khi
   * submitExam() cập nhật xong status/submitted_at (History). */
  submittedAt: string | null;
  /** Số giây nộp QUÁ thời gian cho phép; 0 = trong giờ (Security review #6).
   * DB tự tính trong record_exam_result() từ started_at + duration_minutes —
   * client không khai được, kể cả khi tắt JS để vô hiệu hoá đồng hồ đếm ngược. */
  overtimeSeconds: number;
  /** Tổng hợp mức-lượt-thi của các câu tự luận, hoặc `undefined` khi KHÔNG dòng
   * nào mang khoá vòng đời (dòng cũ / tính năng tắt). `undefined` chứ không phải
   * một summary toàn số 0 chính là thứ giữ AC-012 đúng trên đường ĐỌC: một dòng
   * ghi trước khi tính năng ship không mọc thêm trường nào có giá trị. */
  essaySummary?: EssaySummary;
  /** Có câu tự luận nào đã dừng hẳn ở RS-6 (thất bại, hết lượt) không — điều
   * kiện in chú thích PDF (O-8/AC-058).
   *
   * BẮT BUỘC, không phải tuỳ chọn, và đó là chỗ hai mục của Design Doc bất đồng
   * (Open Item I-4): bản kế hoạch theo § Interface Change Matrix. Lý do là một
   * lý do sản phẩm chứ không phải sở thích kiểu — trường này là ĐẦU VÀO QUYẾT
   * ĐỊNH của chú thích PDF, nên một ca `undefined` ở đây là một tệp PDF không
   * quyết được nội dung. Luôn tính được: `false` khi không có khoá nào. */
  hasIncompleteEssay: boolean;
};

/** Lịch sử làm bài của CHÍNH user đang đăng nhập, rút gọn còn đúng phần
 * computeWrongTwiceQuestionIds() cần (Engine 1, backend DD § Data Contracts).
 *
 * KHÔNG lọc user_id: policy `results_select_own` (schema.sql §RLS) đã giới hạn
 * `user_id = auth.uid()`, và cột user_id không nằm trong projection này. Cũng
 * không lọc trạng thái: exam_results chỉ có dòng cho attempt ĐÃ NỘP, vì
 * record_exam_result() là đường ghi duy nhất và nó đòi status='submitted'.
 *
 * Dòng đang xem cũng nằm trong tập này — đúng theo contract ("across all
 * attempts including the current one being viewed").
 *
 * SUY GIẢM MỀM khi query lỗi, KHÁC với vòng 1 của getResult(): đây là dữ liệu
 * LÀM GIÀU cho một cờ hiển thị, không phải dữ liệu cốt lõi của trang. Trả []
 * → mọi hasBeenWrongTwice thành undefined → affordance không hiện, đúng trạng
 * thái fail-closed UI Spec §D1 đã định nghĩa ("Absent/false = affordance does
 * not render", AC-024). Ném lỗi ở đây sẽ đánh sập cả màn Chi tiết vốn đã chạy
 * tốt từ trước tính năng này — một lỗi nặng hơn hẳn lỗi nó báo. */
async function fetchWrongTwiceAttempts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<WrongTwiceAttempt[]> {
  // `readBounded` NÉM lỗi hạ tầng thay vì trả `error`, nên đường suy giảm mềm
  // của hàm này chuyển sang try/catch. Rộng hơn bản cũ chứ không hẹp hơn: nó bắt
  // cả exception, thứ mà nhánh `if (error)` cũ để lọt lên trên và đánh sập đúng
  // màn Chi tiết mà cả đoạn docblock trên cam kết không làm sập.
  let rows: { attempt_id: string; per_question: PerQuestionResult[] | null }[];
  try {
    rows = (await readBounded(
      "getResult.wrongTwiceHistory",
      supabase.from("exam_results").select("attempt_id, per_question")
    )) as { attempt_id: string; per_question: PerQuestionResult[] | null }[];
  } catch (err) {
    // Chỉ code + message: `details`/`hint` của PostgREST có thể chứa giá trị
    // dòng dữ liệu, không được đưa vào log.
    const e = err as { code?: string; message?: string };
    console.warn("[getResult] đọc lịch sử wrong-twice thất bại:", e.code, e.message);
    return [];
  }
  // per_question là jsonb → về lý thuyết có thể null với dòng hỏng; hàm thuần
  // nhận kiểu mảng chặt nên chuẩn hoá ngay tại ranh giới dữ liệu này.
  return rows.map((r) => ({ attemptId: r.attempt_id, perQuestion: r.per_question ?? [] }));
}

/**
 * Kết quả của một attempt đã nộp. null nếu attempt không tồn tại / chưa nộp /
 * không thuộc về user (RLS lọc) → caller redirect về trang đề (Q2=A).
 */
export async function getResult(attemptId: string): Promise<ExamResult | null> {
  const supabase = await createClient();

  // Vòng 1 — MỘT request cho cả 3 tầng: exam_results + attempt (FK) + đề (view).
  // Trước đây là 3 query nối đuôi (exam_results → exam_attempts → getExam) rồi
  // mới tới questions, tức 4×RTT; nay còn 2×RTT. Embed xuyên qua VIEW
  // exams_with_difficulty đã được kiểm chứng thực tế chạy được (view không có FK
  // metadata riêng nên KHÔNG hiển nhiên — đừng đổi sang bảng `exams`: bảng gốc
  // không có rating_count/avg_overall, hai cột đó chỉ tồn tại trên view, ADR-0008).
  //
  // Bốn nhánh trả null của bản cũ hội tụ về đúng một nhánh ở đây, không đổi kết
  // quả quan sát được: thiếu exam_results, hoặc attempt không tồn tại, hoặc đề
  // không published → `!inner` loại cả dòng → maybeSingle() trả null.
  // `.eq(...exams_with_difficulty.status,'published')` giữ đúng quy ước visibility
  // của getExam() (RLS lọc, VÀ thêm filter published tường minh chồng lên).
  // Chỉ lấy id/title/subject/passages của đề vì đó là tất cả những gì hàm này
  // dùng — cố ý KHÔNG kéo cả EXAM_COLUMNS để không ngụ ý rằng có sẵn nguyên
  // contract `Exam`. (`passages` vào danh sách từ A1: màn Chi tiết phải hiện
  // lại bài đọc, nếu không thì học sinh dò lại một câu đọc hiểu mà không có
  // đoạn văn — không cách nào hiểu vì sao mình sai.)
  //
  // Song song (KHÔNG nối đuôi) với vòng 1: lịch sử làm bài cho cờ
  // hasBeenWrongTwice. Hai query không phụ thuộc nhau — cái sau chỉ cần user
  // đang đăng nhập, không cần exam.id — nên gộp Promise.all giữ nguyên số RTT
  // quan sát được của getResult() (Engine 1 backend DD § Integration Points).
  const [{ data: joined, error: joinedErr }, wrongTwiceAttempts] = await Promise.all([
    supabase
      .from("exam_results")
      .select(
        "total_score, correct, total, per_question, topic_breakdown, overtime_seconds, created_at, exam_attempts!inner(started_at, submitted_at, exams_with_difficulty!inner(id, title, subject, passages))"
      )
      .eq("attempt_id", attemptId)
      .eq("exam_attempts.exams_with_difficulty.status", "published")
      .maybeSingle(),
    fetchWrongTwiceAttempts(supabase),
  ]);
  if (joinedErr) throw joinedErr;
  if (!joined) return null;

  const row = joined as unknown as ResultRow & {
    overtime_seconds: number | null;
    exam_attempts: {
      started_at: string;
      submitted_at: string | null;
      exams_with_difficulty: {
        id: string;
        title: string;
        subject: string;
        passages: { id: string; title?: string; text: string }[] | null;
      };
    };
  };
  const attempt = row.exam_attempts;
  const exam = attempt.exams_with_difficulty;

  // Cờ chỉ có nghĩa với câu ĐANG sai VÀ có chấm — mọi dòng khác để undefined
  // (backend DD § Data Contracts, Consumer-side gating: điều kiện nằm ở phía
  // caller chứ không nằm trong computeWrongTwiceQuestionIds()). Mọi trường cũ
  // của mỗi dòng giữ nguyên giá trị, chỉ thêm đúng một trường tuỳ chọn.
  const wrongTwiceQuestionIds = computeWrongTwiceQuestionIds(wrongTwiceAttempts);

  // MỘT `now` cho cả lượt đọc, đọc ĐÚNG MỘT LẦN — không phải một `new Date()`
  // cho mỗi dòng và một cái nữa cho summary. Hạn chờ là 10 phút và phép suy
  // diễn dùng biên LOẠI TRỪ, nên hai lần đọc đồng hồ cách nhau một phần triệu
  // giây vẫn có thể nằm hai bên hạn chờ: khi đó `essaySummary.pendingCount`
  // đếm một câu mà `perQuestion[i].essay.state` đã gọi là `"failed"`, và trang
  // kết quả tự mâu thuẫn với chính nó ở một khuyết tật không tái hiện được.
  const now = new Date();
  const createdAt = row.created_at;

  // Suy diễn ĐÚNG MỘT LẦN cho mỗi phần tử, và đó KHÔNG phải tối ưu hoá — nó là
  // một sửa lỗi. `summariseEssays()` và `hasIncompleteEssay()` mỗi hàm tự gấp
  // lại mảng một lượt, nên gọi thẳng cả ba trên `row.per_question` sẽ chạy
  // `deriveEssayView()` BA lần trên cùng một phần tử; với một `essayState` không
  // nhận ra, EG-BE-025 hứa ĐÚNG MỘT `console.warn` còn thực tế nhả ra ba, mỗi
  // lần render. Một test của Task B2.1 bắt được đúng chuyện đó.
  const essayViews = row.per_question.map((r) => deriveEssayView(r, createdAt, now));

  // Chỉ những phần tử THỰC SỰ suy ra được view mới đi tiếp vào hai hàm tổng
  // hợp. Đầu ra không đổi một chút nào: `essayLifecycle` vốn đã bỏ qua mọi phần
  // tử suy ra `null` (dòng cũ, câu không phải tự luận, giá trị lạ), nên lọc
  // trước hay lọc trong đều cho cùng tập view — khác nhau duy nhất ở chỗ phần
  // tử hỏng không bị hỏi lại hai lần nữa.
  const derivableRows = row.per_question.filter((_, i) => essayViews[i] !== null);

  const perQuestion: PerQuestionResult[] = row.per_question.map((r, i) => ({
    ...r,
    hasBeenWrongTwice:
      r.scored !== false && !r.isCorrect ? wrongTwiceQuestionIds.has(r.questionId) : undefined,
    // `?? undefined` chứ không giữ `null`: `null` là câu trả lời của
    // `deriveEssayView()` ("dòng này KHÔNG ÁP DỤNG"), còn hợp đồng đọc phơi ra
    // ngoài dùng `undefined` cho đúng ca đó — cùng quy ước với
    // `hasBeenWrongTwice` ngay trên.
    essay: essayViews[i] ?? undefined,
  }));

  const result: ScoreResult = {
    totalScore: row.total_score,
    correct: row.correct,
    total: row.total,
    perQuestion,
    topicBreakdown: row.topic_breakdown,
  };

  // Vòng 2 — questions phụ thuộc vòng 1 (cần exam.id) nên buộc phải tuần tự.
  // Không gộp được vào vòng 1: liên kết đề↔câu hỏi đi qua mảng `question_ids`
  // (text[]) / `per_question` (jsonb), không phải FK, nên PostgREST không embed
  // được. Nội dung + lựa chọn để render Chi tiết (post-submit nên hiển thị được);
  // v2.1 kèm question_type + đáp án lưu trữ cho câu không chấm.
  //
  // RPC chứ không phải .from("questions"): sub_answers/essay_answer đã bị REVOKE
  // khỏi role `authenticated` (Security review 2026-08-03 #1 — RLS lọc dòng chứ
  // không lọc cột, nên đọc thẳng bảng thì devtools cũng đọc được đáp án của đề
  // chưa làm). exam_answer_key() chỉ nhả đáp án cho tác giả hoặc người ĐÃ nộp
  // bài đề đó (schema.sql §10a) — đúng điều kiện của màn Chi tiết này.
  // Vẫn đúng 1 round-trip: hàm trả cả đề một lượt, map theo id như trước
  // (dư vài câu ngoài per_question là vô hại — UI tra cứu theo questionId).
  const { data: qs, error: qErr } = await supabase.rpc("exam_answer_key", {
    p_exam_id: exam.id,
  });
  if (qErr) throw qErr;
  const questions: Record<string, ResultQuestion> = {};
  // `image_url` VỐN ĐÃ nằm trong RETURNS TABLE của `exam_answer_key()`
  // (schema.sql §10a) — chỗ này trước đây chỉ đơn giản không đọc nó, nên màn
  // Chi tiết là màn DUY NHẤT của vòng làm bài không có hình: cùng một câu hỏi
  // có hình lúc làm bài (getExamForPlayer) rồi mất hình lúc dò lại.
  //
  // Ký song song (Promise.all) chứ không nối đuôi trong `for...of`: mỗi
  // `createSignedUrl` là một round-trip tới Storage, và một đề 40 câu có hình
  // sẽ cộng dồn 40 lần chờ vào TTFB của trang. Đúng khuôn `getExamForPlayer()`
  // (queries.ts:465) đã dùng cho màn làm bài.
  //
  // Từ 2026-09-03 (A3): vẫn một lần chờ, nhưng là MỘT request — ký cả lô bằng
  // `resolveSignedImageUrls()` rồi tra Map, thay vì N request chạy song song.
  const answerRows = (qs ?? []) as Array<{
    id: string;
    content: string;
    choices: Choice[];
    question_type: ResultQuestion["questionType"] | null;
    sub_answers: ResultQuestion["subAnswers"] | null;
    essay_answer: string | null;
    image_url: string | null;
    passage_id: string | null;
  }>;
  const signedImages = await resolveSignedImageUrls(
    supabase,
    answerRows.map((q) => q.image_url)
  );
  answerRows.forEach((q) => {
    const questionType = q.question_type ?? "mcq";
    const passage = q.passage_id
      ? (exam.passages ?? []).find((pg) => pg.id === q.passage_id)
      : undefined;
    questions[q.id] = {
      content: q.content,
      passageText: passage?.text,
      passageTitle: passage?.title,
      choices: questionType === "true_false" ? [] : q.choices,
      questionType,
      subItems:
        questionType === "true_false"
          ? (q.choices as unknown as ResultQuestion["subItems"])
          : undefined,
      subAnswers: q.sub_answers ?? undefined,
      essayAnswer: q.essay_answer ?? undefined,
      // Ký bằng client PHIÊN USER, không phải service role: policy
      // `exam_images_select` (schema.sql §8) mới là tầng cưỡng chế, và nó
      // cho đọc hình của đề `published` — đúng điều kiện của màn này
      // (getResult đã lọc `status = 'published'` ở vòng 1).
      imageUrl: q.image_url ? signedImages.get(q.image_url) : undefined,
    };
  });

  return {
    examId: exam.id,
    examTitle: exam.title,
    subject: exam.subject,
    result,
    questions,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    // Dòng cũ (trước khi có cột) đọc lên null → coi như trong giờ.
    overtimeSeconds: row.overtime_seconds ?? 0,
    // Suy từ MẢNG ĐÃ LƯU (`row.per_question`), không phải từ `perQuestion` vừa
    // gắn thêm trường: hai bên cho cùng kết quả hôm nay, nhưng chỉ mảng đã lưu
    // mới đúng là thứ `essayLifecycle` nhận hợp đồng — nó đọc khoá jsonb thô.
    essaySummary: summariseEssays(derivableRows, createdAt, now),
    // KHÔNG tự suy lại `state === "failed" && !retryAvailable` ở đây: RS-6 được
    // khai đúng một chỗ trong repo, trong `essayLifecycle.ts` (EG-BE-036). Hai
    // lối xuất PDF đọc cùng hàm này nên chúng không thể sinh ra hai tệp khác
    // nhau cho cùng một lượt thi.
    hasIncompleteEssay: hasIncompleteEssay(derivableRows, createdAt, now),
  };
}

