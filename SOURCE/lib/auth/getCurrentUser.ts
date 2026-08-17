// Logic Layer 1 — getCurrentUser helper (GĐ 2 M2.4).
// Dùng trong Server Component để biết user hiện tại. Xem BACK-END map Mục 3.2 & 8.1.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  AVATARS_BUCKET,
  AVATAR_SIGNED_URL_TTL_SECONDS,
} from "@/lib/profile/avatarStorage";

/** Trả về user đang đăng nhập (từ cookie session), hoặc null nếu chưa đăng nhập. */
export async function getCurrentUser() {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    // Backend Supabase không kết nối được (project paused/deleted, hoặc mạng) →
    // coi như chưa đăng nhập thay vì để AuthRetryableFetchError crash trang.
    console.warn("[getCurrentUser] Supabase auth không kết nối được:", err);
    return null;
  }
}

export type CurrentUserProfile = {
  id: string;
  email: string;
  displayName: string;
  /** SIGNED URL đã ký sẵn, KHÔNG phải path lưu trong DB — chỗ gọi chỉ việc đưa
   *  vào <img>, không cần biết Storage tồn tại. `null` = không có ảnh HOẶC ký
   *  hỏng; cả hai đều render initials, nên chỗ gọi không cần phân biệt
   *  (ADR-0016, PRD AC-033b). */
  avatarUrl: string | null;
};

/** Giống getCurrentUser() nhưng kèm display_name từ user_profiles — dùng cho
 * navbar (HeaderProfile/SidebarProfile) hiển thị tên + biết trạng thái đăng nhập. */
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();

    // Trước đây lỗi ở đây bị vứt đi, và điều đó vô hại chừng nào truy vấn chỉ
    // đọc `display_name` — cột đã tồn tại từ lâu. Từ khi thêm `avatar_url` thì
    // KHÔNG còn vô hại: schema.sql được apply bằng TAY (TD-005, không có
    // migration tool), nên có một cửa sổ giữa lúc code lên production và lúc
    // DDL được chạy, trong đó truy vấn này hỏng vì thiếu cột. Hệ quả: profile
    // = null → tên hiển thị tụt về email của chính người dùng trên navbar,
    // sidebar và /profile — sai ở TOÀN SITE mà không một dòng log nào.
    // Chỉ log MÃ lỗi PostgREST, không log `profile` (dữ liệu người dùng).
    if (profileError) {
      console.warn("[getCurrentUserProfile] đọc user_profiles hỏng:", profileError.code);
    }

    return {
      id: user.id,
      email: user.email ?? "",
      displayName: profile?.display_name || user.email || "Người dùng",
      avatarUrl: await resolveAvatarUrl(supabase, profile?.avatar_url),
    };
  } catch (err) {
    console.warn(
      "[getCurrentUserProfile] Supabase auth không kết nối được:",
      err,
    );
    return null;
  }
}

/**
 * Path object trong bucket private `avatars` → signed URL cho <img>.
 *
 * FAIL CLOSED về `null` ở MỌI nhánh hỏng — không ném, không trả path thô (path
 * thô đặt vào <img> là một ảnh vỡ, và ảnh vỡ là thứ AC-033b cấm). Cùng hình
 * dạng với resolveSignedImageUrl (lib/ugc/imageUrl.ts:26-37), chỉ khác là ở đây
 * DB lưu sẵn path nên không phải bóc từ URL.
 *
 * ⚠ Hàm này nằm trên đường nóng: getCurrentUserProfile() được gọi bởi 6 layout
 * route-group + app/page.tsx, tức gần như mọi lần render trang đã đăng nhập.
 * ADR-0016 chấp nhận chi phí đó CÓ ĐIỀU KIỆN — phải đo trước khi coi là xong, và
 * nếu nó kéo lùi đường header thì lối thoát là Option C (ảnh chỉ hiện ở /profile),
 * KHÔNG BAO GIỜ là mở public bucket.
 */
async function resolveAvatarUrl(
  supabase: SupabaseClient,
  storedPath: string | null | undefined,
): Promise<string | null> {
  if (!storedPath) return null;
  try {
    const { data } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrl(storedPath, AVATAR_SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  } catch {
    // Bắt TẠI ĐÂY chứ không để rơi ra try/catch của hàm gọi: ở ngoài đó, một cú
    // ném từ Storage sẽ làm getCurrentUserProfile() trả null, tức MỌI trang đã
    // đăng nhập render như thể người dùng vừa bị đăng xuất — vì một cái ảnh.
    // Hỏng ở đây chỉ được phép mất cái ảnh (AC-033b).
    return null;
  }
}
