// SolutionList (C-04) — khung danh sách bài giải của một đề (S-03): khối "bài
// của tôi", danh sách thẻ theo ĐÚNG thứ tự server trả về (UI-D24/AC-054), và
// khung nét đứt rỗng (AC-056). UI Spec § Component: SolutionList; frontend DD
// § Main Components "features/solutions/components/SolutionList.tsx + SolutionCard.tsx".
//
// Header (breadcrumb/eyebrow/tiêu đề/mô tả) do route `page.tsx` dựng, KHÔNG
// phải ở đây: breadcrumb cần tên đề — dữ liệu SolutionList (interface chốt ở
// frontend DD §829: `{examId, items, own, now}`, `unreadCommentCount` thêm bởi
// task 29 theo đúng cách `editHref` đã thêm ở v1.4) không nhận — trong khi
// `page.tsx` đã đọc đề đó cho chính header của nó (AC-052). SolutionList chỉ
// lo phần "khung danh sách": khối bài của tôi + `ul` các thẻ + trạng thái rỗng.
//
// `editHref` dựng MỘT LẦN ở đây từ `own.attemptId`, giao cho ĐÚNG một hàng có
// `item.isMine === true` — không có nhánh nào trong `SolutionCard` tự kiểm lại
// `isMine` cho liên kết này (frontend DD § SolutionCard/SolutionList, "editHref (v1.4)").
// `unreadCommentCount` (task 29) do route tính sẵn (`getMyUnreadCommentCount`,
// task 26) và chỉ chuyển tiếp ở đây — CÙNG một quy tắc "chỉ hàng isMine" với
// `editHref`, không tính lại gì.
import { OwnSolutionBlock, type OwnSolutionSummary } from "@/features/solutions/components/OwnSolutionBlock";
import { SolutionCard } from "@/features/solutions/components/SolutionCard";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import type { SolutionListItem } from "@/features/solutions/queries";

export interface SolutionListProps {
  examId: string;
  items: SolutionListItem[];
  own: OwnSolutionSummary;
  now: Date;
  /** Số "bình luận mới" của bài published của chính người xem trên đề này
   *  (AC-091/AC-092, task 29) — route đã tính sẵn qua `getMyUnreadCommentCount`
   *  (task 26); giao đúng MỘT lần cho hàng `item.isMine === true`, cùng quy
   *  ước `editHref` ngay dưới đây. */
  unreadCommentCount?: number;
}

export function SolutionList({ examId, items, own, now, unreadCommentCount }: SolutionListProps) {
  const editHref = `/exams/${examId}/attempt/${own.attemptId}/solution`;

  return (
    <>
      <OwnSolutionBlock summary={own} examId={examId} />

      {items.length === 0 ? (
        // AC-056: khung nét đứt ngay dưới khối đầu — không thay thế khối đầu,
        // không render trước nó.
        <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">{t("solutions.list.empty")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <SolutionCard
              key={item.id}
              item={item}
              examId={examId}
              now={now}
              editHref={item.isMine ? editHref : undefined}
              unreadCommentCount={item.isMine ? unreadCommentCount : undefined}
            />
          ))}
        </ul>
      )}
    </>
  );
}
