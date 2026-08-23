// Chính sách mật khẩu dùng chung (Security review 2026-08-03, mục Low).
//
// Trước đây: signUp() KHÔNG kiểm gì cả (thả cho mặc định 6 ký tự của Supabase),
// updatePassword() tự kiểm 6 — hai đường vào, hai luật khác nhau, và luật lỏng
// hơn lại nằm ở đường phổ biến hơn. Gom về một nơi để không lệch tiếp.
//
// Theo hướng NIST SP 800-63B: ưu tiên ĐỘ DÀI, KHÔNG bắt buộc trộn chữ hoa/số/
// ký tự đặc biệt (luật trộn ký tự đẩy người dùng tới "Password1!" — dễ đoán hơn
// một cụm dài), nhưng có chặn danh sách mật khẩu phổ biến.
//
// ⚠ Chỉ áp cho mật khẩu MỚI (đăng ký / đổi mật khẩu). Tài khoản cũ đặt 6 ký tự
// vẫn đăng nhập được — không khoá cửa người đang dùng; họ sẽ bị áp luật này ở
// lần đổi mật khẩu kế tiếp.

/**
 * Tối thiểu 8 ký tự — vẫn dài hơn mặc định 6 của Supabase.
 *
 * Hạ từ 10 xuống 8 (2026-08-22, sau phản hồi người dùng "field mật khẩu khó
 * quá"): 8 CHÍNH LÀ sàn mà NIST SP 800-63B đặt ra cho mật khẩu người dùng tự
 * chọn — tức con số 10 cũ nghiêm hơn chính tiêu chuẩn mà file này viện dẫn ở
 * đầu, mà không có phân tích rủi ro nào biện minh cho phần nghiêm thêm đó.
 * Với một sản phẩm luyện đề cho học sinh phổ thông, mỗi ký tự bắt buộc thêm là
 * một phần trăm bỏ cuộc lúc đăng ký, đổi lấy một mức tăng an toàn mà
 * blocklist bên dưới vốn đã lo phần lớn.
 *
 * KHÔNG hạ xuống 6: dưới sàn NIST thì không còn chỗ dựa tiêu chuẩn nào nữa.
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Trần 72 BYTE là giới hạn thật của bcrypt (thuật toán Supabase Auth dùng):
 * quá 72 byte thì phần dư bị cắt ÂM THẦM, nên "mật khẩu 100 ký tự" thực chất
 * chỉ có 72 byte đầu có tác dụng. Chặn tường minh còn hơn để người dùng tin vào
 * một độ mạnh không có thật. Đếm theo BYTE vì tiếng Việt có dấu tốn 2–3 byte
 * mỗi ký tự trong UTF-8.
 */
export const PASSWORD_MAX_BYTES = 72;

/** Vài mẫu bị đoán ra ngay trong mọi cuộc tấn công dò mật khẩu. Cố ý ngắn —
 *  đây không phải bộ lọc đầy đủ, chỉ chặn phần đáy rõ ràng nhất. */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwertyuiop",
  "111111",
  "000000",
  "iloveyou",
  "admin",
  "welcome",
  "abc123",
  "letmein",
  "matkhau",
  "matkhau123",
]);

/**
 * Kiểm mật khẩu mới. Trả về câu lỗi (tiếng Anh, khớp giọng các message auth
 * hiện có) hoặc `null` nếu hợp lệ. Hàm THUẦN — không I/O, test được.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }

  const bytes = new TextEncoder().encode(password).length;
  if (bytes > PASSWORD_MAX_BYTES) {
    return `Password is too long (max ${PASSWORD_MAX_BYTES} bytes; accented characters count as more than one)`;
  }

  // Khoảng trắng thuần → coi như rỗng, dù có đủ độ dài.
  if (password.trim().length === 0) {
    return "Password cannot be only spaces";
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "This password is too common — please choose a different one";
  }

  return null;
}
