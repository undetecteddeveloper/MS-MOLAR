// SOURCE/lib/support/validateScreenshot.ts — thuần, không I/O. Mirrors
// lib/ugc/validateInput.ts's checkUploadFile shape, riêng LIMITS cho screenshot
// (KHÔNG dùng LIMITS.ALLOWED_MIME của exam-upload — nó chấp nhận cả PDF).
import { LIMITS } from "@/lib/ugc/limits";

export type ScreenshotCheck =
  | { ok: true }
  | { ok: false; reason: "too_large" | "invalid_type" };

export function checkScreenshotFile(file: { type: string; size: number }): ScreenshotCheck {
  if (!LIMITS.ALLOWED_SCREENSHOT_MIME.includes(file.type as never)) {
    return { ok: false, reason: "invalid_type" };
  }
  if (file.size > LIMITS.MAX_SCREENSHOT_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true };
}
