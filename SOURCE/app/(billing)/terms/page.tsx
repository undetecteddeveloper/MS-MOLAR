// /terms — UI Spec S-02. Điều khoản dịch vụ, CÔNG KHAI (PRD R11/AC-038).
//
// Đường dẫn phải nằm trong PUBLIC_PATHS đúng chuỗi "/terms" — cơ chế khớp là
// `pathname === p || pathname.startsWith(`${p}/`)`, nên "/terms-of-service" sẽ
// KHÔNG được mục "/terms" phủ, và một đường dẫn có dấu chấm thì không bao giờ
// tới được middleware (proxy.ts:46-48 loại nó khỏi matcher).
//
// KHÔNG static export được dù trang thuần văn bản: ngôn ngữ đọc từ cookie phía
// server (lib/i18n/server.ts:9-21), nên mọi trang có bản dịch đều là dynamic.
// Đây là đánh đổi đã chấp nhận cho cả site, ghi ra để không ai đi tìm cách
// prerender nó rồi phát hiện là không thể.

import type { Metadata } from "next";
import { LegalContentPending, LegalDocument } from "@/components/billing/LegalDocument";
import { getTranslate } from "@/lib/i18n/server";

// `alternates.canonical` PHẢI khai lại: root layout đặt mặc định `canonical:
// "/"` cho mọi trang, thứ vốn đúng khi `/` là trang public duy nhất. Để nguyên
// thì trang này tự khai mình là bản sao của trang chủ và sẽ không được index
// riêng — hỏng im lặng, chỉ lộ ra ở Search Console.
export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const t = await getTranslate();
  return (
    <LegalDocument eyebrow={t("billing.terms.eyebrow")} title={t("billing.terms.title")}>
      {/* Nội dung thật chờ PRD U3 — chủ sở hữu là engineer, không phải agent. */}
      <LegalContentPending message={t("billing.terms.pending")} />
    </LegalDocument>
  );
}
