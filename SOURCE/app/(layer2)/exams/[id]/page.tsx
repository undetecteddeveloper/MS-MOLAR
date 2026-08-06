// Exam Detail — /exams/[id] (Layer 2).
// Server Component: xem thông tin đề trước khi bắt đầu (GĐ 2 M2.5, thay fake-data).
// GĐ 3 M3.2: visual language L2 "tờ giấy trắng" — SiteHeader + back link + eyebrow
// môn/lớp + tiêu đề serif + ô meta (số câu/thời gian) + nút brand. Mobile-first.
// Feedback: bỏ eyebrow môn/lớp + dòng hướng dẫn; back link "Trang trước"; căn giữa toàn bộ.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getExam } from "@/app/(layer2)/queries";
import { hasReported } from "@/app/(layer4)/queries";
import { StartAttemptButton } from "@/app/(layer2)/_components/StartAttemptButton";
import { ReportExam } from "@/app/(layer2)/_components/ReportExam";
import { AuthorByline } from "@/components/shared/AuthorByline";
import { DifficultyBadge } from "@/components/rating/DifficultyBadge";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";

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
      <main className="mx-auto flex w-full max-w-xl flex-col px-6 py-10">
        {/* "Trang trước" canh TRÁI block tổng quan (self-start), nội dung dưới căn giữa. */}
        <Link
          href="/exams"
          className="preload-fade eyebrow hover:text-brand inline-flex items-center gap-1 self-start transition-colors"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        >
          ← Back
        </Link>

        {/* preload order 2 — khối tổng quan fade sau navbar + back link (S#21). */}
        <div
          className="preload-fade mt-6 flex flex-col items-center text-center"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          <h1 className="text-3xl leading-tight sm:text-4xl">{exam.title}</h1>

          {/* Byline UGC (Task 5.2) — dưới tiêu đề, chỉ hiện với đề có tác giả. */}
          <AuthorByline name={exam.authorDisplayName} className="mt-2" />

          {/* S#28: điền data DB thật vào page — thêm School/Year/Semester
              (null → "None"). 6 ô = lưới 2×3 đều → bỏ hack căn giữa col-span
              của ô Difficulty (S#26, chỉ cần khi lẻ ô). Difficulty giờ hiển
              thị DifficultyBadge (Rating System, ADR-0008) — "—" khi < 3
              lượt đánh giá (AC-016). */}
          <dl className="mt-8 grid w-full max-w-md grid-cols-2 gap-4">
            <div className="border-border bg-card rounded-lg border p-5">
              <dt className="eyebrow">{t("common.questions")}</dt>
              <dd className="text-foreground mt-2 font-serif text-2xl tabular-nums">
                {exam.questionIds.length}
              </dd>
            </div>
            <div className="border-border bg-card rounded-lg border p-5">
              <dt className="eyebrow">{t("exams.duration")}</dt>
              <dd className="text-foreground mt-2 font-serif text-2xl tabular-nums">
                {exam.durationMinutes}{" "}
                <span className="text-muted-foreground text-base">{t("exams.minutesShort")}</span>
              </dd>
            </div>
            <div className="border-border bg-card rounded-lg border p-5">
              <dt className="eyebrow">{t("common.school")}</dt>
              <dd
                className={`mt-2 font-serif text-lg leading-snug ${
                  exam.school ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {exam.school ?? t("common.none")}
              </dd>
            </div>
            <div className="border-border bg-card rounded-lg border p-5">
              <dt className="eyebrow">{t("common.year")}</dt>
              <dd
                className={`mt-2 font-serif text-2xl tabular-nums ${
                  exam.schoolYear !== undefined ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {exam.schoolYear ?? t("common.none")}
              </dd>
            </div>
            <div className="border-border bg-card rounded-lg border p-5">
              <dt className="eyebrow">{t("common.semester")}</dt>
              <dd
                className={`mt-2 font-serif text-2xl ${
                  exam.semester ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {exam.semester ?? t("common.none")}
              </dd>
            </div>
            <div className="border-border bg-card rounded-lg border p-5">
              <dt className="eyebrow">{t("exams.difficulty")}</dt>
              <DifficultyBadge communityDifficulty={exam.communityDifficulty} variant="detail" />
            </div>
          </dl>

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
      </main>
    </div>
  );
}
