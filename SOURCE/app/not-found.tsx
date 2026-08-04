import Link from "next/link";
import type { Metadata } from "next";

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

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.28em] text-brand">404</p>

      <h1 className="mt-5 font-heading text-4xl text-foreground sm:text-5xl">
        This page doesn&apos;t exist
      </h1>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        The link may be broken, or the exam may have been unpublished or deleted
        by its author.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/exams"
          className="rounded-[4px] bg-brand px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90"
        >
          Browse exams
        </Link>
        <Link
          href="/"
          className="rounded-[4px] border border-border px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-secondary"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
