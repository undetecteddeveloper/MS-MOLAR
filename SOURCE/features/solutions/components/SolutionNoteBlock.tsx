// SolutionNoteBlock — khối "Lời giải" của một câu ở màn xem (UI Spec §
// Component: SolutionNoteBlock; AC-060). Server Component CỐ Ý: render nội
// dung ghi chú qua `RichText` TRỰC TIẾP (import tĩnh, KHÔNG nạp động) — UI-D22
// nói rõ đề câu/ghi chú của một hàng câu đang mở phải hiện NGAY, khác hẳn hai
// chỗ nạp động duy nhất của tính năng này ("Xem trước công thức" ở màn viết và
// nội dung bình luận trong tấm trượt bình luận).
//
// KHÔNG BAO GIỜ import file này (hay `RichText`) từ một component "use client"
// dưới `features/solutions/` (ADR-0002, TD-021/TD-023 — xem chú thích đầu
// `RichText.tsx`): một import tĩnh từ component client kéo nguyên cây phụ
// thuộc 122,5 KB gzip của RichText vào bundle của route đó. Nơi gọi đúng là
// một Server Component phía trên `SolutionQuestionRow` (task 21), dựng sẵn
// `<SolutionNoteBlock/>` thành `note.bodyNode: ReactNode` rồi truyền xuống —
// cùng khuôn `writerQuestionNodes.tsx` đã dùng cho `stemNode`/`correctAnswerNode`.
//
// `titleId` do nơi gọi cấp (không tự sinh `useId()` — component này là Server
// Component, không có hook): mỗi câu một khối riêng trên cùng một trang, một
// chuỗi id tĩnh sẽ trùng lặp giữa các hàng.
import { Card } from "@/components/ui/card";
import { RichText } from "@/components/shared/RichText";
import { t } from "@/lib/copy";

export interface SolutionNoteBlockProps {
  /** Thân ghi chú — chuỗi thô (markdown + LaTeX), chưa qua RichText. */
  text: string;
  /** Id gắn lên `span.eyebrow` — `aria-labelledby` của khối trỏ vào đây. */
  titleId: string;
}

export function SolutionNoteBlock({ text, titleId }: SolutionNoteBlockProps) {
  return (
    <Card as="section" variant="tint" padding="compact" aria-labelledby={titleId} className="gap-2">
      <span id={titleId} className="eyebrow">
        {t("solutions.view.solutionLabel")}
      </span>
      <RichText text={text} className="text-foreground text-base leading-relaxed" />
    </Card>
  );
}
