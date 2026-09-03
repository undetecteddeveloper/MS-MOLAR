"use client";

// C-11 PlanSummary — bốn giá trị AC-056 ngay trên đầu S-05 (UI Spec § Component:
// `PlanSummary`, frontend Design Doc Decision 4).
//
// Client component vì nó đọc `useEntitlement()`, và provider nằm PHÍA TRÊN nó ở
// `(billing)/layout.tsx` — đó cũng là lý do route `/me/orders` được xếp vào
// nhóm `(billing)` chứ không phải `(analytics)` nơi `/me/dashboard` đang ở
// (UI-D11). Đặt nhầm nhóm thì `useEntitlement()` rơi về `FREE_FALLBACK`: biên
// dịch trót lọt, render trót lọt, smoke test trót lọt, và MỌI người dùng
// Premium lặng lẽ thấy bảng tóm tắt của người dùng Free.
//
// VỊ TỪ LÀ "CẢ HAI ĐỀU known", KHÔNG PHẢI "MỘT TRONG HAI" (Decision 4). Backend
// suy cả hai hạn mức từ CÙNG một lượt đọc và cùng một `periodStart` nên chúng
// hỏng cùng nhau — nhưng đó là Ý ĐỊNH của backend, không phải một bảo đảm của
// kiểu (Assumed Behavior A7, Confirmed: No). Đòi cả hai `known` nghĩa là một
// lần phân kỳ mà backend nói không thể xảy ra sẽ suy biến thành CÂU TRUNG THỰC,
// chứ không thành một bảng nửa vời thiếu im lặng một mục.
//
// KHÔNG BAO GIỜ "0", KHÔNG BAO GIỜ "—" ở nhánh `unknown`. `Quota.unknown` là
// hợp đồng hỏng-MỞ (UI-D2): `isQuotaExhausted()` trả `false` cho nó
// (types.ts:77-79), tức máy chủ KHÔNG chặn gì cả. In "0" là tuyên bố một sự cạn
// kiệt không ai đang cưỡng chế; in "—" đọc ra "đếm được số không", và một người
// đang trả tiền hiểu thành "hạn mức của tôi hết rồi". Cả hai biến một hợp đồng
// hỏng-mở thành một MÀN HÌNH hỏng-đóng.
//
// MỘT câu, không phải ba: hai hạn mức tới từ cùng một lượt đọc, còn ngày đặt
// lại thì KHÔNG có nguồn độc lập — `resetsAt` nằm BÊN TRONG biến thể `known`,
// nên khi hạn mức unknown thì không có ngày nào để in. Hệ quả ở mức biên dịch,
// và đó là lý do union được nặn như vậy: đọc `resetsAt` ngoài nhánh `known` là
// một lỗi tsc, không phải một `undefined` lúc chạy.
//
// LƯỚI TỰ VIẾT, `BentoCell` DÙNG LẠI: `BentoGrid` hardcode `sm:grid-cols-12`
// (BentoGrid.tsx:27) và một lớp `md:grid-cols-2` KHÔNG huỷ được nó — khác
// breakpoint nên twMerge giữ cả hai — đúng lý do `PlanComparison.tsx:69` cũng
// tự viết lưới của nó. `BentoCell`, phần thật sự đáng tái dùng, thì giữ.

import { BentoCell } from "@/components/layout/BentoGrid";
import { useEntitlement } from "@/lib/billing/entitlement";
import { formatDate } from "@/lib/format/datetime";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n/translate";
import type { Entitlement } from "@/lib/billing/types";
import type { Locale } from "@/lib/i18n/locales";

type Item = { term: string; value: string };

/** Mục "gói hiện tại" KHÔNG BAO GIỜ vắng mặt: `plan` chỉ có hai giá trị và
 *  hỏng-ĐÓNG về `free`, nên nó không có nhánh `unknown` nào để xử lý. */
function planValue(entitlement: Entitlement, t: Translate, locale: Locale): string {
  const { plan, expiresAt, inGracePeriod } = entitlement;
  if (plan === "free") return t("billing.plan.free.name");
  if (expiresAt === null) return t("billing.plan.premium.name");
  const date = formatDate(expiresAt, locale);
  // Ân hạn cho QUYỀN TRUY CẬP chứ không cấp hạn mức mới (AC-010), nên nó phải
  // đọc ra một câu KHÁC HẲN câu Premium thường — người dùng cần biết mình đang
  // ở trong ba ngày cuối.
  return inGracePeriod
    ? t("billing.orders.planPremiumGrace", { date })
    : t("billing.orders.planPremiumUntil", { date });
}

export function PlanSummary() {
  const t = useT();
  const locale = useLocale();
  const entitlement = useEntitlement();
  const { tutor, upload } = entitlement;

  // Vị từ viết ĐÚNG MỘT LẦN, ngay trong biểu thức dựng ba mục — nhờ vậy TypeScript
  // thu hẹp được cả hai union tại chỗ và không có bản sao thứ hai của điều kiện
  // để trôi lệch.
  const quotaItems: Item[] | null =
    tutor.state === "known" && upload.state === "known"
      ? [
          {
            term: t("billing.orders.resetLabel"),
            // Mốc của `tutor` — cùng biên kỳ với `upload` theo backend, nhưng
            // đọc từ MỘT chỗ chứ không phải hai (AC-052: màn hình không tự tính
            // lại `created_at + 30d × k`).
            value: formatDate(tutor.resetsAt, locale),
          },
          {
            term: t("billing.orders.tutorLabel"),
            value: t("billing.orders.tutorRemaining", {
              count: remaining(tutor.used, tutor.limit),
              limit: tutor.limit,
            }),
          },
          {
            term: t("billing.orders.uploadLabel"),
            value: t("billing.orders.uploadRemaining", {
              count: remaining(upload.used, upload.limit),
              limit: upload.limit,
            }),
          },
        ]
      : null;

  return (
    <BentoCell as="section" span="full" className="gap-4">
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Pair term={t("billing.orders.planLabel")} value={planValue(entitlement, t, locale)} />
        {quotaItems?.map((item) => (
          <Pair key={item.term} term={item.term} value={item.value} />
        ))}
      </dl>
      {quotaItems === null && (
        <p className="text-muted-foreground text-sm">{t("billing.quota.unavailable")}</p>
      )}
    </BentoCell>
  );
}

/** `<div>` bọc cặp `<dt>/<dd>` là hình thức HTML5 cho phép, và là cách duy nhất
 *  để mỗi cặp trở thành MỘT ô lưới thay vì hai ô rời nhau. */
function Pair({ term, value }: Item) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-sm">{term}</dt>
      <dd className="text-foreground mt-1 text-base">{value}</dd>
    </div>
  );
}

/** AC-056 hỏi "số lượt CÒN LẠI", không phải số đã dùng. Kẹp ở 0: một hạn mức bị
 *  hạ giữa kỳ cho ra phần dư âm, và "-3 lượt" thì không có nghĩa gì cả. */
function remaining(used: number, limit: number): number {
  return Math.max(0, limit - used);
}
