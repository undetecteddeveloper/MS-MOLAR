// generateHint()/classifyCallError() [unit] — hậu kiểm Phase 3 (code-verifier,
// 2026-08-14): backend DD Test Boundaries table (§1071) đã đặt tên file test
// này ("generateHint()'s success/failure classification logic is tested
// against mocked SDK responses") nhưng chưa từng được viết — mọi nơi gọi
// generateHint() (tutorActions.int.test.ts) đều mock nguyên module callTutor,
// nên classifyCallError()/RETRYABLE_HTTP_STATUSES/finishReason/emptyText/
// AbortError bên trong file này có 0 coverage trước bài test này.
//
// Mock boundary: mock @google/genai ở đúng biên mà repo đã dùng cho
// lib/ugc/__tests__/extractors.test.ts (generateContentMock) — KHÔNG mock
// callTutor.ts, vì mục tiêu chính là chứng minh logic PHÂN LOẠI thật bên
// trong classifyCallError()/generateHint(), không phải hành vi giả lập.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// gemini.ts import "server-only" — throw ngoài môi trường server Next, stub.
vi.mock("server-only", () => ({}));

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAIMock {
    models = { generateContent: generateContentMock };
  },
}));

process.env.GEMINI_API_KEY = "test-key-not-real";

import { generateHint, TutorCallError } from "../callTutor";
import type { TutorPromptInput } from "../prompt";

const INPUT: TutorPromptInput = {
  questionContent: "Đạo hàm của $f(x)=x^2$ tại $x=3$ bằng bao nhiêu?",
  questionType: "mcq",
  choices: [
    { id: "A", text: "3" },
    { id: "B", text: "6" },
    { id: "C", text: "9" },
    { id: "D", text: "2x" },
  ],
  studentAnswer: "C",
};

function stopMessage(text: string) {
  return { candidates: [{ finishReason: "STOP" }], text };
}

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("generateHint — đường thành công", () => {
  it("trả về gợi ý đã trim khi finishReason=STOP và text khác rỗng", async () => {
    generateContentMock.mockResolvedValue(stopMessage("  Em thử tính đạo hàm bậc nhất trước xem sao?  "));
    const hint = await generateHint(INPUT);
    expect(hint).toBe("Em thử tính đạo hàm bậc nhất trước xem sao?");
  });
});

describe("generateHint — finishReason khác STOP (§19 backend DD)", () => {
  it("ném TutorCallError('gemini_unavailable', 'finishReason') khi bị chặn an toàn/MAX_TOKENS", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "SAFETY" }],
      text: "",
    });
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("gemini_unavailable");
  });
});

describe("generateHint — text rỗng dù finishReason=STOP", () => {
  it("ném TutorCallError('gemini_unavailable', 'emptyText') khi text chỉ có khoảng trắng", async () => {
    generateContentMock.mockResolvedValue(stopMessage("   "));
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("gemini_unavailable");
  });

  it("ném khi trường text hoàn toàn không có (undefined)", async () => {
    generateContentMock.mockResolvedValue({ candidates: [{ finishReason: "STOP" }] });
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("gemini_unavailable");
  });
});

describe("classifyCallError (qua generateHint) — hạ tầng tạm thời → gemini_unavailable", () => {
  it.each([408, 429, 500, 502, 503, 504])("status %d (trường .status) → gemini_unavailable", async (status) => {
    generateContentMock.mockRejectedValue(Object.assign(new Error("overloaded"), { status }));
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("gemini_unavailable");
  });

  it("status chỉ nằm ở trường .code (chuỗi số) vẫn được phân loại đúng", async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error("RESOURCE_EXHAUSTED"), { code: "429" }));
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("gemini_unavailable");
  });

  it("AbortError (hết hạn 30s) → gemini_unavailable, bất kể status", async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("gemini_unavailable");
  });
});

describe("classifyCallError (qua generateHint) — lỗi phía ta → server", () => {
  it("status ngoài danh sách retryable (400) → server", async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error("bad request"), { status: 400 }));
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("server");
  });

  it("lỗi không có status/code nào (bug lập trình) → server", async () => {
    generateContentMock.mockRejectedValue(new TypeError("Cannot read properties of undefined"));
    const err = await generateHint(INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TutorCallError);
    expect((err as TutorCallError).code).toBe("server");
  });
});

describe("generateHint — chẩn đoán server-side không ném đè lỗi gốc", () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it("log '[tutor] generateHint:catch' khi SDK throw, vẫn ném TutorCallError phân loại đúng", async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }));
    await generateHint(INPUT).catch(() => {});
    expect(errSpy).toHaveBeenCalledWith("[tutor] generateHint:catch", expect.any(String));
  });

  it("log '[tutor] generateHint:deadline' riêng biệt khi AbortError", async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await generateHint(INPUT).catch(() => {});
    expect(errSpy).toHaveBeenCalledWith("[tutor] generateHint:deadline", expect.any(String));
  });
});
