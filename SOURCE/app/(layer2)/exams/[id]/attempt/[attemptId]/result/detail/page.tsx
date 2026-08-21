// Result Detail — /exams/[id]/attempt/[attemptId]/result/detail (Layer 2). GĐ 3 M3.1 Task 4.
// Page riêng cho phần "Chi tiết từng câu" (Q5): tách khỏi màn Result để giữ Result gọn.
// Server Component: đọc getResult(); chưa nộp / không thuộc user → redirect trang đề.
// Hiển thị mỗi câu: nội dung (markdown+LaTeX) + 4 lựa chọn, tô đáp án đúng (brand) và
// đáp án user chọn sai (destructive). Visual nhất quán L2 "tờ giấy trắng / focused".
// v2.1 (Task D3): câu KHÔNG chấm (true_false/short_answer/essay) hiển thị input
// của user + đáp án lưu trữ, nhãn "Not auto-scored" — không tô đúng/sai.

import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getResult } from "@/app/(layer2)/queries";
import { decodeTfAnswer, formatSubAnswers } from "@/lib/ugc/tfCodec";
import { RichText } from "@/components/shared/RichText";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ExplainStepAffordance } from "@/components/tutor/ExplainStepAffordance";
import { TutorQuotaNote } from "@/components/billing/TutorQuotaNote";

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const t = await getTranslate();
  const { id, attemptId } = await params;
  const data = await getResult(attemptId);

  if (!data) {
    redirect(`/exams/${id}`);
  }

  const { examId, examTitle, result, questions } = data;
  const resultHref = `/exams/${examId}/attempt/${attemptId}/result`;

  return (
    <div className="bg-background">
      <PageContainer as="main" size="small">
        {/* preload order 1–3 — các block fade lần lượt sau navbar (S#21). */}
        <header
          className="preload-fade flex flex-col gap-2"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        >
          {/* Đây là route SÂU NHẤT của app (đề → lượt làm → kết quả → chi tiết).
              Trước đây lối ra duy nhất là nút "← Back to results" tuốt dưới đáy
              trang, sau một danh sách dài bằng số câu hỏi. Breadcrumbs trả lại
              cả vị trí lẫn lối ra ở NGAY ĐẦU trang. */}
          <Breadcrumbs
            className="mb-1 text-xs"
            items={[
              { label: t("nav.exams"), href: "/exams" },
              { label: examTitle, href: `/exams/${examId}` },
              { label: t("result.title"), href: resultHref },
              { label: t("result.attemptDetails") },
            ]}
          />
          <span className="eyebrow">{t("result.attemptDetails")}</span>
          <h1 className="text-foreground font-serif text-2xl leading-snug">{examTitle}</h1>
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium tabular-nums">
              {result.correct}/{result.total}
            </span>{" "}
            {t("common.correct").toLowerCase()}
          </p>
        </header>

        <ol
          className="preload-fade mt-8 flex flex-col gap-8"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          {result.perQuestion.map((r, i) => {
            const q = questions[r.questionId];
            const notScored = r.scored === false;
            // v2.1: câu không chấm — hiển thị input + đáp án lưu trữ, không tô Đ/S.
            if (notScored) {
              const studentInput =
                q?.questionType === "true_false"
                  ? formatSubAnswers(decodeTfAnswer(r.selected))
                  : (r.selected ?? "");
              const storedAnswer =
                q?.questionType === "true_false"
                  ? formatSubAnswers(q.subAnswers)
                  : (q?.essayAnswer ?? "");
              return (
                <li key={r.questionId} className="border-border flex flex-col gap-4 border-t pt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow">{t("upload.questionLabel", { number: i + 1 })}</span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {t("result.notAutoScored")}
                    </span>
                  </div>
                  {q && (
                    <RichText
                      text={q.content}
                      className="text-foreground font-serif text-lg leading-relaxed"
                    />
                  )}
                  {q?.questionType === "true_false" && (
                    <ul className="flex flex-col gap-2">
                      {q.subItems?.map((s) => (
                        <li
                          key={s.id}
                          className="border-border bg-card flex items-start gap-3 rounded-lg border p-3"
                        >
                          <span className="text-muted-foreground w-4 shrink-0 pt-0.5 font-mono text-sm">
                            {s.id})
                          </span>
                          <RichText
                            text={s.text}
                            inline
                            className="text-card-foreground pt-0.5 text-base leading-relaxed"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-muted-foreground">
                      {t("result.yourAnswerLabel")}{" "}
                      <span className="text-foreground">{studentInput || t("result.skipped")}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {t("result.storedAnswerLabel")}{" "}
                      <span className="text-[#4F7942]">{storedAnswer || "—"}</span>
                    </p>
                  </div>
                </li>
              );
            }
            // S#26: correct = XANH LÁ ẤM #4F7942 (fern — hợp tông ngà/sơn mài,
            // không dùng green neon lạnh); wrong giữ destructive. Green=correct
            // là convention chuẩn, áp cho mọi marking correct bên dưới.
            const status = r.isCorrect
              ? { label: t("common.correct"), cls: "text-[#4F7942]" }
              : r.selected
                ? { label: t("common.wrong"), cls: "text-destructive" }
                : { label: t("result.skippedLabel"), cls: "text-muted-foreground" };

            // TBD-04 resolution: reuse `status.cls` (already computed above for
            // the status chip) for the "Your answer" line's color — avoids a
            // second copy of the fern/destructive/muted branch.
            const isShortAnswer = q?.questionType === "short_answer";

            return (
              <li key={r.questionId} className="border-border flex flex-col gap-4 border-t pt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="eyebrow">{t("upload.questionLabel", { number: i + 1 })}</span>
                  <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
                </div>

                {q && (
                  <RichText
                    text={q.content}
                    className="text-foreground font-serif text-lg leading-relaxed"
                  />
                )}

                {/* Engine 1 (AC-023/024): gia sư "Giải thích bước này" mount ở
                    CUỐI cả hai nhánh CÓ CHẤM (short_answer và mcq), ngay trước
                    khi đóng <li>, và CHỈ khi cờ đúng bằng true — vắng mặt/false/
                    undefined đều không mount (fail-closed, UI Spec D1). Nhánh
                    KHÔNG chấm ở trên không có mount này: câu không chấm không thể
                    mang một `hasBeenWrongTwice` có nghĩa. Cờ này chỉ là tiện ích
                    hiển thị — explainStep() tự tái kiểm tra điều kiện phía server. */}
                {isShortAnswer ? (
                  <>
                    <div className="flex flex-col gap-1 text-sm">
                      <p className="text-muted-foreground">
                        {t("result.yourAnswerLabel")}{" "}
                        <span className={status.cls}>{r.selected || t("result.skipped")}</span>
                      </p>
                      <p className="text-muted-foreground">
                        {t("result.correctAnswerLabel")}{" "}
                        <span className="text-[#4F7942]">{q?.essayAnswer || "—"}</span>
                      </p>
                    </div>
                    {r.hasBeenWrongTwice === true && (
                      <ExplainStepAffordance questionId={r.questionId} attemptId={attemptId} />
                    )}
                    <TutorQuotaNote />
                  </>
                ) : (
                  <>
                    <ul className="flex flex-col gap-2">
                      {q?.choices.map((choice) => {
                        const isCorrect = choice.id === r.correct;
                        const isSelectedWrong =
                          choice.id === r.selected && r.selected !== r.correct;

                        const rowCls = isCorrect
                          ? "border-[#4F7942] bg-[#4F7942]/10"
                          : isSelectedWrong
                            ? "border-destructive bg-destructive/8"
                            : "border-border bg-card";
                        const badgeCls = isCorrect
                          ? "border-[#4F7942] bg-[#4F7942] text-[#EDE1C8]"
                          : isSelectedWrong
                            ? "border-destructive bg-destructive text-brand-foreground"
                            : "border-border text-muted-foreground";

                        return (
                          <li
                            key={choice.id}
                            className={`flex items-start gap-3 rounded-lg border p-3 ${rowCls}`}
                          >
                            <span
                              aria-hidden
                              className={`flex size-7 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-medium ${badgeCls}`}
                            >
                              {choice.id}
                            </span>
                            <RichText
                              text={choice.text}
                              inline
                              className="text-card-foreground pt-0.5 text-base leading-relaxed"
                            />
                            {isCorrect && (
                              <span className="ml-auto shrink-0 self-center font-mono text-[0.65rem] tracking-wide text-[#4F7942] uppercase">
                                {t("result.correctAnswer")}
                              </span>
                            )}
                            {isSelectedWrong && (
                              <span className="text-destructive ml-auto shrink-0 self-center font-mono text-[0.65rem] tracking-wide uppercase">
                                {t("result.yourChoice")}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {r.hasBeenWrongTwice === true && (
                      <ExplainStepAffordance questionId={r.questionId} attemptId={attemptId} />
                    )}
                    <TutorQuotaNote />
                  </>
                )}
              </li>
            );
          })}
        </ol>

        <div
          className="preload-fade border-border mt-10 border-t pt-6"
          style={{ "--preload-order": 3 } as React.CSSProperties}
        >
          <Link
            href={resultHref}
            className="border-border bg-card text-foreground hover:border-brand inline-block rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            ← Back to results
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
