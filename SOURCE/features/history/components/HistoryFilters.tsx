"use client";

// HistoryFilters — thanh lọc của /history (theme "Sân trường", 2026-09-07).
//
// Cùng khuôn với Kho đề: một hàng CHIP ngay dưới tiêu đề, bấm "Bộ lọc" mở
// bảng chọn (`FilterSheet`: bottom sheet dưới 768px, thả xuống từ 768px). Rail
// dọc "BỘ LỌC" viết đứng + bảng nền ngà của bản trước bỏ hẳn — đó là theme cũ,
// và nó là bản chép thứ hai của ExamFilters đã lệch khỏi bản gốc.
//
// MÔN nằm NGAY TRÊN HÀNG CHIP, không nằm trong bảng: đó là trục lọc học sinh
// bấm nhiều nhất, danh mục ngắn (tối đa 10 môn, thường 1–3), và một chip cho
// mỗi môn đọc được trạng thái đang chọn mà không phải mở gì cả. "Tất cả" là
// chip đầu, tô đậm khi chưa chọn môn nào — hàng chip luôn có ĐÚNG MỘT chip
// đậm (cùng ngôn ngữ với Tuần/Tháng/Toàn thời gian ở Thống kê). Giá trị môn là
// khoá canonical trong DB ("Math"); nhãn qua `subjectLabel()`.
//
// Trong bảng chỉ còn hai hàng KHOẢNG GIÁ TRỊ: Điểm và Ngày nộp. Hàng "Đề thi"
// (chọn một đề trong danh sách) của bản trước bỏ theo yêu cầu engineer
// (2026-09-08): nó lặp lại đúng danh sách đang hiện ngay dưới — muốn xem các
// lượt của một đề thì cuộn danh sách là thấy, không cần mở bảng. Số đếm trên
// chip "Bộ lọc (n)" đếm hai hàng ấy; môn không đếm vì nó đã hiện ngay cạnh.
//
// State lọc ở URL searchParams (chia sẻ/quay lại được) → Server Component lọc
// trong bộ nhớ qua `filterHistoryEntries()` trên MỘT lượt đọc — không round-trip
// thêm cho mỗi lần đổi lọc. Đổi lọc thì bỏ `page`: trang 3 của bộ lọc cũ thường
// không tồn tại ở bộ lọc mới.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, chipVariants } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { t } from "@/lib/copy";
import { subjectLabel } from "@/lib/ugc/subjects";
import { cn } from "@/lib/utils";

export interface HistoryFiltersSelected {
  subject?: string;
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface HistoryFiltersProps {
  subjects: string[];
  selected: HistoryFiltersSelected;
}

export function HistoryFilters({ subjects, selected }: HistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    });
  }

  function clearAll() {
    setOpen(false);
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  // Điểm và Ngày nộp mỗi thứ đếm là MỘT bộ lọc dù đặt một hay cả hai đầu.
  const panelCount = [
    selected.scoreMin ?? selected.scoreMax,
    selected.dateFrom ?? selected.dateTo,
  ].filter((v) => v !== undefined).length;
  const hasPanelFilters = panelCount > 0;
  const hasFilters = hasPanelFilters || selected.subject !== undefined;

  return (
    <div className="relative" data-pending={isPending ? "" : undefined}>
      {/* Hàng chip — cuộn ngang ở màn hẹp thay vì xuống dòng (cùng ExamFilters). */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={chipVariants({ active: hasPanelFilters })}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {hasPanelFilters ? t("exams.filterSummary", { count: panelCount }) : t("common.filters")}
        </button>

        {subjects.length > 0 && (
          <>
            <span aria-hidden className="bg-border mx-1 h-6 w-px shrink-0" />
            <div
              role="group"
              aria-label={t("history.subjectFilter")}
              className="flex items-center gap-2"
            >
              <Chip active={selected.subject === undefined} onClick={() => setParam("subject", "")}>
                {t("common.all")}
              </Chip>
              {subjects.map((s) => (
                <Chip key={s} active={selected.subject === s} onClick={() => setParam("subject", s)}>
                  {subjectLabel(s)}
                </Chip>
              ))}
            </div>
          </>
        )}

        {hasFilters && (
          <Button type="button" variant="link" size="sm" onClick={clearAll} className="shrink-0">
            {t("common.clear")}
          </Button>
        )}
      </div>

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        onClear={clearAll}
        clearDisabled={!hasFilters}
      >
        <RangeRow label={t("history.score")}>
          <RangeField
            type="number"
            ariaLabel={t("history.minimumScore")}
            value={selected.scoreMin}
            placeholder={t("history.min")}
            onCommit={(v) => setParam("scoreMin", v)}
          />
          <RangeDash />
          <RangeField
            type="number"
            ariaLabel={t("history.maximumScore")}
            value={selected.scoreMax}
            placeholder={t("history.max")}
            onCommit={(v) => setParam("scoreMax", v)}
          />
        </RangeRow>

        <RangeRow label={t("history.submitted")} last>
          <RangeField
            type="date"
            ariaLabel={t("history.submittedFrom")}
            value={selected.dateFrom}
            onCommit={(v) => setParam("dateFrom", v)}
          />
          <RangeDash />
          <RangeField
            type="date"
            ariaLabel={t("history.submittedTo")}
            value={selected.dateTo}
            onCommit={(v) => setParam("dateTo", v)}
          />
        </RangeRow>
      </FilterSheet>
    </div>
  );
}

/** Một hàng KHOẢNG GIÁ TRỊ trong bảng lọc — nhãn trên, hai ô nhập dưới. Cùng
 *  đệm và cỡ nhãn với `FilterRow` của Kho đề để hai bảng đứng chung một khuôn. */
function RangeRow({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2 px-4 py-3", !last && "border-border border-b")}>
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function RangeDash() {
  return (
    <span aria-hidden className="text-muted-foreground shrink-0 text-sm">
      –
    </span>
  );
}

/** Ô nhập một đầu khoảng. KHÔNG kiểm soát (commit lúc blur/Enter, không phải
 *  mỗi phím gõ — mỗi lần commit là một lượt điều hướng); `key` theo giá trị
 *  URL để ô remount khi giá trị đổi ở nơi khác (vd Xoá lọc). */
function RangeField({
  type,
  ariaLabel,
  value,
  placeholder,
  onCommit,
}: {
  type: "number" | "date";
  ariaLabel: string;
  value?: number | string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <Input
      key={value ?? "empty"}
      type={type}
      aria-label={ariaLabel}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      // Thang điểm 10, bước 0,1 — chỉ có nghĩa với ô số; ô ngày bỏ qua.
      min={type === "number" ? 0 : undefined}
      max={type === "number" ? 10 : undefined}
      step={type === "number" ? 0.1 : undefined}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      // 40px và chữ 14px: hai ô đứng cạnh nhau trong bảng rộng 20rem, ô 44px
      // chữ 16px của form đăng nhập là cỡ cho một cột.
      className="h-10 px-3 text-sm"
    />
  );
}
