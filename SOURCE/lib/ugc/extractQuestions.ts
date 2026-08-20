// UGC Exam Upload v2.1 — AI extractor #1: file đề → cấu trúc phần/câu hỏi + vị trí hình.
//
// SERVER-ONLY (import "./gemini" đã gắn "server-only"). MỘT call multimodal
// duy nhất với structured output (responseJsonSchema). Model được chỉ thị
// KHÔNG BAO GIỜ đánh dấu đáp án đúng (ADR-0004 — đáp án chỉ đến từ file đáp án).
// v2.1 (ADR-0005/0006): nhận diện PHẦN I/II/III của đề chuẩn quốc gia 2025
// (số câu đánh lại từ 1 theo phần), 4 loại câu hỏi, và bbox theo GIAO THỨC
// NATIVE GEMINI (box2d [ymin,xmin,ymax,xmax] số nguyên 0–1000 — model được
// train trả format này; format tự chế {x,y,w,h}/0..1 của v2.0 cho kết quả
// 0% phát hiện hình trên file thật).
// Lỗi AI/schema → Result ok:false với EXTRACTION_FAILED, không throw cho lỗi
// thuộc về input tác giả. Không log raw AI payload.

import { makeUgcError } from "./errorCopy";
import { LIMITS } from "./limits";
import {
  FATAL_CALL_DEADLINE_MS,
  generateContent,
  logExtractorExit,
  makeDeadlineSignal,
  QUESTION_MODEL,
  sdkErrorDetail,
} from "./gemini";
import type {
  BoundingBox,
  ChoiceId,
  ExtractedPart,
  ExtractedQuestion,
  QuestionType,
  Result,
  SubItemId,
} from "./types";
import type { FileRef } from "./fileRef";
import { toGeminiPart } from "./fileRef";
import { recordUsage } from "./quotaTracker";

/** Output của extractor #1 — parts (rỗng nếu đề không chia phần) + câu hỏi. */
export type ExtractedQuestionFile = {
  parts: ExtractedPart[];
  questions: ExtractedQuestion[];
};

// JSON schema cho structured output — additionalProperties:false bắt buộc;
// nullable biểu diễn bằng anyOf [.., null].
const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          title: { type: "string" },
        },
        required: ["number", "title"],
        additionalProperties: false,
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          part: { type: "integer" },
          number: { type: "integer" },
          type: {
            type: "string",
            enum: ["mcq", "essay", "true_false", "short_answer"],
          },
          stem: { type: "string" },
          choices: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: ["A", "B", "C", "D"] },
                    text: { type: "string" },
                  },
                  required: ["id", "text"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          subItems: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: ["a", "b", "c", "d"] },
                    text: { type: "string" },
                  },
                  required: ["id", "text"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          imageBox: {
            anyOf: [
              {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  box2d: {
                    type: "array",
                    items: { type: "integer" },
                    minItems: 4,
                    maxItems: 4,
                  },
                },
                required: ["page", "box2d"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
        },
        required: ["part", "number", "type", "stem", "choices", "subItems", "imageBox"],
        additionalProperties: false,
      },
    },
  },
  required: ["parts", "questions"],
  additionalProperties: false,
} as const;

const PROMPT = `Read the attached exam question file (Vietnamese secondary-school exam) and transcribe every question.

Structure rules:
- Vietnamese national-format exams (from 2025) have PARTS with headers like "PHẦN I.", "PHẦN II.", "PHẦN III." — question numbers RESTART from 1 in each part. If the file has part headers, return each part's number and its printed title in "parts", and set each question's "part" to the part it belongs to, with "number" as printed WITHIN that part. If the file has no part headers, return "parts": [] and part = 1 for every question.
- Classify each question:
  - "mcq": multiple choice with exactly 4 options A–D (typical of PHẦN I).
  - "true_false": a question with sub-items a) b) c) d) that are each answered Đúng/Sai (typical of PHẦN II). Transcribe the sub-items into "subItems" (choices = null).
  - "short_answer": answered by writing a short value/number (typical of PHẦN III). choices = null, subItems = null.
  - "essay": free-form written answer. choices = null, subItems = null.

Transcription rules:
- Transcribe the stem verbatim, including math as LaTeX ($...$) where the source shows formulas. Do NOT include the "Câu N" prefix, the choices, or the sub-items in the stem.
- For mcq, transcribe exactly the choices printed for options A, B, C, D.
- For true_false, transcribe each sub-item a)–d) text into subItems.
- NEVER mark, guess, or indicate a correct answer anywhere. Transcribe only.
- At most ${LIMITS.MAX_QUESTIONS} questions total.

Figure detection:
- If a question has a figure/diagram/graph/image, set imageBox with: page = the 1-based page number containing the figure (1 for a single image file), and box2d = the bounding box of the figure as [ymin, xmin, ymax, xmax], normalized to 0-1000 integers relative to that page. Detect the box tightly around the figure only (not the question text). Otherwise imageBox = null.`;

const CHOICE_IDS: readonly ChoiceId[] = ["A", "B", "C", "D"];
const SUB_ITEM_IDS: readonly SubItemId[] = ["a", "b", "c", "d"];
const QUESTION_TYPES: readonly QuestionType[] = ["mcq", "essay", "true_false", "short_answer"];

function isChoiceId(v: unknown): v is ChoiceId {
  return typeof v === "string" && (CHOICE_IDS as readonly string[]).includes(v);
}
function isSubItemId(v: unknown): v is SubItemId {
  return typeof v === "string" && (SUB_ITEM_IDS as readonly string[]).includes(v);
}
function isQuestionType(v: unknown): v is QuestionType {
  return typeof v === "string" && (QUESTION_TYPES as readonly string[]).includes(v);
}

/** box2d hợp lệ: 4 số 0..1000, ymin<ymax, xmin<xmax. */
function parseBox(raw: unknown): BoundingBox | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.page !== "number" || !Number.isInteger(b.page) || b.page < 1) return null;
  if (!Array.isArray(b.box2d) || b.box2d.length !== 4) return null;
  const nums = b.box2d.map((v) => (typeof v === "number" ? v : NaN));
  if (nums.some((v) => !Number.isFinite(v) || v < 0 || v > 1000)) return null;
  const [ymin, xmin, ymax, xmax] = nums;
  if (ymin >= ymax || xmin >= xmax) return null;
  return { page: b.page, box2d: [ymin, xmin, ymax, xmax] };
}

/** Validate + map JSON đã parse → parts + questions; null nếu sai contract. */
export function mapQuestionsPayload(payload: unknown): ExtractedQuestionFile | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as { parts?: unknown; questions?: unknown };
  if (!Array.isArray(obj.questions) || !Array.isArray(obj.parts)) return null;

  const parts: ExtractedPart[] = [];
  for (const raw of obj.parts) {
    if (typeof raw !== "object" || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.number !== "number" || !Number.isInteger(p.number) || typeof p.title !== "string")
      return null;
    parts.push({ number: p.number, title: p.title });
  }
  if (parts.length > LIMITS.MAX_PARTS) return null;

  const out: ExtractedQuestion[] = [];
  for (const raw of obj.questions) {
    if (typeof raw !== "object" || raw === null) return null;
    const q = raw as Record<string, unknown>;
    if (
      typeof q.part !== "number" ||
      !Number.isInteger(q.part) ||
      q.part < 1 ||
      typeof q.number !== "number" ||
      !Number.isInteger(q.number) ||
      !isQuestionType(q.type) ||
      typeof q.stem !== "string"
    )
      return null;

    let choices: { id: ChoiceId; text: string }[] | undefined;
    if (q.choices != null) {
      if (!Array.isArray(q.choices)) return null;
      choices = [];
      for (const c of q.choices) {
        const cc = c as Record<string, unknown>;
        if (!isChoiceId(cc?.id) || typeof cc?.text !== "string") return null;
        choices.push({ id: cc.id, text: cc.text });
      }
    }

    let subItems: { id: SubItemId; text: string }[] | undefined;
    if (q.subItems != null) {
      if (!Array.isArray(q.subItems)) return null;
      subItems = [];
      for (const s of q.subItems) {
        const ss = s as Record<string, unknown>;
        if (!isSubItemId(ss?.id) || typeof ss?.text !== "string") return null;
        subItems.push({ id: ss.id, text: ss.text });
      }
    }

    let imageBox: BoundingBox | undefined;
    if (q.imageBox != null) {
      const parsed = parseBox(q.imageBox);
      if (!parsed) return null;
      imageBox = parsed;
    }

    out.push({
      part: q.part,
      number: q.number,
      type: q.type,
      stem: q.stem,
      choices,
      subItems,
      imageBox,
    });
  }
  return { parts, questions: out };
}

/** File đề → parts + ExtractedQuestion[] (một call Gemini multimodal, server-only). */
export async function extractQuestions(
  file: FileRef,
): Promise<Result<ExtractedQuestionFile>> {
  const startedAt = Date.now();
  const deadline = makeDeadlineSignal(FATAL_CALL_DEADLINE_MS);
  try {
    const response = await generateContent({
      model: QUESTION_MODEL,
      contents: [toGeminiPart(file), { text: PROMPT }],
      config: {
        abortSignal: deadline.signal,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
        responseJsonSchema: QUESTIONS_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    // Đo trước mọi nhánh phân loại — lượt gọi hỏng vẫn tiêu token và vẫn trừ
    // vào trần request/ngày (Subscription PRD U2).
    recordUsage("questions", QUESTION_MODEL, response.usageMetadata);

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason !== "STOP") {
      logExtractorExit("extractQuestions:finishReason", {
        finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        ok: false,
        errors: [makeUgcError("EXTRACTION_FAILED", null)],
      };
    }
    const text = response.text;
    if (!text) {
      logExtractorExit("extractQuestions:emptyText", {
        finishReason,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
    }

    const parsed = mapQuestionsPayload(JSON.parse(text));
    if (!parsed) {
      logExtractorExit("extractQuestions:mapNull", {
        textLength: text.length,
        textPrefix: text.slice(0, 200),
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
    }
    if (parsed.questions.length === 0) {
      return { ok: false, errors: [makeUgcError("NO_QUESTIONS_FOUND", null)] };
    }
    if (parsed.questions.length > LIMITS.MAX_QUESTIONS) {
      return { ok: false, errors: [makeUgcError("TOO_MANY_QUESTIONS", null)] };
    }
    return { ok: true, value: parsed };
  } catch (err) {
    // Lỗi API/mạng/key/deadline — log chẩn đoán SERVER-SIDE (không log payload),
    // message user-safe vẫn generic qua errorCopy. AbortError = quá deadline.
    const isAbort = (err as { name?: string })?.name === "AbortError";
    logExtractorExit(isAbort ? "extractQuestions:deadline" : "extractQuestions:catch", {
      ...sdkErrorDetail(err),
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
  } finally {
    deadline.clear();
  }
}
