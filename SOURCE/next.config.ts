import type { NextConfig } from "next";
import { LIMITS } from "./lib/ugc/limits";

// ---------------------------------------------------------------------------
// Security response headers (Security review 2026-08-03, Medium #5)
//
// Trước đây không có header nào. Rủi ro chính review nêu — "XSS = chiếm tài
// khoản vì cookie session không httpOnly" — nay đã đóng ở NGUỒN
// (lib/supabase/cookieOptions.ts đặt httpOnly:true, làm được vì dự án không
// dùng Supabase client trình duyệt). CSP dưới đây là tầng phòng thủ THỨ HAI.
//
// ⚠ `script-src` cố ý CÓ 'unsafe-inline'. Next.js chèn script inline để hydrate
// (flight data); chặn nó mà không có nonce là trang trắng. Làm nonce đúng cách
// cần proxy.ts sinh nonce mỗi request và Next đọc lại — chưa làm, ghi ở
// docs/TECH-DEBT.md. Nghĩa là CSP này KHÔNG chặn được inline-XSS; giá trị thật
// của nó nằm ở các directive còn lại:
//   - script-src 'self'  → không nạp được script từ domain lạ (kênh exfil phổ biến nhất)
//   - frame-ancestors    → chống clickjacking (thay X-Frame-Options, mạnh hơn)
//   - base-uri 'self'    → chặn <base> hijack đổi đích mọi URL tương đối
//   - form-action 'self' → chặn form bị bẻ hướng POST ra ngoài
//   - object-src 'none'  → chặn plugin/Flash-style embed
// ---------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === "production";

// Ảnh đề nằm ở Supabase Storage (signed URL) → img-src phải cho phép origin đó.
// Lấy từ env thay vì hard-code để không lệch khi đổi project.
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' chỉ ở dev: Turbopack/HMR cần. Production thì không.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  // Tailwind + KaTeX sinh style inline; next/font nhúng @font-face inline.
  "style-src 'self' 'unsafe-inline'",
  // data: cho ảnh nhúng của html2canvas; blob: cho PDF (jspdf) tạo ở client.
  `img-src 'self' data: blob:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // CỐ Ý KHÔNG có `upgrade-insecure-requests`: nó ép mọi request http → https,
  // kể cả khi chạy `next start` ở localhost (NODE_ENV=production nhưng phục vụ
  // qua http) → ERR_SSL_PROTOCOL_ERROR, không test được bản production tại máy.
  // Đổi lại gần như không mất gì: HSTS bên dưới đã ép https ở mức domain thật,
  // và img-src/connect-src vốn chỉ cho phép 'self' + origin Supabase (https),
  // nên không còn đường nào sinh mixed content.
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
