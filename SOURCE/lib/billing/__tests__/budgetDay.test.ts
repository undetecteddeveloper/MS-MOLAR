import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// `budgetDay.ts` khai `import "server-only"` (backend DD § MSA-3) — module ấy
// NÉM khi được nạp ngoài bundle server của Next. Stub theo lối đã dùng ở 14
// file test khác trong repo (vd `quota.test.ts:36`, `readEntitlement.test.ts:34`).
vi.mock("server-only", () => ({}));

import { BUDGET_TTL_SECONDS, pacificDay } from "../budgetDay";

/**
 * `budgetDay.ts` là MỘT lời khai của "hôm nay là ngày nào theo múi giờ nhà cung
 * cấp reset hạn mức", dùng chung bởi bộ đếm ngân sách Gemini và bộ đếm ngân
 * sách Groq (backend DD § MSA-3).
 *
 * Bộ test này KHÔNG phải bằng chứng chính của Task H2 — bằng chứng ấy là bộ
 * test `quota` hiện có giữ nguyên xanh mà KHÔNG sửa một dòng nào. Đây là phần
 * bổ sung: `pacificDay()` nay là một primitive DÙNG CHUNG, nên hành vi biên của
 * nó đáng được ghim tại chỗ thay vì chỉ được kiểm gián tiếp qua một consumer.
 */
describe("pacificDay()", () => {
  it("trả về ngày Pacific chứ không phải ngày UTC ở quanh nửa đêm", () => {
    // 2026-03-01T05:30:00Z là 2026-02-28 21:30 giờ Pacific (PST, UTC-8).
    // `toISOString().slice(0, 10)` sẽ cho "2026-03-01" — sai một ngày, và sai
    // đúng vào lúc bộ đếm ngân sách được reset.
    expect(pacificDay(new Date("2026-03-01T05:30:00.000Z"))).toBe("2026-02-28");
  });

  it("sang ngày mới đúng lúc nửa đêm Pacific, không sớm không muộn", () => {
    // 07:59:59Z = 23:59:59 PST ngày 28; 08:00:00Z = 00:00:00 PST ngày 1.
    expect(pacificDay(new Date("2026-03-01T07:59:59.999Z"))).toBe("2026-02-28");
    expect(pacificDay(new Date("2026-03-01T08:00:00.000Z"))).toBe("2026-03-01");
  });

  it("giữ đúng dạng YYYY-MM-DD, có đệm số 0", () => {
    // Tháng và ngày một chữ số phải được đệm: một khoá đổi hình dạng theo độ
    // dài số là một bộ đếm bị chia đôi.
    expect(pacificDay(new Date("2026-01-05T20:00:00.000Z"))).toBe("2026-01-05");
    expect(pacificDay(new Date("2026-01-05T20:00:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("đi qua mốc đổi giờ mùa hè mà không nhảy hay lặp ngày", () => {
    // DST 2026 bắt đầu 08/03. Trước và sau mốc, ngày vẫn tiến đúng một bậc.
    expect(pacificDay(new Date("2026-03-08T09:00:00.000Z"))).toBe("2026-03-08");
    expect(pacificDay(new Date("2026-03-09T09:00:00.000Z"))).toBe("2026-03-09");
  });

  it("KHÔNG đọc đồng hồ bên trong: cùng một `now` luôn cho cùng một ngày", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(pacificDay(now)).toBe(pacificDay(now));
  });
});

describe("BUDGET_TTL_SECONDS", () => {
  it("dài hơn ngày Pacific dài nhất (25h) và ngắn hơn hai ngày", () => {
    // 26h: đủ để không khoá nào bị xoá khi ngày còn đang chạy — kể cả ngày
    // 25 tiếng khi đồng hồ lùi — và ngắn đủ để khoá hôm qua không sống sang
    // ngày kia.
    expect(BUDGET_TTL_SECONDS).toBe(26 * 60 * 60);
    expect(BUDGET_TTL_SECONDS).toBeGreaterThan(25 * 60 * 60);
    expect(BUDGET_TTL_SECONDS).toBeLessThan(48 * 60 * 60);
  });
});

/**
 * Hồi quy cho chính khuyết tật mà Task H2 vấp phải.
 *
 * `quota.test.ts:868` canh bất biến "toàn repo có ĐÚNG MỘT chỗ dựng mẫu khoá
 * `ai:budget:`" bằng cách quét văn bản nguồn tìm một dấu nháy đứng NGAY TRƯỚC
 * `ai:budget:`. Nếu ai đó đẩy chuỗi ấy thành tham số của một hàm dựng khoá
 * (`pacificDayKey("ai:budget", now)`), literal trong nguồn thành `"ai:budget"`
 * — dấu nháy ĐÓNG nằm đúng chỗ cổng cần dấu hai chấm — nên cổng khớp KHÔNG
 * file nào và IM LẶNG THÔI CANH.
 *
 * Ca dưới đây khẳng định chiều ngược lại của cùng một bất biến: `budgetDay.ts`
 * KHÔNG được chứa mẫu khoá của bất kỳ provider nào. Nó chỉ biết về NGÀY.
 */
describe("budgetDay.ts không sở hữu mẫu khoá của provider nào", () => {
  const SOURCE_ROOT = path.resolve(__dirname, "../../..");

  function codeLines(source: string): string[] {
    return source.split("\n").filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
    });
  }

  it("không dựng `ai:budget:` — mẫu khoá ấy thuộc về quota.ts", () => {
    const source = readFileSync(path.join(SOURCE_ROOT, "lib/billing/budgetDay.ts"), "utf8");
    expect(codeLines(source).filter((l) => /["'`]ai:budget:/.test(l))).toEqual([]);
  });

  it("cổng canh một-chỗ của `ai:budget:` VẪN đang canh một file thật", () => {
    // Ca này bắt đúng chế độ hỏng mà cổng gốc không tự bắt được: nếu mẫu khoá
    // bị đẩy ra khỏi mọi file nguồn, cổng gốc chuyển từ ĐỎ sang "khớp rỗng" và
    // một lượt sửa cẩu thả (`toEqual([])`) sẽ khiến nó xanh vĩnh viễn mà không
    // canh gì nữa. Ở đây ta khẳng định tập khớp KHÁC RỖNG.
    function walk(dir: string, out: string[] = []): string[] {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".next")) continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
      }
      return out;
    }

    const sites = walk(SOURCE_ROOT)
      .filter((f) => codeLines(readFileSync(f, "utf8")).some((l) => /["'`]ai:budget:/.test(l)))
      .map((f) => path.relative(SOURCE_ROOT, f).split(path.sep).join("/"));

    expect(sites.length).toBeGreaterThan(0);
    expect(sites).toEqual(["lib/billing/quota.ts"]);
  });
});
