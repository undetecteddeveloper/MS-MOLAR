// countUnreadComments — công thức đếm chưa đọc dùng chung (quyết định của decomposer
// R6, backend task 26; backend DD § Data Contracts "community_my_comment_feed"
// New-comment rule, Reference Contract Value #23): "one formula, two call
// sites", được task 29 (huy hiệu trên thẻ danh sách từng đề) và task 45 (chip hồ sơ)
// dùng. Không task huy hiệu nào cài lại quy tắc này.
//
// Một hàng được tính là mới KHI VÀ CHỈ KHI isUnread && examVisible — không bao giờ chỉ
// isUnread. Tập hàng của feed vốn đã loại bình luận của chính người xem,
// bài giải nháp/ẩn (S7) và bình luận bị admin ẩn (S19); bộ lọc này
// áp phần loại trừ S8 còn lại (đề chưa published, hoặc tác giả của nó
// bị cấm) vào phép ĐẾM trong khi hàng vẫn hiện trong danh sách feed (AC-098):
// một bình luận ở đề S8 không hiển thị về kỹ thuật là chưa đọc nhưng không được tính
// là mới.
//
// Thuần: không I/O, không import — module này nằm dưới mọi tính năng
// dùng nó (cùng quy ước với lib/solutions/identity.ts).

/** Phần con của `CommentFeedItem` (features/solutions/queries.ts) mà công thức
 * này cần — giữ ở dạng cấu trúc thay vì import cả kiểu đầy đủ, để
 * module này không phụ thuộc vào gì cả. */
export interface UnreadCommentRow {
  solutionId: string;
  isUnread: boolean;
  examVisible: boolean;
}

/**
 * Đếm các hàng được tính là "mới" (AC-091, AC-092): `isUnread &&
 * examVisible`, có thể giới hạn trong các hàng của một bài giải (cách đếm theo từng đề
 * "k bình luận mới" use, task 29).
 */
export function countUnreadComments(
  rows: readonly UnreadCommentRow[],
  opts?: { solutionId?: string }
): number {
  return rows.reduce((count, row) => {
    if (opts?.solutionId !== undefined && row.solutionId !== opts.solutionId) {
      return count;
    }
    return row.isUnread && row.examVisible ? count + 1 : count;
  }, 0);
}
