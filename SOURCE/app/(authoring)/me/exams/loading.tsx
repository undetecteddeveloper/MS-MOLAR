// Loading state cho /me/exams — khung xương khớp bố cục của page.tsx (cùng
// PageContainer size/padding, cùng nhịp gap-5): lệch một nấc đệm thì nội dung
// giật lên/xuống đúng lúc khung xương được thay bằng dữ liệu. Ba khối theo
// đúng thứ tự trang: tiêu đề + mô tả + nút → hàng chip → ba thẻ hàng đề (mỗi
// thẻ cao bằng một ExamRow tên một dòng: đệm 12 + nhãn 20 + tên 22 + meta 20 +
// nút 36 + ba khe 8 + mt 4 + đệm 12 = 150px; từ sm đệm 16 → 158px).
//
// Trang con /me/exams/[id] có loading.tsx riêng — bố cục khác hẳn.

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
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="bg-surface h-8 w-36 animate-pulse rounded-lg sm:h-9" />
          <div className="bg-surface h-11 w-40 animate-pulse rounded-full" />
        </div>
        <div className="bg-surface h-6 w-80 max-w-full animate-pulse rounded-lg" />
      </div>

      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-surface h-10 w-32 animate-pulse rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface rounded-card h-[9.375rem] animate-pulse sm:h-[9.875rem]"
          />
        ))}
      </div>
    </PageContainer>
  );
}
