// checkEnv — cổng cấu hình lúc khởi động (TD-009).
//
// Điều đáng test không phải "hàm có trả mảng không" mà là: mỗi kiểu hỏng ÂM
// THẦM mà TD-009 mô tả đều bị bắt, và cấu hình đúng thì KHÔNG kêu (một check
// hay báo động giả sẽ bị người vận hành học cách phớt lờ, lúc đó nó vô dụng).

import { describe, expect, it } from "vitest";
import { checkEnv, formatEnvReport } from "../checkEnv";

const UUID_A = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const UUID_B = "9c858901-8a57-4791-81fe-4c455b099bc9";

type Env = Record<string, string | undefined>;

/** Bộ env hợp lệ tối thiểu, đủ để không có vấn đề nào. */
function goodEnv(over: Env = {}): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    GEMINI_API_KEY: "gemini-key",
    ADMIN_USER_IDS: UUID_A,
    ...over,
  };
}

const names = (env: Env) => checkEnv(env).map((p) => p.name);
const levelOf = (env: Env, name: string) => checkEnv(env).find((p) => p.name === name)?.level;

describe("checkEnv", () => {
  it("cấu hình đủ và hợp lệ → im lặng tuyệt đối", () => {
    expect(checkEnv(goodEnv())).toEqual([]);
    expect(formatEnvReport(checkEnv(goodEnv()))).toBe("");
  });

  it("ADMIN_USER_IDS để trống là hợp lệ nhưng phải NÓI — /admin 404 với mọi người", () => {
    const env = goodEnv({ ADMIN_USER_IDS: "" });
    expect(levelOf(env, "ADMIN_USER_IDS")).toBe("warn");
    expect(checkEnv(env).find((p) => p.name === "ADMIN_USER_IDS")?.impact).toContain("404");
  });

  it("ADMIN_USER_IDS thiếu hẳn cũng bị bắt (không chỉ chuỗi rỗng)", () => {
    const env = goodEnv();
    delete env.ADMIN_USER_IDS;
    expect(names(env)).toContain("ADMIN_USER_IDS");
  });

  it("nhiều UUID phân cách bằng dấu phẩy, có khoảng trắng thừa → hợp lệ", () => {
    expect(checkEnv(goodEnv({ ADMIN_USER_IDS: ` ${UUID_A}, ${UUID_B} ` }))).toEqual([]);
  });

  it("id không phải UUID bị bắt — kiểu hỏng im lặng nhất: người đó chỉ đơn giản không phải admin", () => {
    const env = goodEnv({ ADMIN_USER_IDS: `${UUID_A},smithnguyen247@gmail.com` });
    const p = checkEnv(env).find((x) => x.name === "ADMIN_USER_IDS");
    expect(p?.level).toBe("warn");
    expect(p?.impact).toContain("smithnguyen247@gmail.com");
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_URL", "mọi truy vấn Supabase"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "đăng nhập"],
    ["SUPABASE_SERVICE_ROLE_KEY", "RLS"],
  ])("%s thiếu → error, kèm hệ quả cụ thể", (name, mustMention) => {
    const env = goodEnv({ [name]: "" });
    const p = checkEnv(env).find((x) => x.name === name);
    expect(p?.level).toBe("error");
    expect(p?.impact).toContain(mustMention);
  });

  it("GEMINI_API_KEY thiếu là warn, KHÔNG phải error — phần còn lại của app vẫn chạy", () => {
    expect(levelOf(goodEnv({ GEMINI_API_KEY: "" }), "GEMINI_API_KEY")).toBe("warn");
  });

  it("chuỗi toàn khoảng trắng bị coi là thiếu, không phải 'đã đặt'", () => {
    expect(levelOf(goodEnv({ SUPABASE_SERVICE_ROLE_KEY: "   " }), "SUPABASE_SERVICE_ROLE_KEY")).toBe(
      "error"
    );
  });

  it("URL Supabase sai định dạng bị bắt — next.config.ts nuốt lỗi parse này", () => {
    for (const bad of ["abcdefgh.supabase.co", "not a url", "ftp://x.supabase.co"]) {
      const p = checkEnv(goodEnv({ NEXT_PUBLIC_SUPABASE_URL: bad })).find(
        (x) => x.name === "NEXT_PUBLIC_SUPABASE_URL"
      );
      expect(p?.level, `"${bad}" phải bị bắt`).toBe("error");
      expect(p?.impact).toContain("CSP");
    }
  });

  it("NEXT_PUBLIC_SITE_URL bỏ trống là hợp lệ (siteUrl.ts tự suy ra)", () => {
    expect(checkEnv(goodEnv({ NEXT_PUBLIC_SITE_URL: "" }))).toEqual([]);
  });

  it("NEXT_PUBLIC_SITE_URL đặt nhưng không tuyệt đối → warn", () => {
    expect(levelOf(goodEnv({ NEXT_PUBLIC_SITE_URL: "trangnguyen.edu.vn" }), "NEXT_PUBLIC_SITE_URL")).toBe(
      "warn"
    );
  });
});

describe("formatEnvReport", () => {
  it("có error → tiêu đề nói rõ là biến BẮT BUỘC, và liệt kê cả phần warn riêng", () => {
    const report = formatEnvReport(
      checkEnv(goodEnv({ SUPABASE_SERVICE_ROLE_KEY: "", GEMINI_API_KEY: "" }))
    );
    expect(report).toContain("BẮT BUỘC");
    expect(report).toContain("✗ SUPABASE_SERVICE_ROLE_KEY");
    expect(report).toContain("! GEMINI_API_KEY");
    expect(report).toContain("không chặn app chạy");
  });

  it("chỉ có warn → KHÔNG được nói app hỏng", () => {
    const report = formatEnvReport(checkEnv(goodEnv({ ADMIN_USER_IDS: "" })));
    expect(report).not.toContain("BẮT BUỘC");
    expect(report).toContain("app chạy được");
  });

  it("luôn chỉ về .env.example — báo lỗi mà không nói sửa ở đâu thì vô dụng", () => {
    expect(formatEnvReport(checkEnv(goodEnv({ ADMIN_USER_IDS: "" })))).toContain(".env.example");
  });
});
