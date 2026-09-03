"use client";

// MyExamsList — danh sách đề của user (UI Spec §MyExamsList / Task 6.3).
// Mới nhất trước (query đã order); empty → khối gạch đứt + link Upload.
// Banner ?published=1 (D13) do page truyền `justPublished`.
//
// Layout theo template SCREENSHOT/design_reference/ReviewPage_Layer4: 2 tab
// Pending/Published (underline, base-ui Tabs) — Pending = mọi status CHƯA
// published (processing/failed/review/draft), Published = status published.
// Danh sách mỗi tab cuộn trong container riêng (max-height + overflow-y-auto)
// — trang ngoài không cuộn thêm. Client Component vì cần state tab hiện tại.

import Link from "next/link";
import type { ReactNode } from "react";
import type { MyExamListItem } from "@/features/authoring/queries";
import { useT } from "@/lib/i18n/client";
import { ExamRow } from "@/features/authoring/components/ExamRow";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@/components/ui/tabs";

function ExamListScroll({ children }: { children: ReactNode }) {
  return (
    <ul className="flex max-h-[30rem] flex-col gap-3 overflow-y-auto pr-2">
      {children}
    </ul>
  );
}

export function MyExamsList({
  exams,
  justPublished,
}: {
  exams: MyExamListItem[];
  justPublished: boolean;
}) {
  const t = useT();
  const pending = exams.filter((exam) => exam.status !== "published");
  const published = exams.filter((exam) => exam.status === "published");

  return (
    <div className="flex flex-col gap-6">
      {justPublished && (
        <div
          role="status"
          className="rounded-lg border border-[#3f7d4f] bg-[#3f7d4f]/8 px-4 py-3 text-sm text-[#2f6b3f]"
        >
          ✓ {t("upload.publishedBanner")}
        </div>
      )}

      {/* Tiêu đề trang bỏ khỏi UI nhìn thấy được — điều hướng đã đủ ngữ cảnh;
          h1 sr-only giữ mốc cho trình đọc màn hình (cùng quy ước /exams). */}
      <h1 className="sr-only">{t("common.myExams")}</h1>
      <div className="flex justify-end">
        <Link
          href="/upload"
          className="shrink-0 rounded-[4px] bg-brand px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90"
        >
          {t("upload.uploadAnExam")}
        </Link>
      </div>

      {exams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-muted-foreground">{t("upload.noneUploaded")}</p>
          <Link
            href="/upload"
            className="text-sm text-brand underline-offset-4 hover:underline"
          >
            {t("upload.uploadAnExam")}
          </Link>
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTab value="pending">
              {t("upload.tabPending")} ({pending.length})
            </TabsTab>
            <TabsTab value="published">
              {t("upload.tabPublished")} ({published.length})
            </TabsTab>
            <TabsIndicator />
          </TabsList>

          <TabsPanel value="pending" className="mt-4">
            {pending.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("upload.nothingPending")}
              </p>
            ) : (
              <ExamListScroll>
                {pending.map((exam) => (
                  <ExamRow key={exam.id} item={exam} />
                ))}
              </ExamListScroll>
            )}
          </TabsPanel>

          <TabsPanel value="published" className="mt-4">
            {published.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("upload.nonePublished")}
              </p>
            ) : (
              <ExamListScroll>
                {published.map((exam) => (
                  <ExamRow key={exam.id} item={exam} />
                ))}
              </ExamListScroll>
            )}
          </TabsPanel>
        </Tabs>
      )}
    </div>
  );
}
