"use client";

// SolutionEditorScreen — khung màn viết (S-04, UI Spec § Component:
// SolutionEditorScreen). Giữ toàn bộ trạng thái draft qua MỘT `useReducer` có
// khoá theo chỉ số câu (frontend DD § Note-authoring contract, § Client State
// Design "Temporary state"): lưu một ghi chú chỉ cập nhật đúng hàng đó + thanh
// tiến độ + thanh đáy, KHÔNG render lại cả danh sách (NFR Hiệu năng,
// prd.md:511) — `NoteQuestionRow` được bọc `React.memo` NGAY TẠI ĐÂY (không
// sửa file gốc của task 09) và mỗi hàng nhận một `onOpen` ỔN ĐỊNH qua chỉ số
// (cache theo `useMemo`, không tạo closure mới mỗi lượt render) để việc bọc
// memo có tác dụng.
//
// Publish KHÔNG lạc quan (§ State Transitions): huy hiệu/thanh đáy chỉ đổi
// SAU KHI `setSolutionStatus()` trả `{ ok: true }` (AC-029's all-or-nothing
// phải NHÌN THẤY được, không phải giả định).
//
// GIÀN GIÁO TẠM (Unimplemented Dependency Handling — NoteSheet là task 11,
// chưa tồn tại lúc file này được viết). `NoteQuestionRow.onOpen` mở một khối
// sửa ghi chú TỐI GIẢN ngay dưới đây (chỉ `<textarea>` + Lưu/Đóng, không
// RichText/FormulaPreview/hộp thoại dirty-close AC-104) — đủ để giữ đúng hợp
// đồng "lưu một ghi chú giữ nguyên chữ khi lỗi" (Reference Contract #7) và
// "lưu ghi chú i chỉ re-render hàng i" (NFR Hiệu năng proxy) trong lúc chờ
// task 11. Task 11 thay khối này bằng `<NoteSheet>` thật, dùng lại đúng
// `state.activeNote`/`saveNote()` bên dưới — không có UI Spec/AC nào tả hình
// dạng của giàn giáo này vì nó không phải là O-01 thật.
//
// `stem`/`correctAnswer`/`myResult` (SolutionEditorQuestion, queries.ts) ở lại
// dạng `unknown` CHƯA RENDER trong toàn bộ file này — cùng quyết định "scope-
// narrowing concretization" mà backend task 04's Investigation Notes đã ghi:
// không Investigation Target/Required test/Reference Contract nào của task 10
// chạm tới việc dựng ReactNode cho ba trường này (không hàng câu, không giàn
// giáo ghi chú nào ở đây hiển thị đề câu/đáp án) — việc dựng UI-D22 dời sang
// task đầu tiên thực sự hiển thị chúng (task 11's `QuestionAnswerSummary`).

import { memo, useCallback, useId, useMemo, useReducer, useState } from "react";
import { t, type MessageKey } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card } from "@/components/ui/card";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { countWords } from "@/lib/solutions/countWords";
import {
  saveSolution,
  setSolutionStatus,
  type SaveSolutionPatch,
  type SaveSolutionResult,
  type SetSolutionStatusResult,
} from "@/features/solutions/actions";
import type { SolutionEditorQuestion, SolutionEditorState, SolutionStatus } from "@/features/solutions/queries";
import { SolutionEditorHeader } from "@/features/solutions/components/SolutionEditorHeader";
import { SolutionSettingsPanel } from "@/features/solutions/components/SolutionSettingsPanel";
import { NoteQuestionRow, type NoteRowState } from "@/features/solutions/components/NoteQuestionRow";
import { SolutionPublishBar } from "@/features/solutions/components/SolutionPublishBar";
import { ModerationReasonBanner } from "@/features/solutions/components/ModerationReasonBanner";

// Bọc TẠI ĐÂY, không sửa NoteQuestionRow.tsx (ngoài Target Files task 10) —
// hàng chỉ re-render khi PROPS của chính nó đổi (mọi prop dưới đây là
// primitive, so bằng giá trị; xem `onOpen` ổn định ở dưới).
const MemoNoteQuestionRow = memo(NoteQuestionRow);

interface EditorQuestion extends SolutionEditorQuestion {
  savingNote: boolean;
  noteError: string | null;
}

interface EditorState {
  attemptId: string;
  solutionId: string | null;
  status: SolutionStatus | null;
  showProfile: boolean;
  showScore: boolean;
  hiddenReason?: string;
  questions: EditorQuestion[];
  activeNote: number | null;
  saving: boolean;
  publishing: boolean;
  barError: string | null;
  settingsSaving: boolean;
  settingsError: string | null;
  unpublishOpen: boolean;
  unpublishError: string | null;
  toastKey: MessageKey | null;
  toastTrigger: number;
  liveMessage: string;
}

type EditorAction =
  | { type: "SAVE_DRAFT_START" }
  | { type: "SAVE_DRAFT_SUCCESS"; status: SolutionStatus }
  | { type: "SAVE_DRAFT_FAILURE"; error: string }
  | { type: "PUBLISH_START" }
  | { type: "PUBLISH_SUCCESS" }
  | { type: "PUBLISH_FAILURE"; error: string }
  | { type: "UNPUBLISH_OPEN" }
  | { type: "UNPUBLISH_CANCEL" }
  | { type: "UNPUBLISH_SUCCESS" }
  | { type: "UNPUBLISH_FAILURE"; error: string }
  | { type: "SETTINGS_CHANGE_START"; field: "showProfile" | "showScore"; next: boolean }
  | { type: "SETTINGS_CHANGE_SUCCESS" }
  | { type: "SETTINGS_CHANGE_FAILURE"; error: string; prevShowProfile: boolean; prevShowScore: boolean }
  | { type: "OPEN_NOTE"; index: number }
  | { type: "CLOSE_NOTE" }
  | { type: "NOTE_SAVE_START"; index: number }
  | { type: "NOTE_SAVE_SUCCESS"; index: number; note: string }
  | { type: "NOTE_SAVE_FAILURE"; index: number; error: string };

function initEditorState(initial: SolutionEditorState): EditorState {
  return {
    attemptId: initial.attemptId,
    solutionId: initial.solutionId,
    status: initial.status,
    showProfile: initial.showProfile,
    showScore: initial.showScore,
    hiddenReason: initial.hiddenReason,
    questions: initial.questions.map((q) => ({ ...q, savingNote: false, noteError: null })),
    activeNote: null,
    saving: false,
    publishing: false,
    barError: null,
    settingsSaving: false,
    settingsError: null,
    unpublishOpen: false,
    unpublishError: null,
    toastKey: null,
    toastTrigger: 0,
    liveMessage: "",
  };
}

/** Reducer thuần — export để test đơn vị hoá được, không chỉ qua render đầy
 *  đủ (mọi nhánh chỉ thay object của ĐÚNG chỉ số bị đổi, giữ nguyên tham
 *  chiếu mọi phần tử khác, đây chính là cơ chế đứng sau NFR Hiệu năng). */
export function solutionEditorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SAVE_DRAFT_START":
      return { ...state, saving: true, barError: null };
    case "SAVE_DRAFT_SUCCESS":
      return {
        ...state,
        saving: false,
        status: action.status,
        toastKey: "solutions.toast.saved",
        toastTrigger: state.toastTrigger + 1,
        liveMessage: t("solutions.toast.saved"),
      };
    case "SAVE_DRAFT_FAILURE":
      return { ...state, saving: false, barError: action.error };
    case "PUBLISH_START":
      return { ...state, publishing: true, barError: null };
    case "PUBLISH_SUCCESS":
      return {
        ...state,
        publishing: false,
        status: "published",
        toastKey: "solutions.toast.published",
        toastTrigger: state.toastTrigger + 1,
        liveMessage: t("solutions.toast.published"),
      };
    case "PUBLISH_FAILURE":
      return { ...state, publishing: false, barError: action.error };
    case "UNPUBLISH_OPEN":
      return { ...state, unpublishOpen: true, unpublishError: null };
    case "UNPUBLISH_CANCEL":
      return { ...state, unpublishOpen: false, unpublishError: null };
    case "UNPUBLISH_SUCCESS":
      return { ...state, unpublishOpen: false, unpublishError: null, status: "draft" };
    case "UNPUBLISH_FAILURE":
      return { ...state, unpublishError: action.error };
    case "SETTINGS_CHANGE_START":
      return {
        ...state,
        settingsSaving: true,
        settingsError: null,
        showProfile: action.field === "showProfile" ? action.next : state.showProfile,
        showScore: action.field === "showScore" ? action.next : state.showScore,
      };
    case "SETTINGS_CHANGE_SUCCESS":
      return { ...state, settingsSaving: false, settingsError: null };
    case "SETTINGS_CHANGE_FAILURE":
      return {
        ...state,
        settingsSaving: false,
        settingsError: action.error,
        showProfile: action.prevShowProfile,
        showScore: action.prevShowScore,
      };
    case "OPEN_NOTE":
      return { ...state, activeNote: action.index };
    case "CLOSE_NOTE":
      return { ...state, activeNote: null };
    case "NOTE_SAVE_START":
      return {
        ...state,
        questions: state.questions.map((q, i) =>
          i === action.index ? { ...q, savingNote: true, noteError: null } : q
        ),
      };
    case "NOTE_SAVE_SUCCESS":
      return {
        ...state,
        activeNote: null,
        toastKey: "solutions.toast.saved",
        toastTrigger: state.toastTrigger + 1,
        liveMessage: t("solutions.toast.saved"),
        questions: state.questions.map((q, i) =>
          i === action.index
            ? { ...q, note: action.note, wordCount: countWords(action.note), savingNote: false, noteError: null }
            : q
        ),
      };
    case "NOTE_SAVE_FAILURE":
      return {
        ...state,
        questions: state.questions.map((q, i) =>
          i === action.index ? { ...q, savingNote: false, noteError: action.error } : q
        ),
      };
    default:
      return state;
  }
}

/** Trạng thái hiển thị của một hàng (UI-D7/UI-D26) — "changed" thắng mọi thứ
 *  khác (AC-045), rồi mới xét đủ/thiếu 15 từ (client mirror, § Note-authoring
 *  contract: "the client-side word counter... use the SAME countWords()"). */
function deriveRowState(q: EditorQuestion): NoteRowState {
  if (q.hasChanged) return "changed";
  if (q.wordCount >= 15) return "noted";
  if (q.wordCount === 0) return "missing";
  return "short";
}

function noteExcerpt(note: string): string | undefined {
  const firstLine = note.split("\n")[0]?.trim();
  return firstLine ? firstLine : undefined;
}

function saveErrorText(error: Extract<SaveSolutionResult, { ok: false }>["error"]): string {
  switch (error.code) {
    case "belowWordCount":
      return t("solutions.note.tooShortPublished");
    case "rateLimited":
      return t("profile.error.rateLimited", { seconds: error.seconds });
    case "generic":
      return t("solutions.note.saveError");
  }
}

function settingsErrorText(error: Extract<SaveSolutionResult, { ok: false }>["error"]): string {
  if (error.code === "rateLimited") return t("profile.error.rateLimited", { seconds: error.seconds });
  return t("solutions.editor.settingsSaveError");
}

function publishErrorText(
  error: Extract<SetSolutionStatusResult, { ok: false }>["error"],
  questionCount: number
): string {
  switch (error.code) {
    case "belowWordCount":
      return t("solutions.bar.remaining", { count: error.missingCount, total: questionCount });
    case "rateLimited":
      return t("profile.error.rateLimited", { seconds: error.seconds });
    case "generic":
      return t("solutions.note.saveError");
  }
}

interface NoteEditorScaffoldProps {
  questionNumber: number;
  note: string;
  saving: boolean;
  error: string | null;
  onSave: (body: string) => void;
  onClose: () => void;
}

/** Giàn giáo tối giản — xem ghi chú đầu file. `key` gắn ở nơi gọi buộc React
 *  gắn state cục bộ (`draft`) LẠI mỗi lần đổi câu đang mở, tránh chữ của câu
 *  trước rò sang câu sau. */
function NoteEditorScaffold({ questionNumber, note, saving, error, onSave, onClose }: NoteEditorScaffoldProps) {
  const [draft, setDraft] = useState(note);
  const textareaId = useId();

  return (
    <Card padding="compact" className="gap-2">
      <label htmlFor={textareaId} className="text-sm font-medium">
        {t("upload.questionLabel", { number: questionNumber })}
      </label>
      <textarea
        id={textareaId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className="border-input bg-background focus-visible:ring-ring/40 w-full rounded-lg border p-2 text-sm focus-visible:ring-3 focus-visible:outline-none"
      />
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          aria-busy={saving || undefined}
          onClick={() => onSave(draft)}
          className="bg-primary text-primary-foreground min-h-11 flex-1 rounded-lg text-sm font-medium aria-busy:opacity-60"
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="border-border min-h-11 flex-1 rounded-lg border text-sm font-medium"
        >
          {t("common.close")}
        </button>
      </div>
    </Card>
  );
}

export interface SolutionEditorScreenProps {
  examId: string;
  initialState: SolutionEditorState;
}

export function SolutionEditorScreen({ examId, initialState }: SolutionEditorScreenProps) {
  const [state, dispatch] = useReducer(solutionEditorReducer, initialState, initEditorState);
  const lockReasonId = useId();

  // Ổn định theo chỉ số — `dispatch` bản thân KHÔNG đổi giữa các lượt render
  // (React đảm bảo cho `useReducer`), nên mảng closure này chỉ dựng lại khi
  // SỐ CÂU đổi (không đổi phía client), giữ `onOpen` của mọi hàng đứng yên để
  // `React.memo` phát huy tác dụng (NFR Hiệu năng).
  const openHandlers = useMemo(
    () => state.questions.map((_, index) => () => dispatch({ type: "OPEN_NOTE", index })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chủ ý chỉ phụ thuộc độ dài, xem ghi chú trên
    [state.questions.length]
  );

  const closeNote = useCallback(() => dispatch({ type: "CLOSE_NOTE" }), []);

  async function handleSaveDraft() {
    dispatch({ type: "SAVE_DRAFT_START" });
    const patch: SaveSolutionPatch = {
      attemptId: state.attemptId,
      showProfile: state.showProfile,
      showScore: state.showScore,
      notes: state.questions.map((q) => ({ questionId: q.questionId, body: q.note })),
    };
    const result = await saveSolution(examId, patch);
    if (result.ok) {
      dispatch({ type: "SAVE_DRAFT_SUCCESS", status: result.status });
    } else {
      dispatch({ type: "SAVE_DRAFT_FAILURE", error: saveErrorText(result.error) });
    }
  }

  async function handlePublish() {
    dispatch({ type: "PUBLISH_START" });
    const result = await setSolutionStatus(examId, "publish");
    if (result.ok) {
      dispatch({ type: "PUBLISH_SUCCESS" });
    } else {
      dispatch({ type: "PUBLISH_FAILURE", error: publishErrorText(result.error, state.questions.length) });
    }
  }

  async function handleConfirmUnpublish() {
    const result = await setSolutionStatus(examId, "draft");
    if (result.ok) {
      dispatch({ type: "UNPUBLISH_SUCCESS" });
    } else {
      dispatch({ type: "UNPUBLISH_FAILURE", error: publishErrorText(result.error, state.questions.length) });
    }
  }

  async function handleSwitchChange(field: "showProfile" | "showScore", next: boolean) {
    const prevShowProfile = state.showProfile;
    const prevShowScore = state.showScore;
    dispatch({ type: "SETTINGS_CHANGE_START", field, next });
    const patch: SaveSolutionPatch = {
      attemptId: state.attemptId,
      showProfile: field === "showProfile" ? next : state.showProfile,
      showScore: field === "showScore" ? next : state.showScore,
      notes: [],
    };
    const result = await saveSolution(examId, patch);
    if (result.ok) {
      dispatch({ type: "SETTINGS_CHANGE_SUCCESS" });
    } else {
      dispatch({
        type: "SETTINGS_CHANGE_FAILURE",
        error: settingsErrorText(result.error),
        prevShowProfile,
        prevShowScore,
      });
    }
  }

  async function saveNote(index: number, body: string) {
    const question = state.questions[index];
    dispatch({ type: "NOTE_SAVE_START", index });
    const patch: SaveSolutionPatch = {
      attemptId: state.attemptId,
      showProfile: state.showProfile,
      showScore: state.showScore,
      notes: [{ questionId: question.questionId, body }],
    };
    const result = await saveSolution(examId, patch);
    if (result.ok) {
      dispatch({ type: "NOTE_SAVE_SUCCESS", index, note: body });
    } else {
      dispatch({ type: "NOTE_SAVE_FAILURE", index, error: saveErrorText(result.error) });
    }
  }

  const rowStates = state.questions.map(deriveRowState);
  const totalCount = state.questions.length;
  // Cổng đăng (AC-028/029) là GƯƠNG CLIENT của luật server — chỉ đếm theo số
  // từ, không theo "đã thay đổi" (SolutionPublishBar's own doc comment: "chỉ
  // là gương phía client của luật server (phòng thủ, không phải nguồn thật)").
  const incompleteCount = state.questions.filter((q) => q.wordCount < 15).length;
  const hidden = state.status === "hidden";

  return (
    <PageContainer as="main" size="small" padding="none" className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumbs
        className="text-xs"
        items={[{ label: t("nav.exams"), href: "/exams" }, { label: t("solutions.editor.crumb") }]}
      />

      {hidden && state.hiddenReason && (
        <ModerationReasonBanner variant="alert" reason={state.hiddenReason} id={lockReasonId} />
      )}

      <SolutionEditorHeader
        status={state.status}
        questionStates={rowStates}
        onJump={(index) => {
          const target = document.getElementById(`solution-editor-row-${index}`);
          target?.scrollIntoView({ block: "nearest" });
          target?.focus();
        }}
      />

      <SolutionSettingsPanel
        showProfile={state.showProfile}
        showScore={state.showScore}
        onShowProfileChange={(next) => void handleSwitchChange("showProfile", next)}
        onShowScoreChange={(next) => void handleSwitchChange("showScore", next)}
        busy={state.settingsSaving}
        lockReasonId={hidden ? lockReasonId : undefined}
      />
      {state.settingsError && (
        <p role="alert" className="text-destructive text-xs">
          {state.settingsError}
        </p>
      )}

      {totalCount === 0 ? (
        <Card variant="outline" padding="compact" className="border-dashed text-sm">
          {t("solutions.emptyExam")}
        </Card>
      ) : (
        <ol className="divide-border flex flex-col divide-y">
          {state.questions.map((q, index) => (
            <div key={q.questionId} id={`solution-editor-row-${index}`} tabIndex={-1}>
              <MemoNoteQuestionRow
                questionNumber={index + 1}
                state={rowStates[index]}
                excerpt={noteExcerpt(q.note)}
                onOpen={openHandlers[index]}
              />
            </div>
          ))}
        </ol>
      )}

      {state.activeNote !== null && (
        <NoteEditorScaffold
          key={state.questions[state.activeNote].questionId}
          questionNumber={state.activeNote + 1}
          note={state.questions[state.activeNote].note}
          saving={state.questions[state.activeNote].savingNote}
          error={state.questions[state.activeNote].noteError}
          onSave={(body) => void saveNote(state.activeNote as number, body)}
          onClose={closeNote}
        />
      )}

      <SolutionPublishBar
        status={state.status}
        totalCount={totalCount}
        incompleteCount={totalCount === 0 ? 1 : incompleteCount}
        saving={state.saving}
        publishing={state.publishing}
        error={totalCount === 0 ? t("solutions.emptyExam") : state.barError}
        onSaveDraft={() => void handleSaveDraft()}
        onPublish={() => void handlePublish()}
        onUnpublish={() => dispatch({ type: "UNPUBLISH_OPEN" })}
        viewHref={state.solutionId ? `/exams/${examId}/solutions/${state.solutionId}` : "#"}
      />

      <ConfirmDialog
        open={state.unpublishOpen}
        variant="confirm"
        title={t("solutions.unpublish.title")}
        body={t("solutions.unpublish.body")}
        confirmLabel={t("solutions.bar.unpublish")}
        error={state.unpublishError}
        onConfirm={handleConfirmUnpublish}
        onCancel={() => dispatch({ type: "UNPUBLISH_CANCEL" })}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {state.liveMessage}
      </div>
      <SuccessToast message={state.toastKey ? t(state.toastKey) : ""} trigger={state.toastTrigger} />
    </PageContainer>
  );
}
