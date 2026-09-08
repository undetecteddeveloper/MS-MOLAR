"use client";

// FilterRow — một HÀNG trong bảng lọc (Kho đề, Lịch sử): nhãn + giá trị đang
// chọn, bấm thì mở danh sách lựa chọn IN-FLOW ngay dưới (đẩy hàng dưới xuống)
// ở MỌI bề rộng. Bản trước dùng overlay `absolute` trên desktop và từng bị
// BottomNav/scroll container cắt (2026-08-09); in-flow trong một khung cuộn là
// tổ hợp trình duyệt tính đúng ở mọi nơi.
//
// Từng là hàm cục bộ của ExamFilters; gom về đây khi Lịch sử dựng lại theo cùng
// khuôn bảng lọc (2026-09-07). Hai bản chép của cùng một hàng là thứ chỉ có thể
// lệch nhau theo thời gian — bản cũ của Lịch sử đã lệch thật (overlay tuyệt đối,
// nền ngà theme cũ).
//
// Chỉ MỘT hàng mở tại một thời điểm — trạng thái đó do nơi gọi giữ (`open` +
// `onOpenChange`), vì hai hàng tự giữ state riêng thì mở hàng này không đóng
// hàng kia, hai danh sách chồng nhau.

import { useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterRow({
  filterKey,
  label,
  selectedLabel,
  currentValue,
  options,
  onSelect,
  open: rowOpen,
  onOpenChange,
  last = false,
}: {
  filterKey: string;
  label: string;
  selectedLabel?: string;
  currentValue?: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hàng cuối không kẻ chia dưới. */
  last?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Cuộn hàng vừa mở vào vùng nhìn thấy của khung cuộn: bảng chọn mở IN-FLOW,
  // hàng gần đáy sẽ lộ nội dung mới dưới mép cuộn — không cuộn hộ là "mở ra mà
  // không thấy gì". `scrollIntoView` là no-op trong jsdom nên test không cần
  // guard.
  useEffect(() => {
    if (!rowOpen) return;
    rowRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [rowOpen]);

  return (
    <div
      ref={rowRef}
      data-filter-key={filterKey}
      className={last ? "" : "border-border border-b"}
    >
      <button
        type="button"
        aria-expanded={rowOpen}
        onClick={() => onOpenChange(!rowOpen)}
        className="hover:bg-surface flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{label}</span>
          {selectedLabel && (
            <span className="text-primary truncate text-sm font-semibold">{selectedLabel}</span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${rowOpen ? "rotate-180" : ""}`}
        />
      </button>

      {rowOpen && (
        <ul className="flex flex-col gap-0.5 px-2 pb-2">
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
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-surface text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <Check
                    aria-hidden
                    className={`size-4 shrink-0 ${active ? "text-primary" : "text-transparent"}`}
                  />
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
