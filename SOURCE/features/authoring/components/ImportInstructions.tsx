"use client";

// ImportInstructions — khối gấp/mở giải thích cách tải đề. Thay thế UploadGuide
// cũ (gộp nội dung cốt lõi vào vài gạch đầu dòng).
//
// Theme "Sân trường" (2026-09-09): thẻ surface, nút mở là cả hàng đầu, mũi tên
// xoay 180°. KHÔNG còn animate chiều cao (grid-rows 0fr↔1fr của bản trước):
// §7 chỉ cho `opacity`/`scale`/`translate` — chiều cao là layout. Nội dung mở
// ra tỏ dần + nhích 4px bằng `.motion-unfold`, cùng lối với hàng chọn của bảng
// lọc; đóng thì gỡ ngay — người dùng vừa bấm, không cần xem nó biến mất.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { LIMITS } from "@/lib/ugc/limits";
import { cn } from "@/lib/utils";

const MAX_MB = Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024));

export function ImportInstructions() {
  const [open, setOpen] = useState(true);

  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="import-instructions-body"
        className="focus-visible:ring-ring/40 rounded-card flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left text-base font-semibold focus-visible:ring-3 focus-visible:outline-none sm:px-5"
      >
        {t("upload.instructionsTitle")}
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground size-5 shrink-0 transition-[rotate] ease-out",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <ul
          id="import-instructions-body"
          className="motion-unfold flex list-disc flex-col gap-2 px-4 pb-4 pl-9 text-sm leading-relaxed sm:px-5 sm:pb-5 sm:pl-10"
        >
          <li>{t("upload.supportedFormats")}</li>
          <li>
            {t("upload.choose")} <span className="font-semibold">{t("upload.automatic")}</span>{" "}
            {t("upload.automaticHint")}
          </li>
          <li>
            {t("upload.choose")} <span className="font-semibold">{t("upload.manual")}</span>{" "}
            {t("upload.manualHint")}
          </li>
          <li>{t("upload.answersNeverGuessed")}</li>
          <li>{t("upload.maxFileSize", { mb: MAX_MB, pages: LIMITS.MAX_PDF_PAGES })}</li>
        </ul>
      )}
    </Card>
  );
}
