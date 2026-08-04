// Cổng quản trị (Security review 2026-08-03, Medium #7).
//
// ADR-0001 chốt KHÔNG có admin trong database. Bản vá này tôn trọng điều đó:
// quyền quản trị KHÔNG phải một cột/role trong Postgres mà là một danh sách
// user id trong biến môi trường phía server.
//
// Vì sao allowlist env chứ không phải mật khẩu chung cho trang /admin:
//   - Không sinh thêm bí mật để rò rỉ. Mật khẩu chung sẽ nằm trong password
//     manager, trong chat, trong ảnh chụp màn hình.
//   - Tái dùng nguyên đăng nhập Supabase đang có: cùng luồng email/OAuth, cùng
//     cookie httpOnly, cùng khả năng bật MFA sau này. Mật khẩu chung thì không
//     có gì trong số đó, và không biết AI đã bấm gỡ.
//   - Thu hồi = xoá id khỏi env rồi redeploy; không phải đổi mật khẩu cho cả đội.
//
// ⚠ Đây chỉ là bước KIỂM TRA AI. Việc GHI thực tế phải đi qua service_role
// (lib/supabase/service-role.ts) vì RLS không cho ai sửa đề của người khác.
import "server-only";

/** Đọc allowlist từ env. Rỗng/không đặt → KHÔNG ai là admin (fail-closed:
 *  quên cấu hình thì trang admin trơ ra, chứ không mở cho tất cả). */
function adminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** userId có nằm trong allowlist không. `null`/rỗng luôn là false. */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return adminIds().has(userId);
}

/** Có cấu hình admin nào chưa — để trang admin phân biệt "bạn không phải admin"
 *  với "chưa ai cấu hình ADMIN_USER_IDS", hai tình huống cần xử lý khác nhau. */
export function hasAdminsConfigured(): boolean {
  return adminIds().size > 0;
}
