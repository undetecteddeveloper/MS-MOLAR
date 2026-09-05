"use client";

// ExtractionProgress — trạng thái đang trích xuất (UI Spec §ExtractionProgress,
// AC-029 / Task 6.2 + v2.2). role="status" polite, không chặn thao tác đọc.
// v2.2: metaStep (chế độ Automatic) — nêu tên bước đọc thông tin đề như MỘT
// NHÃN trong cùng trạng thái tiến trình (chạy song song, không phải giai đoạn
// tuần tự riêng — UI Spec §v2.2 ExtractionProgress).

import { t } from "@/lib/copy";

export function ExtractionProgress({ metaStep }: { metaStep?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg border border-[#B8863B] bg-[#B8863B]/8 px-4 py-3 text-sm text-[#8a6420]"
    >
      <span
        aria-hidden
        className="size-4 shrink-0 animate-spin rounded-full border-2 border-[#B8863B]/40 border-t-[#B8863B]"
      />
      <span>
        {metaStep ? t("upload.extractingWithMeta") : t("upload.extractingFiles")}{" "}
        {t("upload.reviewBeforePublish")}
      </span>
    </div>
  );
}
