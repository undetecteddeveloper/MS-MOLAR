"use client";

// ReviewScreen — container S-03 review & edit (UI Spec §ReviewScreen / Task 6.4
// + v2.2 M7). Giữ bản sao AssembledExam sửa được; validate LIVE bằng
// validateAssembledExam + validateMetaForPublish (thuần, client-safe) để
// bật/tắt Publish + đổ ExtractionErrorPanel. Save → saveExam (persist nháp/đề
// published). Publish → save trước rồi publishExam (server tự gate lại — nút
// disable chỉ là UX).
//
// v2.2 (ADR-0007):
//   - Khối metadata SỬA ĐƯỢC (MetadataFields) thay summary read-only; subject/
//     grade sửa được khi CHƯA publish (server cascade topic).
//   - Marker "lấy từ file của bạn" trên field AI điền chưa chạm — session-
//     derived từ ?src=auto (O-7/TBD-07: reload mất marker là chủ đích); sửa
//     field nào marker field đó biến mất.
//   - Lỗi META_* sort TRƯỚC lỗi từng câu, link tới #exam-details.
//
// B1 (biểu điểm): gate tổng điểm nằm HOÀN TOÀN ở server (validatePointsForPublish
// trong publishExam) — màn này cố ý KHÔNG tính tổng điểm chạy, vì một con số
// "7.75/10" nhấp nháy bên cạnh 40 ô nhập là lời hối thúc suốt buổi soát đề chứ
// không phải thông tin. Đổi lại, lỗi server trả về lúc bấm Publish phải hiện
// ĐẦY ĐỦ: trước bản này chỉ `message` được hiển thị còn mảng `errors` bị vứt,
// nên tác giả nhận đúng một dòng "Fix these issues" mà không biết issue nào.
//
// Theme "Sân trường" (2026-09-09): PageHeader chuẩn (breadcrumbs Đề của tôi /
// tên đề, huy hiệu trạng thái ở hàng tiêu đề, số câu làm mô tả) thay liên kết
// "← Đề của tôi" + h1 trơn; khối thông tin đề và bài đọc là thẻ surface; hết
// hộp viền 4px. Nút "Xoá đề này" rời PublishBar xuống CHÂN TRANG, sau một kẻ
// chia chạy hết bề ngang — cùng lối với "báo cáo đề" ở chi tiết đề: hành động
// phá huỷ đứng một mình, xa nút Xuất bản, và thanh dính đáy chỉ còn hai nút
// nên đứng vừa 360px.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveExam, publishExam } from "@/features/authoring/actions";
import { t } from "@/lib/copy";
import { validateAssembledExam } from "@/lib/ugc/assembleExam";
import { LIMITS } from "@/lib/ugc/limits";
import { validateMetaForPublish } from "@/lib/ugc/normalizeMeta";
import type {
  AssembledExam,
  AssembledQuestion,
  MetaFieldName,
  SaveExamPatch,
  UgcError,
} from "@/lib/ugc/types";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/features/authoring/components/StatusBadge";
import { DeleteDialog } from "@/features/authoring/components/DeleteDialog";
import { ExtractionErrorPanel } from "@/features/authoring/components/ExtractionErrorPanel";
import { AssembledQuestionList } from "@/features/authoring/components/AssembledQuestionList";
import {
  MetadataFields,
  type ExamMetaFormValue,
} from "@/features/authoring/components/MetadataFields";
import { PointsPanel, type PointsAssignment } from "@/features/authoring/components/PointsPanel";
import { PublishBar } from "@/features/authoring/components/PublishBar";
import type { ReviewNodes } from "@/features/authoring/components/reviewNodes.types";

interface ReviewScreenProps {
  examId: string;
  status: string;
  initialExam: AssembledExam;
  /** v2.2: phiên đến từ extract Automatic (?src=auto) — bật marker AI. */
  srcAuto?: boolean;
  /**
   * Nội dung câu hỏi mà SERVER đã render sẵn từ `initialExam` (TD-027).
   *
   * Nó khớp với `initialExam`, KHÔNG khớp với `exam` trong state — và đó là
   * chủ đích: mỗi chỗ hiển thị tự so chuỗi của mình với chuỗi đã dựng ra node
   * (`RenderedText.source`) rồi quyết định dùng lại hay dựng lại. Nhờ vậy
   * component này không phải theo dõi "câu nào đã bị sửa" — một trạng thái
   * thứ hai song song với `exam` thì chỉ có thể lệch pha.
   */
  nodes?: ReviewNodes;
  /** Cờ chấm tự luận — đọc ở server (page), chỉ đi ngang qua đây (Task E4). */
  essayGradingEnabled?: boolean;
}

/** State → SaveExamPatch. v2.2: subject/grade gửi kèm khi CHƯA publish (server
 * từ chối nếu đề đã publish). id composite `p{part}q{n}`; true_false gửi
 * subItems + subAnswers; short_answer dùng essayAnswer. */
function toPatch(examId: string, exam: AssembledExam, isPublished: boolean): SaveExamPatch {
  return {
    meta: {
      title: exam.meta.title,
      ...(!isPublished && { subject: exam.meta.subject, grade: exam.meta.grade }),
      durationMinutes: exam.meta.durationMinutes,
      school: exam.meta.school ?? null,
      schoolYear: exam.meta.schoolYear ?? null,
      semester: exam.meta.semester ?? null,
    },
    questions: exam.questions.map((q) => ({
      id: `${examId}-p${q.part}q${q.number}`,
      stem: q.stem,
      choices: q.choices,
      subItems: q.subItems,
      correctAnswer: q.correctAnswer ?? null,
      subAnswers: q.subAnswers ?? null,
      essayAnswer: q.essayAnswer ?? null,
      imageUrl: q.imageUrl ?? null,
      passageId: q.passageId ?? null,
      points: q.points ?? null,
    })),
    passages: exam.passages,
    parts: exam.parts,
  };
}

/** ExamMeta (sentinel ""/0) → giá trị form chuỗi (sentinel → ""). */
function toFormValue(exam: AssembledExam): ExamMetaFormValue {
  const m = exam.meta;
  return {
    title: m.title,
    subject: m.subject,
    grade: m.grade === 0 ? "" : String(m.grade),
    durationMinutes: m.durationMinutes === 0 ? "" : String(m.durationMinutes),
    school: m.school ?? "",
    schoolYear: m.schoolYear === undefined ? "" : String(m.schoolYear),
    semester: m.semester ?? "",
  };
}

const META_FIELDS: MetaFieldName[] = [
  "title",
  "subject",
  "grade",
  "durationMinutes",
  "school",
  "schoolYear",
  "semester",
];

export function ReviewScreen({
  examId,
  status: initialStatus,
  initialExam,
  srcAuto,
  nodes,
  essayGradingEnabled = false,
}: ReviewScreenProps) {
  const [exam, setExam] = useState<AssembledExam>(initialExam);
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);
  // Lỗi do SERVER trả về lúc bấm Publish — thứ client không tự tính được (gate
  // biểu điểm B1). Xoá ngay khi tác giả sửa bất cứ thứ gì: một danh sách lỗi
  // chụp từ lần bấm trước sẽ nói sai về đề hiện tại.
  const [publishErrors, setPublishErrors] = useState<UgcError[]>([]);
  // Marker "lấy từ file của bạn": field có giá trị khi đến từ Automatic, chưa chạm.
  const [aiFilled, setAiFilled] = useState<ReadonlySet<MetaFieldName>>(() => {
    if (!srcAuto) return new Set();
    const v = toFormValue(initialExam);
    return new Set(META_FIELDS.filter((f) => v[f] !== ""));
  });
  const router = useRouter();

  // v2.2: lỗi metadata sort TRƯỚC lỗi câu hỏi (gate toàn đề); status
  // review/failed chỉ theo lỗi CÂU HỎI (metadata thiếu vẫn là 'review').
  const questionErrors = validateAssembledExam(exam);
  const metaErrors = validateMetaForPublish(exam.meta);
  const errors = [...metaErrors, ...questionErrors];
  // Những gì tác giả THẤY = lỗi client tính live + lỗi server vừa từ chối
  // publish. Cùng một mảng đi vào cả bảng lỗi lẫn danh sách câu, nên lỗi biểu
  // điểm cũng tô được đúng thẻ câu như mọi lỗi khác.
  const shownErrors = [...errors, ...publishErrors];
  const isPublished = status === "published";
  const canPublish = errors.length === 0;
  const busy = saving || publishing;

  // v2.1: danh tính câu = (part, number) — "Câu 1" các phần khác nhau độc lập.
  function onChangeQuestion(part: number, number: number, patch: Partial<AssembledQuestion>) {
    setDirty(true);
    setPublishErrors([]);
    setExam((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.part === part && q.number === number ? { ...q, ...patch } : q
      ),
    }));
  }

  /** A1 — sửa nội dung một ngữ liệu dùng chung. Sửa THEO ID chứ không theo chỉ
   *  số: `AssembledQuestion.passageId` trỏ bằng id, nên một thao tác đánh theo
   *  vị trí sẽ âm thầm đổi bài đọc của nhóm câu khác nếu mảng từng đổi thứ tự. */
  function onChangePassage(id: string, text: string) {
    setDirty(true);
    setPublishErrors([]);
    setExam((prev) => ({
      ...prev,
      passages: prev.passages.map((p) => (p.id === id ? { ...p, text } : p)),
    }));
  }

  /** Sửa tiêu đề MỘT phần. Chuỗi rỗng ⇒ GỠ khai báo chứ không lưu tiêu đề rỗng:
   *  "không khai" và "khai một chuỗi rỗng" phải là cùng một trạng thái, nếu
   *  không thì heading hiện nhãn mặc định trong khi DB vẫn mang một entry, và
   *  cổng validate của saveExam từ chối tiêu đề rỗng.
   *
   *  ⚠ Đề KHÔNG chia phần mà tác giả đặt tiêu đề cho nhóm duy nhất của nó ⇒
   *  `parts` từ rỗng thành một phần tử, tức đề đó trở thành "nhiều phần" theo
   *  `isMultiPart`. Hệ quả CÓ CHỦ Ý và cần biết: màn làm bài cũng in tiêu đề đó
   *  (ExamPlayer.tsx:100 đọc cùng mảng), và nhãn lỗi đổi từ "Câu 5" thành
   *  "Phần 1 Câu 5". Cả hai đều là điều tác giả vừa yêu cầu khi họ gõ đúng cái
   *  tiêu đề in trên đề gốc vào đấy. */
  function onChangePartTitle(part: number, title: string) {
    setDirty(true);
    setPublishErrors([]);
    setExam((prev) => {
      const trimmed = title.trim();
      const rest = prev.parts.filter((p) => p.number !== part);
      const parts =
        trimmed === ""
          ? rest
          : [...rest, { number: part, title: trimmed }].sort((a, b) => a.number - b.number);
      return { ...prev, parts };
    });
  }

  /** Panel gán điểm — ghi nhiều câu trong MỘT lượt `setExam`.
   *
   *  Một lượt chứ không phải N lượt `onChangeQuestion`: mỗi lượt đọc `prev` của
   *  lượt trước, nên một vòng lặp gọi N lần vẫn ĐÚNG, nhưng nó dựng N bản sao
   *  mảng câu hỏi cho một thao tác logic duy nhất, và làm cho "áp biểu điểm"
   *  không còn là một bước undo được bằng một lần Ctrl+Z ở tầng nào cả. */
  function onApplyPoints(assignments: PointsAssignment[]) {
    if (assignments.length === 0) return;
    setDirty(true);
    setPublishErrors([]);
    const byKey = new Map(assignments.map((a) => [`${a.part}:${a.number}`, a.points]));
    setExam((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        const points = byKey.get(`${q.part}:${q.number}`);
        return points === undefined ? q : { ...q, points };
      }),
    }));
  }

  /** Sửa metadata: parse chuỗi form → ExamMeta (rỗng/không hợp lệ → sentinel
   * ""/0 — server cùng quy ước); field vừa chạm mất marker AI. */
  function onChangeMeta(patch: Partial<ExamMetaFormValue>) {
    setDirty(true);
    setPublishErrors([]);
    if (aiFilled.size > 0) {
      const next = new Set(aiFilled);
      for (const key of Object.keys(patch) as MetaFieldName[]) next.delete(key);
      setAiFilled(next);
    }
    setExam((prev) => {
      const meta = { ...prev.meta };
      if (patch.title !== undefined) meta.title = patch.title;
      if (patch.subject !== undefined) meta.subject = patch.subject;
      if (patch.grade !== undefined) {
        const g = Number.parseInt(patch.grade, 10);
        meta.grade = Number.isInteger(g) && g > 0 ? g : 0;
      }
      if (patch.durationMinutes !== undefined) {
        const d = Number.parseInt(patch.durationMinutes, 10);
        meta.durationMinutes = Number.isInteger(d) && d > 0 ? d : 0;
      }
      if (patch.school !== undefined)
        meta.school = patch.school.trim() === "" ? undefined : patch.school;
      if (patch.schoolYear !== undefined) {
        const y = Number.parseInt(patch.schoolYear, 10);
        meta.schoolYear = Number.isInteger(y) ? y : undefined;
      }
      if (patch.semester !== undefined) {
        meta.semester =
          patch.semester === "HK1" || patch.semester === "HK2" ? patch.semester : undefined;
      }
      return { ...prev, meta };
    });
  }

  async function persist(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const result = await saveExam(examId, toPatch(examId, exam, isPublished));
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      setFieldErrors(result.error.fieldErrors);
      return false;
    }
    setFieldErrors(undefined);
    setDirty(false);
    // Đề chưa published: status đổi review↔failed CHỈ theo lỗi câu hỏi —
    // metadata thiếu vẫn là 'review' (gate nằm ở publish, ADR-0007).
    if (!isPublished) setStatus(questionErrors.length > 0 ? "failed" : "review");
    router.refresh();
    return true;
  }

  async function onPublish() {
    if (!canPublish) return;
    setPublishing(true);
    setError(null);
    setPublishErrors([]);
    // Lưu chỉnh sửa trước (publishExam validate từ DB — gate server là thật).
    const saved = await saveExam(examId, toPatch(examId, exam, isPublished));
    if (saved.error) {
      setPublishing(false);
      setError(saved.error.message);
      setFieldErrors(saved.error.fieldErrors);
      setPublishErrors(saved.error.errors ?? []);
      return;
    }
    const result = await publishExam(examId);
    setPublishing(false);
    if (result.error) {
      setError(result.error.message);
      setPublishErrors(result.error.errors ?? []);
      return;
    }
    router.push("/me/exams?published=1");
    router.refresh();
  }

  const title = exam.meta.title.trim() === "" ? t("upload.untitledExam") : exam.meta.title;
  const questionCount =
    exam.questions.length === 1
      ? t("upload.oneQuestion")
      : t("upload.questionCount", { count: exam.questions.length });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[{ label: t("common.myExams"), href: "/me/exams" }, { label: title }]}
        title={title}
        description={
          isPublished ? `${questionCount}. ${t("upload.publishedNotice")}` : questionCount
        }
        actions={<StatusBadge status={status} on="background" />}
      />

      <ExtractionErrorPanel errors={shownErrors} />

      {/* v2.2: khối metadata sửa được — anchor cho link lỗi META_*. */}
      <Card
        as="section"
        id="exam-details"
        aria-labelledby="exam-details-heading"
        className="scroll-mt-24"
      >
        <h2 id="exam-details-heading" className="text-lg font-semibold">
          {t("upload.examDetails")}
        </h2>
        <MetadataFields
          value={toFormValue(exam)}
          onChange={onChangeMeta}
          fieldErrors={fieldErrors}
          disabled={busy}
          aiFilled={aiFilled}
        />
        {isPublished && (
          <p className="text-muted-foreground text-sm">{t("upload.fixedAfterPublish")}</p>
        )}
      </Card>

      {/* A1 — ngữ liệu dùng chung, sửa được MỘT chỗ cho cả nhóm câu. Đặt TRÊN
          danh sách câu vì đó là thứ tự đọc của đề gốc, và vì sửa ở đây ảnh
          hưởng nhiều câu bên dưới. */}
      {exam.passages.length > 0 && (
        <Card as="section" aria-labelledby="passages-heading" className="gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="passages-heading" className="text-lg font-semibold">
              {t("upload.sharedPassages")}
            </h2>
            <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
              {t("upload.sharedPassagesHint")}
            </p>
          </div>
          {exam.passages.map((p, i) => (
            <div key={p.id}>
              <Label htmlFor={`passage-${p.id}`}>
                {p.title ?? t("upload.passageLabel", { index: i + 1 })}
              </Label>
              <Textarea
                id={`passage-${p.id}`}
                value={p.text}
                onChange={(e) => onChangePassage(p.id, e.target.value)}
                maxLength={LIMITS.MAX_PASSAGE}
                rows={8}
                disabled={busy}
                className="resize-y text-sm"
              />
            </div>
          ))}
        </Card>
      )}

      <AssembledQuestionList
        questions={exam.questions}
        parts={exam.parts}
        errors={shownErrors}
        onChangeQuestion={onChangeQuestion}
        onChangePartTitle={onChangePartTitle}
        nodes={nodes}
        subject={exam.meta.subject}
        essayGradingEnabled={essayGradingEnabled}
        disabled={busy}
      />

      {/* Panel gán điểm — chỉ dựng khi đề CÓ câu: trên một đề rỗng nó không có
          phạm vi nào để chọn, và một panel với dropdown trống là một câu hỏi
          không trả lời được đặt cạnh lỗi NO_QUESTIONS_FOUND. */}
      {exam.questions.length > 0 && (
        <PointsPanel
          questions={exam.questions}
          parts={exam.parts}
          onApply={onApplyPoints}
          disabled={busy}
        />
      )}

      {/* Xoá đề: dòng khép trang sau một kẻ chia hết bề ngang (cùng lối với
          "báo cáo đề" ở chi tiết đề) — đứng TRƯỚC thanh dính đáy trong DOM để
          thanh luôn là phần tử cuối của trang.

          `pb-24`: khoảng đệm để dòng này CUỘN LÊN ĐƯỢC khỏi dải cố định (bảng
          điểm + nút hỗ trợ, cao 56px, chân cách thanh hành động ~20px). Đo
          2026-09-09 ở 360px: không đệm thì ở cuối trang liên kết dừng đúng
          dưới bảng điểm và không bấm được — Playwright báo "subtree intercepts
          pointer events", trên điện thoại là một liên kết chết.

          Căn TRÁI (quy tắc §3), không căn giữa như "báo cáo đề": từ 768px bảng
          điểm MỞ SẴN và neo góc phải, cao ~300px — một liên kết căn giữa ở cuối
          trang 768 nằm đúng dưới nó (đo 2026-09-09: click hết hạn 30s), còn ở
          mép trái thì không có gì che. */}
      <div className="border-border flex border-t pt-4 pb-24">
        <DeleteDialog
          examId={examId}
          examTitle={title}
          triggerVariant="link"
          triggerLabel={t("upload.deleteExam")}
        />
      </div>

      <PublishBar
        isPublished={isPublished}
        canPublish={canPublish}
        saving={saving}
        publishing={publishing}
        dirty={dirty}
        error={error}
        onSave={persist}
        onPublish={onPublish}
      />
    </div>
  );
}
