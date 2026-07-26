"use client";

// ExamFilters — bộ lọc Exam Browser (Layer 2). GĐ 3 M3.1 (LÀM LẠI #2).
// Bám sát TEMPLATE/L2/L2_mobile.png + #Yêu cầu engineer:
//  - *Filter nằm BÊN TRÁI exam list (cạnh nó), KHÔNG có tiêu đề trang phía trên.
//  - Đóng: chỉ hiện "tay nắm" mảnh (tam giác đen ▶ + nhãn dọc "BỘ LỌC") cạnh list.
//  - Mở: bảng lọc ĐÈ LÊN exam list (overlay, không đẩy block sang bên) + rgba highlight.
//  - Cả block *Filter là position: STICKY (top-14) → đi theo user khi cuộn trang,
//    không trôi mất như phần tử thường.
//  - Mỗi filter có toggle riêng; mở "bảng chọn" cũng là overlay (absolute) nên
//    KHÔNG làm xê dịch bố cục các filter khác.
// State lọc ở URL searchParams (UI-LAYER-MAP Mục 9) → Server Component re-query.
// S#27: Subject/Grade/School/Year/Semester lọc thật từ DB. Rating System
// (D002, frontend DD): Level giờ lọc thật (avg_overall bucket, DB-side);
// Hardest gộp vào MỘT trục ?sort= (newest|oldest|hardest, loại trừ nhau) —
// KHÔNG còn ?hardest=1 độc lập (thay đổi hành vi có chủ đích, đã xác nhận
// tại design [Stop], thay thế thiết kế Hardest-độc-lập cũ ở S#28).

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

/** Rating System — khớp ExamSort (queries.ts) + ExamLevel lowercase slug (IP-6). */
type ExamSort = "newest" | "oldest" | "hardest";
type ExamLevel = "easy" | "medium" | "hard";

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
}

// Lọc nhanh — 3 ô checkbox NGOÀI dropdown, xếp dọc, tất cả CÙNG trục ?sort=
// (D002): chọn 1 tự loại trừ 2 cái còn lại (toggle lại chính nó → bỏ sort).
const QUICK: { value: ExamSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "hardest", label: "Hardest" },
];

const LEVEL_OPTIONS: { value: ExamLevel | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

// rgba khai báo tường minh trong source (theo #Yêu cầu) để làm nổi bật *Filter.
// Tông ngà #EDE1C8 theo theme Mực & Sơn mài (S#17) thay trắng thuần.
const PANEL_BG = "rgba(237, 225, 200, 0.98)"; // sheet ngà nổi trên nền trang
const OPTIONS_BG = "rgba(237, 225, 200, 0.99)"; // bảng chọn của từng filter
const SCRIM_BG = "rgba(27, 21, 18, 0.08)"; // dim exam list khi *Filter mở

export function ExamFilters({
  subjects,
  grades,
  schools,
  years,
  semesters,
  selected,
  sort,
}: ExamFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false); // master *Filter open/close

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, {
        scroll: false,
      });
    });
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasFilters =
    selected.subject !== undefined ||
    selected.grade !== undefined ||
    selected.school !== undefined ||
    selected.year !== undefined ||
    selected.semester !== undefined ||
    selected.level !== undefined;

  return (
    <>
      {/* Scrim rgba — dim exam list để *Filter nổi bật. Click để đóng. */}
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 cursor-default"
          style={{ backgroundColor: SCRIM_BG }}
        />
      )}

      {/* Cả block *Filter STICKY dưới navbar (h-15). shrink-0: tay nắm mảnh cạnh list.
          preload order 1 — fade sau navbar (S#21). pt-5 (S#22): edge trên của
          tay nắm ngang hàng với ExamCard (cột card có py-5). */}
      <div
        className="preload-fade sticky top-15 z-20 shrink-0 self-start pt-5"
        style={{ "--preload-order": 1 } as React.CSSProperties}
        data-pending={isPending ? "" : undefined}
      >
        <div className="relative">
          {/* Tay nắm (master toggle) — tam giác đen, nhãn dọc. Luôn render = mỏ neo sticky. */}
          <button
            type="button"
            aria-label="Filters"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="border-border hover:bg-accent flex flex-col items-center gap-2 rounded-md border-r py-4 pr-2.5 pl-3 transition-colors duration-200"
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
            <span className="eyebrow" style={{ writingMode: "vertical-rl" }}>
              Filters
            </span>
          </button>

          {/* Bảng lọc OVERLAY — absolute KỀ MÉP PHẢI tay nắm (left-full, S#22 —
              không đè lên filter button nữa), đè lên exam list (không đẩy bố cục). */}
          {open && (
            <div
              className="border-border absolute top-0 left-full z-20 w-[84vw] max-w-xs border"
              style={{ backgroundColor: PANEL_BG }}
            >
              {/* Header bảng: toggle (nhãn, S#26 bỏ tam giác trong dropdown)
                  bên trái · nút Clear bên phải ngang hàng tiêu đề (S#22 —
                  thay nút "Clear filters" cũ ở cuối panel). */}
              <div className="border-border bg-background/60 flex w-full items-center justify-between gap-3 border-b px-4 py-3">
                <button
                  type="button"
                  aria-expanded
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3"
                >
                  <span className="eyebrow">Filters{hasFilters ? " · active" : ""}</span>
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!hasFilters}
                  className="text-muted-foreground hover:text-brand text-xs underline-offset-4 transition-colors hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  Clear
                </button>
              </div>

              <FilterRow
                label="Subject"
                selectedLabel={selected.subject}
                currentValue={selected.subject ?? ""}
                options={[
                  { value: "", label: "All" },
                  ...subjects.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("subject", v)}
              />
              <FilterRow
                label="Grade"
                selectedLabel={selected.grade !== undefined ? `Grade ${selected.grade}` : undefined}
                currentValue={selected.grade !== undefined ? String(selected.grade) : ""}
                options={[
                  { value: "", label: "All" },
                  ...grades.map((g) => ({
                    value: String(g),
                    label: `Grade ${g}`,
                  })),
                ]}
                onSelect={(v) => setParam("grade", v)}
              />
              <FilterRow
                label="School"
                selectedLabel={selected.school}
                currentValue={selected.school ?? ""}
                options={[
                  { value: "", label: "All" },
                  ...schools.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("school", v)}
              />
              <FilterRow
                label="Year"
                selectedLabel={selected.year !== undefined ? String(selected.year) : undefined}
                currentValue={selected.year !== undefined ? String(selected.year) : ""}
                options={[
                  { value: "", label: "All" },
                  ...years.map((y) => ({ value: String(y), label: String(y) })),
                ]}
                onSelect={(v) => setParam("year", v)}
              />
              <FilterRow
                label="Semester"
                selectedLabel={selected.semester}
                currentValue={selected.semester ?? ""}
                options={[
                  { value: "", label: "All" },
                  ...semesters.map((s) => ({ value: s, label: s })),
                ]}
                onSelect={(v) => setParam("semester", v)}
              />
              {/* Level — bucket độ khó cộng đồng (Rating System, D002 sibling
                  change: real FilterRow thay panel "Coming soon"). */}
              <FilterRow
                label="Level"
                selectedLabel={
                  LEVEL_OPTIONS.find((o) => o.value === (selected.level ?? ""))?.label || undefined
                }
                currentValue={selected.level ?? ""}
                options={LEVEL_OPTIONS}
                onSelect={(v) => setParam("level", v)}
                last
              />
            </div>
          )}

          {/* Lọc nhanh — 3 ô CHECKBOX, CÙNG trục ?sort= (D002): chọn 1 tự bỏ
              chọn 2 cái còn lại (dùng chung param, loại trừ nhau). Mép phải
              mỗi ô canh đúng viền phải tay nắm: đặt absolute right-0 trong
              .relative (right-0 = mép phải handle = đường kẻ). w-max nới text
              sang TRÁI, checkbox luôn ghim mép phải nên cả 3 ô thẳng hàng. */}
          <div className="absolute top-full right-0 mt-3 flex w-max flex-col gap-2">
            {QUICK.map((q) => {
              const checked = sort === q.value;
              return (
                <label
                  key={q.value}
                  className="text-foreground flex cursor-pointer items-center justify-between gap-2 text-sm whitespace-nowrap"
                >
                  {q.label}
                  <input
                    type="checkbox"
                    className="accent-brand size-4"
                    checked={checked}
                    onChange={() => {
                      // Toggle: chọn lại chính nó → bỏ sort; 3 giá trị dùng
                      // chung param nên chọn 1 tự loại 2 cái còn lại.
                      setParam("sort", sort === q.value ? "" : q.value);
                    }}
                  />
                </label>
              );
            })}
          </div>
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
  label,
  selectedLabel,
  currentValue,
  options,
  onSelect,
  last = false,
}: {
  label: string;
  selectedLabel?: string;
  currentValue?: string;
  options: Option[];
  onSelect: (value: string) => void;
  last?: boolean;
}) {
  const [rowOpen, setRowOpen] = useState(false);

  return (
    <div className={`relative ${last ? "" : "border-border border-b"}`}>
      {/* S#26: bỏ tam giác trong dropdown (RowTriangle) — row chỉ còn nhãn. */}
      <button
        type="button"
        aria-expanded={rowOpen}
        onClick={() => setRowOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="eyebrow">{label}</span>
          {selectedLabel && (
            <span className="text-foreground font-serif text-base">{selectedLabel}</span>
          )}
        </span>
      </button>

      {/* Bảng chọn của filter — OVERLAY absolute (đè row dưới, không xê dịch). */}
      {rowOpen && (
        <div
          className="border-border absolute inset-x-0 top-full z-30 border-x border-b"
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
                      setRowOpen(false);
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
                    {opt.label}
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

// Tam giác đen MASTER: ▶ (đóng) → ▼ (mở). Màu mực (gần đen) — màu thật của design.
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
