// UploadStep — MỘT CHẶNG trên thanh dọc của trang Tải đề lên (2026-09-13, hướng
// A "Ba chặng" engineer chọn từ prototype): vòng số bên trái + vạch nối xuống
// chặng sau, nội dung bên phải. Trạng thái nói bằng HÌNH lẫn MÀU (§4.3): chặng
// đã xong = vòng xanh có dấu tích và vạch nối tô xanh; chặng đang làm = vòng
// vàng nắng chữ đen (cùng ngôn ngữ "đang ở đây" với ô câu hiện tại của bảng câu
// hỏi); chặng chưa tới = vòng surface chữ phụ. Đánh số vì đây là một TRÌNH TỰ
// thật (đề → đáp án → thông tin), không phải trang trí.
//
// Không có "use client": không state, không handler — chỉ bố cục. Render được
// ở mọi ranh giới, nhưng thực tế chỉ UploadForm (client) dựng nó.

import { Check } from "lucide-react";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

export type UploadStepState = "done" | "current" | "upcoming";

interface UploadStepProps {
  number: number;
  title: string;
  state: UploadStepState;
  /** Chữ nhỏ bên phải tiêu đề chặng ("bắt buộc", "đã có"). */
  meta?: string;
  /** Chặng cuối không kẻ vạch nối xuống. */
  last?: boolean;
  children: React.ReactNode;
}

export function UploadStep({ number, title, state, meta, last = false, children }: UploadStepProps) {
  return (
    <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-x-4">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold sm:size-8 sm:text-sm",
            state === "done" && "bg-primary text-primary-foreground",
            state === "current" && "bg-sun text-foreground",
            state === "upcoming" && "bg-surface text-muted-foreground"
          )}
        >
          {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : number}
        </span>
        {!last && (
          <span
            aria-hidden
            className={cn("my-1.5 w-0.5 flex-1", state === "done" ? "bg-primary" : "bg-border")}
          />
        )}
      </div>
      <div className={cn("flex flex-col gap-2.5", !last && "pb-6 sm:pb-7")}>
        <div className="flex min-h-7 items-center justify-between gap-2 sm:min-h-8">
          {/* Trạng thái cho trình đọc màn hình: vòng số là aria-hidden, nên
              chữ nói thay ("đã xong"/"đang làm"). */}
          <h2 className="text-base font-semibold sm:text-lg">
            {t("upload.stepLabel", { number, title })}
            <span className="sr-only">
              {state === "done"
                ? ` — ${t("upload.stepStateDone")}`
                : state === "current"
                  ? ` — ${t("upload.stepStateCurrent")}`
                  : ""}
            </span>
          </h2>
          {meta && (
            <span
              className={cn(
                "shrink-0 text-xs",
                state === "done" ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {meta}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
