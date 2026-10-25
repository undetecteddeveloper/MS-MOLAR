// /profile — initials for the avatar fallback (Design Doc §Backend contracts).
//
// Dấu chấm là dấu phân tách DUY NHẤT đáng xử lý: tên hiển thị phải khớp
// DISPLAY_NAME_RE (chữ cái và dấu chấm), nên khoảng trắng không thể xuất hiện trong tên đã lưu.
// Tách thêm theo khoảng trắng sẽ là mã chết giả vờ phòng thủ.
//
// Không bao giờ ném lỗi và không bao giờ trả về undefined — nơi gọi render cái này thay cho
// ảnh, và một exception trên đường đó biến "không có ảnh" thành "không có trang"
// (PRD AC-033b, AC-040).

/** Chữ cái đầu của mỗi đoạn trong hai đoạn đầu tách bằng dấu chấm, viết hoa.
 *  Một đoạn cho một ký tự; không có gì dùng được thì trả `""`. */
export function deriveInitials(displayName: string): string {
  return displayName
    .split(".")
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .map(firstCharacter)
    .join("")
    .toUpperCase();
}

/** `Array.from` thay vì `[0]`: truy cập chỉ mục trả về một code unit UTF-16, nên
 *  ký tự ngoài BMP sẽ bị cắt đôi thành nửa surrogate không hiển thị được.
 *  Chữ tiếng Việt dựng sẵn (Đ, Ứ) hiện đều nằm trong BMP,
 *  chính vì vậy mà phiên bản sai của dòng này trông vẫn đúng. */
function firstCharacter(segment: string): string {
  return Array.from(segment)[0] ?? "";
}
