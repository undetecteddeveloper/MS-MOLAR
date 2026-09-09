"use client";

// ExamRow — một hàng đề trong "Đề của tôi" (UI Spec §ExamRow / Task 6.3).
// Action theo status (D9): processing→không (AI còn đang đọc file, chưa có gì
// để sửa); mọi trạng thái còn lại → MỘT nút "Chỉnh sửa" về cùng màn rà soát.
// Mọi trạng thái đều xoá được.
//
// Theme "Sân trường" (2026-09-09): thẻ surface bo 18px (primitive Card), từ
// trên xuống: hàng nhãn (môn, lớp, trạng thái) → tên đề (liên kết) → dòng meta
// (số câu, ngày tạo, ngày đăng) → hàng nút (hành động chính + Xoá), cỡ
// nút-trong-thẻ 36px. Cùng khung với thẻ đề ở Kho đề và hàng Lịch sử.
//
// BỎ so với bản trước, và vì sao:
//   - Ô vuông 3 chữ cái ("MAT") đầu hàng: đó là ba chữ đầu của KHOÁ tiếng Anh
//     trong DB ("Math"), không phải viết tắt tiếng Việt — một khoá tiếng Anh
//     lọt ra màn hình. Môn nay là Badge in nhãn Việt qua `subjectLabel`, đúng
//     như mọi bề mặt khác từ 9ce3bca.
//   - Menu chuột phải + tooltip "Nhấp chuột phải để mở menu": với đề chưa
//     đăng, Xoá CHỈ nằm sau chuột phải, mà điện thoại không có chuột phải —
//     tức không xoá được. Nay Xoá là nút nhìn thấy trên mọi hàng (engineer
//     duyệt 2026-09-09).
//   - Nhãn nút theo trạng thái ("Rà soát tiếp" / "Rà soát & sửa" / "Làm tiếp"):
//     ba chữ khác nhau cho MỘT đích đến duy nhất — cùng màn rà soát, cùng việc.
//     Người dùng phải đọc lại nhãn ở từng thẻ để biết nó có khác gì không, mà
//     không khác. Nay một nhãn "Chỉnh sửa" cho mọi thẻ (engineer chốt
//     2026-09-09); trạng thái đã nói bằng huy hiệu ngay phía trên.
//   - Dấu chấm giữa nối meta (§5) và `formatDateTime` cục bộ đọc giờ MÁY: máy
//     chủ Vercel chạy UTC còn trình duyệt chạy giờ Việt Nam, nên cùng một
//     chuỗi ra hai giá trị (lệch hydration) và giờ in ra sai. Dùng bộ định
//     dạng chung đã ghim Asia/Ho_Chi_Minh như Lịch sử.
//
// Nhãn môn/lớp chỉ hiện khi CÓ dữ liệu: đề Automatic mà AI chưa đọc được còn
// sentinel ""/0 — vắng thì mất nhãn, không in "Lớp 0".

import Link from "next/link";
import type { MyExamListItem } from "@/features/authoring/queries";
import { t } from "@/lib/copy";
import { formatDateTime } from "@/lib/format/datetime";
import { subjectLabel } from "@/lib/ugc/subjects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/features/authoring/components/StatusBadge";
import { DeleteDialog } from "@/features/authoring/components/DeleteDialog";

const REVIEW_HREF = (id: string) => `/me/exams/${id}`;

export function ExamRow({ item }: { item: MyExamListItem }) {
  // `processing` là trạng thái DUY NHẤT không sửa được: AI còn đang đọc file
  // nên chưa có câu nào để mở ra.
  const editHref = item.status === "processing" ? null : REVIEW_HREF(item.id);
  const isPublished = item.status === "published";
  // Published: tên đề trỏ tới đề live; còn lại trỏ màn rà soát (nếu vào được).
  const titleHref = isPublished ? `/exams/${item.id}` : editHref;
  const title = item.title.trim() === "" ? t("upload.untitledExam") : item.title;
  const questions =
    item.questionCount === 1
      ? t("upload.oneQuestion")
      : t("upload.questionCount", { count: item.questionCount });

  return (
    <Card as="li" padding="compact" className="gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.subject !== "" && <Badge variant="plain">{subjectLabel(item.subject)}</Badge>}
        {item.grade !== 0 && (
          <Badge variant="plain">{t("upload.gradeShort", { grade: item.grade })}</Badge>
        )}
        <StatusBadge status={item.status} />
      </div>

      <h3 className="leading-snug font-semibold">
        {titleHref ? (
          <Link
            href={titleHref}
            className="hover:text-primary focus-visible:ring-ring/40 rounded-sm transition-colors focus-visible:ring-3 focus-visible:outline-none"
          >
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>

      <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular-nums">
        <span>{questions}</span>
        <span>{t("upload.createdAt", { date: formatDateTime(item.createdAt) })}</span>
        {isPublished && item.reviewedAt && (
          <span className="text-success">
            {t("upload.publishedAt", { date: formatDateTime(item.reviewedAt) })}
          </span>
        )}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {editHref && (
          <Button render={<Link href={editHref} />} nativeButton={false} size="sm">
            {t("upload.actionEdit")}
          </Button>
        )}
        <DeleteDialog examId={item.id} examTitle={title} />
      </div>
    </Card>
  );
}
