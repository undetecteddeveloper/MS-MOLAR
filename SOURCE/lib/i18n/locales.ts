// Hằng số i18n dùng CHUNG cho cả server lẫn client. File này cố ý không import
// gì từ `next/*` để cả hai phía đều nạp được — `lib/i18n/server.ts` đụng cookie
// nên chỉ chạy được ở server, còn provider phía client cần biết cùng bộ hằng số.

export const LOCALES = ["en", "vi"] as const;

export type Locale = (typeof LOCALES)[number];

/** Tiếng Anh là mặc định vì toàn bộ giao diện hiện có đang viết bằng tiếng Anh. */
export const DEFAULT_LOCALE: Locale = "en";

/** Tên cookie giữ lựa chọn ngôn ngữ. */
export const LOCALE_COOKIE = "ms_locale";

/** Nhãn hiển thị trên nút chuyển ngôn ngữ — luôn viết bằng CHÍNH ngôn ngữ đó. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

/** Nhãn ngắn cho nút toggle ở navbar (chỗ hẹp). */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  vi: "VI",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
