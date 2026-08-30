// `reserveGroqBudget()` — cổng DUY NHẤT trên chi tiêu Groq (AC-030/AC-031/AC-066).
//
// BIÊN MOCK: Redis, ở đúng biên mà `quota.test.ts:100-110` đã dùng. Đó là I/O
// ngoài; mock sâu hơn sẽ kiểm dây nối thay vì kiểm hành vi.
//
// BA THỨ FILE NÀY PHẢI CHỨNG MINH, và không cái nào chứng minh được bằng "hàm
// có được gọi không":
//
//   1. GIÁ TRỊ ĐỐI SỐ của `INCRBY`, không phải việc nó đã chạy. Một cài đặt tích
//      từng lượt gọi (`INCRBY 1` ba lần) cũng "có gọi INCRBY", nhưng nó đặt chỗ
//      ÍT HƠN mức có thể tiêu, và trần thôi ràng buộc chi tiêu thật.
//   2. TÊN KHOÁ. Một lỗi gõ hay một phép suy lại ngày đặt chi tiêu Groq lên bộ
//      đếm Gemini, và một ngày chấm nhiều sẽ chặn trích xuất Gemini của tất cả
//      mọi người. Hai tiền tố khác nhau NGAY Ở KÝ TỰ ĐẦU nên chuyện này bắt
//      được bằng cấu trúc tên, không cần trông vào kỷ luật.
//   3. BA LỐI FAIL-CLOSED. Hướng sai nguy hiểm ở đây là `{ ok: true }`: một
//      `catch` trả về `ok` biến một sự cố Redis thành chi tiêu KHÔNG GIỚI HẠN.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// `budget.ts` và `budgetDay.ts` đều khai `import "server-only"` — gói đó ném
// ngoài bundle react-server. Khuôn của repo: quota.test.ts:36, budgetDay.test.ts:9.
vi.mock("server-only", () => ({}));

const redis = {
  incrby: vi.fn(),
  decrby: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@upstash/redis", () => ({
  Redis: class {
    incrby = redis.incrby;
    decrby = redis.decrby;
    expire = redis.expire;
  },
}));

import { BUDGET_TTL_SECONDS } from "@/lib/billing/budgetDay";
import { GROQ_CALLS_PER_ESSAY } from "../groqClient";
import { reserveGroqBudget } from "../budget";

/** 2026-02-28T12:00:00Z là 04:00 giờ Pacific cùng ngày — không rơi vào bẫy
 *  lệch ngày mà `pacificDay()` tồn tại để tránh. */
const NOW = new Date("2026-02-28T12:00:00.000Z");
const KEY = "groq:budget:2026-02-28";

beforeEach(() => {
  process.env.KV_REST_API_URL = "https://example.upstash.io";
  process.env.KV_REST_API_TOKEN = "token";
  process.env.GROQ_BUDGET_DAILY_LIMIT = "600";
  redis.incrby.mockReset();
  redis.decrby.mockReset();
  redis.expire.mockReset();
  redis.expire.mockResolvedValue(1);
});

afterEach(() => {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.GROQ_BUDGET_DAILY_LIMIT;
});

describe("đặt chỗ — MỘT lệnh INCRBY của trường hợp xấu nhất (EG-BE-020)", () => {
  it("phát đúng MỘT `INCRBY`, với ĐỐI SỐ bằng số lượt xấu nhất", () => {
    redis.incrby.mockResolvedValue(3);
    return reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW).then((r) => {
      expect(r).toEqual({ ok: true });
      expect(redis.incrby).toHaveBeenCalledTimes(1);
      // Khẳng định GIÁ TRỊ, không phải việc đã gọi: một cài đặt `INCRBY 1` ba
      // lần cũng qua được một phép đếm lời gọi, nhưng nó đặt chỗ ít hơn mức có
      // thể tiêu — đúng cái under-count mà cả hai bộ đếm sinh ra để sửa.
      expect(redis.incrby).toHaveBeenCalledWith(KEY, GROQ_CALLS_PER_ESSAY);
      expect(GROQ_CALLS_PER_ESSAY).toBe(3);
    });
  });

  it("đặt TTL 26 giờ trên đúng khoá đó", async () => {
    redis.incrby.mockResolvedValue(3);
    await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    expect(redis.expire).toHaveBeenCalledWith(KEY, BUDGET_TTL_SECONDS);
    expect(BUDGET_TTL_SECONDS).toBe(26 * 60 * 60);
  });

  it("KHÔNG hoàn lại khi còn dưới trần — đếm dư là hướng sai AN TOÀN", async () => {
    // ADR-0018 D6. Đặt chỗ dư ở lượt thành công ngay lần đầu kéo thông lượng
    // ngày xuống dưới trần danh nghĩa, và đó là đánh đổi ĐÃ GHI NHẬN: đếm dư
    // chỉ làm ta phục vụ ít hơn, đếm thiếu là sự cố.
    redis.incrby.mockResolvedValue(3);
    await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    expect(redis.decrby).not.toHaveBeenCalled();
  });

  it("khoá đổi theo NGÀY PACIFIC, không theo ngày UTC", async () => {
    // 2026-03-01T05:30Z còn là 2026-02-28 ở Pacific. Một cài đặt dùng
    // `toISOString().slice(0,10)` sẽ cho "2026-03-01" và chia đôi bộ đếm ngay
    // giữa ngày — đúng chế độ hỏng mà `budgetDay.ts` tồn tại để chặn.
    redis.incrby.mockResolvedValue(1);
    await reserveGroqBudget(1, new Date("2026-03-01T05:30:00.000Z"));
    expect(redis.incrby).toHaveBeenCalledWith("groq:budget:2026-02-28", 1);
  });
});

describe("vượt trần — hoàn lại rồi từ chối (AC-030)", () => {
  it("vượt trần ⇒ DECRBY đúng số đã cộng, rồi `project_budget`", async () => {
    process.env.GROQ_BUDGET_DAILY_LIMIT = "600";
    redis.incrby.mockResolvedValue(601);

    const r = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    expect(r).toEqual({ ok: false, reason: "project_budget" });
    // Hoàn lại đúng bằng số đã cộng: một lượt bị chặn không được tự kéo dài
    // thời gian bị chặn của chính nó (cùng hình dạng quota.ts:373-377).
    expect(redis.decrby).toHaveBeenCalledWith(KEY, GROQ_CALLS_PER_ESSAY);
  });

  it("ĐÚNG BẰNG trần thì vẫn qua — biên là `>`, không phải `>=`", async () => {
    // Ca biên thật sự: một cài đặt dùng `>=` sẽ từ chối request cuối cùng mà
    // ngân sách đã trả tiền cho.
    process.env.GROQ_BUDGET_DAILY_LIMIT = "600";
    redis.incrby.mockResolvedValue(600);
    const r = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    expect(r).toEqual({ ok: true });
    expect(redis.decrby).not.toHaveBeenCalled();
  });
});

describe("ba lối FAIL-CLOSED (EG-BE-021 / AC-031)", () => {
  it("store không tới được ⇒ `unavailable`, và KHÔNG cho qua", async () => {
    redis.incrby.mockRejectedValue(new Error("ECONNRESET"));
    const r = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    // Hướng sai nguy hiểm là `{ ok: true }`: một `catch` trả về ok biến sự cố
    // Redis thành chi tiêu không giới hạn.
    expect(r).toEqual({ ok: false, reason: "unavailable" });
  });

  it("thiếu `KV_REST_API_*` ⇒ `unavailable`, và KHÔNG chạm store", async () => {
    delete process.env.KV_REST_API_URL;
    const r = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    expect(r).toEqual({ ok: false, reason: "unavailable" });
    expect(redis.incrby).not.toHaveBeenCalled();
  });

  it("thiếu `GROQ_BUDGET_DAILY_LIMIT` ⇒ `unavailable`, KHÔNG ghi gì", async () => {
    delete process.env.GROQ_BUDGET_DAILY_LIMIT;
    const r = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
    expect(r).toEqual({ ok: false, reason: "unavailable" });
    // Trần được kiểm TRƯỚC mọi phép ghi: một deploy quên biến môi trường không
    // được phép đốt bộ đếm trong lúc từ chối phục vụ.
    expect(redis.incrby).not.toHaveBeenCalled();
  });

  it.each(["0", "-5", "abc", "1.5", "", "   "])(
    "`GROQ_BUDGET_DAILY_LIMIT` = %o (không hợp lệ) ⇒ `unavailable`",
    async (raw) => {
      process.env.GROQ_BUDGET_DAILY_LIMIT = raw;
      const r = await reserveGroqBudget(GROQ_CALLS_PER_ESSAY, NOW);
      expect(r).toEqual({ ok: false, reason: "unavailable" });
      expect(redis.incrby).not.toHaveBeenCalled();
    }
  );

  it("`unavailable` và `project_budget` là HAI lý do khác nhau", async () => {
    // Chúng phải phân biệt được: telemetry ghi `project_budget_exhausted` cho
    // một cái và không cho cái kia, và học sinh thấy hai câu chuyện khác nhau.
    redis.incrby.mockRejectedValue(new Error("down"));
    const down = await reserveGroqBudget(1, NOW);
    redis.incrby.mockReset();
    redis.incrby.mockResolvedValue(9_999);
    const over = await reserveGroqBudget(1, NOW);
    expect(down).toEqual({ ok: false, reason: "unavailable" });
    expect(over).toEqual({ ok: false, reason: "project_budget" });
  });
});

describe("kỷ luật khoá và phạm vi (AC-030, AC-066)", () => {
  const SOURCE_ROOT = process.cwd();

  function codeLines(source: string): string[] {
    return source.split("\n").filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
    });
  }

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".next")) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("`ai:budget:` KHÔNG xuất hiện ở bất kỳ đâu dưới `lib/essay/`", () => {
    const offenders = walk(path.join(SOURCE_ROOT, "lib/essay"))
      .filter((f) => codeLines(readFileSync(f, "utf8")).some((l) => /ai:budget/.test(l)))
      .map((f) => path.relative(SOURCE_ROOT, f).split(path.sep).join("/"));
    // Hai tiền tố khác nhau NGAY Ở KÝ TỰ ĐẦU (`a` vs `g`), nên AC-030 đứng
    // được bằng CẤU TRÚC TÊN chứ không bằng kỷ luật của người viết.
    expect(offenders).toEqual([]);
  });

  it("toàn repo có ĐÚNG MỘT chỗ dựng mẫu khoá `groq:budget:`", () => {
    // Đối xứng với cổng canh `ai:budget:` ở quota.test.ts:868, và cùng lý do:
    // mẫu khoá phải được VIẾT NGUYÊN VẸN ở đúng một file, để một chỗ dựng thứ
    // hai không lặng lẽ chia đôi bộ đếm.
    // Lượt duyệt toàn cây DUY NHẤT của file này — xem ghi chú chi phí ở
    // groqChokepoint.test.ts.
    const sites = walk(SOURCE_ROOT)
      .filter((f) => codeLines(readFileSync(f, "utf8")).some((l) => /["'`]groq:budget:/.test(l)))
      .map((f) => path.relative(SOURCE_ROOT, f).split(path.sep).join("/"));
    expect(sites).toEqual(["lib/essay/budget.ts"]);
  });

  it("module KHÔNG đọc Entitlement, Plan, hay tách suất theo gói", () => {
    // Trần là MỘT con số cho cả dự án (AC-066). Một phép tách suất ở đây sẽ
    // lặng lẽ biến bộ đếm dự án thành hạn mức người dùng thứ hai.
    const code = codeLines(
      readFileSync(path.join(SOURCE_ROOT, "lib/essay/budget.ts"), "utf8")
    ).join("\n");
    expect(code).not.toMatch(/Entitlement|budgetCeiling|freeShare|PLAN_LIMITS|consumeQuota/);
  });

  it("module IMPORT `pacificDay` + `BUDGET_TTL_SECONDS` chứ không tự suy lại", () => {
    const code = readFileSync(path.join(SOURCE_ROOT, "lib/essay/budget.ts"), "utf8");
    expect(code).toMatch(/from "@\/lib\/billing\/budgetDay"/);
    // Hai dấu hiệu của một phép suy lại ngày — cái thứ hai là chính cái bẫy mà
    // budgetDay.ts:20-24 mô tả (ngày UTC lệch với ngày Pacific lúc 05:30Z).
    expect(code).not.toMatch(/Intl\.DateTimeFormat/);
    expect(code).not.toMatch(/toISOString\(\)\.slice/);
  });
});
