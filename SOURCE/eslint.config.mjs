import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Danh sách tính năng dưới features/ — thêm thư mục mới thì thêm tên vào đây,
 *  nếu không luật B4 bên dưới không bảo vệ thư mục đó. */
const FEATURES = ["admin", "analytics", "auth", "authoring", "billing", "exams", "history", "profile", "solutions"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // `.next-build` là distDir RIÊNG của bản production trên máy local
    // (next.config.ts tách prod/dev, S#36). Tên này không nằm trong danh sách
    // mặc định của eslint-config-next, nên thiếu dòng dưới thì `npm run lint`
    // đi lint luôn output đã minify: ~18.8k lỗi giả, che sạch lỗi thật của
    // source và khiến lint không dùng được ở CI.
    ".next-build/**",
    ".vercel/**",
  ]),
  // B4 (2026-09-03) — CHẶN IMPORT CHÉO GIỮA CÁC TÍNH NĂNG.
  //
  // Mỗi thư mục features/<tên>/ là một tính năng (xem ARCHITECTURE.md). Một
  // tính năng được import lib/, components/, types/ — KHÔNG được import
  // features/<tên khác>/. Trước luật này repo đã có 6 chỗ rò chéo (ReportExam
  // → authoring, 4 file profile → auth, ProfileTabs → billing); chúng được giữ
  // nguyên và đánh dấu bằng `eslint-disable-next-line` kèm lý do tại chỗ, để
  // cái đã có thì nhìn thấy được, còn cái MỚI thì đỏ ngay trong PR của người
  // viết nó. Muốn dùng chung giữa hai tính năng thì kéo phần chung xuống lib/
  // hoặc components/, không phải xin thêm một dòng disable.
  //
  // Chỉ áp cho mã production: test được mock/import chéo để dựng cây thật.
  // app/ (page/layout) KHÔNG bị chặn — page là nơi ghép các tính năng lại.
  ...FEATURES.map((name) => ({
    files: [`features/${name}/**/*.{ts,tsx}`],
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/*/**", `!@/features/${name}`, `!@/features/${name}/**`],
              message: `features/${name} không được import tính năng khác (B4). Phần dùng chung → lib/ hoặc components/; xem ARCHITECTURE.md.`,
            },
          ],
        },
      ],
    },
  })),
  // Ảnh chia sẻ link (app/opengraph-image.tsx) vẽ bằng ImageResponse/Satori, nơi `<img>`
  // là bắt buộc — không phải trang web nên `@next/next/no-img-element` không áp dụng.
  //
  // Vì sao tắt Ở ĐÂY mà không dùng `eslint-disable-next-line` trong file: chính plugin đã
  // miễn trừ file `app/opengraph-image*`, nhưng tính đường dẫn bằng
  // `filename.replace(path.sep, '/')` — chỉ đổi dấu gạch chéo ngược ĐẦU TIÊN. Trên Windows
  // miễn trừ trượt, rule vẫn báo (comment disable "có tác dụng"); trên Linux (CI) miễn trừ
  // chạy, rule im, comment thành "Unused eslint-disable directive" và `--max-warnings 0` đỏ
  // (đo 2026-10-21: CI đỏ trên main vì đúng một cảnh báo này, máy Windows thì xanh). Tắt rule
  // cho riêng file này thì cả hai hệ điều hành cùng một kết quả.
  {
    files: ["app/opengraph-image.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
]);

export default eslintConfig;
