// QuestionPagination — sidebar điều hướng giữa các câu (Layer 2). GĐ 3 M3.1 Task 2–3.
// Thẻ tô nền surface, mỗi câu một ô TRÒN — đang xem = viên vàng nắng chữ đen
// (cùng ngôn ngữ với ô đang chọn của BottomNav), đã làm = nền xanh chữ trắng,
// chưa làm = ô trắng chữ dịu; câu đánh dấu có chấm đen ở góc trên-phải.
// (Swipe cho mobile — UI-LAYER-MAP 8.2 — xử lý ở ExamPlayer.)
//
// KHÔNG có "use client" nhưng đây LÀ client component: nó nhận prop `onJump`
// là hàm, nên chỉ render được bên trong ranh giới client của nơi gọi.
//
// HAI CHẾ ĐỘ theo số câu (bug prod 2026-08-17):
// Lưới 4 cột không giới hạn chiều cao chỉ ổn với đề seed ~5–12 câu. Đề thật
// 40 câu (Sinh 12) đẩy card lên 10 hàng ≈ 600px — dài hơn cả câu hỏi bên
// cạnh, và trên mobile thì nó chiếm trọn một màn hình phải cuộn qua. Từ
// COMPACT_THRESHOLD câu trở lên: dày hơn (5 cột) + trần chiều cao + tự cuộn
// câu đang xem vào tầm nhìn, kèm một dòng đếm tiến độ để phần bị cuộn khuất
// không làm mất thông tin "đã làm bao nhiêu".
//
// `cells` (màn viết/màn xem bài giải — lý do file nằm ở components/shared, B4):
// nơi gọi tự quyết trạng thái + tên trợ năng từng ô, vì answeredIndices/
// flaggedIndices không nói được "chưa đủ 15 từ" hay "câu hỏi đã thay đổi"
// (UI-D26). Có `cells` thì hai mảng kia bị bỏ qua; không có thì markup y như cũ.
//
// THỐNG NHẤT BẢNG (engineer 2026-10-02): mọi bảng câu hỏi của site — làm bài,
// viết/xem bài giải, sửa đề — dùng MỘT cấu trúc phẳng: dòng tiêu đề + dòng phụ,
// lưới ô tròn nhỏ 5 cột, đề có phần thì chia mục có nhãn nhỏ phía trên (`groups`).
// Bản popover không còn thẻ lồng thẻ; sidebar giữ thẻ tint vì nó đứng một mình.

import { useEffect, useRef } from "react";
import { AlertCircle, Check, Minus, RefreshCw, type LucideIcon } from "lucide-react";
import { t } from "@/lib/copy";
import { Card } from "@/components/ui/card";

/** Trên ngưỡng này thì đổi sang lưới dày + khung cuộn. */
const COMPACT_THRESHOLD = 10;

export type QuestionCellState =
  | "answered"
  | "idle"
  | "current"
  | "noted"
  | "missing"
  | "short"
  | "changed"
  | "error";

export interface QuestionCell {
  /** Index 0-based; số hiện trên ô là index + 1. */
  index: number;
  state: QuestionCellState;
  /** Tên trợ năng ĐẦY ĐỦ của ô, dùng nguyên văn (vd "Câu 3, chưa đủ 15 từ"). */
  label: string;
  /** Số hiện trên ô nếu khác index + 1 (vd số câu TRONG PHẦN ở màn sửa đề). */
  number?: number;
}

/** Một mục của bảng (một PHẦN của đề). `indices` là index 0-based vào cùng không
 *  gian với `current`/`cells`. */
export interface QuestionGroup {
  title?: string;
  indices: number[];
}

/** Trạng thái màn viết: nền/chữ + ký hiệu xếp dưới số. Ký hiệu là vế "không chỉ
 *  màu" của UI-D26 (AC-050). Các trạng thái còn lại dùng lớp của nhánh cũ. */
const WRITE_LOOK: Partial<Record<QuestionCellState, { className: string; Icon: LucideIcon }>> = {
  noted: { className: "flex-col gap-0.5 bg-primary text-primary-foreground", Icon: Check },
  missing: { className: "flex-col gap-0.5 bg-surface text-foreground", Icon: Minus },
  short: { className: "flex-col gap-0.5 bg-surface text-foreground", Icon: Minus },
  changed: { className: "flex-col gap-0.5 bg-sun-soft text-foreground", Icon: RefreshCw },
  // Màn sửa đề: câu có lỗi — đỏ + ký hiệu, không chỉ màu.
  error: {
    className: "flex-col gap-0.5 bg-destructive text-primary-foreground",
    Icon: AlertCircle,
  },
};

interface QuestionPaginationProps {
  current: number; // index 0-based của câu đang xem
  total: number;
  /** Các index đã có đáp án — đánh dấu "đã làm". */
  answeredIndices?: number[];
  /** Các index được đánh dấu để xem lại (flag). */
  flaggedIndices?: number[];
  /** Trạng thái theo ô; có thì thay hẳn hai mảng index trên. */
  cells?: QuestionCell[];
  /** Tiêu đề thay "Câu hỏi". */
  panelTitle?: string;
  /** Dòng phụ cạnh tiêu đề (vd "40 câu"), thay dòng đếm "Đã làm x/y". */
  panelMeta?: string;
  /** Dòng phụ tô đỏ (vd "1 câu cần sửa"). */
  panelMetaDanger?: boolean;
  /** Chia mục theo PHẦN của đề. Chỉ có tác dụng khi có ≥ 2 mục; không truyền = lưới phẳng. */
  groups?: QuestionGroup[];
  onJump: (index: number) => void;
  /** `sidebar` (mặc định): thẻ surface đứng cột phải từ 768px. `popover`: nằm
   *  trong bảng thả xuống của QuestionPaletteDock — thẻ TRẮNG
   *  (vỏ popover đã có viền), khung cuộn cao hơn (nửa màn hình) vì không còn
   *  phải đứng cạnh thẻ câu hỏi. */
  variant?: "sidebar" | "popover";
}

export function QuestionPagination({
  current,
  total,
  answeredIndices = [],
  flaggedIndices = [],
  cells,
  panelTitle,
  panelMeta,
  panelMetaDanger = false,
  groups,
  onJump,
  variant = "sidebar",
}: QuestionPaginationProps) {
  const cellAt = new Map<number, QuestionCell>(cells?.map((cell) => [cell.index, cell]));
  const answered = new Set(
    cells
      ? cells.filter((cell) => cell.state === "answered").map((cell) => cell.index)
      : answeredIndices
  );
  const flagged = new Set(cells ? [] : flaggedIndices);
  const compact = total > COMPACT_THRESHOLD;
  const popover = variant === "popover";
  // Chia mục chỉ khi đề có ≥ 2 phần; một phần duy nhất = lưới phẳng như trước.
  const sections: QuestionGroup[] =
    groups && groups.length > 1
      ? groups
      : [{ indices: Array.from({ length: total }, (_, i) => i) }];
  const sectioned = sections.length > 1;

  // Cuộn ô của câu đang xem vào tầm nhìn khi nó nằm ngoài khung. `block:
  // "nearest"` để khung chỉ nhích vừa đủ, không giật về giữa mỗi lần chuyển
  // câu; chỉ cuộn KHUNG này, không cuộn cả trang.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!compact && !sectioned) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-q="${current}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [current, compact, sectioned]);

  function renderCell(i: number) {
    const cell = cellAt.get(i);
    const look = cell && WRITE_LOOK[cell.state];
    const isCurrent = cells ? cell?.state === "current" : i === current;
    const isAnswered = answered.has(i);
    const isFlagged = flagged.has(i);
    return (
      <li key={i}>
        <button
          type="button"
          data-q={i}
          onClick={() => onJump(i)}
          aria-current={isCurrent ? "true" : undefined}
          aria-label={
            cell?.label ??
            t("upload.questionLabel", { number: i + 1 }) +
              (isAnswered ? ` (${t("player.answeredStatus")})` : "") +
              (isFlagged ? ` (${t("player.flagged")})` : "")
          }
          className={`focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out focus-visible:ring-3 focus-visible:outline-none motion-safe:active:scale-90 ${
            isCurrent
              ? // Mực ĐEN trên vàng (globals.css `--sun-on-solid`): trên
                // nền tối `--foreground` là màu sáng, chữ sáng trên vàng
                // chỉ đạt 1,4:1.
                "glow-sun bg-sun text-[color:var(--sun-on-solid)]"
              : isAnswered
                ? "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]"
                : look
                  ? look.className
                  : popover
                    ? // Ô "chưa làm" trong bảng thả xuống: tô surface để còn thấy ô.
                      "bg-surface text-muted-foreground hover:text-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {cell?.number ?? i + 1}
          {look && <look.Icon aria-hidden className="size-3" />}
          {isFlagged && (
            <span
              aria-hidden
              className="bg-foreground ring-surface absolute top-0 right-0 size-2.5 rounded-full ring-2"
            />
          )}
        </button>
      </li>
    );
  }

  // Khung cuộn: popover tới nửa màn hình; sidebar ≈ 4 hàng ô (card tổng còn
  // ~250px thay vì ~600px với đề 40 câu), cao hơn một chút khi có nhãn mục.
  const scrollCap = !(compact || sectioned)
    ? ""
    : popover
      ? "max-h-[min(50vh,22rem)] overflow-y-auto pr-1"
      : sectioned
        ? "max-h-[15rem] overflow-y-auto pr-1"
        : "max-h-[11rem] overflow-y-auto pr-1";

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{panelTitle ?? t("common.questions")}</span>
        {panelMeta !== undefined && (
          <span
            className={`text-xs tabular-nums ${
              panelMetaDanger ? "text-destructive font-semibold" : "text-muted-foreground"
            }`}
          >
            {panelMeta}
          </span>
        )}
        {panelMeta === undefined && compact && (
          <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {t("player.answeredCount", { done: answered.size, total })}
          </span>
        )}
      </div>
      <nav>
        <div
          ref={scrollRef}
          className={scrollCap ? `flex flex-col gap-3 ${scrollCap}` : "flex flex-col gap-3"}
        >
          {sections.map((section, k) => (
            <div key={k}>
              {sectioned && section.title !== undefined && (
                <p className="eyebrow mb-1.5 truncate">{section.title}</p>
              )}
              <ol className="grid grid-cols-5 gap-2">{section.indices.map(renderCell)}</ol>
            </div>
          ))}
        </div>
      </nav>
    </>
  );

  // Popover: vỏ popover của dock đã có viền + đệm nên chỉ cần khung phẳng.
  if (popover) return <div className="flex flex-col gap-3">{content}</div>;

  return (
    <Card variant="tint" padding="none" className="gap-3.5 p-4 sm:p-5">
      {content}
    </Card>
  );
}
