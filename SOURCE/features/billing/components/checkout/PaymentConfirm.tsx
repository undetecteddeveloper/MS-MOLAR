"use client";

// Nút "Tôi đã chuyển khoản — kiểm tra ngay". Bọc RecheckOrderControl: xác
// nhận đã trả CHÍNH LÀ hỏi lại payOS — lời khẳng định của người dùng không
// phải bằng chứng (ADR-0014).
//
// Cổng pháp lý (AC-039) độc lập với cờ mở bán: chừng nào nội dung Điều khoản /
// Hoàn tiền chưa có, nút hiện nhưng không làm gì và nói rõ lý do.

import { Button } from "@/components/ui/button";
import { RecheckOrderControl } from "@/components/billing/RecheckOrderControl";
import { t } from "@/lib/copy";

export function PaymentConfirm({
  orderCode,
  status,
  legalContentReady,
}: {
  orderCode: number;
  status: string;
  legalContentReady: boolean;
}) {
  if (legalContentReady) {
    return <RecheckOrderControl orderCode={orderCode} variant="primary" status={status} />;
  }

  const reasonId = `confirm-${orderCode}-legal`;
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="lg" className="w-full" aria-disabled="true" aria-describedby={reasonId}>
        {t("billing.confirm.action")}
      </Button>
      <p id={reasonId} className="text-muted-foreground text-sm leading-relaxed">
        {t("billing.confirm.legalPending.reason")}
      </p>
    </div>
  );
}
