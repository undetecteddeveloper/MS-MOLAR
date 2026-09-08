// Loading state for /history — khung xương khớp CHÍNH XÁC bố cục của page.tsx
// (cùng PageContainer size/padding, cùng nhịp gap-5): lệch một nấc đệm thì nội
// dung giật lên/xuống đúng lúc khung xương được thay bằng dữ liệu. Ba khối theo
// đúng thứ tự trang: tiêu đề + mô tả → hàng chip → năm hàng thẻ (mỗi hàng cao
// bằng một HistoryRow thật có tên đề một dòng: đệm 12 + hàng nhãn 36 + tên 22 +
// meta 20 + hai khe 8 + đệm 12 = 110px ở 360px; từ sm đệm 16 → 118px).

import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>

      <div className="flex flex-col gap-2">
        <div className="bg-surface h-8 w-32 animate-pulse rounded-lg sm:h-9" />
        <div className="bg-surface h-6 w-80 max-w-full animate-pulse rounded-lg" />
      </div>

      <div className="flex gap-2 pb-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface h-10 w-24 animate-pulse rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-surface rounded-card h-[6.875rem] animate-pulse sm:h-[7.375rem]"
          />
        ))}
      </div>
    </PageContainer>
  );
}
