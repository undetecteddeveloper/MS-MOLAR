// groupQuestionsByPart — chia danh sách câu của một đề thành các MỤC theo PHẦN
// để bảng câu hỏi (QuestionPagination) hiện nhãn "PHẦN I…" phía trên mỗi lưới.
//
// Thuần: không I/O. Trả `undefined` khi đề chỉ có một phần (hoặc không có dữ liệu
// phần) — nơi gọi truyền thẳng vào prop `groups` và bảng tự rơi về lưới phẳng.
// Thứ tự mục = thứ tự phần xuất hiện đầu tiên trong đề; `indices` là index 0-based
// vào CHÍNH mảng `questions` (cùng không gian với `current`/`cells` của bảng).

import { t } from "@/lib/copy";
import type { QuestionGroup } from "@/components/shared/QuestionPagination";

export function groupQuestionsByPart(
  questions: ReadonlyArray<{ partNumber?: number | null }>,
  parts?: ReadonlyArray<{ number: number; title: string }> | null
): QuestionGroup[] | undefined {
  const order: number[] = [];
  const byPart = new Map<number, number[]>();
  questions.forEach((q, index) => {
    const part = q.partNumber ?? 1;
    if (!byPart.has(part)) {
      byPart.set(part, []);
      order.push(part);
    }
    byPart.get(part)!.push(index);
  });
  if (order.length < 2) return undefined;

  return order.map((part) => ({
    title: parts?.find((p) => p.number === part)?.title ?? t("upload.partLabel", { part }),
    indices: byPart.get(part)!,
  }));
}
