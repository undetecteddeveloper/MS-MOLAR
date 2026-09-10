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
//
// Theme "Sân trường" (2026-09-10): khung do (admin)/layout.tsx cấp. PageHeader
// chuẩn + câu dẫn nói gỡ một đề nghĩa là gì (khoá `admin.intro` có sẵn), hai
// mục "Chờ xử lý" / "Đã gỡ" với huy hiệu đếm thay tiêu đề in hoa giãn chữ.
// Trạng thái rỗng là thẻ nét đứt căn giữa, cùng lối với Lịch sử.

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasAdminsConfigured, isAdminUserId } from "@/lib/auth/admin";
import { t } from "@/lib/copy";
import { listReportedExams } from "@/lib/supabase/service-role";
import type { ModeratableExam } from "@/lib/supabase/service-role";
import { ModerationRow } from "@/features/admin/components/ModerationRow";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminUserId(user.id)) notFound();

  const exams = await listReportedExams();
  const pending = exams.filter((e) => e.status !== "removed");
  const removed = exams.filter((e) => e.status === "removed");

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader
        title={t("admin.title")}
        description={t("admin.intro", { email: user.email ?? "" })}
      />

      {!hasAdminsConfigured() && (
        <Card variant="outline" padding="compact" className="border-dashed">
          <p className="text-muted-foreground text-sm leading-relaxed">{t("admin.notConfigured")}</p>
        </Card>
      )}

      <ModerationSection title={t("admin.awaitingReview")} exams={pending}>
        <Card variant="outline" className="items-center border-dashed py-8 text-center">
          <p className="text-muted-foreground text-sm">{t("admin.nothingReported")}</p>
        </Card>
      </ModerationSection>

      {removed.length > 0 && <ModerationSection title={t("admin.removed")} exams={removed} />}
    </PageContainer>
  );
}

/** Một mục của trang: tiêu đề 18px chữ thường + huy hiệu đếm, rồi danh sách
 *  thẻ. `children` là trạng thái rỗng — chỉ mục "Chờ xử lý" có, mục "Đã gỡ"
 *  không render khi rỗng nên không cần. */
function ModerationSection({
  title,
  exams,
  children,
}: {
  title: string;
  exams: ModeratableExam[];
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        <Badge variant="surface" className="tabular-nums">
          {exams.length}
        </Badge>
      </h2>
      {exams.length === 0 ? (
        children
      ) : (
        <ul className="flex flex-col gap-3">
          {exams.map((exam) => (
            <ModerationRow key={exam.id} exam={exam} />
          ))}
        </ul>
      )}
    </section>
  );
}
