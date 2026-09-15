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
    // TẮT bộ nhớ đệm hệ thống tệp của Turbopack cho `next build` — gốc của
    // TD-024 ("HTML mới, CSS cũ" trên production).
    //
    // Next 16.3.0 bật mặc định cờ này (node_modules/next/dist/docs/01-app/
    // 03-api-reference/05-config/01-next-config-js/turbopackFileSystemCache.md,
    // bảng Version History: "v16.3.0 — FileSystem caching is enabled by default
    // for builds"). Cache nằm ở `.next/cache/turbopack`, và Vercel KHÔI PHỤC
    // `.next/cache` trước mỗi lượt build — nên kết quả biên dịch của lượt trước
    // được mang sang lượt sau. package-lock đã khoá next 16.3.0 từ 2026-08-07,
    // trước cả lần đầu TD-024.
    //
    // Bốn lần production phục vụ CSS của commit trước (2026-08-17, 09-10, 09-11,
    // 09-14). Log build lần 09-11 mở đầu bằng "Restored build cache from previous
    // deployment" và biên dịch xong trong 3,8 giây (cục bộ ~20 giây). Cách chữa
    // cũ — sửa thật nội dung globals.css cho cache hết thứ tái dùng — hết tác
    // dụng ở lần 09-14: ~300 dòng CSS đổi mà bundle vẫn là bảng màu cũ. Tức không
    // thể dựa vào việc đổi nội dung để né cache.
    //
    // Vì sao tắt Ở ĐÂY chứ không bằng biến môi trường VERCEL_FORCE_NO_BUILD_CACHE
    // (dùng tạm 2026-09-14): cờ nằm trong repo — có lịch sử, có lý do, ai mở cấu
    // hình cũng thấy — và chỉ tắt đúng phần gây lỗi. Biến môi trường tắt TOÀN BỘ
    // cache build của Vercel (cả cache npm vô hại), lại sống ngoài repo, nên một
    // lượt dọn cài đặt project có thể gỡ nó mà không biết mình vừa mở lại con bọ.
    //
    // Chi phí: build trên Vercel không còn "ấm", biên dịch lại từ đầu mỗi lượt.
    // Đổi lấy việc CSS trên production luôn là CSS của đúng commit đã deploy.
    // `turbopackFileSystemCacheForDev` giữ mặc định: nó chỉ phục vụ dev server
    // trên máy, không có gì từ đó lên production.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
