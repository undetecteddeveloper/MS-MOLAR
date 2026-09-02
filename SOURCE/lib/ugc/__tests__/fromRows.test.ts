// Unit tests Task 4.2 + v2.1 C1 — helper thuần dùng bởi queries/actions.

import { describe, expect, it } from "vitest";
import {
  assembledFromRows,
  questionIdentityFromId,
  questionNumberFromId,
} from "../fromRows";
import { imagePathFromUrl } from "../imageUrl";

describe("questionNumberFromId", () => {
  it("lấy số câu từ id `{examId}-q{n}`", () => {
    expect(questionNumberFromId("ugc-abc-q5", 99)).toBe(5);
    expect(questionNumberFromId("ugc-abc-q12", 99)).toBe(12);
  });
  it("id lạ → fallback theo thứ tự", () => {
    expect(questionNumberFromId("q-t10-1", 3)).toBe(3);
  });
});

describe("questionIdentityFromId (v2.1 — chấp nhận CẢ 2 dạng id)", () => {
  it("id v2.1 `{examId}-p{part}q{n}` → (part, number)", () => {
    expect(questionIdentityFromId("ugc-abc-p2q1", 99)).toEqual({ part: 2, number: 1 });
    expect(questionIdentityFromId("ugc-abc-p3q12", 99)).toEqual({ part: 3, number: 12 });
  });
  it("id v2.0 `{examId}-q{n}` → part 1 (đề cũ)", () => {
    expect(questionIdentityFromId("ugc-abc-q5", 99)).toEqual({ part: 1, number: 5 });
  });
  it("id lạ → (1, fallback)", () => {
    expect(questionIdentityFromId("weird", 7)).toEqual({ part: 1, number: 7 });
  });
});

describe("assembledFromRows", () => {
  const examRow = {
    title: "Đề Toán",
    subject: "Toán",
    grade: 10,
    duration_minutes: 45,
    school: null,
    school_year: null,
    semester: null,
    question_ids: ["e-q1", "e-q2"],
  };

  it("map rows → AssembledExam đúng thứ tự question_ids; essay bỏ choices", () => {
    const qRows = [
      {
        id: "e-q2",
        content: "Chứng minh.",
        choices: [],
        correct_answer: null,
        essay_answer: "Dùng quy nạp.",
        image_url: null,
        question_type: "essay",
        topic: "Toán",
      },
      {
        id: "e-q1",
        content: "1+1=?",
        choices: [
          { id: "A", text: "1" },
          { id: "B", text: "2" },
          { id: "C", text: "3" },
          { id: "D", text: "4" },
        ],
        correct_answer: "B",
        essay_answer: null,
        image_url: "https://x.supabase.co/exam-images/e/q1.png",
        question_type: "mcq",
        topic: "Toán",
      },
    ];
    const exam = assembledFromRows(examRow, qRows);
    expect(exam.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(exam.questions[0].type).toBe("mcq");
    expect(exam.questions[0].correctAnswer).toBe("B");
    expect(exam.questions[0].imageUrl).toBe(
      "https://x.supabase.co/exam-images/e/q1.png",
    );
    expect(exam.questions[1].type).toBe("essay");
    expect(exam.questions[1].choices).toBeUndefined();
    expect(exam.questions[1].essayAnswer).toBe("Dùng quy nạp.");
  });

  it("row thiếu (id trong question_ids nhưng không có row) bị bỏ qua", () => {
    const exam = assembledFromRows(examRow, [
      {
        id: "e-q1",
        content: "x",
        choices: [],
        correct_answer: null,
        essay_answer: null,
        image_url: null,
        question_type: "mcq",
        topic: "Toán",
      },
    ]);
    expect(exam.questions).toHaveLength(1);
    expect(exam.questions[0].number).toBe(1);
  });
});

describe("imagePathFromUrl", () => {
  it("tách path object trong bucket từ URL", () => {
    expect(
      imagePathFromUrl(
        "https://x.supabase.co/storage/v1/object/public/exam-images/ugc-1/q5.png",
      ),
    ).toBe("ugc-1/q5.png");
  });
  it("URL không chứa exam-images / URL hỏng → null", () => {
    expect(imagePathFromUrl("https://x.supabase.co/other/y.png")).toBeNull();
    expect(imagePathFromUrl("not-a-url")).toBeNull();
  });
});

describe("assembledFromRows — A1 ngữ liệu dùng chung", () => {
  const base = {
    title: "Đề Tiếng Anh",
    subject: "English",
    grade: 12,
    duration_minutes: 60,
    school: null,
    school_year: null,
    semester: null,
    question_ids: ["e-p1q34", "e-p1q35"],
  };

  function qRow(id: string, passageId: string | null) {
    return {
      id,
      content: "What does the word 'it' refer to?",
      choices: [
        { id: "A", text: "a" },
        { id: "B", text: "b" },
        { id: "C", text: "c" },
        { id: "D", text: "d" },
      ],
      correct_answer: "A",
      essay_answer: null,
      image_url: null,
      question_type: "mcq",
      topic: "English",
      passage_id: passageId,
    };
  }

  it("dựng lại passages + passageId từ row DB", () => {
    const passages = [{ id: "p1", title: "Read the passage.", text: "Long reading text." }];
    const exam = assembledFromRows({ ...base, passages }, [
      qRow("e-p1q34", "p1"),
      qRow("e-p1q35", "p1"),
    ]);
    expect(exam.passages).toEqual(passages);
    expect(exam.questions.map((q) => q.passageId)).toEqual(["p1", "p1"]);
  });

  it("row CŨ (cột null, chưa từng có ngữ liệu) → passages rỗng, passageId undefined", () => {
    // Bất biến của §8d: hai cột nullable ⇒ đề cũ tự đúng, không cần backfill.
    // `null` phải thành `undefined`/`[]`, KHÔNG được rò `null` vào AssembledExam.
    const exam = assembledFromRows({ ...base, passages: null }, [
      qRow("e-p1q34", null),
      qRow("e-p1q35", null),
    ]);
    expect(exam.passages).toEqual([]);
    expect(exam.questions.every((q) => q.passageId === undefined)).toBe(true);
  });

  it("cột passages VẮNG HẲN (row trước khi migration chạy) cũng an toàn", () => {
    const exam = assembledFromRows(base, [qRow("e-p1q34", null), qRow("e-p1q35", null)]);
    expect(exam.passages).toEqual([]);
  });
});
