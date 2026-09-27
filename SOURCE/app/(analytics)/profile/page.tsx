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
//
// ProfileTabs + ReputationBlock (task 44, frontend DD v1.6 § UI Spec
// Deviations DD-U1, UI-D15): trang là NƠI GHÉP duy nhất — nó phân tích `?tab=`
// (whitelist, `parseProfileTab`), server-render CHỈ nội dung của tab đang
// chọn, và ở tab "account" gọi `getMyReputation()` để dựng `ReputationBlock`
// rồi đưa xuống `ProfileCard` qua `reputationSlot`. `ProfileCard` (client,
// `features/profile`) không được import gì từ `@/features/solutions/**` (B4)
// — trang này (app/, không thuộc tính năng nào) là chỗ duy nhất được phép nối
// hai tính năng lại.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileCard } from "@/features/profile/components/ProfileCard";
import { ProfileTabs } from "@/features/solutions/components/ProfileTabs";
import { ReputationBlock } from "@/features/solutions/components/ReputationBlock";
import { parseProfileTab } from "@/features/solutions/lib/profileTab";
import { getMyReputation, type ReputationResult } from "@/features/solutions/queries";

// KHÔNG khai `alternates.canonical` — khác /terms và /about một cách có chủ ý:
// trang này bị robots.ts chặn (nội dung của nó là dữ liệu cá nhân), nên một
// canonical riêng chỉ để công bố một URL không ai được bò vào.
export const metadata: Metadata = {
  title: "Hồ sơ",
};

type SearchParams = Promise<{ tab?: string }>;

interface ProfilePageProps {
  searchParams: SearchParams;
}

/** Bọc `getMyReputation()` — hàm tự trả `{ ok: false }` khi RPC lỗi, nhưng
 *  vẫn có thể NÉM trên một lỗi hạ tầng khác (AC-096 nói rõ "thất bại HOẶC
 *  ném" là một luật, không phải hai). `null` gộp chung với `{ ok: false }`
 *  ở nơi gọi — cùng nghĩa "không có slot". */
async function tryGetMyReputation(): Promise<ReputationResult | null> {
  try {
    return await getMyReputation();
  } catch {
    return null;
  }
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  // Chốt chặn cấp trang, cùng khuôn với me/dashboard/page.tsx — middleware đã
  // chặn rồi, nhưng khoảng cách giữa "middleware chặn" và "trang render dữ liệu
  // cá nhân" không nên chỉ có một lớp. `React.cache()` trong getCurrentUser.ts
  // trả lại kết quả layout vừa lấy, không đi mạng lần hai.
  const user = await getCurrentUserProfile();
  if (!user) redirect("/?auth=signin");

  const sp = await searchParams;
  const tab = parseProfileTab(sp.tab);

  // AC-096: `getMyReputation()` thất bại HOẶC ném — cả hai đều nghĩa là
  // "không có slot", không băng lỗi, không chặn phần còn lại của thẻ tài
  // khoản (frontend DD § UI Error State Design, hàng `ReputationBlock`). Chỉ
  // gọi RPC trong try/catch — dựng JSX ở NGOÀI, react-hooks/error-boundaries
  // cấm dựng JSX bên trong try/catch (lỗi khi render không bị bắt ở đó).
  const reputation = tab === "account" ? await tryGetMyReputation() : null;
  const reputationSlot: ReactNode =
    reputation?.ok === true ? (
      <ReputationBlock
        totalScore={reputation.totalScore}
        publishedCount={reputation.publishedCount}
        helpfulCount={reputation.helpfulCount}
        pinnedCount={reputation.pinnedCount}
      />
    ) : undefined;

  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <ProfileTabs activeTab={tab} />
      {tab === "account" ? (
        <ProfileCard user={user} reputationSlot={reputationSlot} />
      ) : (
        // Nội dung ô "Bình luận" (`ProfileCommentsTab`, task 45) chèn ở đây —
        // task 44 chỉ dựng khung chuyển tab, chưa có nội dung của ô này.
        null
      )}
    </PageContainer>
  );
}
