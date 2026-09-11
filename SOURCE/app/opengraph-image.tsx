// Ảnh preview khi dán link site vào Zalo / Messenger / Facebook / X.
// Trước đây không có file này → link chia sẻ hiện ra một ô trắng trơn.
//
// Sinh bằng `next/og` (Satori) thay vì kèm sẵn file PNG: đổi chữ chỉ cần sửa
// JSX, không phải mở tool ảnh. Next.js cache kết quả nên chỉ render một lần.
//
// ⚠ Satori KHÔNG hỗ trợ đủ CSS như trình duyệt — chỉ flexbox, không grid,
// mọi phần tử nhiều con phải khai `display: flex` tường minh.
//
// Theme "Sân trường" (2026-09-11), và đây là màn hình NGƯỜI LẠ NHÌN THẤY ĐẦU
// TIÊN về sản phẩm. Bản trước sai hai chuyện cùng lúc: bảng màu vẫn là "Mực &
// Sơn mài" (kem/nâu đen/đỏ son), và câu giới thiệu viết bằng tiếng Anh trên
// một sản phẩm chỉ có tiếng Việt. Ảnh `brand-mark.png` cũng gỡ: hình trong đó
// là khối "PAGS", không phải mốc thương hiệu của MS-MOLAR — ô logo trên header
// đang cố ý để trống chờ logo mới, ảnh chia sẻ đi theo đúng quyết định đó.

import { ImageResponse } from "next/og";
import { t } from "@/lib/copy";

export const alt = t("meta.ogAlt");
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Token của globals.css chép tay sang: Satori không đọc được biến CSS.
const WHITE = "#ffffff";
const INK = "#14291c";
const MUTED = "#4f6656";
const PRIMARY = "#117a45";
const SUN = "#ffc531";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: WHITE,
          // Hai vệt xanh sát mép trên/dưới — phẳng, không đổ bóng, không
          // gradient, đúng tinh thần của globals.css.
          borderTop: `18px solid ${PRIMARY}`,
          borderBottom: `18px solid ${PRIMARY}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
              fontSize: 38,
              lineHeight: 1.3,
              color: MUTED,
            }}
          >
            <div>{t("meta.ogTaglineLine1")}</div>
            <div>{t("meta.ogTaglineLine2")}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
