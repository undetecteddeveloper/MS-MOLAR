"use client";

// SolutionPublishBar — thanh đáy cố định của màn viết bài giải: dòng nhắc +
// hai nút (UI Spec `C-14`, AC-028, AC-030). Dính trên `BottomNav`, mang
// `data-bottom-bar` (mẫu `PublishBar.tsx:51-53`).
//
// "Đăng" KHÔNG BAO GIỜ mang `disabled` gốc (UI-D25): `aria-disabled` +
// `aria-describedby` trỏ dòng nhắc, chặn thao tác bằng cách tự kiểm tra
// trong `onClick` (mẫu `ActionButton.tsx:70-88`/`ConfirmDialog.tsx`). Nút bật
// khi mọi câu hiện hành đã ≥15 từ — đây chỉ là gương phía client của luật
// server (phòng thủ, không phải nguồn thật, § Error Handling).
//
// Dòng nhắc và dòng lỗi dùng CHUNG một đoạn `<p>`: bình thường là gương
// client (`solutions.bar.remaining`/`solutions.bar.ready`); khi `error` được
// truyền (từ chối AC-029 với số thật từ server, hoặc trần tần suất AC-101),
// nó thay nội dung và mang `role="alert"` — cha (task 10) dựng sẵn chuỗi đó,
// component này không tự suy ra lý do.
//
// "Bị ẩn" không render thanh này (AC-083) — cha quyết định có mount hay
// không; ở đây chỉ giữ `status === "hidden" → null` làm hàng rào theo đúng
// ma trận trạng thái riêng của component (UI Spec § SolutionPublishBar).

import { useId } from "react";
import Link from "next/link";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

type SolutionPublishBarStatus = "draft" | "published" | "hidden";

interface SolutionPublishBarProps {
  /** `null` = chưa có bài giải nào được lưu lần nào; hiển thị như "draft". */
  status: SolutionPublishBarStatus | null;
  /** N — số câu hiện hành. */
  totalCount: number;
  /** X — số câu hiện hành CHƯA đủ 15 từ (gương client, phòng thủ). */
  incompleteCount: number;
  saving: boolean;
  publishing: boolean;
  /** Dòng `role="alert"` — cha dựng sẵn nguyên văn (AC-029 dùng
   *  `solutions.bar.remaining` với `missingCount` thật từ server; trần tần
   *  suất dùng `profile.error.rateLimited`). `null`/absent = không có lỗi. */
  error?: string | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  /** "Gỡ về nháp" — chỉ phát yêu cầu; hộp thoại xác nhận là việc của cha. */
  onUnpublish: () => void;
  /** "Xem bài giải" — điều hướng sang màn xem (S-05). */
  viewHref: string;
}

const SHELL =
  "border-border bg-background sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] z-20 -mx-4 -mb-6 flex flex-col gap-2 border-t px-4 py-3 sm:-mx-6 sm:-mb-8 sm:px-6 md:bottom-0";

export function SolutionPublishBar({
  status,
  totalCount,
  incompleteCount,
  saving,
  publishing,
  error = null,
  onSaveDraft,
  onPublish,
  onUnpublish,
  viewHref,
}: SolutionPublishBarProps) {
  const reasonId = useId();

  if (status === "hidden") return null;

  if (status === "published") {
    return (
      <div data-bottom-bar="" className={SHELL}>
        <p className="text-muted-foreground text-xs">{t("solutions.bar.publishedNote")}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUnpublish}
            className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}
          >
            {t("solutions.bar.unpublish")}
          </button>
          <Button render={<Link href={viewHref} />} nativeButton={false} className="flex-1">
            {t("solutions.bar.viewMine")}
          </Button>
        </div>
      </div>
    );
  }

  const publishDisabled = incompleteCount > 0 || publishing;
  const reasonText =
    error ??
    (incompleteCount > 0
      ? t("solutions.bar.remaining", { count: incompleteCount, total: totalCount })
      : t("solutions.bar.ready", { total: totalCount }));

  return (
    <div data-bottom-bar="" className={SHELL}>
      <p
        id={reasonId}
        role={error ? "alert" : undefined}
        className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
      >
        {reasonText}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          aria-busy={saving || undefined}
          aria-disabled={saving ? "true" : "false"}
          onClick={() => {
            if (!saving) onSaveDraft();
          }}
          className={cn(buttonVariants({ variant: "secondary" }), "flex-1 aria-disabled:opacity-60")}
        >
          {saving ? t("common.saving") : t("solutions.bar.saveDraft")}
        </button>
        <button
          type="button"
          aria-busy={publishing || undefined}
          aria-disabled={publishDisabled ? "true" : "false"}
          aria-describedby={reasonId}
          onClick={() => {
            if (!publishDisabled) onPublish();
          }}
          className={cn(buttonVariants({ variant: "default" }), "flex-1 aria-disabled:opacity-60")}
        >
          {publishing ? t("solutions.bar.publishing") : t("solutions.bar.publish")}
        </button>
      </div>
    </div>
  );
}
