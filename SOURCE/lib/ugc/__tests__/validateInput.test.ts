// Unit tests Task 4.1 — validate thuần cho extractAndAssemble:
// metadata (AC-003) + file (AC-005/006). Đây là các nhánh reject TRƯỚC AI.

import { describe, expect, it } from "vitest";
import { LIMITS } from "../limits";
import { checkUploadFile, validateExamMeta } from "../validateInput";
import { validateAssembledExam } from "../assembleExam";
import type { AssembledExam } from "../types";

const VALID_RAW = {
  title: "Đề kiểm tra giữa kỳ Toán 10",
  subject: "Toán",
  grade: "10",
  durationMinutes: "45",
  school: null,
  schoolYear: null,
  semester: null,
};

describe("validateExamMeta", () => {
  it("input hợp lệ → meta đầy đủ, không fieldErrors", () => {
    const { meta, fieldErrors } = validateExamMeta(VALID_RAW);
    expect(fieldErrors).toEqual({});
    expect(meta).toEqual({
      title: "Đề kiểm tra giữa kỳ Toán 10",
      // "Toán" → canonical "Math" (TD-016). Bản trước của test này khẳng định
      // subject đi qua NGUYÊN VĂN — nó ghim đúng cái bug: chuỗi thô chảy thẳng
      // vào exams.subject rồi cascade xuống questions.subject/topic.
      subject: "Math",
      grade: 10,
      durationMinutes: 45,
      school: undefined,
      schoolYear: undefined,
      semester: undefined,
    });
  });

  // TD-016 — đường Manual là SERVER ACTION, FormData không đáng tin dù S-01
  // render <select> từ SUBJECTS.
  describe("subject phải canonical (TD-016)", () => {
    it("alias tiếng Việt được quy đổi, không bị từ chối", () => {
      expect(validateExamMeta({ ...VALID_RAW, subject: "Vật lí" }).meta?.subject).toBe("Physics");
      expect(validateExamMeta({ ...VALID_RAW, subject: "GDCD" }).meta?.subject).toBe(
        "Civic Education"
      );
      expect(validateExamMeta({ ...VALID_RAW, subject: "Môn: Hóa học" }).meta?.subject).toBe(
        "Chemistry"
      );
    });

    it("giá trị canonical đi qua nguyên vẹn", () => {
      expect(validateExamMeta({ ...VALID_RAW, subject: "Math" }).meta?.subject).toBe("Math");
    });

    it("giá trị không map được → fieldErrors, KHÔNG ghi ra meta", () => {
      const { meta, fieldErrors } = validateExamMeta({ ...VALID_RAW, subject: "Thể dục" });
      expect(fieldErrors.subject).toBeTruthy();
      expect(meta).toBeNull();
    });

    it("subject trống vẫn là 'required', không phải 'not in list'", () => {
      expect(validateExamMeta({ ...VALID_RAW, subject: "  " }).fieldErrors.subject).toBe(
        "Subject is required."
      );
    });
  });

  it("field optional hợp lệ được parse", () => {
    const { meta } = validateExamMeta({
      ...VALID_RAW,
      school: "THPT Chuyên KHTN",
      schoolYear: "2024",
      semester: "HK2",
    });
    expect(meta?.school).toBe("THPT Chuyên KHTN");
    expect(meta?.schoolYear).toBe(2024);
    expect(meta?.semester).toBe("HK2");
  });

  it("title trống / quá dài → fieldErrors.title", () => {
    expect(validateExamMeta({ ...VALID_RAW, title: "  " }).fieldErrors.title).toBeTruthy();
    expect(
      validateExamMeta({
        ...VALID_RAW,
        title: "x".repeat(LIMITS.MAX_TITLE + 1),
      }).fieldErrors.title
    ).toBeTruthy();
    // Boundary: đúng MAX_TITLE pass.
    expect(
      validateExamMeta({ ...VALID_RAW, title: "x".repeat(LIMITS.MAX_TITLE) }).meta
    ).not.toBeNull();
  });

  it("grade ngoài 6–12 / không phải số nguyên → fieldErrors.grade", () => {
    for (const bad of ["5", "13", "abc", "9.5", "", null]) {
      const { fieldErrors } = validateExamMeta({ ...VALID_RAW, grade: bad });
      expect(fieldErrors.grade, `grade=${bad}`).toBeTruthy();
    }
    expect(validateExamMeta({ ...VALID_RAW, grade: "6" }).meta?.grade).toBe(6);
    expect(validateExamMeta({ ...VALID_RAW, grade: "12" }).meta?.grade).toBe(12);
  });

  it("duration ngoài 1–600 → fieldErrors.durationMinutes", () => {
    for (const bad of ["0", "601", "-1", "x", null]) {
      const { fieldErrors } = validateExamMeta({
        ...VALID_RAW,
        durationMinutes: bad,
      });
      expect(fieldErrors.durationMinutes, `duration=${bad}`).toBeTruthy();
    }
  });

  it("semester ngoài HK1/HK2 → fieldErrors.semester", () => {
    expect(validateExamMeta({ ...VALID_RAW, semester: "HK3" }).fieldErrors.semester).toBeTruthy();
  });

  it("schoolYear ngoài 1900–2100 → fieldErrors.schoolYear", () => {
    for (const bad of ["1899", "2101", "abc"]) {
      expect(
        validateExamMeta({ ...VALID_RAW, schoolYear: bad }).fieldErrors.schoolYear,
        `year=${bad}`
      ).toBeTruthy();
    }
  });

  it("gom nhiều fieldErrors một lần (không fail-fast)", () => {
    const { meta, fieldErrors } = validateExamMeta({
      title: "",
      subject: "",
      grade: "99",
      durationMinutes: "0",
      school: null,
      schoolYear: null,
      semester: "XX",
    });
    expect(meta).toBeNull();
    expect(Object.keys(fieldErrors).sort()).toEqual([
      "durationMinutes",
      "grade",
      "semester",
      "subject",
      "title",
    ]);
  });
});

describe("checkUploadFile", () => {
  it("mime hợp lệ + size trong hạn → ok", () => {
    for (const type of LIMITS.ALLOWED_MIME) {
      expect(checkUploadFile({ type, size: 1024 }).ok, type).toBe(true);
    }
    // Boundary: đúng MAX_FILE_BYTES pass.
    expect(checkUploadFile({ type: "image/png", size: LIMITS.MAX_FILE_BYTES }).ok).toBe(true);
  });

  it("mime lạ → reject với message", () => {
    const r = checkUploadFile({ type: "image/gif", size: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("Unsupported");
  });

  it("quá MAX_FILE_BYTES → reject kèm UgcError FILE_TOO_LARGE", () => {
    const r = checkUploadFile({
      type: "application/pdf",
      size: LIMITS.MAX_FILE_BYTES + 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors?.[0]?.code).toBe("FILE_TOO_LARGE");
  });
});

describe("validateAssembledExam — dùng lại cho publish gate (AC-013/016)", () => {
  it("đề sạch → 0 lỗi (đủ điều kiện publish)", () => {
    const exam: AssembledExam = {
      meta: {
        title: "Đề",
        subject: "Toán",
        grade: 10,
        durationMinutes: 45,
      },
      parts: [],
    passages: [],
      questions: [
        {
          part: 1,
          number: 1,
          type: "mcq",
          stem: "1+1=?",
          choices: [
            { id: "A", text: "1" },
            { id: "B", text: "2" },
            { id: "C", text: "3" },
            { id: "D", text: "4" },
          ],
          correctAnswer: "B",
          topic: "Toán",
        },
      ],
    };
    expect(validateAssembledExam(exam)).toEqual([]);
  });

  it("mcq thiếu correctAnswer / essay thiếu essayAnswer → ANSWER_MISSING (chặn publish)", () => {
    const exam: AssembledExam = {
      meta: { title: "Đề", subject: "Toán", grade: 10, durationMinutes: 45 },
      parts: [],
    passages: [],
      questions: [
        {
          part: 1,
          number: 1,
          type: "mcq",
          stem: "1+1=?",
          choices: [
            { id: "A", text: "1" },
            { id: "B", text: "2" },
            { id: "C", text: "3" },
            { id: "D", text: "4" },
          ],
          topic: "Toán",
        },
        { part: 1, number: 2, type: "essay", stem: "Chứng minh.", topic: "Toán" },
      ],
    };
    const errors = validateAssembledExam(exam);
    expect(errors.map((e) => [e.code, e.questionNumber])).toEqual([
      ["ANSWER_MISSING", 1],
      ["ANSWER_MISSING", 2],
    ]);
  });
});
