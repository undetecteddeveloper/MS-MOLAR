"use client";

// ActionButton — nguyên tử Lưu/Chia sẻ dùng chung duy nhất (AC-007), được dùng bởi
// ResultActions (Task 12). Các hành động trên mỗi hàng của History giờ đi qua
// HistoryRowMenu (front-adjust: menu ⋯ gộp) thay thế, nhưng cả hai đều đi
// qua cùng một hook usePdfAction (components/history/usePdfAction.ts) — không có
// điểm gọi tạo PDF thứ hai.
//
// Mẫu a11y D4 (lần áp dụng thứ 2 của tiền lệ RateButton.tsx, chưa phải đợt tách
// theo Rule-of-Three): luôn focus được, không bao giờ `disabled` gốc —
// thay vào đó aria-disabled + aria-describedby + Tooltip truyền đạt trạng thái
// bận/lỗi/dự phòng. Vì aria-disabled tự nó không chặn sự kiện click của DOM,
// `busyRef` của usePdfAction mới là cơ chế chặn click thật (đồng bộ) (AC-010).
//
//Sửa hình dạng DOM D2: các span phản hồi lỗi/trạng thái, VÀ span lý do sr-only
// cho aria-describedby, đều được render làm con cháu của
// button (position: absolute, neo vào position: relative của chính
// button) — không bao giờ là anh em cấp Tooltip của nó. Một bản trước để
// span lý do làm anh em (xem bảng "ActionButton phase -> local DOM shape" của frontend DD);
// span đó không có tổ tiên được định vị nào cả, nên
// trình duyệt rơi về định vị nó ở *vị trí tĩnh giả định*
// so với gốc tài liệu — làm phồng
// document.documentElement.scrollHeight thêm một chiều cao hàng cho mỗi bản
// render (vô hại với 2 nút ở trang Kết quả, nhưng với 30+ hàng trên
// /history this produced several thousand px of invisible page height,
// tức lỗi "cuộn vô tận"). Giữ mọi nút phụ thuộc pha bên trong hộp `relative`
// của chính button thì ActionButton chỉ đóng góp đúng
// một nút trong luồng cho cha của nó VÀ không bao giờ rò chiều cao layout ra trang.
import { Download, Loader2, Share2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePdfAction } from "@/components/history/usePdfAction";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

const LABEL_KEY = { save: "common.save", share: "common.share" } as const satisfies Record<
  "save" | "share",
  MessageKey
>;
const ICON = { save: Download, share: Share2 } as const;

export interface ActionButtonProps {
  action: "save" | "share";
  pdfInput: AttemptPdfData;
  /** Duy nhất cho mỗi bản render — giữ id của span lý do sr-only không trùng giữa N bản HistoryRow. */
  idPrefix: string;
  /** Lý do KHÔNG xuất được, hoặc `null` khi xuất được (ADR-0018/AC-058).
   *
   *  BẮT BUỘC. Xem `usePdfAction` — một prop tuỳ chọn ở đây làm mọi call site
   *  mới mặc định KHÔNG bị chặn, và chế độ hỏng im lặng là để lọt một tệp PDF
   *  thiếu phần điểm tự luận. */
  blockedReason: string | null;
}

export function ActionButton({ action, pdfInput, idPrefix, blockedReason }: ActionButtonProps) {
  const { phase, run } = usePdfAction(action, pdfInput, blockedReason);
  const blocked = blockedReason !== null;
  const reasonId = `${idPrefix}-${action}-reason`;
  const Icon = ICON[action];
  const label = t(LABEL_KEY[action]);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={run}
        // KHÔNG BAO GIỜ thuộc tính `disabled` gốc, ở BẤT KỲ trạng thái nào
        // (UI-D5). Repo đã sửa đúng lỗi này HAI LẦN. `disabled` gỡ phần tử khỏi
        // thứ tự tab VÀ đẩy LÝ DO ra ngoài tầm với của trình đọc màn hình — đúng
        // hai thứ AC-058 muốn có. Idiom: focus được + `aria-disabled` (chuỗi) +
        // `aria-describedby` trỏ tới ô `sr-only` mang lý do.
        aria-disabled={blocked || phase === "busy" ? "true" : "false"}
        aria-busy={phase === "busy"}
        aria-describedby={reasonId}
        // `relative` là bắt buộc — nó neo mọi con cháu định vị tuyệt đối bên dưới (chữ lỗi/trạng thái,
        // và span lý do sr-only) để không cái nào trở thành anh em thêm trong luồng của button này, hoặc —
        // tệ hơn, vì chúng không có tổ tiên định vị nào cả — bị định vị so với gốc tài liệu (D2).
        // Theme "Sân trường": viên thuốc surface của primitive Button, nhãn HIỆN
        // RA cạnh icon (icon-only bắt học sinh đoán). `relative` + `w-full` giữ
        // hình dạng DOM đã mô tả ở đầu file; mọi span trạng thái vẫn là con
        // tuyệt đối của chính nút này.
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "relative w-full px-3 aria-disabled:opacity-60"
        )}
      >
        {phase === "busy" ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
        <span>{label}</span>
        {phase === "error" && (
          <span
            role="alert"
            className="text-destructive absolute top-full left-1/2 z-10 mt-1 w-max max-w-40 -translate-x-1/2 text-center text-sm"
          >
            {t("history.pdfError")}
          </span>
        )}
        {phase === "fallback-confirmed" && action === "share" && (
          <span
            role="status"
            aria-live="polite"
            className="text-muted-foreground absolute top-full left-1/2 z-10 mt-1 w-max max-w-40 -translate-x-1/2 text-center text-sm"
          >
            {t("history.downloadedNoShare")}
          </span>
        )}
        {/* Con cháu của button (không phải anh em cấp Tooltip, xem D2 ở trên) — aria-describedby tìm ra nó theo id bất kể DOM chứa nó thế nào, nên việc chuyển này không ảnh hưởng ngữ nghĩa a11y, chỉ ảnh hưởng layout. */}
        <span id={reasonId} className="sr-only">
          {/* Lý do BỊ CHẶN thắng lý do BẬN: khi đang bị chặn thì không có lượt
              tạo tệp nào để mà bận. */}
          {blocked ? blockedReason : phase === "busy" ? t("history.generatingPdf") : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent>{blocked ? blockedReason : label}</TooltipContent>
    </Tooltip>
  );
}
