// /pricing — UI Spec S-01. Trang bảng giá.
//
// CẦN ĐĂNG NHẬP: không nằm trong PUBLIC_PATHS. AC-032 chỉ cho thêm đúng ba mục
// công khai cho toàn tính năng (webhook + hai trang pháp lý), và trang này
// không phải một trong ba.
//
// `force-dynamic` là BẮT BUỘC, không phải phòng xa: `isPaidTierEnabled()` đọc
// biến môi trường lúc render, và nếu trang được prerender lúc build thì giá trị
// bị đông cứng vào bundle — bật cờ trên Vercel sẽ không đổi được gì cho tới lần
// deploy sau. Tiền lệ: app/(admin)/admin/page.tsx:21.

import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { LegalLinks } from "@/components/billing/LegalLinks";
import { isPaidTierEnabled } from "@/lib/billing/paidTier";
import { getTranslate } from "@/lib/i18n/server";
import { PlanComparison } from "./_components/PlanComparison";
import { PurchaseCta } from "./_components/PurchaseCta";

export const dynamic = "force-dynamic";

// `export const metadata` chứ không phải generateMetadata: toàn repo có đúng
// hai khai báo metadata và KHÔNG có generateMetadata nào. Tiêu đề tự nối vào
// template "%s · MS-MOLAR" của root layout.
export const metadata: Metadata = { title: "Plans" };

export default async function PricingPage() {
  const t = await getTranslate();
  const canPurchase = isPaidTierEnabled();

  return (
    <div className="bg-background min-h-dvh">
      <PageContainer as="main" size="default" className="flex flex-col gap-6">
        <h1 className="sr-only">{t("billing.pricing.title")}</h1>

        <PlanComparison />

        {/* Kỳ TRẢ TRƯỚC, không phải subscription kiểu Stripe — cổng A2A/VietQR
            không có auto-renew (ADR-0013). Câu này đứng trước nút mua vì nó là
            kỳ vọng dễ hiểu sai nhất của mô hình này (AC-040). */}
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm leading-relaxed">
          {t("billing.noAutoRenew")}
        </p>

        {/* AC-039: hai liên kết pháp lý nằm TRƯỚC nút xác nhận trong thứ tự
            DOM, không phải sau. Thứ tự DOM là thứ tự đọc. */}
        <LegalLinks />

        <PurchaseCta canPurchase={canPurchase} />
      </PageContainer>
    </div>
  );
}
