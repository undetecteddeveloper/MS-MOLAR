// QuestionRenderer — hiển thị nội dung một câu hỏi + khu vực trả lời (Layer 2).
// GĐ 3 M3.1 Task 2: hàng đầu "Câu N trên T" + thanh tiến độ + FlagButton, khu
// vực trả lời cao cố định 238px cuộn dọc khi nội dung dài.
// Task 5: nội dung render markdown + LaTeX qua <RichText> (nay ở server, TD-023).
// v2.1 (ADR-0005, Task D2): thêm 2 dạng trả lời — true_false (4 ý a–d, mỗi ý
// segmented Đ/S; input mã hoá tfCodec thành 1 chuỗi) và short_answer (ô nhập
// ngắn). Cả hai "Not auto-scored yet" (product decision — chấm điểm là feature
// riêng); KHÔNG đáp án nào có mặt ở client (PublicQuestion đã Omit).
// 2026-09-02: bài đọc dùng chung không còn là một khối chữ chết — chỗ trống
// trong nó ĐƯỢC ĐIỀN bằng lựa chọn học sinh vừa chọn, và chỗ trống của câu
// đang làm được tô. Bố cục KHÔNG đổi (bài đọc vẫn nằm trong thẻ câu, vẫn cao
// tối đa 260px); thứ đổi là bài đọc nay đi xuống dưới dạng CÁC MẨU
// (`PassageNodes`) thay vì một node duy nhất, để client ghép chữ vào giữa.
// Lưu ý bảo mật KHÔNG đổi theo: chữ điền vào là nội dung LỰA CHỌN của chính
// học sinh (`PublicQuestion.choices`), không phải đáp án đúng — `correctAnswer`
// vẫn không có mặt ở phía này.
//
// Theme "Sân trường" (2026-09-06): thẻ câu hỏi tô nền surface (Card); các khối
// con — bài đọc, lựa chọn, ý Đ/S — là ô TRẮNG trên nền đó; viền chỉ còn ở ô
// nhập (Input/Textarea). Bố cục và chiều cao khu vực trả lời giữ nguyên.

"use client";
import { Fragment } from "react";
import { t } from "@/lib/copy";

import type { ChoiceId, PublicQuestion, SubItemId } from "@/types/question";
import { LIMITS } from "@/lib/ugc/limits";
import { decodeTfAnswer, encodeTfAnswer } from "@/lib/ugc/tfCodec";
import type {
  PassageChunkNode,
  QuestionNodes,
} from "@/features/exams/components/questionNodes.types";
import { QuestionFigure } from "@/components/shared/QuestionFigure";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AnswerChoice } from "@/features/exams/components/AnswerChoice";
import { FlagButton } from "@/features/exams/components/FlagButton";

const SUB_ITEM_IDS: SubItemId[] = ["a", "b", "c", "d"];
const MAX_ATTEMPT_ANSWER = LIMITS.MAX_ATTEMPT_ANSWER;

interface QuestionRendererProps {
  /** Số thứ tự câu (1-based) — để hiển thị "Câu N". */
  index: number;
  /** Tổng số câu của đề. Có thì nhãn thành "Câu N trên T" và hiện thanh tiến
   *  độ vị trí bên dưới (design plan §3 "Làm bài"); vắng thì nhãn "Câu N" như
   *  cũ và KHÔNG có thanh nào — tuỳ chọn để mọi chỗ dựng hiện có (kể cả test)
   *  giữ nguyên chữ ký. */
  total?: number;
  /** Không cần đáp án để render — dùng PublicQuestion (bảo mật, M2.6/v2.1). */
  question: PublicQuestion;
  /**
   * Nội dung câu hỏi ĐÃ RENDER SẴN Ở SERVER (TD-023) — thân câu, nhãn lựa
   * chọn, nội dung ý a–d. Component này là client (state làm bài), nên gọi
   * `<RichText>` ở đây kéo cả 126 KB br markdown+KaTeX vào bundle của màn làm
   * bài. `question` vẫn cần: id/loại câu/số ý/imageUrl đều là dữ liệu, không
   * phải nội dung cần render.
   */
  nodes: QuestionNodes;
  /** Input hiện tại của câu này (string — xem useExamPlayer), undefined nếu chưa. */
  selectedAnswer?: string;
  /**
   * Input của TOÀN BỘ đề (questionId → giá trị), để điền chỗ trống trong bài
   * đọc dùng chung.
   *
   * Vì sao không đủ với `selectedAnswer`: một bài đọc điền khuyết có 7 chỗ
   * trống thuộc 7 CÂU KHÁC NHAU, và cả bảy đều hiện trên màn hình của mỗi câu
   * trong nhóm. Đứng ở câu 34 mà chỉ biết đáp án câu 34 thì sáu chỗ còn lại
   * vĩnh viễn trống, kể cả khi học sinh đã làm xong chúng.
   *
   * BẮT BUỘC, không tuỳ chọn: chỉ có một chỗ gọi (`ExamPlayer`), nên `tsc` bắt
   * được ngay nếu quên — khác hẳn `essayGradingEnabled`, vốn tuỳ chọn để giữ
   * một chuỗi đã ghim trong test ở nguyên trạng.
   */
  answers: Record<string, string>;
  onSelectAnswer: (value: string) => void;
  flagged: boolean;
  onToggleFlag: () => void;
  /** Cờ AC-067, đã được ĐỌC Ở SERVER rồi truyền xuống — chỗ đọc 3/3, và là
   *  cổng CÂU CHỮ (hai chỗ kia là cổng HÀNH VI: `submitExam()` và
   *  `retryEssayGrading()`). Cả ba đọc MỘT biến nên chúng lật cùng lúc trong
   *  một lượt deploy.
   *
   *  KHÔNG BAO GIỜ `NEXT_PUBLIC_*` (UI-D7): một bản sao thứ hai của cùng một sự
   *  thật ở hai phía biên rồi sẽ lệch, và phía CLIENT là phía nói dối học sinh.
   *
   *  TUỲ CHỌN, mặc định `false`, và tính tuỳ-chọn ấy GÁNH VIỆC chứ không phải
   *  cho gọn: một prop BẮT BUỘC sẽ làm mọi chỗ dựng hiện có đỏ ở `tsc` và buộc
   *  phải sửa `ExamPlayer.test.tsx`. Vì nó tuỳ chọn, `QuestionRenderer.test.tsx`
   *  — vốn dựng component mà KHÔNG truyền nó — nhận `false`, in
   *  `player.essayNotScored`, và chuỗi đã ghim ở đó ở nguyên XANH. */
  essayGradingEnabled?: boolean;
}

export function QuestionRenderer({
  index,
  total,
  question,
  nodes,
  selectedAnswer,
  answers,
  onSelectAnswer,
  flagged,
  onToggleFlag,
  essayGradingEnabled = false,
}: QuestionRendererProps) {
  const type = question.questionType ?? "mcq";
  const progressId = `question-progress-${question.id}`;

  return (
    <Card padding="none" className="gap-5 p-4 sm:p-6">
      {/* Hàng đầu: vị trí trong đề + nút đánh dấu; dưới là thanh tiến độ VỊ TRÍ
          (câu 7 trên 40 = 7/40) tô XANH — vàng nắng không đạt 3:1 trên nền
          sáng nên không được làm ranh giới thông tin một mình (design plan §2).
          Thanh do nhãn bên trên đặt tên (`aria-labelledby`). */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span id={progressId} className="text-foreground text-sm font-semibold">
            {total !== undefined
              ? t("player.questionOf", { number: index, total })
              : t("upload.questionLabel", { number: index })}
          </span>
          <FlagButton flagged={flagged} onToggle={onToggleFlag} />
        </div>
        {total !== undefined && <Progress value={index} max={total} aria-labelledby={progressId} />}
      </div>

      {/* NGỮ LIỆU DÙNG CHUNG (A1) — bài đọc mà cả nhóm câu cùng tham chiếu.
          TRÊN thân câu hỏi vì đó là thứ tự đọc thật: đọc bài rồi mới trả lời.

          Cao TỐI ĐA 260px rồi tự cuộn, không cao theo nội dung. Một bài đọc
          400 từ để nở tự do sẽ đẩy câu hỏi VÀ toàn bộ khu vực trả lời xuống
          dưới màn hình — trên điện thoại thì học sinh phải cuộn đi cuộn lại
          giữa bài đọc và bốn lựa chọn cho từng câu một. Ô trắng riêng trên nền
          surface cũng nói rõ "phần này dùng chung, không phải đề bài của riêng
          câu này". */}
      {nodes.passage && (
        <section
          aria-label={nodes.passageTitle ?? t("player.sharedPassage")}
          className="bg-card max-h-[260px] overflow-y-auto rounded-lg p-4"
        >
          {nodes.passageTitle && (
            <p className="text-muted-foreground mb-2 text-xs">{nodes.passageTitle}</p>
          )}
          <div className={`rich-text flex flex-col gap-3 ${nodes.passage.className}`}>
            {nodes.passage.paragraphs.map((paragraph, pi) => (
              <p key={pi}>
                {paragraph.map((chunk, ci) =>
                  chunk.kind === "text" ? (
                    <Fragment key={ci}>{chunk.node}</Fragment>
                  ) : (
                    <PassageBlank
                      key={ci}
                      chunk={chunk}
                      filled={fillOf(chunk, answers)}
                      current={chunk.questionId !== null && chunk.questionId === question.id}
                    />
                  )
                )}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Nội dung câu hỏi — kiểu chữ do `questionNodes.tsx` quyết định (nguồn
          chân lý duy nhất): lớn và đậm hơn lựa chọn một nấc để mắt có mỏ neo. */}
      {nodes.content}

      {/* Hình thân câu (UGC v2.0, Task 5.2) — chỉ render nếu có + origin hợp lệ. */}
      {question.imageUrl && (
        <QuestionFigure
          url={question.imageUrl}
          questionNumber={index}
          className="max-h-80 w-auto"
        />
      )}

      {/* Khu vực trả lời — chiều cao cố định, cuộn dọc khi dài (đồng bộ template). */}
      <div className="h-[238px] overflow-y-auto pr-2">
        {type === "mcq" && (
          <fieldset className="flex flex-col gap-2.5 border-0 p-0">
            <legend className="sr-only">{t("player.chooseAnswer")}</legend>
            {question.choices.map((choice) => (
              <AnswerChoice
                key={choice.id}
                name={`question-${question.id}`}
                choice={choice}
                label={nodes.choices[choice.id]}
                selected={selectedAnswer === choice.id}
                onSelect={(id: ChoiceId) => onSelectAnswer(id)}
              />
            ))}
          </fieldset>
        )}

        {/* true_false (v2.1): mỗi ý a–d một segmented Đ/S. Nút đang chọn tô đặc
            màu chữ (như huy hiệu chữ cái của lựa chọn đã chọn) — đọc được bằng
            độ sáng, không chỉ bằng màu. */}
        {type === "true_false" && (
          <div className="flex flex-col gap-2.5">
            {SUB_ITEM_IDS.map((sid) => {
              const item = question.subItems?.find((s) => s.id === sid);
              if (!item) return null;
              const sel = decodeTfAnswer(selectedAnswer);
              const current = sel[sid];
              return (
                <div key={sid} className="bg-card flex items-center gap-3 rounded-lg p-3">
                  <span className="text-muted-foreground w-4 shrink-0 text-sm font-semibold">
                    {sid})
                  </span>
                  {nodes.subItems[sid]}
                  <div
                    className="flex shrink-0 gap-1"
                    role="group"
                    aria-label={`Đúng hay Sai — ý ${sid}`}
                  >
                    {([true, false] as const).map((v) => {
                      const active = current === v;
                      return (
                        <button
                          key={String(v)}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onSelectAnswer(encodeTfAnswer({ ...sel, [sid]: v }))}
                          className={`focus-visible:ring-ring/40 min-w-9 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none ${
                            active
                              ? "bg-foreground text-background"
                              : "bg-surface text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {v ? "Đ" : "S"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-muted-foreground mt-1 text-xs">{t("player.tfNotScored")}</p>
          </div>
        )}

        {/* short_answer (v2.1): một ô nhập giá trị ngắn. */}
        {type === "short_answer" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`short-${question.id}`} className="mb-0">
              {t("player.yourAnswer")}
            </Label>
            <Input
              id={`short-${question.id}`}
              value={selectedAnswer ?? ""}
              onChange={(e) => onSelectAnswer(e.target.value)}
              maxLength={LIMITS.MAX_SHORT_ANSWER}
              className="max-w-xs"
              placeholder={t("upload.shortAnswerExample")}
            />
            <p className="text-muted-foreground mt-1 text-xs">{t("player.shortAnswerScored")}</p>
          </div>
        )}

        {/* essay: ô nhập bài làm (bug prod 2026-08-17 — trước đây chỉ hiện một
            dòng chữ "làm ra giấy", nên với đề toàn tự luận như Toán 8 thì màn
            làm bài KHÔNG có chỗ nào để trả lời: người dùng đọc đó là mất field.
            Bản MVP cũ giả định mọi đề đều trắc nghiệm.)
            Chân trang chọn giữa HAI khoá theo cờ AC-067 (UI-D8). Câu cũ
            (`player.essayNotScored`) được GIỮ NGUYÊN VĂN chứ không xoá, vì
            AC-067 tạo ra một khoảng thời gian CÓ THẬT trong đó nó vẫn ĐÚNG:
            tính năng ship ở trạng thái TẮT, bài làm được lưu, và không được
            chấm tự động. Xoá nó trong cùng commit là buộc phải ship một câu
            SAI suốt khoảng ấy.
            Lý do cũ ở đây ("computeScore không bao giờ chấm essay") nay chỉ
            đúng một nửa: `computeScore()` vẫn không chấm, nhưng band ĐƯỢC ghi
            bởi đường bất đồng bộ sau khi nộp — nên câu chữ phải do CỜ chọn,
            không do một sự thật cố định.
            maxLength = TRẦN THẬT của DB: attempt_answers.answer CHECK
            length <= 500. Cắt ở client + đếm ký tự còn lại để người làm bài
            thấy giới hạn TRƯỚC khi gõ hụt, thay vì bị Postgres từ chối nguyên
            lượt nộp bài lúc submit. */}
        {type === "essay" && (
          <div className="flex h-full flex-col gap-2">
            <Label htmlFor={`essay-${question.id}`} className="mb-0">
              {t("player.yourAnswer")}
            </Label>
            <Textarea
              id={`essay-${question.id}`}
              value={selectedAnswer ?? ""}
              onChange={(e) => onSelectAnswer(e.target.value)}
              maxLength={MAX_ATTEMPT_ANSWER}
              placeholder={t("player.essayPlaceholder")}
              className="min-h-32 flex-1 resize-y leading-relaxed"
            />
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <span>{t(essayGradingEnabled ? "player.essayScored" : "player.essayNotScored")}</span>
              <span className="shrink-0 tabular-nums">
                {t("player.charsLeft", {
                  remaining: MAX_ATTEMPT_ANSWER - (selectedAnswer?.length ?? 0),
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Chữ sẽ hiện trong chỗ trống, hoặc undefined nếu câu ấy chưa được trả lời. */
function fillOf(
  chunk: Extract<PassageChunkNode, { kind: "blank" }>,
  answers: Record<string, string>
): string | undefined {
  if (!chunk.questionId) return undefined;
  const selected = answers[chunk.questionId];
  if (!selected) return undefined;
  return chunk.options[selected as ChoiceId];
}

/**
 * Một chỗ trống trong bài đọc.
 *
 * Ba trạng thái, phân biệt bằng VIỀN + NỀN chứ không bằng màu chữ: chỗ trống
 * nằm giữa dòng văn 16px, nên đổi màu chữ ở cỡ ấy vừa khó thấy vừa phá nhịp
 * đọc của cả câu.
 *   - đang làm  → viền vàng nắng + nền vàng nhẹ (cùng ngôn ngữ với lựa chọn
 *                 đang chọn ở AnswerChoice)
 *   - đã điền   → nền surface, chữ đậm vừa, không viền
 *   - còn trống → viền nét đứt, dãy gạch mờ — hình dạng "ô chờ điền"
 *
 * `align-baseline` + `items-baseline`: khối inline-flex mặc định canh theo đáy
 * hộp, nên không có hai dòng này thì mỗi chỗ trống đội dòng chữ quanh nó lên
 * vài pixel và cả đoạn văn gợn sóng.
 */
function PassageBlank({
  chunk,
  filled,
  current,
}: {
  chunk: Extract<PassageChunkNode, { kind: "blank" }>;
  filled: string | undefined;
  current: boolean;
}) {
  const tone = current
    ? "border-sun bg-sun-soft text-foreground"
    : filled
      ? "bg-surface border-transparent text-foreground"
      : "border-border text-muted-foreground border-dashed bg-transparent";
  return (
    <span
      className={`mx-0.5 inline-flex items-baseline gap-1.5 rounded-[6px] border px-1.5 align-baseline transition-colors ${tone}`}
    >
      {chunk.label !== null && (
        <span className="text-[11px] font-semibold tabular-nums">({chunk.label})</span>
      )}
      <span className={filled ? "font-medium" : "text-sm tracking-[0.14em]"}>
        {filled ?? "____"}
      </span>
    </span>
  );
}
