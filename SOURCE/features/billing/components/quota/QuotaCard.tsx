"use client";

// Bảng Hạn mức đầu tab Tài khoản: lượt gia sư còn, lượt tải đề còn, ngày đặt lại, kèm
// huy hiệu gói. Đọc `useEntitlement()` — provider mount ở AppShell của nhóm
// (analytics); ngoài provider, người Premium sẽ thấy hạn mức của Free mà không
// có lỗi nào báo.
//
// Hạn mức chỉ hiện khi CẢ HAI `known`. Nhánh `unknown` là hỏng-MỞ (máy chủ không
// chặn gì), nên KHÔNG in "0" hay "—" — một người đang trả tiền sẽ hiểu thành
// "hết hạn mức".

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useEntitlement } from "@/lib/billing/entitlement";
import type { Quota } from "@/lib/billing/types";
import { t } from "@/lib/copy";
import { formatDate } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import { planLabel } from "@/features/billing/lib/planLabel";

type KnownQuota = Extract<Quota, { state: "known" }>;

/** Số lượt CÒN LẠI, kẹp ở 0 khi hạn mức bị hạ giữa kỳ. */
function remaining({ used, limit }: KnownQuota): number {
  return Math.max(0, limit - used);
}

function QuotaItem({ label, quota }: { label: string; quota: KnownQuota }) {
  const left = remaining(quota);
  const percent = quota.limit > 0 ? Math.round((left / quota.limit) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground text-2xl font-bold tabular-nums">
        {left}{" "}
        <span className="text-muted-foreground text-base font-medium">
          {t("billing.quota.outOf", { limit: quota.limit })}
        </span>
      </dd>
      <div className="bg-card h-1.5 overflow-hidden rounded-full" aria-hidden>
        <div
          className={cn("h-full rounded-full", left === 0 ? "bg-destructive" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function QuotaCard() {
  const entitlement = useEntitlement();
  const { tutor, upload } = entitlement;

  return (
    <Card as="section" aria-labelledby="quota-title" className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="quota-title" className="eyebrow">
          {t("billing.quota.title")}
        </h2>
        <Badge variant={entitlement.plan === "premium" ? "success" : "muted"}>
          {planLabel(entitlement)}
        </Badge>
      </div>

      {tutor.state === "known" && upload.state === "known" ? (
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <QuotaItem label={t("billing.quota.tutorLabel")} quota={tutor} />
          <QuotaItem label={t("billing.quota.uploadLabel")} quota={upload} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <dt className="text-muted-foreground text-sm">{t("billing.quota.resetLabel")}</dt>
            <dd className="text-foreground text-2xl font-bold tabular-nums">
              {formatDate(tutor.resetsAt)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground text-sm">{t("billing.quota.unavailable")}</p>
      )}
    </Card>
  );
}
