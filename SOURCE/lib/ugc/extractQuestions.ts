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
// Vá hình dạng câu Đúng/Sai. Ở `tfShape.ts` chứ không ở file này vì đường ĐỌC
// (fromRows, player) cũng phải vá row cũ, mà file này là server-only.
import { repairTrueFalseStem } from "./tfShape";
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
  ExtractedPassage,
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
  passages: ExtractedPassage[];
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
    passages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { anyOf: [{ type: "string" }, { type: "null" }] },
          text: { type: "string" },
        },
        required: ["id", "title", "text"],
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
          passageId: { anyOf: [{ type: "string" }, { type: "null" }] },
          points: { anyOf: [{ type: "number" }, { type: "null" }] },
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
  required: ["parts", "passages", "questions"],
  additionalProperties: false,
} as const;

const PROMPT = `Read the attached exam question file (Vietnamese secondary-school exam) and transcribe every question.

Structure rules:
- Vietnamese national-format exams (from 2025) have PARTS with headers like "PHẦN I.", "PHẦN II.", "PHẦN III." — question numbers RESTART from 1 in each part. If the file has part headers, return each part's number and its printed title in "parts", and set each question's "part" to the part it belongs to, with "number" as printed WITHIN that part. If the file has no part headers, return "parts": [] and part = 1 for every question.
- Classify each question:
  - "mcq": multiple choice. Usually 4 options A–D (typical of PHẦN I), but transcribe however many are actually printed — ${LIMITS.MIN_CHOICES} to ${LIMITS.MAX_CHOICES}. An English-paper item offering only "True / False / Not Given" is an "mcq" with 3 options. Label the options A, B, C, D in printed order with no gaps.
  - "true_false": a block whose sub-items are each answered Đúng/Sai independently (typical of PHẦN II, which prints ${LIMITS.MAX_SUB_ITEMS} sub-items a)–d)). Transcribe the sub-items into "subItems" (choices = null). IMPORTANT: the statements to be judged ALWAYS go in "subItems", never in the stem — the stem holds only the shared lead-in, and may be an empty string if there is none. An English-paper item that asks to judge ONE statement as True or False is still "true_false", with exactly ONE sub-item "a"; do NOT put that statement in the stem and leave subItems empty.
    A "true_false" question with an EMPTY subItems array is always wrong and makes the whole exam unusable — the student is shown nothing to answer. Worked example, for an item printed as "Listen to part of a news report... Decide whether the following statement is True or False. / The UN report says that harmful effects of greenhouse gases can be eliminated.":
      CORRECT -> stem: "Listen to part of a news report... Decide whether the following statement is True or False.", subItems: [{"id": "a", "text": "The UN report says that harmful effects of greenhouse gases can be eliminated."}]
      WRONG   -> stem: the instruction AND the statement together, subItems: []
  - "short_answer": answered by writing a short value/number (typical of PHẦN III). choices = null, subItems = null.
  - "essay": free-form written answer. choices = null, subItems = null.

Marks per question:
- Vietnamese exams often print what a question is worth, e.g. "(2,0 điểm)", "Câu 1 (0,5 điểm)", or a part header like "PHẦN II (3,0 điểm)" covering several questions.
- Set "points" to that number when it is PRINTED for that question. Use a dot as the decimal separator: "2,0 điểm" -> 2.0.
- If a mark is printed for a whole PART and not per question, divide it evenly across that part's questions ONLY when the part header states no other split; otherwise leave null.
- If no mark is printed anywhere for a question, set points = null. NEVER guess or invent a mark — a wrong mark changes a student's score.

Shared reading texts (IMPORTANT — this is where most transcription waste comes from):
- Exams in English and Literature often print ONE reading passage / extract that a RUN OF QUESTIONS all refer to ("Read the following passage and mark the letter... Questions 34 to 40").
- Transcribe that text ONCE into "passages" with a short id you choose ("p1", "p2", ...), and set "passageId" on every question that uses it. Put the printed lead-in line in "title" (or null).
- NEVER copy the passage into the stem of each question. The stem holds ONLY that question's own text. Repeating a passage across questions is the single most expensive mistake you can make here.
- A question that stands on its own has passageId = null. If the exam has no shared reading text at all, return "passages": [].
- GAP-FILL passages (English papers: "indicate the correct word that best fits each of the numbered blanks from 34 to 40") print the blanks INSIDE the passage. Transcribe every blank as the question number in round brackets followed by a space and four underscores, exactly: "(34) ____". Keep the blanks in the passage text and in reading order; the stem of such a question stays empty or holds only its own lead-in. The app fills these blanks in with the student's chosen option while they work, so a blank written any other way silently stops working.
- At most ${LIMITS.MAX_PASSAGES} passages.

Transcription rules:
- Transcribe the stem verbatim, including math as LaTeX ($...$) where the source shows formulas. Do NOT include the "Câu N" prefix, the choices, or the sub-items in the stem.
- Only $...$ / $$...$$ math is rendered. For a data table in the stem, write a GitHub-flavoured markdown table (a "| cell | cell |" row per line, a "| --- | --- |" separator after the header). NEVER emit a LaTeX environment such as \\begin{tabular} outside math — it renders as raw source text.
- For mcq, transcribe exactly the options printed, in printed order, labelled from A with no gaps.
- For true_false, transcribe each judged statement into subItems, labelling them from "a" in printed order.
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
  const obj = payload as { parts?: unknown; passages?: unknown; questions?: unknown };
  if (!Array.isArray(obj.questions) || !Array.isArray(obj.parts)) return null;
  // `passages` là bổ sung A1: chấp nhận VẮNG (undefined) → coi như đề không có
  // ngữ liệu. Bắt buộc nó sẽ làm mọi fixture/response cũ hỏng ngay, mà "không
  // có bài đọc chung" là trạng thái đúng của 8/10 môn.
  const rawPassages = obj.passages === undefined ? [] : obj.passages;
  if (!Array.isArray(rawPassages)) return null;

  const parts: ExtractedPart[] = [];
  for (const raw of obj.parts) {
    if (typeof raw !== "object" || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.number !== "number" || !Number.isInteger(p.number) || typeof p.title !== "string")
      return null;
    parts.push({ number: p.number, title: p.title });
  }
  if (parts.length > LIMITS.MAX_PARTS) return null;

  const passages: ExtractedPassage[] = [];
  const seenPassageIds = new Set<string>();
  for (const raw of rawPassages) {
    if (typeof raw !== "object" || raw === null) return null;
    const pg = raw as Record<string, unknown>;
    if (typeof pg.id !== "string" || pg.id === "" || typeof pg.text !== "string") return null;
    // Khoá trùng = mọi câu trỏ vào khoá đó nhận một đoạn văn tuỳ tiện. Từ chối
    // nguyên payload thay vì chọn bừa một bản.
    if (seenPassageIds.has(pg.id)) return null;
    seenPassageIds.add(pg.id);
    passages.push({
      id: pg.id,
      ...(typeof pg.title === "string" && pg.title !== "" && { title: pg.title }),
      text: pg.text,
    });
  }
  if (passages.length > LIMITS.MAX_PASSAGES) return null;

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

    // Khoá trỏ vào ngữ liệu KHÔNG được validate tham chiếu ở đây — đó là việc
    // của validateAssembledExam (PASSAGE_MISSING), nơi tác giả sửa được. Ở
    // tầng này chỉ ép KIỂU; từ chối nguyên payload vì một khoá mồ côi sẽ vứt
    // cả đề vì một lỗi vặt.
    const passageId = typeof q.passageId === "string" && q.passageId !== "" ? q.passageId : undefined;

    // B1 — chỉ nhận số DƯƠNG HỮU HẠN. Model được dặn trả null khi đề không in
    // điểm, nhưng 0/âm/NaN vẫn lọt được qua JSON schema `type: number`, và một
    // câu 0 điểm sẽ biến mất khỏi mẫu số trong im lặng.
    const points =
      typeof q.points === "number" && Number.isFinite(q.points) && q.points > 0
        ? q.points
        : undefined;

    let imageBox: BoundingBox | undefined;
    if (q.imageBox != null) {
      const parsed = parseBox(q.imageBox);
      if (!parsed) return null;
      imageBox = parsed;
    }

    const repaired = repairTrueFalseStem(q.type, q.stem, subItems);

    out.push({
      part: q.part,
      number: q.number,
      type: q.type,
      stem: repaired.stem,
      choices,
      subItems: repaired.subItems,
      passageId,
      points,
      imageBox,
    });
  }
  return { parts, passages, questions: out };
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
