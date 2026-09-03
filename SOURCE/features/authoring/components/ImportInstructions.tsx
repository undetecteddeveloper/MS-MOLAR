"use client";

// ImportInstructions — panel gấp/mở giải thích cách import (prototype
// UI_Layer4_main). Thay thế UploadGuide cũ (gộp nội dung cốt lõi vào bullet
// ngắn gọn hơn). Expand/collapse animate qua grid-template-rows (0fr↔1fr,
// 0.3s) + chevron xoay 180° đồng bộ (HIDDEN-FEATURES #1) — chỉ CSS, không
// height cứng nên không cần đo nội dung.

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { LIMITS } from "@/lib/ugc/limits";

const MAX_MB = Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024));

export function ImportInstructions() {
  const t = useT();
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-[4px] border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium text-foreground"
      >
        {t("upload.instructionsTitle")}
        <span
          aria-hidden
          className={[
            "text-ring transition-transform duration-300",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          ▾
        </span>
      </button>
      <div
        className={[
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <ul className="list-disc space-y-2 px-4 pb-4 pl-9 text-sm leading-relaxed text-foreground">
            <li>{t("upload.supportedFormats")}</li>
            <li>
              {t("upload.choose")} <span className="font-medium">{t("upload.automatic")}</span>{" "}
              {t("upload.automaticHint")}
            </li>
            <li>
              {t("upload.choose")} <span className="font-medium">{t("upload.manual")}</span>{" "}
              {t("upload.manualHint")}
            </li>
            <li>{t("upload.answersNeverGuessed")}</li>
            <li>{t("upload.maxFileSize", { mb: MAX_MB, pages: LIMITS.MAX_PDF_PAGES })}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
