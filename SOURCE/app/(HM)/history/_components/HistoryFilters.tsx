"use client";
import { useT } from "@/lib/i18n/client";

// HistoryFilters — sticky left-rail filter, cùng bố cục với ExamFilters
// (/exams): tay nắm mảnh (tam giác + nhãn dọc "BỘ LỌC") đứng cạnh nội dung,
// sticky dưới navbar, bảng lọc mở ra dạng OVERLAY đè lên nội dung (desktop)
// / bottom sheet (mobile) — không đẩy bố cục, không có cột riêng cấp trang.
//
// 2026-08-17 (yêu cầu engineer): thay lại bố cục "trigger nằm trong header,
// cạnh tiêu đề History" (bản trước, do phản hồi engineer 2026-07-27) BẰNG bố
// cục rail này — cùng khung với ExamFilters, chỉ khác DANH MỤC lọc bên
// trong: Subject/Exam (dropdown) + Score/Submitted (khoảng giá trị), không có
// Grade/School/Year/Semester/Level hay quick-sort của Exam Browser vì History
// không có các trục đó.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export interface HistoryFiltersSelected {
  subject?: string;
  examId?: string;
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface HistoryFiltersProps {
  subjects: string[];
  exams: { id: string; title: string }[];
  selected: HistoryFiltersSelected;
}

// rgba khai báo tường minh (theo convention ExamFilters) — tông ngà #EDE1C8.
const PANEL_BG = "rgba(237, 225, 200, 0.98)";
const OPTIONS_BG = "rgba(237, 225, 200, 0.99)";
const SCRIM_BG = "rgba(27, 21, 18, 0.08)";

export function HistoryFilters({ subjects, exams, selected }: HistoryFiltersProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false); // master rail open/close
  // Row nào (subject/exam) đang mở dropdown — CHỈ MỘT row tại một thời điểm,
  // cùng lý do ExamFilters đã sửa (S#26): hai row tự giữ state riêng thì mở
  // Subject rồi mở tiếp Exam không đóng Subject lại, hai overlay chồng nhau.
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

  function toggleFilterPanel() {
    setOpen((v) => !v);
    setOpenFilterKey(null);
  }

  function closeFilterPanel() {
    setOpen(false);
    setOpenFilterKey(null);
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasFilters =
    selected.subject !== undefined ||
    selected.examId !== undefined ||
    selected.scoreMin !== undefined ||
    selected.scoreMax !== undefined ||
    selected.dateFrom !== undefined ||
    selected.dateTo !== undefined;

  const selectedExamTitle = exams.find((e) => e.id === selected.examId)?.title;

  return (
    <>
      {/* Scrim rgba — dim nội dung để bảng lọc nổi bật. Click để đóng. */}
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={closeFilterPanel}
          className="animate-in fade-in fixed inset-0 z-10 cursor-default duration-200"
          style={{ backgroundColor: SCRIM_BG }}
        />
      )}

      {/* Cả block sticky dưới navbar (h-15), shrink-0: tay nắm mảnh cạnh nội
          dung. Dưới 768px bỏ sticky, tay nắm trở thành hàng ngang đầy chiều
          rộng phía trên danh sách — cùng công thức ExamFilters. */}
      <div
        className="sticky top-15 z-20 shrink-0 self-start pt-5 max-md:static max-md:w-full max-md:self-stretch max-md:px-4"
        data-pending={isPending ? "" : undefined}
      >
        <div className="relative max-md:static">
          <button
            type="button"
            aria-label={t("common.filters")}
            aria-expanded={open}
            onClick={toggleFilterPanel}
            style={{ "--preload-order": 1 } as React.CSSProperties}
            className="preload-fade border-border hover:bg-accent flex flex-col items-center gap-2 rounded-md border-r py-4 pr-2.5 pl-3 transition-colors duration-200 max-md:min-h-11 max-md:w-full max-md:flex-row max-md:justify-center max-md:gap-3 max-md:border max-md:py-2.5 max-md:pr-3 max-md:pl-3"
          >
            <span className="relative">
              <Triangle open={open} />
              {hasFilters && (
                <span
                  aria-hidden
                  className="bg-brand absolute -top-1 -right-1.5 size-1.5 rounded-full"
                />
              )}
            </span>
            <span className="eyebrow max-md:[writing-mode:horizontal-tb] md:[writing-mode:vertical-rl]">
              {t("common.filters")}
            </span>
          </button>

          {/* Bảng lọc OVERLAY — desktop kề mép phải tay nắm; mobile bottom
              sheet neo đáy màn hình, TRÊN BottomNav (không bị đè). */}
          {open && (
            <div
              className="border-border animate-in fade-in slide-in-from-top-2 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] fixed inset-x-0 z-30 max-h-[70dvh] w-full overflow-y-auto rounded-t-lg border border-x-0 border-b-0 duration-200 ease-out md:absolute md:inset-x-auto md:top-0 md:bottom-auto md:left-full md:z-20 md:max-h-none md:w-[84vw] md:max-w-xs md:overflow-visible md:rounded-none md:border"
              style={{ backgroundColor: PANEL_BG }}
            >
              <div className="border-border bg-background/60 flex w-full items-center justify-between gap-3 border-b px-4 py-3">
                <button
                  type="button"
                  aria-expanded
                  onClick={closeFilterPanel}
                  className="flex items-center gap-3"
                >
                  <span className="eyebrow">
                    {t("common.filters")}
                    {hasFilters ? ` · ${t("common.active")}` : ""}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!hasFilters}
                  className="text-muted-foreground hover:text-brand text-xs underline-offset-4 transition-colors hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  {t("common.clear")}
                </button>
              </div>

              <FilterRow
                filterKey="subject"
                label={t("common.subject")}
                selectedLabel={selected.subject}
                currentValue={selected.subject ?? ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...subjects.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("subject", v)}
                open={openFilterKey === "subject"}
                onOpenChange={(v) => setOpenFilterKey(v ? "subject" : null)}
              />
              <FilterRow
                filterKey="exam"
                label={t("history.exam")}
                selectedLabel={selectedExamTitle}
                currentValue={selected.examId ?? ""}
                options={[
                  { value: "", label: t("common.all") },
                  ...exams.map((e) => ({ value: e.id, label: e.title })),
                ]}
                onSelect={(v) => setParam("examId", v)}
                open={openFilterKey === "exam"}
                onOpenChange={(v) => setOpenFilterKey(v ? "exam" : null)}
              />

              <RangeRow label={t("history.score")}>
                <NumberField
                  ariaLabel={t("history.minimumScore")}
                  value={selected.scoreMin}
                  min={0}
                  max={10}
                  step={0.1}
                  placeholder={t("history.min")}
                  onCommit={(v) => setParam("scoreMin", v)}
                />
                <span className="text-muted-foreground text-xs">–</span>
                <NumberField
                  ariaLabel={t("history.maximumScore")}
                  value={selected.scoreMax}
                  min={0}
                  max={10}
                  step={0.1}
                  placeholder={t("history.max")}
                  onCommit={(v) => setParam("scoreMax", v)}
                />
              </RangeRow>

              <RangeRow label={t("history.submitted")} last>
                <DateField
                  ariaLabel={t("history.submittedFrom")}
                  value={selected.dateFrom}
                  onCommit={(v) => setParam("dateFrom", v)}
                />
                <span className="text-muted-foreground text-xs">–</span>
                <DateField
                  ariaLabel={t("history.submittedTo")}
                  value={selected.dateTo}
                  onCommit={(v) => setParam("dateTo", v)}
                />
              </RangeRow>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface Option {
  value: string;
  label: string;
}

function FilterRow({
  filterKey,
  label,
  selectedLabel,
  currentValue,
  options,
  onSelect,
  open: rowOpen,
  onOpenChange,
}: {
  filterKey: string;
  label: string;
  selectedLabel?: string;
  currentValue?: string;
  options: Option[];
  onSelect: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Cuộn row vào vùng nhìn thấy của bottom sheet khi mở (dưới `md`, bảng
  // chọn in-flow) — cùng lý do/khuôn ExamFilters.FilterRow.
  useEffect(() => {
    if (!rowOpen) return;
    const isDesktop =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) {
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [rowOpen]);

  return (
    <div ref={rowRef} data-filter-key={filterKey} className="border-border relative border-b">
      <button
        type="button"
        aria-expanded={rowOpen}
        onClick={() => onOpenChange(!rowOpen)}
        className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150"
      >
        <span className="flex flex-col gap-0.5">
          <span className="eyebrow">{label}</span>
          {selectedLabel && (
            <span className="text-foreground truncate font-serif text-base">{selectedLabel}</span>
          )}
        </span>
      </button>

      {rowOpen && (
        <div
          className="border-border animate-in fade-in slide-in-from-top-1 z-30 max-h-56 overflow-y-auto border-x border-b duration-150 ease-out md:absolute md:inset-x-0 md:top-full"
          style={{ backgroundColor: OPTIONS_BG }}
        >
          <ul className="py-1">
            {options.map((opt) => {
              const active = opt.value === currentValue;
              return (
                <li key={opt.value || "all"}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(opt.value);
                      onOpenChange(false);
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left font-serif text-base transition-colors ${
                      active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-px w-3 shrink-0 transition-colors ${
                        active ? "bg-brand" : "bg-transparent"
                      }`}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

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
    <div className={`px-4 py-3 ${last ? "" : "border-border border-b"}`}>
      <span className="eyebrow">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumberField({
  ariaLabel,
  value,
  min,
  max,
  step,
  placeholder,
  onCommit,
}: {
  ariaLabel: string;
  value?: number;
  min: number;
  max: number;
  step: number;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      // Remount khi giá trị từ URL đổi ở nơi khác (vd Clear) — field không
      // kiểm soát (commit lúc blur, không phải mỗi phím gõ).
      key={value ?? "empty"}
      type="number"
      aria-label={ariaLabel}
      defaultValue={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="border-border text-foreground focus:border-brand w-16 rounded border bg-transparent px-2 py-1 text-sm outline-none"
    />
  );
}

function DateField({
  ariaLabel,
  value,
  onCommit,
}: {
  ariaLabel: string;
  value?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      key={value ?? "empty"}
      type="date"
      aria-label={ariaLabel}
      defaultValue={value ?? ""}
      onBlur={(e) => onCommit(e.target.value)}
      className="border-border text-foreground focus:border-brand w-full min-w-0 rounded border bg-transparent px-2 py-1 text-xs outline-none"
    />
  );
}

// Tam giác đen MASTER: ▶ (đóng) → ▼ (mở) — bản sao Triangle của ExamFilters.
function Triangle({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`fill-foreground size-3.5 shrink-0 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      <path d="M2 1 L10 6 L2 11 Z" />
    </svg>
  );
}
