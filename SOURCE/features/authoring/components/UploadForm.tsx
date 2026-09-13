"use client";

// UploadForm — container S-01 (UI Spec §UploadForm / Task 6.2 + v2.2 M6). MỘT
// nơi giữ state: metadata + file đề + (file đáp án) + hai lựa chọn. KHÔNG BAO
// GIỜ clear khi lỗi (giữ nguyên để sửa). Gọi extractAndAssemble (server): thành
// công → action tự redirect /me/exams/[id] (?src=auto ở chế độ Automatic); thất
// bại → hiện lỗi, giữ form.
//
// BA CHẶNG (2026-09-13, hướng A engineer chọn từ prototype sau khi test trên
// điện thoại thật): Đề thi → Đáp án → Thông tin đề, xếp dọc trên một thanh
// (UploadStep). Hai trường hợp đáp án — NẰM TRONG FILE ĐỀ hay FILE RIÊNG — là
// chặng 2 (AnswerSourceField); ô thả file đáp án chỉ hiện khi "File riêng".
// Trục này độc lập với chế độ nhập metadata (chặng 3, EntryModeField), không
// gộp thành bốn giá trị. Chặng "đang làm" = chặng chưa xong đầu tiên; các chặng
// trước nó tô xanh có dấu tích — thanh dọc là tiến độ nhìn thấy được, nên
// không còn thẻ hướng dẫn mở sẵn đầu trang; hướng dẫn gấp lại dưới nút.
//
// v2.2 (ADR-0007) — Entry Mode THÀNH THẬT:
//   - Automatic (mặc định): khối metadata gấp lại "hệ thống tự điền", field
//     optional (AC-037) — chỉ validate file; AI đọc metadata từ trang 1 file
//     đề; gate chuyển sang publish. Đã gõ gì thì giá trị đó THẮNG AI.
//   - Manual: hành vi v2.1 — validate required client-side trước submit
//     (AC-036), server validateExamMeta vẫn là nguồn sự thật cuối.
//   - Đổi mode không xoá giá trị; khối metadata tự mở khi có giá trị đã gõ
//     hoặc có lỗi (không bao giờ giấu field đang lỗi — a11y UI Spec §v2.2).
//
// Theme "Sân trường" (2026-09-09): tiêu đề trang do page.tsx dựng (PageHeader);
// khối thông tin đề là thẻ surface; lựa chọn là chip; lỗi màu đỏ. Nút Bắt đầu
// là hành động chính DUY NHẤT của màn nên cao 52px (§2), trải hết bề ngang dưới
// 640px, căn trái từ đó (§3). Khối "đang đọc file" THẾ CHỖ nút khi đang chạy.
// KHÔNG bao gồm navbar — do (authoring)/layout.tsx cung cấp.

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { extractAndAssemble } from "@/features/authoring/actions";
import { t } from "@/lib/copy";
import type { Translate } from "@/lib/copy";
import { LIMITS } from "@/lib/ugc/limits";
import type { UgcActionError } from "@/lib/ugc/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetadataFields,
  type ExamMetaFormValue,
} from "@/features/authoring/components/MetadataFields";
import { Dropzone, fileHint } from "@/features/authoring/components/Dropzone";
import { ImportInstructions } from "@/features/authoring/components/ImportInstructions";
import { EntryModeField, type EntryMode } from "@/features/authoring/components/EntryModeField";
import {
  AnswerSourceField,
  type AnswerSource,
} from "@/features/authoring/components/AnswerSourceField";
import { ExtractionProgress } from "@/features/authoring/components/ExtractionProgress";
import { UploadStep, type UploadStepState } from "@/features/authoring/components/UploadStep";

const EMPTY_META: ExamMetaFormValue = {
  title: "",
  subject: "",
  grade: "",
  durationMinutes: "",
  school: "",
  schoolYear: "",
  semester: "",
};

/** Validate required field phía client — CHỈ chế độ Manual (AC-036). Nhận `t`
 * làm tham số vì đây là hàm thuần ngoài component: hook chỉ gọi được bên trong. */
function validateRequired(m: ExamMetaFormValue, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!m.title.trim()) errors.title = t("upload.errTitleRequired");
  if (!m.subject.trim()) errors.subject = t("upload.errSubjectRequired");
  const grade = Number(m.grade);
  if (
    !m.grade.trim() ||
    !Number.isInteger(grade) ||
    grade < LIMITS.MIN_GRADE ||
    grade > LIMITS.MAX_GRADE
  ) {
    errors.grade = t("upload.errGradeRange", { min: LIMITS.MIN_GRADE, max: LIMITS.MAX_GRADE });
  }
  const duration = Number(m.durationMinutes);
  if (
    !m.durationMinutes.trim() ||
    !Number.isInteger(duration) ||
    duration < LIMITS.MIN_DURATION ||
    duration > LIMITS.MAX_DURATION
  ) {
    errors.durationMinutes = t("upload.errDurationRequired");
  }
  return errors;
}

/** Trạng thái ba chặng từ ba cờ "đã xong": chặng đang làm là chặng chưa xong
 *  ĐẦU TIÊN, trước nó xanh, sau nó chờ. Xong cả ba thì cả ba xanh. */
function stepStates(done: [boolean, boolean, boolean]): UploadStepState[] {
  const firstOpen = done.indexOf(false);
  return done.map((d, i) => (d ? "done" : i === firstOpen ? "current" : "upcoming"));
}

export function UploadForm() {
  const [meta, setMeta] = useState<ExamMetaFormValue>(EMPTY_META);
  const [entryMode, setEntryMode] = useState<EntryMode>("automatic");
  // Mặc định "nằm trong file đề" (prototype đã duyệt): đề sưu tầm thường in
  // sẵn đáp án ở cuối. Chọn nhầm cũng không mất gì — thiếu đáp án thì màn soát
  // báo từng câu, và đổi lựa chọn không xoá file đã chọn.
  const [answerSource, setAnswerSource] = useState<AnswerSource>("in-exam");
  const [metaOpen, setMetaOpen] = useState(false);
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const [fileErrors, setFileErrors] = useState<{ question?: string; answer?: string }>({});
  const [error, setError] = useState<UgcActionError | null>(null);
  const [pending, startTransition] = useTransition();

  // Server fieldErrors (sau submit) đè lên client errors (trước submit) — cùng
  // key name (title/subject/grade/durationMinutes/school/schoolYear/semester).
  const fieldErrors = error?.fieldErrors ?? clientErrors ?? undefined;

  const isAutomatic = entryMode === "automatic";
  const separateKey = answerSource === "separate";
  const hasTypedMeta = Object.values(meta).some((v) => v.trim() !== "");
  const hasMetaErrors = !!fieldErrors && Object.keys(fieldErrors).length > 0;
  // Không bao giờ giấu field có giá trị/lỗi sau disclosure gấp (UI Spec §v2.2).
  const metaExpanded = !isAutomatic || metaOpen || hasTypedMeta || hasMetaErrors;

  // Tiến độ ba chặng. Chặng 3 "xong" khi không còn gì bắt buộc: Automatic thì
  // luôn (metadata tuỳ chọn), Manual thì khi bốn ô bắt buộc hợp lệ.
  const examDone = questionFile !== null;
  const answersDone = !separateKey || answerFile !== null;
  const detailsDone = isAutomatic || Object.keys(validateRequired(meta, t)).length === 0;
  const [examState, answersState, detailsState] = stepStates([examDone, answersDone, detailsDone]);

  function onSubmit() {
    if (pending) return;

    // Automatic: metadata optional (AC-037) — chỉ chặn thiếu file.
    const requiredErrors = isAutomatic ? {} : validateRequired(meta, t);
    const nextFileErrors: { question?: string; answer?: string } = {};
    if (!questionFile) nextFileErrors.question = t("upload.errQuestionFileRequired");
    if (separateKey && !answerFile) nextFileErrors.answer = t("upload.errAnswerFileRequired");

    if (
      Object.keys(requiredErrors).length > 0 ||
      nextFileErrors.question ||
      nextFileErrors.answer
    ) {
      setClientErrors(Object.keys(requiredErrors).length > 0 ? requiredErrors : null);
      setFileErrors(nextFileErrors);
      return;
    }

    setClientErrors(null);
    setFileErrors({});
    setError(null);

    const fd = new FormData();
    fd.set("entryMode", entryMode);
    fd.set("answerSource", answerSource);
    fd.set("title", meta.title);
    fd.set("subject", meta.subject);
    fd.set("grade", meta.grade);
    fd.set("durationMinutes", meta.durationMinutes);
    fd.set("school", meta.school);
    fd.set("schoolYear", meta.schoolYear);
    fd.set("semester", meta.semester);
    fd.set("questionFile", questionFile as File);
    // Chỉ gửi file đáp án khi nó là nguồn: một file đã chọn rồi đổi ý sang
    // "nằm trong đề" không được lặng lẽ đi theo.
    if (separateKey) fd.set("answerFile", answerFile as File);

    startTransition(async () => {
      // Thành công → action gọi redirect() (ném NEXT_REDIRECT, Next xử lý).
      // Chỉ nhận về giá trị khi THẤT BẠI.
      const result = await extractAndAssemble(fd);
      if (result?.error) setError(result.error);
    });
  }

  const metaFields = (
    <MetadataFields
      value={meta}
      onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
      fieldErrors={fieldErrors}
      disabled={pending}
      optionalMode={isAutomatic}
    />
  );

  return (
    // `pb-14` dưới 640px: nút Bắt đầu trải hết bề ngang, và ở cuối trang nút
    // hỗ trợ (fixed, góc phải, 56px trên BottomNav) đè lên 56px bên phải của
    // nó — đo 2026-09-09 ở 360px: nút 604–656, nút hỗ trợ 608–664. Đệm thêm
    // đúng chiều cao nút hỗ trợ để Bắt đầu cuộn lên được khỏi vùng đó. Từ
    // 640px nút tự co bề rộng, căn trái, không còn chạm góc phải.
    <div className="flex flex-col gap-5 pb-14 sm:pb-0">
      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-card px-4 py-3 text-sm"
        >
          <p className="font-semibold">{error.message}</p>
          {error.errors && error.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 leading-relaxed">
              {error.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col">
        <UploadStep
          number={1}
          title={t("upload.stepExam")}
          state={examState}
          meta={examDone ? t("upload.stepDone") : t("upload.stepRequired")}
        >
          <Dropzone
            id="question-file"
            label={t("upload.examPaper")}
            labelHidden
            hint={fileHint()}
            file={questionFile}
            onSelect={(f) => {
              setQuestionFile(f);
              if (f) setFileErrors((fe) => ({ ...fe, question: undefined }));
            }}
            disabled={pending}
            error={fileErrors.question}
          />
        </UploadStep>

        <UploadStep
          number={2}
          title={t("upload.stepAnswers")}
          state={answersState}
          meta={separateKey && answerFile ? t("upload.stepDone") : undefined}
        >
          <AnswerSourceField
            value={answerSource}
            onChange={(source) => {
              setAnswerSource(source);
              if (source === "in-exam") setFileErrors((fe) => ({ ...fe, answer: undefined }));
            }}
            disabled={pending}
          />
          {separateKey && (
            <div className="motion-unfold">
              <Dropzone
                id="answer-file"
                label={t("upload.answerKey")}
                labelHidden
                dragLabel={t("upload.dragDropAnswer")}
                hint={fileHint()}
                file={answerFile}
                onSelect={(f) => {
                  setAnswerFile(f);
                  if (f) setFileErrors((fe) => ({ ...fe, answer: undefined }));
                }}
                disabled={pending}
                error={fileErrors.answer}
              />
            </div>
          )}
        </UploadStep>

        <UploadStep number={3} title={t("upload.stepDetails")} state={detailsState} last>
          <EntryModeField value={entryMode} onChange={setEntryMode} disabled={pending} />

          {isAutomatic ? (
            // Khối metadata gấp/mở — cùng khuôn ImportInstructions: không animate
            // chiều cao (§7), nội dung tỏ dần bằng .motion-unfold.
            <Card padding="none">
              <button
                type="button"
                onClick={() => setMetaOpen((v) => !v)}
                aria-expanded={metaExpanded}
                aria-controls="exam-details-body"
                className="focus-visible:ring-ring/40 rounded-card flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left focus-visible:ring-3 focus-visible:outline-none sm:px-5"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-semibold">{t("upload.examDetails")}</span>
                  <span className="text-muted-foreground text-sm">
                    {t("upload.filledAutomatically")}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "text-muted-foreground size-5 shrink-0 transition-[rotate] ease-out",
                    metaExpanded && "rotate-180"
                  )}
                />
              </button>
              {metaExpanded && (
                <div id="exam-details-body" className="motion-unfold px-4 pb-4 sm:px-5 sm:pb-5">
                  <p className="text-muted-foreground mb-4 max-w-prose text-sm leading-relaxed">
                    {t("upload.leaveEmptyHint")}
                  </p>
                  {metaFields}
                </div>
              )}
            </Card>
          ) : (
            <Card as="section" aria-labelledby="exam-details-heading">
              <h3 id="exam-details-heading" className="text-base font-semibold">
                {t("upload.examDetails")}
              </h3>
              {metaFields}
            </Card>
          )}
        </UploadStep>
      </div>

      {pending ? (
        <ExtractionProgress metaStep={isAutomatic} />
      ) : (
        <div className="pt-1">
          <Button type="button" size="lg" onClick={onSubmit} className="w-full sm:w-auto">
            {t("upload.start")}
          </Button>
        </div>
      )}

      {/* Hướng dẫn gấp lại DƯỚI nút (2026-09-13): ba chặng đã tự nói thứ tự,
          nên thẻ mở sẵn đầu trang chỉ đẩy ô thả file xuống một màn. */}
      <ImportInstructions />
    </div>
  );
}
