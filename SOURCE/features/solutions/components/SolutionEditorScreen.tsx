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
// TASK 11: giàn giáo tạm task 10 để lại (`NoteEditorScaffold`, một
// `<textarea>` + Lưu/Đóng nội bộ) đã được thay bằng `<NoteSheet>` THẬT
// (`components/NoteSheet.tsx`) — dùng lại đúng `state.activeNote`/`saveNote()`
// bên dưới, không thêm action reducer mới ("Lưu và sang câu k+1" chỉ là gọi
// `saveNote()` rồi dispatch `OPEN_NOTE` kế tiếp, xem `saveNoteAndAdvance`).
//
// `stem`/`correctAnswer`/`myResult` (SolutionEditorQuestion, queries.ts) VẪN ở
// lại dạng `unknown` trong FILE NÀY (task 04's "scope-narrowing
// concretization" không đổi) — việc dựng ReactNode cho ba trường này
// (UI-D22) chuyển hẳn sang `writerQuestionNodes.tsx` (Server Component only,
// gọi từ `SolutionEditorPage`), qua prop MỚI, TÙY CHỌN `questionNodes` (xem
// ghi chú tại `SolutionEditorScreenProps`) — file này (client) không bao giờ
// tự gọi `RichText` (M12).

import { memo, useCallback, useId, useMemo, useReducer } from "react";
import { t, type MessageKey } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card } from "@/components/ui/card";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { countWords } from "@/lib/solutions/countWords";
import { saveErrorText } from "@/features/solutions/lib/saveErrorText";
import {
  saveSolution,
  setSolutionStatus,
  type SaveSolutionPatch,
  type SaveSolutionResult,
  type SetSolutionStatusResult,
} from "@/features/solutions/actions";
import type { SolutionEditorQuestion, SolutionEditorState, SolutionStatus } from "@/features/solutions/queries";
import type { WriterQuestionNode } from "@/features/solutions/components/writerQuestionNodes";
import { SolutionEditorHeader } from "@/features/solutions/components/SolutionEditorHeader";
import { SolutionSettingsPanel } from "@/features/solutions/components/SolutionSettingsPanel";
import { NoteQuestionRow, type NoteRowState } from "@/features/solutions/components/NoteQuestionRow";
import { NoteSheet } from "@/features/solutions/components/NoteSheet";
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
  | { type: "SAVE_DRAFT_SUCCESS"; status: SolutionStatus; solutionId: string }
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
  | { type: "NOTE_SAVE_SUCCESS"; index: number; note: string; solutionId: string }
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
        // Server-DERIVED — the first successful save is what creates the row
        // (`save_community_solution`'s upsert); this is the only place client
        // state learns the id it must later use for "Xem bài giải" (AC-030).
        solutionId: action.solutionId,
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
        // Same reason as SAVE_DRAFT_SUCCESS above — a note saved from a fresh
        // (solutionId: null) writer state is equally the first write that
        // creates the row; without this the publish bar's "Xem bài giải" link
        // stays pointed at "#" forever for anyone who never used "Lưu nháp".
        solutionId: action.solutionId,
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

/** Nút chờ khi không có node dựng sẵn (test không truyền `questionNodes` —
 *  xem ghi chú prop bên dưới). */
const EMPTY_WRITER_NODE: WriterQuestionNode = {
  questionId: "",
  stemNode: null,
  correctAnswerNode: null,
  noteNode: null,
  outcome: null,
  questionType: "mcq",
  choiceNodes: [],
  subItemNodes: [],
};

export interface SolutionEditorScreenProps {
  examId: string;
  initialState: SolutionEditorState;
  /**
   * Đề câu/đáp án đúng/ghi chú-chỉ-đọc đã dựng ReactNode phía SERVER
   * (`writerQuestionNodes.tsx`, UI-D22) — `SolutionEditorPage` (Server
   * Component) luôn truyền prop này trong production. TÙY CHỌN chỉ để không
   * phá vỡ `SolutionEditorScreen.test.tsx` hiện có (task 10, không thuộc
   * Target Files task 11): test đó dựng `SolutionEditorQuestion` thô
   * (`stem`/`correctAnswer`/`myResult: unknown`) và không biết
   * `writerQuestionNodes` — thiếu prop này chỉ khiến `NoteSheet` không có đề
   * câu/đáp án để hiện, không ảnh hưởng gì tới các assertion (ô nhập, nút Lưu,
   * hàng câu) mà test đó kiểm tra.
   */
  questionNodes?: WriterQuestionNode[];
}

export function SolutionEditorScreen({ examId, initialState, questionNodes }: SolutionEditorScreenProps) {
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
      dispatch({ type: "SAVE_DRAFT_SUCCESS", status: result.status, solutionId: result.solutionId });
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

  /** Trả về kết quả (không chỉ dispatch) để `NoteSheet` tự quyết định luồng
   *  của CHÍNH NÓ — nút "Lưu" thường (đóng nhờ `activeNote` về `null` ở nhánh
   *  NOTE_SAVE_SUCCESS bên dưới, tự nhiên qua re-render) và hộp thoại
   *  đóng-khi-còn-thay-đổi (DD-U5: đóng CẢ HAI lớp khi thành công, giữ mở +
   *  hiện lỗi khi thất bại) đều gọi lại đúng hàm này, không có đường lưu thứ
   *  hai nào khác. */
  async function saveNote(index: number, body: string): Promise<SaveSolutionResult> {
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
      dispatch({ type: "NOTE_SAVE_SUCCESS", index, note: body, solutionId: result.solutionId });
    } else {
      dispatch({ type: "NOTE_SAVE_FAILURE", index, error: saveErrorText(result.error) });
    }
    return result;
  }

  /** "Lưu và sang câu k+1" (AC-022) — KHÔNG phải một action reducer mới: gọi
   *  lại đúng `saveNote()` (đóng qua NOTE_SAVE_SUCCESS như trên) rồi, khi
   *  thành công, dispatch tiếp `OPEN_NOTE` (đã có từ task 10) cho chỉ số kế —
   *  hai dispatch trong cùng một handler gộp thành MỘT lượt render, nên
   *  `activeNote` chuyển thẳng từ k sang k+1, không có khung hình trung gian
   *  "đóng hẳn" nào lọt ra ngoài. */
  async function saveNoteAndAdvance(index: number, body: string): Promise<SaveSolutionResult> {
    const result = await saveNote(index, body);
    if (result.ok) dispatch({ type: "OPEN_NOTE", index: index + 1 });
    return result;
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

      {state.activeNote !== null &&
        (() => {
          const index = state.activeNote;
          const q = state.questions[index];
          const node = questionNodes?.[index] ?? EMPTY_WRITER_NODE;
          return (
            <NoteSheet
              key={q.questionId}
              open
              questionNumber={index + 1}
              totalCount={totalCount}
              rowState={rowStates[index]}
              readOnly={hidden}
              hiddenReason={state.hiddenReason}
              note={q.note}
              essayPrefillApplied={q.essayPrefillApplied}
              saving={q.savingNote}
              error={q.noteError}
              stemNode={node.stemNode}
              correctAnswerNode={node.correctAnswerNode}
              noteNode={node.noteNode}
              outcome={node.outcome}
              questionType={node.questionType}
              choiceNodes={node.choiceNodes}
              subItemNodes={node.subItemNodes}
              subAnswers={node.subAnswers}
              essayAnswerNode={node.essayAnswerNode}
              onSave={(body) => saveNote(index, body)}
              onSaveAndNext={(body) => saveNoteAndAdvance(index, body)}
              onClose={closeNote}
            />
          );
        })()}

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
