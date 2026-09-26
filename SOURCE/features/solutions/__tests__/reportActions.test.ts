// reportSolution / reportComment — Server Action call-shape + error mapping
// unit tests (backend task 33; plan § P4-T2; backend DD § Integration
// Verification Points "Task ownership": the report actions' unit tests
// belong to this task).
//
// Mock boundary (same convention as commentActions.test.ts /
// helpfulPinActions.test.ts): the Supabase SESSION client AND `guard()` are
// both mocked here. `community_content_reports` has RLS on with zero
// policies and zero grants (U1) — the ONLY write path is the two SECURITY
// DEFINER RPCs, so neither action may ever call
// `.from("community_content_reports")` (Required Test #11). A repeat report
// is a SUCCESS the RPC reports as `already_reported: true` — there is no
// `23505` path anywhere in this module (U1).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, rpcMock, guardMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  guardMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  })),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  guard: guardMock,
}));

const { reportSolution, reportComment } = await import("@/features/solutions/actions");

const ACTIONS_SOURCE_PATH = fileURLToPath(new URL("../actions.ts", import.meta.url));

function mockUser(id: string) {
  getUserMock.mockResolvedValue({ data: { user: { id } } });
}

function allowGuard() {
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
}

let uidCounter = 0;
function freshUserId() {
  uidCounter += 1;
  return `report-actions-user-${uidCounter}`;
}

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  guardMock.mockReset();
});

describe("reportSolution / reportComment — Required test list rows 1-3", () => {
  it("row 1: reportSolution(S, 'spam') -> RPC [{already_reported:false}] -> { ok: true, alreadyReported: false }; one .rpc call with exact args", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: false }], error: null });

    const result = await reportSolution("solution-1", "spam");

    expect(result).toEqual({ ok: true, alreadyReported: false });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "report_community_solution", {
      p_solution_id: "solution-1",
      p_reason: "spam",
    });
  });

  it("row 2 (repeat): reportSolution(S, 'spam') -> RPC [{already_reported:true}] -> { ok: true, alreadyReported: true }, a success, never an error", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: true }], error: null });

    const result = await reportSolution("solution-2", "spam");

    expect(result).toEqual({ ok: true, alreadyReported: true });
  });

  it("row 3: reportComment(C, 'spam') -> RPC [{already_reported:false}] -> one .rpc call named report_community_comment with exact args", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: false }], error: null });

    const result = await reportComment("comment-3", "spam");

    expect(result).toEqual({ ok: true, alreadyReported: false });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "report_community_comment", {
      p_comment_id: "comment-3",
      p_reason: "spam",
    });
  });
});

describe("reason validation — Required test list rows 4-5", () => {
  it("row 4: reportSolution(S, '   ') -> { ok: false, error: { code: 'empty' } }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    allowGuard();

    const result = await reportSolution("solution-4", "   ");

    expect(result).toEqual({ ok: false, error: { code: "empty" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("row 4 (reportComment branch): reportComment(C, '   ') -> { ok: false, error: { code: 'empty' } }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    allowGuard();

    const result = await reportComment("comment-4", "   ");

    expect(result).toEqual({ ok: false, error: { code: "empty" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("row 5: reportSolution(S, 'x'.repeat(1200)) -> p_reason is exactly 1000 characters (trimmed first)", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: false }], error: null });

    await reportSolution("solution-5", "  " + "x".repeat(1200) + "  ");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [, args] = rpcMock.mock.calls[0] as [string, { p_reason: string }];
    expect(args.p_reason).toHaveLength(1000);
    expect(args.p_reason).toBe("x".repeat(1000));
  });

  it("row 5 (reportComment branch): reportComment(C, 'x'.repeat(1200)) -> p_reason is exactly 1000 characters", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: false }], error: null });

    await reportComment("comment-5", "x".repeat(1200));

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [, args] = rpcMock.mock.calls[0] as [string, { p_reason: string }];
    expect(args.p_reason).toHaveLength(1000);
  });
});

describe("error mapping — Required test list rows 6-7", () => {
  it("row 6: reportSolution -> RPC error { code: '42501' } -> { code: 'generic' }, naming no reason", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "report_community_solution: not eligible" },
    });

    const result = await reportSolution("solution-6", "spam");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    if (!result.ok) {
      expect(JSON.stringify(result.error)).not.toMatch(/eligible|own|banned|attempt/i);
    }
  });

  it("row 6 (reportComment branch): reportComment -> RPC error { code: '42501' } -> { code: 'generic' }", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "report_community_comment: not eligible" },
    });

    const result = await reportComment("comment-6", "spam");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 7: reportSolution -> RPC error { code: '23514' } -> { code: 'generic' }; console.error called with RPC name and code only", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "community_content_reports_reason_check" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await reportSolution("solution-7", "spam");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("report_community_solution"),
      "23514"
    );
    errorSpy.mockRestore();
  });

  it("row 7 (reportComment branch): reportComment -> RPC error { code: '23514' } -> { code: 'generic' }; console.error called with RPC name and code only", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "community_content_reports_reason_check" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await reportComment("comment-7", "spam");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("report_community_comment"),
      "23514"
    );
    errorSpy.mockRestore();
  });

  it("row 7b: any other RPC code (network/infra) -> { code: 'generic' }; console.error called with RPC name and code only", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "08006", message: "connection failure" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await reportSolution("solution-7b", "spam");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("report_community_solution"), "08006");
    errorSpy.mockRestore();
  });
});

describe("rate limiting — Required test list row 8", () => {
  it("row 8: reportSolution — guard() rejects with seconds: 15 -> { code: 'rateLimited', seconds: 15 }; .rpc call count 0; the reason argument is untouched", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 15 });
    const reason = "  spam reason untouched  ";

    const result = await reportSolution("solution-8", reason);

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 15 } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("row 8 (reportComment branch): guard() rejects with seconds: 15 -> { code: 'rateLimited', seconds: 15 }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 15 });

    const result = await reportComment("comment-8", "spam reason untouched");

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 15 } });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("no reason leakage — Required test list row 9", () => {
  it("row 9: every failure branch (rate-limited, empty, 42501, 23514, other) never logs the reason string via console.error/log/warn", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const reason = "Đây là một lý do báo cáo không được phép rò rỉ vào log server";

    // rate-limited: no RPC at all.
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30 });
    await reportSolution("solution-9a", reason);

    // empty: no RPC at all.
    mockUser(freshUserId());
    allowGuard();
    await reportSolution("solution-9b", "   ");

    // 42501
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: reason } });
    await reportSolution("solution-9c", reason);

    // 23514
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "23514", message: reason } });
    await reportSolution("solution-9d", reason);

    // other code
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "08006", message: reason } });
    await reportSolution("solution-9e", reason);

    // reportComment branch, same 5 sub-cases.
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30 });
    await reportComment("comment-9a", reason);

    mockUser(freshUserId());
    allowGuard();
    await reportComment("comment-9b", "   ");

    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: reason } });
    await reportComment("comment-9c", reason);

    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "23514", message: reason } });
    await reportComment("comment-9d", reason);

    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "08006", message: reason } });
    await reportComment("comment-9e", reason);

    for (const spy of [errorSpy, logSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        for (const arg of call) {
          expect(String(arg)).not.toContain(reason);
        }
      }
    }

    errorSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("no side effect on target — Required test list row 10 (AC-075)", () => {
  it("row 10: a successful reportSolution makes exactly one .rpc call and zero calls touching community_solutions or community_solution_comments", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: false }], error: null });

    await reportSolution("solution-10", "spam");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "report_community_solution", expect.anything());
  });

  it("row 10 (reportComment branch): a successful reportComment makes exactly one .rpc call and zero calls touching community_solutions or community_solution_comments", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ already_reported: false }], error: null });

    await reportComment("comment-10", "spam");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "report_community_comment", expect.anything());
  });
});

describe("module source — Required test list row 11", () => {
  it("row 11: actions.ts contains no .from(\"community_content_reports\") anywhere; the report actions added by this task contain no \"23505\" literal and read no error.message", () => {
    const source = readFileSync(ACTIONS_SOURCE_PATH, "utf8");

    expect(source).not.toContain('.from("community_content_reports")');

    // Scoped to the code this task adds (task 33's report actions section),
    // same convention as commentActions.test.ts row 11's error.message slice.
    // Pre-existing "23505" occurs earlier in the module in
    // SILENT_RPC_ERROR_CODES (saveSolution/setSolutionStatus, task 04) — a
    // defensive, unrelated-domain entry predating this task, not a
    // duplicate-report branch; U1 forbids only a report-specific 23505 path.
    const reportSection = source.slice(source.indexOf("export async function reportSolution"));
    expect(reportSection).not.toContain("23505");
    expect(reportSection).not.toMatch(/error\.message/);
  });
});
