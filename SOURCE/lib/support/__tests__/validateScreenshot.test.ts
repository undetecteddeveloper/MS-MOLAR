import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/ugc/limits";
import { checkScreenshotFile } from "@/lib/support/validateScreenshot";

describe("checkScreenshotFile", () => {
  it("accepts a file exactly at MAX_SCREENSHOT_BYTES", () => {
    const result = checkScreenshotFile({ type: "image/png", size: LIMITS.MAX_SCREENSHOT_BYTES });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a file one byte over MAX_SCREENSHOT_BYTES with reason too_large", () => {
    const result = checkScreenshotFile({
      type: "image/png",
      size: LIMITS.MAX_SCREENSHOT_BYTES + 1,
    });
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  for (const mime of LIMITS.ALLOWED_SCREENSHOT_MIME) {
    it(`accepts allowed MIME type ${mime}`, () => {
      const result = checkScreenshotFile({ type: mime, size: 1024 });
      expect(result).toEqual({ ok: true });
    });
  }

  it("rejects a disallowed MIME type with reason invalid_type", () => {
    const result = checkScreenshotFile({ type: "application/pdf", size: 1024 });
    expect(result).toEqual({ ok: false, reason: "invalid_type" });
  });

  it("checks MIME before size — an oversized disallowed-type file fails invalid_type, not too_large", () => {
    const result = checkScreenshotFile({
      type: "application/pdf",
      size: LIMITS.MAX_SCREENSHOT_BYTES + 1,
    });
    expect(result).toEqual({ ok: false, reason: "invalid_type" });
  });
});
