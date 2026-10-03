// Đăng ký → nhập mã xác minh email — signUp (nhánh chưa có session),
// verifySignupCode, resendSignupCode [integration, Supabase giả].
//
// Mock Supabase theo tiền lệ profileActions.int.test.ts. CHỨNG MINH được ở đây:
// tham số gọi verifyOtp/resend, thứ tự guard → Supabase, khoá bảng nhãn trả về
// (không bao giờ là câu của provider), đích redirect, và không có mã/email nào
// lọt vào log. KHÔNG chứng minh được: mã thật có tới hộp thư và được Supabase
// chấp nhận — việc đó cần mẫu mail có {{ .Token }} + SMTP riêng (xem PROGRESS.md).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({
  guard: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/security/rateLimit";
import { redirect } from "next/navigation";
import { resendSignupCode, signUp, verifySignupCode } from "@/features/auth/actions";

const createClientMock = vi.mocked(createClient);
const guardMock = vi.mocked(guard);
const redirectMock = vi.mocked(redirect);

// Chuỗi đặc trưng: test log grep từng đối số console, nên không được trùng ngẫu nhiên.
const EMAIL = "Hoc.Sinh@Example.com";
const EMAIL_NORMALIZED = "hoc.sinh@example.com";
const CODE = "482916";
const PASSWORD = "Zx7-signup-pw-fixture-long";

function formDataOf(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function makeClient(opts: {
  verifyError?: { status?: number; message?: string } | null;
  resendError?: { status?: number; message?: string } | null;
  signUpSession?: object | null;
  signUpError?: { message: string } | null;
} = {}) {
  const verifyOtp = vi.fn(async () => ({ data: {}, error: opts.verifyError ?? null }));
  const resend = vi.fn(async () => ({ data: {}, error: opts.resendError ?? null }));
  const signUpFn = vi.fn(async () => ({
    data: { session: opts.signUpSession ?? null },
    error: opts.signUpError ?? null,
  }));
  createClientMock.mockResolvedValue({
    auth: { verifyOtp, resend, signUp: signUpFn },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { verifyOtp, resend, signUp: signUpFn };
}

/** Chạy action mà redirect() ném; trả về URL đích, hoặc null nếu không redirect. */
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
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signUp → trang nhập mã", () => {
  it("sends a user with no session to /?auth=verify with the email prefilled", async () => {
    makeClient({ signUpSession: null });
    const target = await redirectTarget(() =>
      signUp(null, formDataOf({ email: EMAIL, password: PASSWORD, displayName: "Học Sinh" }))
    );
    expect(target).toBe(`/?auth=verify&email=${encodeURIComponent(EMAIL_NORMALIZED)}`);
  });

  it("still goes straight to /exams when the project returns a session (email confirm off)", async () => {
    makeClient({ signUpSession: { access_token: "x" } });
    const target = await redirectTarget(() =>
      signUp(null, formDataOf({ email: EMAIL, password: PASSWORD }))
    );
    expect(target).toBe("/exams");
  });

  it("does not redirect to verify when Supabase rejects the sign-up", async () => {
    makeClient({ signUpError: { message: "boom" } });
    const result = await signUp(null, formDataOf({ email: EMAIL, password: PASSWORD }));
    expect(result).toEqual({ error: "boom" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("verifySignupCode", () => {
  it("verifies as type 'signup' with a lowercased email and goes to /exams", async () => {
    const { verifyOtp } = makeClient();
    const target = await redirectTarget(() =>
      verifySignupCode(null, formDataOf({ email: EMAIL, code: CODE }))
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      email: EMAIL_NORMALIZED,
      token: CODE,
      type: "signup",
    });
    expect(target).toBe("/exams");
  });

  it("accepts a code pasted as '482 916' or '482-916'", async () => {
    const { verifyOtp } = makeClient();
    await redirectTarget(() =>
      verifySignupCode(null, formDataOf({ email: EMAIL, code: "482 916" }))
    );
    await redirectTarget(() =>
      verifySignupCode(null, formDataOf({ email: EMAIL, code: "482-916" }))
    );
    expect(verifyOtp).toHaveBeenNthCalledWith(1, expect.objectContaining({ token: CODE }));
    expect(verifyOtp).toHaveBeenNthCalledWith(2, expect.objectContaining({ token: CODE }));
  });

  it("rejects a malformed code without spending a guard slot or calling Supabase", async () => {
    const { verifyOtp } = makeClient();
    const result = await verifySignupCode(null, formDataOf({ email: EMAIL, code: "12ab56" }));
    expect(result).toEqual({ error: "auth.verify.error.invalid" });
    expect(guardMock).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("asks for the email when it is missing", async () => {
    const { verifyOtp } = makeClient();
    const result = await verifySignupCode(null, formDataOf({ email: "  ", code: CODE }));
    expect(result).toEqual({ error: "auth.verify.error.emailRequired" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("rate-limits per normalized email BEFORE asking Supabase", async () => {
    const { verifyOtp } = makeClient();
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 42 });
    const result = await verifySignupCode(null, formDataOf({ email: EMAIL, code: CODE }));
    expect(guardMock).toHaveBeenCalledWith("verifySignupCode", EMAIL_NORMALIZED);
    expect(result).toEqual({ error: "profile.error.rateLimited:42" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("maps a 4xx from Supabase to the invalid key and never leaks the provider message", async () => {
    makeClient({ verifyError: { status: 403, message: "Token has expired or is invalid" } });
    const result = await verifySignupCode(null, formDataOf({ email: EMAIL, code: CODE }));
    expect(result).toEqual({ error: "auth.verify.error.invalid" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("maps a server failure to the generic key", async () => {
    makeClient({ verifyError: { status: 500, message: "db down" } });
    const result = await verifySignupCode(null, formDataOf({ email: EMAIL, code: CODE }));
    expect(result).toEqual({ error: "auth.verify.error.generic" });
  });

  it("never writes the code or the email to any console method", async () => {
    const spies = (["error", "warn", "log", "info", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
    makeClient({ verifyError: { status: 403 } });
    await verifySignupCode(null, formDataOf({ email: EMAIL, code: CODE }));
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(CODE);
    expect(logged.toLowerCase()).not.toContain(EMAIL_NORMALIZED);
  });
});

describe("resendSignupCode", () => {
  it("resends a 'signup' mail and reports the shared success key", async () => {
    const { resend } = makeClient();
    const result = await resendSignupCode(null, formDataOf({ email: EMAIL }));
    expect(resend).toHaveBeenCalledWith({ type: "signup", email: EMAIL_NORMALIZED });
    expect(result).toEqual({ info: "auth.verify.resent" });
  });

  it("rate-limits per normalized email before sending", async () => {
    const { resend } = makeClient();
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 90 });
    const result = await resendSignupCode(null, formDataOf({ email: EMAIL }));
    expect(guardMock).toHaveBeenCalledWith("resendSignupCode", EMAIL_NORMALIZED);
    expect(result).toEqual({ error: "profile.error.rateLimited:90" });
    expect(resend).not.toHaveBeenCalled();
  });

  it("tells the user the mail quota is hit on a provider 429, without the provider text", async () => {
    makeClient({ resendError: { status: 429, message: "email rate limit exceeded" } });
    const result = await resendSignupCode(null, formDataOf({ email: EMAIL }));
    expect(result).toEqual({ error: "auth.verify.error.mailLimit" });
  });

  it("maps any other failure to the generic key", async () => {
    makeClient({ resendError: { status: 500, message: "smtp down" } });
    const result = await resendSignupCode(null, formDataOf({ email: EMAIL }));
    expect(result).toEqual({ error: "auth.verify.error.generic" });
  });

  it("asks for the email when it is missing", async () => {
    const { resend } = makeClient();
    const result = await resendSignupCode(null, formDataOf({ email: "" }));
    expect(result).toEqual({ error: "auth.verify.error.emailRequired" });
    expect(resend).not.toHaveBeenCalled();
  });
});
