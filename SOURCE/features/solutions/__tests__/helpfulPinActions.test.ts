// toggleHelpful / setPin — Server Action call-shape + error mapping unit
// tests (backend task 15; plan § P2-T3; backend DD § Integration Verification
// Points "Pin atomicity" -> "The target argument").
//
// Mock boundary (task file Red Phase instruction, deliberately different from
// writerActions.test.ts's real-guard()-with-fake-timers approach): the
// Supabase SESSION client AND `guard()` are both mocked here. Every case
// asserts on the mocked client's method log (RPC names + argument objects),
// never on a typed wrapper -- rpcMock is one shared vi.fn() for every
// .rpc(...) call, so rpcMock.mock.calls is the ordered [name, args] log.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts imports "server-only" -- same stub as writerActions.test.ts /
// communitySolutions.int.test.ts.
vi.mock("server-only", () => ({}));

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

const { toggleHelpful, setPin } = await import("@/features/solutions/actions");

function mockUser(id: string) {
  getUserMock.mockResolvedValue({ data: { user: { id } } });
}

function allowGuard() {
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
}

let uidCounter = 0;
/** Mỗi case một user id riêng -- không bắt buộc ở đây (guard bị mock, không
 *  đếm rate-limit thật) nhưng giữ cùng quy ước với writerActions.test.ts. */
function freshUserId() {
  uidCounter += 1;
  return `helpful-pin-actions-user-${uidCounter}`;
}

const ACTIONS_SOURCE_PATH = fileURLToPath(
  new URL("../actions.ts", import.meta.url)
);

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  guardMock.mockReset();
});

describe("toggleHelpful — Required test list rows 1-7", () => {
  it("row 1: add -> [{ added: true }] -> { ok: true, on: true }; exactly one .rpc call, named add_community_solution_helpful, with { p_solution_id: S }; zero remove_* calls", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ added: true }], error: null });

    const result = await toggleHelpful("solution-1");

    expect(result).toEqual({ ok: true, on: true });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "add_community_solution_helpful", {
      p_solution_id: "solution-1",
    });
    expect(rpcMock.mock.calls.some(([name]) => name === "remove_community_solution_helpful")).toBe(
      false
    );
  });

  it("row 2: add -> [{ added: false }], then remove -> no data -> { ok: true, on: false }; method log is exactly [add, remove], in that order, both with { p_solution_id: S }", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ added: false }], error: null });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await toggleHelpful("solution-2");

    expect(result).toEqual({ ok: true, on: false });
    expect(rpcMock.mock.calls).toEqual([
      ["add_community_solution_helpful", { p_solution_id: "solution-2" }],
      ["remove_community_solution_helpful", { p_solution_id: "solution-2" }],
    ]);
  });

  it("row 3: add -> { code: '42501' } -> { ok: false, error: { code: 'generic' } }; no remove call; the returned object names no reason", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "add_community_solution_helpful: not eligible" },
    });

    const result = await toggleHelpful("solution-3");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    if (!result.ok) {
      expect(JSON.stringify(result.error)).not.toMatch(/eligible|reason|author|submit/i);
    }
  });

  it("row 4: guard() rejects with seconds: 42 -> { ok: false, error: { code: 'rateLimited', seconds: 42 } }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 42 });

    const result = await toggleHelpful("solution-4");

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 42 } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("row 5: add -> [{ added: false }], remove -> { code: '42501' } -> { code: 'generic' }; still exactly two .rpc calls", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ added: false }], error: null });
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "remove_community_solution_helpful: not eligible" },
    });

    const result = await toggleHelpful("solution-5");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("row 6: exactly one guard('communitySolutionHelpful') call per invocation, even in the two-RPC branch (case 2)", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ added: false }], error: null });
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    await toggleHelpful("solution-6");

    expect(guardMock).toHaveBeenCalledTimes(1);
    expect(guardMock.mock.calls[0][0]).toBe("communitySolutionHelpful");
  });

  it("row 7: toggleHelpful/setPin's own source contains no .from(\"community_solution_helpfuls\") and no \"23505\" literal", () => {
    // Scoped to the two functions this task adds (same slicing pattern as
    // row 13 below) rather than the whole module: SILENT_RPC_ERROR_CODES
    // upstream in this file legitimately carries "23505" for saveSolution/
    // setSolutionStatus per the backend DD's binding § Logging and
    // Monitoring rule (task 04) — that is not this task's code to touch, and
    // removing it would contradict a decision already implemented and
    // verified in a prior task (escalated to the engineer 2026-09-25, kept).
    const source = readFileSync(ACTIONS_SOURCE_PATH, "utf8");
    const newActionsSource = source.slice(source.indexOf("export async function toggleHelpful"));

    expect(newActionsSource).not.toContain('.from("community_solution_helpfuls")');
    expect(newActionsSource).not.toContain("23505");
  });
});

describe("setPin — Required test list rows 8-12", () => {
  it("row 8: setPin(examId, 'pin', A) -> .rpc called with exactly ('set_community_solution_pin', { p_exam_id: examId, p_action: 'pin', p_solution_id: A }) -- forwarded third argument, Reference Contract Value #22", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ pinned_solution_id: "sol-A" }], error: null });

    await setPin("exam-1", "pin", "sol-A");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "set_community_solution_pin", {
      p_exam_id: "exam-1",
      p_action: "pin",
      p_solution_id: "sol-A",
    });
  });

  it("row 9: setPin(examId, 'unpin') -> one .rpc call with p_action: 'unpin'; p_solution_id is undefined; no second call", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: [{ pinned_solution_id: null }], error: null });

    await setPin("exam-1", "unpin");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "set_community_solution_pin", {
      p_exam_id: "exam-1",
      p_action: "unpin",
      p_solution_id: undefined,
    });
  });

  it("row 10: setPin(examId, 'purge' as never, A) -> rejected before any call: .rpc call count 0", async () => {
    const result = await setPin("exam-1", "purge" as never, "sol-A");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("row 11: setPin(examId, 'pin', A) -> { code: '22023' } -> { code: 'generic' }", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "22023", message: "set_community_solution_pin: target not a published solution of this exam" },
    });

    const result = await setPin("exam-1", "pin", "sol-A");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 12: setPin(examId, 'pin', A) -> guard() rejects -> { code: 'rateLimited', seconds }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 17 });

    const result = await setPin("exam-1", "pin", "sol-A");

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 17 } });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("both actions — Required test list row 13", () => {
  it("row 13: no code path reads error.message -- source read, plus a case whose error carries only a message, which must still map to generic", async () => {
    const source = readFileSync(ACTIONS_SOURCE_PATH, "utf8");
    const toggleHelpfulBody = source.slice(
      source.indexOf("export async function toggleHelpful"),
      source.indexOf("export async function setPin")
    );
    const setPinBody = source.slice(source.indexOf("export async function setPin"));

    expect(toggleHelpfulBody).not.toMatch(/error\.message/);
    expect(setPinBody).not.toMatch(/error\.message/);

    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "add_community_solution_helpful: not eligible" } });
    const helpfulResult = await toggleHelpful("solution-13");
    expect(helpfulResult).toEqual({ ok: false, error: { code: "generic" } });

    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "set_community_solution_pin: invalid action" } });
    const pinResult = await setPin("exam-1", "pin", "sol-A");
    expect(pinResult).toEqual({ ok: false, error: { code: "generic" } });
  });
});
