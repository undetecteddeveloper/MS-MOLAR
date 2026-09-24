// saveSolution / setSolutionStatus / getMySolutionForWriter / getResultCardSummary
// — Server Action error mapping + query mapper unit tests (backend task 04).
//
// Mock boundary (backend DD § Test Boundaries; skeleton communitySolutions.int
// .test.ts's own Mock Boundary Decision, mirrored here): the Supabase SESSION
// client (.rpc/auth.getUser returned by @/lib/supabase/server createClient())
// is the only sanctioned mock. guard()/checkRateLimit() run for REAL — the
// rate-limited row exhausts the real in-memory counter directly, under frozen
// fake timers, so the seconds value is byte-comparable (Boundary Context
// roundtrip check), never guessed or mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts imports "server-only" (throws outside a Next server/react-server
// bundle) — same stub as rating.int.test.ts / getResult.int.test.ts.
vi.mock("server-only", () => ({}));

const { getUserMock, rpcMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  })),
}));

const { saveSolution, setSolutionStatus } = await import("@/features/solutions/actions");
const { getMySolutionForWriter, getResultCardSummary } = await import("@/features/solutions/queries");
const { guard, __resetRateLimitForTests, RATE_LIMITS } = await import("@/lib/security/rateLimit");

function mockUser(id: string) {
  getUserMock.mockResolvedValue({ data: { user: { id } } });
}

function mockRpcResult(result: { data: unknown; error: unknown }) {
  rpcMock.mockResolvedValue(result);
}

const validPatch = {
  attemptId: "attempt-1",
  showProfile: true,
  showScore: false,
  notes: [{ questionId: "q1", body: "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm" }],
};

let uidCounter = 0;
/** Mỗi case một user id RIÊNG — bộ đếm rate-limit trong RAM dùng chung toàn
 *  tiến trình test (như rating.int.test.ts's RATER_ID), tránh case sau ăn
 *  suất case trước. */
function freshUserId() {
  uidCounter += 1;
  return `writer-actions-user-${uidCounter}`;
}

describe("saveSolution — error mapping (Required test list rows 1-7)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  it("row 1: 23514 + details 'below_word_count' -> belowWordCount, no missingCount key", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code: "23514", details: "below_word_count" } });

    const result = await saveSolution("exam-1", validPatch);

    expect(result).toEqual({ ok: false, error: { code: "belowWordCount" } });
    if (!result.ok && result.error.code === "belowWordCount") {
      expect("missingCount" in result.error).toBe(false);
    }
  });

  it("row 2: 23514 + details is Postgres's own 'Failing row contains (…)' (notes body-length CHECK) -> generic", async () => {
    mockUser(freshUserId());
    mockRpcResult({
      data: null,
      error: { code: "23514", details: "Failing row contains (solution-1, q1, ...)." },
    });

    const result = await saveSolution("exam-1", validPatch);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 3: 23514 + details '' -> generic", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code: "23514", details: "" } });

    const result = await saveSolution("exam-1", validPatch);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 4: 23514 + details '' + message containing '15 words' -> generic (proves message is never read)", async () => {
    mockUser(freshUserId());
    mockRpcResult({
      data: null,
      error: { code: "23514", details: "", message: "note below 15 words" },
    });

    const result = await saveSolution("exam-1", validPatch);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 5: message-only literal 'below_word_count' (code '', details '') -> generic (clause a)", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code: "", details: "", message: "below_word_count" } });

    const result = await saveSolution("exam-1", validPatch);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 6: 42501 -> generic", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code: "42501", message: "save_community_solution: exam not visible" } });

    const result = await saveSolution("exam-1", validPatch);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 7: guard() rejects -> rateLimited with guard()'s own seconds, .rpc call count 0", async () => {
    vi.useFakeTimers();
    try {
      __resetRateLimitForTests();
      const userId = freshUserId();
      for (let i = 0; i < RATE_LIMITS.communitySolutionSave.limit; i++) {
        await guard("communitySolutionSave", userId);
      }
      // Lời gọi guard() độc lập ngay sau, cùng một mốc thời gian đóng băng —
      // đọc lại giá trị "sự thật" mà action PHẢI trả về nguyên vẹn (roundtrip
      // check, Boundary Context).
      const directReject = await guard("communitySolutionSave", userId);
      expect(directReject.ok).toBe(false);

      mockUser(userId);
      const result = await saveSolution("exam-1", validPatch);

      expect(result).toEqual({
        ok: false,
        error: { code: "rateLimited", seconds: directReject.retryAfterSeconds },
      });
      expect(rpcMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("setSolutionStatus — error mapping (Required test list rows 8-11)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  it("row 8: 23514 + details '3' -> belowWordCount with missingCount 3", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code: "23514", details: "3" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "belowWordCount", missingCount: 3 } });
  });

  it.each(["0", "-1", "", "abc"])(
    "row 9: 23514 + details '%s' -> generic (Number.parseInt + finite integer >= 1, Reference Contract Value #12)",
    async (details) => {
      mockUser(freshUserId());
      mockRpcResult({ data: null, error: { code: "23514", details } });

      const result = await setSolutionStatus("exam-1", "publish");

      expect(result).toEqual({ ok: false, error: { code: "generic" } });
    }
  );

  it.each(["42501", "P0002", "22023"])("row 10: %s -> generic", async (code) => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code, message: "irrelevant" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 11: no input across the whole suite produces notEligible or hidden", async () => {
    mockUser(freshUserId());
    const errorCodes = ["23514", "42501", "P0002", "22023", "", "unknown"];
    const seenCodes = new Set<string>();

    for (const code of errorCodes) {
      mockRpcResult({ data: null, error: { code, details: "" } });
      const saveResult = await saveSolution("exam-1", validPatch);
      if (!saveResult.ok) seenCodes.add(saveResult.error.code);

      mockRpcResult({ data: null, error: { code, details: "" } });
      const statusResult = await setSolutionStatus("exam-1", "publish");
      if (!statusResult.ok) seenCodes.add(statusResult.error.code);
    }

    expect(seenCodes.has("notEligible")).toBe(false);
    expect(seenCodes.has("hidden")).toBe(false);
    expect([...seenCodes].every((code) => ["belowWordCount", "generic", "rateLimited"].includes(code))).toBe(
      true
    );
  });
});

describe("getMySolutionForWriter / getResultCardSummary — mapper cases (Required test list rows 12-15)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  const baseQuestion = {
    question_id: "q1",
    stem: "stem",
    correct_answer: "A",
    my_result: null,
    has_changed: false,
    essay_prefill_applied: false,
  };

  it("row 12: note null/word_count 0 -> note '' / wordCount 0; note 'abc'/word_count 1 -> note 'abc' / wordCount 1; note is always a string", async () => {
    mockRpcResult({
      data: [
        {
          solution_id: "sol-1",
          attempt_id: "att-1",
          status: "draft",
          show_profile: true,
          show_score: false,
          hidden_reason: null,
          questions: [
            { ...baseQuestion, question_id: "q1", note: null, word_count: 0 },
            { ...baseQuestion, question_id: "q2", note: "abc", word_count: 1 },
          ],
        },
      ],
      error: null,
    });

    const state = await getMySolutionForWriter("exam-1");

    expect(state).not.toBeNull();
    const [q1, q2] = state!.questions;
    expect(q1.note).toBe("");
    expect(q1.wordCount).toBe(0);
    expect(q2.note).toBe("abc");
    expect(q2.wordCount).toBe(1);
    expect(typeof q1.note).toBe("string");
    expect(typeof q2.note).toBe("string");
  });

  it("row 13: the 'no solution yet' row (solution_id null, status null) -> solutionId null AND status null, not 'draft', key present", async () => {
    mockRpcResult({
      data: [
        {
          solution_id: null,
          attempt_id: "att-1",
          status: null,
          show_profile: true,
          show_score: false,
          hidden_reason: null,
          questions: [],
        },
      ],
      error: null,
    });

    const state = await getMySolutionForWriter("exam-1");

    expect(state).not.toBeNull();
    expect(state!.solutionId).toBeNull();
    expect(state!.status).toBeNull();
    expect("status" in state!).toBe(true);
    expect(state!.status).not.toBe("draft");
  });

  it("row 14: zero rows from community_solution_for_writer -> null (no throw)", async () => {
    mockRpcResult({ data: [], error: null });

    await expect(getMySolutionForWriter("exam-1")).resolves.toBeNull();
  });

  it("row 15: zero rows from community_solution_result_card -> null (no throw)", async () => {
    mockRpcResult({ data: [], error: null });

    await expect(getResultCardSummary("exam-1")).resolves.toBeNull();
  });
});

describe("Failure Mode #1 (same-value / AC-031) — repeat save with identical text is idempotent", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  it("two identical saveSolution calls against the same mocked RPC response produce deep-equal results", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: [{ solution_id: "sol-1", status: "draft" }], error: null });

    const first = await saveSolution("exam-1", validPatch);
    const second = await saveSolution("exam-1", validPatch);

    expect(first).toEqual(second);
    expect(first).toEqual({ ok: true, solutionId: "sol-1", status: "draft" });
  });
});

describe("Failure Mode #2 (no-op) — publishing an already-published solution is re-entrant", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  it("setSolutionStatus(examId, 'publish') on an already-published row returns success, not an error", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: [{ status: "published" }], error: null });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: true, status: "published" });
  });
});

describe("Failure Mode #3 (empty input / AC-024) — countWords('') is 0; empty note gated only at publish", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  it("countWords('') returns 0", async () => {
    const { countWords } = await import("@/lib/solutions/countWords");
    expect(countWords("")).toBe(0);
  });

  it("setSolutionStatus publish refusal for a 0-word note maps to belowWordCount with missingCount, never a guessed count", async () => {
    mockUser(freshUserId());
    mockRpcResult({ data: null, error: { code: "23514", details: "1" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "belowWordCount", missingCount: 1 } });
  });
});

describe("Failure Mode #4 (invalid option) — setSolutionStatus accepts only 'publish' | 'draft'", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  it("an arbitrary action string is rejected before any RPC call (.rpc call count 0)", async () => {
    const result = await setSolutionStatus("exam-1", "archive" as unknown as "publish" | "draft");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
