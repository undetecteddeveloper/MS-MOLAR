"use client";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";

// ExamFilters — thanh lọc của Kho đề (theme "Sân trường", 2026-09-04).
//
// Một hàng CHIP ngay dưới tiêu đề trang: [Bộ lọc (n)] [Mới nhất] [Cũ nhất]
// [Khó nhất] [chiều sắp xếp] [Xoá lọc]. Bấm "Bộ lọc" mở bảng chọn — vỏ bảng
// (bottom sheet dưới 768px / thả xuống từ 768px, scrim, phần đầu) là
// `FilterSheet`, mỗi hàng chọn là `FilterRow`; cả hai ở components/shared vì
// Lịch sử dùng cùng khuôn (2026-09-07), chỉ khác danh mục hàng bên trong.
//
// State lọc ở URL searchParams → Server Component re-query. Rating System
// (D002): Level lọc thật; Newest/Oldest/Hardest là MỘT trục ?sort= loại trừ
// nhau, kèm ?dir= đảo chiều.
//
// Rail dọc "*Filter" + 3 checkbox `absolute right-0` của bản cũ đã bỏ: cụm đó
// render ở left:-46px (ngoài màn hình) ở mọi bề rộng dưới 1244px.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { FilterRow } from "@/components/shared/FilterRow";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { subjectLabel } from "@/lib/ugc/subjects";

/** Rating System — khớp ExamSort (queries) + ExamLevel lowercase slug (IP-6). */
type ExamSort = "newest" | "oldest" | "hardest";
type ExamLevel = "easy" | "medium" | "hard";
/** Direction toggle — đảo chiều trục `sort` đang chọn (queries SortDirection). */
type SortDirection = "asc" | "desc";

interface ExamFiltersProps {
  subjects: string[];
  grades: number[];
  schools: string[];
  years: number[];
  semesters: string[];
  selected: {
    subject?: string;
    grade?: number;
    school?: string;
    year?: number;
    semester?: string;
    level?: ExamLevel;
  };
  sort?: ExamSort;
  dir?: SortDirection;
}

/** Chiều mặc định của mỗi trục khi không có `dir` — khớp queries. */
const DEFAULT_ASCENDING: Record<ExamSort, boolean> = {
  newest: false,
  oldest: true,
  hardest: false,
};

// Lọc nhanh — 3 chip CÙNG trục ?sort= (D002): chọn 1 tự loại trừ 2 cái còn
// lại (bấm lại chính nó → bỏ sort).
const QUICK: { value: ExamSort; labelKey: MessageKey }[] = [
  { value: "newest", labelKey: "exams.sortNewest" },
  { value: "oldest", labelKey: "exams.sortOldest" },
  { value: "hardest", labelKey: "exams.sortHardest" },
];

const LEVEL_OPTIONS: { value: ExamLevel | ""; labelKey: MessageKey }[] = [
  { value: "", labelKey: "common.all" },
  { value: "easy", labelKey: "exams.levelEasy" },
  { value: "medium", labelKey: "exams.levelMedium" },
  { value: "hard", labelKey: "exams.levelHard" },
];

export function ExamFilters({
  subjects,
  grades,
  schools,
  years,
  semesters,
  selected,
  sort,
  dir,
}: ExamFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  // Hàng nào đang mở — CHỈ MỘT hàng tại một thời điểm.
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
    // Đổi bộ lọc → về trang 1: trang 3 của bộ lọc cũ thường không tồn tại ở bộ
    // lọc mới, và một lưới trắng không nói cho ai biết vì sao.
    params.delete("page");
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  }

  // Đổi trục sort → luôn bỏ `dir` cũ, trục mới bắt đầu ở chiều mặc định của nó.
  function setSort(value: ExamSort) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === value) params.delete("sort");
    else params.set("sort", value);
    params.delete("dir");
    params.delete("page");
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  }

  // Chiều hiệu lực của trục đang chọn — undefined khi chưa chọn trục nào.
  const ascending = sort ? (dir ? dir === "asc" : DEFAULT_ASCENDING[sort]) : undefined;

  function toggleDirection() {
    if (!sort || ascending === undefined) return;
    setParam("dir", ascending ? "desc" : "asc");
  }

  function clearAll() {
    closePanel();
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const activeCount = [
    selected.subject,
    selected.grade,
    selected.school,
    selected.year,
    selected.semester,
    selected.level,
  ].filter((v) => v !== undefined).length;
  const hasFilters = activeCount > 0;

  // Môn hiện bằng NHÃN tiếng Việt và xếp theo nhãn ("Hóa học, Tiếng Anh, Toán,
  // Vật lý") — giá trị URL vẫn là khoá canonical ("Math") vì đó là giá trị DB
  // và là tham số lọc thật của /exams (SkillRecommendationCard trỏ tới nó).
  const sortedSubjects = [...subjects].sort((a, b) =>
    subjectLabel(a).localeCompare(subjectLabel(b), "vi")
  );

  return (
    <div className="relative" data-pending={isPending ? "" : undefined}>
      {/* Hàng chip — cuộn ngang ở màn hẹp thay vì xuống dòng: một hàng công cụ
          hai dòng trông như hai nhóm điều khiển khác nhau. */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={togglePanel}
          className={chipVariants({ active: hasFilters })}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {hasFilters ? t("exams.filterSummary", { count: activeCount }) : t("common.filters")}
        </button>

        <span aria-hidden className="bg-border mx-1 h-6 w-px shrink-0" />

        {QUICK.map((q) => {
          const on = sort === q.value;
          return (
            <button
              key={q.value}
              type="button"
              aria-pressed={on}
              onClick={() => setSort(q.value)}
              className={chipVariants({ active: on })}
            >
              {t(q.labelKey)}
            </button>
          );
        })}

        <button
          type="button"
          onClick={toggleDirection}
          disabled={!sort}
          aria-label={t("exams.toggleSortDirection")}
          title={t("exams.toggleSortDirection")}
          className={chipVariants()}
        >
          {ascending ? (
            <ArrowUpNarrowWide aria-hidden className="size-4" />
          ) : (
            <ArrowDownWideNarrow aria-hidden className="size-4" />
          )}
          {ascending ? t("exams.ascending") : t("exams.descending")}
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
            ...sortedSubjects.map((s) => ({ value: s, label: subjectLabel(s) })),
          ]}
          onSelect={(v) => setParam("subject", v)}
          open={openFilterKey === "subject"}
          onOpenChange={(v) => setOpenFilterKey(v ? "subject" : null)}
        />
        <FilterRow
          filterKey="grade"
          label={t("common.grade")}
          selectedLabel={
            selected.grade !== undefined
              ? t("exams.gradeValue", { grade: selected.grade })
              : undefined
          }
          currentValue={selected.grade !== undefined ? String(selected.grade) : ""}
          options={[
            { value: "", label: t("common.all") },
            ...grades.map((g) => ({
              value: String(g),
              label: t("exams.gradeValue", { grade: g }),
            })),
          ]}
          onSelect={(v) => setParam("grade", v)}
          open={openFilterKey === "grade"}
          onOpenChange={(v) => setOpenFilterKey(v ? "grade" : null)}
        />
        <FilterRow
          filterKey="school"
          label={t("common.school")}
          selectedLabel={selected.school}
          currentValue={selected.school ?? ""}
          options={[
            { value: "", label: t("common.all") },
            ...schools.map((s) => ({ value: s, label: s })),
          ]}
          onSelect={(v) => setParam("school", v)}
          open={openFilterKey === "school"}
          onOpenChange={(v) => setOpenFilterKey(v ? "school" : null)}
        />
        <FilterRow
          filterKey="year"
          label={t("common.year")}
          selectedLabel={selected.year !== undefined ? String(selected.year) : undefined}
          currentValue={selected.year !== undefined ? String(selected.year) : ""}
          options={[
            { value: "", label: t("common.all") },
            ...years.map((y) => ({ value: String(y), label: String(y) })),
          ]}
          onSelect={(v) => setParam("year", v)}
          open={openFilterKey === "year"}
          onOpenChange={(v) => setOpenFilterKey(v ? "year" : null)}
        />
        <FilterRow
          filterKey="semester"
          label={t("common.semester")}
          selectedLabel={selected.semester}
          currentValue={selected.semester ?? ""}
          options={[
            { value: "", label: t("common.all") },
            ...semesters.map((s) => ({ value: s, label: s })),
          ]}
          onSelect={(v) => setParam("semester", v)}
          open={openFilterKey === "semester"}
          onOpenChange={(v) => setOpenFilterKey(v ? "semester" : null)}
        />
        <FilterRow
          filterKey="level"
          label={t("exams.level")}
          selectedLabel={
            selected.level !== undefined
              ? t(
                  LEVEL_OPTIONS.find((o) => o.value === selected.level)?.labelKey ??
                    "common.all"
                )
              : undefined
          }
          currentValue={selected.level ?? ""}
          options={LEVEL_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onSelect={(v) => setParam("level", v)}
          open={openFilterKey === "level"}
          onOpenChange={(v) => setOpenFilterKey(v ? "level" : null)}
          last
        />
      </FilterSheet>
    </div>
  );
}
