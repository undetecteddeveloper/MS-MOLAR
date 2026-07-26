// SOURCE/lib/rating — frontend-form additions (Task 7, frontend DD § Rating-form
// State Management + Data-Fetching Plan). Literal-fixture vitest, node env, no I/O
// (Red Phase — written before PART_META/readoutModel/rateErrorMessage/
// mapFromMyRating exist, per Implementation Steps).

import { describe, expect, it } from "vitest";
import { PART_IDS, PART_META, mapFromMyRating, rateErrorMessage, readoutModel } from "../index";

describe("PART_META — copy verbatim từ UI Spec (AC-001, PartCard/PartDetail)", () => {
  it("PART_IDS is exactly [mcq, true_false, short_answer] in order", () => {
    expect(PART_IDS).toEqual(["mcq", "true_false", "short_answer"]);
  });

  it("mcq -> eyebrow/name/description verbatim", () => {
    expect(PART_META.mcq).toEqual({
      eyebrow: "PART I · MULTIPLE CHOICE",
      name: "Multiple Choice",
      description:
        "Four options per question, one correct answer. Tests basic recall and understanding.",
    });
  });

  it("true_false -> eyebrow/name/description verbatim", () => {
    expect(PART_META.true_false).toEqual({
      eyebrow: "PART II · TRUE / FALSE",
      name: "True / False",
      description:
        "Four sub-statements per question, mark each true or false. One wrong sub-statement forfeits the whole question — no guessing by elimination.",
    });
  });

  it("short_answer -> eyebrow/name/description verbatim", () => {
    expect(PART_META.short_answer).toEqual({
      eyebrow: "PART III · SHORT ANSWER",
      name: "Short Answer",
      description:
        "No options to pick from — solve and enter a single numeric answer. No room for guesswork.",
    });
  });
});

describe("readoutModel — running mean + status suffix (frontend DD derived-readout table)", () => {
  it("0 rated -> value '—', status 'UNRATED'", () => {
    expect(readoutModel({})).toEqual({ value: "—", status: "UNRATED" });
  });

  it("1 rated -> running mean of that part, '1/3 RATED'", () => {
    expect(readoutModel({ mcq: 6 })).toEqual({ value: "6.0", status: "1/3 RATED" });
  });

  it("2 rated -> running mean of the two, '2/3 RATED'", () => {
    expect(readoutModel({ mcq: 6, true_false: 8 })).toEqual({ value: "7.0", status: "2/3 RATED" });
  });

  it("3 rated -> overall(p1,p2,p3), 'RATED' (matches server AC-003)", () => {
    expect(readoutModel({ mcq: 1, true_false: 1, short_answer: 4 })).toEqual({
      value: "2.0",
      status: "RATED",
    });
  });

  it("3 rated with a non-terminating mean -> one-decimal rounding via formatMean", () => {
    expect(readoutModel({ mcq: 7, true_false: 8, short_answer: 9 })).toEqual({
      value: "8.0",
      status: "RATED",
    });
  });
});

describe("rateErrorMessage — copy map verbatim (Reference Contract row 2)", () => {
  it("'ineligible' -> exact copy", () => {
    expect(rateErrorMessage("ineligible")).toBe(
      "You need to finish this exam before you can rate it."
    );
  });

  it("'invalid' -> exact copy", () => {
    expect(rateErrorMessage("invalid")).toBe("Please rate all three parts from 1 to 10.");
  });

  it("'server' -> exact copy", () => {
    expect(rateErrorMessage("server")).toBe(
      "Couldn't save your rating right now. Please try again."
    );
  });
});

describe("mapFromMyRating — getMyRating() -> initialScores (frontend DD § Data-Fetching Plan)", () => {
  it("null (chưa đánh giá) -> undefined", () => {
    expect(mapFromMyRating(null)).toBeUndefined();
  });

  it("{partI,partII,partIII} -> {mcq,true_false,short_answer}", () => {
    expect(mapFromMyRating({ partI: 3, partII: 7, partIII: 10 })).toEqual({
      mcq: 3,
      true_false: 7,
      short_answer: 10,
    });
  });
});
