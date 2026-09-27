// ProfileCommentsTab (C-35) — nội dung ô "Bình luận" của hồ sơ, render theo
// `?tab=comments` (UI Spec § Component: ProfileCommentsTab; frontend DD §
// Data Contracts "Comment feed contract"). Server Component: đọc
// `getMyCommentFeed(page)` trực tiếp — không có state client nào giữ dữ liệu
// giữa các lượt render (URL là nguồn sự thật duy nhất, cùng quy ước
// `ProfileTabs`/`HistoryList`).
//
// "Xem thêm" (AC-097) KHÔNG phải một fetch phía client: bấm nó điều hướng tới
// `?tab=comments&cpage={page+1}` (giữ nguyên vị trí cuộn, `scroll={false}`),
// khiến trang server-render LẠI toàn bộ tab này với `page` lớn hơn — component
// tự đọc CỘNG DỒN từ trang 1 tới `page` rồi nối lại, nên danh sách "nối thêm"
// đúng nghĩa dù mỗi lượt render đều là một lượt đọc mới. Lý do bắt buộc phải
// đi đường này thay vì một Server Action trả dữ liệu thô cho client tự dựng
// thẻ: `CommentNotificationCard` chứa `RichText` (ADR-0002/TD-021) — component
// đó CHỈ được phép dựng ở SERVER, nên trang phải là nơi dựng lại toàn bộ danh
// sách, không phải một mảng dữ liệu client tự map.
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CommentNotificationCard } from "@/features/solutions/components/CommentNotificationCard";
import { getMyCommentFeed, getMyReputation, type CommentFeedItem } from "@/features/solutions/queries";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

// Cỡ trang mà `getMyCommentFeed` TỰ dùng cho mọi lời gọi RPC (queries.ts,
// hằng `COMMENT_FEED_PAGE_SIZE`, không xuất ra ngoài module đó) — một trang
// ĐẦY (đúng cỡ này) là tín hiệu DUY NHẤT "có thể còn trang sau", vì mỗi lời
// gọi `getMyCommentFeed(page)` luôn tự giới hạn đúng cỡ này bất kể ai gọi. Đặt
// lại hằng số ở đây (không sửa `queries.ts`, ngoài phạm vi Target Files của
// task 45) — nếu giá trị gốc đổi, chỉ ảnh hưởng heuristic "còn trang" (một lượt
// bấm "Xem thêm" thừa vô hại, trang sau trả rỗng), không ảnh hưởng dữ liệu.
const COMMENT_FEED_PAGE_SIZE = 20;

export interface ProfileCommentsTabProps {
  /** Trang CAO NHẤT cần hiện — trang cha (`page.tsx`) đọc từ `?cpage=`.
   *  Component tự đọc lại từ trang 1 tới đây và nối (1-based, mặc định 1). */
  page: number;
}

/** `publishedCount` cho dòng how-to ở trạng thái rỗng (AC-099) — dùng lại
 *  đúng nguồn `getMyReputation()` mà `ReputationBlock` (task 44) đã dùng, chỉ
 *  gọi khi feed rỗng (tránh một lượt đọc thừa cho trường hợp thường gặp: còn
 *  bình luận). Lỗi/thất bại ⇒ `null`, coi như "không biết" — KHÔNG hiện dòng
 *  how-to (an toàn hơn hiện nhầm), cùng tinh thần AC-096 "thất bại ⇒ không có
 *  khối" của `tryGetMyReputation` trong `page.tsx` (không import chéo, bản sao
 *  riêng của tính năng — hai lần xuất hiện, chưa tới ngưỡng gộp của Rule of Three). */
async function tryGetPublishedCount(): Promise<number | null> {
  try {
    const result = await getMyReputation();
    return result.ok ? result.publishedCount : null;
  } catch {
    return null;
  }
}

/** Đọc CỘNG DỒN từ trang 1 tới `page` (song song — mỗi trang độc lập với
 *  RPC), rồi nối lại đúng thứ tự trang. `hasMore` chỉ nhìn TRANG CUỐI vừa đọc:
 *  đầy đúng cỡ trang ⇒ có thể còn; ngắn hơn hoặc rỗng ⇒ chắc chắn hết (Quá
 *  trang cuối → mảng rỗng, không lỗi — đúng hợp đồng `getMyCommentFeed`). */
async function loadCommentFeedThroughPage(
  page: number
): Promise<{ items: CommentFeedItem[]; hasMore: boolean }> {
  const pages = await Promise.all(
    Array.from({ length: page }, (_unused, index) => getMyCommentFeed(index + 1))
  );
  const lastPage = pages[pages.length - 1] ?? [];
  return { items: pages.flat(), hasMore: lastPage.length === COMMENT_FEED_PAGE_SIZE };
}

export async function ProfileCommentsTab({ page }: ProfileCommentsTabProps) {
  let feed: { items: CommentFeedItem[]; hasMore: boolean };
  try {
    feed = await loadCommentFeedThroughPage(page);
  } catch {
    // Lỗi truy vấn THẬT (ném ngoại lệ) — khác "quá trang cuối" (mảng rỗng,
    // không phải lỗi). role=alert cục bộ trong tab, không kéo cả trang xuống
    // error.tsx (tab Tài khoản vẫn dùng được bình thường).
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-destructive text-sm">{t("profile.comments.loadError")}</p>
        <a
          href="/profile?tab=comments"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {t("common.retry")}
        </a>
      </div>
    );
  }

  if (feed.items.length === 0) {
    const publishedCount = await tryGetPublishedCount();
    return (
      <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-12 text-center">
        <p className="text-muted-foreground text-sm">{t("profile.comments.empty")}</p>
        {publishedCount === 0 && (
          <p className="text-muted-foreground text-sm">{t("profile.comments.emptyHowTo")}</p>
        )}
      </Card>
    );
  }

  const now = new Date();

  return (
    <ul className="flex flex-col gap-3">
      {feed.items.map((item) => (
        <CommentNotificationCard key={item.commentId} item={item} now={now} />
      ))}
      {feed.hasMore && (
        <li>
          <Link
            href={`/profile?tab=comments&cpage=${page + 1}`}
            scroll={false}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}
          >
            {t("profile.comments.more")}
          </Link>
        </li>
      )}
    </ul>
  );
}
