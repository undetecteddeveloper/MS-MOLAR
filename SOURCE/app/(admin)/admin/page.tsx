// Admin — /admin (Security review 2026-08-03, Medium #7).
// Server Component: liệt kê đề BỊ BÁO CÁO + nút gỡ/khôi phục.
//
// Đây là "takedown tooling tối thiểu" mà review yêu cầu, không phải một trang
// quản trị đầy đủ: đủ để gỡ nội dung xấu trong vài giây mà không phải mở SQL
// Editor, và để lại vết ai gỡ (exam_moderation_log).
//
// Quyền: allowlist ADMIN_USER_IDS (lib/auth/admin.ts) — KHÔNG có role admin
// trong DB (ADR-0001). notFound() thay vì trang "cấm truy cập": người không
// phận sự không cần biết đường dẫn này tồn tại.

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasAdminsConfigured, isAdminUserId } from "@/lib/auth/admin";
import { getTranslate } from "@/lib/i18n/server";
import { listReportedExams } from "@/lib/supabase/service-role";
import { ModerationRow } from "./ModerationRow";
import { PageContainer } from "@/components/layout/PageContainer";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminUserId(user.id)) notFound();

  const t = await getTranslate();
  const exams = await listReportedExams();
  const pending = exams.filter((e) => e.status !== "removed");
  const removed = exams.filter((e) => e.status === "removed");

  return (
    <div className="bg-background min-h-dvh">
      <PageContainer as="main" size="default" className="flex flex-col gap-6">
        <h1 className="sr-only">{t("admin.title")}</h1>

        {!hasAdminsConfigured() && (
          <p className="border-border rounded-lg border border-dashed px-4 py-3 text-sm">
            {t("admin.notConfigured")}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-wide uppercase">
            {t("admin.awaitingReview")} ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("admin.nothingReported")}</p>
          ) : (
            pending.map((exam) => <ModerationRow key={exam.id} exam={exam} />)
          )}
        </section>

        {removed.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide uppercase">
              {t("admin.removed")} ({removed.length})
            </h2>
            {removed.map((exam) => (
              <ModerationRow key={exam.id} exam={exam} />
            ))}
          </section>
        )}
      </PageContainer>
    </div>
  );
}
