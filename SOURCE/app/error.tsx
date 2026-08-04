"use client";

// Error boundary gốc — bắt mọi lỗi render không được boundary con nào đỡ
// (hiện chỉ `(HM)/history` có error.tsx riêng). Không có file này thì trên
// production người dùng nhận màn trắng "Application error: a server-side
// exception has occurred", kèm digest trần, không có đường quay lại.
//
// Theo precedent của `(HM)/history/error.tsx`: role="alert" + nhận focus khi
// render, "Try again" nối thẳng vào reset().

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("unhandled render error", { error });
    alertRef.current?.focus();
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="w-full max-w-md rounded-lg border border-brand bg-brand/8 px-6 py-6 text-center outline-none"
      >
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-brand">
          Something broke
        </p>

        <h1 className="mt-4 font-heading text-2xl text-foreground">
          We couldn&apos;t load this page
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The problem is on our side, not yours. Trying again usually works — if
          it doesn&apos;t, come back in a few minutes.
        </p>

        {/* digest là handle duy nhất để dò log server: Next.js che stack thật
            trên production, chỉ trả về mã băm này. Hiện ra để người dùng còn
            có cái mà báo lại. */}
        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-[4px] bg-brand px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-[4px] border border-border px-5 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-secondary"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
