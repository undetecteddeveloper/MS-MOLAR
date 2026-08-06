import Link from "next/link";
import type { Metadata } from "next";
import { getTranslate } from "@/lib/i18n/server";

// Trang 404 toàn site. Trước đây rơi vào bản mặc định của Next.js (chữ đen
// trên nền trắng, font hệ thống) — lạc hẳn khỏi theme "Mực & Sơn mài".
//
// Đây KHÔNG phải màn hiếm gặp: `notFound()` được gọi ở 5 chỗ, trong đó có
// `app/(admin)/admin/page.tsx` — người không phải admin vào /admin sẽ thấy
// đúng trang này (cố ý dùng 404 thay vì "cấm truy cập" để không tiết lộ rằng
// route tồn tại, ADR-0001).

export const metadata: Metadata = {
  title: "Page not found",
};

export default async function NotFound() {
  const t = await getTranslate();
  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-brand font-mono text-sm tracking-[0.28em] uppercase">404</p>

      <h1 className="font-heading text-foreground mt-5 text-4xl sm:text-5xl">
        {t("error.notFound")}
      </h1>

      <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
        {t("error.notFoundBody")}
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/exams"
          className="bg-brand text-brand-foreground rounded-[4px] px-5 py-2.5 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
        >
          {t("common.browseExams")}
        </Link>
        <Link
          href="/"
          className="border-border text-foreground hover:bg-secondary rounded-[4px] border px-5 py-2.5 text-xs font-medium tracking-[0.14em] uppercase transition-colors"
        >
          {t("common.home")}
        </Link>
      </div>
    </main>
  );
}
