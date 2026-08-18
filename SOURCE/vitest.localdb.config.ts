import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Làn service-integration-e2e, CHẠY TAY tại máy dev — cố ý tách khỏi `npm test`.
// `vitest.config.ts` chỉ thu lib/**, components/**, app/**; tests/e2e/service/**
// nằm ngoài glob đó vì các ca ở đây kiểm chính hành vi của Postgres THẬT
// (`greatest()`, `on conflict do update`, khoá dòng, chính sách RLS) — thứ mà
// mock Supabase client không chứng minh được. Design Doc
// docs/design/subscription-backend-design.md § Implementation Approach Phase 4:
// "CI has no database". Gộp vào cổng CI thì thiếu credential sẽ làm CI đỏ vì môi
// trường chứ không phải vì lỗi code.
//
// TIỀN ĐỀ CHẶN — đọc trước khi chạy config này:
//   Cổng schema B (`npm run verify:schema`, chạy từ SOURCE/) phải XANH TRÊN DEV
//   (plan Task 1.3) TRƯỚC KHI chạy config này, dù chỉ một lần. Chạy nó lên một
//   database chưa nhận DDL sẽ sinh ra lỗi trông y hệt lỗi cài đặt nhưng không
//   phải — đây đúng là dạng hỏng TD-005 đã lọt ba lần trong repo này. Thấy đỏ mà
//   cổng B chưa xanh trên dev: sửa database trước, đừng sửa test.
//
// Alias "@/..." giữ đúng như vitest.config.ts để các làn phân giải module giống
// nhau; khác biệt duy nhất là test.include.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/service/**/*.test.{ts,tsx}"],
  },
});
