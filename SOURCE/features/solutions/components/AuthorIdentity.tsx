// AuthorIdentity (C-07) — bề mặt render DUY NHẤT cho kiểu AuthorIdentity, dùng
// bởi SolutionCard (task 17), SolutionAuthorCard (task 19) và CommentItem
// (task tấm trượt bình luận). UI Spec § Component: AuthorIdentity; frontend DD
// § Main Components "features/solutions/components/AuthorIdentity.tsx".
//
// Bất biến CHỦ Ý bằng kiểu, không phải bằng kỷ luật viết code: switch trên
// `identity.kind` khiến không có nhánh nào ĐỌC ĐƯỢC trường tên/ảnh của một
// danh tính `anonymous` — nhánh đó không có trường nào để đọc (lỗi biên dịch
// nếu ai đó thử), không phải một điều kiện có thể quên kiểm (AC-039, AC-105).
//
// `isSolutionAuthor` (huy hiệu "Người viết", S4/AC-068) nằm trong interface đã
// chốt (frontend DD § Main Components) để các tác vụ sau (tấm trượt bình
// luận) không phải đổi chữ ký hàm; task này (17) chỉ dựng hai nhánh
// named/anonymous mà SolutionCard cần — nhãn "Người viết" chưa có khoá
// copy.ts nào (thuộc phạm vi tấm trượt bình luận), nên chưa render ở đây.

import { Avatar } from "@/components/shared/Avatar";
import { AnonymousAvatar } from "@/components/shared/AnonymousAvatar";
import { t } from "@/lib/copy";
import type { AuthorIdentity as AuthorIdentityUnion } from "@/lib/solutions/identity";

export interface AuthorIdentityProps {
  identity: AuthorIdentityUnion;
  /** 32px ở thẻ danh sách/thẻ đầu màn xem, 28px ở hàng bình luận. */
  size: 28 | 32;
  /** Huy hiệu "Người viết" (S4, AC-068) — chưa dùng ở task 17, xem ghi chú đầu file. */
  isSolutionAuthor?: boolean;
}

export function AuthorIdentity({ identity, size }: AuthorIdentityProps) {
  if (identity.kind === "anonymous") {
    return (
      <span className="inline-flex items-center gap-2">
        <AnonymousAvatar size={size} />
        <span className="text-muted-foreground font-semibold">{t("solutions.identity.anonymous")}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Avatar src={identity.avatarUrl ?? null} name={identity.displayName} size={size} className="bg-card" />
      <span className="font-semibold">{identity.displayName}</span>
    </span>
  );
}
