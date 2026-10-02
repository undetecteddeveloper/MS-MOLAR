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
import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
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
  /** Mở thẳng mạch của bình luận gốc này (`?thread=<id>` từ thẻ "trả lời bạn" ở hồ sơ, AC-R8).
   *  Không khớp bình luận gốc nào đang hiện thì bỏ qua, mở danh sách như thường. */
  initialThreadId?: string;
}

/** Tên để điền `@Tên` và đặt chữ mờ ô trả lời — danh tính đã được che phía server. */
function displayNameOf(comment: SolutionDetailComment): string {
  return comment.author.kind === "named"
    ? comment.author.displayName
    : t("solutions.identity.anonymous");
}

type SheetMode = "list" | "thread";

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
  initialThreadId,
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
  // Hướng C: tầng 1 = danh sách bình luận gốc, tầng 2 = mạch trả lời của MỘT gốc.
  // Mỗi tầng giữ bản nháp riêng để quay lại không làm mất chữ đang gõ.
  const [openThreadId, setOpenThreadId] = useState<string | null>(() =>
    initialThreadId !== undefined && comments.some((c) => c.id === initialThreadId && !c.parentId)
      ? initialThreadId
      : null
  );
  const [threadText, setThreadText] = useState("");
  const [replyTarget, setReplyTarget] = useState<SolutionDetailComment | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  // Tiêu điểm theo người dùng khi đổi tầng: vào mạch → nút ←; lùi về danh sách → đúng nút "N trả lời"
  // vừa bấm (phần tử cũ bị gỡ khỏi cây nên trình duyệt thả tiêu điểm ra body). Bấm "Trả lời" ở danh
  // sách đã chủ động đưa tiêu điểm vào ô nhập nên không giành lại.
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const shownMode = useRef<SheetMode>(openThreadId !== null ? "thread" : "list");
  const lastThreadId = useRef<string | null>(openThreadId);
  const composerOwnsFocus = useRef(false);

  const effectiveAnonymous = lockedAnonymous || isAnonymous;
  const mode: SheetMode = openThreadId !== null ? "thread" : "list";
  const rootComment = commentsList.find((c) => c.id === openThreadId) ?? null;
  const roots = commentsList.filter((c) => !c.parentId);
  const repliesOf = (rootId: string) => commentsList.filter((c) => c.parentId === rootId);
  // Avatar chỉ của người trả lời CÓ TÊN (tối đa 3, mới nhất trước, bỏ trùng tên); ẩn danh bỏ qua hẳn.
  const replyPreviewOf = (rootId: string) => {
    const replies = repliesOf(rootId);
    if (replies.length === 0) return undefined;
    const avatars: Array<{ displayName: string; avatarUrl?: string | null }> = [];
    for (const r of [...replies].reverse()) {
      if (r.author.kind !== "named" || avatars.length >= 3) continue;
      const named = r.author;
      if (!avatars.some((a) => a.displayName === named.displayName)) {
        avatars.push({ displayName: named.displayName, avatarUrl: named.avatarUrl ?? null });
      }
    }
    return { avatars, latestAt: replies[replies.length - 1].createdAt };
  };
  // Đích trả lời hiện tại của ô nhập ở màn mạch: câu được bấm "Trả lời", mặc định là gốc.
  const activeReplyTarget = replyTarget ?? rootComment;
  const isDirty = text.trim() !== "" || threadText.trim() !== "";

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

  useEffect(() => {
    if (shownMode.current === mode) return;
    shownMode.current = mode;
    if (mode === "thread") {
      if (!composerOwnsFocus.current) backButtonRef.current?.focus();
      composerOwnsFocus.current = false;
    } else if (lastThreadId.current !== null) {
      document
        .querySelector<HTMLElement>(`[data-thread-button="${lastThreadId.current}"]`)
        ?.focus();
    }
  }, [mode]);

  async function performSend(
    key: SheetMode = mode
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const body = key === "thread" ? threadText : text;
    const trimmed = body.trim();
    if (trimmed === "") {
      return { ok: false, message: t("solutions.comments.emptyError") };
    }
    if (body.length > COMMENT_MAX_LENGTH) {
      return { ok: false, message: t("solutions.comments.tooLongError") };
    }

    setSending(true);
    const replyToId = key === "thread" ? activeReplyTarget?.id : undefined;
    const result =
      replyToId !== undefined
        ? await postComment(solutionId, questionId, body, effectiveAnonymous, replyToId)
        : await postComment(solutionId, questionId, body, effectiveAnonymous);
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
      parentId: posted.parentId,
      replyToId: posted.replyToId,
    };
    setCommentsList((prev) => [...prev, optimistic]);
    if (key === "thread") {
      setThreadText("");
      setReplyTarget(null);
    } else {
      setText("");
    }
    setIsAnonymous(false);
    return { ok: true };
  }

  async function handleSendClick() {
    if (sending) return;
    const result = await performSend(mode);
    setSendError(result.ok ? null : result.message);
  }

  // Đóng hẳn tấm trượt (nút X): chưa lưu thì hỏi.
  function requestFullClose(): "closed" | "kept" {
    if (!isDirty) {
      onClose();
      return "closed";
    }
    setDirtyOpen(true);
    return "kept";
  }

  // Escape / chạm scrim: ở màn mạch chỉ lùi một tầng về danh sách (AC-R9), ở
  // danh sách mới đóng.
  function requestClose(): "closed" | "kept" {
    if (mode === "thread") {
      backToList();
      return "kept";
    }
    return requestFullClose();
  }

  function openThread(rootId: string, focus = false) {
    lastThreadId.current = rootId;
    composerOwnsFocus.current = focus;
    setOpenThreadId(rootId);
    setReplyTarget(null);
    if (focus) setFocusKey((k) => k + 1);
  }

  function backToList() {
    setOpenThreadId(null);
    setReplyTarget(null);
  }

  // "Trả lời" ở danh sách → mở mạch của gốc; ở màn mạch → đặt đích. Trả lời một
  // câu trả lời thì điền sẵn `@Tên` (R1); trả lời chính gốc thì không cần.
  function handleReply(comment: SolutionDetailComment) {
    if (mode === "list") {
      openThread(comment.id, true);
      return;
    }
    const isRoot = comment.id === openThreadId;
    setReplyTarget(isRoot ? null : comment);
    if (!isRoot) setThreadText(`@${displayNameOf(comment)} `);
    setFocusKey((k) => k + 1);
  }

  async function confirmDirtySave() {
    // Gửi bản nháp của tầng đang xem; nếu tầng đó trống thì gửi bản nháp của tầng kia.
    const key: SheetMode =
      (mode === "thread" ? threadText : text).trim() !== ""
        ? mode
        : mode === "thread"
          ? "list"
          : "thread";
    const result = await performSend(key);
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
    setCommentsList((prev) => {
      const target = prev.find((c) => c.id === commentId);
      const hasReplies =
        target !== undefined && !target.parentId && prev.some((c) => c.parentId === commentId);
      // Gốc còn trả lời → thành dòng mờ tại chỗ (R3), khớp với cách server xử lý.
      if (hasReplies) {
        return prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                placeholder: "deleted" as const,
                body: "",
                isMine: false,
                iReported: false,
                author: { kind: "anonymous" as const },
                isSolutionAuthor: false,
              }
            : c
        );
      }
      return prev.filter((c) => c.id !== commentId);
    });
    if (commentId === openThreadId) {
      // Gốc vừa xoá mà không còn trả lời → mạch không còn gì để hiện.
      if (!commentsList.some((c) => c.parentId === commentId)) backToList();
    }
  }

  return (
    <>
      <OverlaySheet open onRequestClose={requestClose} titleId={titleId}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            {mode === "thread" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                ref={backButtonRef}
                aria-label={t("solutions.comments.thread.back")}
                onClick={backToList}
              >
                <ChevronLeft aria-hidden />
              </Button>
            )}
            <h2 id={titleId} className="text-foreground flex-1 text-lg font-semibold">
              {mode === "thread"
                ? t("solutions.comments.thread.title")
                : t("solutions.comments.title")}{" "}
              · {t("upload.questionLabel", { number: questionNumber })}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.close")}
              onClick={() => requestFullClose()}
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
            mode === "list" &&
            (roots.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {t("solutions.comments.empty")}
              </p>
            ) : (
              <ul className="divide-border flex flex-col divide-y">
                {roots.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    now={now}
                    onDeleted={handleDeleted}
                    onReply={handleReply}
                    replyCount={repliesOf(comment.id).length}
                    replyPreview={replyPreviewOf(comment.id)}
                    onOpenThread={openThread}
                  />
                ))}
              </ul>
            ))}

          {chunkState === "shown" && mode === "thread" && rootComment && (
            <>
              <ul className="border-border bg-surface rounded-xl border px-3">
                <CommentItem comment={rootComment} now={now} onDeleted={handleDeleted} />
              </ul>
              <ul className="divide-border border-border ml-4 flex flex-col divide-y border-l-2 pl-3">
                {repliesOf(rootComment.id).map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    now={now}
                    onDeleted={handleDeleted}
                    onReply={handleReply}
                  />
                ))}
              </ul>
            </>
          )}

          <CommentComposer
            value={mode === "thread" ? threadText : text}
            onChange={mode === "thread" ? setThreadText : setText}
            placeholder={
              mode === "thread"
                ? rootComment && !rootComment.placeholder
                  ? t("solutions.comments.replyPlaceholder", { name: displayNameOf(rootComment) })
                  : t("solutions.comments.replyPlaceholderGeneric")
                : undefined
            }
            focusKey={focusKey}
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
