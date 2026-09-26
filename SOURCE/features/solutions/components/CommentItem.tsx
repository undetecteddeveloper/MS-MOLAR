"use client";

// CommentItem — một bình luận trong CommentSheet (UI Spec § Component:
// CommentItem; frontend DD § Main Components; AC-070, AC-105, S19).
//
// Thân bình luận qua RichText NẠP ĐỘNG (M12, ADR-0002) — `LazyRichText`/
// `warmRichText` theo mẫu `FormulaPreview.tsx` (task 11): CÙNG một `import()`
// cho `dynamic()` lẫn `warmRichText()` để bundler gộp một chunk và promise
// module được nhớ. Không bao giờ `import { RichText }` tĩnh ở đây hay bất kỳ
// file "use client" nào khác của `features/solutions` (B4/M12).
// `warmRichText` được EXPORT để `CommentSheet` gọi khi tấm trượt mở LẦN ĐẦU
// (AC-103) — định nghĩa `LazyRichText` nằm Ở ĐÂY, MODULE SCOPE, nên mọi
// `CommentItem` trong danh sách dùng chung đúng một tham chiếu (Refactor
// Phase task file).
//
// Danh tính đã bị che PHÍA SERVER cho MỌI người xem không phải admin, kể cả
// chính người bình luận và chính người viết bài (AC-105, S4): một hàng có thể
// đồng thời `{ kind: "anonymous" }`, `isSolutionAuthor: true`, `isMine: true`
// — cả ba vẫn render cùng lúc. "Xoá" chỉ đọc `isMine` (và không đọc khi hàng
// đang bị admin ẩn, S19) — không nhánh nào so khớp tên hiển thị với người
// dùng hiện tại để suy ra sở hữu.
//
// Xoá KHÔNG lạc quan (DD-U3): hàng chỉ biến mất khi server xác nhận `{ok:true}`;
// hỏng ⇒ hộp thoại đóng, hàng vẫn còn, dòng lỗi + "Thử lại" ngay dưới hàng gọi
// lại `deleteComment` với ĐÚNG id đó, không mở lại hộp thoại.
//
// KHÔNG có nút "Báo cáo" ở đây (phạm vi task 37) — `comment.iReported` được
// giữ trong kiểu dữ liệu nhưng không component nào ở đây đọc nó, cùng quy ước
// `AuthorIdentity.isSolutionAuthor` để trống ở task 17.
import { useState } from "react";
import dynamic from "next/dynamic";
import { AuthorIdentity } from "@/features/solutions/components/AuthorIdentity";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { deleteComment, type DeleteCommentResult } from "@/features/solutions/actions";
import type { SolutionDetailComment } from "@/features/solutions/queries";
import { relativeTime } from "@/lib/format/relativeTime";
import { t } from "@/lib/copy";

const LazyRichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), {
  ssr: false,
});

/** Hâm nóng chunk RichText — gọi bởi `CommentSheet` khi tấm trượt mở LẦN ĐẦU
 *  (M12, AC-103). Cùng `import()` với `LazyRichText` ở trên. */
export function warmRichText() {
  void import("@/components/shared/RichText");
}

export interface CommentItemProps {
  comment: SolutionDetailComment;
  /** Mốc thời gian CỐ ĐỊNH của cả lượt render (cùng quy ước `relativeTime` mọi
   *  nơi khác trong tính năng) — không bao giờ gọi `relativeTime` với mặc định. */
  now: Date;
  /** Gọi SAU KHI server xác nhận xoá thành công — `CommentSheet` gỡ hàng khỏi
   *  danh sách của nó, component này không tự gỡ mình. */
  onDeleted: (commentId: string) => void;
}

function deleteErrorText(error: Extract<DeleteCommentResult, { ok: false }>["error"]): string {
  return error.code === "rateLimited"
    ? t("profile.error.rateLimited", { seconds: error.seconds })
    : t("solutions.comments.deleteError");
}

export function CommentItem({ comment, now, onDeleted }: CommentItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function performDelete() {
    setBusy(true);
    const result = await deleteComment(comment.id);
    setBusy(false);
    if (result.ok) {
      onDeleted(comment.id);
      return;
    }
    setDeleteError(deleteErrorText(result.error));
  }

  async function handleConfirm() {
    await performDelete();
    // DD-U3: hộp thoại LUÔN đóng sau một lượt xác nhận, dù thành công hay hỏng
    // — khác nhau ở chỗ hàng có biến mất hay không.
    setConfirmOpen(false);
  }

  function handleRetry() {
    setDeleteError(null);
    void performDelete();
  }

  // S19/AC-070: một hàng đang bị admin ẩn không bao giờ có nút "Xoá", kể cả
  // khi isMine — hàng đó chỉ tới với chính tác giả của nó (isMine luôn true ở
  // đây), nhưng backend đã từ chối lệnh xoá cho ca này nên giao diện không mời.
  const canDelete = comment.isMine && !comment.isHiddenByAdmin;

  return (
    <li aria-busy={busy || undefined} className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <AuthorIdentity identity={comment.author} size={28} />
        {comment.isSolutionAuthor && (
          <Badge variant="surface">{t("solutions.comments.writerBadge")}</Badge>
        )}
        <span className="text-muted-foreground text-xs">{relativeTime(comment.createdAt, now)}</span>
      </div>

      {comment.isHiddenByAdmin ? (
        // UI-D19: làm dịu bằng text-foreground/60 + khung nét đứt — KHÔNG BAO
        // GIỜ `opacity` cho cả khối (khác biệt cố ý, xem UI Spec).
        <div className="border-border rounded-lg border border-dashed p-3">
          <p role="alert" className="text-foreground/60 text-sm">
            {t("solutions.comments.hiddenByAdmin", { reason: comment.hiddenReason ?? "" })}
          </p>
        </div>
      ) : (
        <LazyRichText text={comment.body} className="text-sm" />
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="text-destructive flex h-11 w-fit items-center text-sm font-medium"
        >
          {t("common.delete")}
        </button>
      )}

      {deleteError && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-destructive text-sm">{deleteError}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="text-primary flex h-11 items-center text-sm font-medium"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        variant="confirm"
        confirmLabel={t("common.delete")}
        destructive
        title={t("solutions.comments.deleteTitle")}
        body={t("solutions.comments.deleteBody")}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  );
}
