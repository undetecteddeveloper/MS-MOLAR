// LoginRequired — nội dung chính của một trang con mà khách chưa đăng nhập được
// VÀO xem nhưng chưa DÙNG được (Thống kê, Lịch sử, Tải đề lên — brief
// docs/plans/20261012-feature-guest-browse-subpages.md T3). Server Component.
//
// Cùng khuôn với thẻ rỗng của Lịch sử (HistoryList): thẻ viền nét đứt căn
// giữa, tiêu đề, một câu nói đăng nhập để làm gì, nút xanh. Không phải một bố
// cục mới — nên nó "đọc" như một trạng thái rỗng, đúng với việc khách chưa có
// dữ liệu nào ở đây.
//
// Hai nút: Đăng nhập (chính) và Đăng ký (phụ), cả hai mang `next` về đúng
// trang này (`authHref` bỏ `next` không hợp lệ thay vì dựng liên kết hỏng).
// `prefetch={false}`: đích là trang chủ có cảnh 3D — không ai yêu cầu nó.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authHref } from "@/lib/auth/guestPaths";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function LoginRequired({
  title,
  body,
  nextPath,
  className,
}: {
  title: string;
  body: string;
  /** Trang hiện tại — nơi người dùng quay về sau khi đăng nhập. */
  nextPath: string;
  className?: string;
}) {
  return (
    <Card
      as="section"
      variant="outline"
      aria-label={title}
      data-testid="login-required"
      className={cn("items-center gap-1 border-dashed px-6 py-12 text-center", className)}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">{body}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Link href={authHref("signin", nextPath)} prefetch={false} className={buttonVariants()}>
          {t("auth.signIn")}
        </Link>
        <Link
          href={authHref("signup", nextPath)}
          prefetch={false}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("auth.signUp")}
        </Link>
      </div>
    </Card>
  );
}
