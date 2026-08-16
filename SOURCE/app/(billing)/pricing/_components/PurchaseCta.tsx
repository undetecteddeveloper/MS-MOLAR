"use client";

// PurchaseCta — UI Spec C-03. Nút mua, và trạng thái KHÔNG KHẢ DỤNG của nó khi
// cổng phát hành R14 chưa mở (AC-049/AC-054).
//
// `canPurchase` được quyết ở Server Component và truyền xuống dưới dạng boolean
// (UI-D8). Component này KHÔNG đọc process.env: cờ là server-only, và repo chưa
// từng có cờ tính năng nào đọc được ở client.
//
// KHÔNG BAO GIỜ dùng `disabled` gốc — cùng lý do đã ghi ở ExplainStepAffordance
// và ActionButton: nút sẽ rơi khỏi thứ tự tab, nên người dùng bàn phím không
// tới được nó để ĐỌC lý do vì sao nó không khả dụng. Con bug này đã phải sửa
// hai lần trong repo (RateButton, rồi ActionButton).

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function PurchaseCta({ canPurchase }: { canPurchase: boolean }) {
  const t = useT();
  const reasonId = "billing-cta-reason";

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        className="min-h-11 w-full md:w-auto"
        // Chuỗi "true"/"false" chứ không phải boolean — quy ước của ActionButton.
        aria-disabled={canPurchase ? "false" : "true"}
        // aria-describedby chỉ trỏ tới lý do khi lý do có thật; trỏ tới một id
        // không tồn tại là nói dối với trình đọc màn hình.
        aria-describedby={canPurchase ? undefined : reasonId}
        onClick={() => {
          // aria-disabled KHÔNG chặn click — nó chỉ thông báo. Chốt chặn hành vi
          // phải là câu lệnh này.
          if (!canPurchase) return;
          // Màn thanh toán (S-06) thuộc pha backend: vòng đời đơn payOS phải
          // được quan sát thật rồi mới vẽ được. Chưa nối gì ở đây là đúng
          // trạng thái đã ghi trong UI Spec, không phải chỗ bỏ sót.
        }}
      >
        {t("billing.cta.buy")}
      </Button>
      {!canPurchase && (
        <p id={reasonId} className="text-muted-foreground text-sm leading-relaxed">
          {t("billing.cta.unavailableReason")}
        </p>
      )}
    </div>
  );
}
