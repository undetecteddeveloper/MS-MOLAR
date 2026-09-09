// Loading state cho /me/exams/[id] (màn rà soát). Trước đây trang này dùng
// chung khung xương của /me/exams — ba hàng thấp trong khi trang thật mở đầu
// bằng breadcrumbs + tiêu đề + khối thông tin đề cao, nên nội dung nhảy đúng
// lúc dữ liệu về. Khung ở đây khớp phần ĐẦU trang (thứ luôn có mặt): crumb 20
// + tiêu đề 30 + mô tả 24 → khối thông tin đề → hai thẻ câu. Số câu và chiều
// cao mỗi câu thay đổi theo đề nên phần dưới chỉ là ước lượng.

import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="bg-surface mb-1 h-4 w-40 animate-pulse rounded" />
          <div className="flex items-start justify-between gap-6">
            <div className="bg-surface h-8 w-64 max-w-full animate-pulse rounded-lg sm:h-9" />
            <div className="bg-surface h-6 w-24 shrink-0 animate-pulse rounded-full" />
          </div>
          <div className="bg-surface h-6 w-24 animate-pulse rounded-lg" />
        </div>
        <div className="bg-surface rounded-card h-[26rem] animate-pulse" />
        <div className="bg-surface rounded-card h-40 animate-pulse" />
        <div className="bg-surface rounded-card h-40 animate-pulse" />
      </div>
    </PageContainer>
  );
}
