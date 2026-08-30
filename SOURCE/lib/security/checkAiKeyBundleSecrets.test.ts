// SECRETS của `scripts/check-ai-key-bundle.mjs` — danh sách bí mật server-only
// mà cổng `npm run check:bundle` quét client bundle để tìm.
//
// VÌ SAO DANH SÁCH NÀY CẦN MỘT TEST, trong khi nó chỉ là dữ liệu:
//
//   Trên CI, mảng này là TOÀN BỘ tấm lưới. Bước "Check bundle" trong
//   .github/workflows/ci.yml không có khối `env:` nào (bốn giá trị giả chỉ
//   thuộc phạm vi bước Build ngay trên), và `.env.local` không tồn tại trên CI
//   — nên `read(name)` trả `undefined` cho CẢ TÁM mục, script in đủ TÁM dòng
//   cảnh báo, và nhánh so-khớp-GIÁ-TRỊ chạy 0 trên 8 lần. Thứ duy nhất còn
//   quét thật là `markers`.
//
//   Trước file này KHÔNG có gì import `SECRETS`, nên xoá `"record_payment_settlement"`,
//   xoá `"api-merchant.payos.vn"`, hay xoá nguyên một mục đều không làm đỏ một
//   cổng nào: `check:bundle` vẫn PASS (ít marker hơn thì càng khó fail), tsc và
//   lint không có ý kiến. Một tấm lưới thủng đúng bằng cách nó vẫn báo xanh.
//
// HÌNH DẠNG KHẲNG ĐỊNH — so khớp NGUYÊN VĂN cả mảng, đúng khuôn
// `lib/supabase/__tests__/publicPaths.test.ts` dùng cho `PUBLIC_PATHS`: cả việc
// THIẾU lẫn việc THỪA đều bị bắt, và từng marker của từng nhãn bị ghim riêng.
// Một phép đếm (`SECRETS.length === 8`) hay một phép kiểm "có marker nào đó"
// sẽ xanh sau khi mất đúng cái marker đắt nhất.
//
// Test nằm ở `lib/security/` chứ không cạnh script vì lý do CƠ HỌC:
// `vitest.config.ts` chỉ thu `lib/**`, `components/**`, `app/**` — `scripts/**`
// nằm ngoài mọi glob của mọi làn (cùng lý do đã đưa `lib/adaptive/__tests__/
// tagDecision.test.ts` ra khỏi `supabase/`).

import { describe, expect, it } from "vitest";
import { SECRETS } from "../../scripts/check-ai-key-bundle.mjs";

describe("SECRETS — danh sách bí mật server-only của cổng check:bundle", () => {
  it("ghim NGUYÊN VĂN tám nhãn và mảng marker của từng nhãn", () => {
    expect(SECRETS.map(({ label, markers }) => ({ label, markers }))).toEqual([
      {
        label: "AI key",
        markers: ["GEMINI_API_KEY", "@google/genai", "generativelanguage.googleapis.com"],
      },
      {
        label: "Supabase service-role key",
        // "record_payment_settlement" là đường DUY NHẤT kéo dài entitlement
        // (ADR-0014 Decision 3): tên này trong client bundle nghĩa là module
        // cầm khoá bypass-RLS đã đi kèm cả đường ghi vào tiền.
        markers: [
          "SUPABASE_SERVICE_ROLE_KEY",
          "record_exam_result",
          "record_payment_settlement",
        ],
      },
      {
        label: "Support mail SMTP credential (ADR-0012)",
        markers: ["SUPPORT_SMTP_APP_PASSWORD", "SUPPORT_SMTP_USER", "nodemailer"],
      },
      {
        label: "payOS checksum key (ADR-0014)",
        // "api-merchant.payos.vn" bắt được ca tệ hơn tên biến env: nguyên
        // module adapter `lib/billing/payos/index.ts` bị kéo xuống client.
        markers: ["PAYOS_CHECKSUM_KEY", "api-merchant.payos.vn"],
      },
      { label: "payOS API key (ADR-0013)", markers: ["PAYOS_API_KEY"] },
      { label: "payOS client id (ADR-0013)", markers: ["PAYOS_CLIENT_ID"] },
      { label: "Upstash Redis token", markers: ["KV_REST_API_TOKEN", "KV_REST_API_URL"] },
      {
        label: "Groq API key (ADR-0018)",
        // "api.groq.com" chơi đúng vai của "generativelanguage.googleapis.com"
        // ở mục AI key và "api-merchant.payos.vn" ở mục payOS: marker theo HOST
        // bắt được ca tệ hơn tên biến env — nguyên module adapter bị kéo xuống
        // client — trong khi tên biến env thì bundler có thể tree-shake mất.
        // KHÔNG dùng tên gói SDK làm marker: không có SDK (ADR-0018 Decision 5).
        markers: ["GROQ_API_KEY", "api.groq.com"],
      },
    ]);
  });

  it("mọi mục đều có trường `value` đọc từ env — nhánh quét theo GIÁ TRỊ vẫn còn nối dây", () => {
    // Nhánh giá trị chạy 0/8 lần trên CI (xem đầu file) nhưng KHÔNG chết: trên
    // máy có `.env.local` nó là lớp bắt được cả một key rò ra dưới tên khác.
    // Ghim sự tồn tại của trường, không ghim giá trị — giá trị phụ thuộc môi
    // trường và một khẳng định về nó sẽ đỏ theo máy chứ không theo mã.
    for (const secret of SECRETS) {
      expect(Object.prototype.hasOwnProperty.call(secret, "value")).toBe(true);
    }
    expect(SECRETS.length).toBe(8);
  });
});
