"use client";

// ProfileTabs — /profile có HAI tab: Thông tin và Mức dùng.
//
// VÌ SAO LÀ MỘT CLIENT COMPONENT BỌC NGOÀI, chứ không phải tab dựng trong
// page.tsx: `components/ui/tabs.tsx` KHÔNG mang `"use client"` — nó dựa vào
// bên gọi đã là client (tiền lệ duy nhất trong repo: MyExamsList.tsx:1). Trang
// /profile là server component, nên chỗ ranh giới phải nằm ở đây.
//
// KHÔNG DỰNG LẠI BẢNG HẠN MỨC. Tab Usage render `PlanSummary` — chính C-11 đã
// ship ở /me/orders — vì nó đã trả lời đủ bốn mục AC-056 (gói, ngày đặt lại,
// lượt gia sư còn, lượt upload còn) VÀ đã xử lý nhánh `unknown` bằng một câu
// thay vì một con số bịa. Viết một bảng thứ hai ở đây là tạo chỗ thứ hai để
// hai bảng nói khác nhau về cùng một hạn mức.
//
// `PlanSummary` không nhận props: nó đọc `useEntitlement()`. Điều đó chỉ đúng
// khi có `EntitlementProvider` phía trên — đã thêm vào (analytics)/layout.tsx
// cùng thay đổi này. Thiếu nó thì hook trả `FREE_FALLBACK` và người Premium
// thấy hạn mức Free trong im lặng.

import Link from "next/link";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): tab Usage của /profile tái dùng PlanSummary của billing. Xem ARCHITECTURE.md § Import chéo.
import { PlanSummary } from "@/features/billing/components/orders/PlanSummary";
import { useT } from "@/lib/i18n/client";
import type { CurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { ProfileCard } from "@/features/profile/components/ProfileCard";

export function ProfileTabs({ user }: { user: CurrentUserProfile }) {
  const t = useT();

  return (
    <Tabs defaultValue="info">
      <TabsList>
        <TabsTab value="info">{t("profile.tab.info")}</TabsTab>
        <TabsTab value="usage">{t("profile.tab.usage")}</TabsTab>
        <TabsIndicator />
      </TabsList>

      <TabsPanel value="info" className="mt-4">
        <ProfileCard user={user} />
      </TabsPanel>

      <TabsPanel value="usage" className="mt-4">
        <PlanSummary />
        {/* Chuỗi dùng lại, không nhân bản: `billing.quota.upgradeLink` đã có ở
            cả hai ngôn ngữ và mang đúng nghĩa "xem các gói". */}
        <p className="mt-4 text-sm">
          <Link href="/pricing" className="text-brand underline underline-offset-4">
            {t("billing.quota.upgradeLink")}
          </Link>
        </p>
      </TabsPanel>
    </Tabs>
  );
}
