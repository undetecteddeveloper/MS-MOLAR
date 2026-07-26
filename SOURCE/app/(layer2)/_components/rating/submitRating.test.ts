// submitRating — unit test tại ranh giới server-action rateExam (mocked, frontend
// DD § Mock Boundary Decisions: "submitRating unit-tests the arg mapping +
// error→copy mapping against a stubbed rateExam"). Không cần jsdom — hàm thuần
// async, không React.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(layer2)/actions", () => ({
  rateExam: vi.fn(),
}));

import { rateExam } from "@/app/(layer2)/actions";
import { submitRating } from "./submitRating";

const mockedRateExam = vi.mocked(rateExam);

describe("submitRating", () => {
  it("maps PartId scores to the partI/partII/partIII columns rateExam expects", async () => {
    mockedRateExam.mockResolvedValueOnce({});
    await submitRating("exam-1", { mcq: 7, true_false: 4, short_answer: 9 });
    expect(mockedRateExam).toHaveBeenCalledWith("exam-1", {
      partI: 7,
      partII: 4,
      partIII: 9,
    });
  });

  it("returns {ok:true} when rateExam resolves without an error", async () => {
    mockedRateExam.mockResolvedValueOnce({});
    const result = await submitRating("exam-1", { mcq: 1, true_false: 1, short_answer: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("maps rateExam's error union to the copy from rateErrorMessage", async () => {
    mockedRateExam.mockResolvedValueOnce({ error: "ineligible" });
    const result = await submitRating("exam-1", { mcq: 5, true_false: 5, short_answer: 5 });
    expect(result).toEqual({
      ok: false,
      message: "You need to finish this exam before you can rate it.",
    });
  });

  it("maps 'server' error to its exact copy", async () => {
    mockedRateExam.mockResolvedValueOnce({ error: "server" });
    const result = await submitRating("exam-1", { mcq: 5, true_false: 5, short_answer: 5 });
    expect(result).toEqual({
      ok: false,
      message: "Couldn't save your rating right now. Please try again.",
    });
  });
});
