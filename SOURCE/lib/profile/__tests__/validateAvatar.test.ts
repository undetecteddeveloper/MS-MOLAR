// /profile — checkAvatarFile boundaries [unit]
// Design Doc: docs/design/profile-and-about-design.md (§Backend contracts →
//   lib/profile/validateAvatar.ts — pure, structural param, MIME before size)
// PRD: docs/prd/profile-and-about-prd.md (AC-027 the three-MIME set, AC-028
//   wrong MIME refused, AC-029 the 2MB boundary in both directions, metric 4
//   "avatar rejection matrix: 6/6")
//
// The Server Action half (nothing reaches Storage when this refuses) is proven
// in features/auth/__tests__/profileActions.int.test.ts; this file proves only
// the decision itself.

import { describe, expect, it } from "vitest";
import { AVATAR_LIMITS } from "../limits";
import { checkAvatarFile } from "../validateAvatar";

describe("checkAvatarFile — size boundary (AC-029)", () => {
  it("accepts a file of exactly MAX_BYTES", () => {
    expect(checkAvatarFile({ type: "image/jpeg", size: AVATAR_LIMITS.MAX_BYTES })).toEqual({
      ok: true,
    });
  });

  it("refuses a file of MAX_BYTES + 1 with reason 'too_large'", () => {
    expect(checkAvatarFile({ type: "image/jpeg", size: AVATAR_LIMITS.MAX_BYTES + 1 })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("pins MAX_BYTES at 2MB — the value setup-storage.ts mirrors as fileSizeLimit '2MB'", () => {
    expect(AVATAR_LIMITS.MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("checkAvatarFile — MIME set (AC-027, AC-028)", () => {
  it.each(["image/jpeg", "image/png", "image/webp"] as const)("accepts %s", (type) => {
    expect(checkAvatarFile({ type, size: 1024 })).toEqual({ ok: true });
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", "", "image/jpeg; charset=utf-8"])(
    "refuses %s with reason 'invalid_type'",
    (type) => {
      expect(checkAvatarFile({ type, size: 1024 })).toEqual({ ok: false, reason: "invalid_type" });
    }
  );

  it("accepts exactly three MIME types and no more", () => {
    expect(AVATAR_LIMITS.ALLOWED_MIME).toHaveLength(3);
  });
});

describe("checkAvatarFile — MIME is decided before size", () => {
  it("reports 'invalid_type', not 'too_large', when a file is both oversized and wrongly typed", () => {
    // Same order as checkScreenshotFile. It matters for the message the student
    // sees: "shrink this PDF" would be advice they cannot act on.
    expect(
      checkAvatarFile({ type: "application/pdf", size: AVATAR_LIMITS.MAX_BYTES + 1 })
    ).toEqual({ ok: false, reason: "invalid_type" });
  });
});
