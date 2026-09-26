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
//
// Bảng câu hỏi (task 22, DD-U4, AC-049/AC-051): `QuestionPaletteDock` dùng lại
// NGUYÊN VẸN (không sửa file đó) — `currentIndex` là MỘT state duy nhất của
// màn này ("ô câu đang mở gần nhất", theo đúng chữ AC-051: chỉ ĐỔI khi người
// dùng CHỌN một ô ở bảng, không đổi khi bấm thẳng vào đầu hàng — AC-059 nói rõ
// bấm một hàng không tự gập/ảnh hưởng hàng khác nên cũng không tự thành "vị
// trí hiện tại"). `SolutionQuestionRow` KHÔNG có prop `open` (uncontrolled by
// design, không thuộc Target Files task 22) nên "mở hàng k tại chỗ" khi chọn ô
// k dùng đúng mánh `key` đổi để remount đúng MỘT hàng với `defaultOpen` mới
// (`openTokens`, tăng dần theo từng lần chọn CHÍNH hàng đó) — hàng khác giữ
// nguyên `key`, không remount, không mất trạng thái gập/mở người dùng tự bấm.
// `jumpSignal` tách hẳn khỏi effect liên kết sâu phía dưới (mảng phụ thuộc
// rỗng, chỉ chạy lúc mount): effect cuộn+focus của "chọn ô" chỉ chạy khi CHÍNH
// người dùng chọn một ô, không chạy ở lượt render đầu.
//
// 0 câu hiện hành (UI Spec `C-21` "Rỗng"): không mount `QuestionPaletteDock` —
// nút tĩnh cùng khuôn `SolutionEditorHeader.tsx` (task 09, đọc trước khi viết
// hàng này) để hai màn đọc giống nhau; `aria-describedby` trỏ đúng `emptyTextId`
// của câu "Đề này hiện không còn câu hỏi nào." mà thẻ nét đứt bên dưới hiện.
import { useEffect, useId, useState, type ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { chipVariants } from "@/components/ui/chip";
import { QuestionPaletteDock } from "@/components/shared/QuestionPaletteDock";
import type { QuestionCell } from "@/components/shared/QuestionPagination";
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

  // "Ô câu đang mở gần nhất" (AC-051) — MỘT state duy nhất (Refactor phase task
  // 22); khởi tạo theo liên kết sâu nếu có, sau đó chỉ đổi khi chọn một ô ở
  // bảng câu hỏi (xem ghi chú đầu file).
  const [currentIndex, setCurrentIndex] = useState<number | null>(
    initialOpenQuestion !== undefined ? initialOpenQuestion - 1 : null
  );
  // Đếm số lần MỖI hàng từng được buộc mở qua bảng câu hỏi — dùng làm một phần
  // `key` để remount đúng hàng đó với `defaultOpen` mới; hàng không có trong
  // map này giữ `key` ổn định vĩnh viễn, kể cả sau khi không còn là "hiện tại".
  const [openTokens, setOpenTokens] = useState<Record<number, number>>(() =>
    initialOpenQuestion !== undefined ? { [initialOpenQuestion - 1]: 0 } : {}
  );
  // Tăng đúng một lần mỗi khi CHỌN một ô — tách biệt effect cuộn/focus bên dưới
  // khỏi effect liên kết sâu (mảng phụ thuộc rỗng, chỉ chạy lúc mount).
  const [jumpSignal, setJumpSignal] = useState(0);

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

  // Chọn ô k (AC-051): cuộn + focus đúng hàng k, SAU KHI hàng đó remount mở
  // (currentIndex/openTokens đã cập nhật ở handleJump, cùng lượt render).
  useEffect(() => {
    if (jumpSignal === 0 || currentIndex === null) return;
    const target = questionNodes[currentIndex];
    if (!target) return;
    const el = document.getElementById(deepLinkRowId(target.questionId));
    el?.scrollIntoView({ block: "start" });
    el?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ phản ứng với jumpSignal (một lần mỗi lần chọn ô); questionNodes/currentIndex đọc tại thời điểm gọi
  }, [jumpSignal]);

  function handleJump(index: number) {
    setCurrentIndex(index);
    setOpenTokens((prev) => ({ ...prev, [index]: (prev[index] ?? -1) + 1 }));
    setJumpSignal((s) => s + 1);
  }

  const cells: QuestionCell[] = questionNodes.map((_, index) => ({
    index,
    state: index === currentIndex ? "current" : "idle",
    label: t("upload.questionLabel", { number: index + 1 }),
  }));

  return (
    <div className="flex flex-col gap-5">
      <SolutionAuthorCard
        solution={solution}
        examId={examId}
        now={now}
        isExamAuthor={isExamAuthor}
        editHref={editHref}
      />

      <div className="flex justify-end">
        {questionNodes.length === 0 ? (
          // Rỗng (DD-U4): không mount QuestionPaletteDock — nút tĩnh cùng
          // khuôn SolutionEditorHeader.tsx (task 09), mô tả trỏ đúng câu Rỗng
          // mà thẻ nét đứt bên dưới hiện (`emptyTextId`).
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={emptyTextId}
            className={cn(chipVariants({ active: false }), "gap-1.5 px-3 tabular-nums h-11")}
          >
            <LayoutGrid aria-hidden className="size-4" />
            <span>{t("common.questionPalette")}</span>
          </button>
        ) : (
          <QuestionPaletteDock
            current={currentIndex ?? -1}
            total={questionNodes.length}
            cells={cells}
            triggerLabel={t("common.questionPalette")}
            panelTitle={t("common.questionPalette")}
            panelMeta={t("exams.questionCount", { count: questionNodes.length })}
            onJump={handleJump}
          />
        )}
      </div>

      {questionNodes.length === 0 ? (
        <Card variant="outline" padding="compact" className="border-dashed text-sm">
          <p id={emptyTextId}>{t("solutions.emptyExam")}</p>
        </Card>
      ) : (
        <ol className="divide-border flex flex-col divide-y">
          {questionNodes.map((q, index) => {
            // Hàng "hiện tại" (AC-051): chỉ đổi khi chọn ô ở bảng câu hỏi —
            // xem ghi chú đầu file. openTokens[index] xác định (thay vì suy ra
            // từ isCurrent) để hàng KHÔNG remount khi currentIndex chuyển sang
            // hàng khác — chỉ hàng vừa được chọn mới remount, với key riêng.
            const isCurrent = currentIndex === index;
            const openToken = openTokens[index];
            return (
              <SolutionQuestionRow
                key={openToken !== undefined ? `${q.questionId}:${openToken}` : q.questionId}
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
                id={isCurrent ? deepLinkRowId(q.questionId) : undefined}
                tabIndex={isCurrent ? -1 : undefined}
                defaultOpen={openToken !== undefined}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}
