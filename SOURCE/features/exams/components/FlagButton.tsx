// FlagButton — đánh dấu câu hiện tại để xem lại (Layer 2). GĐ 3 M3.1 Task 3.
// State sống trong useExamPlayer (in-memory session, không persist DB) — controlled
// qua props flagged/onToggle.
//
// Theme "Sân trường" (2026-09-06): primitive Button cỡ 36px (nút trong thẻ).
// Chưa đánh dấu = viên thuốc trắng, chữ dịu, nằm trên thẻ câu hỏi đã tô; đã
// đánh dấu = viên thuốc vàng nắng + lá cờ TÔ ĐẶC. Trạng thái đổi cả hình lẫn
// màu, và vàng chỉ đứng sau chữ/icon đen (design plan §2). `aria-pressed` nói
// phần còn lại cho trình đọc màn hình.
"use client";

import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";

interface FlagButtonProps {
  flagged: boolean;
  onToggle: () => void;
}

export function FlagButton({ flagged, onToggle }: FlagButtonProps) {
  return (
    <Button
      type="button"
      variant={flagged ? "sun" : "plain"}
      size="sm"
      onClick={onToggle}
      aria-pressed={flagged}
      title={flagged ? t("player.unflagHint") : t("player.flagHint")}
      className={flagged ? undefined : "text-muted-foreground hover:text-foreground"}
    >
      <Flag aria-hidden className={flagged ? "fill-current" : undefined} />
      {flagged ? t("player.flagged") : t("player.flag")}
    </Button>
  );
}
