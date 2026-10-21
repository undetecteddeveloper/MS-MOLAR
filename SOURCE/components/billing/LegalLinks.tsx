// Điều khoản + Chính sách hoàn tiền. Phải đứng TRƯỚC nút thanh toán trong thứ
// tự DOM (AC-039) — dùng chung cho tab Gói của /profile và /pricing/checkout.
//
// `intro={false}` là biến thể góc thẻ (tab Gói): bỏ câu dẫn "Trước khi mua, xem:"
// vì chỗ đó chỉ còn đúng hai link, và nới vùng chạm của từng link lên ≥44px bằng
// đệm dọc kèm lề âm triệt tiêu — hàng giữ nguyên chiều cao (không thêm chỗ trống),
// còn ngón tay vẫn trúng. Chỉ làm ở biến thể này: dưới câu dẫn bình thường, lề âm
// sẽ đè lên nút mua nằm sát bên dưới.

import Link from "next/link";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

const LINK_CLASS =
  "text-primary decoration-primary/40 hover:decoration-primary font-medium underline underline-offset-4";
const CORNER_HIT_CLASS = "-my-3.5 inline-block py-3.5";

export function LegalLinks({ intro = true }: { intro?: boolean }) {
  const linkClass = cn(LINK_CLASS, !intro && CORNER_HIT_CLASS);
  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      {intro && <>{t("billing.legal.linkIntro")} </>}
      <Link href="/terms" className={linkClass}>
        {t("billing.legal.terms")}
      </Link>
      {" · "}
      <Link href="/refund-policy" className={linkClass}>
        {t("billing.legal.refund")}
      </Link>
    </p>
  );
}
