// (analytics)/me/dashboard — /me/dashboard, đích của mục "Thống kê" trên thanh
// điều hướng (lib/nav/items.ts). Page-level auth guard mirrors
// (history)/history/page.tsx / (authoring)/upload/page.tsx: guard runs strictly
// before any data fetch.
//
// Bố cục theo theme "Sân trường" (2026-09-06, design plan §3 "Thống kê"):
// PageHeader (tiêu đề "Thống kê" hiện rõ + một câu nói trang này để làm gì —
// bản trước giấu tiêu đề sr-only và mở trang bằng một thẻ kẻ viền không đầu)
// → hàng chip Tuần / Tháng / Toàn thời gian → thẻ biểu đồ (dải Cột / Tròn ở đầu
// thẻ) → "Cần sửa chỗ nào" → thẻ VÀNG "Nên luyện gì tiếp theo" mang nút tới
// kho đề Toán. Thẻ vàng đứng CUỐI trên điện thoại: người mở "Thống kê" là để
// xem mình đang ở đâu, việc nên làm tiếp đến sau con số — cùng thứ tự với thẻ
// "Tiếp theo" đứng sau điểm ở trang kết quả. Từ 1024px thẻ vàng sang cột phải
// 20rem và dính theo cuộn; thứ tự DOM (thống kê trước, gợi ý sau) trùng thứ tự
// đọc trái → phải nên không cần `order-*`.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { getAnalyticsByRange, getSkillRecommendation } from "@/features/analytics/queries";
import { AnalyticsDashboard } from "@/features/analytics/components/AnalyticsDashboard";
import { SkillRecommendationCard } from "@/features/analytics/components/SkillRecommendationCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  // Song song chứ không nối tiếp: hai lệnh đọc độc lập nhau, để nối tiếp thì
  // gợi ý kỹ năng phải xếp hàng sau toàn bộ dữ liệu biểu đồ và làm trang chậm
  // đi đúng bằng thời gian của lệnh đọc kia (frontend DD § Constraints).
  // Ngữ nghĩa lỗi giữ nguyên như trước: một lệnh đọc hỏng thì cả trang đi vào
  // xử lý lỗi cấp trang — đúng thứ `await getAnalyticsByRange()` trần vẫn làm,
  // và đúng điều UI Spec đã chốt cho thẻ gợi ý (không có UI lỗi riêng cho nó).
  const [{ statsByRange, weakTopicsByRange }, recommendation] = await Promise.all([
    getAnalyticsByRange(),
    getSkillRecommendation(),
  ]);

  return (
    // `full` (72rem): từ 1024px trang chia hai cột và mép nội dung thẳng hàng
    // mép navbar (cùng 72rem). Dưới đó một cột, cùng nhịp lề với Kho đề.
    <PageContainer
      as="main"
      size="full"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("analytics.title")} description={t("analytics.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <AnalyticsDashboard dataByRange={statsByRange} weakTopicsByRange={weakTopicsByRange} />
        <SkillRecommendationCard recommendation={recommendation} className="lg:sticky lg:top-20" />
      </div>
    </PageContainer>
  );
}
