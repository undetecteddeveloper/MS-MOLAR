"use client";

// Error boundary gốc — bắt mọi lỗi render không được boundary con nào đỡ
// (hiện chỉ `(history)/history` có error.tsx riêng). Không có file này thì trên
// production người dùng nhận màn trắng "Application error: a server-side
// exception has occurred", kèm digest trần, không có đường quay lại.
//
// Theo precedent của `(history)/history/error.tsx`: role="alert" + nhận focus khi
// render, "Try again" nối thẳng vào reset().

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("unhandled render error", { error });
    alertRef.current?.focus();
  }, [error]);

  return (
    <main className="bg-background flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="border-brand bg-brand/8 w-full max-w-md rounded-lg border px-6 py-6 text-center outline-none"
      >
        <p className="text-brand font-mono text-xs tracking-[0.28em] uppercase">
          {t("error.somethingBroke")}
        </p>

        <h1 className="font-heading text-foreground mt-4 text-2xl">{t("error.couldntLoad")}</h1>

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {t("error.couldntLoadBody")}
        </p>

        {/* digest là handle duy nhất để dò log server: Next.js che stack thật
            trên production, chỉ trả về mã băm này. Hiện ra để người dùng còn
            có cái mà báo lại. */}
        {error.digest && (
          <p className="text-muted-foreground mt-4 font-mono text-[11px]">
            {t("error.reference")} {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-brand text-brand-foreground rounded-full px-5 py-2.5 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
          >
            {t("common.tryAgain")}
          </button>
          <Link
            href="/"
            className="border-border text-foreground hover:bg-secondary rounded-[4px] border px-5 py-2.5 text-xs font-medium tracking-[0.14em] uppercase transition-colors"
          >
            {t("common.home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
