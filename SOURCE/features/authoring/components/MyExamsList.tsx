"use client";

// MyExamsList — danh sách đề của user (UI Spec §MyExamsList / Task 6.3).
// Mới nhất trước (query đã order); rỗng → thẻ nét đứt + nút tải đề. Băng
// ?published=1 (D13) do page truyền `justPublished`. Client Component vì giữ
// state nhóm đang xem.
//
// Theme "Sân trường" (2026-09-09): hai chip Chờ xử lý / Đã đăng thay hai tab
// gạch chân in hoa (primitive Tabs của theme cũ xoá theo — hết nơi dùng), cùng
// ngôn ngữ chip ở Thống kê và Lịch sử: luôn đúng một viên đậm. Chờ xử lý =
// mọi status CHƯA published (processing/failed/review/draft).
//
// Bỏ khung cuộn riêng 30rem của bản trước, cùng lý do đã ghi ở Lịch sử: vùng
// cuộn lồng trong trang cuộn là hai thanh cuộn tranh một ngón tay trên điện
// thoại, và dưới danh sách không còn nội dung nào để giữ chỗ. Danh sách của
// một tác giả ngắn (listMyExams có biên), không cần phân trang.
//
// `key` trên <ul> theo nhóm đang xem: đổi chip là một cây mới, các hàng của
// nhóm kia không "trượt" thành hàng của nhóm này (đo ở Lịch sử 2026-09-07).

import { useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import type { MyExamListItem } from "@/features/authoring/queries";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ExamRow } from "@/features/authoring/components/ExamRow";

type Tab = "pending" | "published";

export function MyExamsList({
  exams,
  justPublished,
}: {
  exams: MyExamListItem[];
  justPublished: boolean;
}) {
  const [tab, setTab] = useState<Tab>("pending");
  const pending = exams.filter((exam) => exam.status !== "published");
  const published = exams.filter((exam) => exam.status === "published");
  const shown = tab === "pending" ? pending : published;

  return (
    <div className="flex flex-col gap-5">
      {justPublished && (
        <Card role="status" padding="compact" className="flex-row items-center gap-3">
          <CircleCheck aria-hidden className="text-success size-5 shrink-0" />
          <p className="text-sm leading-relaxed">{t("upload.publishedBanner")}</p>
        </Card>
      )}

      {exams.length === 0 ? (
        <Card variant="outline" className="items-center gap-4 border-dashed px-6 py-12 text-center">
          <p className="text-muted-foreground">{t("upload.noneUploaded")}</p>
          <Button render={<Link href="/upload" />} nativeButton={false}>
            {t("upload.uploadAnExam")}
          </Button>
        </Card>
      ) : (
        <>
          <div role="group" aria-label={t("upload.tabsLabel")} className="flex flex-wrap gap-2">
            <Chip active={tab === "pending"} onClick={() => setTab("pending")}>
              {t("upload.tabPending")} ({pending.length})
            </Chip>
            <Chip active={tab === "published"} onClick={() => setTab("published")}>
              {t("upload.tabPublished")} ({published.length})
            </Chip>
          </div>

          {shown.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {tab === "pending" ? t("upload.nothingPending") : t("upload.nonePublished")}
            </p>
          ) : (
            <ul key={tab} className="flex flex-col gap-3">
              {shown.map((exam) => (
                <ExamRow key={exam.id} item={exam} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
