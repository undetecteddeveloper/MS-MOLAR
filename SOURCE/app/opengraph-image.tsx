// Ảnh preview khi dán link site vào Zalo / Messenger / Facebook / X.
// Trước đây không có file này → link chia sẻ hiện ra một ô trắng trơn.
//
// Sinh bằng `next/og` (Satori) thay vì kèm sẵn file PNG: đổi chữ chỉ cần sửa
// JSX, không phải mở tool ảnh. Next.js cache kết quả nên chỉ render một lần.
//
// ⚠ Satori KHÔNG hỗ trợ đủ CSS như trình duyệt — chỉ flexbox, không grid,
// mọi phần tử nhiều con phải khai `display: flex` tường minh.
//
// 2026-10-17: thêm logo quạ bên phải (trên đĩa bạc hà) và hai mảng ô caro đối góc
// cho bớt đơn điệu — hướng A của prototype do người dùng duyệt; chi tiết ở GridPatch.
//
// Theme "Sân trường" (2026-09-11), và đây là màn hình NGƯỜI LẠ NHÌN THẤY ĐẦU
// TIÊN về sản phẩm. Bản trước sai hai chuyện cùng lúc: bảng màu vẫn là "Mực &
// Sơn mài" (kem/nâu đen/đỏ son), và câu giới thiệu viết bằng tiếng Anh trên
// một sản phẩm chỉ có tiếng Việt. Ảnh `brand-mark.png` cũng gỡ: hình trong đó
// là khối "PAGS", không phải mốc thương hiệu của MS-MOLAR — ô logo trên header
// đang cố ý để trống chờ logo mới, ảnh chia sẻ đi theo đúng quyết định đó.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { t } from "@/lib/copy";

export const alt = t("meta.ogAlt");
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Theme "Đêm hội" (2026-09-14): đổi sang nền tối cùng lượt với globals.css.
// Ảnh chia sẻ đi lệch theme là kiểu hỏng KHÔNG AI BÁO — người mở link thấy một
// tấm trắng, bấm vào lại ra một site tối, và không có màn hình nào trong sản
// phẩm để đối chiếu mà phát hiện.
//
// Token của globals.css chép tay sang: Satori không đọc được biến CSS.
const PAGE = "#070f0c";
const INK = "#f0fbf3";
const MUTED = "#a6c2b0";
const PRIMARY = "#7ff0b0";
const SUN = "#ffd65c";

// Hai mảng ô caro đối góc (trên-trái, dưới-phải) — cùng motif `.hero-grid` của
// trang chủ nhưng NÉT ĐẬM VÀ DÀY HƠN (3px, 60%, ô 36px; trang chủ là 1px, 28%, ô
// 24px): ảnh chia sẻ bị thu còn vài trăm px nên nét 1px mờ như không có (người
// dùng duyệt trên prototype 2026-10-17, hướng A). Satori không có mask-image, nên
// phần "mờ dần ra xa góc" là các lớp gradient màu nền phủ lên trên lưới.
const GRID_LINE = "rgba(127, 240, 176, 0.6)";
const GRID_CELL = 36;
const FADE_CLEAR = "rgba(7, 15, 12, 0)";
const FADE_SOFT = "rgba(7, 15, 12, 0.1)";
const PATCH_W = 560;
const PATCH_H = 360;

// Satori bỏ cả lớp nền khi gặp nhiều gradient kèm size/position riêng (đo 2026-10-17:
// ảnh ra không có caro), nên lưới và lớp mờ là HAI phần tử chồng nhau, mỗi cái một gradient.
function GridPatch({ corner }: { corner: "top-left" | "bottom-right" }) {
  const horizontal = corner === "top-left" ? "to right" : "to left";
  const vertical = corner === "top-left" ? "to bottom" : "to top";
  const layer = { position: "absolute" as const, left: 0, top: 0, width: PATCH_W, height: PATCH_H };
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        width: PATCH_W,
        height: PATCH_H,
        ...(corner === "top-left" ? { left: 0, top: 0 } : { right: 0, bottom: 0 }),
      }}
    >
      <div
        style={{
          ...layer,
          display: "flex",
          backgroundImage: `linear-gradient(to right, ${GRID_LINE} 3px, transparent 3px), linear-gradient(to bottom, ${GRID_LINE} 3px, transparent 3px)`,
          backgroundSize: `${GRID_CELL}px ${GRID_CELL}px`,
          // Góc dưới-phải: neo ô lưới về góc đó để hai mảng đối xứng.
          backgroundPosition: corner === "top-left" ? "0 0" : "100% 100%",
        }}
      />
      {/* Mờ dần ra xa góc: hai lớp tuyến tính (ngang + dọc) chồng nhau. Satori vẽ
          radial-gradient elip thành màu đặc phủ kín mảng (đo 2026-10-17), nên không
          dùng được; hai lớp này cho độ nhìn thấy ∝ (1−x)(1−y), đậm nhất ở góc. */}
      {[horizontal, vertical].map((direction) => (
        <div
          key={direction}
          style={{
            ...layer,
            display: "flex",
            backgroundImage: `linear-gradient(${direction}, ${FADE_CLEAR} 0%, ${FADE_SOFT} 30%, ${PAGE} 100%)`,
          }}
        />
      ))}
    </div>
  );
}

// Logo quạ (`public/images/ms-molar-logo.png`, 128×128, trong suốt) có ~88% điểm
// ảnh gần đen nên đặt thẳng lên nền #070f0c là biến mất — luôn nằm trên đĩa bạc hà.
// Đọc lúc dựng (route tĩnh) rồi nhúng base64; Satori không tải được đường dẫn tương đối.
const logoSrc = `data:image/png;base64,${await readFile(
  join(process.cwd(), "public/images/ms-molar-logo.png"),
  "base64"
)}`;

/** Tách câu thành hai dòng ở khoảng trắng gần mốc 60% (dòng trên dài hơn một chút, đúng
 *  prototype: "…biết ngay / mình yếu chỗ nào."); câu một từ thì giữ nguyên. */
function splitNearMiddle(text: string): string[] {
  const middle = text.length * 0.6;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best === -1 || Math.abs(i - middle) < Math.abs(best - middle))) best = i;
  }
  return best === -1 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: PAGE,
          // Hai vệt xanh sát mép trên/dưới. Satori không dựng được box-shadow
          // nên ảnh chia sẻ KHÔNG có quầng sáng như giao diện thật — hai vệt
          // xanh sáng trên nền tối đã tự làm xong việc "phát sáng" ở cỡ ảnh này.
          borderTop: `18px solid ${PRIMARY}`,
          borderBottom: `18px solid ${PRIMARY}`,
        }}
      >
        {/* Hai mảng caro vẽ TRƯỚC để nằm dưới chữ và logo. */}
        <GridPatch corner="top-left" />
        <GridPatch corner="bottom-right" />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24, width: 660 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            MS-MOLAR
          </div>

          {/* Một điểm vàng nắng duy nhất trên cả tấm ảnh — vàng ở theme này
              không bao giờ là ranh giới thông tin một mình, ở đây nó chỉ là
              gạch trang trí dưới tên. */}
          <div style={{ display: "flex", width: 132, height: 6, background: SUN }} />

          {/* Xuống dòng thủ công: Satori không tự wrap theo ý muốn, tách 2 dòng
              riêng để ngắt câu đúng chỗ. gap nhỏ để 2 dòng đọc như một khối. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 36,
              lineHeight: 1.3,
              color: MUTED,
            }}
          >
            <div>{t("meta.ogTaglineLine1")}</div>
            {/* Chỉ còn ~660px bề ngang cho chữ (logo chiếm bên phải): dòng 2 dài
                hơn nên tách đôi ở khoảng trắng gần giữa, không để Satori ngắt. */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {splitNearMiddle(t("meta.ogTaglineLine2")).map((part) => (
                <div key={part}>{part}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Đĩa bạc hà sau logo: logo gần như đen nên cần nền sáng. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 380,
            height: 380,
            borderRadius: 190,
            background: PRIMARY,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse/Satori, không phải trang web */}
          <img src={logoSrc} alt="" width={300} height={300} />
        </div>
      </div>
    ),
    size,
  );
}
