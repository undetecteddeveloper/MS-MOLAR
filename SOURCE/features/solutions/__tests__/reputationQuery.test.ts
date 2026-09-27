// getMyReputation() — thin-wrapper mapper unit cases (backend task 43,
// § Implementation Steps "Red Phase"; frontend DD § Integration Point Map
// "ProfileCard reputation insertion" boundary contract). `.rpc()` mocked at
// the Supabase client boundary and fed a literal row shaped exactly as
// community_reputation_summary() serializes it (SOURCE/supabase/schema.sql
// `returns table (total_score, published_count, helpful_count, pinned_count)`,
// task 41) — same mocking convention as solutionReadMappers.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts imports "server-only" — same stub as solutionReadMappers.test.ts.
vi.mock("server-only", () => ({}));

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: rpcMock,
  })),
}));

const { getMyReputation } = await import("@/features/solutions/queries");

describe("getMyReputation", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("maps a successful row to camelCase, with totalScore proven from the formula rather than copied from the mock", async () => {
    // AC-086 formula: 10 × published_count + 2 × helpful_count + 20 × pinned_count.
    // Derived independently here, not copied from the mock's total_score below:
    // 10 * 2 + 2 * 8 + 20 * 1 = 20 + 16 + 20 = 56.
    const expectedTotalScore = 10 * 2 + 2 * 8 + 20 * 1;
    expect(expectedTotalScore).toBe(56);

    rpcMock.mockResolvedValue({
      data: [{ total_score: 56, published_count: 2, helpful_count: 8, pinned_count: 1 }],
      error: null,
    });

    const result = await getMyReputation();

    expect(result).toEqual({
      ok: true,
      totalScore: expectedTotalScore,
      publishedCount: 2,
      helpfulCount: 8,
      pinnedCount: 1,
    });
  });

  it("calls .rpc exactly once, with community_reputation_summary and no arguments", async () => {
    rpcMock.mockResolvedValue({
      data: [{ total_score: 0, published_count: 0, helpful_count: 0, pinned_count: 0 }],
      error: null,
    });

    await getMyReputation();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("community_reputation_summary");
  });

  it("returns a failure result when the RPC errors, so the caller renders no reputation block", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom", code: "500" } });

    const result = await getMyReputation();

    expect(result).toEqual({ ok: false });
  });
});
