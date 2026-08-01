// UGC Exam Upload v2.0 — Gemini client (SERVER-ONLY, ADR-0004 addendum: swap
// Anthropic → Gemini free tier, engineer decision 2026-07-17).
//
// Module này (và mọi module import nó) KHÔNG BAO GIỜ được import từ client
// component: "server-only" làm build fail ngay nếu vi phạm; check bổ sung ở
// scripts/check-ai-key-bundle.mjs khẳng định key không nằm trong client bundle
// (PRD metric 6).

import "server-only";
import { GoogleGenAI } from "@google/genai";

// LƯU Ý (2026-07-17): "gemini-2.5-flash"/"gemini-2.5-flash-lite" (chọn ban đầu
// theo rate-limit công bố) hoá ra KHÔNG gọi được với key thật — 2.5-flash trả
// 404 "no longer available to new users", dòng 2.0-flash trả 429 quota (tài
// khoản mới không có quota free cho 2 dòng model cũ này). Xác nhận bằng
// client.models.list() + gọi thử trực tiếp: chỉ dòng 3.x hoạt động.
/** Model đọc file đề (multimodal, ảnh + PDF). */
export const QUESTION_MODEL = "gemini-3.5-flash";
/** Model đọc file đáp án (rẻ hơn). */
export const ANSWER_MODEL = "gemini-3.1-flash-lite";

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
