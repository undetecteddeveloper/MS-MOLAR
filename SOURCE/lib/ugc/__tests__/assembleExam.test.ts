// Fixtures cho assembleExam (Task 2.1) — proof obligations:
//   metric 2: answer fidelity — đáp án ra đúng y file đáp án;
//   metric 4: image mapping — hình gắn đúng câu, chỉ câu đó;
//   mỗi error code trả literal code + questionNumber; boundary tại limit.

import { describe, expect, it } from "vitest";
import { assembleExam, assembleExamLenient } from "../assembleExam";
import { LIMITS } from "../limits";
import type {
  ChoiceId,
  ExamMeta,
  ExtractedAnswer,
  ExtractedQuestion,
  SubItemId,
} from "../types";

const META: ExamMeta = {
  title: "Đề kiểm tra Toán",
  subject: "Toán",
  grade: 10,
  durationMinutes: 45,
};

function mcq(number: number, overrides: Partial<ExtractedQuestion> = {}): ExtractedQuestion {
  return {
    part: 1,
    number,
    type: "mcq",
    stem: `Câu ${number}: 1 + ${number} = ?`,
    choices: (["A", "B", "C", "D"] as ChoiceId[]).map((id, i) => ({
      id,
      text: `${number + i}`,
    })),
    ...overrides,
  };
}

function mcqAnswer(number: number, letter: ChoiceId): ExtractedAnswer {
  return { part: 1, number, type: "mcq", letter };
}

function errorTuples(result: ReturnType<typeof assembleExam>) {
  if (result.ok) throw new Error("expected errors");
  return result.errors.map((e) => [e.code, e.questionNumber]);
}

describe("assembleExam — answer fidelity (metric 2)", () => {
  it("tái tạo chính xác answer map từ file đáp án, không suy luận", () => {
    const questions = [mcq(1), mcq(2), { ...mcq(3), type: "essay" as const, choices: undefined }];
    const answers: ExtractedAnswer[] = [
      mcqAnswer(1, "B"),
      mcqAnswer(2, "D"),
      { part: 1, number: 3, type: "essay", text: "Chứng minh bằng quy nạp." },
    ];
    const result = assembleExam(questions, answers, new Map(), META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byNumber = new Map(result.value.questions.map((q) => [q.number, q]));
    expect(byNumber.get(1)?.correctAnswer).toBe("B");
    expect(byNumber.get(2)?.correctAnswer).toBe("D");
    expect(byNumber.get(2)?.essayAnswer).toBeUndefined();
    expect(byNumber.get(3)?.essayAnswer).toBe("Chứng minh bằng quy nạp.");
    expect(byNumber.get(3)?.correctAnswer).toBeUndefined();
  });

  it("topic mặc định = subject cho mọi câu (ADR-0004)", () => {
    const result = assembleExam([mcq(1)], [mcqAnswer(1, "A")], new Map(), META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions.every((q) => q.topic === "Toán")).toBe(true);
  });

  it("sắp xếp câu theo số tăng dần", () => {
    const result = assembleExam(
      [mcq(2), mcq(1)],
      [mcqAnswer(1, "A"), mcqAnswer(2, "C")],
      new Map(),
      META,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions.map((q) => q.number)).toEqual([1, 2]);
  });
});

describe("assembleExam — image mapping (metric 4)", () => {
  it("hình của Câu 5 gắn vào ĐÚNG Câu 5, các câu khác không có hình", () => {
    const questions = [1, 2, 3, 4, 5].map((n) => mcq(n));
    const answers = [1, 2, 3, 4, 5].map((n) => mcqAnswer(n, "A"));
    const images = new Map([["1:5", "https://storage.example/exam-images/e1/q5.png"]]);
    const result = assembleExam(questions, answers, images, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const q of result.value.questions) {
      if (q.number === 5)
        expect(q.imageUrl).toBe("https://storage.example/exam-images/e1/q5.png");
      else expect(q.imageUrl).toBeUndefined();
    }
  });
});

describe("assembleExam — error codes (literal code + questionNumber)", () => {
  it("NO_QUESTIONS_FOUND khi không có câu hỏi", () => {
    const result = assembleExam([], [], new Map(), META);
    expect(errorTuples(result)).toEqual([["NO_QUESTIONS_FOUND", null]]);
  });

  it("TOO_MANY_QUESTIONS khi vượt MAX_QUESTIONS (boundary: MAX pass, MAX+1 fail)", () => {
    const atLimit = Array.from({ length: LIMITS.MAX_QUESTIONS }, (_, i) => mcq(i + 1));
    const atLimitAnswers = atLimit.map((q) => mcqAnswer(q.number, "A"));
    expect(assembleExam(atLimit, atLimitAnswers, new Map(), META).ok).toBe(true);

    const overLimit = Array.from(
      { length: LIMITS.MAX_QUESTIONS + 1 },
      (_, i) => mcq(i + 1),
    );
    const result = assembleExam(overLimit, [], new Map(), META);
    expect(errorTuples(result)).toEqual([["TOO_MANY_QUESTIONS", null]]);
  });

  it("A3: mcq 2–4 lựa chọn nhãn liền từ A đều hợp lệ (True/False/Not Given)", () => {
    for (const n of [2, 3, 4]) {
      const q = mcq(1, { choices: mcq(1).choices!.slice(0, n) });
      const result = assembleExam([q], [mcqAnswer(1, "A")], new Map(), META);
      expect(result.ok).toBe(true);
    }
  });

  it("WRONG_CHOICE_COUNT khi ít hơn MIN_CHOICES lựa chọn", () => {
    const bad = mcq(2, { choices: mcq(2).choices!.slice(0, 1) });
    const result = assembleExam(
      [mcq(1), bad],
      [mcqAnswer(1, "A"), mcqAnswer(2, "A")],
      new Map(),
      META,
    );
    expect(errorTuples(result)).toContainEqual(["WRONG_CHOICE_COUNT", 2]);
  });

  it("WRONG_CHOICE_COUNT khi nhãn NHẢY CÓC (A, B, D) — dấu hiệu AI đọc sót", () => {
    // Đúng số lượng nhưng không phải tiền tố liền. Nếu lọt, màn làm bài sẽ hiện
    // "A B D" trước mặt học sinh và không tầng nào bắt lại được.
    const bad = mcq(2, {
      choices: [
        { id: "A", text: "1" },
        { id: "B", text: "2" },
        { id: "D", text: "4" },
      ],
    });
    const result = assembleExam(
      [mcq(1), bad],
      [mcqAnswer(1, "A"), mcqAnswer(2, "A")],
      new Map(),
      META,
    );
    expect(errorTuples(result)).toContainEqual(["WRONG_CHOICE_COUNT", 2]);
  });

  it("WRONG_CHOICE_COUNT khi id lựa chọn trùng nhau (4 phần tử nhưng không đủ A–D)", () => {
    const dup = mcq(1);
    dup.choices = [
      { id: "A", text: "1" },
      { id: "A", text: "2" },
      { id: "C", text: "3" },
      { id: "D", text: "4" },
    ];
    const result = assembleExam([dup], [mcqAnswer(1, "A")], new Map(), META);
    expect(errorTuples(result)).toContainEqual(["WRONG_CHOICE_COUNT", 1]);
  });

  it("EMPTY_STEM khi nội dung câu trống", () => {
    const result = assembleExam(
      [mcq(1, { stem: "   " })],
      [mcqAnswer(1, "A")],
      new Map(),
      META,
    );
    expect(errorTuples(result)).toContainEqual(["EMPTY_STEM", 1]);
  });

  it("EMPTY_CHOICE khi một lựa chọn trống (kèm nhãn trong message)", () => {
    const q = mcq(3);
    q.choices![1] = { id: "B", text: "" };
    const result = assembleExam([q], [mcqAnswer(3, "A")], new Map(), META);
    expect(errorTuples(result)).toContainEqual(["EMPTY_CHOICE", 3]);
    if (!result.ok) {
      const err = result.errors.find((e) => e.code === "EMPTY_CHOICE");
      expect(err?.message).toContain("choice B");
    }
  });

  it("ANSWER_COUNT_MISMATCH khi số đáp án khác số câu hỏi", () => {
    const result = assembleExam(
      [mcq(1), mcq(2)],
      [mcqAnswer(1, "A"), mcqAnswer(2, "B"), mcqAnswer(9, "C")],
      new Map(),
      META,
    );
    expect(errorTuples(result)).toContainEqual(["ANSWER_COUNT_MISMATCH", null]);
  });

  it("ANSWER_MISSING cho câu không có đáp án trong file", () => {
    const result = assembleExam(
      [mcq(1), mcq(2)],
      [mcqAnswer(1, "A"), mcqAnswer(9, "C")], // câu 2 thiếu; số lượng vẫn khớp
      new Map(),
      META,
    );
    expect(errorTuples(result)).toContainEqual(["ANSWER_MISSING", 2]);
  });

  it("ANSWER_MISSING khi loại đáp án không khớp loại câu (essay text cho mcq)", () => {
    const result = assembleExam(
      [mcq(1)],
      [{ part: 1, number: 1, type: "essay", text: "tự luận" }],
      new Map(),
      META,
    );
    expect(errorTuples(result)).toContainEqual(["ANSWER_MISSING", 1]);
  });

  it("STEM_TOO_LONG: đúng MAX_STEM pass, MAX_STEM+1 fail", () => {
    const atLimit = mcq(1, { stem: "x".repeat(LIMITS.MAX_STEM) });
    expect(assembleExam([atLimit], [mcqAnswer(1, "A")], new Map(), META).ok).toBe(true);

    const over = mcq(1, { stem: "x".repeat(LIMITS.MAX_STEM + 1) });
    const result = assembleExam([over], [mcqAnswer(1, "A")], new Map(), META);
    expect(errorTuples(result)).toContainEqual(["STEM_TOO_LONG", 1]);
  });

  it("CHOICE_TOO_LONG: đúng MAX_CHOICE pass, MAX_CHOICE+1 fail", () => {
    const atLimit = mcq(1);
    atLimit.choices![0] = { id: "A", text: "y".repeat(LIMITS.MAX_CHOICE) };
    expect(assembleExam([atLimit], [mcqAnswer(1, "A")], new Map(), META).ok).toBe(true);

    const over = mcq(1);
    over.choices![0] = { id: "A", text: "y".repeat(LIMITS.MAX_CHOICE + 1) };
    const result = assembleExam([over], [mcqAnswer(1, "A")], new Map(), META);
    expect(errorTuples(result)).toContainEqual(["CHOICE_TOO_LONG", 1]);
  });

  it("ESSAY_ANSWER_TOO_LONG: đúng MAX_ESSAY_ANSWER pass, +1 fail", () => {
    const essay: ExtractedQuestion = {
      part: 1,
      number: 1,
      type: "essay",
      stem: "Chứng minh định lý.",
    };
    const atLimit = assembleExam(
      [essay],
      [{ part: 1, number: 1, type: "essay", text: "z".repeat(LIMITS.MAX_ESSAY_ANSWER) }],
      new Map(),
      META,
    );
    expect(atLimit.ok).toBe(true);

    const over = assembleExam(
      [essay],
      [{ part: 1, number: 1, type: "essay", text: "z".repeat(LIMITS.MAX_ESSAY_ANSWER + 1) }],
      new Map(),
      META,
    );
    expect(errorTuples(over)).toContainEqual(["ESSAY_ANSWER_TOO_LONG", 1]);
  });

  it("gom NHIỀU lỗi trong một lần assemble (không fail-fast)", () => {
    const result = assembleExam(
      [mcq(1, { stem: "" }), mcq(2, { choices: [] })],
      [mcqAnswer(1, "A")],
      new Map(),
      META,
    );
    const tuples = errorTuples(result);
    expect(tuples).toContainEqual(["EMPTY_STEM", 1]);
    expect(tuples).toContainEqual(["WRONG_CHOICE_COUNT", 2]);
    expect(tuples).toContainEqual(["ANSWER_MISSING", 2]);
    expect(tuples).toContainEqual(["ANSWER_COUNT_MISMATCH", null]);
  });
});

// ---------------------------------------------------------------------------
// v2.1 GATE C (ADR-0005) — khoá join composite (part, number) + 2 dạng câu mới.
// ---------------------------------------------------------------------------

/** Câu true_false chuẩn PHẦN II — 4 ý a–d. */
function tf(part: number, number: number): ExtractedQuestion {
  return {
    part,
    number,
    type: "true_false",
    stem: `Cho hàm số f(x) — xét các mệnh đề sau.`,
    subItems: (["a", "b", "c", "d"] as const).map((id) => ({
      id,
      text: `mệnh đề ${id})`,
    })),
  };
}

/** Câu short_answer chuẩn PHẦN III. */
function shortQ(part: number, number: number): ExtractedQuestion {
  return { part, number, type: "short_answer", stem: `Tính giá trị biểu thức số ${number}.` };
}

const PARTS_2025 = [
  { number: 1, title: "PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn" },
  { number: 2, title: "PHẦN II. Câu trắc nghiệm đúng sai" },
  { number: 3, title: "PHẦN III. Câu trắc nghiệm trả lời ngắn" },
];

describe("v2.1 GATE C — composite join (part, number): zero cross-part overwrites (AC-030)", () => {
  it("'Câu 1' ở cả 3 phần giữ đáp án + hình RIÊNG, không đè nhau", () => {
    const questions: ExtractedQuestion[] = [
      { ...mcq(1), part: 1 },
      tf(2, 1),
      shortQ(3, 1),
    ];
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "mcq", letter: "C" },
      {
        part: 2,
        number: 1,
        type: "true_false",
        values: [
          { id: "a", value: true },
          { id: "b", value: false },
          { id: "c", value: false },
          { id: "d", value: false },
        ],
      },
      { part: 3, number: 1, type: "short_answer", value: "1260" },
    ];
    const images = new Map([["1:1", "https://storage.example/exam-images/e1/p1q1.png"]]);

    const result = assembleExam(questions, answers, images, META, PARTS_2025);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byKey = new Map(result.value.questions.map((q) => [`${q.part}:${q.number}`, q]));
    // Phần I Câu 1: mcq — đáp án C, CÓ hình.
    expect(byKey.get("1:1")?.correctAnswer).toBe("C");
    expect(byKey.get("1:1")?.imageUrl).toBe("https://storage.example/exam-images/e1/p1q1.png");
    // Phần II Câu 1: true_false — Đ/S đúng theo lưới, KHÔNG bị đè bởi phần khác.
    expect(byKey.get("2:1")?.subAnswers).toEqual({ a: true, b: false, c: false, d: false });
    expect(byKey.get("2:1")?.correctAnswer).toBeUndefined();
    expect(byKey.get("2:1")?.imageUrl).toBeUndefined();
    // Phần III Câu 1: short_answer — giá trị từ file đáp án (cột essayAnswer).
    expect(byKey.get("3:1")?.essayAnswer).toBe("1260");
    expect(result.value.parts).toEqual(PARTS_2025);
  });

  it("đề cấu trúc 2025 thu nhỏ (2 mcq + 1 TF + 2 short, số câu lặp giữa phần) join sạch", () => {
    const questions: ExtractedQuestion[] = [
      { ...mcq(1), part: 1 },
      { ...mcq(2), part: 1 },
      tf(2, 1),
      shortQ(3, 1),
      shortQ(3, 2),
    ];
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "mcq", letter: "A" },
      { part: 1, number: 2, type: "mcq", letter: "D" },
      {
        part: 2,
        number: 1,
        type: "true_false",
        values: [
          { id: "a", value: true },
          { id: "b", value: true },
          { id: "c", value: false },
          { id: "d", value: true },
        ],
      },
      { part: 3, number: 1, type: "short_answer", value: "1,04" },
      { part: 3, number: 2, type: "short_answer", value: "96,5" },
    ];
    const result = assembleExam(questions, answers, new Map(), META, PARTS_2025);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Thứ tự: sort theo (part, number).
    expect(result.value.questions.map((q) => `${q.part}:${q.number}`)).toEqual([
      "1:1",
      "1:2",
      "2:1",
      "3:1",
      "3:2",
    ]);
  });

  it("nhãn lỗi mang 'Phần P Câu N' với đề nhiều phần; partNumber trên UgcError", () => {
    // TF thiếu đáp án ý d → ANSWER_MISSING tại (2, 1).
    const answers: ExtractedAnswer[] = [
      {
        part: 2,
        number: 1,
        type: "true_false",
        values: [
          { id: "a", value: true },
          { id: "b", value: false },
          { id: "c", value: true },
        ],
      },
    ];
    const result = assembleExam([tf(2, 1)], answers, new Map(), META, PARTS_2025);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "ANSWER_MISSING");
    expect(err?.partNumber).toBe(2);
    expect(err?.questionNumber).toBe(1);
    expect(err?.message).toContain("Phần 2 Câu 1");
  });

  it("đề 1 phần giữ nhãn 'Câu N' như v2.0 (không có 'Phần')", () => {
    const result = assembleExam([mcq(1, { stem: "" })], [mcqAnswer(1, "A")], new Map(), META);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const err = result.errors.find((e) => e.code === "EMPTY_STEM");
    expect(err?.partNumber).toBeNull();
    expect(err?.message).toContain("Câu 1");
    expect(err?.message).not.toContain("Phần");
  });
});

describe("v2.1 — validate true_false (AC-031)", () => {
  const tfAnswer = (values: { id: "a" | "b" | "c" | "d"; value: boolean }[]): ExtractedAnswer => ({
    part: 2,
    number: 1,
    type: "true_false",
    values,
  });
  const fullValues = (["a", "b", "c", "d"] as const).map((id) => ({ id, value: id === "a" }));

  it("TF đầy đủ 4 ý + 4 đáp án Đ/S → sạch", () => {
    const result = assembleExam([tf(2, 1)], [tfAnswer([...fullValues])], new Map(), META, PARTS_2025);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions[0].subAnswers).toEqual({
      a: true,
      b: false,
      c: false,
      d: false,
    });
  });

  it("A2: TF MỘT ý duy nhất là hợp lệ (khối True/False đơn của đề Tiếng Anh)", () => {
    const single = { ...tf(2, 1), subItems: tf(2, 1).subItems!.slice(0, 1) };
    const result = assembleExam(
      [single],
      [tfAnswer([{ id: "a", value: true }])],
      new Map(),
      META,
      PARTS_2025,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions[0].subAnswers).toEqual({ a: true });
  });

  it("WRONG_SUB_ITEM_COUNT khi KHÔNG có ý nào — đúng ca AI nhét mệnh đề vào stem", () => {
    // Trần dưới nới xuống 1 chứ không xuống 0: subItems rỗng nghĩa là mệnh đề
    // cần chấm đang nằm ở stem, và ở đó thì không có gì để chấm Đ/S.
    const bad = { ...tf(2, 1), subItems: [] };
    const result = assembleExam([bad], [tfAnswer([...fullValues])], new Map(), META, PARTS_2025);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => [e.code, e.partNumber, e.questionNumber])).toContainEqual([
      "WRONG_SUB_ITEM_COUNT",
      2,
      1,
    ]);
  });

  it("WRONG_SUB_ITEM_COUNT khi id ý trùng nhau", () => {
    const bad = {
      ...tf(2, 1),
      subItems: [
        { id: "a" as const, text: "x" },
        { id: "a" as const, text: "y" },
        { id: "c" as const, text: "z" },
        { id: "d" as const, text: "w" },
      ],
    };
    const result = assembleExam([bad], [tfAnswer([...fullValues])], new Map(), META, PARTS_2025);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "WRONG_SUB_ITEM_COUNT")).toBe(true);
  });

  it("ANSWER_MISSING khi một ý không có đáp án Đ/S", () => {
    const result = assembleExam(
      [tf(2, 1)],
      [tfAnswer(fullValues.slice(0, 3))],
      new Map(),
      META,
      PARTS_2025,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "ANSWER_MISSING")).toBe(true);
  });

  it("ANSWER_MISSING khi đáp án sai LOẠI (mcq letter cho câu TF)", () => {
    const result = assembleExam(
      [tf(2, 1)],
      [{ part: 2, number: 1, type: "mcq", letter: "A" }],
      new Map(),
      META,
      PARTS_2025,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "ANSWER_MISSING")).toBe(true);
  });
});

describe("v2.1 — validate short_answer (AC-032)", () => {
  it("giá trị hợp lệ (kể cả số thập phân kiểu VN '1,04') → sạch, lưu ở essayAnswer", () => {
    const result = assembleExam(
      [shortQ(3, 1)],
      [{ part: 3, number: 1, type: "short_answer", value: "1,04" }],
      new Map(),
      META,
      PARTS_2025,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.questions[0].essayAnswer).toBe("1,04");
  });

  it("SHORT_ANSWER_TOO_LONG: đúng MAX_SHORT_ANSWER pass, +1 fail", () => {
    const at = assembleExam(
      [shortQ(3, 1)],
      [{ part: 3, number: 1, type: "short_answer", value: "9".repeat(LIMITS.MAX_SHORT_ANSWER) }],
      new Map(),
      META,
      PARTS_2025,
    );
    expect(at.ok).toBe(true);

    const over = assembleExam(
      [shortQ(3, 1)],
      [
        {
          part: 3,
          number: 1,
          type: "short_answer",
          value: "9".repeat(LIMITS.MAX_SHORT_ANSWER + 1),
        },
      ],
      new Map(),
      META,
      PARTS_2025,
    );
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.errors.some((e) => e.code === "SHORT_ANSWER_TOO_LONG")).toBe(true);
  });

  it("ANSWER_MISSING khi thiếu giá trị", () => {
    const result = assembleExam([shortQ(3, 1)], [], new Map(), META, PARTS_2025);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === "ANSWER_MISSING")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// A6/A7 — trần độ dài NỚI THEO MÔN.
//
// Bộ này canh đúng thứ dễ trôi nhất: bốn nhánh của maxStemFor phải khớp với
// những gì validateAssembledExam thật sự áp, VÀ con số trong lỗi phải là con số
// đã chặn — chứ không phải hằng mặc định. Một lỗi nói "tối đa 2000" cho đề Anh
// (trần thật 8000) sẽ khiến tác giả cắt bài đọc xuống 2000 ký tự một cách vô
// ích, nên `max` trong params được assert đích danh chứ không chỉ assert code.
// ---------------------------------------------------------------------------

/** META của một môn bất kỳ, giữ nguyên các field còn lại. */
function metaFor(subject: string): ExamMeta {
  return { ...META, subject };
}

function stemCase(subject: string, length: number) {
  return assembleExam(
    [mcq(1, { stem: "x".repeat(length) })],
    [mcqAnswer(1, "A")],
    new Map(),
    metaFor(subject),
  );
}

describe("A7 — trần stem theo môn", () => {
  it("môn KHÔNG có override giữ nguyên trần mặc định (không hồi quy đề cũ)", () => {
    expect(stemCase("Math", LIMITS.MAX_STEM).ok).toBe(true);
    expect(errorTuples(stemCase("Math", LIMITS.MAX_STEM + 1))).toContainEqual([
      "STEM_TOO_LONG",
      1,
    ]);
  });

  it("English nới tới MAX_STEM_BY_SUBJECT, biên +1 vẫn chặn", () => {
    const max = LIMITS.MAX_STEM_BY_SUBJECT.English;
    // Chính con số từng làm hỏng đề Anh 40 câu: dài hơn trần mặc định NHƯNG
    // nằm trong trần của môn ⇒ phải sạch lỗi, không phải chỉ "ít lỗi hơn".
    expect(stemCase("English", LIMITS.MAX_STEM + 1).ok).toBe(true);
    expect(stemCase("English", max).ok).toBe(true);
    expect(errorTuples(stemCase("English", max + 1))).toContainEqual(["STEM_TOO_LONG", 1]);
  });

  it("nhận cả tên môn THÔ chưa canonical — row cũ không bị bỏ rơi", () => {
    // exams.subject có row mang chuỗi thô (TD-016). Tra thẳng bảng override sẽ
    // trả trần mặc định cho đúng những đề cần nới, nên phải qua normalizeSubject.
    expect(stemCase("Tiếng Anh", LIMITS.MAX_STEM + 1).ok).toBe(true);
    expect(stemCase("Ngữ văn", LIMITS.MAX_STEM + 1).ok).toBe(true);
  });

  it("môn CHƯA XÁC ĐỊNH (sentinel \"\") dùng trần RỘNG NHẤT", () => {
    // Chế độ Automatic khi AI không đọc ra môn (ADR-0007). Chặt tay ở đây sinh
    // ra lỗi mà tác giả không sửa được bằng cách sửa câu. Không lọt gì vào
    // catalog: cổng publish vẫn chặn cứng subject === "".
    const widest = Math.max(
      LIMITS.MAX_STEM,
      ...Object.values(LIMITS.MAX_STEM_BY_SUBJECT),
    );
    expect(stemCase("", widest).ok).toBe(true);
    expect(errorTuples(stemCase("", widest + 1))).toContainEqual(["STEM_TOO_LONG", 1]);
  });

  it("môn không tra được (chuỗi lạ, không rỗng) dùng trần MẶC ĐỊNH", () => {
    // Khác hẳn nhánh sentinel: tác giả đã khai MỘT thứ gì đó, ta không có cớ nới.
    expect(errorTuples(stemCase("Hán Nôm", LIMITS.MAX_STEM + 1))).toContainEqual([
      "STEM_TOO_LONG",
      1,
    ]);
  });

  it("lỗi mang đúng trần ĐÃ ÁP, không phải hằng mặc định", () => {
    const result = stemCase("English", LIMITS.MAX_STEM_BY_SUBJECT.English + 1);
    if (result.ok) throw new Error("expected errors");
    const err = result.errors.find((e) => e.code === "STEM_TOO_LONG");
    expect(err?.params.max).toBe(LIMITS.MAX_STEM_BY_SUBJECT.English);
    expect(err?.params.subjectScoped).toBe(true);
    expect(err?.message).toContain(String(LIMITS.MAX_STEM_BY_SUBJECT.English));
  });

  it("môn chưa xác định KHÔNG nhắc tới \"môn đã chọn\"", () => {
    const widest = Math.max(
      LIMITS.MAX_STEM,
      ...Object.values(LIMITS.MAX_STEM_BY_SUBJECT),
    );
    const result = stemCase("", widest + 1);
    if (result.ok) throw new Error("expected errors");
    const err = result.errors.find((e) => e.code === "STEM_TOO_LONG");
    expect(err?.params.subjectScoped).toBe(false);
  });
});

describe("A6 — trần đáp án mẫu theo môn", () => {
  const essay: ExtractedQuestion = {
    part: 1,
    number: 1,
    type: "essay",
    stem: "Phân tích nhân vật.",
  };

  function essayCase(subject: string, length: number) {
    return assembleExam(
      [essay],
      [{ part: 1, number: 1, type: "essay", text: "z".repeat(length) }],
      new Map(),
      metaFor(subject),
    );
  }

  it("Literature nới tới MAX_ESSAY_ANSWER_BY_SUBJECT, biên +1 vẫn chặn", () => {
    const max = LIMITS.MAX_ESSAY_ANSWER_BY_SUBJECT.Literature;
    expect(essayCase("Literature", max).ok).toBe(true);
    expect(errorTuples(essayCase("Literature", max + 1))).toContainEqual([
      "ESSAY_ANSWER_TOO_LONG",
      1,
    ]);
  });

  it("English KHÔNG được nới ở đây — đề Anh dài ở stem, không ở đáp án mẫu", () => {
    expect(errorTuples(essayCase("English", LIMITS.MAX_ESSAY_ANSWER + 1))).toContainEqual([
      "ESSAY_ANSWER_TOO_LONG",
      1,
    ]);
  });

  it("môn không override giữ nguyên trần mặc định", () => {
    expect(essayCase("Math", LIMITS.MAX_ESSAY_ANSWER).ok).toBe(true);
    expect(errorTuples(essayCase("Math", LIMITS.MAX_ESSAY_ANSWER + 1))).toContainEqual([
      "ESSAY_ANSWER_TOO_LONG",
      1,
    ]);
  });
});

// ---------------------------------------------------------------------------
// A1 — NGỮ LIỆU DÙNG CHUNG.
//
// Điều bộ này thật sự canh: bài đọc đi qua assembler MỘT bản và ở nguyên MỘT
// bản, còn khoá tham chiếu thì không bao giờ mồ côi trong im lặng. Trước A1,
// đúng kịch bản dưới đây (7 câu một bài đọc) tạo ra 7 bản chép trong stem và 7
// lỗi STEM_TOO_LONG.
// ---------------------------------------------------------------------------

describe("A1 — ngữ liệu dùng chung", () => {
  const READING = "Reading passage. ".repeat(200); // ~3400 ký tự, vượt MAX_STEM
  const PASSAGES = [{ id: "p1", title: "Read the following passage.", text: READING }];

  /** 7 câu liên tiếp cùng trỏ vào một bài đọc — đúng hình dạng đề đã gây lỗi. */
  function readingGroup() {
    return [34, 35, 36, 37, 38, 39, 40].map((n) => mcq(n, { passageId: "p1" }));
  }

  it("bài đọc dài hơn MAX_STEM vẫn sạch lỗi khi nằm ở passages, không ở stem", () => {
    const questions = readingGroup();
    const answers = questions.map((q) => mcqAnswer(q.number, "A"));
    const result = assembleExam(questions, answers, new Map(), META, [], PASSAGES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // MỘT bản duy nhất, dù 7 câu cùng dùng.
    expect(result.value.passages).toHaveLength(1);
    expect(result.value.passages[0].text).toBe(READING);
    // Không câu nào mang bản chép của đoạn văn trong stem.
    for (const q of result.value.questions) {
      expect(q.stem).not.toContain(READING);
      expect(q.passageId).toBe("p1");
    }
  });

  it("PASSAGE_MISSING khi câu trỏ vào ngữ liệu không có trong đề", () => {
    const q = mcq(1, { passageId: "khong-ton-tai" });
    const result = assembleExam([q], [mcqAnswer(1, "A")], new Map(), META, [], PASSAGES);
    expect(errorTuples(result)).toContainEqual(["PASSAGE_MISSING", 1]);
  });

  it("câu KHÔNG khai passageId thì không bị PASSAGE_MISSING", () => {
    // Đại đa số câu của 8 môn còn lại đi đường này — nó phải hoàn toàn im lặng.
    const result = assembleExam([mcq(1)], [mcqAnswer(1, "A")], new Map(), META, [], PASSAGES);
    expect(result.ok).toBe(true);
  });

  it("EMPTY_PASSAGE và PASSAGE_TOO_LONG bắt theo VỊ TRÍ ngữ liệu, không theo số câu", () => {
    const empty = assembleExam([mcq(1)], [mcqAnswer(1, "A")], new Map(), META, [], [
      { id: "p1", text: "   " },
    ]);
    if (empty.ok) throw new Error("expected errors");
    const e1 = empty.errors.find((e) => e.code === "EMPTY_PASSAGE");
    expect(e1?.questionNumber).toBeNull();
    expect(e1?.params.passageIndex).toBe(1);

    const long = assembleExam([mcq(1)], [mcqAnswer(1, "A")], new Map(), META, [], [
      { id: "p1", text: "x" },
      { id: "p2", text: "y".repeat(LIMITS.MAX_PASSAGE + 1) },
    ]);
    if (long.ok) throw new Error("expected errors");
    const e2 = long.errors.find((e) => e.code === "PASSAGE_TOO_LONG");
    expect(e2?.params.passageIndex).toBe(2);
    expect(e2?.params.max).toBe(LIMITS.MAX_PASSAGE);
  });

  it("đề không có ngữ liệu → passages rỗng, không lỗi (mặc định của 8/10 môn)", () => {
    const result = assembleExam([mcq(1)], [mcqAnswer(1, "A")], new Map(), META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Đáp án Đúng/Sai viết bằng chữ cái TIẾNG ANH (2026-09-02).
//
// Bảng đáp án đề Tiếng Anh ghi "Câu 21: T" / "3. F". Extractor không có hình
// dạng `true_false` nào để xếp chúng vào nên hạ xuống `short_answer`, và nhánh
// "đáp án phải đúng loại" của join coi đó như KHÔNG CÓ đáp án — `subAnswers`
// rỗng, `isScored()` trả false, câu hiện "chưa chấm tự động" vĩnh viễn.
// ---------------------------------------------------------------------------
describe("assembleExam — đáp án Đ/S viết bằng T/F (đề Tiếng Anh)", () => {
  function tf(number: number, ids: SubItemId[]): ExtractedQuestion {
    return {
      part: 1,
      number,
      type: "true_false",
      stem: `Câu ${number}`,
      subItems: ids.map((id) => ({ id, text: `ý ${id}` })),
    };
  }

  // Dùng bản LENIENT: các ca "KHÔNG vớt" bên dưới cố ý để câu KHÔNG có đáp án,
  // nên bản strict trả `ANSWER_MISSING` và không cho nhìn vào `subAnswers` —
  // đúng thứ cần khẳng định là rỗng. Lenient dựng đề trong mọi ca nên cùng một
  // phép đo chạy được cho cả nhánh vớt được lẫn nhánh từ chối.
  function subAnswersOf(
    questions: ExtractedQuestion[],
    answers: ExtractedAnswer[],
    number: number
  ) {
    const { exam } = assembleExamLenient(questions, answers, new Map(), META);
    return exam.questions.find((q) => q.number === number)?.subAnswers;
  }

  it('"T" cho câu một ý → chấm được (đây chính là ca đã hỏng)', () => {
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "short_answer", value: "T" },
    ];
    expect(subAnswersOf([tf(1, ["a"])], answers, 1)).toEqual({ a: true });
  });

  it('"F" cho câu một ý', () => {
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "short_answer", value: "F" },
    ];
    expect(subAnswersOf([tf(1, ["a"])], answers, 1)).toEqual({ a: false });
  });

  it('"TFTT" cho câu bốn ý', () => {
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "short_answer", value: "TFTT" },
    ];
    expect(subAnswersOf([tf(1, ["a", "b", "c", "d"])], answers, 1)).toEqual({
      a: true,
      b: false,
      c: true,
      d: true,
    });
  });

  it("đáp án ĐÚNG DẠNG vẫn được ưu tiên, không đi qua đường vớt", () => {
    const answers: ExtractedAnswer[] = [
      {
        part: 1,
        number: 1,
        type: "true_false",
        values: [{ id: "a", value: false }],
      },
    ];
    expect(subAnswersOf([tf(1, ["a"])], answers, 1)).toEqual({ a: false });
  });

  it("KHÔNG vớt khi số ý đọc được ít hơn số ý của câu", () => {
    // Mấu chốt: `countTrueFalseCorrect()` lấy mẫu số từ `Object.keys(subAnswers)`.
    // Nhận một dòng "T" cho câu bốn ý sẽ chấm cả câu trên đúng ý a — học sinh
    // đúng 1/4 được trọn điểm. Thà để "chưa chấm".
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "short_answer", value: "T" },
    ];
    expect(subAnswersOf([tf(1, ["a", "b", "c", "d"])], answers, 1)).toBeUndefined();
  });

  it("KHÔNG vớt từ đáp án dạng mcq — chữ cái A–D là dấu hiệu khớp nhầm câu", () => {
    expect(subAnswersOf([tf(1, ["a"])], [mcqAnswer(1, "A")], 1)).toBeUndefined();
  });

  it("KHÔNG vớt từ giá trị không phải phán quyết", () => {
    const answers: ExtractedAnswer[] = [
      { part: 1, number: 1, type: "short_answer", value: "1260" },
    ];
    expect(subAnswersOf([tf(1, ["a"])], answers, 1)).toBeUndefined();
  });
});
