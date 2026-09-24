// SolutionRouteLoading (C-40) — khung chờ của màn viết bài giải. Khớp khung
// PageContainer của page.tsx thật (size="small", đệm px-4 py-6 sm:px-6
// sm:py-8) để không có cú nhảy bố cục khi dữ liệu tới (UI Spec § Component:
// SolutionRouteLoading). Thứ tự khối giả đúng thứ tự trang thật: đầu màn +
// hàng cài đặt + 8 hàng câu giả + thanh đáy giả.
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

      {/* Đầu màn: tiêu đề + nút bảng câu hỏi, thanh tiến độ + huy hiệu. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="bg-surface h-7 w-40 animate-pulse rounded-lg" />
          <div className="bg-surface h-11 w-32 animate-pulse rounded-lg" />
        </div>
        <div className="bg-surface h-2 w-full animate-pulse rounded-full" />
      </div>

      {/* Hàng "Cài đặt bài giải" đóng. */}
      <div className="bg-surface h-14 w-full animate-pulse rounded-lg" />

      {/* 8 hàng câu giả. */}
      <ol className="divide-border flex flex-col divide-y">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex min-h-14 items-center py-2">
            <div className="bg-surface h-10 w-full animate-pulse rounded-lg" />
          </li>
        ))}
      </ol>

      {/* Thanh đáy giả. */}
      <div className="bg-surface h-20 w-full animate-pulse rounded-lg" />
    </PageContainer>
  );
}
