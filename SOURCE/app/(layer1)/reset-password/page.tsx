// Reset Password — /reset-password (Layer 1, S#23). Server Component.
// Đích của link email reset: /auth/callback?next=/reset-password đã đổi code
// lấy RECOVERY SESSION rồi mới tới đây. Không có session (vào thẳng URL, link
// hết hạn) → middleware đã chặn từ ngoài; guard đây là lớp thứ hai.

import { redirect } from "next/navigation";
import { getTranslate } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ResetPasswordForm } from "@/app/(layer1)/_components/ResetPasswordForm";

export default async function ResetPasswordPage() {
  const t = await getTranslate();
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#EDE1C8] px-6">
      <main className="preload-fade w-full max-w-md rounded-lg border border-[#D8C9A8] bg-[#EDE1C8] p-8">
        <h1 className="font-serif text-2xl tracking-wide text-[#1B1512]">
          {t("auth.setNewPassword")}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          {t("auth.signedInAs")} <span className="font-medium">{user.email}</span>. Enter a new
          password for your account.
        </p>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </main>
    </div>
  );
}
