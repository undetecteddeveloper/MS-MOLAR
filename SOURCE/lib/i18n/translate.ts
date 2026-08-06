// Hàm tra chuỗi dùng chung cho cả hai phía. Tách khỏi server.ts/client.tsx vì
// cả server component lẫn client component đều cần đúng logic thay tham số này.

import { en, type Dictionary, type MessageKey } from "./dictionaries/en";
import { vi } from "./dictionaries/vi";
import type { Locale } from "./locales";

const DICTIONARIES: Record<Locale, Dictionary> = { en, vi };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export type TranslateValues = Record<string, string | number>;

/** Hàm `t` mà component gọi. */
export type Translate = (key: MessageKey, values?: TranslateValues) => string;

export function createTranslate(dict: Dictionary): Translate {
  return (key, values) => {
    const template = dict[key];
    // Không bao giờ trả chuỗi rỗng: nếu khoá lọt lưới kiểu (vd dữ liệu cũ trong
    // cache), hiện chính khoá đó ra màn hình còn hơn để trống một khoảng câm mà
    // không ai biết là bug.
    if (template === undefined) return key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in values ? String(values[name]) : whole
    );
  };
}

export type { Dictionary, MessageKey };
