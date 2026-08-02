// Result Detail — /exams/[id]/attempt/[attemptId]/result/detail (Layer 2). GĐ 3 M3.1 Task 4.
// Page riêng cho phần "Chi tiết từng câu" (Q5): tách khỏi màn Result để giữ Result gọn.
// Server Component: đọc getResult(); chưa nộp / không thuộc user → redirect trang đề.
// Hiển thị mỗi câu: nội dung (markdown+LaTeX) + 4 lựa chọn, tô đáp án đúng (brand) và
// đáp án user chọn sai (destructive). Visual nhất quán L2 "tờ giấy trắng / focused".
// v2.1 (Task D3): câu KHÔNG chấm (true_false/short_answer/essay) hiển thị input
// của user + đáp án lưu trữ, nhãn "Not auto-scored" — không tô đúng/sai.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getResult } from "@/app/(layer2)/queries";
import { decodeTfAnswer, formatSubAnswers } from "@/lib/ugc/tfCodec";
import { RichText } from "@/components/shared/RichText";

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const data = await getResult(attemptId);

  if (!data) {
    redirect(`/exams/${id}`);
  }

  const { examId, examTitle, result, questions } = data;
  const resultHref = `/exams/${examId}/attempt/${attemptId}/result`;

  return (
    <div className="bg-background">
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        {/* preload order 1–3 — các block fade lần lượt sau navbar (S#21). */}
        <header
          className="preload-fade flex flex-col gap-2"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        >
          <span className="eyebrow">Attempt details</span>
          <h1 className="font-serif text-2xl leading-snug text-foreground">
            {examTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {result.correct}/{result.total}
            </span>{" "}
            correct
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
                <li
                  key={r.questionId}
                  className="flex flex-col gap-4 border-t border-border pt-6"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="eyebrow">Question {i + 1}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Not auto-scored
                    </span>
                  </div>
                  {q && (
                    <RichText
                      text={q.content}
                      className="font-serif text-lg leading-relaxed text-foreground"
                    />
                  )}
                  {q?.questionType === "true_false" && (
                    <ul className="flex flex-col gap-2">
                      {q.subItems?.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                        >
                          <span className="w-4 shrink-0 pt-0.5 font-mono text-sm text-muted-foreground">
                            {s.id})
                          </span>
                          <RichText
                            text={s.text}
                            inline
                            className="pt-0.5 text-base leading-relaxed text-card-foreground"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-muted-foreground">
                      Your answer:{" "}
                      <span className="text-foreground">
                        {studentInput || "— skipped —"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Stored answer:{" "}
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
              ? { label: "Correct", cls: "text-[#4F7942]" }
              : r.selected
                ? { label: "Wrong", cls: "text-destructive" }
                : { label: "Skipped", cls: "text-muted-foreground" };

            // TBD-04 resolution: reuse `status.cls` (already computed above for
            // the status chip) for the "Your answer" line's color — avoids a
            // second copy of the fern/destructive/muted branch.
            const isShortAnswer = q?.questionType === "short_answer";

            return (
              <li
                key={r.questionId}
                className="flex flex-col gap-4 border-t border-border pt-6"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="eyebrow">Question {i + 1}</span>
                  <span className={`text-xs font-medium ${status.cls}`}>
                    {status.label}
                  </span>
                </div>

                {q && (
                  <RichText
                    text={q.content}
                    className="font-serif text-lg leading-relaxed text-foreground"
                  />
                )}

                {isShortAnswer ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-muted-foreground">
                      Your answer:{" "}
                      <span className={status.cls}>
                        {r.selected || "— skipped —"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Correct answer:{" "}
                      <span className="text-[#4F7942]">
                        {q?.essayAnswer || "—"}
                      </span>
                    </p>
                  </div>
                ) : (
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
                            className="pt-0.5 text-base leading-relaxed text-card-foreground"
                          />
                          {isCorrect && (
                            <span className="ml-auto shrink-0 self-center font-mono text-[0.65rem] uppercase tracking-wide text-[#4F7942]">
                              Correct answer
                            </span>
                          )}
                          {isSelectedWrong && (
                            <span className="ml-auto shrink-0 self-center font-mono text-[0.65rem] uppercase tracking-wide text-destructive">
                              Your choice
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <div
          className="preload-fade mt-10 border-t border-border pt-6"
          style={{ "--preload-order": 3 } as React.CSSProperties}
        >
          <Link
            href={resultHref}
            className="inline-block rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand"
          >
            ← Back to results
          </Link>
        </div>
      </main>
    </div>
  );
}
