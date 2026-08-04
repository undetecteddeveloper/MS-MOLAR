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
import { listReportedExams } from "@/lib/supabase/service-role";
import { ModerationRow } from "./ModerationRow";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminUserId(user.id)) notFound();

  const exams = await listReportedExams();
  const pending = exams.filter((e) => e.status !== "removed");
  const removed = exams.filter((e) => e.status === "removed");

  return (
    <div className="bg-background min-h-dvh">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="font-serif text-2xl tracking-wide">Reported content</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.email}. Removing an exam pulls it from the catalog
            immediately and stops new attempts; the author cannot undo it.
          </p>
        </header>

        {!hasAdminsConfigured() && (
          <p className="border-border rounded-lg border border-dashed px-4 py-3 text-sm">
            ADMIN_USER_IDS is not configured — no one can act here.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium tracking-wide uppercase">
            Awaiting review ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing reported. </p>
          ) : (
            pending.map((exam) => <ModerationRow key={exam.id} exam={exam} />)
          )}
        </section>

        {removed.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide uppercase">
              Removed ({removed.length})
            </h2>
            {removed.map((exam) => (
              <ModerationRow key={exam.id} exam={exam} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
