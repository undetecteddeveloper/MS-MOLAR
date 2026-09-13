// Phiên KHÔI PHỤC MẬT KHẨU — cờ "đang đặt lại", đọc ở ba nơi (2026-09-13).
//
// Lỗi engineer đo trên điện thoại thật: bấm link "quên mật khẩu" trong email
// là vào được tài khoản ngay, chưa cần đặt mật khẩu mới. Nguyên nhân nằm ở
// kiến trúc chứ không ở một dòng sai: /auth/callback là điểm về CHUNG của mọi
// flow PKCE, và `exchangeCodeForSession` cho mã khôi phục một phiên y hệt phiên
// đăng nhập Google. Thứ duy nhất dẫn người dùng tới màn đặt lại là tham số
// `next` — một gợi ý điều hướng, không phải một ràng buộc; Supabase không có
// khái niệm "phiên chỉ được đổi mật khẩu".
//
// Cách chữa: ứng dụng tự đánh dấu. /auth/callback GẮN cookie này khi mã vừa
// đổi là mã khôi phục; middleware thấy cookie + có phiên thì ép MỌI đường về
// /reset-password; `updatePassword` thành công (hoặc `signOut`) GỠ cookie.
// Cookie là httpOnly như cookie phiên (SESSION_COOKIE_OPTIONS) — JS trình duyệt
// không cần đọc nó, nên cũng không được đọc.
//
// File này THUẦN (không import next/headers): middleware chạy trong sandbox
// riêng và chỉ dùng được hằng số + hàm thuần từ đây.

export const RECOVERY_COOKIE = "ms-molar-recovery";

/** Cờ sống tối đa một ngày. Không phải cookie phiên trình duyệt: đóng trình
 *  duyệt rồi mở lại mà cờ mất thì phiên khôi phục (vẫn còn nhờ refresh token)
 *  lại thành phiên đầy đủ — đúng lỗ hổng đang vá. Một ngày là đủ dài cho mọi
 *  lượt đặt lại thật và đủ ngắn để một link bị bỏ dở không khoá ai vĩnh viễn;
 *  Đăng xuất gỡ cờ ngay nếu người dùng muốn thoát sớm. */
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

export const RECOVERY_PATH = "/reset-password";

/** Những path một phiên đang khôi phục ĐƯỢC tới. Mọi path khác (kể cả trang
 *  chủ và các trang public) middleware ép về RECOVERY_PATH: người này đang ở
 *  giữa một việc, và trang chủ hiện họ như đã đăng nhập là mở lại đúng cửa
 *  vừa đóng. `/auth/callback` giữ để một link khôi phục thứ hai (gửi lại
 *  email) vẫn đổi được mã. */
export const RECOVERY_ALLOWED_PATHS = [RECOVERY_PATH, "/auth/callback"] as const;

export function isRecoveryAllowedPath(pathname: string): boolean {
  return RECOVERY_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Access token vừa đổi có phải của một lượt KHÔI PHỤC không — đọc claim `amr`
 * (Authentication Methods Reference) mà GoTrue ghi vào JWT: lượt đi từ link
 * "quên mật khẩu" mang `{ method: "recovery" }`.
 *
 * KHÔNG xác thực chữ ký, và đó là cố ý: token này vừa do chính Supabase trả về
 * trong `exchangeCodeForSession`, ta chỉ đọc để PHÂN LOẠI, không để tin một
 * danh tính. Đây là lớp thứ hai sau tham số `next` của chính link email: một
 * link bị sửa `next=/exams` vẫn đổi được mã, nhưng token của nó vẫn nói "đây
 * là khôi phục" và cờ vẫn được gắn. Token lạ/hỏng → `false` (không phải khôi
 * phục), không ném.
 */
export function isRecoveryAccessToken(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;
  const parts = accessToken.split(".");
  if (parts.length < 2) return false;
  try {
    const payload: unknown = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload || typeof payload !== "object") return false;
    const amr = (payload as { amr?: unknown }).amr;
    if (!Array.isArray(amr)) return false;
    return amr.some(
      (entry) =>
        !!entry &&
        typeof entry === "object" &&
        (entry as { method?: unknown }).method === "recovery"
    );
  } catch {
    return false;
  }
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  // `atob` có ở Node ≥ 16 lẫn mọi trình duyệt; giải mã UTF-8 tường minh vì
  // `atob` trả chuỗi byte, không phải chuỗi ký tự.
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
