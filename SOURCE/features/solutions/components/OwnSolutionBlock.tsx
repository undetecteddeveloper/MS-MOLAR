// OwnSolutionBlock (C-05) — khối đầu trang danh sách bài giải (S-03) dành cho
// BÀI CỦA CHÍNH NGƯỜI XEM (AC-053). UI Spec § Component: OwnSolutionBlock;
// frontend DD § Main Components "features/solutions/components/OwnSolutionBlock.tsx"
// + § Data Contracts "Own-solution block contract".
//
// Bốn nhánh, KHÔNG hơn: server component thuần, không "use client", không tự
// gọi truy vấn nào — `summary` đã được route (task 18) dẫn xuất sẵn từ
// `getMySolutionForWriter`. Nội dung ghi chú/câu hỏi KHÔNG đi qua component
// này (frontend DD: "nothing derived from state.questions[i].note crosses
// into the client from this route").
//
// Một `href` DUY NHẤT cho cả ba nhánh có nút — cùng `summary.attemptId`
// ("lượt làm đang gắn" hoặc "lượt nộp gần nhất của tôi" tuỳ nhánh, frontend DD
// § "The attemptId rule"), route path S-04.

import Link from "next/link";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { t } from "@/lib/copy";
import type { SolutionStatus } from "@/features/solutions/queries";

export interface OwnSolutionSummary {
  /** `null` = chưa có bài giải nào (AC-053 "chưa có bài"). */
  status: SolutionStatus | null;
  attemptId: string;
  /** a — số câu đã ghi chú đủ 15 từ (AC-027). */
  notedCount: number;
  /** N — số câu hiện tại của đề (AC-027). */
  questionCount: number;
  /** k — số câu đã thay đổi nội dung dưới ghi chú (AC-045). */
  changedQuestionCount: number;
}

export function OwnSolutionBlock({ summary, examId }: { summary: OwnSolutionSummary; examId: string }) {
  const href = `/exams/${examId}/attempt/${summary.attemptId}/solution`;
  const progressLabelId = useId();

  if (summary.status === null) {
    return (
      <Card variant="plain">
        <Button render={<Link href={href} />} nativeButton={false} size="lg" className="w-full">
          {t("solutions.own.writeCta")}
        </Button>
      </Card>
    );
  }

  if (summary.status === "published") {
    return null;
  }

  const isHidden = summary.status === "hidden";

  return (
    <Card variant="plain">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{t("solutions.own.title")}</h2>
        <Badge variant={isHidden ? "wrong" : "muted"}>
          {t(isHidden ? "solutions.status.hidden" : "solutions.status.draft")}
        </Badge>
      </div>

      {isHidden ? (
        <>
          <p className="text-muted-foreground text-sm">{t("solutions.own.hiddenLine")}</p>
          <Button render={<Link href={href} />} nativeButton={false} className="w-fit">
            {t("solutions.own.seeReason")}
          </Button>
        </>
      ) : (
        <>
          <p id={progressLabelId} className="text-sm">
            {t("solutions.own.noted")} {t("solutions.own.progress", { done: summary.notedCount, total: summary.questionCount })}
          </p>
          <Progress value={summary.notedCount} max={summary.questionCount} size="md" aria-labelledby={progressLabelId} />
          {summary.changedQuestionCount > 0 && (
            <p className="text-muted-foreground text-sm">
              {t("solutions.entry.changed", { count: summary.changedQuestionCount })}
            </p>
          )}
          <Button render={<Link href={href} />} nativeButton={false} className="w-fit">
            {t("solutions.own.continue")}
          </Button>
        </>
      )}
    </Card>
  );
}
