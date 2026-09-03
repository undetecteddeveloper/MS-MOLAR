// /profile — lớp CSS dùng chung của thẻ hồ sơ. Bốn ô nhập nằm ở hai file khác
// nhau (DisplayNameEditor, ChangePasswordDialog) và năm nút viền nằm ở năm chỗ,
// nên chúng ở đây thay vì được chép đi chép lại.
//
// ⚠ CHÉP THEO MẪU từ features/authoring/components/MetadataFields.tsx:45-57, KHÔNG
// import components/ui/input.tsx. Component đó có ĐÚNG KHÔNG chỗ gọi nào trong
// repo: `h-8` của nó là 32px — hụt 12px so với sàn chạm 44px — và `rounded-lg`
// của nó chọi lại họ bo góc 4px mà mọi form thật trong repo đang dùng. Dựng lại
// nó ở đây là hồi sinh một component mà codebase đã lặng lẽ loại bỏ, và làm việc
// đó trên một form mật khẩu.
//
// Hai tính chất phải sống sót khi chép:
//   - `min-h-11` là TƯỜNG MINH vì `px-3 py-2.5 text-sm` tính ra đúng 42px, hụt
//     2px so với sàn 44px;
//   - viền lúc focus là ĐỒNG --ring, còn ĐỎ SON --brand để dành riêng cho lỗi,
//     nên "đang gõ" và "gõ sai" không bao giờ trông giống nhau.

/** Ô nhập text/password. `hasError` đổi viền sang đỏ son. */
export function fieldInputCls(hasError: boolean): string {
  return [
    "mt-1.5 min-h-11 w-full rounded-[4px] border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200",
    hasError ? "border-brand" : "border-border focus:border-ring",
  ].join(" ");
}

/** Dòng lỗi dưới ô nhập. */
export const fieldErrorCls = "mt-1 animate-in fade-in text-xs text-brand duration-200";

/** Gợi ý phụ dưới ô nhập / dưới nút chọn tệp. */
export const fieldHintCls = "mt-1 text-xs text-muted-foreground";

/**
 * Nút hành động dạng viền — nút của cả ba hàng, Huỷ, và Đăng xuất.
 *
 * KHÔNG phải viên thuốc (UI-D2): globals.css:148-160 nói rõ hình viên thuốc là
 * dành cho hành động CHÍNH đặt cạnh thẻ nội dung sắc cạnh, và chính sự tương
 * phản HÌNH DẠNG đó mới là thứ kéo mắt. Thẻ /profile không có hành động chính —
 * ba hàng là ba việc ngang hàng nhau. Bo tròn cả bốn là tiêu sự tương phản đó
 * bốn lần, tức tiêu nó không lần nào.
 */
export const outlineButtonCls =
  "border-border text-foreground hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 inline-flex min-h-11 items-center justify-center rounded-[4px] border px-4 py-2 text-sm transition-colors outline-none focus-visible:ring-3 aria-disabled:opacity-60";

/**
 * Nhãn đóng vai NÚT cho một `<input type="file">` mang `peer sr-only` đứng ngay
 * TRƯỚC nó. Giống `outlineButtonCls` từng nét trừ hai chỗ, và cả hai đều bắt
 * buộc: vòng tiêu điểm phải soi qua `peer-focus-visible:*` vì `<label>` không
 * bao giờ nhận tiêu điểm — cái nhận là input ẩn — nên `focus-visible:*` gắn
 * thẳng lên nhãn sẽ không khớp lần nào; và `cursor-pointer` vì nhãn không phải
 * nút nên trình duyệt không tự đổi con trỏ.
 */
export const outlineFilePickerCls =
  "border-border text-foreground hover:bg-accent peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[4px] border px-4 py-2 text-sm transition-colors peer-focus-visible:ring-3";

/** Hành động CHÍNH duy nhất của tính năng: nút gửi của hộp thoại đổi mật khẩu. */
export const pillButtonCls =
  "bg-brand text-brand-foreground focus-visible:ring-ring/50 inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 aria-disabled:opacity-60";

/** Cặp nút hành động. Căn PHẢI: "Huỷ"/"Lưu" tiếng Việt chỉ 3–4 ký tự, trải đều
 *  trong một hàng giãn hết bề ngang thì trông rỗng ruột. */
export const actionRowCls = "mt-4 flex justify-end gap-3";
