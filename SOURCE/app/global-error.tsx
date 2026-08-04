"use client";

// Lưới cuối cùng: bắt lỗi xảy ra trong CHÍNH `app/layout.tsx` — trường hợp
// `app/error.tsx` không đỡ được, vì boundary đó nằm BÊN TRONG layout.
//
// File này thay thế toàn bộ cây <html>, nên không có gì từ layout còn hiệu
// lực: không next/font, và không chắc globals.css đã được nạp. Vì vậy dùng
// style inline chứ không dùng class Tailwind — màu lấy đúng token của theme
// "Mực & Sơn mài" (globals.css) chép tay sang.

import { useEffect } from "react";

const IVORY = "#EDE1C8";
const INK = "#1B1512";
const VERMILION = "#A62C2B";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("root layout render failed", { error });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
          background: IVORY,
          color: INK,
          fontFamily: "Georgia, 'Times New Roman', serif",
          textAlign: "center",
        }}
      >
        <div role="alert" style={{ maxWidth: "28rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: VERMILION,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            Something broke
          </p>

          <h1 style={{ margin: "1rem 0 0", fontSize: "1.75rem", fontWeight: 400 }}>
            MS-MOLAR couldn&apos;t start
          </h1>

          <p style={{ margin: "0.75rem 0 0", fontSize: "0.95rem", opacity: 0.75 }}>
            Reloading usually clears this. If it keeps happening, try again in a
            few minutes.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "1rem 0 0",
                fontSize: "0.7rem",
                opacity: 0.6,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              border: 0,
              borderRadius: "4px",
              background: VERMILION,
              color: IVORY,
              padding: "0.7rem 1.4rem",
              fontSize: "0.75rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
