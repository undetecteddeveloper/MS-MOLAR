"use client";

// QuestionPaletteDock — bảng câu hỏi của màn làm bài trên ĐIỆN THOẠI: một nút
// bật/tắt đứng trong dải dính đỉnh (cạnh đồng hồ) + bảng thả xuống ở góc phải,
// ngay dưới cụm tiêu đề/đồng hồ (engineer 2026-09-13, test trên điện thoại
// thật: bảng câu hỏi nằm DƯỚI thẻ câu hỏi nên mỗi lần muốn nhảy câu là một lần
// lướt xuống rồi lướt lên). Từ 768px không dùng — ở đó bảng là cột phải dính
// theo cuộn (ExamPlayer).
//
// Cùng khuôn với HeaderProfile: `usePresence` cho chiều đóng của `.motion-pop`,
// scrim là một nút trong suốt phủ màn để chạm ra ngoài thì đóng. Scrim đi qua
// portal ra <body>: dải dính đỉnh có `backdrop-blur`, tức là một containing
// block cho `fixed` — scrim đặt bên trong nó chỉ phủ đúng dải ấy. Scrim z-10
// nằm DƯỚI dải dính đỉnh (z-20) nên bảng nổi trên scrim còn thẻ câu hỏi bị
// che; dải dính đáy (z-20) vẫn bấm được — bấm "Câu sau" khi bảng đang mở là
// chuyện bình thường. Chọn một câu thì bảng ĐÓNG: nó phủ lên chính câu hỏi
// người dùng vừa nhảy tới.

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { chipVariants } from "@/components/ui/chip";
import { POP_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { QuestionPagination } from "@/features/exams/components/QuestionPagination";

interface QuestionPaletteDockProps {
  current: number;
  total: number;
  answeredIndices: number[];
  flaggedIndices: number[];
  onJump: (index: number) => void;
  className?: string;
}

export function QuestionPaletteDock({
  current,
  total,
  answeredIndices,
  flaggedIndices,
  onJump,
  className,
}: QuestionPaletteDockProps) {
  const [open, setOpen] = useState(false);
  const { present, closing } = usePresence(open, POP_EXIT_MS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Escape đóng bảng và trả focus về nút — không đụng tới phím ← → của
  // ExamPlayer (bộ nghe đó bỏ qua Escape).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function jump(index: number) {
    onJump(index);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className={cn("relative", className)}>
      {/* Chữ trên nút là tiến độ "đã làm/tổng" — thứ người làm bài liếc nhìn
          thường xuyên nhất sau đồng hồ; tên nút cho trình đọc màn hình. */}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("common.questionPalette")}
        onClick={() => setOpen((v) => !v)}
        className={cn(chipVariants({ active: open }), "gap-1.5 px-3 tabular-nums")}
      >
        <LayoutGrid aria-hidden className="size-4" />
        <span>
          {answeredIndices.length}/{total}
        </span>
      </button>

      {/* `present` chỉ true sau một tương tác ở client, nên `document` luôn có. */}
      {present &&
        createPortal(
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />,
          document.body
        )}

      {/* <section>, KHÔNG role="dialog": bảng không phải hộp thoại chặn
          (LeaveExamDialog mới là dialog của màn này) — chỉ là một vùng có tên
          để nhảy tới. */}
      {present && (
        <section
          id={panelId}
          aria-label={t("common.questionPalette")}
          data-closing={closing ? "" : undefined}
          inert={closing || undefined}
          style={{ transformOrigin: "top right" }}
          className="motion-pop border-border bg-popover absolute top-full right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border p-1.5"
        >
          <QuestionPagination
            variant="popover"
            current={current}
            total={total}
            answeredIndices={answeredIndices}
            flaggedIndices={flaggedIndices}
            onJump={jump}
          />
        </section>
      )}
    </div>
  );
}
