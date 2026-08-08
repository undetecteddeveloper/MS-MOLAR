"use client";

// Nút chuyển ngôn ngữ EN ↔ VI. Đặt trong navbar (Layer 2/3/4 + History) và
// trong sidebar trang chủ — hai chỗ này đều nền đen sơn mài nên chỉ cần một
// kiểu dáng "trên nền tối".
//
// Chỉ có hai ngôn ngữ nên dùng NÚT LẬT thay vì menu thả xuống: một thao tác là
// xong, không phải mở rồi chọn rồi đóng. Đánh đổi là người dùng phải suy ra
// nhãn nghĩa là gì — bù lại bằng `aria-label` nói rõ "Chuyển sang …".
//
// A11y:
//  - `lang` gắn trên phần nhãn để trình đọc màn hình phát âm "Tiếng Việt" bằng
//    giọng Việt thay vì đánh vần theo tiếng Anh.
//  - `min-h`/`px` giữ vùng bấm ≥ 24×24px CSS (WCAG 2.5.8 Target Size).
//  - `aria-live` không cần: sau khi đổi, cả trang render lại bằng ngôn ngữ mới,
//    bản thân sự thay đổi đã quá rõ ràng.

import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_LABEL, LOCALE_SHORT, type Locale } from "@/lib/i18n/locales";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();

  const next: Locale = locale === "en" ? "vi" : "en";

  return (
    <button
      type="button"
      // KHÔNG `disabled` khi đang chuyển: nút bị disabled sẽ rơi khỏi thứ tự Tab
      // ngay dưới ngón tay người dùng bàn phím và tiêu điểm bị ném về đầu trang.
      // `aria-busy` + pointer-events báo trạng thái mà vẫn giữ được tiêu điểm.
      aria-busy={pending}
      aria-label={t("nav.switchTo", { language: LOCALE_LABEL[next] })}
      onClick={() => startTransition(() => setLocale(next))}
      className={[
        // min-h-11 (44px) chứ không phải min-h-6 (24px) như trước: 24px là
        // ngưỡng WCAG 2.5.8 cho con trỏ chuột, còn tài liệu
        // Mobile-Layout-Research-MS §4.3 đặt sàn 44–48px cho ngón tay. Nút này
        // sống trên navbar CẢM ỨNG ở mobile nên phải theo sàn cao hơn.
        "inline-flex min-h-11 shrink-0 items-center rounded-sm px-2 py-1 font-sans text-[10px] font-medium tracking-[0.12em] uppercase transition-colors",
        "text-[#EDE1C8]/55 hover:text-[#EDE1C8] focus-visible:text-[#EDE1C8]",
        pending ? "pointer-events-none opacity-60" : "",
        className,
      ].join(" ")}
    >
      <span lang={locale} aria-hidden>
        {LOCALE_SHORT[locale]}
      </span>
      <span aria-hidden className="mx-1 text-[#EDE1C8]/30">
        /
      </span>
      <span lang={next} aria-hidden className="text-[color:var(--brand-on-dark)]">
        {LOCALE_SHORT[next]}
      </span>
    </button>
  );
}
