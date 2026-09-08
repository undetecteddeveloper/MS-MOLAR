// HistoryRow — một lượt làm bài trong HistoryList. Server Component.
//
// Theme "Sân trường" (2026-09-07): thẻ surface bo 18px (primitive Card), bên
// trong từ trái sang: Ô ĐIỂM trắng 56px ("7,5" đậm trên "/10" nhỏ — cùng ngôn
// ngữ ô trắng-trên-surface với ba ô Đúng/Sai/Thời gian ở trang kết quả) → cột
// nội dung: hàng nhãn (môn + huy hiệu tự luận nếu có, nút ⋯ 36px căn phải —
// cỡ nút-trong-thẻ, §2), tên đề, ngày giờ nộp + thời gian làm. Điểm đứng đầu
// hàng vì đó là con số học sinh quét tìm khi mở trang này; ô cùng cỡ ở mọi
// hàng nên cột số thẳng hàng, đọc được mà không phải đọc từng dòng.
//
// CẢ HÀNG là một liên kết tới trang kết quả (stretched link phủ thẻ, không bọc
// nội dung — cùng kỹ thuật ExamCard: bọc thì nút ⋯ thành interactive-trong-
// interactive). Bản trước để hàng trơ, mọi đường đi đều phải qua ⋯; trên điện
// thoại chạm vào hàng mà không có gì xảy ra là một hàng hỏng. Menu ⋯ giữ ba
// mục Lưu / Chia sẻ / Xem chi tiết như hợp đồng test (HistoryRowMenu.test,
// essay-auto-scoring.fixture) — "Xem chi tiết" chỉ hiện khi menu mở nên thứ tự
// Tab thường không có hai điểm dừng cùng đích.
//
// Ngày giờ nộp qua `formatDateTime` (lib/format/datetime.ts — ghim múi giờ
// Việt Nam) thay cho `formatSubmittedDate` (giờ máy chủ): trên Vercel máy chủ
// chạy UTC nên bài nộp 00:30 sáng từng hiện thành hôm trước; thêm giờ phút vì
// cùng một đề làm nhiều lượt một ngày là chuyện thường ở tài khoản luyện đề.
// Thời gian làm giữ `formatCompletionTime` — cùng chuỗi với ô Thời gian ở trang
// kết quả và PDF (hợp đồng chéo bề mặt của lịch sử). Không dấu chấm giữa (§5).
//
// Chuỗi "{score}/10" giữ LIỀN trong textContent (ô điểm là hai <span> kề
// nhau, không khoảng trắng): fixture tự luận và fixture lịch sử đọc đúng chuỗi
// "5.0/10" từ hàng này. Huy hiệu "Đang chấm" đứng cạnh nhãn môn, ngay bên phải
// ô điểm — con số KHÔNG DI CHUYỂN khi huy hiệu xuất hiện (AC-057 + D5), huy
// hiệu là thứ nói rằng con số ấy chưa phải con số cuối.
//
// pdfInput dựng một lần mỗi hàng từ trường đã tải sẵn — không fetch thêm
// (AC-009); hai boolean tự luận ĐỌC từ đường đọc, không suy lại tại chỗ
// (EG-BE-036).

import Link from "next/link";
import type { MyHistoryEntry } from "@/features/history/queries";
import { EssayLifecycleBadge } from "@/components/essay/EssayLifecycleBadge";
import { HistoryRowMenu } from "@/components/history/HistoryRowMenu";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { formatDateTime } from "@/lib/format/datetime";
import { formatCompletionTime } from "@/lib/history/format";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";
import { subjectLabel } from "@/lib/ugc/subjects";

export async function HistoryRow({
  entry,
  examineeName,
}: {
  entry: MyHistoryEntry;
  examineeName: string;
}) {
  const pdfInput: AttemptPdfData = {
    // PDF in nhãn tiếng Việt như mọi bề mặt khác (mẫu PDF không đổi, chỉ dữ liệu).
    subject: subjectLabel(entry.subject),
    examTitle: entry.examTitle,
    totalScore: entry.totalScore,
    examineeName,
    submittedAt: entry.submittedAt,
    correct: entry.correct,
    total: entry.total,
    hasIncompleteEssay: entry.hasIncompleteEssay,
  };
  const resultHref = `/exams/${entry.examId}/attempt/${entry.attemptId}/result`;

  return (
    <Card
      as="li"
      padding="compact"
      className="group relative flex-row items-start gap-3 transition-colors hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_4%)] sm:gap-4"
    >
      <Link
        href={resultHref}
        aria-label={entry.examTitle}
        className="rounded-card focus-visible:ring-ring/40 absolute inset-0 z-0 focus-visible:ring-3 focus-visible:outline-none"
      />

      <p className="bg-card flex size-14 shrink-0 flex-col items-center justify-center rounded-xl leading-none tabular-nums">
        <span className="text-xl font-bold">{entry.totalScore.toFixed(1)}</span>
        <span className="text-muted-foreground mt-1 text-[0.6875rem] font-semibold">/10</span>
      </p>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Nút ⋯ đứng TRONG hàng nhãn (góc trên phải), không phải một cột riêng
            suốt chiều cao hàng: đo 2026-09-07 ở 360px, cột riêng 36px + khe 12px
            bóp cột chữ còn 188px — tên đề nào cũng gãy hai dòng, vài tên bị cắt
            "…", dòng meta cũng gãy. Trong hàng nhãn, nút chỉ chiếm chỗ của một
            dòng và tên đề + meta dùng trọn 236px. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="plain">{subjectLabel(entry.subject)}</Badge>
            {/* CỬA THỨ HAI của cổng AC-058 nằm ở menu; huy hiệu này là lời
                giải thích nhìn thấy được cho lý do chặn — đọc từ trường đã
                published. */}
            {entry.hasUnresolvedEssay && <EssayLifecycleBadge state="pending" />}
          </div>
          {/* z-10 để nút ⋯ nổi trên liên kết phủ thẻ và nhận click của chính nó. */}
          <div className="relative z-10 shrink-0">
            <HistoryRowMenu
              blockedReason={entry.hasUnresolvedEssay ? t("result.essay.pdfBlocked") : null}
              pdfInput={pdfInput}
              resultHref={resultHref}
              examTitle={entry.examTitle}
            />
          </div>
        </div>
        <h3 className="group-hover:text-primary line-clamp-2 leading-snug font-semibold transition-colors">
          {entry.examTitle}
        </h3>
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
          <span>{formatDateTime(entry.submittedAt)}</span>
          <span>{formatCompletionTime(entry.startedAt, entry.submittedAt)}</span>
        </p>
      </div>
    </Card>
  );
}
