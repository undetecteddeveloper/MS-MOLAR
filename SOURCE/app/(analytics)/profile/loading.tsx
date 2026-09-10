// Skeleton của /profile — khuôn của (history)/history/loading.tsx.
//
// Phải khớp CHÍNH XÁC size + padding của page.tsx (`small`, cùng nhịp đệm):
// lệch một nấc thì nội dung giật lên/xuống đúng lúc skeleton được thay bằng dữ
// liệu thật. Hai khối theo đúng thứ tự trang: tiêu đề + mô tả → thẻ hồ sơ.
//
// Chiều cao thẻ ĐO trên dev 2026-09-10, không ước lượng: 415px dưới 640px (nút
// "Đổi ảnh" xuống hàng riêng dưới ảnh) và 323px từ 640px (ảnh, cụm chữ và nút
// cùng một hàng). Sửa bố cục cụm danh tính thì đo lại hai con số này.

import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>

      <div className="flex flex-col gap-2">
        <div className="bg-surface h-8 w-40 animate-pulse rounded-lg sm:h-9" />
        <div className="bg-surface h-6 w-80 max-w-full animate-pulse rounded-lg" />
      </div>

      <div className="bg-surface rounded-card h-[25.9375rem] animate-pulse sm:h-[20.1875rem]" />
    </PageContainer>
  );
}
