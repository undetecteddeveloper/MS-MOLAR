// Result Detail — /exams/[id]/attempt/[attemptId]/result/detail (Layer 2). GĐ 3 M3.1 Task 4.
// Page riêng cho phần "Chi tiết từng câu" (Q5): tách khỏi màn Result để giữ Result gọn.
// Server Component: đọc getResult(); chưa nộp / không thuộc user → redirect trang đề.
// Hiển thị mỗi câu: nội dung (markdown+LaTeX) + 4 lựa chọn, đánh dấu đáp án đúng
// (xanh) và đáp án user chọn sai (đỏ).
// v2.1 (Task D3): câu KHÔNG chấm (true_false/short_answer thiếu ground truth)
// hiển thị input của user + đáp án lưu trữ, nhãn "Chưa chấm tự động" — không tô
// đúng/sai. essay ĐÃ RỜI nhóm đó kể từ ADR-0018: nó được chấm tự động và mang
// một band, chỉ là band tới muộn hơn, từ đường bất đồng bộ sau khi nộp.
//
// Theme "Sân trường" (2026-09-06): PageHeader chuẩn; mỗi câu là một mục trong
// danh sách có kẻ chia (ngoại lệ được phép của "nền tô thay viền", §4.2);
// trạng thái câu là Badge có icon + chữ; lựa chọn là ô tô nền surface, đáp án
// đúng viền xanh + huy hiệu xanh, chọn sai viền đỏ + huy hiệu đỏ — cùng ngôn
// ngữ "đánh dấu = viền + nền" với lựa chọn đang chọn ở màn làm bài. Mọi màu
// là token (bỏ hai hex của theme cũ).

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import { t } from "@/lib/copy";
import { redirect } from "next/navigation";
import { getResult } from "@/features/exams/queries";
import { decodeTfAnswer, formatSubAnswers } from "@/lib/ugc/tfCodec";
import { RichText } from "@/components/shared/RichText";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuestionFigure } from "@/components/shared/QuestionFigure";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ExplainStepAffordance } from "@/components/tutor/ExplainStepAffordance";
import { EssayReviewBlock } from "@/features/exams/components/EssayReviewBlock";
import { EssayGradingPoller } from "@/features/exams/components/EssayGradingPoller";

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
 *  (`.../attempt/[attemptId]/page.tsx:18`, `(authoring)/upload/page.tsx:18`), va
 *  nam tren ca hai thu trang nay can — worst case mot luot cham lai la
 *  3 x GROQ_CALL_DEADLINE_MS + hai lan cho backoff ~76 s, con `explainStep()`
 *  can >= 30 s (dung con so `tutorActions.ts:28-31` da neu ten trang nay de doi).
 *  Khai tuong minh o day de mot lan ha "Default Max Duration" trong dashboard
 *  khong am tham cat ca hai. */
export const maxDuration = 300;

/** Kiểu chữ thân câu hỏi và bài đọc — CÙNG giá trị với `questionNodes.tsx`
 *  (màn làm bài) để một câu hỏi trông giống nhau lúc làm và lúc dò lại. Không
 *  import từ đó: file ấy kéo theo RichText + cây markdown, còn trang này đã
 *  import RichText trực tiếp; hai hằng chữ ngắn dễ so hơn một ràng buộc module. */
const CONTENT_CLASS = "text-foreground text-lg leading-relaxed font-medium text-pretty";
const PASSAGE_CLASS = "text-foreground text-base leading-relaxed text-pretty";

type Status = "correct" | "wrong" | "skipped";

/** Nhãn trạng thái một câu: icon + chữ, màu chỉ là kênh phụ (§4.3). */
function StatusBadge({ status }: { status: Status }) {
  if (status === "correct") {
    return (
      <Badge variant="success">
        <Check aria-hidden />
        {t("common.correct")}
      </Badge>
    );
  }
  if (status === "wrong") {
    return (
      <Badge variant="wrong">
        <X aria-hidden />
        {t("common.wrong")}
      </Badge>
    );
  }
  return (
    <Badge variant="muted">
      <Minus aria-hidden />
      {t("result.skippedLabel")}
    </Badge>
  );
}

const STATUS_TEXT: Record<Status, string> = {
  correct: "text-success",
  wrong: "text-destructive",
  skipped: "text-muted-foreground",
};

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
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      {/* Đây là route SÂU NHẤT của app (đề → lượt làm → kết quả → chi tiết).
          Trước đây lối ra duy nhất là nút "← Back to results" tuốt dưới đáy
          trang, sau một danh sách dài bằng số câu hỏi. Breadcrumbs trả lại
          cả vị trí lẫn lối ra ở NGAY ĐẦU trang. */}
      <PageHeader
        breadcrumbs={[
          { label: t("nav.exams"), href: "/exams" },
          { label: examTitle, href: `/exams/${examId}` },
          { label: t("result.title"), href: resultHref },
          { label: t("result.attemptDetails") },
        ]}
        eyebrow={t("result.attemptDetails")}
        title={examTitle}
        description={`${result.correct}/${result.total} ${t("common.correct").toLowerCase()}`}
      />

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

      <ol className="divide-border flex flex-col divide-y">
        {result.perQuestion.map((r, i) => {
          const q = questions[r.questionId];
          const notScored = r.scored === false;

          // NGỮ LIỆU DÙNG CHUNG (A1) — cùng vị trí (TRÊN đề bài) và cùng
          // khuôn cuộn như màn làm bài, để câu hỏi trông giống hệt lúc dò lại
          // và lúc làm. Dựng MỘT lần ở đây vì nó phải có ở CẢ HAI nhánh bên
          // dưới: `notScored` chia đôi theo việc câu có chấm được hay không,
          // không theo việc câu có bài đọc hay không.
          const passage = q?.passageText ? (
            <section className="bg-surface max-h-[260px] overflow-y-auto rounded-lg p-4">
              {q.passageTitle && (
                <p className="text-muted-foreground mb-2 text-xs">{q.passageTitle}</p>
              )}
              <RichText text={q.passageText} className={PASSAGE_CLASS} />
            </section>
          ) : null;

          // Hình thân câu — cùng vị trí (ngay dưới đề bài) và cùng khuôn
          // `max-h-80 w-auto` như màn làm bài (QuestionRenderer), để câu hỏi
          // trông giống hệt lúc dò lại và lúc làm. `url` đã là signed URL do
          // getResult() ký; QuestionFigure vẫn tự fail-closed theo allowlist
          // origin nên một URL lạ chỉ render KHÔNG GÌ CẢ.
          const figure = (
            <QuestionFigure url={q?.imageUrl} questionNumber={i + 1} className="max-h-80 w-auto" />
          );

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
              <li key={r.questionId} className="flex flex-col gap-4 py-6 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground text-sm font-semibold">
                    {t("upload.questionLabel", { number: i + 1 })}
                  </span>
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
                  {!r.essay && <Badge variant="muted">{t("result.notAutoScored")}</Badge>}
                </div>
                {passage}
                {q && <RichText text={q.content} className={CONTENT_CLASS} />}
                {figure}
                {q?.questionType === "true_false" && (
                  <ul className="flex flex-col gap-2">
                    {q.subItems?.map((s) => (
                      <li key={s.id} className="bg-surface flex items-start gap-3 rounded-lg p-3">
                        <span className="text-muted-foreground w-4 shrink-0 pt-0.5 text-sm font-semibold">
                          {s.id})
                        </span>
                        <RichText
                          text={s.text}
                          inline
                          className="text-foreground min-w-0 flex-1 pt-0.5 text-base leading-relaxed"
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
                      <span className="text-foreground">{studentInput || t("result.skipped")}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {t("result.storedAnswerLabel")}{" "}
                      <span className="text-success font-medium">{storedAnswer || "—"}</span>
                    </p>
                  </div>
                )}
              </li>
            );
          }

          const status: Status = r.isCorrect ? "correct" : r.selected ? "wrong" : "skipped";
          const isShortAnswer = q?.questionType === "short_answer";

          return (
            <li key={r.questionId} className="flex flex-col gap-4 py-6 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground text-sm font-semibold">
                  {t("upload.questionLabel", { number: i + 1 })}
                </span>
                <StatusBadge status={status} />
              </div>

              {passage}
              {q && <RichText text={q.content} className={CONTENT_CLASS} />}
              {figure}

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
                      <span className={`font-medium ${STATUS_TEXT[status]}`}>
                        {r.selected || t("result.skipped")}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      {t("result.correctAnswerLabel")}{" "}
                      <span className="text-success font-medium">{q?.essayAnswer || "—"}</span>
                    </p>
                  </div>
                  {r.hasBeenWrongTwice === true && (
                    <ExplainStepAffordance questionId={r.questionId} attemptId={attemptId} />
                  )}
                </>
              ) : (
                <>
                  <ul className="flex flex-col gap-2">
                    {q?.choices.map((choice) => {
                      const isCorrect = choice.id === r.correct;
                      const isSelectedWrong = choice.id === r.selected && r.selected !== r.correct;

                      // Viền 2px trong suốt ở hàng thường để ba trạng thái cao
                      // bằng nhau — cùng phép tính với AnswerChoice ở màn làm bài.
                      const rowCls = isCorrect
                        ? "border-success bg-surface"
                        : isSelectedWrong
                          ? "border-destructive bg-destructive/8"
                          : "bg-surface border-transparent";
                      const badgeCls = isCorrect
                        ? "bg-success text-primary-foreground"
                        : isSelectedWrong
                          ? "bg-destructive text-primary-foreground"
                          : "bg-card text-muted-foreground";

                      return (
                        <li
                          key={choice.id}
                          className={`flex items-start gap-3 rounded-lg border-2 p-3 ${rowCls}`}
                        >
                          <span
                            aria-hidden
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${badgeCls}`}
                          >
                            {choice.id}
                          </span>
                          <RichText
                            text={choice.text}
                            inline
                            className="text-foreground min-w-0 flex-1 pt-0.5 text-base leading-relaxed"
                          />
                          {isCorrect && (
                            <Badge variant="success" className="bg-card shrink-0 self-center">
                              {t("result.correctAnswer")}
                            </Badge>
                          )}
                          {isSelectedWrong && (
                            <Badge variant="wrong" className="bg-card shrink-0 self-center">
                              {t("result.yourChoice")}
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {r.hasBeenWrongTwice === true && (
                    <ExplainStepAffordance questionId={r.questionId} attemptId={attemptId} />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>

      {/* Lối về dưới cùng — sau một kẻ chia khép trang; breadcrumbs ở đầu trang
          đã cho cùng lối ra, nút này dành cho người vừa đọc hết danh sách. */}
      <div className="border-border border-t pt-5">
        <Link href={resultHref} className={buttonVariants({ variant: "secondary" })}>
          {t("result.backToResult")}
        </Link>
      </div>
    </PageContainer>
  );
}
