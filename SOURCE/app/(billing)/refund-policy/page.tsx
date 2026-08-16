// /refund-policy — UI Spec S-03. Chính sách hoàn tiền, CÔNG KHAI (PRD R11).
//
// AC-040: trang này phải nêu TƯỜNG MINH rằng gói không tự động gia hạn và người
// dùng phải mua lại bằng tay. Đó là kỳ vọng dễ hiểu sai nhất của mô hình trả
// trước, nên câu `billing.noAutoRenew` được render ngay cả khi phần nội dung
// còn chờ U3 — nó là một sự thật về sản phẩm, không phải một điều khoản pháp
// lý cần luật sư duyệt, và nó là thứ người dùng cần nhất từ trang này.

import type { Metadata } from "next";
import { LegalContentPending, LegalDocument } from "@/components/billing/LegalDocument";
import { getTranslate } from "@/lib/i18n/server";

// Khai lại canonical — xem lý do ở app/(billing)/terms/page.tsx.
export const metadata: Metadata = {
  title: "Refund Policy",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  const t = await getTranslate();
  return (
    <LegalDocument eyebrow={t("billing.refund.eyebrow")} title={t("billing.refund.title")}>
      <p>{t("billing.noAutoRenew")}</p>
      {/* Điều kiện và thời hạn hoàn tiền, cách xử lý khi người mua là trẻ vị
          thành niên, pháp nhân/cá nhân đứng tên bán — tất cả chờ PRD U3. */}
      <LegalContentPending message={t("billing.refund.pending")} />
    </LegalDocument>
  );
}
