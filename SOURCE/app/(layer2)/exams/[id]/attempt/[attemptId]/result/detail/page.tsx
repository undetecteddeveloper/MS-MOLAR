// Result Detail — /exams/[id]/attempt/[attemptId]/result/detail (Layer 2). GĐ 3 M3.1 Task 4.
// Page riêng cho phần "Chi tiết từng câu" (Q5): tách khỏi màn Result để giữ Result gọn.
// Server Component: đọc getResult(); chưa nộp / không thuộc user → redirect trang đề.
// Hiển thị mỗi câu: nội dung (markdown+LaTeX) + 4 lựa chọn, tô đáp án đúng (brand) và
// đáp án user chọn sai (destructive). Visual nhất quán L2 "tờ giấy trắng / focused".
// v2.1 (Task D3): câu KHÔNG chấm (true_false/short_answer thiếu ground truth)
// hiển thị input của user + đáp án lưu trữ, nhãn "Not auto-scored" — không tô
// đúng/sai. essay ĐÃ RỜI nhóm đó kể từ ADR-0018: nó được chấm tự động và mang
// một band, chỉ là band tới muộn hơn, từ đường bất đồng bộ sau khi nộp. Câu chữ
// và bề mặt của nhánh tự luận thuộc Phase F; chỗ này chỉ ghi lại rằng lý do cũ
// ("essay không bao giờ chấm") không còn đúng.

import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getResult } from "@/app/(layer2)/queries";
import { decodeTfAnswer, formatSubAnswers } from "@/lib/ugc/tfCodec";
import { RichText } from "@/components/shared/RichText";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { QuestionFigure } from "@/components/shared/QuestionFigure";
import { ExplainStepAffordance } from "@/components/tutor/ExplainStepAffordance";
import { TutorQuotaNote } from "@/components/billing/TutorQuotaNote";
import { EssayReviewBlock } from "@/app/(layer2)/_components/EssayReviewBlock";
import { EssayGradingPoller } from "@/app/(layer2)/_components/EssayGradingPoller";

/** Route segment cua `retryEssayGrading()` (ADR-0018) — VA cua
 *  `explainStep()`, ca hai Server Action deu duoc goi tu trang nay.
 *
 *  PHAI khai O DAY, khong khai duoc trong file `"use server"`: `maxDuration` la
 *  cau hinh ROUTE SEGMENT (`layout.tsx | page.tsx | route.ts`), va mot file
 *  `"use server"` khong phai route segment — no chi duoc export ham async.
 *  Tai lieu Next.js 16 kem trong repo noi thang dieu do
 *  (`node_modules/next/dist/docs/.../route-segment-config/maxDuration.md`), va
 *  `tutorActions.ts:16-31` da ghi lai ca lap luan lan ket luan.
 *
 *  300 chu khong phai mot con so vua khit: no bang MAC DINH cua fluid compute,
 *  bang dung hai route segment khac trong repo dang dung
 *  (`.../attempt/[attemptId]/page.tsx:18`, `(layer4)/upload/page.tsx:18`), va
 *  nam tren ca hai thu trang nay can — worst case mot luot cham lai la
 *  3 x GROQ_CALL_DEADLINE_MS + hai lan cho backoff ~76 s, con `explainStep()`
 *  can >= 30 s (dung con so `tutorActions.ts:28-31` da neu ten trang nay de doi).
 *  Khai tuong minh o day de mot lan ha "Default Max Duration" trong dashboard
 *  khong am tham cat ca hai. */
export const maxDuration = 300;

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

        {/* Bộ poll — mount khi `essaySummary !== undefined`, KHÔNG phải khi
            `pendingCount > 0`.

            Điều kiện `pendingCount > 0` là thứ UI Spec công bố lần đầu, và nó
            GÂY RA khuyết tật AC-023: ở đúng lượt render giải quyết câu tự luận
            cuối cùng, component sẽ unmount và vùng `aria-live` của nó rời khỏi
            DOM TRONG CÙNG commit mà câu "đã chấm xong toàn bộ" lẽ ra được chèn
            vào — nên lời thông báo ấy không bao giờ được đọc lên. Người dùng
            nhìn thấy không nhận ra điều gì, nên không ai báo lỗi.

            Kết luận cho trạng thái tính năng TẮT không đổi — đó là lý do vị từ
            cũ trông vô hại: không phần tử nào mang khoá vòng đời thì
            `summariseEssays()` trả `undefined`, nên poller vẫn không mount.

            (Tên khoá jsonb CỐ Ý không gõ ra ở đây: một rào chắn trong
            `essayLifecycle.test.ts` giữ cho sáu literal ấy chỉ được gõ ở đúng
            một file, và bản nháp đầu của comment này đã làm nó đỏ.) */}
        {data.essaySummary !== undefined && (
          <EssayGradingPoller
            pendingCount={data.essaySummary.pendingCount}
            gradedCount={data.essaySummary.gradedCount}
          />
        )}

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
                    {/* Nhãn này CHỈ đúng khi câu thật sự không được chấm tự
                        động — tức `r.essay` VẮNG MẶT (RS-0/RS-1, và mọi câu
                        true_false). Nó KHÔNG được phép in cạnh một con điểm
                        vừa chấm xong: đó đúng là điều AC-053 cấm và FE-AC-03
                        đòi ("PHẢI KHÔNG hiện chuỗi `result.notAutoScored`").

                        Điều kiện phải là `r.essay`, KHÔNG phải `notScored`:
                        `r.scored === false` đúng vĩnh viễn với tự luận ở CẢ
                        BẢY trạng thái render nên nó không phân biệt được gì —
                        đúng cái bẫy frontend DD § "r.scored === false" đã dự
                        báo, kèm nhận định rằng không test hiện có nào bắt
                        được. Một lượt chạy L1 thật bắt được: thẻ hiện "Đã
                        chấm · 1/1 điểm" NGAY DƯỚI chữ "chưa chấm tự động".

                        Giữ nguyên nhãn khi khoá vắng mặt là yêu cầu FE-AC-13
                        (thẻ cũ render byte-for-byte như trước). */}
                    {!r.essay && (
                      <span className="text-muted-foreground text-xs font-medium">
                        {t("result.notAutoScored")}
                      </span>
                    )}
                  </div>
{/* NGỮ LIỆU DÙNG CHUNG (A1) — cùng vị trí (TRÊN đề bài) và cùng
                      khuôn cuộn như màn làm bài, để câu hỏi trông giống hệt
                      lúc dò lại và lúc làm. Phải có ở CẢ HAI nhánh của trang
                      này vì `notScored` chia đôi theo việc câu có chấm được
                      hay không, không theo việc câu có bài đọc hay không. */}
                  {q?.passageText && (
                    <section className="border-border bg-card max-h-[260px] overflow-y-auto rounded-lg border p-4">
                      {q.passageTitle && (
                        <p className="text-muted-foreground mb-2 text-xs">{q.passageTitle}</p>
                      )}
                      <RichText
                        text={q.passageText}
                        className="text-foreground font-serif text-base leading-[1.75]"
                      />
                    </section>
                  )}
                  {q && (
                    <RichText
                      text={q.content}
                      className="text-foreground font-serif text-lg leading-relaxed"
                    />
                  )}
                  {/* Hình thân câu — cùng vị trí (ngay dưới đề bài) và cùng
                      khuôn `max-h-80 w-auto` như màn làm bài
                      (QuestionRenderer.tsx:97), để câu hỏi trông giống hệt lúc
                      dò lại và lúc làm. `url` đã là signed URL do getResult()
                      ký; QuestionFigure vẫn tự fail-closed theo allowlist
                      origin nên một URL lạ chỉ render KHÔNG GÌ CẢ. */}
                  <QuestionFigure
                    url={q?.imageUrl}
                    questionNumber={i + 1}
                    className="max-h-80 w-auto"
                  />
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
                  {/* NHÁNH CON TỰ LUẬN (UI-D1). Nó nằm BÊN TRONG nhánh
                      `notScored` chứ không đứng cạnh, vì dưới W1 một câu tự
                      luận LUÔN rơi vào đây ở cả ba trạng thái vòng đời —
                      `scored` và `isCorrect` đều `false` vĩnh viễn.

                      Điều kiện là `r.essay` CÓ MẶT, tức `deriveEssayView()` đã
                      nhận ra khoá vòng đời. Khoá vắng mặt hoặc giá trị lạ đều
                      trả `undefined` và rơi xuống nhánh không-chấm chung bên
                      dưới, KHÔNG ĐỔI MỘT CHỮ (RS-0/RS-1, UI-D13). */}
                  {r.essay ? (
                    <EssayReviewBlock
                      view={r.essay}
                      studentAnswer={r.selected ?? ""}
                      modelAnswer={q?.essayAnswer ?? ""}
                      attemptId={attemptId}
                      questionId={r.questionId}
                    />
                  ) : (
                    <div className="flex flex-col gap-1 text-sm">
                      <p className="text-muted-foreground">
                        {t("result.yourAnswerLabel")}{" "}
                        <span className="text-foreground">
                          {studentInput || t("result.skipped")}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        {t("result.storedAnswerLabel")}{" "}
                        <span className="text-[#4F7942]">{storedAnswer || "—"}</span>
                      </p>
                    </div>
                  )}
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

{/* NGỮ LIỆU DÙNG CHUNG (A1) — cùng vị trí (TRÊN đề bài) và cùng
                    khuôn cuộn như màn làm bài, để câu hỏi trông giống hệt
                    lúc dò lại và lúc làm. Phải có ở CẢ HAI nhánh của trang
                    này vì `notScored` chia đôi theo việc câu có chấm được
                    hay không, không theo việc câu có bài đọc hay không. */}
                {q?.passageText && (
                  <section className="border-border bg-card max-h-[260px] overflow-y-auto rounded-lg border p-4">
                    {q.passageTitle && (
                      <p className="text-muted-foreground mb-2 text-xs">{q.passageTitle}</p>
                    )}
                    <RichText
                      text={q.passageText}
                      className="text-foreground font-serif text-base leading-[1.75]"
                    />
                  </section>
                )}
                {q && (
                  <RichText
                    text={q.content}
                    className="text-foreground font-serif text-lg leading-relaxed"
                  />
                )}

                {/* Hình thân câu — xem chú thích ở nhánh KHÔNG chấm bên trên.
                    Phải có ở CẢ HAI nhánh: `notScored` chia đôi trang theo
                    việc câu có chấm được hay không, chứ không theo việc câu có
                    hình hay không — một câu mcq có đồ thị đi xuống nhánh này. */}
                <QuestionFigure
                  url={q?.imageUrl}
                  questionNumber={i + 1}
                  className="max-h-80 w-auto"
                />

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
