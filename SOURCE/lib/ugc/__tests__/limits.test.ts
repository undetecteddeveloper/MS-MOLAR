// limits — trần bài làm tự luận theo môn (2026-09-13) và trần DB đi kèm.
//
// Hai bất biến: (1) mọi môn không có override dùng trần mặc định, môn chưa
// biết dùng trần RỘNG NHẤT (không cắt oan vì thiếu dữ liệu); (2) trần DB mà
// verify:schema probe = trần rộng nhất, và nó không bao giờ nhỏ hơn bất kỳ
// trần theo môn nào — nếu không, Postgres từ chối nguyên lượt nộp bài.

import { describe, expect, it } from "vitest";
import {
  LIMITS,
  attemptAnswerDbCeiling,
  maxAttemptAnswerFor,
  maxEssayAnswerFor,
  maxStemFor,
} from "@/lib/ugc/limits";

describe("maxAttemptAnswerFor", () => {
  it("Ngữ văn và Tiếng Anh: 8000, qua cả nhãn Việt lẫn khoá canonical", () => {
    for (const s of ["Literature", "Ngữ văn", "ngữ văn", "English", "Tiếng Anh", "Môn: Ngữ văn"]) {
      expect(maxAttemptAnswerFor(s), s).toBe(8000);
    }
  });

  it("môn khác: trần mặc định 4000", () => {
    for (const s of ["Math", "Toán", "Physics", "Chemistry", "History"]) {
      expect(maxAttemptAnswerFor(s), s).toBe(LIMITS.MAX_ATTEMPT_ANSWER);
    }
    expect(LIMITS.MAX_ATTEMPT_ANSWER).toBe(4000);
  });

  it("môn chưa biết (sentinel rỗng/null) → trần rộng nhất; chuỗi lạ → mặc định", () => {
    expect(maxAttemptAnswerFor("")).toBe(8000);
    expect(maxAttemptAnswerFor("   ")).toBe(8000);
    expect(maxAttemptAnswerFor(null)).toBe(8000);
    expect(maxAttemptAnswerFor(undefined)).toBe(8000);
    expect(maxAttemptAnswerFor("Thiên văn")).toBe(4000);
  });
});

describe("attemptAnswerDbCeiling", () => {
  it("bằng trần rộng nhất và không nhỏ hơn bất kỳ trần theo môn nào", () => {
    const ceiling = attemptAnswerDbCeiling();
    expect(ceiling).toBe(8000);
    expect(ceiling).toBeGreaterThanOrEqual(LIMITS.MAX_ATTEMPT_ANSWER);
    for (const v of Object.values(LIMITS.MAX_ATTEMPT_ANSWER_BY_SUBJECT)) {
      expect(ceiling).toBeGreaterThanOrEqual(v);
    }
  });

  it("schema.sql khai đúng con số này trong CHECK của attempt_answers", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync("supabase/schema.sql", "utf8");
    const m = sql.match(/attempt_answers_answer_check\s*\n?\s*check \(answer is null or length\(answer\) <= (\d+)\)/);
    expect(m, "không tìm thấy CHECK attempt_answers_answer_check trong schema.sql").not.toBeNull();
    expect(Number(m![1])).toBe(attemptAnswerDbCeiling());
  });
});

describe("ba bảng theo môn đọc cùng một cách", () => {
  it("cùng nhánh 'chưa biết môn → rộng nhất' với maxStemFor/maxEssayAnswerFor", () => {
    expect(maxStemFor("")).toBe(8000);
    expect(maxEssayAnswerFor("")).toBe(8000);
    expect(maxAttemptAnswerFor("")).toBe(8000);
  });
});
