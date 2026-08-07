"use client";

// FileUploadFields — 2 dropzone (câu hỏi + đáp án) (UI Spec §FileUploadFields
// / Task 6.2). Hiện tên file đã chọn + nút gỡ; hint loại/kích thước/số trang.
// Controlled bởi UploadForm (giữ selection khi lỗi). Cả 2 file bắt buộc.
// Restyle theo prototype UI_Layer4_main: viền chấm, glyph "+" idle, crossfade
// sang text hint/tên file khi hover hoặc đã có file (HIDDEN-FEATURES #6);
// hỗ trợ drag & drop thật, không chỉ click-to-browse.

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { LIMITS } from "@/lib/ugc/limits";

const MAX_MB = Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024));
const ACCEPT = LIMITS.ALLOWED_MIME.join(",");

interface DropzoneProps {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  error?: string;
}

function Dropzone({ id, label, hint, file, onSelect, disabled, error }: DropzoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hover, setHover] = useState(false);
  const showText = !!file || hover || dragOver;

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
      <span className="eyebrow block">
        {label} <span className="text-brand">*</span>
      </span>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={[
          "mt-1.5 grid h-28 cursor-pointer place-items-center rounded-[4px] border border-dashed px-3 text-center transition-colors duration-200",
          error
            ? "border-brand"
            : dragOver || file
              ? "border-ring"
              : "border-border hover:border-ring",
          disabled ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "col-start-1 row-start-1 text-2xl text-muted-foreground transition-opacity duration-300",
            showText ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          +
        </span>
        <span
          className={[
            "col-start-1 row-start-1 max-w-full truncate px-2 text-sm text-foreground transition-opacity duration-300",
            showText ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          {file ? file.name : t("upload.dragDrop")}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {file && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            disabled={disabled}
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-brand hover:underline disabled:opacity-60"
          >
            {t("common.remove")}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 animate-in fade-in text-xs text-brand duration-200">
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

interface FileUploadFieldsProps {
  questionFile: File | null;
  answerFile: File | null;
  onSelectQuestion: (file: File | null) => void;
  onSelectAnswer: (file: File | null) => void;
  disabled?: boolean;
  questionError?: string;
  answerError?: string;
}

export function FileUploadFields({
  questionFile,
  answerFile,
  onSelectQuestion,
  onSelectAnswer,
  disabled,
  questionError,
  answerError,
}: FileUploadFieldsProps) {
  const t = useT();
  const hint = t("upload.fileHint", { mb: MAX_MB, pages: LIMITS.MAX_PDF_PAGES });
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Dropzone
        id="question-file"
        label={t("upload.examPaper")}
        hint={hint}
        file={questionFile}
        onSelect={onSelectQuestion}
        disabled={disabled}
        error={questionError}
      />
      <Dropzone
        id="answer-file"
        label={t("upload.answerKey")}
        hint={hint}
        file={answerFile}
        onSelect={onSelectAnswer}
        disabled={disabled}
        error={answerError}
      />
    </div>
  );
}
