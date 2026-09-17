import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Làn integration, CHẠY TAY tại máy dev — cố ý tách khỏi `npm test`.
// `vitest.config.ts` chỉ thu lib/**, components/**, app/**; tests/** nằm ngoài
// glob đó vì các ca dưới tests/integration/** cần Supabase dev THẬT (Design Doc
// docs/design/subscription-backend-design.md § Implementation Approach Phase 4:
// "CI has no database"). Nếu gộp vào cổng CI thì thiếu credential sẽ làm CI đỏ
// vì môi trường chứ không phải vì lỗi code.
// Alias "@/..." giữ đúng như vitest.config.ts để hai làn phân giải module giống
// nhau; khác biệt duy nhất là test.include/test.exclude.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.{ts,tsx}"],
    // CÁCH LY (2026-09-18) — khối INT-1 nằm ngoài làn này, nhưng KHÔNG nằm
    // ngoài cây mã. Commit `a77e03d` (2026-09-03) CỐ Ý gỡ cổng
    // `consumeQuota("upload", …)` khỏi đường upload vì `GEMINI_PAID_TIER_ENABLED`
    // còn tắt và không ai mua được gì để mở khoá; 8 ca INT-1 canh đúng cái cổng
    // ấy nên chúng đỏ vì một QUYẾT ĐỊNH SẢN PHẨM, không vì một lỗi. Để nguyên
    // thì làn trả mã thoát 1 ở mọi lượt chạy và mọi hồi quy THẬT của INT-2/
    // INT-3 lẫn vào trong đó — đúng hình dạng hỏng của TD-030.
    //
    // Vì sao LIỆT KÊ ĐÍCH DANH một file chứ không đổi `include` để bỏ qua cả
    // thư mục con: cùng lối `vitest.fixture.config.ts` đã dùng, và vì một glob
    // hẹp lại sẽ NUỐT IM LẶNG mọi ca integration ai đó đặt vào thư mục con sau
    // này. Một dòng có tên file thì lượt bật lại là xoá đúng dòng đó.
    //
    // File bị loại vẫn nằm trong `**/*.ts` của `tsconfig.json`, nên
    // `npx tsc --noEmit` và `next build` vẫn soi nó: nó không mục trong im lặng.
    // Điều kiện bật lại (cổng hạn mức quay lại đường upload khi Subscription
    // ship) ghi ở header của chính file đó, và ở `TECH-DEBT.md` TD-034.
    //
    // `exclude` GHI ĐÈ danh sách mặc định của vitest (node_modules, dist…) chứ
    // không cộng thêm; ở đây vô hại vì `include` đã chốt trong tests/integration/.
    exclude: ["tests/integration/pending/subscription-quota.int.test.ts"],
  },
});
