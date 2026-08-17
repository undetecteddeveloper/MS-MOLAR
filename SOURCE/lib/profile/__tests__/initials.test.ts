// /profile — deriveInitials [unit]
// Design Doc: docs/design/profile-and-about-design.md (§Backend contracts →
//   lib/profile/initials.ts: dot is the only separator, first char of the first
//   two segments, Array.from so a Vietnamese character is taken whole)
// PRD: docs/prd/profile-and-about-prd.md (D11 initials fallback, AC-033b/AC-040
//   — the fallback must never be a broken image, so it must never throw either)

import { describe, expect, it } from "vitest";
import { deriveInitials } from "../initials";

describe("deriveInitials", () => {
  it("returns one character for a single-token name", () => {
    expect(deriveInitials("Nguyen")).toBe("N");
  });

  it("returns two characters for a dotted name", () => {
    expect(deriveInitials("nguyen.van")).toBe("NV");
  });

  it("ignores segments beyond the second", () => {
    expect(deriveInitials("a.b.c")).toBe("AB");
  });

  it("drops empty segments from a leading dot", () => {
    expect(deriveInitials(".an")).toBe("A");
  });

  it("drops empty segments from doubled and trailing dots", () => {
    expect(deriveInitials("an..binh.")).toBe("AB");
  });

  it("returns an empty string for empty input", () => {
    expect(deriveInitials("")).toBe("");
  });

  it("returns an empty string when the name is only separators", () => {
    expect(deriveInitials("...")).toBe("");
  });

  it("takes a Vietnamese precomposed character whole and uppercases it", () => {
    // Đ (U+0110) and Ứ (U+1EE8) are single code points; Array.from keeps them
    // intact rather than splitting anything, and toUpperCase maps đ → Đ.
    expect(deriveInitials("đức.ứng")).toBe("ĐỨ");
  });

  it("keeps an already-uppercase accented character unchanged", () => {
    expect(deriveInitials("Ứng")).toBe("Ứ");
  });
});
