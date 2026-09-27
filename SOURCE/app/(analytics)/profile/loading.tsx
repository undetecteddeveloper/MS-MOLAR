// Skeleton của /profile — khuôn của (history)/history/loading.tsx.
//
// Phải khớp CHÍNH XÁC size + padding của page.tsx (`small`, cùng nhịp đệm):
// lệch một nấc thì nội dung giật lên/xuống đúng lúc skeleton được thay bằng dữ
// liệu thật. BA khối theo đúng thứ tự trang: tiêu đề + mô tả → hàng chip
// `ProfileTabs` → thẻ hồ sơ (hàng chip + khối uy tín trong thẻ do task 44
// thêm sau lần đo đầu 2026-09-10 — TBD-01, đóng lại ở đây).
//
// Chiều cao ĐO LẠI trên dev 2026-09-27 (Playwright CLI, tài khoản test có 1
// bài giải đã đăng nên `ReputationBlock` CÓ mặt trong thẻ — nhánh phổ biến):
// - Khối tiêu đề + mô tả: 92.5px dưới 640px / 71.5px từ 640px (mô tả xuống
//   2 dòng ở bề rộng hẹp, tiêu đề chữ to hơn nhưng mô tả 1 dòng bù lại ở rộng).
// - Hàng chip: 44px cả hai mốc — đúng bằng Tailwind `h-11`, cùng lớp
//   `ProfileTabs.tsx` gắn cho từng chip.
// - Thẻ hồ sơ: 602px dưới 640px / 510px từ 640px — cao hơn số đo 2026-09-10
//   (415px/323px) đúng 187px ở CẢ HAI mốc, khớp chiều cao cố định của
//   `ReputationBlock` (167px, không đổi theo bề rộng, đo riêng) cộng kẻ chia.
//
// `reputationSlot` của `ProfileCard` có thể VẮNG khi `getMyReputation()` lỗi
// (thẻ thấp hơn ~167px). Skeleton khớp nhánh CÓ slot (số đo ở trên) — chọn
// có chủ đích: trang thật thấp hơn skeleton một chút ở nhánh lỗi giật ít hơn
// hẳn so với chiều ngược lại (skeleton thấp hơn trang thật), nên lấy số đo
// lớn hơn làm khuôn chung thay vì dựng hai skeleton cho hai nhánh dữ liệu.
// Sửa bố cục cụm danh tính hoặc `ReputationBlock` thì đo lại các con số này.

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

      <div className="flex h-[5.78125rem] flex-col gap-2 sm:h-[4.46875rem]">
        <div className="bg-surface h-8 w-40 animate-pulse rounded-lg sm:h-9" />
        <div className="bg-surface h-6 w-80 max-w-full animate-pulse rounded-lg" />
      </div>

      <div className="flex gap-2">
        <div className="bg-surface h-11 w-28 animate-pulse rounded-full" />
        <div className="bg-surface h-11 w-32 animate-pulse rounded-full" />
      </div>

      <div className="bg-surface rounded-card h-[37.625rem] animate-pulse sm:h-[31.875rem]" />
    </PageContainer>
  );
}
