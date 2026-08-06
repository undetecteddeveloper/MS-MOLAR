// Phía server: đọc ngôn ngữ đang chọn từ cookie.
//
// Vì sao chọn cookie thay vì tiền tố route `/vi/...`: toàn bộ site (trừ `/`)
// nằm sau đăng nhập nên không có gì để SEO theo ngôn ngữ, trong khi tiền tố
// route sẽ buộc phải bê cả cây `app/` vào một segment `[locale]` và viết lại
// mọi `href` trong mã. Cookie giữ URL nguyên vẹn, đổi ngôn ngữ không làm hỏng
// link đã chia sẻ.
//
// Đánh đổi: trang có cookie này là trang động (không tĩnh hoá được). Chấp nhận
// được vì các layout đã gọi `getCurrentUserProfile()` — đằng nào cũng động.

import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales";
import { createTranslate, getDictionary, type Translate } from "./translate";

/** Ngôn ngữ của request hiện tại; về mặc định nếu cookie thiếu hoặc rác. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Hàm `t` cho server component. */
export async function getTranslate(): Promise<Translate> {
  return createTranslate(getDictionary(await getLocale()));
}
