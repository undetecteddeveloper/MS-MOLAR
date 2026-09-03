// Logic Layer 1 — Auth Server Actions (GĐ 2 M2.4; S#23 hoàn thiện auth module:
// signup hardening + OAuth Google/Facebook + password reset).
// Xem BACK-END-ARCHITECTURE-MAP.md Mục 3.2 & 9.1.
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/passwordPolicy";
import { guard } from "@/lib/security/rateLimit";
import { AVATARS_BUCKET } from "@/lib/profile/avatarStorage";
import { extensionForMime } from "@/lib/profile/imageExtension";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_RE } from "@/lib/profile/displayName";
import { checkAvatarFile } from "@/lib/profile/validateAvatar";

// `info` (S#23): message trung tính không phải lỗi — vd "check your email".
export type AuthState = { error?: string; info?: string } | null;

/** Origin của request hiện tại — làm base cho redirectTo (OAuth + email link). */
async function requestOrigin(): Promise<string> {
  return (await headers()).get("origin") ?? "http://localhost:3000";
}

/** Đăng ký email/password. user_profiles row được tạo tự động qua DB trigger (schema.sql). */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");

  // Trước đây signUp KHÔNG kiểm gì, thả cho mặc định 6 ký tự của Supabase —
  // lỏng hơn cả updatePassword (Security review 2026-08-03, Low). Nay cả hai
  // dùng chung lib/auth/passwordPolicy.
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email } },
  });

  if (error) return { error: error.message };

  // Project bật "Confirm email" → chưa có session ngay sau signUp: user phải
  // bấm link xác nhận trong mail trước. KHÔNG redirect /exams (middleware sẽ
  // bounce ngược vì chưa auth) — hiện hướng dẫn tại chỗ.
  if (!data.session) {
    return {
      info: "Account created. Check your email to confirm your address, then sign in.",
    };
  }

  redirect("/exams");
}

/**
 * Đăng nhập/đăng ký bằng OAuth (Google | Facebook) — S#23.
 * Provider đọc từ formData (1 form chung, button name="provider").
 * Flow PKCE: Supabase trả URL consent của provider → redirect user sang đó;
 * provider gọi về Supabase → Supabase gọi về /auth/callback?code=... của app
 * (route handler đổi code lấy session). Code verifier nằm trong cookie do
 * @supabase/ssr tự quản lý.
 * ⚠️ Chỉ hoạt động khi engineer đã bật provider + dán credentials trong
 * Supabase Dashboard (xem `docs/DEPLOYMENT.md` § 3.2 OAuth providers).
 */
export async function signInWithOAuth(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const provider =
    formData.get("provider") === "facebook" ? "facebook" : "google";

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=/exams` },
  });

  if (error || !data.url) {
    return { error: error?.message ?? "OAuth sign-in failed. Try again." };
  }
  redirect(data.url);
}

/**
 * Gửi email reset mật khẩu — S#23. Link trong mail đi qua
 * /auth/callback?next=/reset-password (PKCE recovery) → trang đặt mật khẩu mới.
 * Luôn trả message CHUNG bất kể email có tồn tại hay không (chuẩn bảo mật —
 * không làm oracle dò email đã đăng ký). Lỗi thật (vd rate limit email
 * built-in Supabase) chỉ log server-side.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address" };

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) console.warn("[requestPasswordReset]", error.message);

  return {
    info: "If an account exists for that email, a password reset link has been sent.",
  };
}

/**
 * Đặt mật khẩu mới — S#23. Chạy trong recovery session (user vừa bấm link
 * email, /auth/callback đã đổi code lấy session) hoặc session thường.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) return { error: "Passwords do not match" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/exams");
}

/** Đăng nhập email/password. */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect("/exams");
}

/** Đăng xuất, quay về homepage với form đăng nhập mở. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?auth=signin");
}

/** Đổi tên hiển thị (user_profiles.display_name) — gọi từ HeaderProfile (navbar
 * L2/3/4) + SidebarProfile (homepage). RLS "profiles_update_own" đã cho phép
 * user tự sửa profile của mình. */
export async function updateProfile(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return { error: "Display name must not be empty" };
  // Hai hằng số này từng là literal viết thẳng ở đây, và cùng lúc là literal
  // viết thẳng trong onChange của HeaderProfile + SidebarProfile — đổi trần độ
  // dài thì có ba chỗ để quên. Nay chỉ còn lib/profile/displayName.ts.
  if (displayName.length > DISPLAY_NAME_MAX)
    return { error: `Display name must be ${DISPLAY_NAME_MAX} characters or fewer` };
  if (!DISPLAY_NAME_RE.test(displayName))
    return { error: "Display name may only contain letters and dots" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired" };

  // Rate limit (Security review Low) — user_profiles.update không có ràng buộc
  // nào chặn ghi lặp, nên đây là action rẻ nhất để gọi dồn.
  const rl = await guard("updateProfile", user.id);
  if (!rl.ok) {
    return { error: `Too many updates. Try again in ${rl.retryAfterSeconds} seconds.` };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return null;
}

// ---------------------------------------------------------------------------
// /profile — đổi mật khẩu & đổi ảnh đại diện (PRD profile-and-about, Design Doc
// docs/design/profile-and-about-design.md §Backend contracts).
//
// HAI ACTION DƯỚI ĐÂY TRẢ VỀ KHOÁ TỪ ĐIỂN, KHÔNG TRẢ CÂU TIẾNG ANH. Đây là chỗ
// chúng CỐ Ý KHÁC 6 action phía trên: mọi action cũ trả `error.message` của
// Supabase nguyên văn (`:42,:81,:128,:144,:194`), tiện lúc viết và sai ở hai
// mặt — người dùng Việt đọc tiếng Anh, và trên đường mật khẩu thì chính câu đó
// là một ORACLE (updateUser trả "New password should be different from the old
// password"). Nên: lỗi của provider được ÁNH XẠ về khoá cố định, không bao giờ
// chảy ra client.
//
// Dạng dây: `error` là một khoá i18n (vd "profile.avatar.tooLarge"). Riêng
// nhánh rate-limit cần kèm số giây, và AuthState chỉ có một trường string, nên
// nó là `profile.error.rateLimited:{seconds}` — client tách ở dấu ":" cuối và
// truyền {seconds} vào t(). Client đã phải có nhánh regex đọc số giây cho
// updateProfile (UI-D9), nên đây không phải cơ chế thứ hai.
//
// NGOẠI LỆ DUY NHẤT: câu lỗi của validatePassword được trả NGUYÊN VĂN (tiếng
// Anh), vì UI-D10 quyết định ánh xạ 4 câu đó sang khoá ở CLIENT bằng đối chiếu
// literal có test canh — làm lại việc đó ở đây thành hai bản chính sách.
// ---------------------------------------------------------------------------

/** Khoá i18n + số giây phải chờ, gộp vào một string vì AuthState chỉ có `error`. */
function rateLimitedKey(retryAfterSeconds: number): string {
  return `profile.error.rateLimited:${retryAfterSeconds}`;
}

/**
 * Đổi ảnh đại diện — /profile (PRD R5, AC-027..AC-031, AC-037; ADR-0016).
 *
 * Thứ tự các bước chép từ submitSupportTicket (lib/support/actions.ts) — đường
 * upload end-to-end DUY NHẤT đang chạy thật trong repo này: auth → guard →
 * kiểm file → upload → ghi DB → dọn rác best-effort.
 */
export async function changeAvatar(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "profile.error.sessionExpired" };

  const rl = await guard("uploadAvatar", user.id);
  if (!rl.ok) return { error: rateLimitedKey(rl.retryAfterSeconds) };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "profile.error.generic" };
  }

  // Tầng CƯỠNG CHẾ của MIME/kích thước là ở đây, không phải ở `accept` của
  // input: một POST tự chế không chạy qua trình duyệt (AC-030).
  const check = checkAvatarFile({ type: file.type, size: file.size });
  if (!check.ok) {
    return {
      error:
        check.reason === "too_large"
          ? "profile.avatar.tooLarge"
          : "profile.avatar.invalidType",
    };
  }

  // KEY MỚI MỖI LẦN UPLOAD (PRD U3), không phải một key ổn định kiểu
  // `{uid}/avatar.jpg`. Key ổn định + signed URL sống 1 giờ = ảnh CŨ vẫn được
  // phục vụ dưới một chữ ký còn hạn sau khi người dùng đã đổi ảnh — họ bấm đổi,
  // thấy ảnh cũ, và không có lỗi nào để đọc. Bù lại phải tự dọn object cũ (bước
  // cuối). Segment đầu là auth.uid() — đúng vị từ của policy avatars_*_own.
  const key = `${user.id}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(key, file, { contentType: file.type });
  if (uploadError) {
    // Log CHỈ key, không log object lỗi của provider — cùng luật với
    // changePassword bên dưới (AC-024), giữ một luật cho cả hai action mới thay
    // vì hai luật tuỳ đường. Key đủ để dò lại trong log Storage.
    console.error("[changeAvatar] upload thất bại:", key);
    return { error: "profile.avatar.uploadFailed" };
  }

  // Đọc key CŨ trước khi ghi đè — sau lệnh update thì không còn đường nào biết
  // object cũ tên gì, và nó nằm lại trong bucket vĩnh viễn.
  const { data: previous } = await supabase
    .from("user_profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();
  const previousKey: string | null = previous?.avatar_url ?? null;

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: key })
    .eq("id", user.id);
  if (updateError) {
    // Object vừa upload đã mồ côi (DB không trỏ tới nó) — dọn nhưng KHÔNG chặn
    // response bằng kết quả dọn (mirror lib/support/actions.ts:106-114).
    await removeAvatarObjectSafely(supabase, key);
    console.error("[changeAvatar] ghi user_profiles.avatar_url thất bại:", key);
    return { error: "profile.avatar.uploadFailed" };
  }

  // Ảnh cũ: dọn vệ sinh, KHÔNG phải biện pháp bảo mật (bucket private nên một
  // object mồ côi không ai với tới được — ADR-0016 §Consequences). Hỏng thì ghi
  // log rồi thôi: người dùng đã có ảnh mới, không có gì để họ làm với tin này.
  if (previousKey && previousKey !== key) {
    await removeAvatarObjectSafely(supabase, previousKey);
  }

  return null;
}

async function removeAvatarObjectSafely(
  supabase: Awaited<ReturnType<typeof createClient>>,
  key: string,
): Promise<void> {
  const { error } = await supabase.storage.from(AVATARS_BUCKET).remove([key]);
  if (error) console.error("[changeAvatar] dọn object thất bại:", key);
}

/**
 * Đổi mật khẩu — /profile (PRD R4, AC-017..AC-026).
 *
 * KHÁC updatePassword ở trên: đường đó chạy trong recovery session, nơi cái link
 * trong email CHÍNH LÀ bằng chứng. Đường này chạy trong session thường, nên phải
 * tự hỏi lại mật khẩu hiện tại (D7).
 *
 * ⚠ KHÔNG log formData, không log biến mật khẩu, không log object error của
 * Supabase — AC-024, và nó là tiêu chí nghiệm thu chứ không phải góp ý style.
 */
export async function changePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "profile.error.sessionExpired" };
  // Không có email thì không có gì để kiểm mật khẩu hiện tại với. Mọi đường đăng
  // ký của project (email/password, Google, Facebook) đều cấp email, nên đây là
  // phòng thủ theo lớp — nhưng "phiên hết hạn" sẽ là câu trả lời SAI cho nó.
  if (!user.email) return { error: "profile.error.generic" };

  // TRƯỚC khi đụng tới credential, cố ý. Action này nhận vào mật khẩu và trả
  // lời "đúng hay sai" — đặt guard sau bước kiểm thì nó không còn chặn được cái
  // duy nhất nó có ở đây để chặn: tốc độ dò (xem RATE_LIMITS.changePassword).
  const rl = await guard("changePassword", user.id);
  if (!rl.ok) return { error: rateLimitedKey(rl.retryAfterSeconds) };

  if (!currentPassword) return { error: "profile.password.errorCurrentRequired" };

  // NGUYÊN VĂN, không ánh xạ ở server — xem ghi chú đầu khối (UI-D10).
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) return { error: "profile.password.errorMismatch" };
  // Supabase cũng từ chối trường hợp này, nhưng bằng câu "New password should be
  // different from the old password" — thứ ta đã cấm chảy ra client. So sánh tại
  // chỗ (ta đang cầm cả hai chuỗi) cho ra câu trả lời đúng mà không mượn lời của
  // provider, và tiết kiệm một vòng mạng.
  if (password === currentPassword) return { error: "profile.password.errorSameAsCurrent" };

  // ⚠ DÒNG RỦI RO NHẤT CỦA CẢ TÍNH NĂNG (Design Doc C1).
  // Kiểm mật khẩu hiện tại = gọi signInWithPassword, mà signInWithPassword thì
  // MỤC ĐÍCH của nó là tạo session mới. Gọi trên client cookie-bound của
  // lib/supabase/server.ts (nó GHI cookie session — `server.ts:13-40`) là ghi
  // đè phiên của chính người đang thao tác giữa chừng request và xoay refresh
  // token của họ. Triệu chứng ở production: thỉnh thoảng có người bị đăng xuất
  // ngẫu nhiên, không tái hiện được, không lỗi nào ở đâu cả.
  // Nên: một client DÙNG MỘT LẦN, không persist, không tự refresh, không biết
  // cookie jar là gì. Hình dạng này đã có 10+ chỗ trong supabase/*.ts (script,
  // test); đây là lần đầu nó xuất hiện trong code chạy thật, nên nó cần dòng
  // giải thích này thay vì trông như một bản sao thừa của createClient().
  const probe = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInError } = await probe.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "profile.password.errorCurrentWrong" };

  // Đổi mật khẩu trên client PHIÊN THẬT — đây mới là nơi cookie được phép đụng.
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    // `probe` không ghi cookie, nhưng signInWithPassword ở trên VẪN mint một
    // refresh token thật phía Supabase. Đường thành công dọn nó nhờ
    // signOut({scope:"others"}) bên dưới; đường này thoát sớm nên phải tự dọn,
    // nếu không mỗi lần updateUser hỏng là để lại một phiên sống mà không ai
    // cầm. Bỏ qua lỗi: đây là dọn dẹp, không phải một cổng kiểm soát.
    await probe.auth.signOut().catch(() => {});
    // KHÔNG trả updateError.message: nó là câu của provider, và ít nhất một câu
    // trong số đó là oracle. Log cũng chỉ được status (số), không được object.
    console.error("[changePassword] updateUser bị từ chối, status:", updateError.status ?? 0);
    return { error: "profile.error.generic" };
  }

  // scope "others": thu hồi các phiên KHÁC, giữ nguyên phiên của người đang đổi
  // (AC-021 + AC-022). Không call site nào khác trong repo truyền scope — mặc
  // định là "global", và mặc định ở đây sẽ tự đá người dùng ra ngay sau khi họ
  // đổi mật khẩu thành công.
  // ⚠ Nó thu hồi REFRESH token của thiết bị khác, KHÔNG giết access token đã
  // phát: thiết bị kia còn dùng được tới khi token hết hạn (PRD R-b). Câu chữ
  // trên UI vì thế là "các thiết bị khác sẽ phải đăng nhập lại", không phải "đã
  // đăng xuất khỏi mọi nơi, ngay lập tức".
  // Nó cũng dọn luôn phiên mà `probe` vừa tạo ở trên — probe không ghi cookie
  // nhưng vẫn mint một refresh token thật ở phía Supabase.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    // Mật khẩu ĐÃ đổi xong. Báo lỗi ở đây là nói dối theo hướng nguy hiểm hơn:
    // người dùng sẽ thử lại bằng mật khẩu cũ và tin là chưa đổi được.
    console.error("[changePassword] signOut(others) thất bại, status:", signOutError.status ?? 0);
  }

  return null;
}
