// BỐN câu của validatePassword → bốn khoá bảng nhãn (UI-D10). Nằm ở lib/ vì hai
// tính năng cùng cần: /profile (changePassword chuyển tiếp câu nguyên văn) và thẻ
// đăng ký/đặt lại mật khẩu của features/auth. Hai mục đầu dựng từ chính hằng số
// mà hàm nguồn dùng, nên đổi con số ở passwordPolicy.ts là hai bên đổi cùng lúc;
// đổi CÂU CHỮ thì cổng build ở features/profile/__tests__/errorMessages.test.ts đỏ.

import type { MessageKey } from "@/lib/copy";
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";

export const PASSWORD_POLICY_KEYS: Record<string, MessageKey> = {
  [`Password must be at least ${PASSWORD_MIN_LENGTH} characters`]:
    "profile.password.errorTooShort",
  [`Password is too long (max ${PASSWORD_MAX_BYTES} bytes; accented characters count as more than one)`]:
    "profile.password.errorTooLong",
  "Password cannot be only spaces": "profile.password.errorOnlySpaces",
  "This password is too common — please choose a different one":
    "profile.password.errorTooCommon",
};
