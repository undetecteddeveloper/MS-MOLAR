// computeScore — ⭐ TRACER CODE (giữ mãi vào production).
// Hàm THUẦN (pure): không phụ thuộc UI, không I/O, không fake-data lookup.
// GĐ 2 (M2.6) gọi chính hàm này server-side trong submitExam().
//
// Nhận danh sách câu hỏi (đã resolve, vì Exam chỉ giữ questionIds) + đáp án,
// trả về điểm thang 10 + chi tiết từng câu + breakdown theo chủ đề.
//
// v2.1 (ADR-0005): mcq luôn chấm điểm. true_false re-enable 2026-07-27 — chấm
// nhị phân CẢ CÂU (mọi ý a-d phải khớp subAnswers, một ý sai = cả câu sai,
// không chấm từng phần); thiếu subAnswers (AI extraction fail) → fallback
// scored:false, không phạt oan user vì thiếu ground truth. short_answer
// re-enable 2026-08-01 — so khớp văn bản đã chuẩn hoá (trim + NFC + lowercase)
// hoặc tương đương số học (dấu phẩy/chấm thập phân và số 0 thừa coi như nhau;
// chuỗi số có nhiều hơn một dấu phân cách — vd nhóm hàng nghìn "1.234.567" —
// là mơ hồ nên fallback so văn bản, không đoán số); thiếu/rỗng essayAnswer →
// fallback scored:false, cùng quy tắc ground-truth-presence với true_false.
// essay: hàm này KHÔNG chấm nó, và điều đó KHÔNG còn có nghĩa "không ai chấm".
// Band do đường bất đồng bộ của ADR-0018 ghi, ngoài hàm này, qua
// `record_essay_grade()`. Dòng CỐ Ý ở lại `scored: false` để nó không vào mẫu
// số điểm cho tới khi có ai đó thực sự chấm nó. Câu không chấm vẫn có mặt
// trong perQuestion (scored: false,
// giữ input của user để màn Chi tiết hiển thị) nhưng KHÔNG vào mẫu số điểm
// lẫn topic breakdown — tránh đề trộn 22 câu bị chia điểm /22 dù chỉ 12 câu
// chấm được.

import { decodeTfAnswer } from "@/lib/ugc/tfCodec";
import { newEssayEntry } from "./essayLifecycle";
import { maxPointsOf, trueFalseCreditRatio } from "./questionPoints";
import type { Question, SubItemId } from "@/types/question";
import type {
  PerQuestionResult,
  ScoreResult,
  TopicResult,
} from "@/types/result";

/** Câu có tham gia chấm điểm tự động không: mcq luôn; true_false chỉ khi có
 *  subAnswers ground truth (rỗng = AI extraction fail, không chấm);
 *  short_answer chỉ khi có essayAnswer ground truth không rỗng/toàn khoảng
 *  trắng (cùng lý do — AI extraction fail hoặc row cũ chưa có ground truth);
 *  essay LUÔN trả `false` ở đây — nhưng đọc kỹ nghĩa: nó nói "hàm NÀY không
 *  chấm câu này", không nói "câu này không bao giờ được chấm". Từ ADR-0018,
 *  band được ghi bởi đường bất đồng bộ sau khi nộp bài, ngoài `computeScore()`.
 *  Giữ `false` là chủ đích: nó giữ câu ngoài mẫu số điểm cho tới lúc có band
 *  thật, thay vì hứa trước một điểm số chưa tồn tại. */
function isScored(q: Question): boolean {
  const type = q.questionType ?? "mcq";
  if (type === "mcq") return true;
  if (type === "true_false") return Object.keys(q.subAnswers ?? {}).length > 0;
  if (type === "short_answer") return hasEssayGroundTruth(q);
  return false;
}

/** Câu có ĐÁP ÁN MẪU dùng được không.
 *
 *  Trích ra thành hàm riêng vì nay có HAI chỗ hỏi cùng câu hỏi đó:
 *  `isScored()` cho `short_answer`, và nhánh phát khoá vòng đời cho `essay`.
 *  Hai biểu thức `Boolean(q.essayAnswer?.trim())` viết rời nhau sẽ trôi lệch,
 *  và chiều trôi nguy hiểm là chiều phát `pending` cho một câu KHÔNG có gì để
 *  chấm — tức hứa với học sinh một điểm số sẽ không bao giờ tới. */
function hasEssayGroundTruth(q: Question): boolean {
  return Boolean(q.essayAnswer?.trim());
}

/** Chuẩn hoá văn bản để so sánh không phân biệt hoa/thường và khoảng trắng
 *  thừa: trim + Unicode NFC + lowercase. */
function normalizeShortAnswerText(value: string): string {
  return value.trim().normalize("NFC").toLowerCase();
}

/** Parse chuỗi số kiểu Việt Nam (dấu phẩy HOẶC dấu chấm đều coi là thập
 *  phân). Chuỗi có nhiều hơn một dấu phân cách (vd nhóm hàng nghìn
 *  "1.234.567") là mơ hồ → trả về null để isShortAnswerCorrect fallback so
 *  văn bản, không đoán số. Không parse được (kể cả rỗng) → null. */
function parseShortAnswerNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const separatorCount = (trimmed.match(/[.,]/g) ?? []).length;
  if (separatorCount > 1) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** So khớp câu trả lời short_answer với ground truth `expected`: ưu tiên
 *  tương đương số học (khi cả hai bên parse được số hợp lệ), fallback so
 *  văn bản đã chuẩn hoá. Bỏ trống (`submitted === undefined`) → sai, không
 *  phải bỏ qua (SA-BE-007, cùng quy ước với true_false). Không bao giờ throw. */
function isShortAnswerCorrect(
  expected: string,
  submitted: string | undefined,
): boolean {
  if (submitted === undefined) return false;
  const expectedNumber = parseShortAnswerNumber(expected);
  const submittedNumber = parseShortAnswerNumber(submitted);
  if (expectedNumber !== null && submittedNumber !== null) {
    return expectedNumber === submittedNumber;
  }
  return normalizeShortAnswerText(expected) === normalizeShortAnswerText(submitted);
}

/** ĐẾM số ý đúng của một câu true_false (tfCodec "a:Đ,b:S" — decodeTfAnswer,
 *  cùng codec AnswerChoice dùng để mã hoá lúc làm bài). Bỏ trống một ý → ý đó
 *  sai, không phải bỏ qua.
 *
 *  B2 đổi từ vị từ nhị phân sang phép ĐẾM, và đó là toàn bộ sửa chữa: bản cũ
 *  dùng `.every()` nên đúng 3/4 ý được ZERO điểm trong khi quy chế cho 0.5đ.
 *  Vị từ "đúng cả câu" vẫn còn — nó là `correct === total` — nhưng nay chỉ dùng
 *  cho `isCorrect`, tức cho Ô ĐẾM và cho mastery, không còn cho ĐIỂM. */
function countTrueFalseCorrect(
  subAnswers: Partial<Record<SubItemId, boolean>>,
  answer: string | undefined,
): { correct: number; total: number } {
  const selected = decodeTfAnswer(answer);
  const ids = Object.keys(subAnswers) as SubItemId[];
  return {
    correct: ids.filter((id) => selected[id] === subAnswers[id]).length,
    total: ids.length,
  };
}

/** Tuỳ chọn của `computeScore()`.
 *
 *  Cờ được TRUYỀN VÀO, không bao giờ đọc bên trong: hàm này thuần (AC-013), và
 *  một `process.env` ở đây sẽ biến nó thành thứ không kiểm được mà không dựng
 *  môi trường. Người gọi (`submitExam()`) là chỗ duy nhất đọc biến môi trường. */
export interface ComputeScoreOptions {
  /** `true` ⇒ câu `essay` CÓ đáp án mẫu phát ra năm khoá vòng đời. Mặc định
   *  `false`, tức hành vi y hệt trước ADR-0018. */
  essayGrading?: boolean;
}

export function computeScore(
  questions: Question[],
  answers: Record<string, string>,
  options: ComputeScoreOptions = { essayGrading: false },
): ScoreResult {
  const perQuestion: PerQuestionResult[] = questions.map((q) => {
    const selected = answers[q.id];
    // Điểm tối đa của câu — giải MỘT LẦN, dùng cho cả nhánh chấm lẫn nhánh
    // không chấm (câu tự luận chưa chấm vẫn phải có mặt trong MẪU SỐ).
    const maxPoints = maxPointsOf(q);
    if (!isScored(q)) {
      const unscored: PerQuestionResult = {
        questionId: q.id,
        selected,
        isCorrect: false,
        scored: false,
      };
      // Câu tự luận CÓ đáp án mẫu, khi cờ bật, mang thêm năm khoá vòng đời.
      // Nó vẫn `scored: false` và `isCorrect: false` — và đó là chủ đích, không
      // phải sót (EG-BE-004): band được ghi NGOÀI hàm này bởi
      // `record_essay_grade()`, còn dòng thì cố ý ở lại ngoài mẫu số điểm cho
      // tới khi có ai đó thực sự chấm nó.
      if (options.essayGrading && (q.questionType ?? "mcq") === "essay" && hasEssayGroundTruth(q)) {
        // B3 — câu tự luận vào MẪU SỐ ngay từ lúc nộp, với earnedPoints = 0.
        //
        // Đây là mấu chốt của B3, và nó KHÔNG mâu thuẫn với `scored: false`:
        // hai trường trả lời hai câu hỏi khác nhau. `scored` nói "dòng này có
        // vào Ô ĐẾM đúng/sai, vào mastery, vào wrongTwice không" — câu trả lời
        // vẫn là KHÔNG (một `scored: true` ở đây sẽ làm `record_skill_mastery()`
        // bắt đầu nuôi mô hình bằng câu tự luận, đúng khuyết tật mà
        // types/result.ts đã cảnh báo). `maxPoints` nói "câu này chiếm bao nhiêu
        // trong thang 10 của đề" — câu trả lời là CÓ, ngay lập tức, vì đề đã in
        // sẵn nó đáng mấy điểm dù chưa ai chấm.
        //
        // Trước B3 câu tự luận đứng ngoài mẫu số, nên một lượt thi toàn tự luận
        // ra `total_score = 0.00` và một đề Văn hỗn hợp ra 10.0/10 trên bài
        // đáng 4.75/10. `record_essay_grade()` cộng earnedPoints vào sau.
        return { ...unscored, ...newEssayEntry(), earnedPoints: 0, maxPoints };
      }
      // Câu không chấm được và cũng KHÔNG có ai sẽ chấm (thiếu ground truth,
      // hoặc cờ tự luận tắt): đứng ngoài cả tử lẫn mẫu. Đưa vào mẫu số nghĩa là
      // trừ điểm học sinh vì đề trích xuất hỏng.
      return unscored;
    }
    if (q.questionType === "true_false") {
      const tf = countTrueFalseCorrect(q.subAnswers ?? {}, selected);
      return {
        questionId: q.id,
        selected,
        // "Đúng" ở Ô ĐẾM vẫn là ĐÚNG CẢ CÂU — đúng 3/4 ý được điểm thành phần
        // nhưng KHÔNG được tính là một câu đúng. Giữ vậy để `correct`/`total`
        // của ScoreCard không đổi nghĩa (AC-057), và để mastery không ghi nhận
        // một kỹ năng chưa nắm vững là đã nắm.
        isCorrect: tf.total > 0 && tf.correct === tf.total,
        scored: true,
        earnedPoints: trueFalseCreditRatio(tf.correct, tf.total) * maxPoints,
        maxPoints,
      };
    }
    if (q.questionType === "short_answer") {
      const isCorrect = isShortAnswerCorrect(q.essayAnswer ?? "", selected);
      return {
        questionId: q.id,
        selected,
        isCorrect,
        scored: true,
        earnedPoints: isCorrect ? maxPoints : 0,
        maxPoints,
      };
    }
    const isCorrect = selected === q.correctAnswer;
    return {
      questionId: q.id,
      selected,
      correct: q.correctAnswer,
      isCorrect,
      scored: true,
      earnedPoints: isCorrect ? maxPoints : 0,
      maxPoints,
    };
  });

  // Ô ĐẾM — Ý NGHĨA KHÔNG ĐỔI so với trước B1/B2/B3, và đó là điều kiện để
  // ScoreCard giữ được phép suy `sai = tổng − đúng` (AC-057). Chúng đếm CÂU
  // CHẤM TỰ ĐỘNG, không đọc `points`, không đếm câu tự luận.
  const scored = perQuestion.filter((r) => r.scored !== false);
  const total = scored.length;
  const correct = scored.filter((r) => r.isCorrect).length;

  // ĐIỂM — kênh riêng, có trọng số, và là kênh DUY NHẤT câu tự luận đi vào.
  const points = sumPoints(perQuestion);
  const totalScore = scoreFromPoints(points.earnedPoints, points.maxPoints);

  // Gom theo chủ đề — CHỈ câu được chấm, giữ thứ tự chủ đề xuất hiện lần đầu.
  const topicOrder: string[] = [];
  const buckets = new Map<string, { correct: number; total: number }>();
  questions.forEach((q, i) => {
    if (perQuestion[i].scored === false) return;
    let bucket = buckets.get(q.topic);
    if (!bucket) {
      bucket = { correct: 0, total: 0 };
      buckets.set(q.topic, bucket);
      topicOrder.push(q.topic);
    }
    bucket.total += 1;
    if (perQuestion[i].isCorrect) bucket.correct += 1;
  });
  const topicBreakdown: TopicResult[] = topicOrder.map((topic) => {
    const b = buckets.get(topic)!;
    return { topic, correct: b.correct, total: b.total };
  });

  return { totalScore, correct, total, perQuestion, topicBreakdown };
}

/** Cộng dồn hai vế điểm trên một mảng `per_question`.
 *
 *  Dòng KHÔNG mang `maxPoints` bị bỏ qua hoàn toàn — đó là dòng cũ (ghi trước
 *  B1) hoặc câu không ai chấm được. Bỏ qua chứ không mặc định 1: gán mẫu số 1
 *  cho một dòng cũ sẽ làm điểm của lượt thi cũ tụt xuống mà không ai đụng vào
 *  nó, còn `scoreFromPoints()` đã có nhánh mẫu-số-0 lo ca "cả mảng đều cũ". */
export function sumPoints(rows: PerQuestionResult[]): {
  earnedPoints: number;
  maxPoints: number;
} {
  let earned = 0;
  let max = 0;
  for (const row of rows) {
    if (typeof row.maxPoints !== "number" || !Number.isFinite(row.maxPoints)) continue;
    max += row.maxPoints;
    earned +=
      typeof row.earnedPoints === "number" && Number.isFinite(row.earnedPoints)
        ? row.earnedPoints
        : 0;
  }
  return { earnedPoints: earned, maxPoints: max };
}

/** Quy hai vế điểm về thang 10, làm tròn 2 chữ số.
 *
 *  Mẫu số 0 → 0, KHÔNG phải NaN: đề toàn câu không chấm được là chuyện có thật
 *  (trích xuất hỏng hết), và một NaN ở đây đi thẳng vào cột `total_score` rồi
 *  ra biểu đồ lịch sử. Đây cũng là nhánh giữ nguyên hành vi cũ cho lượt thi
 *  không có dòng nào mang `maxPoints`. */
export function scoreFromPoints(earnedPoints: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return Math.round((earnedPoints / maxPoints) * 10 * 100) / 100;
}
