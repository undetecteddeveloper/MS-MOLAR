// Tách một file .glb thành .gltf + .bin + ảnh rời (mỗi texture một file).
//
//   node scripts/split-glb.mjs <vào.glb> <thư-mục-ra> <tên-gốc>
//
// Vì sao có script này: trình tải GLTF của `three` giải mã texture NHÚNG trong
// .glb bằng cách tạo `blob:` URL rồi `fetch` nó; CSP của site (lib/security/
// csp.ts) cố ý chỉ cho `connect-src 'self'` + Supabase nên lượt fetch đó bị
// chặn và mô hình hiện trắng toát (đo 2026-10-12 trên Chrome). Tải ảnh bằng
// đường dẫn cùng origin thì không cần `blob:` trong connect-src, tức không phải
// nới chính sách bảo mật của cả site cho một trang ẩn.
//
// Không đổi nội dung mô hình: byte của lưới và ảnh được giữ NGUYÊN, chỉ đổi cách
// đóng gói (CC BY 4.0 — dòng ghi công vẫn đúng). Buffer mới bỏ phần ảnh để không
// tải đôi.

import fs from "node:fs";
import path from "node:path";

const [input, outDir, baseName] = process.argv.slice(2);
if (!input || !outDir || !baseName) {
  console.error("Cách dùng: node scripts/split-glb.mjs <vào.glb> <thư-mục-ra> <tên-gốc>");
  process.exit(1);
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const IMAGE_EXT = { "image/jpeg": "jpg", "image/png": "png" };

const file = fs.readFileSync(input);
if (file.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${input} không phải file GLB`);

let json = null;
let bin = null;
for (let offset = 12; offset < file.length; ) {
  const length = file.readUInt32LE(offset);
  const type = file.readUInt32LE(offset + 4);
  const data = file.subarray(offset + 8, offset + 8 + length);
  if (type === CHUNK_JSON) json = JSON.parse(data.toString("utf8"));
  if (type === CHUNK_BIN) bin = data;
  offset += 8 + length;
}
if (!json || !bin) throw new Error("GLB thiếu chunk JSON hoặc BIN");

const viewBytes = (view) => {
  const start = view.byteOffset ?? 0;
  return bin.subarray(start, start + view.byteLength);
};

fs.mkdirSync(outDir, { recursive: true });

// 1. Ảnh nhúng → file rời, ghi uri thay cho bufferView.
const imageViews = new Set();
(json.images ?? []).forEach((image, index) => {
  if (image.bufferView === undefined) return;
  const ext = IMAGE_EXT[image.mimeType];
  if (!ext) throw new Error(`mimeType ảnh chưa hỗ trợ: ${image.mimeType}`);
  const name = `${baseName}-tex${index}.${ext}`;
  fs.writeFileSync(path.join(outDir, name), viewBytes(json.bufferViews[image.bufferView]));
  imageViews.add(image.bufferView);
  image.uri = name;
  delete image.bufferView;
});

// 2. Dựng lại buffer không có phần ảnh; đánh số lại bufferView.
const remap = new Map();
const chunks = [];
const keptViews = [];
let position = 0;
json.bufferViews.forEach((view, oldIndex) => {
  if (imageViews.has(oldIndex)) return;
  const pad = (4 - (position % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    position += pad;
  }
  const bytes = viewBytes(view);
  chunks.push(bytes);
  keptViews.push({ ...view, byteOffset: position });
  position += bytes.length;
  remap.set(oldIndex, keptViews.length - 1);
});
json.bufferViews = keptViews;

const remapped = (oldIndex) => {
  const next = remap.get(oldIndex);
  if (next === undefined) throw new Error(`bufferView ${oldIndex} không còn trong buffer mới`);
  return next;
};
for (const accessor of json.accessors ?? []) {
  if (accessor.bufferView !== undefined) accessor.bufferView = remapped(accessor.bufferView);
  if (accessor.sparse) {
    accessor.sparse.indices.bufferView = remapped(accessor.sparse.indices.bufferView);
    accessor.sparse.values.bufferView = remapped(accessor.sparse.values.bufferView);
  }
}

const newBin = Buffer.concat(chunks);
json.buffers = [{ uri: `${baseName}.bin`, byteLength: newBin.length }];

fs.writeFileSync(path.join(outDir, `${baseName}.bin`), newBin);
fs.writeFileSync(path.join(outDir, `${baseName}.gltf`), JSON.stringify(json));

console.log(
  `OK: ${baseName}.gltf + ${baseName}.bin (${newBin.length} byte) + ${imageViews.size} ảnh -> ${outDir}`
);
