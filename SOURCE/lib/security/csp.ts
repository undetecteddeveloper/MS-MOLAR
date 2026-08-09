// Content-Security-Policy — MỘT nguồn chân lý cho cả `next.config.ts` (header
// tĩnh) lẫn `proxy.ts` (header có nonce, sinh mỗi request). TECH-DEBT TD-006.
//
// Trước 2026-08-04, `script-src` phải giữ `'unsafe-inline'` vì Next.js chèn
// script inline để hydrate; chặn mà không có nonce là trang trắng. Nghĩa là CSP
// KHÔNG chặn được inline-XSS — nó chỉ chặn script từ domain lạ, clickjacking,
// `<base>` hijack, form bẻ hướng và plugin embed.
//
// Nay proxy.ts sinh nonce mỗi request và đặt nó vào CSP của REQUEST; Next đọc
// header đó, rút nonce ra và gắn vào mọi thẻ script của nó. Nhờ vậy
// `'unsafe-inline'` bỏ được ở production mà trang vẫn hydrate.
//
// Vì sao KHÔNG dùng `'strict-dynamic'` (dù tài liệu Next có nhắc): với
// `'strict-dynamic'`, `'self'` bị trình duyệt BỎ QUA, nên mọi thẻ `<script src>`
// không do một script đã tin cậy chèn ra sẽ chết. Đổi lại gần như không được gì
// ở dự án này — không có script bên thứ ba nào, mọi chunk đều từ 'self'.
// `'self' 'nonce-…'` đã đóng đúng lỗ hổng cần đóng (inline không nonce = chặn)
// với ít bề mặt vỡ hơn hẳn.
//
// Vì sao dev vẫn `'unsafe-inline'`: Turbopack/HMR chèn script inline của RIÊNG
// nó, không đi qua đường gắn nonce của Next → bật nonce ở dev là tự làm hỏng
// `next dev`. Giá trị bảo mật của CSP nằm ở production; dev không phục vụ ai.

export interface CspOptions {
  /**
   * Nonce cho lượt request này, hoặc `null` để lấy chính sách NỀN
   * (`'unsafe-inline'`). Nền dùng cho những path proxy.ts không chạy qua —
   * `_next/static`, ảnh, `robots.txt`… — nơi không có script inline nào để bảo
   * vệ, và là lưới an toàn nếu middleware vì lý do nào đó không chạy.
   */
  nonce: string | null;
  isProd: boolean;
  /** Origin Supabase (ảnh đề dùng signed URL). Rỗng nếu env chưa đặt. */
  supabaseOrigin: string;
}

export function buildCsp({ nonce, isProd, supabaseOrigin }: CspOptions): string {
  // Nonce CHỈ có nghĩa ở production (xem docblock). Ở dev luôn quay về
  // 'unsafe-inline' kể cả khi caller đưa nonce vào.
  const scriptSrc =
    isProd && nonce
      ? `script-src 'self' 'nonce-${nonce}'`
      : `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`;

  return [
    "default-src 'self'",
    scriptSrc,
    // Tailwind + KaTeX sinh style inline; next/font nhúng @font-face inline.
    // CỐ Ý không gắn nonce: style-src có nonce sẽ chặn thuộc tính `style=` do
    // React đặt runtime (transition của SuccessToast, ExamTimer…), mà XSS qua
    // CSS lại không phải rủi ro dự án này có — RichText đã sanitize, và
    // `dangerouslySetInnerHTML` duy nhất trong repo (khối JSON-LD ở
    // `app/page.tsx`) chỉ nhận hằng số đã escape, không nhận dữ liệu người dùng.
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
    // Đổi lại gần như không mất gì: HSTS đã ép https ở mức domain thật, và
    // img-src/connect-src vốn chỉ cho phép 'self' + origin Supabase (https),
    // nên không còn đường nào sinh mixed content.
  ].join("; ");
}

/** Origin của Supabase từ env. Lấy từ env thay vì hard-code để không lệch khi
 *  đổi project; URL hỏng → chuỗi rỗng (và `checkEnv` sẽ kêu lúc khởi động). */
export function supabaseOriginFromEnv(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

/** Nonce ngẫu nhiên 128-bit, base64. Dùng Web Crypto vì proxy.ts chạy ở Edge
 *  runtime — không có `node:crypto` ở đó. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
