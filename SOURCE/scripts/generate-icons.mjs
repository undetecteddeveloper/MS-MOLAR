// Sinh bộ icon của site từ `public/images/brand_logo.png`.
//
// Chạy lại khi đổi logo:  node scripts/generate-icons.mjs
//
// Output (đều commit vào repo, KHÔNG sinh lúc build):
//   app/favicon.ico          — 16/32/48, cho tab trình duyệt + bookmark cũ
//   app/icon.png             — 512, Next.js tự chèn <link rel="icon">
//   app/apple-icon.png       — 180, màn hình chính iOS
//   public/images/brand-mark.png — 256, nhúng data-URI vào OG image
//
// Logo gốc là hình CHỮ NHẬT (712×648) có viền đỏ sát mép; icon bắt buộc vuông.
// Nên đệm nền đỏ son #A62C2B (đúng màu viền của logo, cũng là --brand trong
// globals.css) thay vì resize thẳng — resize thẳng sẽ kéo méo chữ P/A/G/S.

import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SRC = "public/images/brand_logo.png";
const BRAND = "#A62C2B";

async function square(size) {
  // 0.84 chừa một vành đỏ mỏng quanh logo → ở 16px vẫn thấy rõ khối chữ đen
  // trên nền vàng đồng, không bị viền ăn hết chi tiết.
  const inner = Math.round(size * 0.84);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: BRAND })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

writeFileSync("app/icon.png", await square(512));
writeFileSync("app/apple-icon.png", await square(180));
writeFileSync("public/images/brand-mark.png", await square(256));

// ICO nhúng thẳng payload PNG (hợp lệ từ Windows Vista, mọi trình duyệt hiện
// đại đọc được) — đơn giản hơn nhiều so với sinh bitmap BMP + AND mask.
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(square));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(sizes.length, 4);

let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); // width  (0 nghĩa là 256)
  e.writeUInt8(s, 1); // height
  e.writeUInt8(0, 2); // số màu palette (0 = truecolor)
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});

writeFileSync("app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));

console.log(
  `icons: favicon.ico (${sizes.join("/")}), icon.png 512, apple-icon.png 180, brand-mark.png 256`,
);
