// Unit tests Task 2.2 — mock SDK boundary (không network/chi phí):
// mapping SDK response → Extracted* + đường EXTRACTION_FAILED.
// Chạy extractor thật với file thật thuộc pilot integration check (metric 3),
// KHÔNG nằm trong unit suite này.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// gemini.ts import "server-only" (throw ngoài môi trường server Next) → stub.
vi.mock("server-only", () => ({}));

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAIMock {
    models = { generateContent: generateContentMock };
  },
}));

process.env.GEMINI_API_KEY = "test-key-not-real";

import { extractQuestions, mapQuestionsPayload } from "../extractQuestions";
import { repairTrueFalseStem } from "../tfShape";
import { extractAnswers, mapAnswersPayload } from "../extractAnswers";
import { LIMITS } from "../limits";
import { FATAL_CALL_DEADLINE_MS } from "../gemini";
import type { FileRef } from "../fileRef";

const PNG_FILE: FileRef = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mediaType: "image/png",
};

function questionsMessage(payload: unknown, finishReason = "STOP") {
  return {
    candidates: [{ finishReason }],
    text: JSON.stringify(payload),
  };
}

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("extractQuestions — mapping từ structured output", () => {
  it("map đúng mcq + essay + imageBox; choices/imageBox null → undefined", async () => {
    generateContentMock.mockResolvedValue(
      questionsMessage({
        parts: [],
        questions: [
          {
            part: 1,
            number: 1,
            type: "mcq",
            stem: "Tính $1+1$",
            choices: [
              { id: "A", text: "1" },
              { id: "B", text: "2" },
              { id: "C", text: "3" },
              { id: "D", text: "4" },
            ],
            subItems: null,
            imageBox: null,
          },
          {
            part: 1,
            number: 2,
            type: "essay",
            stem: "Chứng minh bất đẳng thức.",
            choices: null,
            subItems: null,
            imageBox: { page: 1, box2d: [200, 100, 450, 600] },
          },
        ],
      }),
    );

    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      parts: [],
      // A1: response không khai `passages` ⇒ mảng rỗng, KHÔNG phải lỗi contract.
      // "Đề không có bài đọc chung" là trạng thái đúng của 8/10 môn.
      passages: [],
      questions: [
        {
          part: 1,
          number: 1,
          type: "mcq",
          stem: "Tính $1+1$",
          choices: [
            { id: "A", text: "1" },
            { id: "B", text: "2" },
            { id: "C", text: "3" },
            { id: "D", text: "4" },
          ],
          subItems: undefined,
          passageId: undefined,
          imageBox: undefined,
        },
        {
          part: 1,
          number: 2,
          type: "essay",
          stem: "Chứng minh bất đẳng thức.",
          choices: undefined,
          subItems: undefined,
          passageId: undefined,
          imageBox: { page: 1, box2d: [200, 100, 450, 600] },
        },
      ],
    });
  });

  it("gửi file dạng inlineData + prompt, model đúng thiết kế", async () => {
    generateContentMock.mockResolvedValue(
      questionsMessage({
        parts: [],
        questions: [
          { part: 1, number: 1, type: "essay", stem: "x", choices: null, subItems: null, imageBox: null },
        ],
      }),
    );
    await extractQuestions(PNG_FILE);
    const params = generateContentMock.mock.calls[0][0];
    expect(params.model).toBe("gemini-3.5-flash");
    expect(params.contents[0].inlineData.mimeType).toBe("image/png");
    expect(params.config.responseMimeType).toBe("application/json");
  });

  it("PDF gửi dưới dạng inlineData mimeType application/pdf", async () => {
    generateContentMock.mockResolvedValue(
      questionsMessage({
        parts: [],
        questions: [
          { part: 1, number: 1, type: "essay", stem: "x", choices: null, subItems: null, imageBox: null },
        ],
      }),
    );
    await extractQuestions({
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mediaType: "application/pdf",
    });
    const params = generateContentMock.mock.calls[0][0];
    expect(params.contents[0].inlineData.mimeType).toBe("application/pdf");
  });

  it("NO_QUESTIONS_FOUND khi model trả mảng rỗng", async () => {
    generateContentMock.mockResolvedValue(questionsMessage({ parts: [], questions: [] }));
    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("NO_QUESTIONS_FOUND");
  });

  it("EXTRACTION_FAILED khi API throw (mạng/rate limit)", async () => {
    generateContentMock.mockRejectedValue(new Error("network down"));
    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "EXTRACTION_FAILED", questionNumber: null }),
    ]);
  });

  it("EXTRACTION_FAILED khi finishReason không phải STOP (safety/max_tokens)", async () => {
    generateContentMock.mockResolvedValue(questionsMessage({ parts: [], questions: [] }, "SAFETY"));
    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("EXTRACTION_FAILED");
  });

  it("EXTRACTION_FAILED khi payload sai contract", async () => {
    generateContentMock.mockResolvedValue(
      questionsMessage({ parts: [], questions: [{ part: 1, number: "một", type: "mcq" }] }),
    );
    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("EXTRACTION_FAILED");
  });
});

describe("extractAnswers — mapping từ structured output", () => {
  it("map đúng mcq letter + essay text", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      text: JSON.stringify({
        answers: [
          { part: 1, number: 1, type: "mcq", letter: "C" },
          { part: 1, number: 2, type: "essay", text: "Dùng quy nạp." },
        ],
      }),
    });
    const result = await extractAnswers(PNG_FILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { part: 1, number: 1, type: "mcq", letter: "C" },
      { part: 1, number: 2, type: "essay", text: "Dùng quy nạp." },
    ]);
    expect(generateContentMock.mock.calls[0][0].model).toBe("gemini-3.1-flash-lite");
  });

  it("EXTRACTION_FAILED khi letter ngoài A–D", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      text: JSON.stringify({ answers: [{ part: 1, number: 1, type: "mcq", letter: "E" }] }),
    });
    const result = await extractAnswers(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("EXTRACTION_FAILED");
  });

  it("EXTRACTION_FAILED khi API throw", async () => {
    generateContentMock.mockRejectedValue(new Error("503 overloaded"));
    const result = await extractAnswers(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("EXTRACTION_FAILED");
  });
});

// Hồi quy recipe-diagnose 2026-07: mỗi lối thoát của extractor phải phát MỘT
// log chẩn đoán SERVER-SIDE riêng biệt (chống re-masking) mà mã user vẫn generic.
describe("extractQuestions — khả năng chẩn đoán (server log riêng theo lối thoát)", () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it("catch: lỗi SDK throw → log 'extractQuestions:catch' + vẫn EXTRACTION_FAILED", async () => {
    generateContentMock.mockRejectedValue(
      Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }),
    );
    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("EXTRACTION_FAILED");
    expect(errSpy).toHaveBeenCalledWith("[ugc-extract] extractQuestions:catch", expect.any(String));
    // status 429 phải xuất hiện trong detail để Step-2 phân biệt FP3/FP4.
    const logged = errSpy.mock.calls.find(
      (c: unknown[]) => c[0] === "[ugc-extract] extractQuestions:catch",
    );
    expect(String(logged?.[1])).toContain("429");
  });

  it("finishReason: non-STOP → log 'extractQuestions:finishReason' (phân biệt MAX_TOKENS)", async () => {
    generateContentMock.mockResolvedValue(
      questionsMessage({ parts: [], questions: [] }, "MAX_TOKENS"),
    );
    const result = await extractQuestions(PNG_FILE);
    expect(result.ok).toBe(false);
    expect(errSpy).toHaveBeenCalledWith(
      "[ugc-extract] extractQuestions:finishReason",
      expect.stringContaining("MAX_TOKENS"),
    );
  });

  it("mapNull: payload sai contract → log 'extractQuestions:mapNull' (prefix ≤200, không full payload)", async () => {
    generateContentMock.mockResolvedValue(
      questionsMessage({ parts: [], questions: [{ part: 1, number: "một", type: "mcq" }] }),
    );
    await extractQuestions(PNG_FILE);
    expect(errSpy).toHaveBeenCalledWith(
      "[ugc-extract] extractQuestions:mapNull",
      expect.any(String),
    );
  });

  it("deadline: call treo quá FATAL_CALL_DEADLINE_MS → abort, log 'extractQuestions:deadline'", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockImplementation(
        ({ config }: { config: { abortSignal?: AbortSignal } }) =>
          new Promise((_resolve, reject) => {
            config.abortSignal?.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      );
      const pending = extractQuestions(PNG_FILE);
      await vi.advanceTimersByTimeAsync(FATAL_CALL_DEADLINE_MS + 10);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].code).toBe("EXTRACTION_FAILED");
      expect(errSpy).toHaveBeenCalledWith(
        "[ugc-extract] extractQuestions:deadline",
        expect.any(String),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("mapper thuần (không qua SDK)", () => {
  it("mapQuestionsPayload từ chối payload không phải object/thiếu questions", () => {
    expect(mapQuestionsPayload(null)).toBeNull();
    expect(mapQuestionsPayload({})).toBeNull();
    expect(mapQuestionsPayload({ parts: [], questions: "x" })).toBeNull();
    expect(mapQuestionsPayload({ questions: [] })).toBeNull(); // thiếu parts
  });
  it("mapAnswersPayload từ chối entry sai type", () => {
    expect(mapAnswersPayload({ answers: [{ part: 1, number: 1, type: "mcq" }] })).toBeNull();
    expect(mapAnswersPayload({ answers: [{ part: 1, number: 1.5, type: "essay", text: "x" }] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Vá câu Đúng/Sai mà model để câu phán xét trong thân câu (2026-09-02).
//
// Đo trên prod: đề "ĐỀ THI HỌC KÌ 2 – ĐỀ SỐ 1" có 5 câu true_false với subItems
// rỗng, và cả đề đứng ở trạng thái `failed` vì WRONG_SUB_ITEM_COUNT — tức lỗi
// này một mình nó chặn nguyên một đề Tiếng Anh khỏi lên sàn.
// ---------------------------------------------------------------------------
describe("repairTrueFalseStem — câu phán xét bị để nhầm trong thân câu", () => {
  // Nguyên văn hình dạng model trả về trên prod.
  const PROD_STEM =
    "Listen to part of a news report on United Nation’s determination to control global warming. Decide whether the following statement is True or False.\n\nThe UN report says that harmful effects of greenhouse gases can be eliminated.";

  it("đoạn cuối thành ý a, lời dẫn ở lại thân câu", () => {
    const out = repairTrueFalseStem("true_false", PROD_STEM, undefined);
    expect(out.subItems).toEqual([
      {
        id: "a",
        text: "The UN report says that harmful effects of greenhouse gases can be eliminated.",
      },
    ]);
    expect(out.stem).toBe(
      "Listen to part of a news report on United Nation’s determination to control global warming. Decide whether the following statement is True or False."
    );
  });

  it("đi qua nguyên đường mapping thật, không chỉ gọi hàm rời", () => {
    const mapped = mapQuestionsPayload({
      parts: [],
      passages: [],
      questions: [
        { part: 1, number: 21, type: "true_false", stem: PROD_STEM, subItems: [] },
      ],
    });
    expect(mapped?.questions[0].subItems).toHaveLength(1);
    expect(mapped?.questions[0].stem).not.toContain("The UN report says");
  });

  it("KHÔNG đụng vào câu đã có ý đầy đủ", () => {
    const subItems = [{ id: "a" as const, text: "ý a" }, { id: "b" as const, text: "ý b" }];
    const out = repairTrueFalseStem("true_false", "lời dẫn\n\nkhông phải ý", subItems);
    expect(out.subItems).toBe(subItems);
    expect(out.stem).toBe("lời dẫn\n\nkhông phải ý");
  });

  it("KHÔNG đụng vào loại câu khác", () => {
    const out = repairTrueFalseStem("essay", "đoạn một\n\nđoạn hai", undefined);
    expect(out.subItems).toBeUndefined();
    expect(out.stem).toBe("đoạn một\n\nđoạn hai");
  });

  it("KHÔNG vá thân câu một đoạn — sẽ đổi một lỗi lấy lỗi EMPTY_STEM", () => {
    const out = repairTrueFalseStem("true_false", "chỉ có một đoạn duy nhất", undefined);
    expect(out.subItems).toBeUndefined();
    expect(out.stem).toBe("chỉ có một đoạn duy nhất");
  });

  it("KHÔNG vá khi đoạn cuối dài quá trần một ý", () => {
    const long = "lời dẫn\n\n" + "x".repeat(LIMITS.MAX_CHOICE + 1);
    const out = repairTrueFalseStem("true_false", long, undefined);
    expect(out.subItems).toBeUndefined();
  });
});
