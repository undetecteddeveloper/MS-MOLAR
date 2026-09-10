// /profile — trang quản lý tài khoản (PRD R1..R9, UI Spec S-01).
//
// Khung (SkipLink, SiteHeader, #main-content, .pb-bottom-nav, BottomNav,
// SupportWidget) do app/(analytics)/layout.tsx cấp. Trang này KHÔNG khai lại
// `#main-content` và KHÔNG khai lại SkipLink (PRD D2, AC-003).
//
// Theme "Sân trường" (2026-09-10): PageHeader chuẩn ("Hồ sơ của bạn" + một câu
// nói trang này gồm gì) thay tiêu đề `sr-only` của bản trước — cùng lối với
// Thống kê và Lịch sử. Bề rộng `small` (672px): trang một-tác-vụ với vài hàng
// ngắn; ở scaffold rộng hơn, nhãn của mỗi hàng và nút hành động của nó rơi về
// hai đầu đối diện của quãng mắt phải đi.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/features/profile/components/ProfileCard";

// KHÔNG khai `alternates.canonical` — khác /terms và /about một cách có chủ ý:
// trang này bị robots.ts chặn (nội dung của nó là dữ liệu cá nhân), nên một
// canonical riêng chỉ để công bố một URL không ai được bò vào.
export const metadata: Metadata = {
  title: "Hồ sơ",
};

export default async function ProfilePage() {
  // Chốt chặn cấp trang, cùng khuôn với me/dashboard/page.tsx — middleware đã
  // chặn rồi, nhưng khoảng cách giữa "middleware chặn" và "trang render dữ liệu
  // cá nhân" không nên chỉ có một lớp. `React.cache()` trong getCurrentUser.ts
  // trả lại kết quả layout vừa lấy, không đi mạng lần hai.
  const user = await getCurrentUserProfile();
  if (!user) redirect("/?auth=signin");

  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <ProfileCard user={user} />
    </PageContainer>
  );
}
