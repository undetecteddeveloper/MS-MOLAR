"use client";

// Dropzone — MỘT ô thả file (đề, hoặc đáp án) của trang Tải đề lên. Hiện tên +
// dung lượng file đã chọn, nút Gỡ; hint loại/kích thước/số trang. Controlled
// bởi UploadForm (giữ selection khi lỗi). Hỗ trợ kéo thả thật, không chỉ nhấp
// để chọn.
//
// Trước 2026-09-13 file này là `FileUploadFields` — cặp hai ô cố định (đề +
// đáp án, cả hai bắt buộc). Hướng A "Ba chặng" đặt mỗi ô vào một chặng riêng và
// ô đáp án chỉ hiện khi đáp án ở file riêng, nên cặp cứng ấy bỏ; chỉ còn ô đơn.
//
// Theme "Sân trường" (2026-09-09): ô bo 18px viền NÉT ĐỨT màu `--input` (đủ
// 3:1 — đây là ranh giới của một ô nhập, WCAG 1.4.11), icon tải lên + dòng chữ
// LUÔN hiện. Bản trước chỉ hiện dấu "+" cho tới khi rê chuột — trên điện thoại
// không có rê chuột, nên học sinh chỉ thấy một dấu cộng và phải đoán. Đã chọn
// file: viền xanh + nền surface + icon tích, tên file thay chữ hướng dẫn. Kéo
// file rê qua: cùng diện mạo "đã chọn" để báo "thả vào đây". Lỗi: viền đỏ +
// câu lỗi bên dưới.

import { useRef, useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import { LIMITS } from "@/lib/ugc/limits";
import { cn } from "@/lib/utils";

const MAX_MB = Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024));
const ACCEPT = LIMITS.ALLOWED_MIME.join(",");

/** Hint chung của mọi ô: loại/kích thước/số trang — đọc từ LIMITS, không chép số. */
export function fileHint(): string {
  return t("upload.fileHint", { mb: MAX_MB, pages: LIMITS.MAX_PDF_PAGES });
}

/** "1,2 MB" / "340 KB" — đủ để tác giả biết mình vừa chọn đúng file. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface DropzoneProps {
  id: string;
  /** Nhãn khả truy cập của ô. Ẩn mắt khi chặng đã có tiêu đề riêng
   *  (`labelHidden`) — hai dòng "Đề thi" chồng nhau là chữ thừa. */
  label: string;
  labelHidden?: boolean;
  /** Chữ hướng dẫn trong ô khi chưa có file. Mặc định câu chung. */
  dragLabel?: string;
  hint: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  error?: string;
}

export function Dropzone({
  id,
  label,
  labelHidden = false,
  dragLabel,
  hint,
  file,
  onSelect,
  disabled,
  error,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const filled = !!file || dragOver;

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  }

  return (
    <div>
      <span
        id={labelId}
        className={cn("text-foreground mb-1.5 block text-sm font-medium", labelHidden && "sr-only")}
      >
        {label}
      </span>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : hintId}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-card flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-5 text-center transition-[border-color,background-color,scale] ease-out motion-safe:active:scale-[0.98]",
          "focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none",
          error
            ? "border-destructive"
            : filled
              ? "border-primary bg-surface"
              : "border-input hover:bg-surface",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        {file ? (
          <FileCheck2 aria-hidden className="text-primary size-6" />
        ) : (
          <Upload aria-hidden className="text-muted-foreground size-6" />
        )}
        <span className="max-w-full truncate text-sm font-medium">
          {file ? file.name : (dragLabel ?? t("upload.dragDrop"))}
        </span>
        {file && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatBytes(file.size)}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-start justify-between gap-3">
        <p id={hintId} className="text-muted-foreground text-xs leading-relaxed">
          {hint}
        </p>
        {file && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto shrink-0 px-0"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={disabled}
          >
            {t("common.remove")}
          </Button>
        )}
      </div>
      {error && (
        <p id={errorId} className="motion-unfold text-destructive mt-1 text-sm">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </div>
  );
}
