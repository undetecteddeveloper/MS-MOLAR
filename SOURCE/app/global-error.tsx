"use client";

// Lưới cuối cùng: bắt lỗi xảy ra trong CHÍNH `app/layout.tsx` — trường hợp
// `app/error.tsx` không đỡ được, vì boundary đó nằm BÊN TRONG layout.
//
// File này thay thế toàn bộ cây <html>, nên không có gì từ layout còn hiệu
// lực: không next/font, và không chắc globals.css đã được nạp. Vì vậy dùng
// style inline chứ không dùng class Tailwind — màu chép tay từ token của
// globals.css sang.
//
// Theme "Sân trường" (2026-09-11): bản trước còn chép tay bảng màu "Mực & Sơn
// mài" (kem/nâu đen/đỏ son) và viết toàn tiếng Anh. Cả hai đều là màn hình
// THẬT của sản phẩm — hiếm gặp không có nghĩa là không tính.
//
// Theme "Đêm hội" (2026-09-14): đổi nền tối. Đây là màn hình DUY NHẤT của site
// mà một lượt đổi token trong globals.css KHÔNG chạm tới — nó không chắc đã nạp
// được file đó. Đổi bảng màu là phải sửa TAY ở đây, nếu không người dùng gặp
// lỗi nặng nhất sẽ thấy một trang trắng lạc lõng giữa một site nền tối.
//
// `t()` dùng được ở đây: nó chỉ tra một object hằng trong lib/copy.ts, không
// cần provider nào — đúng thứ file này cần, vì mọi provider của root layout
// đều đã mất.

import { useEffect } from "react";
import { t } from "@/lib/copy";

// Theme "Đêm hội" (2026-09-14): chép tay bảng màu NỀN TỐI của globals.css.
// `PAGE`/`ON_PRIMARY` thay cho hằng `WHITE` cũ — trên theme này không còn chỗ
// nào là trắng, và một hằng tên WHITE mang giá trị #070f0c là bẫy cho lượt sửa
// sau.
const PAGE = "#070f0c";
const INK = "#f0fbf3";
const MUTED = "#a6c2b0";
const PRIMARY = "#7ff0b0";
const ON_PRIMARY = "#04140b";
const DESTRUCTIVE = "#ff9c82";

// Lexend đứng đầu để dùng lại bản trình duyệt đã cache từ những lượt vào
// trước; không có thì rơi về font hệ thống. KHÔNG serif: theme này một họ chữ.
const SANS =
  "Lexend, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

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
    // `lang="vi"` cố định ở đây là CỐ Ý: file này thay thế toàn bộ cây <html>
    // nên không đọc được gì từ root layout, và nội dung bên dưới luôn tiếng Việt.
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
          background: PAGE,
          color: INK,
          fontFamily: SANS,
          textAlign: "center",
        }}
      >
        <div role="alert" style={{ maxWidth: "28rem" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: DESTRUCTIVE }}>
            {t("error.somethingBroke")}
          </p>

          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "1.75rem",
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {t("error.couldntStart")}
          </h1>

          <p style={{ margin: "0.75rem 0 0", fontSize: "0.9375rem", lineHeight: 1.6, color: MUTED }}>
            {t("error.couldntStartBody")}
          </p>

          {error.digest && (
            <p style={{ margin: "1rem 0 0", fontSize: "0.75rem", color: MUTED, fontFamily: MONO }}>
              {t("error.reference")} {error.digest}
            </p>
          )}

          {/* Viên thuốc bo tròn tuyệt đối + sàn chạm 44px: nút hành động của
              theme này, chép tay vì không có Tailwind ở đây. */}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: "2.75rem",
              border: 0,
              borderRadius: "9999px",
              background: PRIMARY,
              color: ON_PRIMARY,
              padding: "0.625rem 1.5rem",
              fontFamily: "inherit",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
              // Quầng sáng của `.glow-action` (globals.css), chép tay: nền tối
              // không có Tailwind ở màn hình này.
              boxShadow:
                "0 0 0 1px rgb(127 240 176 / 0.4), 0 0 22px -4px rgb(127 240 176 / 0.55)",
            }}
          >
            {t("error.reload")}
          </button>
        </div>
      </body>
    </html>
  );
}
