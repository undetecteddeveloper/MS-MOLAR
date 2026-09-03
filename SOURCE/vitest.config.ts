import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Nền test cho MS-MOLAR. Mặc định môi trường node (module thuần lib/ugc);
// test component (RichText/QuestionFigure) tự khai `// @vitest-environment jsdom`
// ở docblock đầu file. Alias "@/..." khớp tsconfig paths.
// app/**: thu các *.test.ts dưới __tests__/ trong route groups (vd (layer2)/
// __tests__/rating.int.test.ts) — trước đây chỉ lib/**+components/** được thu,
// khiến các integration test app-layer không chạy dưới `npm test` (Rating
// System backend task 4; quyết định dùng chung cho task 6/8 cùng file).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      // features/**: queries/actions/components của từng tính năng nay nằm
      // ngoài app/ (B2, 2026-09-03). Thiếu dòng này thì các test đi theo chúng
      // âm thầm ngừng chạy — cùng kiểu hỏng mà khối comment trên mô tả.
      "features/**/*.test.{ts,tsx}",
    ],
  },
});
