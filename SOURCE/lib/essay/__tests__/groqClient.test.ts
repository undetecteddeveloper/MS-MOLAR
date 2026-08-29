// `groqChatCompletion()` — vòng retry, phân loại lỗi, deadline.
//
// BIÊN MOCK: `fetch`, và KHÔNG SÂU HƠN (backend DD § Mock Boundary Decisions).
// Đó là biên I/O ngoài thật sự, nên mock ở đúng đó khiến vòng retry, phép phân
// loại lỗi và deadline chạy MÃ THẬT. Mock sâu hơn — ví dụ thay hẳn hàm tính
// thời gian chờ — sẽ biến bộ test này thành phép kiểm dây nối.
//
// VÌ SAO PHÂN LOẠI LỖI PHẢI PHÂN BIỆT ĐƯỢC, chứ không gộp thành một "hỏng":
// quyết định vòng đời ở `gradeEssays.ts` (B1.4) đọc chính `kind` này. Một giới
// hạn tần suất và một response vô nghĩa mà settle giống hệt nhau thì telemetry
// mất luôn khả năng phân biệt hai sự cố hoàn toàn khác nhau (AC-024/AC-065).
//
// Đồng hồ giả: thời gian chờ retry thật là ~1 s rồi ~2 s, và deadline là 20 s.
// Chạy thật thì mỗi ca tốn vài giây và bộ test sẽ bị tắt vì chậm — nên dùng
// `vi.useFakeTimers()`. `fetch` đã bị mock nên không có I/O thật nào cần đồng
// hồ thật.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `groqClient.ts` khai `import "server-only"` — gói đó NÉM khi được import
// ngoài bundle react-server. Cùng khuôn mà quota.test.ts:36, budgetDay.test.ts:9
// và geminiChokepoint.test.ts:30 đã dùng. `vi.mock` được hoist lên trước mọi
// import nên nó có hiệu lực cho dòng `from "../groqClient"` ngay dưới.
vi.mock("server-only", () => ({}));

import {
  GROQ_CALLS_PER_ESSAY,
  GROQ_CALL_DEADLINE_MS,
  GROQ_CHAT_COMPLETIONS_URL,
  GROQ_MAX_IN_PASS_RETRIES,
  GROQ_RETRY_MAX_WAIT_MS,
  computeRetryWaitMs,
  groqChatCompletion,
} from "../groqClient";

const PROMPT = "chấm giúp bài này";
const MODEL = "qwen/qwen3.8-27b";

/** Response 200 hợp lệ theo hình dạng OpenAI-compatible. */
function okResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function statusResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response("{}", { status, headers });
}

/** Chạy hàm dưới đồng hồ giả: đẩy hết mọi timer đang chờ cho tới khi promise
 *  hoàn tất. `runAllTimersAsync` xử lý được cả chuỗi timer nối nhau (retry thứ
 *  hai được đặt lịch sau khi retry thứ nhất chạy xong). */
async function withTimersAdvanced<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (v) => ({ v }),
    (e: unknown) => ({ e })
  );
  await vi.runAllTimersAsync();
  const r = await settled;
  if ("e" in r) throw r.e;
  return r.v;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  process.env.GROQ_API_KEY = "gsk_test_key_not_a_real_one";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GROQ_API_KEY;
});

describe("đường thành công", () => {
  it("trả nguyên văn content của message đầu tiên, KHÔNG parse, KHÔNG nắn", async () => {
    // Hợp đồng nói text là "nội dung message đầu tiên, KHÔNG parse". Dùng một
    // chuỗi KHÔNG phải JSON hợp lệ để phân biệt hai hành vi: một client lỡ
    // parse hộ sẽ hỏng ở đây, còn một ống dẫn trong suốt thì trả y nguyên.
    // Việc validate là của parseGrade(), và nó phải nhận được đúng thứ model
    // đã nói ra.
    fetchMock.mockResolvedValue(okResponse('{"band": 3, "low_confidence": false} thừa chữ'));
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: true, text: '{"band": 3, "low_confidence": false} thừa chữ' });
  });

  it("một lời gọi hàm = ĐÚNG MỘT request khi lần đầu đã thành công", async () => {
    fetchMock.mockResolvedValue(okResponse("{}"));
    await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST đúng endpoint, đúng body, temperature 0", async () => {
    fetchMock.mockResolvedValue(okResponse("{}"));
    await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GROQ_CHAT_COMPLETIONS_URL);
    expect(init.method).toBe("POST");
    // temperature 0 vì cùng văn bản phải cho cùng band — một grader không tất
    // định làm phép so sánh đối chứng của AC-042 mất nghĩa.
    expect(JSON.parse(init.body as string)).toEqual({
      model: MODEL,
      messages: [{ role: "user", content: PROMPT }],
      temperature: 0,
      response_format: { type: "json_object" },
    });
  });

  it("model đến TỪ THAM SỐ, không phải hằng viết cứng trong module", async () => {
    // Tên model sống ở lib/ai/models.ts (lý do ghi ở models.ts:1-24). Nếu
    // module này tự khai lại thì lỗi "script trôi lệch khỏi hằng của bundle" mà
    // file kia sinh ra để sửa sẽ tái diễn nguyên xi.
    fetchMock.mockResolvedValue(okResponse("{}"));
    await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: "model-khac-hoan-toan" }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe("model-khac-hoan-toan");
  });
});

describe("429 — lối DUY NHẤT được thử lại", () => {
  it("429 rồi 200: thử lại và trả kết quả thành công", async () => {
    fetchMock
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(okResponse("xong"));

    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: true, text: "xong" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("429 liên tục: hết lượt sau đúng 1 + GROQ_MAX_IN_PASS_RETRIES request", async () => {
    fetchMock.mockResolvedValue(statusResponse(429));

    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toMatchObject({ ok: false, kind: "rate_limited" });
    // Con số này phải BẰNG số mà ngân sách đã đặt chỗ trước request đầu tiên.
    // Dùng chính hằng đó chứ không gõ `3`: đổi số lần thử lại phải tự kéo theo
    // cả hai đầu, đúng bài học GEMINI_CALLS_PER_OPERATION (gemini.ts:43-71).
    expect(fetchMock).toHaveBeenCalledTimes(GROQ_CALLS_PER_ESSAY);
    expect(GROQ_CALLS_PER_ESSAY).toBe(1 + GROQ_MAX_IN_PASS_RETRIES);
  });

  it("429-hết-lượt và lỗi-không-429 là HAI nguyên nhân terminal KHÁC NHAU", async () => {
    // Đây là khẳng định mà cả vòng đời đứng lên trên. Nếu hai đường này trả
    // cùng một `kind` thì B1.4 không thể settle khác nhau, và telemetry không
    // phân biệt được "bị giới hạn tần suất" với "nhà cung cấp hỏng".
    fetchMock.mockResolvedValue(statusResponse(429));
    const limited = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(statusResponse(500));
    const broken = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));

    expect(limited).toMatchObject({ ok: false, kind: "rate_limited" });
    expect(broken).toMatchObject({ ok: false, kind: "provider" });
    expect((limited as { kind: string }).kind).not.toBe((broken as { kind: string }).kind);
  });

  it("`retry-after` dài hơn trần chờ ⇒ HẾT LƯỢT NGAY, không ngủ qua nó", async () => {
    // Free tier Groq trả `retry-after` có thể lên tới nhiều phút khi chạm giới
    // hạn ngày. Ngủ qua nó vừa đốt invocation vừa vẫn hỏng — nên vượt trần là
    // bỏ cuộc ngay, câu thành `failed`, và học sinh có nút chấm lại.
    fetchMock.mockResolvedValue(
      statusResponse(429, { "retry-after": String(GROQ_RETRY_MAX_WAIT_MS / 1000 + 60) })
    );

    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toMatchObject({ ok: false, kind: "rate_limited" });
    // MỘT request, không phải ba: bỏ cuộc ngay chứ không phải thử lại nhanh.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("`retry-after` trong trần thì VẪN thử lại", async () => {
    // Chiều đối chứng của ca trên. Không có nó, một cài đặt \"luôn bỏ cuộc khi
    // thấy retry-after\" cũng sẽ xanh.
    fetchMock
      .mockResolvedValueOnce(statusResponse(429, { "retry-after": "1" }))
      .mockResolvedValueOnce(okResponse("xong"));

    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: true, text: "xong" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("trả kèm `retryAfterMs` khi nhà cung cấp có nói, để caller ghi lại được", async () => {
    fetchMock.mockResolvedValue(
      statusResponse(429, { "retry-after": String(GROQ_RETRY_MAX_WAIT_MS / 1000 + 60) })
    );
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toMatchObject({ retryAfterMs: (GROQ_RETRY_MAX_WAIT_MS / 1000 + 60) * 1000 });
  });
});

describe("computeRetryWaitMs — backoff mũ, có jitter, luôn dưới trần", () => {
  // Tách ra hàm thuần để kiểm được BIÊN mà không phải dựng ba response 429 chỉ
  // để quan sát một con số. Jitter nhận vào như tham số nên ca test tất định.

  it("backoff mũ: ~1 s rồi ~2 s", () => {
    expect(computeRetryWaitMs(0, undefined, 0)).toBe(1_000);
    expect(computeRetryWaitMs(1, undefined, 0)).toBe(2_000);
  });

  it("jitter chỉ CỘNG THÊM, không bao giờ kéo xuống dưới nền", () => {
    // Jitter tồn tại để hai lượt chấm song song không cùng thức dậy một lúc.
    // Nếu nó trừ đi thì backoff mất tác dụng ở đúng lần thử căng nhất.
    expect(computeRetryWaitMs(0, undefined, 0.99)).toBeGreaterThanOrEqual(1_000);
    expect(computeRetryWaitMs(0, undefined, 0.99)).toBeLessThanOrEqual(1_250);
  });

  it("KHÔNG BAO GIỜ vượt trần, kể cả khi jitter kịch và mũ đã lớn", () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(computeRetryWaitMs(attempt, undefined, 1)).toBeLessThanOrEqual(GROQ_RETRY_MAX_WAIT_MS);
    }
  });

  it("`retry-after` được tôn trọng khi nó DÀI HƠN backoff", () => {
    // Nhà cung cấp biết rõ hơn ta khi nào nên quay lại; backoff chỉ là phỏng
    // đoán khi không ai nói gì.
    expect(computeRetryWaitMs(0, 5_000, 0)).toBe(5_000);
  });

  it("nhưng vẫn bị trần cắt", () => {
    expect(computeRetryWaitMs(0, 600_000, 0)).toBe(GROQ_RETRY_MAX_WAIT_MS);
  });
});

describe("lối terminal — không lối nào được thử lại", () => {
  it.each([400, 401, 404, 500, 503])("HTTP %i ⇒ provider, đúng một request", async (status) => {
    fetchMock.mockResolvedValue(statusResponse(status));
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: false, kind: "provider" });
    // Thử lại 5xx nghe hợp lý nhưng SAI ở đây: ngân sách chỉ đặt chỗ cho
    // 1 + GROQ_MAX_IN_PASS_RETRIES, và pass chấm nằm dưới một deadline. Vòng
    // đời chọn cách trả câu về `failed` kèm nút chấm lại do học sinh bấm.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("`fetch` ném (mất mạng, DNS hỏng) ⇒ transport", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: false, kind: "transport" });
  });

  it("body 200 nhưng KHÔNG phải JSON ⇒ provider, không ném", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: false, kind: "provider" });
  });

  it("body 200 đúng JSON nhưng thiếu `choices[0].message.content` ⇒ provider", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: false, kind: "provider" });
  });

  it("thiếu GROQ_API_KEY ⇒ provider, KHÔNG ném, và KHÔNG gọi mạng", async () => {
    delete process.env.GROQ_API_KEY;
    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(r).toEqual({ ok: false, kind: "provider" });
    // Không gọi mạng là nửa quan trọng: gọi rồi mới phát hiện thiếu khoá sẽ
    // đốt một lượt trong ngân sách đã đặt chỗ cho đúng con số.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("deadline — mỗi lần thử một AbortController RIÊNG", () => {
  /** Mock nghe tín hiệu abort như một `fetch` thật. Không nghe thì deadline sẽ
   *  không quan sát được và ca test sẽ xanh giả. */
  function abortAwareFetch(): ReturnType<typeof vi.fn> {
    return vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );
  }

  it("request treo quá deadline ⇒ timeout, phân biệt được với transport", async () => {
    fetchMock = abortAwareFetch();
    vi.stubGlobal("fetch", fetchMock);

    const r = await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    // `timeout` chứ không phải `transport`: cả hai đều là "không có response",
    // nhưng một cái nói mạng hỏng còn cái kia nói nhà cung cấp chậm — và
    // OQ-1 sẽ chỉnh GROQ_CALL_DEADLINE_MS dựa trên đúng tín hiệu này.
    expect(r).toEqual({ ok: false, kind: "timeout" });
  });

  it("mỗi lần thử được cấp deadline mới, không dùng chung cả chuỗi retry", async () => {
    // Khác FATAL_CALL_DEADLINE_MS của Gemini có chủ đích: ở đó SDK tự retry
    // BÊN TRONG một signal duy nhất. Ở đây vòng retry là của ta, nên một
    // signal dùng chung sẽ khiến lần thử thứ ba gần như chắc chắn chết vì
    // deadline của lần thử thứ nhất.
    let seen: (AbortSignal | null | undefined)[] = [];
    fetchMock = vi.fn((_url: string, init: RequestInit) => {
      seen.push(init.signal);
      return Promise.resolve(statusResponse(429));
    });
    vi.stubGlobal("fetch", fetchMock);

    await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));

    expect(seen).toHaveLength(GROQ_CALLS_PER_ESSAY);
    expect(new Set(seen).size).toBe(GROQ_CALLS_PER_ESSAY);
    seen = [];
  });

  it("deadline được DỌN khi request xong sớm — không để timer treo lại", async () => {
    // Timer không clear sẽ giữ process sống thêm GROQ_CALL_DEADLINE_MS trong
    // môi trường serverless, và làm `vi.runAllTimersAsync()` ở mọi ca khác
    // phải chạy qua một timer vô nghĩa.
    fetchMock.mockResolvedValue(okResponse("xong"));
    await withTimersAdvanced(groqChatCompletion({ prompt: PROMPT, model: MODEL }));
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("hằng số — đúng giá trị thiết kế đã chốt", () => {
  it("bốn hằng thời gian mang đúng giá trị OQ-1 đang giữ", () => {
    // Ghim để một lần đổi số phải hiện ra trong diff. CHÚNG CHƯA ĐƯỢC ĐO —
    // OQ-1 sở hữu cả bốn cho tới Task E5 — nên ca này ghim một QUYẾT ĐỊNH,
    // không chứng nhận một phép đo.
    expect(GROQ_CALL_DEADLINE_MS).toBe(20_000);
    expect(GROQ_MAX_IN_PASS_RETRIES).toBe(2);
    expect(GROQ_RETRY_MAX_WAIT_MS).toBe(8_000);
    expect(GROQ_CALLS_PER_ESSAY).toBe(3);
  });

  it("endpoint là hằng export DUY NHẤT, đúng đường OpenAI-compatible", () => {
    expect(GROQ_CHAT_COMPLETIONS_URL).toBe("https://api.groq.com/openai/v1/chat/completions");
  });
});
