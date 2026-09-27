"use client";

// SolutionSettingsPanel — hàng "Cài đặt bài giải" gập/mở chứa đúng hai công
// tắc (UI Spec `C-11`, AC-038). Khuôn disclosure theo mẫu
// `TicketQueueRow.tsx:42-72`: một `button aria-expanded aria-controls` +
// `ChevronDown` xoay 180° khi mở, nội dung mở dùng `.motion-unfold`.
//
// Chỉ đọc (bài bị ẩn, AC-083): `lockReasonId` có mặt ⇒ cả hai công tắc
// `aria-disabled="true"` và `aria-describedby` cộng thêm id của
// `ModerationReasonBanner` — component này không tự biết bài có đang ẩn hay
// không, nó chỉ khoá theo sự có mặt của prop (task 10 quyết định khi nào
// truyền).

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { SettingSwitch } from "@/components/ui/SettingSwitch";

interface SolutionSettingsPanelProps {
  showProfile: boolean;
  showScore: boolean;
  onShowProfileChange: (next: boolean) => void;
  onShowScoreChange: (next: boolean) => void;
  /** Đang lưu — cả hai công tắc cùng `aria-busy`, vẫn bấm được (mẫu SettingSwitch). */
  busy?: boolean;
  /** Id của băng lý do khoá (`ModerationReasonBanner`, AC-083); có mặt ⇒ cả
   *  hai công tắc chỉ đọc. */
  lockReasonId?: string;
}

export function SolutionSettingsPanel({
  showProfile,
  showScore,
  onShowProfileChange,
  onShowScoreChange,
  busy = false,
  lockReasonId,
}: SolutionSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const showProfileDescId = useId();
  const showScoreDescId = useId();
  const locked = lockReasonId !== undefined;

  return (
    <Card padding="compact" className="gap-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-visible:ring-ring/40 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-foreground text-sm font-medium">{t("solutions.editor.settings")}</span>
          <span className="text-muted-foreground text-xs">{t("solutions.editor.settingsSub")}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("text-muted-foreground size-4 shrink-0", open && "rotate-180")}
        />
      </button>

      {open && (
        <div id={panelId} className="motion-unfold flex flex-col gap-3 pt-3">
          <SettingSwitch
            checked={showProfile}
            onCheckedChange={onShowProfileChange}
            label={t("solutions.editor.showProfile")}
            description={t("solutions.editor.showProfileSub")}
            descriptionId={showProfileDescId}
            disabled={locked}
            busy={busy}
            lockReasonId={lockReasonId}
          />
          <SettingSwitch
            checked={showScore}
            onCheckedChange={onShowScoreChange}
            label={t("solutions.editor.showScore")}
            description={t("solutions.editor.showScoreSub")}
            descriptionId={showScoreDescId}
            disabled={locked}
            busy={busy}
            lockReasonId={lockReasonId}
          />
        </div>
      )}
    </Card>
  );
}
