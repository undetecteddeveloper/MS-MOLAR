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
//   - Marker "from your file" trên field AI điền chưa chạm — session-derived
//     từ ?src=auto (O-7/TBD-07: reload mất marker là chủ đích); sửa field nào
//     marker field đó biến mất.
//   - Lỗi META_* sort TRƯỚC lỗi từng câu, link tới #exam-details.
//
// B1 (biểu điểm): gate tổng điểm nằm HOÀN TOÀN ở server (validatePointsForPublish
// trong publishExam) — màn này cố ý KHÔNG tính tổng điểm chạy, vì một con số
// "7.75/10" nhấp nháy bên cạnh 40 ô nhập là lời hối thúc suốt buổi soát đề chứ
// không phải thông tin. Đổi lại, lỗi server trả về lúc bấm Publish phải hiện
// ĐẦY ĐỦ: trước bản này chỉ `message` được hiển thị còn mảng `errors` bị vứt,
// nên tác giả nhận đúng một dòng "Fix these issues" mà không biết issue nào.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveExam, publishExam } from "@/app/(layer4)/actions";
import { useT } from "@/lib/i18n/client";
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
import { StatusBadge } from "./StatusBadge";
import { ExtractionErrorPanel } from "./ExtractionErrorPanel";
import { AssembledQuestionList } from "./AssembledQuestionList";
import { MetadataFields, type ExamMetaFormValue } from "./MetadataFields";
import { PublishBar } from "./PublishBar";
import type { ReviewNodes } from "./reviewNodes.types";

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
  const t = useT();
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
  // Marker "from your file": field có giá trị khi đến từ Automatic, chưa chạm.
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
      if (patch.school !== undefined) meta.school = patch.school.trim() === "" ? undefined : patch.school;
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

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <Link
          href="/me/exams"
          className="eyebrow hover:text-brand inline-flex items-center gap-1 transition-colors"
        >
          ← {t("common.myExams")}
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-foreground text-2xl">
            {exam.meta.title.trim() === "" ? t("upload.untitledExam") : exam.meta.title}
          </h1>
          <StatusBadge status={status} />
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          {exam.questions.length === 1
            ? t("upload.oneQuestion")
            : t("upload.questionCount", { count: exam.questions.length })}
        </p>
        {isPublished && (
          <p className="text-muted-foreground mt-2 text-sm">{t("upload.publishedNotice")}</p>
        )}
      </div>

      <ExtractionErrorPanel errors={shownErrors} />

      {/* v2.2: khối metadata sửa được — anchor cho link lỗi META_*. */}
      <section id="exam-details" className="rounded-[4px] border border-border p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">{t("upload.examDetails")}</h2>
        <MetadataFields
          value={toFormValue(exam)}
          onChange={onChangeMeta}
          fieldErrors={fieldErrors}
          disabled={saving || publishing}
          aiFilled={aiFilled}
        />
        {isPublished && (
          <p className="mt-3 text-xs text-muted-foreground">{t("upload.fixedAfterPublish")}</p>
        )}
      </section>

      {/* A1 — ngữ liệu dùng chung, sửa được MỘT chỗ cho cả nhóm câu. Đặt TRÊN
          danh sách câu vì đó là thứ tự đọc của đề gốc, và vì sửa ở đây ảnh
          hưởng nhiều câu bên dưới. */}
      {exam.passages.length > 0 && (
        <section className="border-border rounded-[4px] border p-4">
          <h2 className="text-foreground mb-1 text-sm font-medium">
            {t("upload.sharedPassages")}
          </h2>
          <p className="text-muted-foreground mb-4 text-xs">
            {t("upload.sharedPassagesHint")}
          </p>
          <div className="flex flex-col gap-4">
            {exam.passages.map((p, i) => (
              <div key={p.id}>
                <label
                  htmlFor={`passage-${p.id}`}
                  className="text-muted-foreground mb-1 block text-xs"
                >
                  {p.title ?? t("upload.passageLabel", { index: i + 1 })}
                </label>
                <textarea
                  id={`passage-${p.id}`}
                  value={p.text}
                  onChange={(e) => onChangePassage(p.id, e.target.value)}
                  maxLength={LIMITS.MAX_PASSAGE}
                  rows={8}
                  disabled={saving || publishing}
                  className="border-border bg-card text-foreground focus:border-brand w-full resize-y rounded-[4px] border p-3 text-sm outline-none"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <AssembledQuestionList
        questions={exam.questions}
        parts={exam.parts}
        errors={shownErrors}
        onChangeQuestion={onChangeQuestion}
        nodes={nodes}
        subject={exam.meta.subject}
        essayGradingEnabled={essayGradingEnabled}
      />

      <PublishBar
        isPublished={isPublished}
        canPublish={canPublish}
        saving={saving}
        publishing={publishing}
        dirty={dirty}
        error={error}
        examId={examId}
        examTitle={exam.meta.title}
        onSave={persist}
        onPublish={onPublish}
      />
    </div>
  );
}
