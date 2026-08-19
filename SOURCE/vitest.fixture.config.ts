import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Làn fixture-e2e — journey duyệt trên CÂY ROUTE THẬT của Next, dựng trong
// tiến trình. `vitest.config.ts` chỉ thu lib/**, components/**, app/**; các ca
// dưới tests/e2e/fixture/** nằm ngoài glob đó nên trước file này KHÔNG CÓ CẤU
// HÌNH NÀO thu chúng — FE-2 chưa từng chạy trong một làn đã commit.
//
// KHÁC HẲN hai làn kia, và đây là chỗ cần đọc kỹ: `vitest.integration.config.ts`
// và `vitest.localdb.config.ts` tách khỏi CI vì chúng cần Supabase dev THẬT
// ("CI has no database"), thiếu credential thì CI đỏ vì môi trường chứ không
// phải vì lỗi code. Làn này KHÔNG cần database, KHÔNG cần credential và KHÔNG
// chạm mạng: action module bị stub, hai nguồn dữ liệu của server component bị
// stub, còn layout + EntitlementProvider + page + từ điển + bộ format chạy
// thật. Nên nó AN TOÀN để vào cổng CI, và lý do nó chưa nằm trong `npm test` là
// LÝ DO CƠ HỌC, không phải nguyên tắc:
//
//   Sáu file `*.fixture.e2e.test.ts` còn lại trong thư mục này (history, rating,
//   short-answer-scoring, ba file support-*) là DRIVER SCRIPT viết theo tập con
//   cấu trúc của Playwright — chúng export hàm check, không có `test()` nào, vì
//   repo không có `@playwright/test` lẫn `playwright.config.ts`. Thu nguyên thư
//   mục thì vitest báo "No test suite found in file" cho đúng sáu file đó và
//   thoát 1 (đã đo). Gộp thẳng vào `npm test` vì thế sẽ làm cổng CI đỏ vì hình
//   dạng file, không phải vì mã hỏng.
//
// Vì vậy: glob theo THƯ MỤC (một ca fixture-e2e mới được thu tự động, không cần
// sửa file này) kèm `exclude` LIỆT KÊ ĐÍCH DANH sáu script đó. Khi một file
// trong danh sách dưới có `test()` thật, xoá đúng một dòng là nó vào làn. Khi
// danh sách rỗng, làn này gộp được vào `npm test`.
//
// `exclude` GHI ĐÈ danh sách mặc định của vitest (node_modules, dist…) chứ không
// cộng thêm; ở đây vô hại vì `include` đã chốt trong tests/e2e/fixture/.
//
// Alias "@/..." giữ đúng như vitest.config.ts để các làn phân giải module giống
// nhau; khác biệt duy nhất là test.include/test.exclude.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/e2e/fixture/**/*.test.{ts,tsx}"],
    exclude: [
      "tests/e2e/fixture/history.fixture.e2e.test.ts",
      "tests/e2e/fixture/rating.fixture.e2e.test.ts",
      "tests/e2e/fixture/short-answer-scoring.fixture.e2e.test.ts",
      "tests/e2e/fixture/support-admin-triage.fixture.e2e.test.ts",
      "tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts",
      "tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts",
    ],
  },
});
