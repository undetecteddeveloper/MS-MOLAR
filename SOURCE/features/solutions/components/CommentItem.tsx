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
// Báo cáo (task 37) — hai nhánh loại trừ nhau, một đường dựng, cùng khuôn với
// `SolutionMenu` (task 36): "Xoá" (của tôi) HOẶC "Báo cáo" (của người khác),
// không bao giờ cả hai (UI Spec `C-30`). `canReport = !comment.isMine` đã đủ
// loại trừ hàng bị admin ẩn của chính mình — backend chỉ gửi hàng đó với
// `isMine: true` (và `iReported` luôn `false` ở đó, không ai tự báo cáo được
// bình luận của mình), nên không cần so `isHiddenByAdmin` riêng. `reported`
// SEED từ `comment.iReported` (frontend DD § Client State Design
// "Seeded-from-server state") — chỉ `handleReported` (kết quả `{ ok: true }`
// của `ReportDialog`, mọi giá trị `alreadyReported`) mới lật nó; không bao
// giờ ghi ngược `comment.iReported`. MỘT nhánh DOM cho cả seed lẫn lật phiên
// (không nhánh "vừa báo cáo" riêng).
import { useState } from "react";
import dynamic from "next/dynamic";
import { AuthorIdentity } from "@/features/solutions/components/AuthorIdentity";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ReportDialog } from "@/features/solutions/components/ReportDialog";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Reply } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import {
  deleteComment,
  reportComment,
  type DeleteCommentResult,
} from "@/features/solutions/actions";
import type { SolutionDetailComment } from "@/features/solutions/queries";
import { relativeTime } from "@/lib/format/relativeTime";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

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
  /** Có prop này thì hàng có nút "Trả lời" (không có ở dòng mờ). Màn danh sách
   *  truyền để mở mạch; màn mạch truyền để đặt đích trả lời + điền `@Tên`. */
  onReply?: (comment: SolutionDetailComment) => void;
  /** Số trả lời đang hiện của gốc này; > 0 kèm `onOpenThread` thì có nút "N trả lời ›". */
  replyCount?: number;
  /** Xem nhanh mạch trên nút "N trả lời ›": avatar của người trả lời CÓ TÊN (người ẩn danh
   *  không hiện gì, kể cả chỗ giữ ảnh) + thời điểm trả lời mới nhất. */
  replyPreview?: {
    avatars: Array<{ displayName: string; avatarUrl?: string | null }>;
    latestAt: string;
  };
  onOpenThread?: (rootId: string) => void;
}

function deleteErrorText(error: Extract<DeleteCommentResult, { ok: false }>["error"]): string {
  return error.code === "rateLimited"
    ? t("profile.error.rateLimited", { seconds: error.seconds })
    : t("solutions.comments.deleteError");
}

export function CommentItem({
  comment,
  now,
  onDeleted,
  onReply,
  replyCount = 0,
  replyPreview,
  onOpenThread,
}: CommentItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Seed-from-server (frontend DD § Client State Design): nguồn ban đầu DUY
  // NHẤT là `comment.iReported` của lượt render này; sau đó chỉ
  // `handleReported` mới được lật nó.
  const [reported, setReported] = useState(comment.iReported);
  const [reportOpen, setReportOpen] = useState(false);

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

  function openReport() {
    setReportOpen(true);
  }

  function handleReported() {
    setReported(true);
    setReportOpen(false);
  }

  // S19/AC-070: một hàng đang bị admin ẩn không bao giờ có nút "Xoá", kể cả
  // khi isMine — hàng đó chỉ tới với chính tác giả của nó (isMine luôn true ở
  // đây), nhưng backend đã từ chối lệnh xoá cho ca này nên giao diện không mời.
  const canDelete = comment.isMine && !comment.isHiddenByAdmin;
  // C-30: control loại trừ — hàng của tôi không bao giờ có nút "Báo cáo"
  // (`!comment.isMine` đã loại luôn hàng bị admin ẩn của chính mình, vốn luôn
  // có `isMine: true`).
  const canReport = !comment.isMine;

  const threadButton =
    onOpenThread && replyCount > 0 ? (
      <button
        type="button"
        data-thread-button={comment.id}
        onClick={() => onOpenThread(comment.id)}
        className="border-border bg-surface text-foreground flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-medium"
      >
        <span className="flex min-w-0 items-center gap-2">
          {replyPreview && replyPreview.avatars.length > 0 && (
            <span aria-hidden className="flex shrink-0 items-center">
              {replyPreview.avatars.map((a, i) => (
                <Avatar
                  key={`${a.displayName}-${i}`}
                  src={a.avatarUrl ?? null}
                  name={a.displayName}
                  size={24}
                  className={cn("bg-card ring-surface ring-2", i > 0 && "-ml-2")}
                />
              ))}
            </span>
          )}
          <span className="truncate">
            {t("solutions.comments.replyCount", { count: replyCount })}
            {replyPreview && (
              <span className="text-muted-foreground font-normal">
                {" · "}
                {t("solutions.comments.replyLatest", {
                  time: relativeTime(replyPreview.latestAt, now),
                })}
              </span>
            )}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0" />
      </button>
    ) : null;

  // Dòng mờ của gốc đã xoá / bị ẩn mà còn trả lời (R3-R5): không danh tính, không
  // nội dung, không nút nào ngoài "N trả lời ›".
  if (comment.placeholder) {
    return (
      <li className="flex flex-col gap-2 py-3">
        <div className="border-border text-foreground/60 rounded-lg border border-dashed p-3 text-sm">
          {comment.placeholder === "deleted"
            ? t("solutions.comments.deletedPlaceholder")
            : t("solutions.comments.hiddenPlaceholder")}
        </div>
        {threadButton}
      </li>
    );
  }

  return (
    <li aria-busy={busy || undefined} className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <AuthorIdentity identity={comment.author} size={28} />
        {comment.isSolutionAuthor && (
          <Badge variant="surface">{t("solutions.comments.writerBadge")}</Badge>
        )}
        <span className="text-muted-foreground text-xs">
          {relativeTime(comment.createdAt, now)}
        </span>
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

      <div className="flex flex-wrap items-center gap-x-5">
        {onReply && (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="text-foreground flex h-11 w-fit items-center gap-1.5 text-sm font-medium"
          >
            <Reply aria-hidden className="size-4" />
            {t("solutions.comments.replyAction")}
          </button>
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

        {canReport &&
          (reported ? (
            // MỘT nhánh DOM duy nhất cho cả hai nguồn "đã báo cáo" — seed từ
            // `comment.iReported` lúc mở tấm trượt HAY vừa lật trong phiên này
            // (frontend DD, in-session flip) — không có nhánh riêng nào khác.
            // `aria-live="polite"` báo cho AT khi nó vừa đổi từ nút bấm được
            // sang nút trơ; không `onClick`, không `disabled` gốc.
            <button
              type="button"
              aria-disabled="true"
              aria-live="polite"
              className="text-muted-foreground flex h-11 w-fit items-center text-sm font-medium"
            >
              {t("solutions.comments.reported")}
            </button>
          ) : (
            <button
              type="button"
              onClick={openReport}
              className="text-muted-foreground flex h-11 w-fit items-center text-sm font-medium"
            >
              {t("solutions.comments.report")}
            </button>
          ))}
      </div>

      {threadButton}

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

      <ReportDialog
        open={reportOpen}
        variant="comment"
        onSubmit={(reason) => reportComment(comment.id, reason)}
        onCancel={() => setReportOpen(false)}
        onReported={handleReported}
      />
    </li>
  );
}
