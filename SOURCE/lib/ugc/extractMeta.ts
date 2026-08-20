// UGC Exam Upload v2.2 — AI extractor #3: TRANG 1 file đề → metadata (ADR-0007).
//
// SERVER-ONLY. MỘT call Gemini (model rẻ — cùng model extractAnswers) với
// structured output = ExtractedMeta, MỌI FIELD NULLABLE. Model chỉ đọc header,
// KHÔNG đọc/đếm câu hỏi, và BỊ CẤM suy đoán: field không in trên trang phải
// trả null (bịa ra trường/năm/thời lượng là failure — ADR-0007 kill criterion:
// null hiển thị trống ở review còn giá trị "hợp lý sai" thì lọt mắt tác giả).
//
// NON-FATAL: caller (extractAndAssemble) log rồi đi tiếp — metadata fail không
// bao giờ làm hỏng lượt upload (AC-040). schoolYear/semester trả NGUYÊN VĂN
// chuỗi in trên đề; parse là việc của normalizeMeta (code thuần).

import { makeUgcError } from "./errorCopy";
import { ANSWER_MODEL, generateContent, logExtractorExit, sdkErrorDetail } from "./gemini";
import { renderPdfPage } from "./pdf";
import { recordUsage } from "./quotaTracker";
import type { ExtractedMeta, Result } from "./types";
import type { FileRef } from "./fileRef";
import { toGeminiPart } from "./fileRef";

const nullable = (t: "string" | "integer") => ({ anyOf: [{ type: t }, { type: "null" }] });

const META_SCHEMA = {
  type: "object",
  properties: {
    title: nullable("string"),
    subject: nullable("string"),
    grade: nullable("integer"),
    durationMinutes: nullable("integer"),
    school: nullable("string"),
    schoolYear: nullable("string"),
    semester: nullable("string"),
  },
  required: [
    "title",
    "subject",
    "grade",
    "durationMinutes",
    "school",
    "schoolYear",
    "semester",
  ],
  additionalProperties: false,
} as const;

const PROMPT = `Read ONLY the header block (the first ~15 lines) of this Vietnamese exam paper and transcribe its metadata. Do NOT read, count, or transcribe any exam questions.

Vietnamese exam headers conventionally look like:
- "SỞ GD&ĐT ..." (department) and/or "TRƯỜNG THPT/THCS ..." (school) → school: prefer the TRƯỜNG line; use the SỞ line only if no TRƯỜNG line is printed.
- "ĐỀ KIỂM TRA CUỐI HỌC KÌ I ...", "ĐỀ THI THỬ ..." → title: the printed exam-title line, verbatim.
- "Môn: Toán" / "Môn thi: Vật lí – Lớp 12" → subject: the printed subject name; grade: the printed grade number (e.g. "Lớp 12" → 12).
- "Năm học: 2024 – 2025" → schoolYear: the printed year text VERBATIM as a string (e.g. "2024 – 2025"). Do not compute or reformat it.
- "HỌC KÌ I" / "Học kì II" (often inside the title line) → semester: the printed term text verbatim.
- "Thời gian làm bài: 90 phút" → durationMinutes: the printed number of minutes as an integer.

STRICT RULES:
- A field that is NOT printed on the page MUST be null. Returning null for an absent field is the correct answer.
- NEVER guess, infer, or invent a value. Do not derive the school from the department, the year from context, or the duration from the question count.
- Transcribe printed values faithfully; do not translate or normalize them.`;

/** Validate + map JSON đã parse → ExtractedMeta; null nếu sai contract. */
export function mapMetaPayload(payload: unknown): ExtractedMeta | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;

  const str = (v: unknown): string | null | undefined =>
    v === null ? null : typeof v === "string" ? v : undefined;
  const int = (v: unknown): number | null | undefined =>
    v === null ? null : typeof v === "number" && Number.isInteger(v) ? v : undefined;

  const title = str(p.title);
  const subject = str(p.subject);
  const grade = int(p.grade);
  const durationMinutes = int(p.durationMinutes);
  const school = str(p.school);
  const schoolYear = str(p.schoolYear);
  const semester = str(p.semester);
  if (
    title === undefined ||
    subject === undefined ||
    grade === undefined ||
    durationMinutes === undefined ||
    school === undefined ||
    schoolYear === undefined ||
    semester === undefined
  ) {
    return null;
  }
  return { title, subject, grade, durationMinutes, school, schoolYear, semester };
}

/** PDF → FileRef PNG của TRANG 1; ảnh → nguyên vẹn (chỉ header cần đọc). */
async function firstPageRef(file: FileRef): Promise<FileRef> {
  if (file.mediaType !== "application/pdf") return file;
  const png = await renderPdfPage(file.bytes, 1);
  return { bytes: png, mediaType: "image/png" };
}

/** Trang 1 file đề → ExtractedMeta (một call Gemini, server-only, NON-FATAL). */
export async function extractMeta(file: FileRef): Promise<Result<ExtractedMeta>> {
  // NON-FATAL (AC-040): KHÔNG dùng deadline — fail của call này không rollback.
  // Vẫn instrument 4 lối thoát để chẩn đoán server-side (không log payload).
  const startedAt = Date.now();
  try {
    // Client được dựng BÊN TRONG generateContent(), tức SAU khi rasterise trang
    // 1 — trước đây getGeminiClient() chạy trước. Khác biệt duy nhất: khi server
    // thiếu GEMINI_API_KEY, ta phí công render một trang trước khi ném. Cùng
    // `catch`, cùng META_EXTRACTION_FAILED, vẫn NON-FATAL (AC-040).
    const pageRef = await firstPageRef(file);
    const response = await generateContent({
      model: ANSWER_MODEL,
      contents: [toGeminiPart(pageRef), { text: PROMPT }],
      config: {
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseJsonSchema: META_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    // Đo trước mọi nhánh phân loại — lượt gọi hỏng vẫn tiêu token và vẫn trừ
    // vào trần request/ngày (Subscription PRD U2).
    recordUsage("metadata", ANSWER_MODEL, response.usageMetadata);

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason !== "STOP") {
      logExtractorExit("extractMeta:finishReason", {
        finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("META_EXTRACTION_FAILED", null)] };
    }
    const text = response.text;
    if (!text) {
      logExtractorExit("extractMeta:emptyText", {
        finishReason,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("META_EXTRACTION_FAILED", null)] };
    }

    const meta = mapMetaPayload(JSON.parse(text));
    if (!meta) {
      logExtractorExit("extractMeta:mapNull", {
        textLength: text.length,
        textPrefix: text.slice(0, 200),
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("META_EXTRACTION_FAILED", null)] };
    }
    return { ok: true, value: meta };
  } catch (err) {
    logExtractorExit("extractMeta:catch", {
      ...sdkErrorDetail(err),
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: false, errors: [makeUgcError("META_EXTRACTION_FAILED", null)] };
  }
}
