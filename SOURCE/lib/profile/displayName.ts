// /profile — the display-name rule, in one place.
//
// Bộ lọc phía client bên dưới từng tồn tại hai bản y hệt nhau, ở
// components/shared/HeaderProfile.tsx và features/auth/components/
// SidebarProfile.tsx, và /profile sẽ là bản thứ ba. Các luật phía server
// trong updateProfile (features/auth/actions.ts) là lần phát biểu thứ tư của
// cùng hai hằng số, viết thành literal nội tuyến — nên đổi giới hạn
// độ dài là có bốn chỗ để sót.
//
// Lọc ở client là tiện lợi, không phải cưỡng chế: updateProfile kiểm lại
// mọi luật ở server (PRD AC-043–AC-045), vì một POST tự chế không bao giờ chạy
// handler onChange.

export const DISPLAY_NAME_MAX = 12;

/** Chữ cái (mọi hệ chữ — `\p{L}` bao cả tiếng Việt có dấu) và dấu chấm.
 *  Cố ý không dùng `/g` hay `/y`: regex có trạng thái dùng lại giữa các lần gửi
 *  sẽ luân phiên true/false với cùng một đầu vào. */
export const DISPLAY_NAME_RE = /^[\p{L}.]+$/u;

/** Bỏ mọi ký tự mà luật cấm, rồi cắt theo độ dài — dạng mà một
 *  input có kiểm soát cần, nơi từ chối một phím bấm tốt hơn là hiện lỗi. */
export function filterDisplayNameInput(raw: string): string {
  return raw.replace(/[^\p{L}.]/gu, "").slice(0, DISPLAY_NAME_MAX);
}
