"use client";

// Phía client: context mang ngôn ngữ + từ điển xuống cho mọi client component.
//
// Provider nhận `locale` từ root layout (server đã đọc cookie) rồi tự dựng lại
// từ điển trong bundle client. Cách này gửi đúng MỘT chuỗi `locale` qua ranh
// giới server→client thay vì serialize cả bảng vài trăm chuỗi vào payload RSC
// của mọi trang.

import { createContext, use, useMemo } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { createTranslate, getDictionary, type Translate } from "./translate";

type I18nValue = { locale: Locale; t: Translate };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: createTranslate(getDictionary(locale)) }),
    [locale]
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

/**
 * `const t = useT()` trong client component.
 *
 * Không ném lỗi khi thiếu provider: một số client component được render tách
 * biệt trong test đơn vị, bắt chúng phải bọc provider chỉ để đọc một nhãn là
 * ma sát vô ích. Thiếu provider thì rơi về ngôn ngữ mặc định.
 */
export function useT(): Translate {
  const ctx = use(I18nContext);
  return ctx?.t ?? createTranslate(getDictionary(DEFAULT_LOCALE));
}

/** Ngôn ngữ hiện hành — nút chuyển ngôn ngữ cần biết để hiện đích đến. */
export function useLocale(): Locale {
  return use(I18nContext)?.locale ?? DEFAULT_LOCALE;
}
