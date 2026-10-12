// Đăng nhập xong về đúng trang đang xem — `next` đi qua signIn, signUp,
// verifySignupCode và signInWithOAuth [integration, Supabase giả].
// Brief docs/plans/20261012-feature-guest-browse-subpages.md T7/D4.
//
// Mock Supabase theo tiền lệ verifyActions.int.test.ts. CHỨNG MINH được ở đây:
// đích redirect của từng action theo `next`, `next` lạ (open-redirect) rơi về
// /exams, và cookie OAuth được đặt/gỡ đúng. KHÔNG chứng minh được: vòng OAuth
// thật với Google/Facebook — cần provider bật + người thật bấm.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSetMock } = vi.hoisted(() => ({ cookieSetMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({
  guard: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock, get: vi.fn() }),
  headers: async () => new Headers({ origin: "http://localhost:3000" }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { createClient } from "@/lib/supabase/server";
import {
  signIn,
  signInWithOAuth,
  signUp,
  verifySignupCode,
} from "@/features/auth/actions";

const createClientMock = vi.mocked(createClient);

const PASSWORD = "Zx7-next-redirect-fixture-long";

function formDataOf(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function useClient(opts: { signUpSession?: object | null } = {}) {
  const signInWithOAuthFn = vi.fn(async () => ({
    data: { url: "https://accounts.example/consent" },
    error: null,
  }));
  createClientMock.mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: { session: opts.signUpSession ?? null }, error: null })),
      verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
      signInWithOAuth: signInWithOAuthFn,
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { signInWithOAuth: signInWithOAuthFn };
}

async function redirectTarget(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("NEXT_REDIRECT:")) return message.slice("NEXT_REDIRECT:".length);
    throw err;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signIn — đích sau đăng nhập", () => {
  it.each([
    ["/history", "/history"],
    ["/exams/exam-toan-10?from=hot", "/exams/exam-toan-10?from=hot"],
    ["", "/exams"],
    ["//evil.example", "/exams"],
    ["https://evil.example", "/exams"],
    ["/profile", "/exams"],
  ])("next=%j → %s", async (next, expected) => {
    useClient();
    const fields: Record<string, string> = { email: "a@b.vn", password: PASSWORD };
    if (next) fields.next = next;

    const target = await redirectTarget(() => signIn(null, formDataOf(fields)));

    expect(target).toBe(expected);
  });
});

describe("signUp — đích sau đăng ký", () => {
  it("chưa có session: next đi tiếp sang view nhập mã", async () => {
    useClient({ signUpSession: null });

    const target = await redirectTarget(() =>
      signUp(null, formDataOf({ email: "A@B.vn", password: PASSWORD, next: "/me/dashboard" }))
    );

    expect(target).toBe("/?auth=verify&email=a%40b.vn&next=%2Fme%2Fdashboard");
  });

  it("chưa có session + next lạ: view nhập mã KHÔNG mang next", async () => {
    useClient({ signUpSession: null });

    const target = await redirectTarget(() =>
      signUp(null, formDataOf({ email: "a@b.vn", password: PASSWORD, next: "//evil.example" }))
    );

    expect(target).toBe("/?auth=verify&email=a%40b.vn");
  });

  it("có session ngay: về next", async () => {
    useClient({ signUpSession: { access_token: "t" } });

    const target = await redirectTarget(() =>
      signUp(null, formDataOf({ email: "a@b.vn", password: PASSWORD, next: "/upload" }))
    );

    expect(target).toBe("/upload");
  });
});

describe("verifySignupCode — đích sau nhập mã", () => {
  it.each([
    ["/history", "/history"],
    ["", "/exams"],
    ["//evil.example", "/exams"],
  ])("next=%j → %s", async (next, expected) => {
    useClient();
    const fields: Record<string, string> = { email: "a@b.vn", code: "482916" };
    if (next) fields.next = next;

    const target = await redirectTarget(() => verifySignupCode(null, formDataOf(fields)));

    expect(target).toBe(expected);
  });
});

describe("signInWithOAuth — next đi bằng cookie, không bằng query", () => {
  it("next hợp lệ: đặt cookie httpOnly ngắn hạn; redirectTo KHÔNG đổi", async () => {
    const client = useClient();

    await redirectTarget(() =>
      signInWithOAuth(null, formDataOf({ provider: "google", next: "/history" }))
    );

    expect(cookieSetMock).toHaveBeenCalledWith(
      "ms-molar-post-auth",
      "/history",
      expect.objectContaining({ httpOnly: true, path: "/", maxAge: 600 })
    );
    expect(client.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { redirectTo: "http://localhost:3000/auth/callback?next=/exams" },
      })
    );
  });

  it("không có next hợp lệ: GỠ cookie cũ, không để lượt bỏ dở hôm trước kéo về", async () => {
    useClient();

    await redirectTarget(() =>
      signInWithOAuth(null, formDataOf({ provider: "facebook", next: "//evil.example" }))
    );

    expect(cookieSetMock).toHaveBeenCalledWith(
      "ms-molar-post-auth",
      "",
      expect.objectContaining({ path: "/", maxAge: 0 })
    );
    expect(cookieSetMock).not.toHaveBeenCalledWith(
      "ms-molar-post-auth",
      "//evil.example",
      expect.anything()
    );
  });
});
