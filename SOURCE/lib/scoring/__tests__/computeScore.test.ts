// computeScore — unit tests. v2.1 (ADR-0005): mcq chấm điểm. true_false chấm
// lại (2026-07-21, xem computeScore.ts) khi có subAnswers; thiếu subAnswers →
// fallback scored:false (không phạt oan user vì thiếu ground truth).
// short_answer vẫn "stored, not auto-scored". essay thì KHÁC kể từ ADR-0018:
// nó ĐƯỢC chấm, chỉ là không phải ở đây — band do đường bất đồng bộ ghi sau khi
// nộp, còn `computeScore()` cố ý để dòng ở `scored: false`.

import { describe, expect, it } from "vitest";
import { computeScore, scoreFromPoints, sumPoints } from "../computeScore";
import type { Question } from "@/types/question";
import { encodeTfAnswer } from "@/lib/ugc/tfCodec";
import type { PerQuestionResult } from "@/types/result";

function mcq(id: string, correctAnswer: Question["correctAnswer"], topic = "Topic A"): Question {
  return {
    id,
    content: "stem",
    choices: [
      { id: "A", text: "a" },
      { id: "B", text: "b" },
      { id: "C", text: "c" },
      { id: "D", text: "d" },
    ],
    correctAnswer,
    subject: "Toán",
    grade: 10,
    topic,
    questionType: "mcq",
  };
}

function trueFalse(
  id: string,
  subAnswers: Question["subAnswers"],
  topic = "Topic B",
): Question {
  return {
    id,
    content: "stem",
    choices: [],
    correctAnswer: "A",
    subject: "Toán",
    grade: 10,
    topic,
    questionType: "true_false",
    subItems: [
      { id: "a", text: "ý a" },
      { id: "b", text: "ý b" },
    ],
    subAnswers,
  };
}

function shortAnswer(
  id: string,
  topic = "Topic C",
  essayAnswer: string | undefined,
): Question {
  return {
    id,
    content: "stem",
    choices: [],
    correctAnswer: "A",
    subject: "Toán",
    grade: 10,
    topic,
    questionType: "short_answer",
    essayAnswer,
  };
}

function essay(id: string, topic = "Topic C"): Question {
  return {
    id,
    content: "stem",
    choices: [],
    correctAnswer: "A",
    subject: "Toán",
    grade: 10,
    topic,
    questionType: "essay",
  };
}

describe("computeScore — mcq (baseline, không đổi)", () => {
  it("chấm đúng/sai/bỏ trống, thang 10 làm tròn 2 chữ số", () => {
    const questions = [mcq("q1", "A"), mcq("q2", "B"), mcq("q3", "C")];
    const answers = { q1: "A", q2: "A" }; // q3 bỏ trống
    const result = computeScore(questions, answers);
    expect(result.total).toBe(3);
    expect(result.correct).toBe(1);
    expect(result.totalScore).toBeCloseTo(3.33, 2);
    expect(result.perQuestion.map((r) => r.scored)).toEqual([true, true, true]);
  });
});

describe("computeScore — true_false (2026-07-21 re-enable)", () => {
  it("đúng CẢ CÂU khi mọi ý khớp subAnswers", () => {
    const q = trueFalse("q1", { a: true, b: false });
    const result = computeScore([q], { q1: "a:Đ,b:S" });
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: true });
    expect(result.total).toBe(1);
    expect(result.correct).toBe(1);
  });

  it("sai cả câu khi MỘT ý không khớp (nhị phân, không chấm từng phần)", () => {
    const q = trueFalse("q1", { a: true, b: false });
    const result = computeScore([q], { q1: "a:Đ,b:Đ" }); // ý b sai
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: false });
  });

  it("bỏ trống toàn bộ → scored true nhưng sai (không phải skip)", () => {
    const q = trueFalse("q1", { a: true, b: false });
    const result = computeScore([q], {});
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: false });
  });

  it("thiếu subAnswers (AI extraction fail) → fallback KHÔNG chấm, không phạt oan", () => {
    const q = trueFalse("q1", {});
    const result = computeScore([q], { q1: "a:Đ,b:S" });
    expect(result.perQuestion[0]).toMatchObject({ scored: false, isCorrect: false });
    expect(result.total).toBe(0); // không vào mẫu số
  });

  it("mix mcq + true_false: cả hai vào chung total/correct", () => {
    const questions = [mcq("q1", "A"), trueFalse("q2", { a: true, b: true })];
    const answers = { q1: "A", q2: "a:Đ,b:Đ" };
    const result = computeScore(questions, answers);
    expect(result.total).toBe(2);
    expect(result.correct).toBe(2);
    expect(result.totalScore).toBe(10);
  });
});

// Tiêu đề cũ đọc là "essay vẫn KHÔNG auto-scored" — sau ADR-0018 câu đó SAI.
// Hành vi được kiểm thì KHÔNG đổi một chút nào: `computeScore()` vẫn trả
// `scored: false` và vẫn để câu ngoài mẫu số. Cái đổi là LÝ DO — band tới từ
// nơi khác, muộn hơn, chứ không phải không bao giờ tới.
describe("computeScore — essay KHÔNG được chấm Ở ĐÂY, band tới từ đường bất đồng bộ (SA-BE-010)", () => {
  it("scored:false vô điều kiện, không vào mẫu số dù có input", () => {
    const questions = [mcq("q1", "A"), essay("q2")];
    const answers = { q1: "A", q2: "bài luận tự do" };
    const result = computeScore(questions, answers);
    expect(result.total).toBe(1);
    expect(result.perQuestion[1]).toMatchObject({ scored: false, isCorrect: false });
  });
});

describe("computeScore — short_answer (auto-scored, chuẩn hoá text + tương đương số)", () => {
  it("SA-BE-001: khớp chính xác từng ký tự → scored:true, isCorrect:true", () => {
    const q = shortAnswer("q1", "Topic C", "Hà Nội");
    const result = computeScore([q], { q1: "Hà Nội" });
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: true });
    expect(result.total).toBe(1);
    expect(result.correct).toBe(1);
  });

  it("SA-BE-002: tương đương số học bất kể dấu phẩy/chấm thập phân và số 0 thừa", () => {
    const commaGroundTruth = shortAnswer("q1", "Topic C", "1,04");
    expect(
      computeScore([commaGroundTruth], { q1: "1.04" }).perQuestion[0],
    ).toMatchObject({ scored: true, isCorrect: true });
    expect(
      computeScore([commaGroundTruth], { q1: "1.040" }).perQuestion[0],
    ).toMatchObject({ scored: true, isCorrect: true });

    const dotGroundTruth = shortAnswer("q2", "Topic C", "1.04");
    expect(
      computeScore([dotGroundTruth], { q2: "1,04" }).perQuestion[0],
    ).toMatchObject({ scored: true, isCorrect: true });
  });

  it("SA-BE-003: sai lệch thực sự (không khớp chữ, không bằng số) → isCorrect:false", () => {
    const q = shortAnswer("q1", "Topic C", "1.04");
    const result = computeScore([q], { q1: "1.05" });
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: false });
  });

  it("SA-BE-004: chỉ khác hoa/thường hoặc khoảng trắng (văn bản không phải số) → isCorrect:true", () => {
    const q = shortAnswer("q1", "Topic C", "Paris");
    const result = computeScore([q], { q1: "  paris  " });
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: true });
  });

  it("SA-BE-005: chuỗi số nhiều dấu phân cách mơ hồ (nhóm hàng nghìn) → fallback so văn bản, không đoán số", () => {
    const groundTruth = "1.234.567";
    const sameText = shortAnswer("q1", "Topic C", groundTruth);
    expect(
      computeScore([sameText], { q1: groundTruth }).perQuestion[0],
    ).toMatchObject({ scored: true, isCorrect: true }); // giống hệt văn bản → so văn bản khớp

    const ungroupedNumber = shortAnswer("q2", "Topic C", groundTruth);
    expect(
      computeScore([ungroupedNumber], { q2: "1234567" }).perQuestion[0],
    ).toMatchObject({ scored: true, isCorrect: false }); // không được đoán "1.234.567" == 1234567
  });

  it.each([
    ["undefined", undefined],
    ["null", null as unknown as string | undefined],
    ["blank/whitespace-only", "   "],
  ])(
    "SA-BE-006: essayAnswer %s → scored:false, loại khỏi total/correct/topicBreakdown, vẫn giữ trong perQuestion",
    (_label, essayAnswer) => {
      const questions = [mcq("q1", "A", "Topic A"), shortAnswer("q2", "Topic C", essayAnswer)];
      const answers = { q1: "A", q2: "bất kỳ" };
      const result = computeScore(questions, answers);
      expect(result.perQuestion[1]).toMatchObject({ scored: false, isCorrect: false });
      expect(result.total).toBe(1);
      expect(result.correct).toBe(1);
      expect(result.topicBreakdown).toEqual([{ topic: "Topic A", correct: 1, total: 1 }]);
    },
  );

  it("SA-BE-007: bỏ trống câu trả lời (có ground truth) → scored:true, isCorrect:false (tính sai, không phải bỏ qua)", () => {
    const q = shortAnswer("q1", "Topic C", "1260");
    const result = computeScore([q], {});
    expect(result.perQuestion[0]).toMatchObject({ scored: true, isCorrect: false });
    expect(result.total).toBe(1);
    expect(result.correct).toBe(0);
  });
});

describe("computeScore — topicBreakdown", () => {
  it("chỉ gom câu đã chấm (mcq + true_false), giữ thứ tự chủ đề xuất hiện lần đầu", () => {
    const questions = [
      mcq("q1", "A", "Topic A"),
      trueFalse("q2", { a: true }, "Topic B"),
      shortAnswer("q3", "Topic C", undefined),
    ];
    const answers = { q1: "A", q2: "a:Đ", q3: "x" };
    const result = computeScore(questions, answers);
    expect(result.topicBreakdown).toEqual([
      { topic: "Topic A", correct: 1, total: 1 },
      { topic: "Topic B", correct: 1, total: 1 },
    ]);
  });
});

// ═══════════════ Chấm tự luận (ADR-0018) — EG-BE-001…004 ═══════════════════
//
// Bốn nghĩa vụ, và cặp (001, 002) là cặp quyết định: một cài đặt LUÔN phát năm
// khoá sẽ qua được 001 và trượt 002, còn một cài đặt không bao giờ phát sẽ qua
// 002 và trượt 001. Chỉ hai ca cùng nhau mới ghim được rằng CỜ là thứ quyết
// định, chứ không phải loại câu.
//
// Vì sao 002 nói "y hệt từng byte": đường mặc định là đường mà MỌI lượt nộp
// bài hôm nay đi qua. Một khoá thừa lọt vào đó là một thay đổi payload âm thầm
// trên dữ liệu thật, ở một hàm mà `record_exam_result()` lưu nguyên văn.

describe("chấm tự luận — phát khoá vòng đời (ADR-0018)", () => {
  const essayQuestion: Question = {
    id: "q-essay",
    content: "Phân tích nhân vật.",
    questionType: "essay",
    essayAnswer: "Đáp án mẫu có thật",
    topic: "Văn",
    difficulty: "medium",
    choices: {},
    correctAnswer: "A",
  } as unknown as Question;

  it("EG-BE-002 — cờ TẮT (mặc định): phần tử y hệt hôm nay, KHÔNG khoá essay* nào", () => {
    const r = computeScore([essayQuestion], { "q-essay": "bài làm" });
    // Đẳng thức VÉT CẠN trên cả phần tử: `toMatchObject` sẽ bỏ qua đúng thứ ca
    // này tồn tại để bắt — một khoá thừa lọt vào đường mặc định.
    expect(r.perQuestion[0]).toEqual({
      questionId: "q-essay",
      selected: "bài làm",
      isCorrect: false,
      scored: false,
    });
  });

  it("EG-BE-002 — gọi KHÔNG truyền options cho kết quả GIỐNG HỆT gọi với essayGrading:false", () => {
    // Bảo toàn hành vi được chứng minh bằng một phép so hai chiều, không bằng
    // lời hứa "mặc định là false".
    const a = computeScore([essayQuestion], { "q-essay": "bài làm" });
    const b = computeScore([essayQuestion], { "q-essay": "bài làm" }, { essayGrading: false });
    expect(a).toEqual(b);
  });

  it("EG-BE-001 — cờ BẬT + có ground truth: đủ năm khoá, cộng scored/isCorrect false", () => {
    const r = computeScore([essayQuestion], { "q-essay": "bài làm" }, { essayGrading: true });
    expect(r.perQuestion[0]).toEqual({
      questionId: "q-essay",
      selected: "bài làm",
      isCorrect: false,
      scored: false,
      essayState: "pending",
      essayEarned: null,
      essayMax: null,
      essayLowConfidence: false,
      essayAttempts: 0,
      // B3 — hai trường của KÊNH ĐIỂM. Dòng vẫn `scored: false` (ngoài ô đếm,
      // ngoài mastery) nhưng đã có mặt trong MẪU SỐ với 0 điểm đã được: đề in
      // sẵn câu này đáng mấy điểm, `record_essay_grade()` cộng tử số vào sau.
      earnedPoints: 0,
      maxPoints: 1,
    });
  });

  it("EG-BE-004 — câu tự luận KHÔNG vào Ô ĐẾM dù đã phát khoá vòng đời", () => {
    // ĐÃ SỬA LẠI PHẠM VI Ở B3 (2026-09-01). Bản gốc của ca này khẳng định câu
    // tự luận đứng ngoài "mẫu số điểm", và đó là điều B3 CỐ Ý đảo ngược: đứng
    // ngoài mẫu số chính là thứ làm một lượt thi toàn tự luận ra 0.00 và một đề
    // Văn hỗn hợp ra 10.0/10 trên bài đáng 4.75/10.
    //
    // Thứ ca này canh — và vẫn phải đúng — là câu tự luận không vào Ô ĐẾM
    // `correct`/`total`. Đó mới là bất biến thật: nó giữ `sai = tổng − đúng`
    // của ScoreCard (AC-057), giữ mastery khỏi bị nuôi bằng câu chưa ai chấm,
    // và giữ `computeWrongTwiceQuestionIds()` khỏi trả id câu tự luận.
    const mcq = {
      id: "q-mcq",
      questionType: "mcq",
      correctAnswer: "A",
      topic: "Toán",
    } as unknown as Question;
    const r = computeScore(
      [essayQuestion, mcq],
      { "q-essay": "bài làm", "q-mcq": "A" },
      { essayGrading: true },
    );
    expect(r.total).toBe(1);
    expect(r.correct).toBe(1);
    // Nhưng KÊNH ĐIỂM thì có cả hai câu: mcq 1 điểm (đúng) + tự luận 1 điểm
    // (chưa chấm, 0 điểm đã được) ⇒ 1/2 × 10 = 5.0, không phải 10.0.
    expect(sumPoints(r.perQuestion)).toEqual({ earnedPoints: 1, maxPoints: 2 });
    expect(r.totalScore).toBe(5);
  });

  it.each([undefined, null, "", "   ", "\n\t "])(
    "EG-BE-003 — essayAnswer %o (không có ground truth) ⇒ KHÔNG khoá essay* nào, kể cả khi cờ BẬT",
    (essayAnswer) => {
      // Cùng guard ground-truth-presence mà `isScored()` đã áp cho true_false
      // và short_answer. Không có đáp án mẫu thì không có gì để chấm, nên phát
      // `pending` ở đây là hứa một thứ sẽ không bao giờ tới.
      const q = { ...essayQuestion, essayAnswer } as unknown as Question;
      const r = computeScore([q], { "q-essay": "bài làm" }, { essayGrading: true });
      expect(r.perQuestion[0]).toEqual({
        questionId: "q-essay",
        selected: "bài làm",
        isCorrect: false,
        scored: false,
      });
    },
  );

  it("hai câu tự luận trong cùng lượt KHÔNG dùng chung tham chiếu", () => {
    // `newEssayEntry()` trả object MỚI mỗi lần. Dùng chung một tham chiếu thì
    // một lượt nắn tại chỗ ở hạ nguồn sẽ đổi luôn phần tử bên cạnh.
    const q2 = { ...essayQuestion, id: "q-essay-2" } as unknown as Question;
    const r = computeScore(
      [essayQuestion, q2],
      { "q-essay": "a", "q-essay-2": "b" },
      { essayGrading: true },
    );
    expect(r.perQuestion[0]).not.toBe(r.perQuestion[1]);
  });

  it("cờ BẬT KHÔNG đổi hành vi của các loại câu khác", () => {
    // `isScored()` giữ nguyên hành vi (AC-013): cờ chỉ mở một nhánh phát khoá
    // cho essay, nó không phải một công tắc chấm điểm.
    const sa = {
      id: "q-sa",
      questionType: "short_answer",
      essayAnswer: "42",
      topic: "Toán",
    } as unknown as Question;
    const off = computeScore([sa], { "q-sa": "42" });
    const on = computeScore([sa], { "q-sa": "42" }, { essayGrading: true });
    expect(on).toEqual(off);
    expect(on.perQuestion[0].scored).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B1 + B2 + B3 — chấm điểm CÓ TRỌNG SỐ, PHẦN II theo bậc, tự luận vào mẫu số.
//
// Ba lỗi này được sửa thành MỘT đợt (G3) vì chúng rơi vào cùng một chỗ: cách
// `total_score` hình thành. Bộ test dưới đây canh đúng ba con số mà phiên bàn
// đã chỉ đích danh là đang sai.
// ---------------------------------------------------------------------------

/** Câu mcq n điểm, đáp án đúng "A". */
function pointsMcq(id: string, points?: number): Question {
  return {
    id,
    content: id,
    choices: [],
    correctAnswer: "A",
    subject: "Toán",
    grade: 12,
    topic: "Toán",
    questionType: "mcq",
    ...(points !== undefined && { points }),
  } as unknown as Question;
}

/** Câu PHẦN II 4 ý, đáp án đúng: a,b,c,d = true. */
function tf4(id: string, points?: number): Question {
  return {
    id,
    content: id,
    choices: [],
    subject: "Toán",
    grade: 12,
    topic: "Toán",
    questionType: "true_false",
    subAnswers: { a: true, b: true, c: true, d: true },
    ...(points !== undefined && { points }),
  } as unknown as Question;
}

describe("B1 — điểm có trọng số theo từng câu", () => {
  it("đề THUẦN trắc nghiệm không đổi điểm: trọng số mặc định rút gọn về công thức cũ", () => {
    // Đây là bất biến quan trọng nhất của B1. Nếu nó vỡ thì MỌI đề trắc nghiệm
    // trong hệ thống bị dịch điểm chỉ vì luật đổi, và backfill sẽ viết lại lịch
    // sử làm bài của học sinh mà không có lý do nghiệp vụ nào.
    const qs = [pointsMcq("q1"), pointsMcq("q2"), pointsMcq("q3"), pointsMcq("q4")];
    const r = computeScore(qs, { q1: "A", q2: "A", q3: "B", q4: "A" });
    // 3/4 đúng — công thức cũ cho 7.5, công thức mới phải cho đúng số đó.
    expect(r.totalScore).toBe(7.5);
    expect(r.correct).toBe(3);
    expect(r.total).toBe(4);
  });

  it("câu nặng kéo điểm nhiều hơn câu nhẹ", () => {
    // 1 điểm + 4 điểm. Chỉ làm đúng câu 4 điểm ⇒ 4/5 × 10 = 8.0, KHÔNG phải 5.0.
    const r = computeScore([pointsMcq("nhe", 1), pointsMcq("nang", 4)], {
      nhe: "B",
      nang: "A",
    });
    expect(sumPoints(r.perQuestion)).toEqual({ earnedPoints: 4, maxPoints: 5 });
    expect(r.totalScore).toBe(8);
  });

  it("`points` dị dạng (0, âm, NaN, không phải số) → mặc định 1, không bao giờ 0 mẫu số", () => {
    // `points` đi từ AI đọc đề → tác giả sửa tay → numeric. Một `0` lọt qua sẽ
    // làm câu biến mất khỏi mẫu số trong im lặng; một số âm kéo tổng xuống.
    for (const bad of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, "2" as unknown as number]) {
      const r = computeScore([pointsMcq("q", bad)], { q: "A" });
      expect(sumPoints(r.perQuestion).maxPoints).toBe(1);
      expect(r.totalScore).toBe(10);
    }
  });
});

describe("B2 — PHẦN II chấm theo BẬC, không còn nhị phân cả câu", () => {
  // Thang quy chế Bộ GD&ĐT 2025, đã xác nhận với đề thật:
  // đúng 1 ý = 0.1đ · 2 ý = 0.25đ · 3 ý = 0.5đ · 4 ý = 1.0đ.
  const CASES: [number, boolean[], number][] = [
    [0, [false, false, false, false], 0],
    [1, [true, false, false, false], 0.1],
    [2, [true, true, false, false], 0.25],
    [3, [true, true, true, false], 0.5],
    [4, [true, true, true, true], 1],
  ];

  it.each(CASES)("đúng %i/4 ý ⇒ %s ⇒ %f điểm", (_n, picks, expected) => {
    const answer = encodeTfAnswer({ a: picks[0], b: picks[1], c: picks[2], d: picks[3] });
    const r = computeScore([tf4("q")], { q: answer });
    expect(sumPoints(r.perQuestion).earnedPoints).toBeCloseTo(expected, 10);
  });

  it("đúng 3/4 ý được 0.5đ — con số mà bản cũ trả về 0", () => {
    // Ca hồi quy đích danh của B2: `.every()` làm học sinh đúng 3/4 mất trắng.
    const answer = encodeTfAnswer({ a: true, b: true, c: true, d: false });
    const r = computeScore([tf4("q")], { q: answer });
    expect(sumPoints(r.perQuestion).earnedPoints).toBe(0.5);
    expect(r.totalScore).toBe(5);
    // …nhưng Ô ĐẾM vẫn coi đây là MỘT CÂU SAI: đúng 3/4 không phải nắm vững.
    expect(r.correct).toBe(0);
    expect(r.total).toBe(1);
  });

  it("bậc là TỈ LỆ của points, không phải điểm tuyệt đối", () => {
    // Câu PHẦN II đáng 2 điểm, đúng 3/4 ý ⇒ 0.5 × 2 = 1.0 điểm.
    const answer = encodeTfAnswer({ a: true, b: true, c: true, d: false });
    const r = computeScore([tf4("q", 2)], { q: answer });
    expect(sumPoints(r.perQuestion)).toEqual({ earnedPoints: 1, maxPoints: 2 });
  });

  it("câu MỘT ý (A2) dùng tỉ lệ thuận, không áp bậc 0.1", () => {
    // Quy chế chỉ viết cho khối 4 ý. Áp bậc "đúng 1 ý = 0.1" cho một câu CHỈ CÓ
    // một ý sẽ trả 10% điểm cho một bài làm hoàn toàn đúng.
    const single = {
      ...tf4("q"),
      subAnswers: { a: true },
    } as unknown as Question;
    const right = computeScore([single], { q: encodeTfAnswer({ a: true }) });
    expect(sumPoints(right.perQuestion).earnedPoints).toBe(1);
    const wrong = computeScore([single], { q: encodeTfAnswer({ a: false }) });
    expect(sumPoints(wrong.perQuestion).earnedPoints).toBe(0);
  });
});

describe("B3 — điểm tự luận vào cùng một thang với trắc nghiệm", () => {
  /** Câu tự luận n điểm, có đáp án mẫu. */
  function essay(id: string, points: number): Question {
    return {
      id,
      content: id,
      choices: [],
      subject: "Ngữ văn",
      grade: 12,
      topic: "Ngữ văn",
      questionType: "essay",
      essayAnswer: "dàn ý mẫu",
      points,
    } as unknown as Question;
  }

  it("ĐỀ VĂN CỦA PHIÊN BÀN — 10.0/10 sai phải thành 3.0/10 lúc chưa chấm", () => {
    // Đọc hiểu 4 câu trắc nghiệm (3.0đ) + NLXH (2.0đ) + NLVH (5.0đ).
    // Học sinh đúng cả 4 câu trắc nghiệm, hai bài văn CHƯA chấm xong.
    //
    // Trước B3: ô lớn hiện 10.0/10 (4/4 câu chấm tự động đều đúng, hai bài văn
    // không nằm trong mẫu số). Nay tử số là 3.0 trên mẫu số 10.0.
    const qs = [
      pointsMcq("dh1", 0.75),
      pointsMcq("dh2", 0.75),
      pointsMcq("dh3", 0.75),
      pointsMcq("dh4", 0.75),
      essay("nlxh", 2),
      essay("nlvh", 5),
    ];
    const r = computeScore(
      qs,
      { dh1: "A", dh2: "A", dh3: "A", dh4: "A", nlxh: "bài làm", nlvh: "bài làm" },
      { essayGrading: true },
    );
    expect(sumPoints(r.perQuestion)).toEqual({ earnedPoints: 3, maxPoints: 10 });
    expect(r.totalScore).toBe(3);
    // Ô đếm vẫn chỉ nói về 4 câu chấm tự động ⇒ `sai = tổng − đúng` còn đúng.
    expect(r.correct).toBe(4);
    expect(r.total).toBe(4);
  });

  it("lượt thi TOÀN tự luận không còn là mẫu số rỗng", () => {
    // Trước B3 ca này cho `total = 0` ⇒ `total_score = 0.00`, đúng khuyết tật
    // mà EssayScoreLine.tsx đã thừa nhận trong chú thích của nó.
    const r = computeScore(
      [essay("a", 4), essay("b", 6)],
      { a: "bài", b: "bài" },
      { essayGrading: true },
    );
    expect(sumPoints(r.perQuestion).maxPoints).toBe(10);
    expect(r.total).toBe(0);
  });

  it("cờ chấm tự luận TẮT ⇒ câu tự luận đứng ngoài cả tử lẫn mẫu", () => {
    // Không ai sẽ chấm nó, nên đưa vào mẫu số là trừ điểm học sinh vĩnh viễn.
    const r = computeScore(
      [pointsMcq("q", 1), essay("e", 9)],
      { q: "A", e: "bài" },
      { essayGrading: false },
    );
    expect(sumPoints(r.perQuestion).maxPoints).toBe(1);
    expect(r.totalScore).toBe(10);
  });

  it("câu tự luận KHÔNG có đáp án mẫu cũng đứng ngoài mẫu số", () => {
    const noGround = { ...essay("e", 9), essayAnswer: "" } as unknown as Question;
    const r = computeScore(
      [pointsMcq("q", 1), noGround],
      { q: "A", e: "bài" },
      { essayGrading: true },
    );
    expect(sumPoints(r.perQuestion).maxPoints).toBe(1);
  });
});

describe("sumPoints / scoreFromPoints", () => {
  it("bỏ qua HẲN dòng cũ không mang maxPoints, không mặc định 1", () => {
    // Mặc định 1 ở đây sẽ làm điểm của mọi lượt thi cũ tụt xuống mà không ai
    // đụng vào chúng.
    const rows = [
      { questionId: "cu", isCorrect: true, scored: true },
      { questionId: "moi", isCorrect: true, scored: true, earnedPoints: 2, maxPoints: 2 },
    ] as PerQuestionResult[];
    expect(sumPoints(rows)).toEqual({ earnedPoints: 2, maxPoints: 2 });
  });

  it("mẫu số 0 ⇒ 0, không bao giờ NaN", () => {
    // NaN ở đây đi thẳng vào cột total_score rồi ra biểu đồ lịch sử.
    expect(scoreFromPoints(0, 0)).toBe(0);
    expect(Number.isNaN(scoreFromPoints(5, 0))).toBe(false);
  });
});
