// Ghi công mô hình 3D — giấy phép CC BY 4.0 BẮT BUỘC nêu: tên tác phẩm, tác giả,
// nguồn, giấy phép. Các giá trị lấy nguyên từ `asset.extras` trong chính file
// file gốc maxwell_the_cat_dingus.glb (Sketchfab 15.30.0; vẫn còn nguyên trong
// asset.extras của public/models/maxwell-the-cat.gltf). Mô hình dùng nguyên
// trạng — lưới và texture giữ đúng từng byte, scripts/split-glb.mjs chỉ đổi cách
// đóng gói; khi dựng cảnh chỉ đổi tỉ lệ và vị trí.
export const MAXWELL_CREDIT = {
  title: "Maxwell the cat (Dingus)",
  author: "bean (alwayshasbean)",
  licenseName: "CC BY 4.0",
  sourceUrl:
    "https://sketchfab.com/3d-models/maxwell-the-cat-dingus-2ca7f3c1957847d6a145fc35de9046b0",
  authorUrl: "https://sketchfab.com/alwayshasbean",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;
