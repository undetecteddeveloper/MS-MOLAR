// Điều khoản + Chính sách hoàn tiền. Phải đứng TRƯỚC nút thanh toán trong thứ
// tự DOM (AC-039) — dùng chung cho /pricing và /pricing/checkout.

import Link from "next/link";
import { t } from "@/lib/copy";

const LINK_CLASS =
  "text-primary decoration-primary/40 hover:decoration-primary font-medium underline underline-offset-4";

export function LegalLinks() {
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      {t("billing.legal.linkIntro")}{" "}
      <Link href="/terms" className={LINK_CLASS}>
        {t("billing.legal.terms")}
      </Link>
      {" · "}
      <Link href="/refund-policy" className={LINK_CLASS}>
        {t("billing.legal.refund")}
      </Link>
    </p>
  );
}
