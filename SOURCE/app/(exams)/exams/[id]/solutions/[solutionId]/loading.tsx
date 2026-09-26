// SolutionRouteLoading (C-40) — khung chờ của route xem MỘT bài giải. Khớp
// khung `PageContainer` của `page.tsx` thật (`size="small"`, đệm
// `px-4 py-6 sm:px-6 sm:py-8`, `gap-5`) để không có cú nhảy bố cục khi dữ liệu
// tới (UI Spec § Component: SolutionRouteLoading). Thứ tự khối giả đúng thứ tự
// trang thật (UI Spec § Component: SolutionViewScreen "Đang tải"): breadcrumb
// → thẻ người viết giả + nút giả → 6 hàng câu giả.
//
// Chiều cao từng khối CHƯA đo trên dev thật (đo bằng Playwright CLI phiên đăng
// nhập chia sẻ — hoãn cùng lý do tasks 08/10/18 đã hoãn phép đo L1, xem
// Investigation Notes task 21); khối giả ở đây khớp SỐ LƯỢNG và THỨ TỰ, không
// khớp px tuyệt đối.
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

      {/* Breadcrumb giả. */}
      <div className="bg-surface h-3 w-56 animate-pulse rounded-lg" />

      {/* Thẻ người viết giả. */}
      <div className="bg-surface rounded-card h-24 w-full animate-pulse" />

      {/* Nút giả ("Bảng câu hỏi"). */}
      <div className="bg-surface ml-auto h-11 w-32 animate-pulse rounded-lg" />

      {/* 6 hàng câu giả. */}
      <ol className="divide-border flex flex-col divide-y">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex min-h-14 items-center py-2">
            <div className="bg-surface h-10 w-full animate-pulse rounded-lg" />
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
