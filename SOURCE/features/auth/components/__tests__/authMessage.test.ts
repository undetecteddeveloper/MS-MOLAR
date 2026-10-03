// authMessage — action trả khoá/dạng dây, client luôn ra tiếng Việt, không bao giờ chuỗi thô.

import { describe, expect, it } from "vitest";
import { authMessage } from "@/features/auth/components/authMessage";
import { t } from "@/lib/copy";
import { validatePassword } from "@/lib/auth/passwordPolicy";

describe("authMessage", () => {
  it("translates an auth.* key", () => {
    expect(authMessage("auth.error.sendFailed")).toBe(t("auth.error.sendFailed"));
    expect(authMessage("auth.resetSent")).toBe(t("auth.resetSent"));
  });

  it("translates the rate-limit wire form with its seconds", () => {
    expect(authMessage("profile.error.rateLimited:42")).toBe(
      t("profile.error.rateLimited", { seconds: "42" })
    );
  });

  it("translates the validatePassword sentence that signUp/updatePassword forward verbatim", () => {
    const sentence = validatePassword("short") as string;
    expect(sentence).toMatch(/at least/);
    expect(authMessage(sentence)).not.toMatch(/Password/);
  });

  it("never shows a raw English string, including provider text and prototype keys", () => {
    for (const raw of ["Error sending confirmation email", "toString", "auth.toString", ""]) {
      const shown = authMessage(raw);
      expect(shown).toBe(t("auth.error.generic"));
    }
  });
});
