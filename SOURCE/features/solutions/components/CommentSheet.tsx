"use client";

// CommentSheet — tấm trượt bình luận của MỘT câu (O-02, UI Spec § Component:
// CommentSheet; AC-068, AC-104, S19). Dựng trên `OverlaySheet` (shell thuần,
// task 07) + `ConfirmDialog variant="dirty-close"` — cùng khuôn `NoteSheet.tsx`
// (O-01, task 11): mounted CÓ ĐIỀU KIỆN bởi `SolutionViewScreen` (chỉ khi có
// câu đang mở bình luận), `open` luôn `true` trong suốt vòng đời — đóng là gỡ
// hẳn component khỏi cây, không phải chuyển `open` sang `false` tại chỗ.
//
// Đếm ở đầu tấm trượt (nếu có nơi nào cần) PHẢI đọc `note.commentCount`,
// KHÔNG BAO GIỜ `comments.length`: bình luận admin-ẩn của chính tác giả được
// liệt cho họ nhưng không tính vào đâu cả (S19). Tấm trượt này không tự vẽ
// con số đó (UI Spec § CommentSheet không có số ở tiêu đề) — "rỗng" đọc thẳng
// độ dài mảng `comments` cục bộ, đúng ý nghĩa "còn gì để hiện" chứ không phải
// "còn bao nhiêu bình luận".
//
// Nạp động RichText (M12, AC-103): `warmRichText()` gọi ngay khi mount (mở lần
// đầu) + một `import()` riêng để BIẾT chính xác lúc chunk sẵn sàng (đổi nhãn
// 2 khối giả → danh sách thật) — cùng kỹ thuật `FormulaPreview.open()`.
//
// Gửi (`performSend`) dùng CHUNG bởi nút "Gửi" của `CommentComposer` VÀ nút
// "Lưu" của hộp thoại đóng-khi-chưa-lưu — nhưng CHỈ MỘT TRONG HAI được phép
// hiện lỗi: nút "Gửi" hiện lỗi trong `CommentComposer` (`sendError`), "Lưu"
// hiện lỗi TRONG hộp thoại (`dirtyError`, Reference Contract Value #24) —
// `performSend` không tự set state lỗi nào, người gọi tự quyết định đặt vào
// đâu, nên hai đường không bao giờ hiện trùng lặp.
import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { OverlaySheet } from "@/components/shared/OverlaySheet";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { CommentComposer } from "@/features/solutions/components/CommentComposer";
import { CommentItem, warmRichText } from "@/features/solutions/components/CommentItem";
import { postComment, type PostCommentResult } from "@/features/solutions/actions";
import type { SolutionDetailComment } from "@/features/solutions/queries";
import type { AuthorIdentity } from "@/lib/solutions/identity";
import { t } from "@/lib/copy";

/** Twin của `COMMENT_BODY_MAX_LENGTH` trong `actions.ts` (không export) — chỉ
 *  dùng để từ chối SỚM phía client trước khi gọi Server Action; server vẫn là
 *  nguồn thật, giá trị này chỉ tránh một vòng round-trip vô ích. */
const COMMENT_MAX_LENGTH = 2000;

type ChunkState = "loading" | "shown" | "error";

export interface CommentSheetProps {
  solutionId: string;
  questionId: string;
  questionNumber: number;
  /** Bản sao ban đầu — `CommentSheet` giữ state cục bộ riêng để thêm/xoá
   *  không lạc quan mà không cần cha re-render (component remount mỗi khi mở
   *  một câu khác, `key={questionId}` ở nơi gọi). */
  comments: SolutionDetailComment[];
  /** `isMine && !showProfile` của BÀI GIẢI — tính ở nơi gọi (S4), không bao
   *  giờ từ tên hiển thị của người xem. */
  lockedAnonymous: boolean;
  /** Danh tính THẬT của người xem hiện tại — chỉ dùng để dựng hàng lạc quan
   *  khi gửi bình luận có tên (không ẩn danh); bình luận đã có sẵn không đọc
   *  trường này. */
  viewerIdentity: AuthorIdentity;
  /** Người xem hiện tại có phải tác giả bài giải hay không — badge "Người
   *  viết" của hàng lạc quan vừa gửi. */
  viewerIsSolutionAuthor: boolean;
  now: Date;
  onClose: () => void;
}

function postErrorText(error: Extract<PostCommentResult, { ok: false }>["error"]): string {
  switch (error.code) {
    case "rateLimited":
      return t("profile.error.rateLimited", { seconds: error.seconds });
    case "empty":
      return t("solutions.comments.emptyError");
    case "tooLong":
      return t("solutions.comments.tooLongError");
    case "generic":
      return t("solutions.comments.sendError");
  }
}

export function CommentSheet({
  solutionId,
  questionId,
  questionNumber,
  comments,
  lockedAnonymous,
  viewerIdentity,
  viewerIsSolutionAuthor,
  now,
  onClose,
}: CommentSheetProps) {
  const titleId = useId();

  const [commentsList, setCommentsList] = useState(comments);
  const [text, setText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [dirtyOpen, setDirtyOpen] = useState(false);
  const [dirtyError, setDirtyError] = useState<string | null>(null);
  const [chunkState, setChunkState] = useState<ChunkState>("loading");

  const effectiveAnonymous = lockedAnonymous || isAnonymous;
  const isDirty = text.trim() !== "";

  useEffect(() => {
    let cancelled = false;
    warmRichText();
    import("@/components/shared/RichText")
      .then(() => {
        if (!cancelled) setChunkState("shown");
      })
      .catch(() => {
        if (!cancelled) setChunkState("error");
      });
    return () => {
      cancelled = true;
    };
    // Mảng phụ thuộc rỗng có chủ ý: component này remount mỗi khi tấm trượt mở
    // một câu khác (`key={questionId}` ở nơi gọi), nên "mount" ĐÃ LÀ "mở lần
    // đầu" của CHÍNH câu này (AC-103) — không cần theo dõi thêm biến nào.
  }, []);

  function retryChunkLoad() {
    setChunkState("loading");
    warmRichText();
    import("@/components/shared/RichText")
      .then(() => setChunkState("shown"))
      .catch(() => setChunkState("error"));
  }

  async function performSend(): Promise<{ ok: true } | { ok: false; message: string }> {
    const trimmed = text.trim();
    if (trimmed === "") {
      return { ok: false, message: t("solutions.comments.emptyError") };
    }
    if (text.length > COMMENT_MAX_LENGTH) {
      return { ok: false, message: t("solutions.comments.tooLongError") };
    }

    setSending(true);
    const result = await postComment(solutionId, questionId, text, effectiveAnonymous);
    setSending(false);

    if (!result.ok) {
      return { ok: false, message: postErrorText(result.error) };
    }

    // Hàng lạc quan mang ĐÚNG lớp che mà server sẽ áp ở lượt đọc kế tiếp
    // (Comment-authoring contract): `{ kind: "anonymous" }` khi và chỉ khi
    // gửi ẩn danh hoặc bị khoá bật — reload không đổi hình dạng hàng này.
    const posted = result.comment;
    const optimistic: SolutionDetailComment = {
      id: posted.id,
      author: effectiveAnonymous ? { kind: "anonymous" } : viewerIdentity,
      isSolutionAuthor: viewerIsSolutionAuthor,
      isMine: true,
      body: posted.body,
      iReported: false,
      createdAt: posted.createdAt,
    };
    setCommentsList((prev) => [...prev, optimistic]);
    setText("");
    setIsAnonymous(false);
    return { ok: true };
  }

  async function handleSendClick() {
    if (sending) return;
    const result = await performSend();
    setSendError(result.ok ? null : result.message);
  }

  function requestClose(): "closed" | "kept" {
    if (!isDirty) {
      onClose();
      return "closed";
    }
    setDirtyOpen(true);
    return "kept";
  }

  async function confirmDirtySave() {
    const result = await performSend();
    if (result.ok) {
      setDirtyOpen(false);
      setDirtyError(null);
      onClose();
      return;
    }
    // Reference Contract Value #24: lỗi hiện TRONG hộp thoại, không phải
    // trong dòng alert của composer — `sendError` không đổi ở nhánh này.
    setDirtyError(result.message);
  }

  function handleDeleted(commentId: string) {
    setCommentsList((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <>
      <OverlaySheet open onRequestClose={requestClose} titleId={titleId}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-foreground text-lg font-semibold">
              {t("solutions.comments.title")} · {t("upload.questionLabel", { number: questionNumber })}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.close")}
              onClick={() => requestClose()}
            >
              <X aria-hidden />
            </Button>
          </div>

          {chunkState === "loading" && (
            <div className="flex flex-col gap-2">
              <span className="sr-only">{t("common.loading")}</span>
              <div className="bg-surface h-16 animate-pulse rounded-lg" />
              <div className="bg-surface h-16 animate-pulse rounded-lg" />
            </div>
          )}

          {chunkState === "error" && (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="text-destructive text-sm">
                {t("solutions.comments.loadError")}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={retryChunkLoad}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {chunkState === "shown" &&
            (commentsList.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {t("solutions.comments.empty")}
              </p>
            ) : (
              <ul className="divide-border flex flex-col divide-y">
                {commentsList.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} now={now} onDeleted={handleDeleted} />
                ))}
              </ul>
            ))}

          <CommentComposer
            value={text}
            onChange={setText}
            isAnonymous={isAnonymous}
            onAnonymousChange={setIsAnonymous}
            lockedAnonymous={lockedAnonymous}
            sending={sending}
            error={sendError}
            onSend={() => void handleSendClick()}
          />
        </div>
      </OverlaySheet>

      <ConfirmDialog
        open={dirtyOpen}
        variant="dirty-close"
        title={t("solutions.dirty.title")}
        body={t("solutions.dirty.body")}
        error={dirtyError}
        onDiscard={() => {
          setDirtyOpen(false);
          setDirtyError(null);
          onClose();
        }}
        onCancel={() => setDirtyOpen(false)}
        onConfirm={confirmDirtySave}
      />
    </>
  );
}
