// UGC Exam Upload v2.0 — Gemini client (SERVER-ONLY, ADR-0004 addendum: swap
// Anthropic → Gemini free tier, engineer decision 2026-07-17).
//
// Module này (và mọi module import nó) KHÔNG BAO GIỜ được import từ client
// component: "server-only" làm build fail ngay nếu vi phạm; check bổ sung ở
// scripts/check-ai-key-bundle.mjs khẳng định key không nằm trong client bundle
// (PRD metric 6).

import "server-only";
import { GoogleGenAI } from "@google/genai";

// Tên model sống ở lib/ai/models.ts, KHÔNG ở đây: file này `import "server-only"`
// nên script tsx (supabase/tagQuestionSkills.ts) không import được, và trước đây
// script phải viết cứng lại tên model — đổi model ở một chỗ thì chỗ kia trôi mà
// không ai biết. Re-export để mọi caller sẵn có không phải đổi đường import.
export { ANSWER_MODEL, QUESTION_MODEL } from "@/lib/ai/models";

let client: GoogleGenAI | null = null;

// Số lần GỌI tối đa (kể cả lần đầu) cho mỗi call — SDK tự retry 408/429/500/
// 502/503/504 với exponential backoff (p-retry) KHI có httpOptions.retryOptions.
// Sự cố 2026-07: gemini-3.5-flash trả 503 "high demand… try again later" (quá
// tải tạm thời, retryable). SDK có sẵn cơ chế này nhưng TẮT mặc định; client
// { apiKey } trơn = không retry ⇒ một cú 503 thoáng qua làm rollback cả pipeline.
// Bật lên = 3 lần gọi (2 lần thử lại) để vượt qua spike ngắn.
const RETRY_ATTEMPTS = 3;

/** Singleton — key đọc từ server env, không bao giờ gửi xuống client. */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      // Fail loudly (log server) — caller map thành EXTRACTION_FAILED cho user.
      throw new Error("GEMINI_API_KEY chưa được cấu hình trong server env");
    }
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { retryOptions: { attempts: RETRY_ATTEMPTS } },
    });
  }
  return client;
}

// --- Điểm phát DUY NHẤT + bảng giá mỗi thao tác (backend DD I10) ------------

/**
 * Số request Gemini mà MỘT thao tác người dùng phát ra.
 *
 * Khai ở ĐÂY vì đây là chỗ duy nhất con số là một SỰ THẬT chứ không phải một
 * bản sao: mọi request đi ra đều qua `generateContent()` ngay bên dưới, nên
 * "pipeline phát mấy lời gọi" trả lời được bằng cách đọc file này. Mọi nơi khác
 * cần con số — `consumeQuota()` ở cổng (lib/billing/quota.ts) và trần ngày của
 * `rateLimit.test.ts` — IMPORT hằng này. Hai lời khai rời nhau là đúng hình
 * dạng hỏng mà thiết kế v1.4 sinh ra để sửa: bộ đếm ngân sách tính 1 trong khi
 * pipeline tiêu 3, và không có gì đỏ ở đâu cả.
 *
 * Đơn vị là REQUEST NHÀ CUNG CẤP, không phải lượt người dùng — gói được bán
 * bằng lượt (`PLAN_LIMITS`), ngân sách dự án đếm bằng request.
 *
 *   · `tutor` = 1 — `generateHint()`.
 *   · `uploadTyped` = 2 — `extractQuestions` + `extractAnswers`.
 *   · `uploadAutomatic` = 3 — thêm `extractMeta` (ADR-0007), lối tốn nhất và
 *     là con số phải dùng cho mọi phép tính TRẦN (worst case).
 *
 * Ba khoá này là danh sách ĐẦY ĐỦ. Thêm một lời gọi AI thứ tư vào pipeline thì
 * sửa ở đây, và mọi chỗ tiêu thụ sẽ nói ngay cái gì phải đổi theo.
 */
export const GEMINI_CALLS_PER_OPERATION = {
  tutor: 1,
  uploadTyped: 2,
  uploadAutomatic: 3,
} as const;

/** Hình dạng request của SDK, LẤY TỪ CHÍNH SDK. Khai lại bằng tay ở đây sẽ đẻ
 *  ra một hợp đồng thứ hai trôi lệch khỏi `@google/genai` sau mỗi lần nâng cấp,
 *  đúng cái mà module này tồn tại để chặn. */
type GenerateContentRequest = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/**
 * **Điểm phát Gemini DUY NHẤT của cả repo** (AC-021 — "0 đường vòng").
 *
 * Ống dẫn TRONG SUỐT, và sự trong suốt đó là toàn bộ hợp đồng: không bắt lỗi,
 * KHÔNG RETRY, không phân loại, không nắn request cũng không đọc response.
 * Vào sao ra vậy, lỗi ném lên nguyên instance.
 *
 * Vì sao cố ý rỗng:
 *   · **Retry** đã là việc của SDK (`RETRY_ATTEMPTS` ở trên). Thêm một tầng
 *     thử lại ở đây nhân chi phí thật lên mà bộ đếm ngân sách — vốn ĐẶT CHỖ
 *     theo số lời gọi LOGIC — không nhìn thấy một lượt nào.
 *   · **Phân loại lỗi** thuộc về bốn caller, và bốn caller phân loại KHÁC NHAU:
 *     `EXTRACTION_FAILED` (fatal), `META_EXTRACTION_FAILED` (non-fatal, AC-040)
 *     và `TutorCallError` của gia sư. Gom về đây là gộp ba hợp đồng lỗi thành
 *     một, tức lấy mất quyền sở hữu hình dạng lỗi của chính chỗ đang cầm ngữ
 *     cảnh — cùng lằn ranh mà `consumeQuota()` giữ với telemetry.
 *
 * Cái nó ĐỔI so với gọi thẳng `getGeminiClient().models.generateContent()`:
 * câu hỏi "repo này phát được bao nhiêu request Gemini, và từ đâu" có đúng một
 * chỗ để đọc, và AC-020 có một mối nối để đếm mà không cần mạng.
 */
export function generateContent(
  request: GenerateContentRequest,
): ReturnType<GoogleGenAI["models"]["generateContent"]> {
  return getGeminiClient().models.generateContent(request);
}

// --- Chẩn đoán extractor (recipe-diagnose 2026-07) --------------------------
// Sự cố: extractQuestions FAIL với mã generic EXTRACTION_FAILED và KHÔNG có
// thông tin nào để chẩn đoán, vì cả 4 lối thoát của extractor (finishReason,
// text rỗng, payload sai contract, catch) đều nuốt lỗi thật (MAX_TOKENS vs
// 429/quota vs 404 model vs timeout). Các helper dưới khôi phục khả năng chẩn
// đoán SERVER-SIDE mà KHÔNG đổi message user-facing và KHÔNG log raw payload.

/**
 * Log chẩn đoán server-only cho một lối thoát của extractor.
 * CHỈ log metadata an toàn (finishReason/status/usage…) — KHÔNG BAO GIỜ log
 * full AI payload (nội dung đề là dữ liệu người dùng). Bọc try/catch để một
 * error shape lạ không bao giờ khiến chính câu log ném ra.
 */
export function logExtractorExit(site: string, detail: Record<string, unknown>): void {
  try {
    console.error(`[ugc-extract] ${site}`, JSON.stringify(detail));
  } catch {
    console.error(`[ugc-extract] ${site}`, detail);
  }
}

/** Trích field an toàn từ error SDK (shape đổi giữa các version @google/genai). */
export function sdkErrorDetail(err: unknown): Record<string, unknown> {
  const e = err as Record<string, unknown> | null | undefined;
  return {
    name: e?.name,
    status: e?.status,
    code: e?.code,
    message: e?.message,
    cause: e?.cause,
  };
}

/**
 * Deadline (ms) TỔNG cho mỗi call FATAL (extractQuestions/extractAnswers) —
 * bao trùm cả chuỗi retry của SDK (abortSignal truyền vào fetch dùng chung mọi
 * lần thử), nhưng vẫn CHẶN một call treo vô hạn (fetch của SDK không có
 * timeout mặc định; httpOptions.timeout thì lỗi — js-genai #1277 — nên phải
 * dùng AbortController). extractMeta NON-FATAL (AC-040) cố tình KHÔNG dùng
 * deadline; retry-exhaustion tự bó nó lại.
 *
 * SỰ CỐ 2026-08 (recipe-diagnose): mốc 30s cũ ước tính từ tốc độ RETRY
 * ("~24s cho 3 lần gọi + backoff, 7.5s/attempt") — sai giả định, vì với đề
 * NHIỀU CÂU/NHIỀU TRANG một lần gọi ĐƠN đã vượt 30s, nên extractQuestions
 * fail 100% (AbortError) ngay từ 1 lần gọi, chưa kịp tới retry. Đo thực tế
 * trên file thật (4 trang, 22 câu/3 phần, đề chuẩn quốc gia 2025):
 * extractQuestions mất 42.21s để hoàn tất — tức bản thân 1 lần gọi THÀNH CÔNG
 * bình thường đã gần gấp rưỡi mốc cũ. LIMITS.MAX_PDF_PAGES=30/MAX_QUESTIONS=50
 * (limits.ts) còn lớn hơn nhiều so với file đo được (30/4 ≈ 7.5x trang,
 * 50/22 ≈ 2.3x câu) — 150s cho biên an toàn ~3.5x so với số đo thật, đủ dư
 * cho input gần mức tối đa mà không treo vô hạn khi có sự cố thật.
 */
export const FATAL_CALL_DEADLINE_MS = 150_000;

/**
 * Tạo AbortSignal tự abort sau `ms`. Trả kèm `clear()` để hủy timer trong
 * finally (tránh giữ event loop khi call thành công sớm). Call bị abort → SDK
 * ném error với name === "AbortError".
 */
export function makeDeadlineSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
