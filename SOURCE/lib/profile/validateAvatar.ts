// /profile — avatar file check. Pure, no I/O, mirroring
// lib/support/validateScreenshot.ts including its decision order.
//
// The parameter is STRUCTURAL rather than `File` so the same function runs in
// the browser (pre-flight, before a byte is uploaded) and in the Server Action
// (the actual enforcement point — a crafted request never touches the browser).
//
// MIME is checked BEFORE size, same as checkScreenshotFile. The order is
// visible to the user: telling someone their 5MB PDF is "too large" invites
// them to shrink a file that would be refused at any size.
//
// MIME here is the browser-supplied string. There is no magic-byte sniffing
// anywhere in this repository and this module does not introduce it; the
// bucket's own allowedMimeTypes is the second layer (ADR-0016).

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
