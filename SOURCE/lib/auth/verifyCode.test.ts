// verifyCode — unit tests. Hàm thuần, không I/O → test trực tiếp, không mock.

import { describe, expect, it } from "vitest";
import {
  isValidCode,
  mapVerifyError,
  normalizeCode,
  normalizeEmail,
  VERIFY_CODE_MAX_LENGTH,
  VERIFY_CODE_MIN_LENGTH,
} from "./verifyCode";

describe("normalizeCode", () => {
  it("strips spaces and dashes pasted along with the code", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
  });

  it("leaves letters in place so they fail validation instead of being silently dropped", () => {
    expect(normalizeCode("12a456")).toBe("12a456");
  });
});

describe("isValidCode", () => {
  it("accepts the length boundaries", () => {
    expect(isValidCode("1".repeat(VERIFY_CODE_MIN_LENGTH))).toBe(true);
    expect(isValidCode("1".repeat(VERIFY_CODE_MAX_LENGTH))).toBe(true);
  });

  it("rejects one digit under the minimum and one over the maximum", () => {
    expect(isValidCode("1".repeat(VERIFY_CODE_MIN_LENGTH - 1))).toBe(false);
    expect(isValidCode("1".repeat(VERIFY_CODE_MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects non-digits and the empty string", () => {
    expect(isValidCode("12345a")).toBe(false);
    expect(isValidCode("")).toBe(false);
    expect(isValidCode("１２３４５６")).toBe(false); // chữ số full-width không phải \d ASCII
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases so one address maps to one rate-limit key", () => {
    expect(normalizeEmail("  Hoc.Sinh@Example.COM ")).toBe("hoc.sinh@example.com");
  });
});

describe("mapVerifyError", () => {
  it("maps wrong/expired codes (4xx) to the invalid key", () => {
    expect(mapVerifyError({ status: 400 })).toBe("auth.verify.error.invalid");
    expect(mapVerifyError({ status: 403 })).toBe("auth.verify.error.invalid");
    expect(mapVerifyError({ status: 422 })).toBe("auth.verify.error.invalid");
  });

  it("does not call a provider rate limit (429) a wrong code", () => {
    expect(mapVerifyError({ status: 429 })).toBe("auth.verify.error.generic");
  });

  it("maps server/network failures to the generic key", () => {
    expect(mapVerifyError({ status: 500 })).toBe("auth.verify.error.generic");
    expect(mapVerifyError({})).toBe("auth.verify.error.generic");
  });
});
