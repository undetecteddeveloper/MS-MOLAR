// /profile — biên dịch "lỗi mà Server Action trả về" thành "khoá i18n + tham
// số" (UI-D9, UI-D10). Toàn bộ chỗ nối tạm bợ giữa server và giao diện nằm gọn
// ở ĐÂY, không rải trong JSX của bốn component.
//
// Ba dạng dây khác nhau chạy qua đúng một trường `AuthState.error`:
//
//   1. KHOÁ i18n           — changePassword/changeAvatar cố ý trả khoá, vì trên
//                            đường mật khẩu thì câu chữ của Supabase là một
//                            oracle (xem khối chú thích ở actions.ts:199-220).
//   2. KHOÁ:THAM SỐ        — "profile.error.rateLimited:{seconds}". AuthState
//                            chỉ có một string, nên số giây đi kèm sau dấu ":".
//   3. CÂU TIẾNG ANH       — validatePassword (cố ý, UI-D10) và updateProfile
//                            (sẵn có, bị PRD AC-046 khoá ở dạng dùng-lại).
//
// Dạng 3 được so khớp NGUYÊN VĂN, và sự mong manh đó được chuyển thành một cổng
// build: app/(layer3)/profile/__tests__/errorMessages.test.ts gọi CHÍNH hai hàm
// nguồn rồi đòi mỗi câu chúng sinh ra phải có mục trong bản đồ dưới đây.
//
// Mặc định của MỌI nhánh không khớp là `profile.error.generic` — không bao giờ
// là chuỗi thô. Chuỗi thô lọt ra màn hình vừa là tiếng Anh giữa trang tiếng
// Việt, vừa là đường để câu chữ của nhà cung cấp rò ra client.

import { en } from "@/lib/i18n/dictionaries/en";
import type { MessageKey, TranslateValues } from "@/lib/i18n/translate";
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { DISPLAY_NAME_MAX } from "@/lib/profile/displayName";
import { AVATAR_LIMITS } from "@/lib/profile/limits";

export type ProfileMessage = { key: MessageKey; values?: TranslateValues };

const GENERIC: MessageKey = "profile.error.generic";
const RATE_LIMITED: MessageKey = "profile.error.rateLimited";

/** Tham số cố định của từng khoá. Gom về một chỗ để không component nào phải
 *  nhớ rằng "khoá này cần {maxMb}" — quên là hiện nguyên dấu ngoặc ra màn hình
 *  (createTranslate cố ý giữ nguyên `{name}` thay vì nuốt mất chữ). */
const STATIC_VALUES: Partial<Record<MessageKey, TranslateValues>> = {
  "profile.password.hint": { min: PASSWORD_MIN_LENGTH },
  "profile.password.errorTooShort": { min: PASSWORD_MIN_LENGTH },
  "profile.password.errorTooLong": { maxBytes: PASSWORD_MAX_BYTES },
  "profile.name.errorTooLong": { max: DISPLAY_NAME_MAX },
  "profile.avatar.hint": { maxMb: AVATAR_LIMITS.MAX_BYTES / (1024 * 1024) },
  "profile.avatar.tooLarge": { maxMb: AVATAR_LIMITS.MAX_BYTES / (1024 * 1024) },
};

/** Khoá + tham số cố định của nó, trong một bước. */
export function profileMessage(key: MessageKey, extra?: TranslateValues): ProfileMessage {
  const values = { ...STATIC_VALUES[key], ...extra };
  return Object.keys(values).length > 0 ? { key, values } : { key };
}

/**
 * BỐN câu của validatePassword → bốn khoá (UI-D10).
 *
 * Hai mục đầu dựng từ chính hằng số mà hàm nguồn dùng, nên đổi con số ở
 * passwordPolicy.ts là hai bên đổi cùng lúc. Đổi CÂU CHỮ thì không — đó là việc
 * của cổng build trong __tests__/errorMessages.test.ts.
 */
export const PASSWORD_POLICY_KEYS: Record<string, MessageKey> = {
  [`Password must be at least ${PASSWORD_MIN_LENGTH} characters`]:
    "profile.password.errorTooShort",
  [`Password is too long (max ${PASSWORD_MAX_BYTES} bytes; accented characters count as more than one)`]:
    "profile.password.errorTooLong",
  "Password cannot be only spaces": "profile.password.errorOnlySpaces",
  "This password is too common — please choose a different one":
    "profile.password.errorTooCommon",
};

/** NĂM câu của updateProfile (app/(layer1)/actions.ts:167-195) → khoá. Câu thứ
 *  năm (rate limit) mang một con số nên đi bằng regex, ngay bên dưới. */
const DISPLAY_NAME_KEYS: Record<string, MessageKey> = {
  "Display name must not be empty": "profile.name.errorEmpty",
  [`Display name must be ${DISPLAY_NAME_MAX} characters or fewer`]: "profile.name.errorTooLong",
  "Display name may only contain letters and dots": "profile.name.errorCharset",
  "Your session has expired": "profile.error.sessionExpired",
};

const UPDATE_PROFILE_RATE_LIMIT_RE = /^Too many updates\. Try again in (\d+) seconds\.$/;

/**
 * Chuỗi có phải một khoá i18n của vùng `profile.` không?
 *
 * `hasOwnProperty` chứ không phải `in`: `"toString" in en` là TRUE, nên toán tử
 * `in` sẽ nhận nhầm vài chuỗi rác thành khoá hợp lệ rồi đẩy chúng vào t().
 * Ràng thêm tiền tố `profile.` để một action trả nhầm khoá của vùng khác không
 * thể mượn được chuỗi của vùng đó.
 */
function isProfileMessageKey(raw: string): raw is MessageKey {
  return raw.startsWith("profile.") && Object.prototype.hasOwnProperty.call(en, raw);
}

/**
 * Tra bản đồ literal bằng khoá SỞ HỮU RIÊNG.
 *
 * `map[raw]` trần là một cái bẫy thật, không phải phòng xa: object literal kế
 * thừa Object.prototype, nên `PASSWORD_POLICY_KEYS["toString"]` trả về HÀM
 * toString — một giá trị "thật" (truthy), lọt qua mọi `if (key)` và được đưa
 * thẳng vào t() làm khoá. Đầu vào ở đây là chuỗi do server gửi xuống, tức đúng
 * loại dữ liệu không nên tin.
 */
function lookupLiteral(
  map: Record<string, MessageKey>,
  raw: string
): MessageKey | undefined {
  return Object.prototype.hasOwnProperty.call(map, raw) ? map[raw] : undefined;
}

/**
 * Lỗi từ `changePassword` / `changeAvatar` → thông điệp hiển thị được.
 * Dùng cho MỌI action trả khoá; câu tiếng Anh của validatePassword đi qua đây
 * vì changePassword chuyển tiếp nó nguyên văn (UI-D10).
 */
export function resolveActionError(raw: string): ProfileMessage {
  if (raw.startsWith(`${RATE_LIMITED}:`)) {
    // Tách ở dấu ":" CUỐI CÙNG: phần khoá đứng trước là hằng số của ta, nhưng
    // cắt ở dấu đầu tiên sẽ hỏng ngay khi khoá nào đó có dấu hai chấm bên trong.
    return profileMessage(RATE_LIMITED, { seconds: raw.slice(raw.lastIndexOf(":") + 1) });
  }

  const policyKey = lookupLiteral(PASSWORD_POLICY_KEYS, raw);
  if (policyKey) return profileMessage(policyKey);

  if (isProfileMessageKey(raw)) return profileMessage(raw);

  return profileMessage(GENERIC);
}

/** Lỗi từ `updateProfile` — action DÙNG LẠI, câu chữ tiếng Anh viết cứng (UI-D9). */
export function resolveDisplayNameError(raw: string): ProfileMessage {
  const rateLimited = UPDATE_PROFILE_RATE_LIMIT_RE.exec(raw);
  if (rateLimited) return profileMessage(RATE_LIMITED, { seconds: rateLimited[1] });

  const key = lookupLiteral(DISPLAY_NAME_KEYS, raw);
  if (key) return profileMessage(key);

  // Nhánh cuối của updateProfile trả `error.message` của Supabase nguyên văn.
  // Nó không bao giờ được lên màn hình.
  return profileMessage(GENERIC);
}
