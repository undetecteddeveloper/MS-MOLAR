// Mã xác minh email khi đăng ký — phần THUẦN (không I/O) dùng chung cho
// Server Action (features/auth/actions.ts) và view nhập mã (VerifyCodeForm).
//
// Mã là OTP của Supabase (`verifyOtp({ type: "signup" })`). Độ dài do cấu hình
// Auth của từng project quyết định (mặc định 8, dev đang để 6), nên ta KHÔNG
// ghim đúng 6: chấp nhận 6–10 chữ số để đổi cấu hình không làm vỡ trang này.

export const VERIFY_CODE_MIN_LENGTH = 6;
export const VERIFY_CODE_MAX_LENGTH = 10;

/** Giây phải chờ giữa hai lần bấm "Gửi lại mã" (đếm ngược ở client). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Bỏ khoảng trắng/gạch ngang người dùng dán kèm ("123 456", "123-456"). */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${VERIFY_CODE_MIN_LENGTH},${VERIFY_CODE_MAX_LENGTH}}$`).test(code);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Khoá bảng nhãn (`lib/copy.ts`) cho lỗi của view nhập mã — action trả khoá, không trả câu. */
export type VerifyErrorKey = "auth.verify.error.invalid" | "auth.verify.error.generic";

/**
 * Ánh xạ lỗi của Supabase về khoá cố định, KHÔNG để `error.message` chảy ra
 * client (cùng luật với changePassword: câu của provider là tiếng Anh và có thể
 * là oracle). Supabase trả `otp_expired` cho CẢ mã sai lẫn mã hết hạn nên không
 * thể tách hai trường hợp: mọi lỗi 4xx dùng chung câu "sai hoặc hết hạn"; chỉ
 * lỗi mạng/máy chủ (5xx, không có status) mới là `generic`.
 */
export function mapVerifyError(error: { status?: number }): VerifyErrorKey {
  const status = error.status ?? 0;
  // 429 (Supabase tự giới hạn tần suất) KHÔNG phải mã sai: nói "mã sai" cho người
  // đang bị chặn là đẩy họ gõ lại thêm và tự kéo dài thời gian chặn.
  return status >= 400 && status < 500 && status !== 429
    ? "auth.verify.error.invalid"
    : "auth.verify.error.generic";
}
