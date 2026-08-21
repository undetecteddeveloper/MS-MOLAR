// /terms — UI Spec S-02. Điều khoản dịch vụ, CÔNG KHAI (PRD R11).
//
// Khai lại `canonical` vì trang này nằm ngoài nhóm route có sẵn khai báo chung;
// thiếu nó thì hai đường dẫn cùng trỏ về một nội dung.
//
// NỘI DUNG TỚI TỪ TỪ ĐIỂN, KHÔNG TỪ FILE .md. `docs/legal/term-of-service.md`
// là bản duyệt của con người; chuỗi `billing.terms.body` là bản đã đưa vào
// từ điển để dịch được sang hai ngôn ngữ và để `t()` là đường đọc DUY NHẤT.
// Đọc file lúc chạy sẽ đưa một lượt I/O vào một trang tĩnh và bỏ qua i18n.
//
// KHOÁ NÀY LÀ MỘT CỔNG, không chỉ là một chuỗi: `billing.terms.body` là một
// trong hai khoá mà C-15 (checkout/page.tsx) kiểm bằng `in` để quyết định có
// bật nút xác nhận thanh toán hay không. Xoá nó đi là đóng cổng bán hàng.

import type { Metadata } from "next";
import { LegalDocument } from "@/components/billing/LegalDocument";
import { LegalProse } from "@/components/billing/LegalProse";
import { getTranslate } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const t = await getTranslate();
  return (
    <LegalDocument title={t("billing.terms.title")}>
      <LegalProse body={t("billing.terms.body")} />
    </LegalDocument>
  );
}
