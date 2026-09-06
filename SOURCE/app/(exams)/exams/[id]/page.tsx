// Chi tiết đề — /exams/[id]. Server Component: xem thông tin đề trước khi bắt đầu.
//
// Theme "Sân trường" (2026-09-06, docs/design/ui-refactor-san-truong-design.md):
// trang một-tác-vụ, căn TRÁI, đọc từ trên xuống — định vị, nhãn môn/lớp, tên
// đề, tác giả, thông số, rồi thẻ vàng "Trước khi bắt đầu" mang nút Làm bài.
// Thẻ vàng là chỗ táo bạo DUY NHẤT của màn hình (§4.1) và nút hành động chính
// đứng trong đó: mắt dừng ở màu vàng là dừng đúng chỗ có việc để làm. Từ
// 768px thông số và thẻ vàng đứng cạnh nhau; cột thẻ vàng rộng cố định 20rem
// để nút không bị kéo dài theo màn hình.
//
// Bento 6 ô kẻ viền của bản trước bỏ (viền là dấu vết theme cũ, §5), và bản
// thay thế đầu tiên — lưới 2 cột có ô trải hàng — cũng bỏ nốt: engineer
// 2026-09-06 chỉ ra hai chỗ hổng của nó. Xem chú thích tại <dl> bên dưới.

import { notFound } from "next/navigation";
import { getExam } from "@/features/exams/queries";
import { hasReported } from "@/features/authoring/queries";
import { StartAttemptButton } from "@/features/exams/components/StartAttemptButton";
import { ReportExam } from "@/features/exams/components/ReportExam";
import { AuthorByline } from "@/components/shared/AuthorByline";
import { DifficultyBadge } from "@/components/rating/DifficultyBadge";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = await getExam(id);

  if (!exam) {
    notFound();
  }

  // Report channel chỉ cho user đã đăng nhập (AC-025). Đề UGC mới có byline.
  const user = await getCurrentUser();
  const alreadyReported = user ? await hasReported(id) : false;
  const questionCount = exam.questionIds.length;

  return (
    <PageContainer
      as="main"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      {/* Breadcrumbs thay "← Back": nói ĐANG Ở ĐÂU chứ không chỉ ĐI ĐÂU, và
          người vào từ link chia sẻ thì không có "trang trước" nào cả. */}
      <Breadcrumbs
        items={[{ label: t("nav.exams"), href: "/exams" }, { label: exam.title }]}
        className="text-xs"
      />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{exam.subject}</Badge>
          <Badge>{t("exams.gradeValue", { grade: exam.grade })}</Badge>
        </div>
        {/* Cùng thang chữ với PageHeader (26px → 30px). Không dùng PageHeader vì
            hàng nhãn môn/lớp phải nằm GIỮA breadcrumbs và tiêu đề. */}
        <h1 className="text-[1.625rem] leading-tight font-bold sm:text-3xl">{exam.title}</h1>
        <AuthorByline name={exam.authorDisplayName} />
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
        <Card as="section" aria-label={t("exams.facts")} padding="none">
          {/* MỘT <dl>, HAI vùng — chia theo việc thông số đó có LUÔN TỒN TẠI hay
              không. Đây là chỗ sửa hai lỗ hổng engineer chỉ ra 2026-09-06: bản
              trước xếp cả sáu thông số vào lưới 2 cột, nên ô nào dài (trường,
              độ khó) phải trải hết hàng và bỏ lại một nửa hàng trống, còn ô nào
              vắng dữ liệu cũng để lại một nửa hàng trống.
                · Hai ô TRÊN — số câu và thời lượng — là hai cột. Cả hai LUÔN có
                  giá trị (question_ids, duration_minutes NOT NULL), nên cặp ô
                  này không thể hụt mất một nửa.
                · Phần còn lại là DÒNG trải hết bề ngang, nhãn trái giá trị
                  phải. Trường, năm học, học kỳ đều nullable: vắng thì mất
                  nguyên dòng chứ không để lại ô trống lửng. Dòng cũng là chỗ
                  duy nhất chứa nổi tên trường dài mà không phải chia đôi hàng.
              Kẻ chia giữa các dòng là ngoại lệ đã cho phép của quy tắc "nền tô
              thay viền" (§4.2: viền còn ở ô nhập và kẻ chia trong danh sách);
              kẻ chạy hết bề ngang thẻ nên thẻ để padding="none", mỗi dòng tự
              đệm lấy. */}
          <dl className="grid grid-cols-2">
            <div className="border-border flex flex-col gap-1 border-r px-4 py-4 sm:px-5">
              <dt className="eyebrow">{t("exams.questionTotal")}</dt>
              <dd className="text-[1.75rem] leading-none font-bold tabular-nums">
                {questionCount}
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4 sm:px-5">
              <dt className="eyebrow">{t("exams.duration")}</dt>
              <dd className="text-[1.75rem] leading-none font-bold tabular-nums">
                {exam.durationMinutes}{" "}
                <span className="text-muted-foreground text-base font-normal">
                  {t("exams.minutesShort")}
                </span>
              </dd>
            </div>

            <FactRow label={t("exams.difficulty")}>
              <DifficultyBadge communityDifficulty={exam.communityDifficulty} variant="detail" />
            </FactRow>
            {exam.school && <FactRow label={t("common.school")}>{exam.school}</FactRow>}
            {exam.schoolYear !== undefined && (
              <FactRow label={t("common.year")}>
                <span className="tabular-nums">{exam.schoolYear}</span>
              </FactRow>
            )}
            {exam.semester && <FactRow label={t("common.semester")}>{exam.semester}</FactRow>}
          </dl>
        </Card>

        <Card as="section" variant="sun" aria-labelledby="exam-start-title" className="gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id="exam-start-title" className="text-lg font-semibold">
              {t("exams.beforeStartTitle")}
            </h2>
            <p className="text-sm leading-relaxed">
              {t("exams.beforeStartBody", {
                minutes: exam.durationMinutes,
                count: questionCount,
              })}
            </p>
          </div>
          <StartAttemptButton examId={exam.id} />
        </Card>
      </div>

      {/* Kênh báo cáo — chỉ người đã đăng nhập. Hành động phụ, đứng cuối trang,
          dưới một đường kẻ chạy hết bề ngang. Đường kẻ đó sửa lỗ hổng thứ hai:
          hai thẻ trên hiếm khi cao bằng nhau (thẻ thông số co theo số dòng có
          dữ liệu), nên trước đây liên kết này đứng chơ vơ sau một mảng trắng
          không có gì đóng lại. Kẻ ngang biến mảng trắng đó thành khoảng thở của
          một dòng khép trang. Căn GIỮA (2026-09-06, đổi từ căn trái) — cùng
          lối với liên kết đánh giá đề ở trang kết quả. */}
      {user && (
        <div className="border-border border-t pt-4 text-center">
          <ReportExam examId={exam.id} initiallyReported={alreadyReported} />
        </div>
      )}
    </PageContainer>
  );
}

/** Một DÒNG thông số: nhãn trái, giá trị phải, kẻ chia phía trên. col-span-2 để
 *  dòng trải hết bề ngang lưới hai cột của cặp ô trên. */
function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border col-span-2 flex items-center justify-between gap-4 border-t px-4 py-3 sm:px-5">
      <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
      <dd className="text-foreground min-w-0 text-right font-semibold">{children}</dd>
    </div>
  );
}
