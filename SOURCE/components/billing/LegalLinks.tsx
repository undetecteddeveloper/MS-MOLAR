"use client";

// LegalLinks — UI Spec C-04b. Cặp liên kết Điều khoản + Chính sách hoàn tiền.
//
// AC-039 buộc hai liên kết này xuất hiện TRƯỚC nút xác nhận thanh toán, không
// phải sau. Gói thành một component để màn thanh toán (S-06, pha backend) tái
// dùng đúng thứ này thay vì dựng bản thứ hai — hai bản chép của cùng một ràng
// buộc pháp lý là hai chỗ để lệch nhau.

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export function LegalLinks() {
  const t = useT();
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      {t("billing.legal.linkIntro")}{" "}
      <Link
        href="/terms"
        className="text-brand underline-offset-4 hover:underline"
      >
        {t("billing.legal.terms")}
      </Link>
      {" · "}
      <Link
        href="/refund-policy"
        className="text-brand underline-offset-4 hover:underline"
      >
        {t("billing.legal.refund")}
      </Link>
    </p>
  );
}
