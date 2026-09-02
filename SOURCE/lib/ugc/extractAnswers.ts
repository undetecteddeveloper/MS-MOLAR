// UGC Exam Upload v2.1 — AI extractor #2: file đáp án → answer map (part-qualified).
//
// SERVER-ONLY. MỘT call Gemini (model rẻ) với structured output
// (responseJsonSchema) = ExtractedAnswer[]. Model ĐỌC file đáp án, KHÔNG giải
// đề (ADR-0004). v2.1 (ADR-0005): đọc bảng đáp án theo TỪNG PHẦN của đề chuẩn
// quốc gia — hàng chữ cái (PHẦN I), LƯỚI Đúng/Sai từng ý (PHẦN II), hàng giá
// trị (PHẦN III). Lỗi AI/schema → EXTRACTION_FAILED. Không log raw AI payload.

import { makeUgcError } from "./errorCopy";
import {
  ANSWER_MODEL,
  FATAL_CALL_DEADLINE_MS,
  generateContent,
  logExtractorExit,
  makeDeadlineSignal,
  sdkErrorDetail,
} from "./gemini";
import { recordUsage } from "./quotaTracker";
import type { ChoiceId, ExtractedAnswer, Result, SubItemId } from "./types";
import type { FileRef } from "./fileRef";
import { toGeminiPart } from "./fileRef";

const ANSWERS_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            properties: {
              part: { type: "integer" },
              number: { type: "integer" },
              type: { type: "string", const: "mcq" },
              letter: { type: "string", enum: ["A", "B", "C", "D"] },
            },
            required: ["part", "number", "type", "letter"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              part: { type: "integer" },
              number: { type: "integer" },
              type: { type: "string", const: "true_false" },
              values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: ["a", "b", "c", "d"] },
                    value: { type: "boolean" },
                  },
                  required: ["id", "value"],
                  additionalProperties: false,
                },
              },
            },
            required: ["part", "number", "type", "values"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              part: { type: "integer" },
              number: { type: "integer" },
              type: { type: "string", const: "short_answer" },
              value: { type: "string" },
            },
            required: ["part", "number", "type", "value"],
            additionalProperties: false,
          },
          {
            type: "object",
            properties: {
              part: { type: "integer" },
              number: { type: "integer" },
              type: { type: "string", const: "essay" },
              text: { type: "string" },
            },
            required: ["part", "number", "type", "text"],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ["answers"],
  additionalProperties: false,
} as const;

const PROMPT = `Read the attached answer-key file for a Vietnamese secondary-school exam and transcribe the answers.

Structure rules:
- National-format answer keys (from 2025) list answers per PART ("PHẦN I", "PHẦN II", "PHẦN III") and question numbers RESTART from 1 in each part. Set "part" accordingly. If the key has no part structure, use part = 1 for every entry.
- One entry per (part, question number) found in the file.

Answer forms:
- PHẦN I style — a letter per question: type "mcq" with the letter A/B/C/D exactly as the key states.
- PHẦN II style — a true/false verdict per sub-item: type "true_false" with values = the list of {id, value}, exactly as printed for each sub-item. This is usually a grid of sub-items a) b) c) d), but a question judging a SINGLE statement has one entry with id "a" — use "true_false" for it too, never "short_answer" and never "mcq".
- The verdict token is written in whatever script the paper uses, and ALL of these forms mean the same two values:
    value = true  <- "Đ", "Đúng", "D", "T", "True", "Y", "Yes", "✓"
    value = false <- "S", "Sai", "F", "False", "N", "No", "✗"
  English-language papers (môn Tiếng Anh) normally write T and F, so a key line reading "Câu 21: T" or "3. F" is a "true_false" answer with one sub-item "a" — NOT a short_answer whose value happens to be the letter T. Never skip a question because its verdict is written with an English letter.
- PHẦN III style — a short value/number per question (e.g. "1260", "1,04", "96,5"): type "short_answer" with the value transcribed verbatim as a string.
- Free-form/model answers: type "essay" with the answer text verbatim.

Rules:
- Only READ the file. Do NOT solve any question, do NOT invent answers for numbers not present in the file.`;

function isChoiceId(v: unknown): v is ChoiceId {
  return v === "A" || v === "B" || v === "C" || v === "D";
}
function isSubItemId(v: unknown): v is SubItemId {
  return v === "a" || v === "b" || v === "c" || v === "d";
}

/** Validate + map JSON đã parse → ExtractedAnswer[]; null nếu sai contract. */
export function mapAnswersPayload(payload: unknown): ExtractedAnswer[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const arr = (payload as { answers?: unknown }).answers;
  if (!Array.isArray(arr)) return null;

  const out: ExtractedAnswer[] = [];
  for (const raw of arr) {
    if (typeof raw !== "object" || raw === null) return null;
    const a = raw as Record<string, unknown>;
    if (
      typeof a.part !== "number" ||
      !Number.isInteger(a.part) ||
      a.part < 1 ||
      typeof a.number !== "number" ||
      !Number.isInteger(a.number)
    )
      return null;
    const base = { part: a.part, number: a.number };
    if (a.type === "mcq" && isChoiceId(a.letter)) {
      out.push({ ...base, type: "mcq", letter: a.letter });
    } else if (a.type === "true_false" && Array.isArray(a.values)) {
      const values: { id: SubItemId; value: boolean }[] = [];
      for (const v of a.values) {
        const vv = v as Record<string, unknown>;
        if (!isSubItemId(vv?.id) || typeof vv?.value !== "boolean") return null;
        values.push({ id: vv.id, value: vv.value });
      }
      if (values.length === 0) return null;
      out.push({ ...base, type: "true_false", values });
    } else if (a.type === "short_answer" && typeof a.value === "string") {
      out.push({ ...base, type: "short_answer", value: a.value });
    } else if (a.type === "essay" && typeof a.text === "string") {
      out.push({ ...base, type: "essay", text: a.text });
    } else {
      return null;
    }
  }
  return out;
}

/** File đáp án → ExtractedAnswer[] (một call Gemini, server-only). */
export async function extractAnswers(
  file: FileRef,
): Promise<Result<ExtractedAnswer[]>> {
  const startedAt = Date.now();
  const deadline = makeDeadlineSignal(FATAL_CALL_DEADLINE_MS);
  try {
    const response = await generateContent({
      model: ANSWER_MODEL,
      contents: [toGeminiPart(file), { text: PROMPT }],
      config: {
        abortSignal: deadline.signal,
        maxOutputTokens: 16000,
        responseMimeType: "application/json",
        responseJsonSchema: ANSWERS_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    // Đo trước mọi nhánh phân loại — lượt gọi hỏng vẫn tiêu token và vẫn trừ
    // vào trần request/ngày (Subscription PRD U2).
    recordUsage("answers", ANSWER_MODEL, response.usageMetadata);

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason !== "STOP") {
      logExtractorExit("extractAnswers:finishReason", {
        finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
    }
    const text = response.text;
    if (!text) {
      logExtractorExit("extractAnswers:emptyText", {
        finishReason,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
    }

    const answers = mapAnswersPayload(JSON.parse(text));
    if (!answers) {
      logExtractorExit("extractAnswers:mapNull", {
        textLength: text.length,
        textPrefix: text.slice(0, 200),
        elapsedMs: Date.now() - startedAt,
      });
      return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
    }
    return { ok: true, value: answers };
  } catch (err) {
    const isAbort = (err as { name?: string })?.name === "AbortError";
    logExtractorExit(isAbort ? "extractAnswers:deadline" : "extractAnswers:catch", {
      ...sdkErrorDetail(err),
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: false, errors: [makeUgcError("EXTRACTION_FAILED", null)] };
  } finally {
    deadline.clear();
  }
}
