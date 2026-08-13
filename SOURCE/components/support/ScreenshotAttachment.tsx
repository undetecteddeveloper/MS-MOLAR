"use client";

// ScreenshotAttachment — đính kèm TỐI ĐA 1 ảnh (AC-011: chọn ảnh thứ 2 THAY
// THẾ ảnh đầu, không cộng dồn). Tự quản vòng đời URL.createObjectURL —
// tạo lúc chọn file, revoke lúc unmount/thay/xoá (typescript-rules cleanup).
// Pre-validate bằng chính checkScreenshotFile (task-04) — KHÔNG chép lại
// LIMITS, tham chiếu thẳng.

import { useEffect, useMemo } from "react";
import { LIMITS } from "@/lib/ugc/limits";
import { checkScreenshotFile, type ScreenshotCheck } from "@/lib/support/validateScreenshot";
import { useT } from "@/lib/i18n/client";

type ScreenshotErrorReason = Exclude<ScreenshotCheck, { ok: true }>["reason"];

interface ScreenshotAttachmentProps {
  file: File | null;
  error: ScreenshotErrorReason | null;
  onSelect: (file: File | null, error: ScreenshotErrorReason | null) => void;
  disabled: boolean;
}

export function ScreenshotAttachment({ file, error, onSelect, disabled }: ScreenshotAttachmentProps) {
  const t = useT();
  // Tạo URL đồng bộ trong render (useMemo), KHÔNG setState trong effect
  // (react-hooks/set-state-in-effect) — effect bên dưới chỉ lo dọn dẹp.
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    // Reset input value ngay: cho phép chọn LẠI đúng file đó lần sau (onChange
    // chỉ bắn khi giá trị đổi — thiếu dòng này thì chọn lại file vừa bị "×"
    // gỡ sẽ im lặng không làm gì).
    e.target.value = "";
    if (!picked) return;

    const check = checkScreenshotFile({ type: picked.type, size: picked.size });
    if (!check.ok) {
      onSelect(null, check.reason);
      return;
    }
    onSelect(picked, null); // thay thế file cũ (nếu có) — AC-011
  }

  const errorId = "support-screenshot-error";
  const errorText =
    error === "too_large"
      ? t("support.screenshot.tooLarge", {
          maxMb: Math.round(LIMITS.MAX_SCREENSHOT_BYTES / (1024 * 1024)),
        })
      : error === "invalid_type"
        ? t("support.screenshot.invalidType")
        : null;

  return (
    <div className="mt-4">
      <label htmlFor="support-screenshot" className="text-foreground text-sm font-medium">
        {t("support.screenshot.label")}
      </label>

      {file && objectUrl ? (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL tạm thời, không phải Next Image/Storage */}
          <img
            src={objectUrl}
            alt=""
            className="border-border size-16 rounded-[4px] border object-cover"
          />
          <span className="text-muted-foreground flex-1 truncate text-sm">{file.name}</span>
          <button
            type="button"
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled) onSelect(null, null);
            }}
            className="text-muted-foreground hover:text-brand text-sm underline-offset-4 hover:underline"
          >
            {t("support.screenshot.remove")}
          </button>
        </div>
      ) : (
        <>
          {/* Input thật ẩn (peer) — label bên dưới là control hiển thị DUY
              NHẤT, để tránh chuỗi "No file chosen" trình duyệt tự chèn cạnh
              nút file gốc (không dịch được, không style được). sr-only thay
              vì hidden: vẫn ở trong accessibility tree + nhận Tab/focus, nút
              hiển thị phản chiếu trạng thái đó qua peer-focus-visible. */}
          <input
            id="support-screenshot"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled}
            aria-describedby={errorText ? errorId : undefined}
            className="peer sr-only"
          />
          <label
            htmlFor="support-screenshot"
            className="border-border bg-card text-foreground hover:bg-accent peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50 mt-2 inline-flex w-full cursor-pointer items-center justify-center rounded-[4px] border p-2 text-sm transition-colors peer-focus-visible:ring-3"
          >
            {t("support.screenshot.chooseFile")}
          </label>
        </>
      )}

      {errorText && (
        <p id={errorId} role="alert" className="text-brand mt-1 text-sm">
          {errorText}
        </p>
      )}
    </div>
  );
}
