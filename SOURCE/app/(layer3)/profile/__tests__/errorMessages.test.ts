// CỔNG BUILD của hai bản đồ đối chiếu-literal mà /profile phải mang (UI-D9,
// UI-D10). Đây không phải test "hàm chạy đúng không" — nó là cái chốt duy nhất
// giữ cho hai bản đồ đó không trôi khỏi nguồn của chúng.
//
// Vì sao cần: hai Server Action mà /profile gọi trả về câu TIẾNG ANH VIẾT
// CỨNG chứ không phải khoá i18n —
//   - `validatePassword` (lib/auth/passwordPolicy.ts): cố ý, theo UI-D10, để
//     không tồn tại hai bản chính sách mật khẩu;
//   - `updateProfile` (features/auth/actions.ts): sẵn có, và PRD khoá nó ở dạng
//     "dùng lại, không viết lại" (AC-046).
// Client dịch chúng bằng cách so khớp NGUYÊN VĂN. Sửa một câu ở nguồn mà quên
// bản đồ thì không có lỗi nào nổ ra: mọi người dùng Việt lặng lẽ tụt xuống câu
// chung "Có lỗi xảy ra". Test này biến kiểu hỏng đó thành FAIL BUILD.
//
// Nên các case dưới đây GỌI THẬT hàm nguồn thay vì chép lại chuỗi vào fixture —
// chép chuỗi vào fixture là dựng lại đúng bản sao mà file này sinh ra để chặn.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({
  guard: vi.fn(async () => ({ ok: true, retryAfterSeconds: 0 })),
}));

import { updateProfile } from "@/features/auth/actions";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/auth/passwordPolicy";
import { DISPLAY_NAME_MAX } from "@/lib/profile/displayName";
import {
  PASSWORD_POLICY_KEYS,
  resolveActionError,
  resolveDisplayNameError,
} from "../_components/errorMessages";

/** Bốn đầu vào, mỗi cái kích đúng một nhánh của validatePassword. */
const POLICY_SAMPLES = {
  tooShort: "short",
  tooLong: "a".repeat(200),
  onlySpaces: " ".repeat(12),
  tooCommon: "password123",
} as const;

async function updateProfileError(displayName: string): Promise<string> {
  const fd = new FormData();
  fd.set("displayName", displayName);
  const state = await updateProfile(null, fd);
  const error = state?.error;
  if (!error) throw new Error(`updateProfile đã CHẤP NHẬN "${displayName}" — nhánh lỗi biến mất`);
  return error;
}

describe("cổng build: bốn câu của validatePassword (UI-D10)", () => {
  it("mỗi nhánh của validatePassword đều có mục trong bản đồ", () => {
    for (const [branch, password] of Object.entries(POLICY_SAMPLES)) {
      const sentence = validatePassword(password);
      expect(sentence, `nhánh ${branch} không còn trả lỗi`).not.toBeNull();
      expect(
        Object.keys(PASSWORD_POLICY_KEYS),
        `câu của nhánh ${branch} đã đổi ở lib/auth/passwordPolicy.ts — cập nhật PASSWORD_POLICY_KEYS`
      ).toContain(sentence as string);
    }
  });

  it("bản đồ không thừa mục nào — mỗi khoá phải là câu mà hàm thật sinh ra", () => {
    const produced = Object.values(POLICY_SAMPLES).map((p) => validatePassword(p));
    expect(Object.keys(PASSWORD_POLICY_KEYS).sort()).toEqual((produced as string[]).sort());
  });

  it("mật khẩu hợp lệ vẫn qua — bản đồ không nuốt nhánh thành công", () => {
    expect(validatePassword("mot-cum-tu-du-dai-2026")).toBeNull();
  });

  it("resolveActionError dịch câu chính sách sang khoá riêng, kèm tham số", () => {
    const short = resolveActionError(validatePassword(POLICY_SAMPLES.tooShort) as string);
    expect(short.key).toBe("profile.password.errorTooShort");
    // Suy từ hằng số, KHÔNG viết số cứng: bản cũ ghi thẳng 10 nên khi chính
    // sách đổi, test này fail vì một lý do chẳng liên quan gì tới thứ nó đang
    // kiểm (rằng tham số ĐƯỢC TRUYỀN, không phải giá trị cụ thể là bao nhiêu).
    expect(short.values?.min).toBe(PASSWORD_MIN_LENGTH);

    const long = resolveActionError(validatePassword(POLICY_SAMPLES.tooLong) as string);
    expect(long.key).toBe("profile.password.errorTooLong");
    expect(long.values?.maxBytes).toBe(PASSWORD_MAX_BYTES);

    expect(resolveActionError(validatePassword(POLICY_SAMPLES.onlySpaces) as string).key).toBe(
      "profile.password.errorOnlySpaces"
    );
    expect(resolveActionError(validatePassword(POLICY_SAMPLES.tooCommon) as string).key).toBe(
      "profile.password.errorTooCommon"
    );
  });
});

describe("cổng build: năm câu của updateProfile (UI-D9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tên rỗng → khoá riêng, KHÔNG phải câu chung", async () => {
    const resolved = resolveDisplayNameError(await updateProfileError("   "));
    expect(resolved.key).toBe("profile.name.errorEmpty");
  });

  it("tên quá dài → khoá riêng, mang theo trần độ dài thật", async () => {
    const resolved = resolveDisplayNameError(await updateProfileError("a".repeat(DISPLAY_NAME_MAX + 1)));
    expect(resolved.key).toBe("profile.name.errorTooLong");
    expect(resolved.values?.max).toBe(DISPLAY_NAME_MAX);
  });

  it("ký tự ngoài bộ cho phép → khoá riêng", async () => {
    const resolved = resolveDisplayNameError(await updateProfileError("an_nguyen"));
    expect(resolved.key).toBe("profile.name.errorCharset");
  });

  it("tên tiếng Việt có dấu KHÔNG bị từ chối (AC-045)", async () => {
    const fd = new FormData();
    fd.set("displayName", "Nguyễn");
    // Vượt qua ba nhánh kiểm cú pháp là đi tới createClient() — vốn được mock
    // trả undefined, nên hàm ném. Cái ta khẳng định là nó KHÔNG dừng ở một câu
    // lỗi cú pháp.
    await expect(updateProfile(null, fd)).rejects.toThrow();
  });

  it("câu rate-limit của updateProfile được đọc bằng regex, giữ số giây", () => {
    const resolved = resolveDisplayNameError("Too many updates. Try again in 42 seconds.");
    expect(resolved.key).toBe("profile.error.rateLimited");
    expect(resolved.values?.seconds).toBe("42");
  });

  it("câu lạ (error.message của Supabase) → câu chung, không hiện nguyên văn", () => {
    expect(resolveDisplayNameError("duplicate key value violates unique constraint").key).toBe(
      "profile.error.generic"
    );
  });
});

describe("resolveActionError — dây khoá của changePassword / changeAvatar", () => {
  it("khoá i18n thẳng đi qua nguyên vẹn", () => {
    expect(resolveActionError("profile.password.errorCurrentWrong").key).toBe(
      "profile.password.errorCurrentWrong"
    );
  });

  it("rate limit tách ở dấu `:` CUỐI CÙNG và truyền {seconds}", () => {
    const resolved = resolveActionError("profile.error.rateLimited:900");
    expect(resolved.key).toBe("profile.error.rateLimited");
    expect(resolved.values?.seconds).toBe("900");
  });

  it("khoá ảnh quá nặng tự mang theo {maxMb} — câu lỗi phải NÊU giới hạn (AC-029)", () => {
    const resolved = resolveActionError("profile.avatar.tooLarge");
    expect(resolved.key).toBe("profile.avatar.tooLarge");
    expect(resolved.values?.maxMb).toBe(2);
  });

  it("chuỗi không thuộc vùng `profile.` không bao giờ được dùng làm khoá", () => {
    // Một action trả nhầm "common.cancel" không được phép biến thành nhãn Huỷ.
    expect(resolveActionError("common.cancel").key).toBe("profile.error.generic");
    expect(resolveActionError("toString").key).toBe("profile.error.generic");
    expect(resolveActionError("").key).toBe("profile.error.generic");
  });
});
