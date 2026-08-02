// computeScore — unit tests. v2.1 (ADR-0005): mcq chấm điểm. true_false chấm
// lại (2026-07-21, xem computeScore.ts) khi có subAnswers; thiếu subAnswers →
// fallback scored:false (không phạt oan user vì thiếu ground truth).
// short_answer/essay vẫn "stored, not auto-scored".

import { describe, expect, it } from "vitest";
import { computeScore } from "../computeScore";
import type { Question } from "@/types/question";

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

describe("computeScore — essay vẫn KHÔNG auto-scored (SA-BE-010)", () => {
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
