// Reset Password — /reset-password (Layer 1, S#23). Server Component.
// Đích của link email reset: /auth/callback?next=/reset-password đã đổi code
// lấy RECOVERY SESSION rồi mới tới đây. Không có session (vào thẳng URL, link
// hết hạn) → middleware đã chặn từ ngoài; guard đây là lớp thứ hai.
//
// Theme "Sân trường" (2026-09-10): khung do (auth)/layout.tsx cấp; PageHeader
// chuẩn với câu dẫn nói rõ đang đổi mật khẩu cho tài khoản nào, form nằm trong
// thẻ surface như thẻ đăng nhập ở trang chủ. Bề rộng `small`: một tác vụ.

import { redirect } from "next/navigation";
import { t } from "@/lib/copy";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
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
        description={`${t("auth.signedInAs")} ${user.email ?? ""}. ${t("auth.resetPasswordIntro")}`}
      />
      <ResetPasswordForm />
    </PageContainer>
  );
}
