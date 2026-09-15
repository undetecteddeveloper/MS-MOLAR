// Phép đọc CSS dùng chung cho cổng verify:deployed (scripts/verify-deployed-assets.mjs).
//
// Tách ra module riêng (2026-09-15) để kiểm được CHÍNH CỔNG mà không phải gọi
// mạng: một đoạn CSS cũ lưu sẵn đưa thẳng vào các hàm này phải ra "lệch". Cổng
// đã một lần im lặng cho qua đúng thứ nó sinh ra để bắt (xem `varValueDrift`).

/** Tên biến CSS được KHAI BÁO (`--foo: value`), không tính chỗ ĐỌC (`var(--foo)`).
 *  Phân biệt này quan trọng: một bundle thiếu khối khai báo vẫn còn đầy chỗ đọc,
 *  nên đếm cả hai sẽ không thấy gì bất thường. */
export function declaredVars(css) {
  const out = new Set();
  for (const m of css.matchAll(/(^|[;{\s])(--[a-zA-Z0-9_-]+)\s*:/g)) out.add(m[2]);
  return out;
}

/** Tên biến → TẬP giá trị được khai (một biến có thể khai ở nhiều khối: `:root`,
 *  media query, selector trạng thái). Chuẩn hoá khoảng trắng và hoa/thường, KHÔNG
 *  chuẩn hoá cú pháp màu (`#fff` vs `#ffffff`): hai phía đi qua CÙNG bộ nén CSS
 *  của cùng phiên bản Next (khoá trong package-lock), nên cùng đầu vào cho ra
 *  cùng một chuỗi — chuẩn hoá thêm chỉ mở chỗ cho hai giá trị khác nhau trùng
 *  nhau sau khi chuẩn hoá. */
export function declaredVarValues(css) {
  const out = new Map();
  for (const m of css.matchAll(/(^|[;{\s])(--[a-zA-Z0-9_-]+)\s*:([^;}]*)/g)) {
    const value = m[3].trim().replace(/\s+/g, " ").toLowerCase();
    if (!out.has(m[2])) out.set(m[2], new Set());
    out.get(m[2]).add(value);
  }
  return out;
}

/** Selector class (`.foo`). Đủ để bắt một khối CSS thuần biến mất; cố ý KHÔNG
 *  parse toàn bộ ngữ pháp CSS — cổng này cần đáng tin, không cần hoàn hảo. */
export function classSelectors(css) {
  const out = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)(?=[\s,{:>.[)])/g)) out.add(m[1]);
  return out;
}

/**
 * Mọi giá trị biến mà build cục bộ khai phải có mặt, ĐÚNG GIÁ TRỊ, trong bản đã
 * deploy. Trả về danh sách lệch (rỗng = khớp).
 *
 * VÌ SAO CẦN (TD-024 lần 4, 2026-09-14): cổng chỉ so TÊN biến và TÊN selector.
 * Lượt đổi sang theme nền tối ra production với HTML mới kèm CSS của theme nền
 * sáng cũ — mà gần như MỌI tên biến vẫn y hệt (`--background`, `--primary`…),
 * chỉ giá trị khác. Cổng bắt được chỉ vì lượt đó tình cờ thêm vài biến tên mới.
 * Một lượt đổi theme chỉ sửa mã màu sẽ đi qua cổng trong khi production phục vụ
 * bảng màu cũ.
 *
 * So MỘT CHIỀU (cục bộ ⊆ deploy): bản deploy nạp gộp nhiều file CSS nên một biến
 * có thể mang thêm giá trị từ file khác — thừa không phải lỗi, thiếu mới là lỗi.
 */
export function varValueDrift(localValues, deployedValues) {
  const drift = [];
  for (const [name, values] of localValues) {
    const deployed = deployedValues.get(name);
    for (const value of values) {
      if (deployed?.has(value)) continue;
      drift.push({ name, local: value, deployed: deployed ? [...deployed] : [] });
    }
  }
  return drift;
}
