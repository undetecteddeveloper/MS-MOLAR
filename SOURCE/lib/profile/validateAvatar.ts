// /profile — avatar file check. Pure, no I/O, mirroring
// lib/support/validateScreenshot.ts, kể cả thứ tự quyết định của nó.
//
// Tham số mang kiểu CẤU TRÚC thay vì `File` để cùng một hàm chạy được ở
// trình duyệt (kiểm trước, khi chưa tải lên byte nào) và ở Server Action
// (điểm cưỡng chế thật — một request tự chế không bao giờ đi qua trình duyệt).
//
// MIME được kiểm TRƯỚC kích thước, giống checkScreenshotFile. Thứ tự này
// người dùng nhìn thấy được: báo ai đó rằng file PDF 5MB của họ "quá lớn" là mời
// họ thu nhỏ một file mà kích thước nào cũng bị từ chối.
//
// MIME ở đây là chuỗi do trình duyệt cung cấp. Không nơi nào trong repo này
// dò magic-byte và module này không đưa việc đó vào; allowedMimeTypes
// của chính bucket là lớp thứ hai (ADR-0016).

import { AVATAR_LIMITS } from "./limits";

export type AvatarCheck = { ok: true } | { ok: false; reason: "too_large" | "invalid_type" };

export function checkAvatarFile(file: { type: string; size: number }): AvatarCheck {
  if (!AVATAR_LIMITS.ALLOWED_MIME.includes(file.type as never)) {
    return { ok: false, reason: "invalid_type" };
  }
  if (file.size > AVATAR_LIMITS.MAX_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true };
}
