// Skeleton của /admin/tickets — khuôn của (history)/history/loading.tsx: cùng
// PageContainer size/padding và nhịp gap với page.tsx để nội dung không giật
// khi khung xương được thay bằng dữ liệu. Tiêu đề + mô tả → bốn hàng thẻ (mỗi
// hàng cao bằng một TicketQueueRow thu gọn: đệm 12 + hàng nhãn 24 + trích
// đoạn 20 + khe 8 + đệm 12 = 76px; từ sm đệm 16 → 84px).

import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>

      <div className="flex flex-col gap-2">
        <div className="bg-surface h-8 w-48 animate-pulse rounded-lg sm:h-9" />
        <div className="bg-surface h-6 w-80 max-w-full animate-pulse rounded-lg" />
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface rounded-card h-[4.75rem] animate-pulse sm:h-[5.25rem]" />
        ))}
      </div>
    </PageContainer>
  );
}
