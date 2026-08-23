// (layer3)/me/dashboard — /me/dashboard, the existing "Analytics" nav item's
// target (SiteHeader.tsx/HomeSidebar.tsx already point here; route groups are
// pathless, so no nav change was needed once this page exists — docs/design/
// analytics-layer3-design.md § Route & nav). Page-level auth guard mirrors
// (HM)/history/page.tsx / (layer4)/upload/page.tsx: guard runs strictly
// before any data fetch.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";
import { getAnalyticsByRange, getSkillRecommendation } from "@/app/(layer3)/queries";
import { AnalyticsDashboard } from "@/app/(layer3)/_components/AnalyticsDashboard";
import { SkillRecommendationCard } from "@/app/(layer3)/_components/SkillRecommendationCard";
import { PageContainer } from "@/components/layout/PageContainer";

export default async function DashboardPage() {
  const t = await getTranslate();
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
    // `full` (72rem) thay max-w-4xl cũ: đây là trang lưới dữ liệu — biểu đồ có
    // càng nhiều bề ngang thì các cột càng đọc được, và mép nội dung thẳng hàng
    // mép navbar (cùng 72rem).
    <PageContainer as="main" size="full">
      <h1 className="sr-only">{t("analytics.title")}</h1>

      <div className="mt-6">
        <SkillRecommendationCard recommendation={recommendation} />
      </div>

      <div className="mt-6">
        <AnalyticsDashboard dataByRange={statsByRange} weakTopicsByRange={weakTopicsByRange} />
      </div>
    </PageContainer>
  );
}
