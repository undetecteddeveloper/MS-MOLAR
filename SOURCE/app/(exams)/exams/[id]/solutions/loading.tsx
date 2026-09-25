// SolutionRouteLoading (C-40) — khung chờ của route danh sách bài giải. Khớp
// khung `PageContainer` của `page.tsx` thật (`size="small"`, đệm
// `px-4 py-6 sm:px-6 sm:py-8`, `gap-5`) để không có cú nhảy bố cục khi dữ liệu
// tới (UI Spec § Component: SolutionRouteLoading). Thứ tự khối giả đúng thứ tự
// trang thật: đầu trang (breadcrumb/eyebrow/tiêu đề/mô tả) → khối bài của tôi
// → 3 thẻ.
//
// Chiều cao từng khối CHƯA đo trên dev thật (đo bằng Playwright CLI phiên đăng
// nhập chia sẻ — hoãn cùng lý do tasks 08/10 đã hoãn phép đo L1, xem
// Investigation Notes); khối giả ở đây khớp SỐ LƯỢNG và THỨ TỰ, không khớp px
// tuyệt đối.
import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>

      {/* Đầu trang: breadcrumb + eyebrow + tiêu đề + mô tả. */}
      <div className="flex flex-col gap-2">
        <div className="bg-surface h-3 w-48 animate-pulse rounded-lg" />
        <div className="bg-surface h-3 w-28 animate-pulse rounded-lg" />
        <div className="bg-surface h-8 w-64 max-w-full animate-pulse rounded-lg sm:h-9" />
        <div className="bg-surface h-5 w-72 max-w-full animate-pulse rounded-lg" />
      </div>

      {/* Khối "bài của tôi" giả. */}
      <div className="bg-surface rounded-card h-24 w-full animate-pulse" />

      {/* 3 thẻ giả. */}
      <ul className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="bg-surface rounded-card h-28 w-full animate-pulse" />
        ))}
      </ul>
    </PageContainer>
  );
}
