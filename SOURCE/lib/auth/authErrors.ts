// Lỗi của Supabase Auth → khoá bảng nhãn (`lib/copy.ts`), cho các action của
// thẻ đăng nhập/đăng ký/đặt lại mật khẩu (features/auth/actions.ts).
//
// Trước đây các action trả thẳng `error.message` của Supabase: tiếng Anh giữa
// trang tiếng Việt (vd "Error sending confirmation email" hiện ra ở form Đăng
// ký), và trên đường đăng nhập/đặt mật khẩu thì chính câu chữ ấy là một oracle.
// Nay mọi lỗi của provider đi qua ĐÂY và ra một khoá cố định; câu của provider
// không bao giờ lên client. Hàm THUẦN — không I/O, test được.

export type AuthErrorKey =
  | "auth.error.invalidCredentials"
  | "auth.error.emailNotConfirmed"
  | "auth.error.rateLimited"
  | "auth.error.sendFailed"
  | "auth.error.weakPassword"
  | "auth.error.generic";

/** Hình dạng tối thiểu của AuthError (supabase-js): `code` có thể vắng ở bản cũ. */
export type ProviderAuthError = { code?: string; status?: number; message?: string };

export function mapAuthError(error: ProviderAuthError): AuthErrorKey {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "auth.error.invalidCredentials";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "auth.error.emailNotConfirmed";
  }
  if (
    error.status === 429 ||
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  ) {
    return "auth.error.rateLimited";
  }
  // `unexpected_failure` kèm câu "Error sending … email" là lỗi SMTP của project,
  // không phải lỗi của người dùng: nói thẳng là thư chưa gửi được.
  if (/error sending .* email/i.test(message)) {
    return "auth.error.sendFailed";
  }
  if (code === "weak_password") {
    return "auth.error.weakPassword";
  }
  return "auth.error.generic";
}
