"use client";

// HistoryFilters — thanh lọc của /history (theme "Sân trường", 2026-09-07).
//
// Cùng khuôn với Kho đề: một chip "Bộ lọc" ngay dưới tiêu đề, bấm mở bảng chọn
// (`FilterSheet`: bottom sheet dưới 768px, thả xuống từ 768px). Rail dọc "BỘ
// LỌC" viết đứng + bảng nền ngà của bản trước bỏ hẳn — đó là theme cũ, và nó là
// bản chép thứ hai của ExamFilters đã lệch khỏi bản gốc.
//
// MÔN HỌC là một HÀNG TRONG BẢNG (`FilterRow` — cùng hàng với Kho đề), theo yêu
// cầu engineer 2026-09-13 sau khi test trên điện thoại thật. Bản 2026-09-07 trải
// mỗi môn thành một chip trên hàng chip; hàng ấy cuộn ngang ở 360px nên tài
// khoản luyện nhiều môn phải kéo mới thấy hết, và hai bề mặt (Kho đề, Lịch sử)
// lọc cùng một trục bằng hai giao diện khác nhau. Nay bảng có ba hàng: Môn học ·
// Điểm · Ngày nộp, và chip "Bộ lọc (n)" đếm cả ba.
//
// State lọc ở URL searchParams (chia sẻ/quay lại được) → Server Component lọc
// trong bộ nhớ qua `filterHistoryEntries()` trên MỘT lượt đọc — không round-trip
// thêm cho mỗi lần đổi lọc. Đổi lọc thì bỏ `page`: trang 3 của bộ lọc cũ thường
// không tồn tại ở bộ lọc mới.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { FilterRow } from "@/components/shared/FilterRow";
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
  /** Khoá canonical trong DB ("Math"), đã xếp theo nhãn tiếng Việt ở page. */
  subjects: string[];
  selected: HistoryFiltersSelected;
}

export function HistoryFilters({ subjects, selected }: HistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // Hàng nào trong bảng đang mở danh sách — CHỈ MỘT hàng tại một thời điểm
  // (cùng quy ước ExamFilters; xem chú thích đầu FilterRow).
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  function togglePanel() {
    setOpen((v) => !v);
    setOpenFilterKey(null);
  }

  function closePanel() {
    setOpen(false);
    setOpenFilterKey(null);
  }

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
    closePanel();
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  // Môn học, Điểm và Ngày nộp — mỗi thứ đếm là MỘT bộ lọc dù đặt một hay cả hai
  // đầu khoảng.
  const panelCount = [
    selected.subject,
    selected.scoreMin ?? selected.scoreMax,
    selected.dateFrom ?? selected.dateTo,
  ].filter((v) => v !== undefined).length;
  const hasFilters = panelCount > 0;

  return (
    <div className="relative" data-pending={isPending ? "" : undefined}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={togglePanel}
          className={chipVariants({ active: hasFilters })}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {hasFilters ? t("exams.filterSummary", { count: panelCount }) : t("common.filters")}
        </button>

        {hasFilters && (
          <Button type="button" variant="link" size="sm" onClick={clearAll} className="shrink-0">
            {t("common.clear")}
          </Button>
        )}
      </div>

      <FilterSheet open={open} onClose={closePanel} onClear={clearAll} clearDisabled={!hasFilters}>
        <FilterRow
          filterKey="subject"
          label={t("common.subject")}
          selectedLabel={
            selected.subject !== undefined ? subjectLabel(selected.subject) : undefined
          }
          currentValue={selected.subject ?? ""}
          options={[
            { value: "", label: t("common.all") },
            ...subjects.map((s) => ({ value: s, label: subjectLabel(s) })),
          ]}
          onSelect={(v) => setParam("subject", v)}
          open={openFilterKey === "subject"}
          onOpenChange={(v) => setOpenFilterKey(v ? "subject" : null)}
        />

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
 *  đệm và cỡ nhãn với `FilterRow` (hàng Môn học ngay trên) để ba hàng đứng
 *  chung một khuôn. */
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
