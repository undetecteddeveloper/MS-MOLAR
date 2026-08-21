// /profile — display-name input filter and rules [unit]
// Design Doc: docs/design/profile-and-about-design.md (§Frontend contracts —
//   the /[^\p{L}.]/gu + slice(0,12) filter is extracted here rather than copied
//   a third time; the server rules in updateProfile read from the same module)
// PRD: docs/prd/profile-and-about-prd.md (AC-043–AC-045 — the three server-side
//   display-name rules; AC-046 — /profile reuses updateProfile, so the rules
//   cannot drift between call sites)

import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_RE,
  filterDisplayNameInput,
} from "../displayName";

describe("filterDisplayNameInput", () => {
  it("strips digits, spaces and punctuation other than the dot", () => {
    expect(filterDisplayNameInput("an 1_binh-!.x")).toBe("anbinh.x");
  });

  it("keeps accented Vietnamese letters", () => {
    expect(filterDisplayNameInput("Nguyễn")).toBe("Nguyễn");
  });

  it("truncates to DISPLAY_NAME_MAX characters", () => {
    expect(filterDisplayNameInput("abcdefghijklmnop")).toBe("abcdefghijkl");
    expect(filterDisplayNameInput("abcdefghijklmnop")).toHaveLength(DISPLAY_NAME_MAX);
  });

  it("truncates after filtering, so stripped characters do not consume the budget", () => {
    expect(filterDisplayNameInput("1234abcdefghijkl")).toBe("abcdefghijkl");
  });

  it("returns an empty string when nothing survives the filter", () => {
    expect(filterDisplayNameInput("12345")).toBe("");
  });
});

describe("DISPLAY_NAME_RE", () => {
  it("accepts letters and dots, including accented Vietnamese letters", () => {
    expect(DISPLAY_NAME_RE.test("Nguyễn")).toBe(true);
    expect(DISPLAY_NAME_RE.test("an.binh")).toBe(true);
  });

  it("rejects digits, spaces and an empty string", () => {
    expect(DISPLAY_NAME_RE.test("abc1")).toBe(false);
    expect(DISPLAY_NAME_RE.test("an binh")).toBe(false);
    expect(DISPLAY_NAME_RE.test("")).toBe(false);
  });

  it("is not sticky or global — repeated tests of the same string agree", () => {
    // A /g or /y regex advances lastIndex between calls; this one is used on
    // every submission, so a stateful flag would make the rule intermittent.
    expect(DISPLAY_NAME_RE.test("Nguyễn")).toBe(DISPLAY_NAME_RE.test("Nguyễn"));
  });
});
