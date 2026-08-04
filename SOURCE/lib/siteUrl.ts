// Origin công khai của site, dùng cho những chỗ BẮT BUỘC phải là URL tuyệt đối:
// `metadataBase` (Open Graph / canonical), `robots.txt`, `sitemap.xml`.
//
// KHÔNG dùng cho auth redirect — `app/(layer1)/actions.ts` cố ý lấy origin từ
// request header để cùng một build chạy đúng trên cả preview lẫn production.
// Ở đây thì ngược lại: metadata phải trỏ về domain CHÍNH THỨC, nếu không link
// chia sẻ từ một preview deploy sẽ chết khi preview đó bị xoá.
//
// Thứ tự ưu tiên:
//   1. NEXT_PUBLIC_SITE_URL — đặt tay khi đã có custom domain (vd trangnguyen.edu.vn)
//   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel tự cấp, LUÔN là domain production
//      (`ms-molar.vercel.app`) kể cả khi build đang chạy cho preview. Khác
//      VERCEL_URL — biến đó là URL băm ngẫu nhiên của từng deploy, không dùng được.
//   3. localhost:3000 — chạy dev.

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
