// suggestWeakSkills / weakSkillIds [unit] — reducer thuần, không I/O, không mock
// (brief 20261003 AC-01..04). Mỗi `describe` ghim một trạng thái của thẻ vàng.

import { describe, expect, it } from "vitest";
import { SUBJECT_ORDER } from "@/lib/analytics/constants";
import type { SkillBucket, SubjectSkillBreakdown } from "@/lib/analytics/skillBreakdown";
import {
  defaultSuggestionSubject,
  examsHref,
  suggestWeakSkills,
  weakSkillIds,
  type ExamRef,
  type SubjectSuggestion,
} from "../weakSkillSuggestions";

const THRESHOLD = 0.7;

function bucket(id: string | null, label: string | null, correct: number, total: number): SkillBucket {
  return { skillNodeId: id, labelVi: label, correct, total, accuracy: total > 0 ? correct / total : 0 };
}

/** Mỗi môn: yếu nhất trước, ô "Chưa phân loại" cuối — đúng thứ tự reducer thật trả. */
function subjectOf(subject: SubjectSkillBreakdown["subject"], ...skills: SkillBucket[]): SubjectSkillBreakdown {
  return { subject, skills };
}

function suggest(
  breakdown: SubjectSkillBreakdown[],
  examsBySkill: Record<string, ExamRef[]> = {},
  done: string[] = [],
  threshold = THRESHOLD,
): SubjectSuggestion[] {
  return suggestWeakSkills({
    breakdown,
    examsBySkill: new Map(Object.entries(examsBySkill)),
    doneExamIds: new Set(done),
    threshold,
  });
}

function mathOf(result: SubjectSuggestion[]): SubjectSuggestion {
  return result.find((s) => s.subject === "Math")!;
}

describe("suggestWeakSkills — hình dạng đầu ra", () => {
  it("luôn đủ 7 phần tử theo SUBJECT_ORDER, kể cả khi chưa làm bài nào", () => {
    const result = suggest([]);

    expect(result.map((s) => s.subject)).toEqual([...SUBJECT_ORDER]);
    expect(result.every((s) => s.kind === "none" && s.reason === "no-data")).toBe(true);
  });
});

describe("no-data — chưa biết dạng nào yếu", () => {
  it("môn chỉ có ô 'Chưa phân loại' → no-data (câu chưa gắn dạng không phải một dạng bài)", () => {
    const result = suggest([subjectOf("Math", bucket(null, null, 0, 5))]);

    expect(mathOf(result)).toEqual({ kind: "none", subject: "Math", reason: "no-data" });
  });

  it("môn vắng trong bảng kê → no-data", () => {
    const result = suggest([subjectOf("Physics", bucket("ly-a", "Động học", 9, 10))]);

    expect(mathOf(result)).toEqual({ kind: "none", subject: "Math", reason: "no-data" });
  });
});

describe("no-weak — làm tốt mọi dạng đã làm", () => {
  it("mọi dạng ≥ ngưỡng → no-weak; đúng 70% KHÔNG phải yếu (so sánh 'dưới' ngưỡng)", () => {
    const result = suggest([
      subjectOf("Math", bucket("a", "Dạng A", 7, 10), bucket("b", "Dạng B", 10, 10)),
    ]);

    expect(mathOf(result)).toEqual({ kind: "none", subject: "Math", reason: "no-weak" });
  });

  it("ngưỡng được tiêm vào: 60% là yếu ở ngưỡng 0,7 nhưng không yếu ở ngưỡng 0,5", () => {
    const breakdown = [subjectOf("Math", bucket("a", "Dạng A", 6, 10))];
    const exams = { a: [{ id: "E1", subject: "Math" }] };

    expect(mathOf(suggest(breakdown, exams, [], 0.7)).kind).toBe("suggest");
    expect(mathOf(suggest(breakdown, exams, [], 0.5))).toEqual({
      kind: "none",
      subject: "Math",
      reason: "no-weak",
    });
  });
});

describe("suggest — có dạng yếu và còn đề chưa làm", () => {
  it("nêu nhãn, đúng a/b và số đề chưa làm của dạng yếu nhất", () => {
    const result = suggest(
      [subjectOf("Math", bucket("a", "Hàm số bậc hai", 1, 5), bucket("b", "Tích phân", 9, 10))],
      { a: [{ id: "E1", subject: "Math" }, { id: "E2", subject: "Math" }] },
      ["E1"],
    );

    expect(mathOf(result)).toEqual({
      kind: "suggest",
      subject: "Math",
      skillNodeId: "a",
      skillLabel: "Hàm số bậc hai",
      correct: 1,
      total: 5,
      openExamCount: 1,
    });
  });

  it("đề của MÔN KHÁC không tính (kể cả khi chứa đúng dạng đó)", () => {
    const result = suggest(
      [subjectOf("Math", bucket("a", "Dạng A", 1, 5))],
      { a: [{ id: "E-ly", subject: "Physics" }] },
    );

    expect(mathOf(result)).toMatchObject({ kind: "none", reason: "no-exam", skillLabel: "Dạng A" });
  });

  it("dạng yếu nhất hết đề mới → chuyển sang dạng yếu kế tiếp còn đề, không dừng ở dạng đầu", () => {
    const result = suggest(
      [subjectOf("Math", bucket("a", "Dạng A", 0, 5), bucket("b", "Dạng B", 2, 5))],
      {
        a: [{ id: "E1", subject: "Math" }],
        b: [{ id: "E2", subject: "Math" }],
      },
      ["E1"],
    );

    expect(mathOf(result)).toMatchObject({ kind: "suggest", skillNodeId: "b", openExamCount: 1 });
  });

  it("dạng yếu nhất không có đề nào nhưng dạng kế tiếp có → gợi ý dạng kế tiếp", () => {
    const result = suggest(
      [subjectOf("Math", bucket("a", "Dạng A", 0, 5), bucket("b", "Dạng B", 2, 5))],
      { b: [{ id: "E2", subject: "Math" }] },
    );

    expect(mathOf(result)).toMatchObject({ kind: "suggest", skillNodeId: "b" });
  });

  it("mỗi môn tính độc lập: Toán gợi ý được, Lý không có gì để luyện", () => {
    const result = suggest(
      [
        subjectOf("Math", bucket("a", "Dạng A", 1, 5)),
        subjectOf("Physics", bucket("ly-a", "Động học", 9, 10)),
      ],
      { a: [{ id: "E1", subject: "Math" }] },
    );

    expect(result.find((s) => s.subject === "Math")!.kind).toBe("suggest");
    expect(result.find((s) => s.subject === "Physics")).toEqual({
      kind: "none",
      subject: "Physics",
      reason: "no-weak",
    });
  });
});

describe("all-done — đề chứa dạng yếu đều đã làm", () => {
  it("đề duy nhất chứa dạng yếu là đề đã làm → all-done, nêu dạng yếu và số liệu", () => {
    const result = suggest(
      [subjectOf("Math", bucket("a", "Dạng A", 1, 5))],
      { a: [{ id: "E1", subject: "Math" }] },
      ["E1"],
    );

    expect(mathOf(result)).toEqual({
      kind: "none",
      subject: "Math",
      reason: "all-done",
      skillLabel: "Dạng A",
      correct: 1,
      total: 5,
    });
  });

  it("nêu dạng yếu nhất CÓ đề (bỏ qua dạng yếu hơn nhưng không đề nào) — lý do là 'đã làm hết', không phải 'không có đề'", () => {
    const result = suggest(
      [subjectOf("Math", bucket("a", "Dạng A", 0, 5), bucket("b", "Dạng B", 2, 5))],
      { b: [{ id: "E2", subject: "Math" }] },
      ["E2"],
    );

    expect(mathOf(result)).toMatchObject({ reason: "all-done", skillLabel: "Dạng B" });
  });
});

describe("no-exam — không đề published nào chứa dạng yếu", () => {
  it("dạng yếu không có trong examsBySkill → no-exam, nêu dạng yếu nhất", () => {
    const result = suggest([
      subjectOf("Math", bucket("a", "Dạng A", 0, 5), bucket("b", "Dạng B", 2, 5)),
    ]);

    expect(mathOf(result)).toEqual({
      kind: "none",
      subject: "Math",
      reason: "no-exam",
      skillLabel: "Dạng A",
      correct: 0,
      total: 5,
    });
  });

  it("khoá có mảng rỗng (đề đã gỡ) cũng là no-exam", () => {
    const result = suggest([subjectOf("Math", bucket("a", "Dạng A", 0, 5))], { a: [] });

    expect(mathOf(result)).toMatchObject({ reason: "no-exam" });
  });
});

describe("examsHref", () => {
  it("có dạng bài: lọc cả môn lẫn dạng (AC-05)", () => {
    expect(examsHref("Math", "ham-so-bac-hai")).toBe("/exams?subject=Math&skill=ham-so-bac-hai");
  });

  it("không dạng bài: chỉ lọc môn (liên kết 'Xem đề <môn>')", () => {
    expect(examsHref("Literature")).toBe("/exams?subject=Literature");
  });
});

describe("defaultSuggestionSubject — môn mở sẵn (AC-01)", () => {
  it("môn đầu tiên CÓ gợi ý, dù môn đứng trước đã có dữ liệu", () => {
    const result = suggest(
      [
        subjectOf("Math", bucket("a", "A", 10, 10)),
        subjectOf("Chemistry", bucket("hoa-a", "HA", 1, 5)),
      ],
      { "hoa-a": [{ id: "E1", subject: "Chemistry" }] },
    );

    expect(defaultSuggestionSubject(result)).toBe("Chemistry");
  });

  it("không môn nào có gợi ý → môn đầu tiên đã có dữ liệu dạng bài (bỏ qua no-data)", () => {
    const result = suggest([subjectOf("Biology", bucket("sinh-a", "SA", 9, 10))]);

    expect(defaultSuggestionSubject(result)).toBe("Biology");
  });

  it("chưa có dữ liệu ở môn nào → Toán (đầu danh sách)", () => {
    expect(defaultSuggestionSubject(suggest([]))).toBe("Math");
  });
});

describe("weakSkillIds", () => {
  it("gom id dạng yếu của mọi môn, không trùng, bỏ ô chưa phân loại và dạng đạt ngưỡng", () => {
    const ids = weakSkillIds(
      [
        subjectOf(
          "Math",
          bucket("a", "A", 1, 5),
          bucket("b", "B", 9, 10),
          bucket(null, null, 0, 3),
        ),
        subjectOf("Physics", bucket("ly-a", "LA", 0, 2), bucket("a", "A", 1, 5)),
      ],
      THRESHOLD,
    );

    expect(ids.sort()).toEqual(["a", "ly-a"]);
  });

  it("không dạng yếu nào → mảng rỗng (tầng đọc khỏi gọi DB)", () => {
    expect(weakSkillIds([subjectOf("Math", bucket("a", "A", 10, 10))], THRESHOLD)).toEqual([]);
    expect(weakSkillIds([], THRESHOLD)).toEqual([]);
  });
});
