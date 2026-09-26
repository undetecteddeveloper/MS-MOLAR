"use client";

// SolutionViewScreen (C-22) — khung màn xem một bài giải (S-05, UI Spec §
// Component: SolutionViewScreen). `page.tsx` (Server Component) đã ĐỌC
// `SolutionDetail`, dựng sẵn mọi ReactNode của đề câu/ghi chú (UI-D22, cùng
// khuôn `writerQuestionNodes.tsx`) và PARSE `?q`/`?comments` (frontend DD §
// Client State Design "URL state": "Server-parsed on every request") — file
// này chỉ nhận props đã sẵn, không tự đọc `useSearchParams`. "use client" vì
// gập/mở hàng câu + liên kết sâu cần chạy phía trình duyệt (scrollIntoView/
// focus, cùng khuôn `QuestionJumpDock.jumpTo`).
//
// Liên kết sâu (`?q=k`, AC-061): id/tabIndex/scroll-mt-24 gắn LÊN ĐÚNG một
// hàng qua `SolutionQuestionRow`'s props cộng thêm (task 21 Decision 1) — hàng
// đó tự mở sẵn (`defaultOpen`), rồi component này cuộn+focus một lần khi mount
// (mảng phụ thuộc rỗng có chủ ý: URL đọc-một-lần, không áp lại nếu prop đổi).
//
// `initialCommentsOpen` được GIỮ CHỖ cho tấm trượt bình luận thật (task 28,
// task file § Notes "Sequencing") — không bề mặt nào tiêu thụ nó ở task này;
// chữ ký prop giữ nguyên (required, không optional/không default) để task 28
// không phải đổi call site của `page.tsx`.
import { useEffect, useId, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import {
  SolutionAuthorCard,
  type SolutionAuthorCardHeader,
} from "@/features/solutions/components/SolutionAuthorCard";
import { SolutionQuestionRow } from "@/features/solutions/components/SolutionQuestionRow";

/** Một câu đã dựng sẵn ReactNode phía server — twin của `SolutionDetailQuestion`
 *  (`queries.ts`) sau khi `page.tsx` chạy qua bộ dựng node (UI-D22). */
export interface SolutionViewQuestionNode {
  questionId: string;
  stemNode: ReactNode;
  correctAnswerNode: ReactNode;
  /** Có mặt iff bốn khoá điểm-có-điều-kiện có mặt (Reference Contract #19) —
   *  cùng quy ước `SolutionQuestionRow`, component này không tự kiểm gì thêm. */
  writerChoiceNode?: ReactNode;
  result?: "correct" | "wrong" | "skipped";
  notAutoScored?: boolean;
  essayScore?: { earned: number; max: number };
  hasChanged: boolean;
  /** `undefined` ⇒ "Chưa có lời giải" (AC-048); `commentCount` bên trong đi
   *  NGUYÊN VẸN từ `SolutionDetailQuestion.note.commentCount` — màn này không
   *  tự thêm/bớt gì (Reference Contract #20). */
  note?: { bodyNode: ReactNode; commentCount?: number };
}

export interface SolutionViewScreenProps {
  solution: SolutionAuthorCardHeader;
  examId: string;
  now: Date;
  isExamAuthor: boolean;
  editHref?: string;
  questionNodes: SolutionViewQuestionNode[];
  /** 1-based, đã `Number.parseInt` + clamp `[1, questionNodes.length]` phía
   *  SERVER (`page.tsx`) — `undefined` = không có liên kết sâu, giá trị không
   *  parse được, hoặc đề rỗng. Câu đích đã bị xoá vẫn clamp vào một chỉ số hợp
   *  lệ (AC-061 note: "mở trang bình thường, không báo lỗi") — component này
   *  không phân biệt "câu đích còn tồn tại" khỏi "câu đích đã đổi vị trí". */
  initialOpenQuestion?: number;
  /** Giữ chỗ cho `CommentSheet` thật (task 28) — xem ghi chú đầu file. */
  initialCommentsOpen: boolean;
}

function deepLinkRowId(questionId: string): string {
  return `solution-question-${questionId}`;
}

export function SolutionViewScreen({
  solution,
  examId,
  now,
  isExamAuthor,
  editHref,
  questionNodes,
  initialOpenQuestion,
}: SolutionViewScreenProps) {
  const emptyTextId = useId();

  useEffect(() => {
    if (initialOpenQuestion === undefined) return;
    const target = questionNodes[initialOpenQuestion - 1];
    if (!target) return;
    const el = document.getElementById(deepLinkRowId(target.questionId));
    el?.scrollIntoView({ block: "start" });
    // Thẻ mang tabIndex={-1} (SolutionQuestionRow, Decision 1) nên nhận được
    // focus; không cuộn lần hai vì scrollIntoView vừa làm việc đó (cùng khuôn
    // QuestionJumpDock.jumpTo).
    el?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liên kết sâu chỉ áp dụng MỘT LẦN ở lượt tải đầu (URL đọc-một-lần, § Client State Design "URL state"), không áp lại nếu questionNodes/initialOpenQuestion đổi tham chiếu sau mount
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SolutionAuthorCard
        solution={solution}
        examId={examId}
        now={now}
        isExamAuthor={isExamAuthor}
        editHref={editHref}
      />

      {questionNodes.length === 0 ? (
        <Card variant="outline" padding="compact" className="border-dashed text-sm">
          <p id={emptyTextId}>{t("solutions.emptyExam")}</p>
        </Card>
      ) : (
        <ol className="divide-border flex flex-col divide-y">
          {questionNodes.map((q, index) => {
            const questionNumber = index + 1;
            const isDeepLinkTarget = initialOpenQuestion === questionNumber;
            return (
              <SolutionQuestionRow
                key={q.questionId}
                questionId={q.questionId}
                index={index}
                stemNode={q.stemNode}
                correctAnswerNode={q.correctAnswerNode}
                writerChoiceNode={q.writerChoiceNode}
                hasChanged={q.hasChanged}
                result={q.result}
                notAutoScored={q.notAutoScored}
                essayScore={q.essayScore}
                note={q.note}
                // Sheet bình luận thật là task 28 — chưa có nơi nhận sự kiện này.
                onOpenComments={() => {}}
                id={isDeepLinkTarget ? deepLinkRowId(q.questionId) : undefined}
                tabIndex={isDeepLinkTarget ? -1 : undefined}
                defaultOpen={isDeepLinkTarget}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}
