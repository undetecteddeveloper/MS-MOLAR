// /profile — trang quản lý tài khoản (PRD R1..R9, UI Spec S-01).
//
// Khung (SkipLink, SiteHeader, #main-content, .pb-bottom-nav, BottomNav,
// SupportWidget) do app/(layer3)/layout.tsx cấp. Trang này KHÔNG khai lại
// `#main-content` và KHÔNG khai lại SkipLink (PRD D2, AC-003) — khai lần hai
// sinh hai phần tử cùng id, và đích nhảy của phím tắt bỏ qua điều hướng trở
// thành thứ phụ thuộc vào phần tử nào đứng trước trong DOM.
//
// Bề rộng `small` (672px): đây là trang một-tác-vụ với năm hàng ngắn. Ở một
// scaffold rộng hơn, nhãn của mỗi hàng và nút hành động của nó rơi về hai đầu
// đối diện của quãng mắt phải đi.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { ProfileTabs } from "./_components/ProfileTabs";

// KHÔNG khai `alternates.canonical` — khác /terms và /about một cách có chủ ý.
// Hai trang kia cần được index nên phải sửa lại mặc định `canonical: "/"` của
// root layout; trang này bị robots.ts chặn (nội dung của nó là dữ liệu cá
// nhân), nên một canonical riêng chỉ để công bố một URL không ai được bò vào.
export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ProfilePage() {
  const t = await getTranslate();

  // Chốt chặn cấp trang, cùng khuôn với me/dashboard/page.tsx:19-20 — middleware
  // đã chặn rồi (/profile không nằm trong PUBLIC_PATHS), nhưng khoảng cách giữa
  // "middleware chặn" và "trang render dữ liệu cá nhân" không nên chỉ có một
  // lớp. Dùng getCurrentUserProfile chứ không phải getCurrentUser: nó trả `null`
  // ở đúng cùng điều kiện (không có phiên), nên chốt vẫn y hệt, mà không phải
  // trả giá thêm một vòng auth chỉ để hỏi lại thứ vừa hỏi xong.
  // (Từ 2026-09-03 điều đó đúng theo nghĩa đen: `React.cache()` trong
  // getCurrentUser.ts trả lại kết quả layout vừa lấy, không đi mạng lần hai.)
  const user = await getCurrentUserProfile();
  if (!user) redirect("/?auth=signin");

  return (
    <PageContainer as="main" size="small">
      {/* Tiêu đề trang bỏ khỏi UI nhìn thấy được (điều hướng đã tô sáng mục
          Account/Profile), h1 sr-only giữ lại mốc cho trình đọc màn hình —
          cùng quy ước với /exams (trang đầu tiên áp dụng, xem exams/page.tsx). */}
      <h1 className="sr-only">{t("profile.title")}</h1>
      <div className="preload-fade mt-6" style={{ "--preload-order": 1 } as React.CSSProperties}>
        <ProfileTabs user={user} />
      </div>
    </PageContainer>
  );
}
