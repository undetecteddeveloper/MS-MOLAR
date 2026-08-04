import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
]);

export default eslintConfig;
