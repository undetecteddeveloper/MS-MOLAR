// /refund-policy — UI Spec S-03. Chính sách hoàn tiền, CÔNG KHAI (PRD R11).
//
// AC-040: trang này phải nêu TƯỜNG MINH rằng gói không tự động gia hạn và người
// dùng phải mua lại bằng tay. Đó là kỳ vọng dễ hiểu sai nhất của mô hình trả
// trước, nên câu `billing.noAutoRenew` giữ nguyên vị trí DẪN ĐỀ — trên toàn bộ
// thân văn bản, đọc được mà không phải cuộn. Mục 2 của thân văn bản nói lại
// điều đó chi tiết hơn; sự lặp ấy là CỐ Ý, không phải sót khi ghép nội dung.
//
// Nội dung thân: xem chú thích ở app/(billing)/terms/page.tsx — cùng lý do
// dùng từ điển thay vì đọc file .md, và `billing.refund.body` là khoá thứ hai
// của cổng C-15.

import type { Metadata } from "next";
import { LegalDocument } from "@/components/billing/LegalDocument";
import { LegalProse } from "@/components/billing/LegalProse";
import { getTranslate } from "@/lib/i18n/server";

// Khai lại canonical — xem lý do ở app/(billing)/terms/page.tsx.
export const metadata: Metadata = {
  title: "Refund Policy",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  const t = await getTranslate();
  return (
    <LegalDocument title={t("billing.refund.title")}>
      <p>{t("billing.noAutoRenew")}</p>
      <LegalProse body={t("billing.refund.body")} />
    </LegalDocument>
  );
}
