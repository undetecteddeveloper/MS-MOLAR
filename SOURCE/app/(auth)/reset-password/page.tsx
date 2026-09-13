// Reset Password — /reset-password (Layer 1, S#23). Server Component.
// Đích của link email reset: /auth/callback?next=/reset-password đã đổi code
// lấy RECOVERY SESSION rồi mới tới đây. Không có session (vào thẳng URL, link
// hết hạn) → middleware đã chặn từ ngoài; guard đây là lớp thứ hai.
//
// Theme "Sân trường" (2026-09-10): PageHeader chuẩn với câu dẫn nói rõ đang
// đổi mật khẩu cho tài khoản nào, form nằm trong thẻ surface như thẻ đăng nhập
// ở trang chủ. Bề rộng `small`: một tác vụ.
//
// 2026-09-13 (engineer, test điện thoại thật): khung của route group này KHÔNG
// còn thanh điều hướng — xem (auth)/layout.tsx; middleware ép phiên đang khôi
// phục về đúng trang này (lib/auth/recovery.ts). Câu dẫn nói thẳng điều đó, và
// có một lối thoát: "Không phải tài khoản của bạn? Đăng xuất" — gỡ cờ + gỡ
// phiên, không để ai mắc kẹt ở một màn không có nút ra.

import { redirect } from "next/navigation";
import { t } from "@/lib/copy";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { signOut } from "@/features/auth/actions";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader
        title={t("auth.setNewPassword")}
        description={`${t("auth.signedInAs")} ${user.email ?? ""}. ${t("auth.resetPasswordIntro")} ${t("auth.recoveryLocked")}`}
      />
      <ResetPasswordForm />

      {/* Lối thoát. <form> đứng riêng (không lồng trong <p>: HTML không cho
          phép), nút là chữ liên kết để không cạnh tranh với nút xanh "Đặt mật
          khẩu mới" ngay trên. */}
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
        <span>{t("auth.notYourAccount")}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-primary inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
          >
            {t("common.signOut")}
          </button>
        </form>
      </div>
    </PageContainer>
  );
}
