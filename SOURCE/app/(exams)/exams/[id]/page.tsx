// Exam Detail — /exams/[id] (Layer 2).
// Server Component: xem thông tin đề trước khi bắt đầu (GĐ 2 M2.5, thay fake-data).
// GĐ 3 M3.2: visual language L2 "tờ giấy trắng" — SiteHeader + back link + eyebrow
// môn/lớp + tiêu đề serif + ô meta (số câu/thời gian) + nút brand. Mobile-first.
// Feedback: bỏ eyebrow môn/lớp + dòng hướng dẫn; back link "Trang trước"; căn giữa toàn bộ.

import { notFound } from "next/navigation";
import { getExam } from "@/features/exams/queries";
import { hasReported } from "@/features/authoring/queries";
import { StartAttemptButton } from "@/features/exams/components/StartAttemptButton";
import { ReportExam } from "@/features/exams/components/ReportExam";
import { AuthorByline } from "@/components/shared/AuthorByline";
import { DifficultyBadge } from "@/components/rating/DifficultyBadge";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BentoGrid, BentoCell } from "@/components/layout/BentoGrid";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslate();
  const { id } = await params;
  const exam = await getExam(id);

  if (!exam) {
    notFound();
  }

  // Report channel chỉ cho user đã đăng nhập (AC-025). Đề UGC mới có byline.
  const user = await getCurrentUser();
  const alreadyReported = user ? await hasReported(id) : false;

  return (
    <div className="bg-background">
      <PageContainer as="main" size="small" className="flex flex-col">
        {/* Breadcrumbs thay link "← Back" trần (quy tắc Supabase Studio: dải
            định vị luôn nằm trên cùng). Khác biệt thực chất, không chỉ hình
            thức: "← Back" chỉ nói ĐI ĐÂU chứ không nói ĐANG Ở ĐÂU, và người
            vào thẳng từ link chia sẻ thì không có "trang trước" nào cả. */}
        <Breadcrumbs
          items={[{ label: t("nav.exams"), href: "/exams" }, { label: exam.title }]}
          className="preload-fade self-start text-xs"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        />

        {/* preload order 2 — khối tổng quan fade sau navbar + back link (S#21). */}
        <div
          className="preload-fade mt-6 flex flex-col items-center text-center"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          <h1 className="text-3xl leading-tight sm:text-4xl">{exam.title}</h1>

          {/* Byline UGC (Task 5.2) — dưới tiêu đề, chỉ hiện với đề có tác giả. */}
          <AuthorByline name={exam.authorDisplayName} className="mt-2" />

          {/* Lưới Bento (docs/market/UI-Design-Research.md §2). Trước đây là 6 ô
              đều nhau 2×3 với chuỗi class `border-border bg-card rounded-lg
              border p-5` chép tay 6 lần; nay là BentoCell, và bề rộng mỗi ô
              chạy theo NỘI DUNG chứ không chia đều máy móc:
                hàng 1  số câu (3) · thời lượng (3) · độ khó (6)
                hàng 2  trường (6) · năm (3) · học kỳ (3)
              School và Difficulty lấy nửa hàng vì chúng chứa chuỗi/chỉ báo dài,
              còn các ô số thì một con số ngắn không cần chỗ rộng.
              Thứ tự JSX = thứ tự đọc = thứ tự nhìn thấy (không dùng order-*). */}
          <BentoGrid as="dl" className="mt-8 w-full">
              <BentoCell span="quarter">
                <dt className="eyebrow">{t("common.questions")}</dt>
                <dd className="text-foreground mt-2 font-serif text-2xl tabular-nums">
                  {exam.questionIds.length}
                </dd>
              </BentoCell>
              <BentoCell span="quarter">
                <dt className="eyebrow">{t("exams.duration")}</dt>
                <dd className="text-foreground mt-2 font-serif text-2xl tabular-nums">
                  {exam.durationMinutes}{" "}
                  <span className="text-muted-foreground text-base">{t("exams.minutesShort")}</span>
                </dd>
              </BentoCell>
              <BentoCell span="half">
                <dt className="eyebrow">{t("exams.difficulty")}</dt>
                <DifficultyBadge communityDifficulty={exam.communityDifficulty} variant="detail" />
              </BentoCell>
              <BentoCell span="half">
                <dt className="eyebrow">{t("common.school")}</dt>
                <dd
                  className={`mt-2 font-serif text-lg leading-snug ${
                    exam.school ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {exam.school ?? t("common.none")}
                </dd>
              </BentoCell>
              <BentoCell span="quarter">
                <dt className="eyebrow">{t("common.year")}</dt>
                <dd
                  className={`mt-2 font-serif text-2xl tabular-nums ${
                    exam.schoolYear !== undefined ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {exam.schoolYear ?? t("common.none")}
                </dd>
              </BentoCell>
              <BentoCell span="quarter">
                <dt className="eyebrow">{t("common.semester")}</dt>
                <dd
                  className={`mt-2 font-serif text-2xl ${
                    exam.semester ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {exam.semester ?? t("common.none")}
                </dd>
              </BentoCell>
          </BentoGrid>

          <div className="mt-8">
            <StartAttemptButton examId={exam.id} />
          </div>

          {/* Report channel (Task 5.2) — chỉ user đã đăng nhập. */}
          {user && (
            <div className="mt-6">
              <ReportExam examId={exam.id} initiallyReported={alreadyReported} />
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
