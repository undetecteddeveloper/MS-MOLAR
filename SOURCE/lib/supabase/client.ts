// Supabase browser client — ĐÃ VÔ HIỆU HOÁ CÓ CHỦ ĐÍCH (2026-08-03).
//
// Từ Security review Medium #5, cookie session được đặt `httpOnly: true`
// (lib/supabase/cookieOptions.ts) để một lỗi XSS không đọc được session.
// Hệ quả trực tiếp: JavaScript phía trình duyệt KHÔNG còn đọc được cookie đó,
// nên createBrowserClient() sẽ không bao giờ thấy phiên đăng nhập.
//
// Nếu để hàm này chạy như cũ, nó vẫn trả về một client "hợp lệ" nhưng CHƯA ĐĂNG
// NHẬP: mọi query đi qua RLS sẽ trả về 0 dòng, không lỗi, không cảnh báo — một
// cái bẫy im lặng tốn hàng giờ để lần ra. Thà hỏng to và nói rõ lý do.
//
// Khi viết dòng này, KHÔNG file nào trong dự án import file này (đã grep toàn
// repo) — mọi truy cập Supabase đều qua Server Component / Server Action /
// route handler, và toàn bộ auth là PKCE `?code=` xử lý ở server
// (app/auth/callback/route.ts), kể cả link email reset mật khẩu.
//
// MUỐN DÙNG LẠI (realtime, optimistic UI): phải quyết định CÓ Ý THỨC việc hạ
// httpOnly xuống false trong cookieOptions.ts, và chấp nhận rằng khi đó một lỗi
// XSS = chiếm tài khoản. Đọc ghi chú trong file đó trước khi đổi.

/** @deprecated Không dùng được khi cookie session là httpOnly — xem đầu file. */
export function createClient(): never {
  throw new Error(
    "lib/supabase/client.ts: Supabase browser client đã bị vô hiệu hoá — cookie " +
      "session là httpOnly nên client trình duyệt không thấy phiên đăng nhập. " +
      "Dùng lib/supabase/server.ts trong Server Component/Server Action. " +
      "Xem ghi chú đầu file nếu thực sự cần client trình duyệt."
  );
}
