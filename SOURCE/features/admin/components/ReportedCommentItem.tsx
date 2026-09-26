"use client";

// Admin — một bình luận trong hàng bài giải bị báo cáo (UI Spec C-39): bình
// luận ĐANG HIỆN có báo cáo mở, hoặc một mục của mục con "Bình luận đã ẩn"
// (AC-107, AC-108). Cùng file là `ModerationReasonForm` — ô lý do + luật lý do
// + hộp thoại "Xoá hẳn" dùng chung cho cả hàng bài giải (C-38) lẫn bình luận
// (C-39); nó nằm ở lá này để ReportedSolutionRow import một chiều, không vòng.
//
// B4: file này KHÔNG import gì từ `@/features/solutions/**`. Các type dưới
// đây là bản song sinh theo cấu trúc của type trong `adminActions.ts`; Server
// Action đi vào qua prop `onModerate` do `app/(admin)/admin/page.tsx` truyền.
//
// Dữ liệu admin không che (S5): tên THẬT luôn hiện; cờ `isAnonymousToReaders`
// chỉ thêm chú thích "ẩn danh với người đọc" bên cạnh. Không avatar (v1.8).
// Mọi nội dung người dùng gõ (thân, lý do) in dạng văn bản thuần — không
// RichText trên /admin.

import { startTransition, useActionState, useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { t } from "@/lib/copy";
import { relativeTime } from "@/lib/format/relativeTime";
import { cn } from "@/lib/utils";

/** Đúng hai giá trị C-38/C-39 hiện — không `avatarUrl` (frontend DD v1.5/v1.8). */
export interface AdminReportedAuthor {
  displayName: string;
  isAnonymousToReaders: boolean;
}

/** Bình luận đang hiện có ≥ 1 báo cáo mở. `questionNumber: null` = câu đã rời
 *  đề (AC-047) — không hiện nhãn "Câu k". */
export interface AdminReportedCommentItem {
  id: string;
  questionNumber: number | null;
  body: string;
  commenter: AdminReportedAuthor;
  reportCount: number;
  reportReasons: string[];
}

/** Một mục của mục con "Bình luận đã ẩn" (AC-107). */
export interface AdminHiddenCommentItem {
  id: string;
  questionNumber: number | null;
  body: string;
  commenter: AdminReportedAuthor;
  hiddenReason: string;
  hiddenAt: string;
  reportCount: number;
}

export type AdminModerationAction = "hide" | "restore" | "delete";

/** Trạng thái `useActionState` — cùng cấu trúc với `AdminModerationState` của
 *  `adminActions.ts`; nhánh lỗi mang copy key cố định, không bao giờ thông điệp DB. */
export type AdminModerationState =
  | { ok: true; status: string }
  | { error: "admin.solutions.actionError" }
  | { error: "profile.error.rateLimited"; seconds: number }
  | null;

/** Chữ ký form action của `moderateSolutionAction` / `moderateCommentAction`. */
export type AdminModerationFormAction = (
  prevState: AdminModerationState,
  formData: FormData
) => Promise<AdminModerationState>;

export function reportCountLabel(count: number): string {
  return count === 1 ? t("admin.oneReport") : t("admin.reportCount", { count });
}

function actionErrorText(state: AdminModerationState): string | null {
  if (!state || !("error" in state)) return null;
  return state.error === "profile.error.rateLimited"
    ? t("profile.error.rateLimited", { seconds: state.seconds })
    : t("admin.solutions.actionError");
}

/** Tên thật + (nếu ẩn danh với người đọc) chú thích — một cặp cho cả người
 *  viết (C-38) lẫn người bình luận (C-39), S5/AC-081. */
export function AdminAuthorLine({ author, label }: { author: AdminReportedAuthor; label?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="text-foreground font-medium break-words">{author.displayName}</span>
      {author.isAnonymousToReaders && <Badge variant="surface">{t("admin.solutions.anonymousNote")}</Badge>}
    </p>
  );
}

interface ModerationReasonFormProps {
  /** Tên field id mà Server Action đọc — `solutionId` / `commentId`, KHÔNG `id`
   *  (`readModerationForm` của adminActions.ts, task 34). */
  idField: "solutionId" | "commentId";
  targetId: string;
  /** Hành động chính: "hide" (đang hiện) hoặc "restore" (đang ẩn). Enter trong
   *  ô lý do gửi hành động này. */
  primaryAction: "hide" | "restore";
  primaryLabel: string;
  deleteTitle: string;
  deleteBody: string;
  onModerate: AdminModerationFormAction;
}

/**
 * Ô lý do + hàng nút + hộp thoại "Xoá hẳn" (C-38/C-39). Luật lý do là tuyến
 * phòng thủ ĐẦU: hide/delete cần lý do không rỗng (AC-082, AC-106), restore
 * thì không — server kiểm LẠI y hệt (task 34), đây không phải chốt chặn thật.
 *
 * FormData được dựng tường minh rồi `dispatch` trong transition (không
 * `<form action>` trần) để đường "Xoá hẳn" KHÔNG thể đi vòng qua ConfirmDialog
 * và để lượt gửi chỉ xảy ra sau khi lý do đã được kiểm.
 */
export function ModerationReasonForm({
  idField,
  targetId,
  primaryAction,
  primaryLabel,
  deleteTitle,
  deleteBody,
  onModerate,
}: ModerationReasonFormProps) {
  const [state, dispatch, pending] = useActionState<AdminModerationState, FormData>(onModerate, null);
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState<AdminModerationAction | null>(null);
  const reasonId = useId();
  const reasonErrorId = useId();
  const reasonRequired = primaryAction === "hide";

  function submit(action: AdminModerationAction) {
    const formData = new FormData();
    formData.set(idField, targetId);
    formData.set("action", action);
    formData.set("reason", reason.trim());
    setRunning(action);
    startTransition(() => dispatch(formData));
  }

  function request(action: AdminModerationAction) {
    // aria-disabled không chặn click như `disabled` gốc — chặn ở đây.
    if (pending) return;
    if (action !== "restore" && reason.trim().length === 0) {
      setReasonMissing(true);
      return;
    }
    setReasonMissing(false);
    if (action === "delete") {
      setConfirmOpen(true);
      return;
    }
    submit(action);
  }

  async function confirmDelete() {
    // busyRef của ConfirmDialog chỉ khoá trong lúc hàm này chạy (nó trả về ngay),
    // còn panel đang đóng chỉ được `inert` che — một cú bấm lọt qua sẽ xếp hàng
    // lượt xoá thứ hai sau lượt đang treo. Chốt ở đây vì đường này mất dữ liệu.
    if (pending) return;
    setConfirmOpen(false);
    submit("delete");
  }

  const errorText = pending || reasonMissing ? null : actionErrorText(state);
  const buttonState = (action: AdminModerationAction) => ({
    "aria-disabled": pending || undefined,
    "aria-busy": (pending && running === action) || undefined,
  });
  const labelFor = (action: AdminModerationAction, label: string) =>
    pending && running === action ? t("common.working") : label;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        request(primaryAction);
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <Label htmlFor={reasonId}>
          {reasonRequired ? t("admin.solutions.reasonRequired") : t("admin.solutions.reasonOptional")}
        </Label>
        <Input
          id={reasonId}
          name="reason"
          value={reason}
          required={reasonRequired}
          aria-invalid={reasonMissing || undefined}
          aria-describedby={reasonMissing ? reasonErrorId : undefined}
          onChange={(event) => {
            setReason(event.target.value);
            if (reasonMissing) setReasonMissing(false);
          }}
        />
        {reasonMissing && (
          <p id={reasonErrorId} role="alert" className="text-destructive mt-1.5 text-sm">
            {t("admin.solutions.reasonMissing")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          {...buttonState(primaryAction)}
          className={cn(
            buttonVariants({ variant: primaryAction === "restore" ? "default" : "secondary" }),
            "aria-disabled:opacity-60"
          )}
        >
          {labelFor(primaryAction, primaryLabel)}
        </button>
        <button
          type="button"
          onClick={() => request("delete")}
          {...buttonState("delete")}
          className={cn(buttonVariants({ variant: "destructive" }), "aria-disabled:opacity-60")}
        >
          {labelFor("delete", t("admin.solutions.deleteAction"))}
        </button>
      </div>

      {errorText && (
        <p role="alert" className="text-destructive text-sm">
          {errorText}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        variant="confirm"
        destructive
        confirmLabel={t("admin.solutions.deleteAction")}
        title={deleteTitle}
        body={deleteBody}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}

type ReportedCommentItemProps = {
  now: Date;
  onModerate: AdminModerationFormAction;
} & (
  | { variant: "reported"; item: AdminReportedCommentItem }
  | { variant: "hidden"; item: AdminHiddenCommentItem }
);

export function ReportedCommentItem(props: ReportedCommentItemProps) {
  const { item, now, onModerate } = props;

  return (
    <li className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.questionNumber !== null && (
          <Badge variant="plain">{t("upload.questionLabel", { number: item.questionNumber })}</Badge>
        )}
        <Badge variant="plain" className="tabular-nums">
          {reportCountLabel(item.reportCount)}
        </Badge>
      </div>

      <p className="text-foreground text-sm leading-relaxed break-words whitespace-pre-wrap">{item.body}</p>
      <AdminAuthorLine author={item.commenter} />

      {props.variant === "hidden" ? (
        <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <p className="break-words">
            {t("solutions.comments.hiddenByAdmin", { reason: props.item.hiddenReason })}
          </p>
          <span className="text-xs">{relativeTime(props.item.hiddenAt, now)}</span>
        </div>
      ) : (
        props.item.reportReasons.length > 0 && (
          <ul className="bg-card flex list-disc flex-col gap-1 rounded-lg py-2 pr-3 pl-7 text-sm">
            {props.item.reportReasons.map((reason, i) => (
              <li key={i} className="break-words">
                {reason}
              </li>
            ))}
          </ul>
        )
      )}

      <ModerationReasonForm
        idField="commentId"
        targetId={item.id}
        primaryAction={props.variant === "hidden" ? "restore" : "hide"}
        primaryLabel={props.variant === "hidden" ? t("common.restore") : t("admin.comments.hideAction")}
        deleteTitle={t("admin.comments.deleteTitle")}
        deleteBody={t("admin.comments.deleteBody")}
        onModerate={onModerate}
      />
    </li>
  );
}
