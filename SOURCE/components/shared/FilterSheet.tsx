"use client";

// FilterSheet — vỏ của bảng lọc dùng chung cho Kho đề và Lịch sử (2026-09-07).
//
//  - <768px: BOTTOM SHEET neo đáy màn hình (vùng ngón cái), cao tối đa 70dvh,
//    nằm TRÊN BottomNav (bottom = --bottom-nav-h + safe-area). `dvh` chứ không
//    `vh` vì thanh địa chỉ Safari/Chrome ẩn-hiện làm `vh` cắt mất phần dưới.
//  - ≥768px: bảng thả xuống ngay dưới hàng chip, rộng 20rem. Nơi gọi PHẢI bọc
//    hàng chip lẫn sheet này trong một khối `relative` — bảng neo `absolute`
//    vào khối đó.
//
// Hai nhánh viết TÁCH (mobile không tiền tố, desktop sau `md:`) — không viết
// một nền rồi ghi đè bằng `max-md:*`, hai khai báo cùng thuộc tính sẽ tranh
// nhau theo thứ tự stylesheet.
//
// Phần đầu (tiêu đề, Xoá lọc, Đóng) và scrim nằm ở đây; các HÀNG lọc là
// children — Kho đề có sáu hàng chọn, Lịch sử có một hàng chọn + hai hàng
// khoảng giá trị, nên vỏ không được đoán trước nội dung.

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";

type FilterSheetProps = {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  /** Không có gì để xoá thì nút Xoá lọc mờ đi. */
  clearDisabled: boolean;
  children: React.ReactNode;
};

export function FilterSheet({ open, onClose, onClear, clearDisabled, children }: FilterSheetProps) {
  if (!open) return null;

  return (
    <>
      {/* Scrim — làm dịu nội dung để bảng chọn nổi lên; bấm để đóng. */}
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="bg-foreground/20 animate-in fade-in fixed inset-0 z-10 cursor-default duration-200 motion-reduce:animate-none"
      />
      <div
        role="dialog"
        aria-label={t("common.filters")}
        className="bg-background rounded-t-card animate-in fade-in slide-in-from-bottom-4 fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] z-30 flex max-h-[70dvh] flex-col overflow-hidden duration-200 ease-out motion-reduce:animate-none md:absolute md:inset-x-auto md:top-full md:bottom-auto md:left-0 md:mt-2 md:max-h-[32rem] md:w-80 md:rounded-card md:border md:border-border"
      >
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2">
          <span className="text-base font-semibold">{t("common.filters")}</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="link" size="sm" onClick={onClear} disabled={clearDisabled}>
              {t("common.clear")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t("common.cancel")}
            >
              <X aria-hidden />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
