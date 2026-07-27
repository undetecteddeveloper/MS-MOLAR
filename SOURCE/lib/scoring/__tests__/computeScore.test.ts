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

function shortAnswer(id: string, topic = "Topic C"): Question {
  return {
    id,
    content: "stem",
    choices: [],
    correctAnswer: "A",
    subject: "Toán",
    grade: 10,
    topic,
    questionType: "short_answer",
    essayAnswer: "1260",
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

describe("computeScore — short_answer/essay vẫn KHÔNG auto-scored", () => {
  it("scored:false, không vào mẫu số dù có input", () => {
    const questions = [mcq("q1", "A"), shortAnswer("q2")];
    const answers = { q1: "A", q2: "1260" };
    const result = computeScore(questions, answers);
    expect(result.total).toBe(1);
    expect(result.perQuestion[1]).toMatchObject({ scored: false, isCorrect: false });
  });
});

describe("computeScore — topicBreakdown", () => {
  it("chỉ gom câu đã chấm (mcq + true_false), giữ thứ tự chủ đề xuất hiện lần đầu", () => {
    const questions = [
      mcq("q1", "A", "Topic A"),
      trueFalse("q2", { a: true }, "Topic B"),
      shortAnswer("q3", "Topic C"),
    ];
    const answers = { q1: "A", q2: "a:Đ", q3: "x" };
    const result = computeScore(questions, answers);
    expect(result.topicBreakdown).toEqual([
      { topic: "Topic A", correct: 1, total: 1 },
      { topic: "Topic B", correct: 1, total: 1 },
    ]);
  });
});
