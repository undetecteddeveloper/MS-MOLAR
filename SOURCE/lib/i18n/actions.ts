"use server";

// Server action đổi ngôn ngữ. Ghi cookie rồi `revalidatePath("/", "layout")`
// để mọi server component render lại bằng từ điển mới — nếu chỉ ghi cookie,
// phần giao diện dựng ở server sẽ giữ nguyên ngôn ngữ cũ cho tới lần tải trang
// cứng tiếp theo, trong khi phần client đã đổi → trang lẫn lộn hai ngôn ngữ.

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "./locales";

/** Một năm — lựa chọn ngôn ngữ nên sống lâu hơn phiên đăng nhập. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(next: Locale): Promise<void> {
  // Giá trị đến từ client nên không tin được: chỉ nhận đúng mã trong danh sách,
  // tránh việc nhét chuỗi tuỳ ý vào cookie rồi dội ngược ra header.
  if (!isLocale(next)) return;

  (await cookies()).set(LOCALE_COOKIE, next, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
    // Không đặt `httpOnly`: đây là tuỳ chọn hiển thị, không phải bí mật, và để
    // đọc được từ phía client nếu sau này cần tránh nháy ngôn ngữ lúc hydrate.
    httpOnly: false,
  });

  revalidatePath("/", "layout");
}
