// Engine 1 — Socratic tutor: lớp GỌI Gemini (backend DD § generateHint()).
//
// SERVER-ONLY (import "@/lib/ugc/gemini" đã gắn "server-only"), cùng lối
// extractQuestions.ts/extractAnswers.ts. File này KHÔNG mở đường HTTP thứ hai:
// client + retry + deadline đều dùng lại hạ tầng sẵn có của lib/ugc/gemini.ts —
// một chỗ duy nhất giữ singleton client và cấu hình retry của SDK.
//
// Ranh giới trách nhiệm: ở đây chỉ có "gọi model và PHÂN LOẠI thất bại"; quyền
// truy cập, tái kiểm tra điều kiện sai-hai-lần, rate limit và lệnh ghi telemetry
// là việc của explainStep() (app/(layer2)/tutorActions.ts).

import {
  getGeminiClient,
  makeDeadlineSignal,
  QUESTION_MODEL,
  sdkErrorDetail,
} from "@/lib/ugc/gemini";
import { recordUsage } from "@/lib/ugc/quotaTracker";

import { TUTOR_CALL_DEADLINE_MS } from "./constants";
import { buildTutorPrompt } from "./prompt";
import type { TutorPromptInput } from "./prompt";
import type { TelemetryErrorCode } from "./telemetry";

/**
 * Log chẩn đoán server-only cho một lối thoát của gia sư.
 *
 * CỐ Ý không dùng lại `logExtractorExit()` của lib/ugc/gemini.ts dù thân hàm gần
 * như trùng: tiền tố `[ugc-extract]` của hàm đó đã cứng, dùng lại sẽ dán nhãn
 * sai cho log gia sư và làm hỏng chính thứ mà log này tồn tại để phục vụ (lọc ra
 * đúng lượt gọi tutor khi chẩn đoán sự cố).
 *
 * CHỈ log metadata an toàn phía máy chủ (finishReason/status/usage/elapsedMs…).
 * Đây là nơi DUY NHẤT chi tiết lỗi thật — kể cả `err.message` — được phép xuất
 * hiện; không một chi tiết nào trong đây đi tiếp vào telemetry_log hay xuống
 * client (xem telemetry.ts). Bọc try/catch để một error shape lạ không bao giờ
 * khiến chính câu log ném ra.
 */
export function logTutorExit(site: string, detail: Record<string, unknown>): void {
  try {
    console.error(`[tutor] ${site}`, JSON.stringify(detail));
  } catch {
    console.error(`[tutor] ${site}`, detail);
  }
}

/** Mã lỗi generateHint() có thể ném — tập con của enum §19, để explainStep()
 *  chuyển thẳng sang cả kết quả trả về lẫn `error_code` của telemetry mà không
 *  cần bảng ánh xạ thứ hai. `rate_limited`/`not_eligible` không nằm ở đây: chúng
 *  được quyết định TRƯỚC khi gọi model, thuộc về explainStep(). */
export type TutorCallErrorCode = Extract<TelemetryErrorCode, "gemini_unavailable" | "server">;

/**
 * Lỗi có KIỂU của một lượt gọi gia sư.
 *
 * `message` cố ý chỉ mang `code` cộng `site` (hằng do chính file này đặt) —
 * KHÔNG BAO GIỜ mang message của SDK hay nội dung câu hỏi: message của một
 * Error rất dễ bị caller ghi thẳng vào log/DB, mà nội dung câu hỏi là UGC.
 */
export class TutorCallError extends Error {
  readonly code: TutorCallErrorCode;

  constructor(code: TutorCallErrorCode, site: string) {
    super(`tutor call failed: ${code} (${site})`);
    this.name = "TutorCallError";
    this.code = code;
  }
}

/** Lỗi hạ tầng tạm thời của Gemini (quá tải/quota/timeout) → `gemini_unavailable`;
 *  còn lại là lỗi phía ta (thiếu key, gọi sai, bug) → `server`. Ranh giới này
 *  theo work plan: "Gemini 503/429/timeout → typed gemini_unavailable/server". */
const RETRYABLE_HTTP_STATUSES = [408, 429, 500, 502, 503, 504];

function classifyCallError(err: unknown): TutorCallErrorCode {
  const detail = sdkErrorDetail(err);
  if (detail.name === "AbortError") return "gemini_unavailable";
  const status = typeof detail.status === "number" ? detail.status : Number(detail.code);
  return RETRYABLE_HTTP_STATUSES.includes(status) ? "gemini_unavailable" : "server";
}

/**
 * Gọi Gemini để lấy gợi ý Socratic cho MỘT câu học sinh đã sai hai lần.
 *
 * @param input ngữ cảnh ĐÃ THU HẸP (prompt.ts) — kiểu này không chứa nổi đáp án.
 * @returns văn bản gợi ý, đã trim, luôn khác rỗng.
 * @throws {TutorCallError} mọi lối thất bại, đã phân loại sẵn thành mã của §19.
 *
 * Hạn chót: `TUTOR_CALL_DEADLINE_MS` (constants.ts) — 30s, KHÁC mốc 150s của
 * UGC vì học sinh đang đứng chờ; truyền qua `makeDeadlineSignal()` nên abort
 * bao trùm cả chuỗi retry của SDK.
 */
export async function generateHint(input: TutorPromptInput): Promise<string> {
  const startedAt = Date.now();
  const deadline = makeDeadlineSignal(TUTOR_CALL_DEADLINE_MS);
  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model: QUESTION_MODEL,
      contents: [{ text: buildTutorPrompt(input) }],
      config: { abortSignal: deadline.signal },
    });

    // Đo NGAY sau khi có response, TRƯỚC mọi nhánh phân loại: một lượt gọi
    // finishReason≠STOP hay text rỗng vẫn đã tiêu token thật và vẫn đã trừ vào
    // trần request/ngày. Ghi ở đây thì cả ba lối (thành công, finishReason,
    // emptyText) được đếm bằng đúng một dòng, không lối nào tự nhiên biến mất
    // khỏi phép tính đơn giá (Subscription PRD U2). Không đặt ở lối `catch`:
    // ở đó không có `response` nên không có token nào để đọc.
    recordUsage("tutor", QUESTION_MODEL, response.usageMetadata);

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason !== "STOP") {
      // Gồm cả ca bị chặn vì safety: model KHÔNG trả lời được → với học sinh
      // thì không phân biệt được với "model đang hỏng", nên cùng một mã.
      logTutorExit("generateHint:finishReason", {
        finishReason,
        safetyRatings: response.candidates?.[0]?.safetyRatings,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      throw new TutorCallError("gemini_unavailable", "finishReason");
    }

    const hint = response.text?.trim();
    if (!hint) {
      logTutorExit("generateHint:emptyText", {
        finishReason,
        blockReason: response.promptFeedback?.blockReason,
        usage: response.usageMetadata,
        elapsedMs: Date.now() - startedAt,
      });
      throw new TutorCallError("gemini_unavailable", "emptyText");
    }
    return hint;
  } catch (err) {
    if (err instanceof TutorCallError) throw err;

    const code = classifyCallError(err);
    const isAbort = (err as { name?: string })?.name === "AbortError";
    logTutorExit(isAbort ? "generateHint:deadline" : "generateHint:catch", {
      ...sdkErrorDetail(err),
      // KHÔNG đặt tên `code`: sdkErrorDetail() đã có `code` riêng của SDK, ghi
      // đè lên là mất đúng manh mối cần để chẩn đoán.
      classifiedAs: code,
      elapsedMs: Date.now() - startedAt,
    });
    throw new TutorCallError(code, isAbort ? "deadline" : "catch");
  } finally {
    deadline.clear();
  }
}
