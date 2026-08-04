// Ảnh preview khi dán link site vào Zalo / Messenger / Facebook / X.
// Trước đây không có file này → link chia sẻ hiện ra một ô trắng trơn.
//
// Sinh bằng `next/og` (Satori) thay vì kèm sẵn file PNG: đổi chữ chỉ cần sửa
// JSX, không phải mở tool ảnh. Next.js cache kết quả nên chỉ render một lần.
//
// ⚠ Satori KHÔNG hỗ trợ đủ CSS như trình duyệt — chỉ flexbox, không grid,
// mọi phần tử nhiều con phải khai `display: flex` tường minh.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "MS-MOLAR — practise exams online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Đọc lúc render trên server (không phải bundle client). Dùng bản 256px thay
// vì brand_logo.png 497KB — Satori chỉ vẽ nó ở 200px.
const markDataUri = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/images/brand-mark.png"),
).toString("base64")}`;

// Theme "Mực & Sơn mài" (DESIGN.md) — giữ đúng token của globals.css.
const INK = "#1B1512";
const IVORY = "#EDE1C8";
const VERMILION = "#A62C2B";
const BRONZE = "#B08D57";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 88px",
          background: IVORY,
          // Hairline đỏ son quanh mép — phẳng, không đổ bóng, đúng tinh thần
          // "flat + hairline" của DESIGN.md.
          borderTop: `18px solid ${VERMILION}`,
          borderBottom: `18px solid ${VERMILION}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori chỉ hiểu <img>, không dùng được next/image. */}
        <img src={markDataUri} width={220} height={220} alt="" />

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            MS-MOLAR
          </div>
          <div style={{ display: "flex", width: 120, height: 3, background: BRONZE }} />
          {/* Xuống dòng thủ công: Satori không tự wrap theo ý muốn, tách 2 dòng
              riêng để ngắt câu đúng chỗ. gap nhỏ để 2 dòng đọc như một khối. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 34,
              lineHeight: 1.3,
              color: INK,
              opacity: 0.82,
            }}
          >
            <div>Practise real exams online. Instant scoring,</div>
            <div>worked answers, progress you can track.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
