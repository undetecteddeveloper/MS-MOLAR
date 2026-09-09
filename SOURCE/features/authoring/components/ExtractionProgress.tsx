"use client";

// ExtractionProgress — trạng thái đang trích xuất (UI Spec §ExtractionProgress,
// AC-029 / Task 6.2 + v2.2). role="status" polite, không chặn thao tác đọc.
// v2.2: metaStep (chế độ Automatic) — nêu tên bước đọc thông tin đề như MỘT
// NHÃN trong cùng trạng thái tiến trình (chạy song song, không phải giai đoạn
// tuần tự riêng — UI Spec §v2.2 ExtractionProgress).
//
// Theme "Sân trường" (2026-09-09): thẻ surface + vòng xoay xanh hành động, hết
// hộp viền vàng đồng của theme cũ. UploadForm đặt khối này VÀO CHỖ nút Bắt đầu
// khi đang chạy, nên không có gì phía trên bị đẩy xuống lúc nó xuất hiện.
// Giảm chuyển động: vòng xoay đổi thành nhịp mờ/tỏ — ở đây chuyển động CHÍNH
// LÀ thông tin "đang chạy", bỏ hết thì khối đứng im như một trang treo (cùng
// lý do với RouteLoadingOverlay).

import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";

export function ExtractionProgress({ metaStep }: { metaStep?: boolean }) {
  return (
    <Card
      role="status"
      aria-live="polite"
      padding="compact"
      className="flex-row items-center gap-3"
    >
      <Loader2
        aria-hidden
        className="text-primary size-5 shrink-0 animate-spin motion-reduce:animate-pulse"
      />
      <p className="text-sm leading-relaxed">
        {metaStep ? t("upload.extractingWithMeta") : t("upload.extractingFiles")}{" "}
        {t("upload.reviewBeforePublish")}
      </p>
    </Card>
  );
}
