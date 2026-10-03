// Biên dịch `AuthState.error` / `AuthState.info` của các action auth thành câu
// tiếng Việt. Action trả KHOÁ bảng nhãn `auth.*` (lib/auth/authErrors.ts) hoặc
// một trong hai dạng dây đã có từ /profile: `profile.error.rateLimited:{giây}` và
// câu nguyên văn của validatePassword (signUp/updatePassword chuyển tiếp nó).
//
// Chuỗi không nhận ra → câu chung, KHÔNG BAO GIỜ hiện chuỗi thô (tiếng Anh giữa
// trang tiếng Việt, và là đường để câu chữ của provider rò ra client).

import { copy, t, type MessageKey, type TranslateValues } from "@/lib/copy";
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { PASSWORD_POLICY_KEYS } from "@/lib/auth/passwordPolicyKeys";

const RATE_LIMITED_PREFIX = "profile.error.rateLimited:";

/** Tham số cố định của khoá chính sách mật khẩu — quên là hiện nguyên `{min}`. */
const POLICY_VALUES: Partial<Record<MessageKey, TranslateValues>> = {
  "profile.password.errorTooShort": { min: PASSWORD_MIN_LENGTH },
  "profile.password.errorTooLong": { maxBytes: PASSWORD_MAX_BYTES },
};

/** `hasOwnProperty` chứ không phải `in`: `"toString" in copy` là true — chuỗi do
 *  server gửi xuống không được phép mượn prototype của object literal. */
const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export function authMessage(raw: string): string {
  if (raw.startsWith("auth.") && own(copy, raw)) return t(raw as MessageKey);

  if (raw.startsWith(RATE_LIMITED_PREFIX)) {
    return t("profile.error.rateLimited", { seconds: raw.slice(raw.lastIndexOf(":") + 1) });
  }

  if (own(PASSWORD_POLICY_KEYS, raw)) {
    const key = PASSWORD_POLICY_KEYS[raw];
    return t(key, POLICY_VALUES[key]);
  }

  return t("auth.error.generic");
}
