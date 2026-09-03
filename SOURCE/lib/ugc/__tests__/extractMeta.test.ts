// Unit tests Task M3 (v2.2) — mock SDK boundary như extractors.test.ts:
// mapping SDK response → ExtractedMeta + đường META_EXTRACTION_FAILED (non-fatal).
// Chạy extractor thật với file thật thuộc real-file check (Gate G), KHÔNG nằm
// trong unit suite này.

import { beforeEach, describe, expect, it, vi } from "vitest";

// gemini.ts import "server-only" (throw ngoài môi trường server Next) → stub.
vi.mock("server-only", () => ({}));

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAIMock {
    models = { generateContent: generateContentMock };
  },
}));

process.env.GEMINI_API_KEY = "test-key-not-real";

import { extractMeta, mapMetaPayload } from "../extractMeta";
import type { FileRef } from "../fileRef";

const PNG_FILE: FileRef = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mediaType: "image/png",
};

function metaMessage(payload: unknown, finishReason = "STOP") {
  return {
    candidates: [{ finishReason }],
    text: JSON.stringify(payload),
  };
}

const FULL_PAYLOAD = {
  title: "ĐỀ KIỂM TRA CUỐI HỌC KÌ I",
  subject: "Toán",
  grade: 12,
  durationMinutes: 90,
  school: "TRƯỜNG THPT CHUYÊN ABC",
  schoolYear: "2024 – 2025",
  semester: "HỌC KÌ I",
};

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("extractMeta — mapping từ structured output", () => {
  it("payload đầy đủ → ExtractedMeta nguyên văn (schoolYear/semester là chuỗi in trên đề)", async () => {
    generateContentMock.mockResolvedValue(metaMessage(FULL_PAYLOAD));
    const result = await extractMeta(PNG_FILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(FULL_PAYLOAD);
  });

  it("payload toàn null (header không in gì) → ok với mọi field null — KHÔNG lỗi", async () => {
    generateContentMock.mockResolvedValue(
      metaMessage({
        title: null,
        subject: null,
        grade: null,
        durationMinutes: null,
        school: null,
        schoolYear: null,
        semester: null,
      })
    );
    const result = await extractMeta(PNG_FILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subject).toBeNull();
    expect(result.value.grade).toBeNull();
  });

  it("gọi model rẻ (ANSWER_MODEL), không phải model đọc đề", async () => {
    generateContentMock.mockResolvedValue(metaMessage(FULL_PAYLOAD));
    await extractMeta(PNG_FILE);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(generateContentMock.mock.calls[0][0].model).toBe("gemini-3.5-flash-lite");
  });
});

describe("extractMeta — đường META_EXTRACTION_FAILED (non-fatal, AC-040)", () => {
  it("payload sai contract (grade là chuỗi) → META_EXTRACTION_FAILED", async () => {
    generateContentMock.mockResolvedValue(metaMessage({ ...FULL_PAYLOAD, grade: "mười hai" }));
    const result = await extractMeta(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("META_EXTRACTION_FAILED");
  });

  it("thiếu field trong payload → META_EXTRACTION_FAILED", async () => {
    generateContentMock.mockResolvedValue(metaMessage({ title: "x" }));
    const result = await extractMeta(PNG_FILE);
    expect(result.ok).toBe(false);
  });

  it("finishReason khác STOP → META_EXTRACTION_FAILED", async () => {
    generateContentMock.mockResolvedValue(metaMessage(FULL_PAYLOAD, "MAX_TOKENS"));
    const result = await extractMeta(PNG_FILE);
    expect(result.ok).toBe(false);
  });

  it("SDK ném lỗi (rate limit/timeout) → META_EXTRACTION_FAILED, không throw", async () => {
    generateContentMock.mockRejectedValue(new Error("429"));
    const result = await extractMeta(PNG_FILE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe("META_EXTRACTION_FAILED");
  });
});

describe("mapMetaPayload — thuần", () => {
  it("null payload / không phải object → null", () => {
    expect(mapMetaPayload(null)).toBeNull();
    expect(mapMetaPayload("x")).toBeNull();
  });

  it("grade số thực (12.5) → null (phải là integer)", () => {
    expect(mapMetaPayload({ ...FULL_PAYLOAD, grade: 12.5 })).toBeNull();
  });
});
