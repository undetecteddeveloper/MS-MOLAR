// Bài giải cộng đồng — NƠI DUY NHẤT biến cột danh tính/điểm bị che (JSON `null`)
// thành trường VẮNG MẶT trong kiểu TypeScript (frontend DD § Main Components).
//
// Vì sao phải là một chỗ: các RPC che danh tính trả `RETURNS TABLE`, nên
// PostgREST LUÔN gửi đủ mọi khoá — cột bị che mang giá trị `null` chứ không biến
// mất (D003). Nếu mỗi query hay component tự kiểm `null` theo cách riêng, chỉ một
// chỗ quên là tên hoặc ảnh của người ẩn danh lên màn hình (AC-039, AC-105).
//
// Thuần: không I/O, không import gì — module này nằm dưới mọi tính năng. Ký
// `author_avatar_path` thành URL là việc của features/solutions/queries.ts, làm
// TRƯỚC khi gọi vào đây.

/** Danh tính người viết/người bình luận mà component được phép thấy. Nhánh
 *  `anonymous` không có trường nào chứa được danh tính, nên render tên của một
 *  hàng ẩn danh là lỗi biên dịch chứ không phải lỗi lúc chạy. */
export type AuthorIdentity =
  | { kind: "named"; displayName: string; avatarUrl?: string }
  | { kind: "anonymous" };

/** `{ kind: "anonymous" }` khi và chỉ khi không có tên hiển thị. Tên là phép phân
 *  biệt DUY NHẤT — không đọc `author_id` hay URL ảnh để quyết định — nên một lỗi
 *  tương lai che tên mà sót ảnh vẫn không làm lộ được ảnh.
 *
 *  Với hàng có tên, `avatarUrl` là `author_avatar_url` nguyên vẹn, của mình hay
 *  của người khác như nhau (Alternative A — không chặn theo `is_mine`). URL
 *  `null` (chưa có ảnh, hoặc ký hỏng) thành khoá vắng mặt, để `Avatar` nhận
 *  `src: null` và hiện chữ cái đầu. */
export function toAuthorIdentity(row: {
  author_display_name: string | null;
  author_avatar_url: string | null;
}): AuthorIdentity {
  const { author_display_name: displayName, author_avatar_url: avatarUrl } = row;
  // `typeof` thay vì `=== null`: trong kiểu đã khai hai cách là một, nhưng một
  // hàng trôi dạng thiếu hẳn khoá tên phải rơi về ẩn danh (đóng khi lỗi), không
  // thành "người có tên undefined" mang theo ảnh thật.
  if (typeof displayName !== "string") {
    return { kind: "anonymous" };
  }
  return typeof avatarUrl === "string"
    ? { kind: "named", displayName, avatarUrl }
    : { kind: "named", displayName };
}

/** Bỏ hẳn khoá `score` khi điểm bị che (`show_score = false`); không bao giờ sinh
 *  `score: null` hay `score: undefined`, vì component kiểm sự CÓ MẶT
 *  (`"score" in item`) — nhờ vậy điểm 0 thật vẫn là điểm. Không sửa hàng đầu vào.
 *  Khoá vắng mặt được xử lý như `null`: lớp ánh xạ không được giả định hợp đồng
 *  RPC mãi đầy đủ (backend DD § Field Propagation Map). */
export function toScoreField<T extends { score: number | null }>(
  row: T
): Omit<T, "score"> & { score?: number } {
  const { score, ...rest } = row;
  if (score === null || score === undefined) {
    return rest;
  }
  return { ...rest, score };
}
