// Tuỳ chọn cookie session dùng CHUNG cho mọi Supabase server client
// (Security review 2026-08-03, Medium #5).
//
// @supabase/ssr mặc định đặt `httpOnly: false` (xem
// node_modules/@supabase/ssr/dist/main/utils/constants.js) vì thư viện phải
// phục vụ cả `createBrowserClient` — client trình duyệt cần ĐỌC ĐƯỢC cookie
// bằng JavaScript. Hệ quả: một lỗi XSS duy nhất là đọc được cookie session và
// chiếm luôn tài khoản.
//
// Dự án này KHÔNG dùng client trình duyệt: mọi truy cập Supabase đều qua Server
// Component / Server Action / route handler, và toàn bộ luồng auth là PKCE
// `?code=` xử lý ở server (app/auth/callback/route.ts) — kể cả link email reset
// mật khẩu. Đã kiểm: không file nào import lib/supabase/client.ts.
//
// ⇒ Không có gì trong trình duyệt cần đọc cookie này ⇒ bật httpOnly được.
// Đây là tầng bảo vệ MẠNH HƠN CSP cho đúng rủi ro mà review nêu: CSP cố ngăn
// XSS xảy ra, httpOnly làm cho XSS (nếu vẫn xảy ra) không lấy được session.
//
// ⚠ Nếu sau này thực sự cần createBrowserClient (realtime, optimistic UI), phải
// quay lại cân nhắc chỗ này một cách CÓ Ý THỨC — bật lại httpOnly:false là đổi
// mô hình rủi ro của toàn bộ hệ thống, không phải một dòng config.
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  // localhost chạy http://, cookie `secure` sẽ KHÔNG được set → dev gãy đăng
  // nhập. Chỉ bật ở production (luôn https).
  secure: process.env.NODE_ENV === "production",
};
