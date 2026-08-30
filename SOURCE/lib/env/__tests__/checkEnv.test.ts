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
    SUPPORT_NOTIFY_EMAIL: "support@example.com",
    SUPPORT_SMTP_USER: "support@example.com",
    SUPPORT_SMTP_APP_PASSWORD: "app-password",
    // Cổng phát hành Premium (PRD R14). Để BẬT trong bộ "hợp lệ tối thiểu" vì
    // chưa đặt là một trạng thái checkEnv cố ý NÓI RA — cùng lối ADMIN_USER_IDS
    // để trống cũng warn. Bộ này định nghĩa "không còn gì để báo", nên mọi biến
    // có nhánh warn khi vắng đều phải có mặt ở đây.
    GEMINI_PAID_TIER_ENABLED: "1",
    // payOS (ADR-0013/ADR-0014) + ngân sách AI (PRD R7/AC-023/AC-025) — cùng
    // lý do như dòng trên: cả năm biến này đều có nhánh warn khi vắng.
    PAYOS_CLIENT_ID: "payos-client-id",
    PAYOS_API_KEY: "payos-api-key",
    PAYOS_CHECKSUM_KEY: "payos-checksum-key",
    // 0.5 ở đây KHÔNG ghim cách mã hoá — xem ca "0.5 và 50 đều im lặng" bên dưới.
    AI_BUDGET_FREE_SHARE: "0.5",
    AI_BUDGET_DAILY_LIMIT: "20",
    // Chấm tự luận qua Groq (ADR-0018) — cùng lý do như GEMINI_PAID_TIER_ENABLED
    // ở trên: cả ba đều có nhánh warn khi vắng, nên cả ba phải có mặt trong bộ
    // "không còn gì để báo". `ESSAY_GRADING_ENABLED: "true"` ở đây KHÔNG nói
    // rằng bật là trạng thái mặc định — trạng thái ship là TẮT; nó chỉ là giá
    // trị duy nhất khiến checkEnv im lặng, đúng như "1" ở dòng Premium.
    GROQ_API_KEY: "groq-key",
    GROQ_BUDGET_DAILY_LIMIT: "600",
    ESSAY_GRADING_ENABLED: "true",
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

  it.each([
    ["SUPPORT_NOTIFY_EMAIL", "hộp thư"],
    ["SUPPORT_SMTP_USER", "SMTP"],
    ["SUPPORT_SMTP_APP_PASSWORD", "SMTP"],
  ])(
    "%s thiếu là warn, KHÔNG phải error — sendSupportNotification tự degrade, ticket vẫn commit (D5/AC-031)",
    (name, mustMention) => {
      const env = goodEnv({ [name]: "" });
      const p = checkEnv(env).find((x) => x.name === name);
      expect(p?.level).toBe("warn");
      expect(p?.impact).toContain(mustMention);
    }
  );

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

  it("GEMINI_PAID_TIER_ENABLED chưa đặt là hợp lệ nhưng phải NÓI — Premium không bán được", () => {
    // AC-054: quên đặt biến thì hậu quả là KHÔNG BÁN ĐƯỢC, không phải BÁN
    // NHẦM. Vẫn phải kêu, vì hình dạng hỏng thật là "đặt ở local, hụt ở
    // production" — nút chết mà không ai hiểu vì sao.
    const env = goodEnv({ GEMINI_PAID_TIER_ENABLED: undefined });
    expect(levelOf(env, "GEMINI_PAID_TIER_ENABLED")).toBe("warn");
  });

  it("GEMINI_PAID_TIER_ENABLED đặt giá trị TRÔNG NHƯ bật vẫn bị bắt", () => {
    // "yes" bị đọc là TẮT, và triệu chứng giống hệt ca chưa-đặt-biến — đúng
    // kiểu hỏng âm thầm mà TD-009 sinh ra checkEnv để chặn.
    const env = goodEnv({ GEMINI_PAID_TIER_ENABLED: "yes" });
    expect(levelOf(env, "GEMINI_PAID_TIER_ENABLED")).toBe("warn");
    expect(checkEnv(env).find((p) => p.name === "GEMINI_PAID_TIER_ENABLED")?.impact).toContain(
      "không phải giá trị bật"
    );
  });

  // --- payOS + ngân sách AI (backend DD I5, Subscription) -------------------

  it.each([
    ["PAYOS_CLIENT_ID", "tạo đơn"],
    ["PAYOS_API_KEY", "tạo đơn"],
    ["PAYOS_CHECKSUM_KEY", "chữ ký"],
  ])(
    "%s thiếu là warn (theo tiền lệ GEMINI_API_KEY), kèm hệ quả cụ thể",
    (name, mustMention) => {
      const env = goodEnv({ [name]: "" });
      const p = checkEnv(env).find((x) => x.name === name);
      expect(p?.level).toBe("warn");
      expect(p?.impact).toContain(mustMention);
    }
  );

  it.each(["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY"])(
    "%s thiếu HẲN cũng bị bắt, không chỉ chuỗi rỗng",
    (name) => {
      const env = goodEnv();
      delete env[name];
      expect(names(env)).toContain(name);
    }
  );

  it("PAYOS_CHECKSUM_KEY nói đúng hệ quả riêng của nó — tiền đã trả mà đơn không được ghi nhận", () => {
    // Ba credential hỏng theo hai kiểu khác nhau: thiếu client id/api key thì
    // KHÔNG tạo được đơn (người dùng thấy ngay). Thiếu checksum key thì đơn
    // vẫn tạo được, QR vẫn hiện, người dùng vẫn chuyển tiền — chỉ có webhook
    // là bị từ chối. Đó là ca đắt nhất, nên impact không được nói chung chung.
    const p = checkEnv(goodEnv({ PAYOS_CHECKSUM_KEY: "" })).find(
      (x) => x.name === "PAYOS_CHECKSUM_KEY"
    );
    expect(p?.impact).toContain("webhook");
  });

  it("AI_BUDGET_FREE_SHARE thiếu là warn và phải NÓI RA giá trị mặc định", () => {
    // Nó làm suy yếu một CHÍNH SÁCH (phần bảo lưu cho Premium), không gỡ bỏ
    // trần chi — nên mức warn kèm default 50%, khác hẳn AI_BUDGET_DAILY_LIMIT.
    const p = checkEnv(goodEnv({ AI_BUDGET_FREE_SHARE: "" })).find(
      (x) => x.name === "AI_BUDGET_FREE_SHARE"
    );
    expect(p?.level).toBe("warn");
    expect(p?.impact).toContain("50%");
  });

  it.each(["0.5", "50"])(
    "AI_BUDGET_FREE_SHARE = %j im lặng — checkEnv KHÔNG ghim phân số hay phần trăm",
    (raw) => {
      // Cả PRD (:218, AC-023) lẫn DD đều chỉ nói "50%", không nói giá trị được
      // mã hoá thế nào. Chỗ ĐỌC (quota.ts, plan Task 5.1) ghim việc đó; ở đây
      // ghim trước là bịa ra một hợp đồng rồi bắt task sau đoán lại nó.
      expect(checkEnv(goodEnv({ AI_BUDGET_FREE_SHARE: raw }))).toEqual([]);
    }
  );

  it.each(["50%", "một nửa", "0"])(
    "AI_BUDGET_FREE_SHARE = %j bị bắt — sai dưới MỌI cách mã hoá",
    (raw) => {
      expect(levelOf(goodEnv({ AI_BUDGET_FREE_SHARE: raw }), "AI_BUDGET_FREE_SHARE")).toBe("warn");
    }
  );

  it("AI_BUDGET_DAILY_LIMIT thiếu → fail-closed: impact nói TỪ CHỐI, không phải không giới hạn", () => {
    // Đây là hỏng hóc mà cả việc đăng ký biến này tồn tại để chặn (AC-025):
    // một trần chi bị thiếu KHÔNG được đọc thành một trần vô hạn. checkEnv
    // chứng minh phần "có được nói ra không"; phần thực thi là plan Task 5.1.
    const p = checkEnv(goodEnv({ AI_BUDGET_DAILY_LIMIT: "" })).find(
      (x) => x.name === "AI_BUDGET_DAILY_LIMIT"
    );
    expect(p?.level).toBe("warn");
    expect(p?.impact).toContain("TỪ CHỐI");
  });

  it("AI_BUDGET_DAILY_LIMIT thiếu HẲN cũng bị bắt", () => {
    const env = goodEnv();
    delete env.AI_BUDGET_DAILY_LIMIT;
    expect(names(env)).toContain("AI_BUDGET_DAILY_LIMIT");
  });

  it.each(["20", "1", "5000"])("AI_BUDGET_DAILY_LIMIT = %j im lặng", (raw) => {
    expect(checkEnv(goodEnv({ AI_BUDGET_DAILY_LIMIT: raw }))).toEqual([]);
  });

  it.each(["0", "-1", "20.5", "hai mươi", "20 request", "unlimited", "Infinity"])(
    "AI_BUDGET_DAILY_LIMIT = %j bị bắt — số nguyên dương hoặc không có gì cả",
    (raw) => {
      // "unlimited"/"Infinity" là ca đắt nhất: một người vận hành gõ nó với ý
      // "bỏ trần" và không có gì cãi lại. DD nói "integer, no default", nên nó
      // phải kêu chứ không được đọc thành một trần vô hạn.
      expect(levelOf(goodEnv({ AI_BUDGET_DAILY_LIMIT: raw }), "AI_BUDGET_DAILY_LIMIT")).toBe("warn");
    }
  );

  // --- Chấm tự luận qua Groq (ADR-0018) -------------------------------------

  it("GROQ_API_KEY thiếu là warn, KHÔNG phải error — theo tiền lệ GEMINI_API_KEY", () => {
    // Cùng lập luận như GEMINI_API_KEY: một deploy thiếu khoá chấm tự luận mà
    // làm sập trang chủ là đổi một hỏng hóc cục bộ lấy một sự cố toàn site.
    // Quan trọng hơn ở thời điểm này: khoá CHƯA được đặt (cổng ZDR chưa mở),
    // nên `error` sẽ biến trạng thái ship hợp lệ thành một báo động thường trực.
    expect(levelOf(goodEnv({ GROQ_API_KEY: "" }), "GROQ_API_KEY")).toBe("warn");
  });

  it("GROQ_API_KEY thiếu HẲN cũng bị bắt, không chỉ chuỗi rỗng", () => {
    const env = goodEnv();
    delete env.GROQ_API_KEY;
    expect(names(env)).toContain("GROQ_API_KEY");
  });

  it("GROQ_BUDGET_DAILY_LIMIT thiếu → fail-closed: impact nói TỪ CHỐI, không phải không giới hạn", () => {
    // AC-031: trần chi thiếu KHÔNG được đọc thành trần vô hạn. Đây là bản sao
    // có chủ ý của khuôn AI_BUDGET_DAILY_LIMIT, nhưng là trần RIÊNG của Groq
    // (AC-030) — dùng chung một trần cho hai nhà cung cấp thì một ngày chấm
    // nặng đúng là thứ tắt gia sư Gemini đi.
    const p = checkEnv(goodEnv({ GROQ_BUDGET_DAILY_LIMIT: "" })).find(
      (x) => x.name === "GROQ_BUDGET_DAILY_LIMIT"
    );
    expect(p?.level).toBe("warn");
    expect(p?.impact).toContain("TỪ CHỐI");
  });

  it("GROQ_BUDGET_DAILY_LIMIT thiếu HẲN cũng bị bắt", () => {
    const env = goodEnv();
    delete env.GROQ_BUDGET_DAILY_LIMIT;
    expect(names(env)).toContain("GROQ_BUDGET_DAILY_LIMIT");
  });

  it.each(["600", "1", "5000"])("GROQ_BUDGET_DAILY_LIMIT = %j im lặng", (raw) => {
    expect(checkEnv(goodEnv({ GROQ_BUDGET_DAILY_LIMIT: raw }))).toEqual([]);
  });

  it.each(["0", "-1", "600.5", "sáu trăm", "600 request", "unlimited", "Infinity"])(
    "GROQ_BUDGET_DAILY_LIMIT = %j bị bắt — số nguyên dương hoặc không có gì cả",
    (raw) => {
      expect(levelOf(goodEnv({ GROQ_BUDGET_DAILY_LIMIT: raw }), "GROQ_BUDGET_DAILY_LIMIT")).toBe(
        "warn"
      );
    }
  );

  it("ESSAY_GRADING_ENABLED chưa đặt là warn, KHÔNG phải error — đó là trạng thái SHIP", () => {
    // AC-067: một môi trường không bật chấm tự luận là môi trường HOÀN TOÀN
    // HỢP LỆ, nên `error` ở đây sẽ nói dối người vận hành. Nhưng nó vẫn phải
    // NÓI, vì hình dạng hỏng là "bật ở máy, hụt trên production".
    const env = goodEnv();
    delete env.ESSAY_GRADING_ENABLED;
    const p = checkEnv(env).find((x) => x.name === "ESSAY_GRADING_ENABLED");
    expect(p?.level).toBe("warn");
    expect(p?.impact).toContain("chưa chấm tự động");
  });

  it.each(["1", "TRUE", "True", "yes", "on", "false"])(
    "ESSAY_GRADING_ENABLED = %j bị bắt — CHỈ \"true\" chữ thường mới bật",
    (raw) => {
      // Cái bẫy riêng của biến này: GEMINI_PAID_TIER_ENABLED trong cùng file
      // nhận CẢ "1" lẫn "true", nên "1" là thứ một người vận hành gõ theo trí
      // nhớ — và ở đây nó bị đọc là TẮT, triệu chứng giống hệt ca chưa đặt.
      const p = checkEnv(goodEnv({ ESSAY_GRADING_ENABLED: raw })).find(
        (x) => x.name === "ESSAY_GRADING_ENABLED"
      );
      expect(p?.level).toBe("warn");
      expect(p?.impact).toContain("không phải giá trị bật");
    }
  );

  it("ESSAY_GRADING_ENABLED = \"true\" có khoảng trắng thừa vẫn bật — giá trị được trim", () => {
    expect(checkEnv(goodEnv({ ESSAY_GRADING_ENABLED: "  true  " }))).toEqual([]);
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
