"use client";

// NoteSheet — tấm trượt ghi chú của một câu ở màn viết (O-01, UI Spec §
// Component: NoteSheet; AC-022, AC-024, AC-026, AC-034-036, AC-104, DD-U5).
// Dựng trên `OverlaySheet` (shell thuần, task 07) + `ConfirmDialog
// variant="dirty-close"` (đóng khi còn thay đổi chưa lưu, AC-104).
//
// Thay THẬT cho `NoteEditorScaffold` — giàn giáo tạm task 10 để lại trong
// `SolutionEditorScreen.tsx` (xem ghi chú đầu file đó) — dùng lại NGUYÊN
// `state.activeNote`/`saveNote()` của reducer đó, không thêm action reducer
// mới: "Lưu và sang câu k+1" chỉ là gọi `NOTE_SAVE_SUCCESS` (đã có, đóng tấm
// trượt) rồi `OPEN_NOTE` (đã có, mở lại ngay câu kế) trong CÙNG một hàm host —
// không phải một action mới.
//
// Không tự gọi `RichText` (M12) — `stemNode`/`correctAnswerNode`/`noteNode`
// đến từ `writerQuestionNodes.tsx` (server, UI-D22); `FormulaPreview` (bên
// trong `NoteEditor`) là nơi DUY NHẤT nạp `RichText` động ở đây.
import { useId, useState, type ReactNode } from "react";
import { OverlaySheet } from "@/components/shared/OverlaySheet";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { ModerationReasonBanner } from "@/features/solutions/components/ModerationReasonBanner";
import { NoteEditor } from "@/features/solutions/components/NoteEditor";
import { QuestionAnswerSummary } from "@/features/solutions/components/QuestionAnswerSummary";
import { saveErrorText } from "@/features/solutions/lib/saveErrorText";
import type { SaveSolutionResult } from "@/features/solutions/actions";
import type { WriterQuestionOutcome } from "@/features/solutions/lib/questionOutcome";
import type { WriterQuestionType } from "@/features/solutions/queries";
import type { ChoiceNode, SubItemNode } from "@/features/solutions/components/writerQuestionNodes";
import type { SubItemId } from "@/types/question";
import { NOTE_ROW_LABEL_KEY, type NoteRowState } from "@/features/solutions/components/NoteQuestionRow";
import { X } from "lucide-react";
import { t } from "@/lib/copy";

/** Ghi chú tự luận chỉ điền sẵn khi CÒN TRỐNG và server chưa từng ghi nhận một
 *  lượt điền sẵn trước đó (AC-034/AC-036) — chạy đúng MỘT LẦN qua lazy
 *  initializer của `useState`, không phải `useEffect`: một effect phụ thuộc
 *  `note`/`draft` có thể chạy lại và ghi đè bản người dùng vừa sửa tay, đúng
 *  ca "không điền sẵn lại sau khi sửa tay" mà Required Test #9 đòi. */
function initialDraft(note: string, essayPrefillApplied: boolean, outcome: WriterQuestionOutcome): string {
  if (note !== "" || essayPrefillApplied) return note;
  if (outcome?.essay && outcome.selected) return outcome.selected;
  return note;
}

export interface NoteSheetProps {
  open: boolean;
  questionNumber: number;
  totalCount: number;
  rowState: NoteRowState;
  readOnly: boolean;
  hiddenReason?: string;
  note: string;
  essayPrefillApplied: boolean;
  saving: boolean;
  error: string | null;
  stemNode: ReactNode;
  correctAnswerNode: ReactNode;
  noteNode: ReactNode;
  outcome: WriterQuestionOutcome;
  /** Mặc định "mcq" — khớp fallback của `queries.ts` cho dòng cũ/test không
   *  truyền (vd `NoteSheet.test.tsx`, không kiểm nội dung QuestionAnswerSummary). */
  questionType?: WriterQuestionType;
  choiceNodes?: ChoiceNode[];
  subItemNodes?: SubItemNode[];
  subAnswers?: Partial<Record<SubItemId, boolean>>;
  essayAnswerNode?: ReactNode;
  onSave: (body: string) => Promise<SaveSolutionResult>;
  onSaveAndNext: (body: string) => Promise<SaveSolutionResult>;
  onClose: () => void;
}

export function NoteSheet({
  open,
  questionNumber,
  totalCount,
  rowState,
  readOnly,
  hiddenReason,
  note,
  essayPrefillApplied,
  saving,
  error,
  stemNode,
  correctAnswerNode,
  noteNode,
  outcome,
  questionType = "mcq",
  choiceNodes,
  subItemNodes,
  subAnswers,
  essayAnswerNode,
  onSave,
  onSaveAndNext,
  onClose,
}: NoteSheetProps) {
  const titleId = useId();
  const textareaId = useId();
  const hiddenReasonId = useId();
  // Giá trị lúc mở — mốc so sánh "chưa lưu" cho AC-104 (KHÔNG phải giá trị đã
  // điền sẵn: một ghi chú tự luận vừa điền sẵn nhưng chưa lưu vẫn PHẢI được
  // coi là "còn thay đổi", không thì đóng tấm trượt sẽ mất bản điền sẵn đó mà
  // không hỏi gì cả).
  const [openedNote] = useState(note);
  const [draft, setDraft] = useState(() => initialDraft(note, essayPrefillApplied, outcome));
  const [dirtyOpen, setDirtyOpen] = useState(false);
  const [dirtyError, setDirtyError] = useState<string | null>(null);

  const isLast = questionNumber >= totalCount;
  const isDirty = draft !== openedNote;

  function requestClose(): "closed" | "kept" {
    if (readOnly || !isDirty) {
      onClose();
      return "closed";
    }
    setDirtyOpen(true);
    return "kept";
  }

  async function confirmDirtySave() {
    const result = await onSave(draft);
    if (result.ok) {
      setDirtyOpen(false);
      onClose();
    } else {
      setDirtyError(saveErrorText(result.error));
    }
  }

  return (
    <>
      <OverlaySheet open={open} onRequestClose={requestClose} titleId={titleId}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h2 id={titleId} className="text-foreground text-lg font-semibold">
                {t("upload.questionLabel", { number: questionNumber })}
              </h2>
              <span className="text-muted-foreground text-sm">{t(NOTE_ROW_LABEL_KEY[rowState])}</span>
            </div>
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

          {readOnly && hiddenReason && (
            <ModerationReasonBanner id={hiddenReasonId} variant="alert" reason={hiddenReason} />
          )}

          <QuestionAnswerSummary
            stemNode={stemNode}
            correctAnswerNode={correctAnswerNode}
            outcome={outcome}
            questionType={questionType}
            choiceNodes={choiceNodes}
            subItemNodes={subItemNodes}
            subAnswers={subAnswers}
            essayAnswerNode={essayAnswerNode}
          />

          {readOnly ? (
            <div>{noteNode}</div>
          ) : (
            <>
              <NoteEditor
                id={textareaId}
                value={draft}
                onChange={setDraft}
                disabled={saving}
                invalid={!!error}
                describedById={error ? `${textareaId}-error` : undefined}
                autoFocus
              />
              {error && (
                <p id={`${textareaId}-error`} role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <div className="sticky bottom-0 flex flex-col gap-2 bg-background pt-1 sm:flex-row-reverse">
                <Button
                  type="button"
                  aria-busy={saving || undefined}
                  aria-disabled={saving || undefined}
                  onClick={() => {
                    if (!saving) void onSave(draft);
                  }}
                >
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
                {!isLast && (
                  <Button
                    type="button"
                    variant="secondary"
                    aria-busy={saving || undefined}
                    aria-disabled={saving || undefined}
                    onClick={() => {
                      if (!saving) void onSaveAndNext(draft);
                    }}
                  >
                    {t("solutions.note.saveNext", { number: questionNumber + 1 })}
                  </Button>
                )}
              </div>
            </>
          )}
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
          onClose();
        }}
        onCancel={() => setDirtyOpen(false)}
        onConfirm={confirmDirtySave}
      />
    </>
  );
}
