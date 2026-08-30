// Chấm tự luận (ADR-0018) — ĐIỂM PHÁT GROQ DUY NHẤT của cả repo.
//
// Module này (và mọi module import nó) KHÔNG BAO GIỜ được import từ client
// component: `server-only` làm build fail ngay nếu vi phạm, và
// scripts/check-ai-key-bundle.mjs khẳng định thêm rằng `GROQ_API_KEY` lẫn host
// `api.groq.com` không nằm trong client bundle (AC-029).
//
// KHÔNG SDK (ADR-0018 Decision 5). Một `fetch` POST, một hằng endpoint, vòng
// retry của chính ta. Kill criterion của quyết định đó nêu tên "streaming, tool
// calling, hoặc chế độ JSON-schema/structured-output của nhà cung cấp" — không
// cái nào ở đây; `response_format: json_object` chỉ là một trường trong body
// POST, không cần SDK nào.
//
// PHẠM VI, cố ý hẹp: module này KHÔNG biết gì về vòng đời, band, ngân sách hay
// telemetry. Nó trả một chuỗi hoặc một lý do hỏng. Ai quyết định câu hỏi trở
// thành gì là việc của gradeEssays.ts.
//
// VÌ SAO VÒNG RETRY NẰM Ở ĐÂY, trong khi `generateContent()` của Gemini cố ý
// RỖNG: lý do đã viết sẵn ở gemini.ts:85-88 — thêm một tầng thử lại là sai KHI
// SDK đã retry bên dưới, vì nó nhân chi phí thật lên mà bộ đếm ngân sách không
// thấy lượt nào. Ở đây KHÔNG có SDK, nên tầng retry duy nhất tồn tại là tầng
// này, và nó nằm DƯỚI một lượt đặt chỗ ngân sách đã tính đủ
// GROQ_CALLS_PER_ESSAY. Bộ đếm nhìn thấy toàn bộ chi phí xấu nhất TRƯỚC request
// đầu tiên — đúng điều kiện mà cảnh báo của gemini.ts đặt ra.
//
// KHÔNG CÓ `console` NÀO TRONG FILE NÀY, và đó là một quy tắc chứ không phải
// tình cờ (AC-056): bài làm của học sinh, prompt, response thô và `err.message`
// của nhà cung cấp đều là văn bản tự do, và không đường log nào được chạm vào
// chúng. Cấm hẳn console dễ kiểm hơn nhiều so với đi soi từng đối số — có một
// ca trong groqChokepoint.test.ts ghim đúng điều đó.

import "server-only";

/** Endpoint OpenAI-compatible của Groq. Đây là ĐỊNH DANH mà phép quét điểm phát
 *  khoá vào — CỐ Ý khác với chuỗi host `api.groq.com` mà bundle guard khoá vào,
 *  vì chuỗi host cũng xuất hiện trong chính scripts/check-ai-key-bundle.mjs
 *  (ADR-0018 Implementation Guidance #5b). Hai guard, hai chuỗi, không guard
 *  nào bắt được file của guard kia. */
export const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Số lần thử LẠI tối đa trong cùng một pass, CHỈ cho 429 (AC-065). */
export const GROQ_MAX_IN_PASS_RETRIES = 2;

/** Số request nhà cung cấp mà MỘT câu tự luận tiêu tốn trong worst case.
 *
 *  Khai bằng BIỂU THỨC chứ không bằng literal `3`, để đổi số lần thử lại tự kéo
 *  theo số đặt chỗ ngân sách. Đây là bài học `GEMINI_CALLS_PER_OPERATION`
 *  (gemini.ts:43-71) áp lại: bộ đếm tính 1 trong khi pipeline tiêu 3 là chế độ
 *  hỏng mà hằng đó sinh ra để sửa. */
export const GROQ_CALLS_PER_ESSAY = 1 + GROQ_MAX_IN_PASS_RETRIES;

/** Nền của backoff mũ có jitter: ~1 s rồi ~2 s. Đủ để vượt một burst ngắn ở
 *  giới hạn 30 RPM. */
export const GROQ_RETRY_BASE_MS = 1_000;

/** Trần cho MỌI lần chờ, kể cả khi header `retry-after` đòi lâu hơn.
 *
 *  Free tier Groq trả `retry-after` có thể lên tới nhiều phút khi chạm giới hạn
 *  ngày/token. Ngủ qua nó vừa đốt invocation vừa vẫn hỏng — nên `retry-after`
 *  vượt trần được coi là HẾT LƯỢT NGAY: câu thành `failed`, và học sinh có nút
 *  chấm lại. */
export const GROQ_RETRY_MAX_WAIT_MS = 8_000;

/** Deadline của MỖI lần thử — mỗi request một `AbortController` riêng, không
 *  dùng chung cả chuỗi retry.
 *
 *  Khác `FATAL_CALL_DEADLINE_MS` của Gemini có chủ đích: ở đó SDK tự retry BÊN
 *  TRONG một signal duy nhất, nên một signal cho cả chuỗi là đúng. Ở đây vòng
 *  retry là của ta, và một signal dùng chung sẽ khiến lần thử thứ ba gần như
 *  chắc chắn chết vì deadline của lần thử thứ nhất.
 *
 *  20 s là ~4–10× độ trễ kỳ vọng của phần cứng LPU. CHƯA ĐO — OQ-1 sở hữu con
 *  số này tới Task E5. */
export const GROQ_CALL_DEADLINE_MS = 20_000;

/** Bốn lý do hỏng, ĐÓNG. Chúng phải phân biệt được nhau vì quyết định vòng đời
 *  ở gradeEssays.ts đọc chính chúng: một giới hạn tần suất và một nhà cung cấp
 *  hỏng mà settle giống hệt nhau là vứt đi khả năng phân biệt hai sự cố hoàn
 *  toàn khác nhau (AC-024/AC-065). */
export type GroqFailure = "rate_limited" | "provider" | "timeout" | "transport";

export type GroqResult =
  | { ok: true; text: string }
  | { ok: false; kind: GroqFailure; retryAfterMs?: number };

export interface GroqGradeRequest {
  /** Prompt đã dựng xong bởi lib/essay/prompt.ts. Module này KHÔNG dựng prompt. */
  prompt: string;
  /** Tên model, đến từ `ESSAY_GRADER_MODEL` ở lib/ai/models.ts — KHÔNG khai lại
   *  ở đây. File này có `server-only` nên script tsx không đọc được, và một bản
   *  sao tên model ở đây sẽ tái diễn đúng sự cố ghi ở models.ts:9-13. */
  model: string;
}

/**
 * Thời gian chờ trước lần thử lại kế tiếp.
 *
 * Tách thành hàm THUẦN và export để kiểm được BIÊN (jitter kịch, mũ lớn,
 * `retry-after` khổng lồ) mà không phải dựng ba response 429 chỉ để quan sát
 * một con số. `jitter` nhận vào như tham số nên test tất định.
 *
 * Jitter chỉ CỘNG THÊM, không bao giờ kéo xuống dưới nền: nó tồn tại để hai
 * lượt chấm song song không cùng thức dậy một lúc, và một jitter trừ đi sẽ làm
 * backoff mất tác dụng ở đúng lần thử căng nhất.
 */
export function computeRetryWaitMs(
  attempt: number,
  retryAfterMs: number | undefined,
  jitter: number = Math.random()
): number {
  const backoff = GROQ_RETRY_BASE_MS * 2 ** attempt;
  const jittered = backoff + backoff * 0.25 * jitter;
  // Nhà cung cấp biết rõ hơn ta khi nào nên quay lại; backoff chỉ là phỏng đoán
  // khi không ai nói gì. Nhưng trần cắt CẢ HAI.
  const wanted = Math.max(jittered, retryAfterMs ?? 0);
  return Math.min(wanted, GROQ_RETRY_MAX_WAIT_MS);
}

/** `retry-after` tính bằng giây. Dạng HTTP-date cũng hợp lệ theo RFC nhưng Groq
 *  trả số giây; một giá trị không phải số được coi như KHÔNG có, và backoff mũ
 *  tiếp quản — an toàn hơn là đoán. */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header.trim());
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

/** Lấy `choices[0].message.content` mà không tin gì cả. Trả `null` nếu hình
 *  dạng không đúng — caller biến nó thành `provider`. */
function firstMessageContent(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Kết quả của MỘT lần thử, trước khi vòng lặp quyết định thử lại hay dừng. */
type Attempt =
  | { ok: true; text: string }
  | { ok: false; kind: GroqFailure; retryAfterMs?: number };

async function attemptOnce(apiKey: string, input: GroqGradeRequest): Promise<Attempt> {
  // Mỗi lần thử một controller RIÊNG — xem ghi chú ở GROQ_CALL_DEADLINE_MS.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GROQ_CALL_DEADLINE_MS);

  try {
    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content: input.prompt }],
        // Cùng văn bản, cùng band. Một grader không tất định làm phép so sánh
        // đối chứng của AC-042 mất nghĩa.
        temperature: 0,
        // GIẢM NHIỄU, KHÔNG PHẢI HỢP ĐỒNG: parseGrade() vẫn validate đầy đủ, và
        // một response không phải JSON vẫn bị từ chối như mọi output không hợp
        // lệ khác (R-06).
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      return {
        ok: false,
        kind: "rate_limited",
        retryAfterMs: parseRetryAfterMs(res.headers.get("retry-after")),
      };
    }

    // 4xx/5xx đều terminal. Thử lại 5xx nghe hợp lý nhưng sai ở đây: ngân sách
    // chỉ đặt chỗ cho GROQ_CALLS_PER_ESSAY và pass chấm nằm dưới một deadline,
    // nên vòng đời chọn trả câu về `failed` kèm nút chấm lại do học sinh bấm.
    if (!res.ok) return { ok: false, kind: "provider" };

    // KHÔNG bao giờ trả body lỗi thô của nhà cung cấp cho caller: nó là văn bản
    // tự do, và AC-056 cấm văn bản tự do đi tiếp vào bất kỳ đường log nào.
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ok: false, kind: "provider" };
    }

    const text = firstMessageContent(body);
    if (text === null) return { ok: false, kind: "provider" };
    // KHÔNG parse, KHÔNG nắn — validate là việc của parseGrade(), và nó phải
    // nhận đúng thứ model đã nói ra.
    return { ok: true, text };
  } catch {
    // Cờ `timedOut` chứ không đi đoán tên lỗi: một AbortError có thể đến từ
    // nơi khác, còn cờ này chỉ được bật bởi đúng cái timer trên.
    return { ok: false, kind: timedOut ? "timeout" : "transport" };
  } finally {
    // Dọn timer kể cả ở nhánh thành công: một timer treo giữ process sống thêm
    // GROQ_CALL_DEADLINE_MS trong môi trường serverless.
    clearTimeout(timer);
  }
}

/**
 * **Điểm phát Groq DUY NHẤT của cả repo** (AC-033).
 *
 * KHÔNG BAO GIỜ ném: mọi lối thoát là một thành viên của union đóng `GroqResult`.
 * Thiếu `GROQ_API_KEY` cũng vậy — trả `{ kind: "provider" }` chứ không ném, vì
 * caller ở đường `after()` không có ai để bắt hộ.
 *
 * Đúng MỘT lời gọi mạng logic mỗi lần gọi hàm, cộng tối đa
 * `GROQ_MAX_IN_PASS_RETRIES` lần thử lại CHỈ cho `kind === "rate_limited"`.
 */
export async function groqChatCompletion(input: GroqGradeRequest): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY;
  // Kiểm TRƯỚC khi gọi mạng: gọi rồi mới phát hiện thiếu khoá sẽ đốt một lượt
  // trong ngân sách vốn đã đặt chỗ cho đúng con số.
  if (!apiKey) return { ok: false, kind: "provider" };

  let last: Attempt = { ok: false, kind: "provider" };

  for (let attempt = 0; attempt <= GROQ_MAX_IN_PASS_RETRIES; attempt++) {
    last = await attemptOnce(apiKey, input);
    if (last.ok) return { ok: true, text: last.text };
    // 429 là lối DUY NHẤT được thử lại.
    if (last.kind !== "rate_limited") return { ok: false, kind: last.kind };
    if (attempt === GROQ_MAX_IN_PASS_RETRIES) break;

    const wait = computeRetryWaitMs(attempt, last.retryAfterMs);
    // `retry-after` dài hơn trần ⇒ bỏ cuộc NGAY thay vì thử lại nhanh rồi vẫn
    // hỏng: nhà cung cấp vừa nói thẳng là chưa tới lượt ta.
    if (last.retryAfterMs !== undefined && last.retryAfterMs > GROQ_RETRY_MAX_WAIT_MS) break;
    await sleep(wait);
  }

  return { ok: false, kind: "rate_limited", retryAfterMs: last.ok ? undefined : last.retryAfterMs };
}
