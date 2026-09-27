// ReputationBlock — khối điểm uy tín + ba huy hiệu bên trong thẻ tài khoản
// (UI Spec § Component ReputationBlock, UI-D14, AC-087/088/089/090). Server
// component THUẦN — không "use client", không fetch gì, hàm ĐỒNG BỘ (không
// async) để `ProfileCard.test.tsx` dựng được nó trong jsdom (frontend DD
// v1.6 § Main Components). `ProfilePage` xây phần tử này và truyền xuống
// `ProfileCard` qua `reputationSlot` — file này không bao giờ được
// `features/profile/**` import (B4; § UI Spec Deviations DD-U1).
//
// Không heading (test của ProfileCard cấm) — nhãn "Điểm uy tín" là một
// `<span className="eyebrow">`.
import { Award, Lock } from "lucide-react";
import { t, type MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface ReputationBlockProps {
  totalScore: number;
  publishedCount: number;
  helpfulCount: number;
  /** Chỉ giữ cho ĐỐI XỨNG với `getMyReputation()` — KHÔNG render (UI Spec
   *  `C-34` không có dòng ghim). */
  pinnedCount: number;
}

interface Tier {
  key: string;
  /** Số bài đã đăng để mở khoá huy hiệu này (AC-087/088). */
  threshold: number;
  nameKey: MessageKey;
}

const TIERS: Tier[] = [
  { key: "tier1", threshold: 1, nameKey: "profile.reputation.tier1" },
  { key: "tier2", threshold: 5, nameKey: "profile.reputation.tier2" },
  { key: "tier3", threshold: 20, nameKey: "profile.reputation.tier3" },
];

export function ReputationBlock({ totalScore, publishedCount, helpfulCount }: ReputationBlockProps) {
  return (
    <div className="border-border mt-5 border-t pt-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="eyebrow">{t("profile.reputation.label")}</span>
          <p className="text-primary text-[1.75rem] leading-none font-bold tabular-nums">
            {totalScore}
          </p>
        </div>
        {publishedCount === 0 ? (
          <p className="text-muted-foreground text-right text-xs">{t("profile.reputation.none")}</p>
        ) : (
          <div className="text-muted-foreground text-right text-xs">
            <p>{t("profile.reputation.published", { count: publishedCount })}</p>
            <p>{t("profile.reputation.helpful", { count: helpfulCount })}</p>
          </div>
        )}
      </div>

      {/* Ba huy hiệu, LUÔN suy trực tiếp từ `publishedCount` — không state
          riêng, nên gỡ/ẩn một bài (publishedCount giảm) tự khoá lại huy hiệu
          tương ứng ở lượt render kế tiếp (AC-088, "tier-relock"), không cần
          mã nào nhớ đỉnh cao đã từng đạt. */}
      <ul className="flex items-stretch gap-2">
        {TIERS.map((tier) => {
          const unlocked = publishedCount >= tier.threshold;
          const Icon = unlocked ? Award : Lock;
          return (
            <li
              key={tier.key}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-3 text-center",
                unlocked
                  ? "bg-card"
                  : "border-border text-muted-foreground border border-dashed bg-transparent"
              )}
            >
              <Icon aria-hidden className="size-5" />
              <span className="text-xs font-semibold">{t(tier.nameKey)}</span>
              <span className="text-xs">
                {unlocked
                  ? t("profile.reputation.tierGoal", { count: tier.threshold })
                  : t("profile.reputation.tierLocked", { count: tier.threshold - publishedCount })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
