import type { NextConfig } from "next";
import { LIMITS } from "./lib/ugc/limits";
import { buildCsp, supabaseOriginFromEnv } from "./lib/security/csp";

// ---------------------------------------------------------------------------
// Security response headers (Security review 2026-08-03, Medium #5)
//
// Trước đây không có header nào. Rủi ro chính review nêu — "XSS = chiếm tài
// khoản vì cookie session không httpOnly" — nay đã đóng ở NGUỒN
// (lib/supabase/cookieOptions.ts đặt httpOnly:true, làm được vì dự án không
// dùng Supabase client trình duyệt). CSP dưới đây là tầng phòng thủ THỨ HAI.
//
// CSP ở ĐÂY là chính sách NỀN, có `'unsafe-inline'`. Chính sách THẬT của mọi
// trang HTML do `proxy.ts` đặt đè, kèm nonce sinh riêng từng request (TD-006 đã
// trả 2026-08-04) — xem lib/security/csp.ts. Nền này chỉ còn hiệu lực ở những
// path proxy.ts không chạy qua (`_next/static`, ảnh, `robots.txt`, …), nơi
// không có script inline nào để bảo vệ. Giữ nó lại thay vì xoá vì nó là lưới
// an toàn: middleware không chạy → trang vẫn có CSP, chỉ là bản yếu hơn, chứ
// KHÔNG phải trang trắng.
//
// Các directive còn lại (đúng ở cả hai chính sách):
//   - script-src 'self'  → không nạp được script từ domain lạ (kênh exfil phổ biến nhất)
//   - frame-ancestors    → chống clickjacking (thay X-Frame-Options, mạnh hơn)
//   - base-uri 'self'    → chặn <base> hijack đổi đích mọi URL tương đối
//   - form-action 'self' → chặn form bị bẻ hướng POST ra ngoài
//   - object-src 'none'  → chặn plugin/Flash-style embed
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildCsp({ nonce: null, isProd, supabaseOrigin: supabaseOriginFromEnv() }),
  },
  // Legacy, cho trình duyệt chưa hiểu frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // HSTS chỉ có nghĩa trên https; đặt ở dev (http://localhost) là vô ích và có
  // thể làm kẹt trình duyệt nếu sau này chạy http trên cùng host.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Tách output prod/dev (S#36): `next build` (NODE_ENV=production) ghi vào
  // `.next-build`, `next dev` giữ `.next`. Trước đây build production đè lên
  // `.next` của dev server → trạng thái trộn lẫn từng làm dev server chết /
  // lỗi manifest (gotcha đã ghi trong PROCESS). `next start` cũng chạy với
  // NODE_ENV=production nên đọc đúng `.next-build`.
  //
  // TRỪ trên Vercel: ở đó không có dev server nào để tránh đè, nên lý do tách
  // biến mất — trong khi build cache của Vercel lại gắn cứng với `.next/cache`.
  // Giữ `.next-build` trên Vercel = mất cache mỗi lần deploy (build chậm hơn)
  // đổi lấy con số không. `VERCEL` là env var Vercel luôn đặt sẵn.
  distDir:
    process.env.NODE_ENV === "production" && !process.env.VERCEL
      ? ".next-build"
      : ".next",
  // mupdf (WASM) + sharp (native) KHÔNG được để Turbopack bundle vào server
  // build — phải require ở runtime, nếu không file .wasm/.node không nạp được
  // (mupdf.Document.openDocument throw → "the PDF could not be read").
  serverExternalPackages: ["mupdf", "sharp"],
  // UGC upload (extractAndAssemble) gửi 2 file × LIMITS.MAX_FILE_BYTES qua
  // Server Action — mặc định Next.js chỉ cho 1MB/request.
  //
  // Security review 2026-08-03 (Low): trần này là TOÀN CỤC — mọi Server Action
  // đều nhận được ngần này, kể cả rateExam/signIn vốn chỉ cần vài trăm byte,
  // nên nó khuếch đại DoS. Next không cho đặt trần theo từng action, nên chỉ
  // siết được về đúng nhu cầu thật thay vì con số 35mb chọn tay:
  //   2 file × 15MB + 2MB dự phòng cho multipart boundary/field khác.
  // Phòng thủ thật cho DoS là rate limit (lib/security/rateLimit.ts), không
  // phải con số này. Tính từ LIMITS để đổi MAX_FILE_BYTES là trần tự theo,
  // không lệch âm thầm.
  experimental: {
    serverActions: {
      bodySizeLimit: `${Math.ceil((2 * LIMITS.MAX_FILE_BYTES) / (1024 * 1024)) + 2}mb`,
    },
  },
};

export default nextConfig;
