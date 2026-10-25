// /profile — changePassword & changeAvatar Server Actions [integration]
// Design Doc: docs/design/profile-and-about-design.md (§Backend contracts →
//   changeAvatar bước 1-7, changePassword bước 1-6; C1 client dùng-một-lần,
//   C12 cấm ghi log)
// ADR: docs/adr/ADR-0016-avatar-storage-visibility-and-read-path.md
// PRD: docs/prd/profile-and-about-prd.md (AC-017, AC-018, AC-021, AC-022,
//   AC-023, AC-024, AC-027..AC-031, AC-037)
//
// Client Supabase được mock, theo tiền lệ của hệ thống hỗ trợ
// (lib/support/__tests__/actions.int.test.ts). Ranh giới đó chứng minh được gì và không
// chứng minh được gì cần nói rõ, vì một trong các test này là điểm
// kiểm chứng sớm của tính năng:
//   - CHỨNG MINH ĐƯỢC: việc kiểm thông tin đăng nhập chạy trên client nào, việc đăng nhập của
//     client gắn cookie chưa từng bị đụng tới, thứ tự gọi, và không có giá trị mật khẩu nào
//     tới được logger.
//   - KHÔNG chứng minh được: cookie của người gọi còn sống sót. Đó là thuộc tính của
//     client @supabase/ssr thật và thuộc về một lượt kiểm tra trực tiếp. Bằng chứng mock
//     bên dưới là vật thay thế rẻ gần nhất: một cài đặt thoái lui về client
//     gắn cookie sẽ làm các test này hỏng ngay lập tức.
//   - KHÔNG chứng minh được: các policy RLS của storage. Chúng cần Postgres
//     thật (supabase/test-rls.ts, tiền lệ ST-a..ST-e).

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({
  guard: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/security/rateLimit";
import { AVATAR_LIMITS } from "@/lib/profile/limits";
import { changeAvatar, changePassword } from "@/features/auth/actions";

const createClientMock = vi.mocked(createClient);
const createSupabaseClientMock = vi.mocked(createSupabaseClient);
const guardMock = vi.mocked(guard);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const EMAIL = "student@example.com";
// Các chuỗi cố ý đặc trưng: khẳng định AC-024 grep mọi tham số console
// đã ghi lại để tìm chúng, nên một va chạm chuỗi con sẽ làm nó qua giả.
const CURRENT_PASSWORD = "Zx7-current-pw-fixture";
const NEW_PASSWORD = "Zx7-brand-new-pw-fixture";

function makeSessionClientMock(opts: {
  user?: { id: string; email?: string } | null;
  previousAvatar?: string | null;
  updateUserError?: { status?: number } | null;
  signOutError?: { status?: number } | null;
  uploadError?: { message: string } | null;
  profileUpdateError?: { message: string } | null;
} = {}) {
  const signInWithPassword = vi.fn(async () => ({ data: {}, error: null }));
  const updateUser = vi.fn(async () => ({ error: opts.updateUserError ?? null }));
  const signOut = vi.fn(async () => ({ error: opts.signOutError ?? null }));

  const profileUpdatePayloads: unknown[] = [];
  const profileUpdateEq = vi.fn(async () => ({ error: opts.profileUpdateError ?? null }));
  const profileUpdate = vi.fn((payload: unknown) => {
    profileUpdatePayloads.push(payload);
    return { eq: profileUpdateEq };
  });
  const profileSelectSingle = vi.fn(async () => ({
    data: { avatar_url: opts.previousAvatar ?? null },
    error: null,
  }));
  const profileSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: profileSelectSingle })) }));

  const upload = vi.fn(async () => ({ error: opts.uploadError ?? null }));
  const remove = vi.fn(async () => ({ error: null }));
  const storageFrom = vi.fn(() => ({ upload, remove }));

  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user:
            opts.user === undefined ? { id: USER_ID, email: EMAIL } : opts.user,
        },
      })),
      signInWithPassword,
      updateUser,
      signOut,
    },
    from: vi.fn((table: string) => {
      if (table === "user_profiles") return { select: profileSelect, update: profileUpdate };
      throw new Error(`bảng không mong đợi trong test: ${table}`);
    }),
    storage: { from: storageFrom },
  };

  return {
    client,
    signInWithPassword,
    updateUser,
    signOut,
    profileUpdate,
    profileUpdatePayloads,
    profileSelect,
    upload,
    remove,
    storageFrom,
  };
}

function makeProbeClientMock(opts: { signInError?: { message: string } | null } = {}) {
  const signInWithPassword = vi.fn(async () => ({
    data: {},
    error: opts.signInError ?? null,
  }));
  // `signOut` có mặt ở đây vì client dùng-một-lần PHẢI dọn được phiên nó vừa
  // mint: signInWithPassword tạo một refresh token thật phía Supabase kể cả khi
  // persistSession=false. Đường thành công dọn nó bằng signOut({scope:"others"})
  // trên client phiên thật; đường updateUser hỏng thoát sớm nên phải tự dọn.
  const signOut = vi.fn(async () => ({ error: null }));
  return { client: { auth: { signInWithPassword, signOut } }, signInWithPassword, signOut };
}

function formDataOf(fields: Record<string, string | File | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    fd.set(k, v);
  }
  return fd;
}

/** Một File có kích thước báo cáo là `bytes` mà không cấp phát chúng — ca biên 2MB+1
 *  nếu không sẽ tốn 2MB heap mỗi lần chạy vô ích. */
function fileOfSize(bytes: number, type: string): File {
  const file = new File(["x"], "avatar.jpg", { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

/** Mọi phương thức console, để một dòng debug thêm vào bất kỳ phương thức nào vẫn bị bắt. */
const CONSOLE_METHODS = ["error", "warn", "log", "info", "debug"] as const;
type ConsoleSpy = { mock: { calls: unknown[][] } };
let consoleSpies: ConsoleSpy[] = [];

function spyOnConsole(): ConsoleSpy[] {
  consoleSpies = CONSOLE_METHODS.map(
    (method) => vi.spyOn(console, method).mockImplementation(() => {}) as unknown as ConsoleSpy
  );
  return consoleSpies;
}

function allLoggedArguments(): string[] {
  return consoleSpies.flatMap((spy) =>
    spy.mock.calls.flatMap((call) =>
      call.map((arg) => {
        try {
          return typeof arg === "string" ? arg : (JSON.stringify(arg) ?? String(arg));
        } catch {
          return String(arg);
        }
      })
    )
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-fixture";
});

afterEach(() => {
  vi.restoreAllMocks();
  consoleSpies = [];
});

describe("changePassword — current-password verification never touches the caller's session (C1, AC-018/AC-022)", () => {
  it("a wrong current password returns the wrong-password key and never signs in on the cookie-bound client", async () => {
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock({ signInError: { message: "Invalid login credentials" } });
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(result).toEqual({ error: "profile.password.errorCurrentWrong" });
    // Bằng chứng giữ phiên ở mức một test mock có thể đưa ra: việc kiểm
    // thông tin đăng nhập chạy trên client dùng-một-lần, và client ghi cookie
    // chưa từng được yêu cầu thiết lập phiên.
    expect(probe.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(session.signInWithPassword).not.toHaveBeenCalled();
    expect(session.updateUser).not.toHaveBeenCalled();
    expect(session.signOut).not.toHaveBeenCalled();
  });

  it("builds the throwaway client with persistSession and autoRefreshToken both off", async () => {
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock({ signInError: { message: "Invalid login credentials" } });
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(createSupabaseClientMock).toHaveBeenCalledTimes(1);
    const [, , options] = createSupabaseClientMock.mock.calls[0];
    expect(options?.auth?.persistSession).toBe(false);
    expect(options?.auth?.autoRefreshToken).toBe(false);
  });

  it("a correct current password updates on the session client and revokes only other sessions (AC-021, AC-022)", async () => {
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(result).toBeNull();
    expect(session.updateUser).toHaveBeenCalledTimes(1);
    expect(session.updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(session.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(session.signInWithPassword).not.toHaveBeenCalled();
  });

  it("still reports success when signOut(others) fails — the password is already changed", async () => {
    spyOnConsole();
    const session = makeSessionClientMock({ signOutError: { status: 500 } });
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(result).toBeNull();
    expect(session.updateUser).toHaveBeenCalledTimes(1);
  });
});

describe("changePassword — refusals are distinguishable and carry no provider text (C12, AC-023)", () => {
  it("a rate-limited request returns a different key from a wrong password, and never reaches the credential check", async () => {
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    // Người dùng thực sự cần biết hai việc đã xảy ra việc nào; "thử lại"
    // là lời khuyên sai với một trong hai.
    expect(result?.error).not.toBe("profile.password.errorCurrentWrong");
    expect(result?.error).toContain("profile.error.rateLimited");
    expect(result?.error).toContain("42");
    expect(probe.signInWithPassword).not.toHaveBeenCalled();
    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it("guards before the credential check even when the current password is correct", async () => {
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 7 });
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(createSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("mismatched new passwords are refused before any network call (AC-019)", async () => {
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: `${NEW_PASSWORD}-typo`,
      })
    );

    expect(result).toEqual({ error: "profile.password.errorMismatch" });
    expect(probe.signInWithPassword).not.toHaveBeenCalled();
    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it("a rejected updateUser returns a fixed key, never the provider's sentence", async () => {
    spyOnConsole();
    const session = makeSessionClientMock({ updateUserError: { status: 422 } });
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(result).toEqual({ error: "profile.error.generic" });
    expect(session.signOut).not.toHaveBeenCalled();
    // Đường thoát sớm này vẫn phải dọn phiên mà `probe` vừa mint. Không dọn thì
    // mỗi lần updateUser hỏng là để lại một refresh token sống mà không ai cầm
    // (security review, hardening finding).
    expect(probe.signOut).toHaveBeenCalledTimes(1);
  });

  it("an expired session is refused before the guard and before any credential check", async () => {
    const session = makeSessionClientMock({ user: null });
    const probe = makeProbeClientMock();
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(result).toEqual({ error: "profile.error.sessionExpired" });
    expect(guardMock).not.toHaveBeenCalled();
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
  });
});

describe("changePassword — no password value ever reaches a logger (AC-024)", () => {
  it("logs nothing containing a password fixture on any branch, including the failing ones", async () => {
    const spies = spyOnConsole();

    // Mọi nhánh có thể ghi log, chạy trong một test để một dòng log mới ở bất kỳ
    // nhánh nào đều bị bắt: sai mật khẩu, updateUser bị từ chối, signOut thất bại,
    // và đường thành công.
    const branches: Array<() => Promise<unknown>> = [
      async () => {
        const session = makeSessionClientMock();
        const probe = makeProbeClientMock({ signInError: { message: "Invalid login credentials" } });
        createClientMock.mockResolvedValue(session.client as never);
        createSupabaseClientMock.mockReturnValue(probe.client as never);
        return changePassword(
          null,
          formDataOf({
            currentPassword: CURRENT_PASSWORD,
            password: NEW_PASSWORD,
            confirm: NEW_PASSWORD,
          })
        );
      },
      async () => {
        const session = makeSessionClientMock({ updateUserError: { status: 422 } });
        const probe = makeProbeClientMock();
        createClientMock.mockResolvedValue(session.client as never);
        createSupabaseClientMock.mockReturnValue(probe.client as never);
        return changePassword(
          null,
          formDataOf({
            currentPassword: CURRENT_PASSWORD,
            password: NEW_PASSWORD,
            confirm: NEW_PASSWORD,
          })
        );
      },
      async () => {
        const session = makeSessionClientMock({ signOutError: { status: 500 } });
        const probe = makeProbeClientMock();
        createClientMock.mockResolvedValue(session.client as never);
        createSupabaseClientMock.mockReturnValue(probe.client as never);
        return changePassword(
          null,
          formDataOf({
            currentPassword: CURRENT_PASSWORD,
            password: NEW_PASSWORD,
            confirm: NEW_PASSWORD,
          })
        );
      },
      async () => {
        const session = makeSessionClientMock();
        const probe = makeProbeClientMock();
        createClientMock.mockResolvedValue(session.client as never);
        createSupabaseClientMock.mockReturnValue(probe.client as never);
        return changePassword(
          null,
          formDataOf({
            currentPassword: CURRENT_PASSWORD,
            password: "short",
            confirm: "short",
          })
        );
      },
    ];

    for (const run of branches) await run();

    const logged = allLoggedArguments();
    for (const line of logged) {
      expect(line).not.toContain(CURRENT_PASSWORD);
      expect(line).not.toContain(NEW_PASSWORD);
    }
    // Khẳng định ở trên rỗng nghĩa nếu không có gì được ghi log, nên ghim
    // rằng các nhánh lỗi đã ghi log — test chứng minh "log an toàn", không
    // phải "tình cờ im lặng".
    expect(spies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
  });

  it("never returns a password value to the client either", async () => {
    const session = makeSessionClientMock();
    const probe = makeProbeClientMock({ signInError: { message: "Invalid login credentials" } });
    createClientMock.mockResolvedValue(session.client as never);
    createSupabaseClientMock.mockReturnValue(probe.client as never);

    const result = await changePassword(
      null,
      formDataOf({
        currentPassword: CURRENT_PASSWORD,
        password: NEW_PASSWORD,
        confirm: NEW_PASSWORD,
      })
    );

    expect(JSON.stringify(result)).not.toContain(CURRENT_PASSWORD);
    expect(JSON.stringify(result)).not.toContain(NEW_PASSWORD);
  });
});

describe("changeAvatar — rejection happens before Storage is touched (AC-028, AC-029, AC-030)", () => {
  it("refuses a disallowed MIME with no upload call", async () => {
    const session = makeSessionClientMock();
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/gif") })
    );

    expect(result).toEqual({ error: "profile.avatar.invalidType" });
    expect(session.upload).not.toHaveBeenCalled();
    expect(session.profileUpdate).not.toHaveBeenCalled();
  });

  it("refuses a file one byte over the limit with no upload call", async () => {
    const session = makeSessionClientMock();
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(AVATAR_LIMITS.MAX_BYTES + 1, "image/jpeg") })
    );

    expect(result).toEqual({ error: "profile.avatar.tooLarge" });
    expect(session.upload).not.toHaveBeenCalled();
    expect(session.profileUpdate).not.toHaveBeenCalled();
  });

  it("refuses a rate-limited request before the file is even read", async () => {
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 60 });
    const session = makeSessionClientMock();
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/png") })
    );

    expect(result?.error).toContain("profile.error.rateLimited");
    expect(session.upload).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated request before the guard", async () => {
    const session = makeSessionClientMock({ user: null });
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/png") })
    );

    expect(result).toEqual({ error: "profile.error.sessionExpired" });
    expect(guardMock).not.toHaveBeenCalled();
    expect(session.upload).not.toHaveBeenCalled();
  });
});

describe("changeAvatar — object key and replacement hygiene (AC-031, U3)", () => {
  it("accepts a file at exactly the limit, writes a uid-prefixed key, and persists that key", async () => {
    const session = makeSessionClientMock();
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(AVATAR_LIMITS.MAX_BYTES, "image/jpeg") })
    );

    expect(result).toBeNull();
    expect(session.storageFrom).toHaveBeenCalledWith("avatars");
    expect(session.upload).toHaveBeenCalledTimes(1);
    const [key, , options] = session.upload.mock.calls[0] as unknown as [
      string,
      File,
      { contentType: string },
    ];
    expect(key).toMatch(
      new RegExp(`^${USER_ID}/[0-9a-f-]{36}\\.jpg$`)
    );
    expect(options.contentType).toBe("image/jpeg");
    expect(session.profileUpdatePayloads).toEqual([{ avatar_url: key }]);
  });

  it("mints a fresh key on every upload rather than reusing a stable one", async () => {
    const first = makeSessionClientMock();
    createClientMock.mockResolvedValue(first.client as never);
    await changeAvatar(null, formDataOf({ avatar: fileOfSize(1024, "image/png") }));

    const second = makeSessionClientMock();
    createClientMock.mockResolvedValue(second.client as never);
    await changeAvatar(null, formDataOf({ avatar: fileOfSize(1024, "image/png") }));

    const firstKey = (first.upload.mock.calls[0] as unknown as [string])[0];
    const secondKey = (second.upload.mock.calls[0] as unknown as [string])[0];
    // Một khoá ổn định cộng URL ký 1 giờ sẽ tiếp tục phục vụ ảnh CŨ dưới một
    // chữ ký còn hiệu lực sau khi học sinh đã thay ảnh.
    expect(secondKey).not.toBe(firstKey);
  });

  it("deletes the previous object after the new key is persisted", async () => {
    const previous = `${USER_ID}/old-object.png`;
    const session = makeSessionClientMock({ previousAvatar: previous });
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/webp") })
    );

    expect(result).toBeNull();
    expect(session.remove).toHaveBeenCalledTimes(1);
    expect(session.remove).toHaveBeenCalledWith([previous]);
  });

  it("a failed cleanup of the previous object never fails the request", async () => {
    spyOnConsole();
    const session = makeSessionClientMock({ previousAvatar: `${USER_ID}/old-object.png` });
    session.remove.mockResolvedValue({ error: { message: "storage unreachable" } } as never);
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/webp") })
    );

    expect(result).toBeNull();
  });

  it("a failed profile write cleans up the object it just orphaned and refuses", async () => {
    spyOnConsole();
    const session = makeSessionClientMock({ profileUpdateError: { message: "row level security" } });
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/png") })
    );

    expect(result).toEqual({ error: "profile.avatar.uploadFailed" });
    const uploadedKey = (session.upload.mock.calls[0] as unknown as [string])[0];
    expect(session.remove).toHaveBeenCalledWith([uploadedKey]);
  });

  it("a failed upload refuses without writing to user_profiles", async () => {
    spyOnConsole();
    const session = makeSessionClientMock({ uploadError: { message: "storage unreachable" } });
    createClientMock.mockResolvedValue(session.client as never);

    const result = await changeAvatar(
      null,
      formDataOf({ avatar: fileOfSize(1024, "image/png") })
    );

    expect(result).toEqual({ error: "profile.avatar.uploadFailed" });
    expect(session.profileUpdate).not.toHaveBeenCalled();
  });
});
