import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Làn integration, CHẠY TAY tại máy dev — cố ý tách khỏi `npm test`.
// `vitest.config.ts` chỉ thu lib/**, components/**, app/**; tests/** nằm ngoài
// glob đó vì các ca dưới tests/integration/** cần Supabase dev THẬT (Design Doc
// docs/design/subscription-backend-design.md § Implementation Approach Phase 4:
// "CI has no database"). Nếu gộp vào cổng CI thì thiếu credential sẽ làm CI đỏ
// vì môi trường chứ không phải vì lỗi code.
// Alias "@/..." giữ đúng như vitest.config.ts để hai làn phân giải module giống
// nhau; khác biệt duy nhất là test.include.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.{ts,tsx}"],
  },
});
