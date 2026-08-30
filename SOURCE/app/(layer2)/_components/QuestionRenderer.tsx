// QuestionRenderer — hiển thị nội dung một câu hỏi + khu vực trả lời (Layer 2).
// GĐ 3 M3.1 Task 2: đồng bộ layout TEMPLATE/L2/ExamPage — card hairline bo góc
// 8px, hàng đầu "Câu N" + FlagButton, khu vực trả lời cao cố định 238px cuộn
// dọc khi nội dung dài.
// Task 5: nội dung render markdown + LaTeX qua <RichText>.
// v2.1 (ADR-0005, Task D2): thêm 2 dạng trả lời — true_false (4 ý a–d, mỗi ý
// segmented Đ/S; input mã hoá tfCodec thành 1 chuỗi) và short_answer (ô nhập
// ngắn). Cả hai "Not auto-scored yet" (product decision — chấm điểm là feature
// riêng); KHÔNG đáp án nào có mặt ở client (PublicQuestion đã Omit).

"use client";
import { useT } from "@/lib/i18n/client";

import type { ChoiceId, PublicQuestion, SubItemId } from "@/types/question";
import { LIMITS } from "@/lib/ugc/limits";
import { decodeTfAnswer, encodeTfAnswer } from "@/lib/ugc/tfCodec";
import type { QuestionNodes } from "./questionNodes.types";
import { QuestionFigure } from "@/components/shared/QuestionFigure";
import { AnswerChoice } from "./AnswerChoice";
import { FlagButton } from "./FlagButton";

const SUB_ITEM_IDS: SubItemId[] = ["a", "b", "c", "d"];
const MAX_ATTEMPT_ANSWER = LIMITS.MAX_ATTEMPT_ANSWER;

interface QuestionRendererProps {
  /** Số thứ tự câu (1-based) — để hiển thị "Câu N". */
  index: number;
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
  question,
  nodes,
  selectedAnswer,
  onSelectAnswer,
  flagged,
  onToggleFlag,
  essayGradingEnabled = false,
}: QuestionRendererProps) {
  const t = useT();
  const type = question.questionType ?? "mcq";

  return (
    <div className="border-border flex flex-col gap-5 rounded-lg border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">{t("upload.questionLabel", { number: index })}</span>
        <FlagButton flagged={flagged} onToggle={onToggleFlag} />
      </div>

      {/* Nội dung câu hỏi — `font-serif` + một nấc cỡ chữ so với trước.
          Serif KHÔNG phải trang trí: DESIGN.md xếp serif cho "tiêu đề & nội
          dung đọc", và màn xem lại bài (result/detail) VỐN ĐÃ render thân câu
          hỏi bằng `font-serif text-lg` — player mới là chỗ lệch chuẩn. Cho hai
          màn cùng một khuôn mặt chữ nghĩa là cùng một câu hỏi trông giống nhau
          dù đang làm bài hay đang dò lại.
          Nó cũng tách thân câu hỏi khỏi phần CÒN LẠI của màn hình, vốn sans
          hết: nhãn "Câu N", nút, và quan trọng nhất là các LỰA CHỌN
          (AnswerChoice, sans 16px). Trước thay đổi này câu hỏi 18px và lựa chọn
          16px cùng font cùng màu — cách nhau đúng 2px, nên mắt không có mỏ neo
          để biết đọc cái nào trước. Nay khác cả font lẫn cỡ (20px so với 16px).
          Giữ 18px ở mobile: màn hẹp thì mỗi nấc cỡ chữ ăn thêm một dòng, và
          khu vực trả lời bên dưới cao CỐ ĐỊNH 238px nên phần đọc được của câu
          hỏi là thứ bị ép trước tiên. */}
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

        {/* true_false (v2.1): mỗi ý a–d một segmented Đ/S. */}
        {type === "true_false" && (
          <div className="flex flex-col gap-2.5">
            {SUB_ITEM_IDS.map((sid) => {
              const item = question.subItems?.find((s) => s.id === sid);
              if (!item) return null;
              const sel = decodeTfAnswer(selectedAnswer);
              const current = sel[sid];
              return (
                <div
                  key={sid}
                  className="border-border bg-card flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="text-muted-foreground w-4 shrink-0 font-mono text-sm">
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
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border text-muted-foreground hover:border-ring"
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
            <p className="text-muted-foreground mt-1 text-xs italic">{t("player.tfNotScored")}</p>
          </div>
        )}

        {/* short_answer (v2.1): một ô nhập giá trị ngắn. */}
        {type === "short_answer" && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`short-${question.id}`} className="text-muted-foreground text-xs">
              {t("player.yourAnswer")}
            </label>
            <input
              id={`short-${question.id}`}
              value={selectedAnswer ?? ""}
              onChange={(e) => onSelectAnswer(e.target.value)}
              maxLength={LIMITS.MAX_SHORT_ANSWER}
              className="border-border bg-card text-foreground focus:border-ring w-full max-w-xs rounded-md border px-3 py-2 text-sm outline-none"
              placeholder="e.g. 1260 / 1,04"
            />
            <p className="text-muted-foreground mt-1 text-xs italic">
              {t("player.shortAnswerScored")}
            </p>
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
            <label htmlFor={`essay-${question.id}`} className="text-muted-foreground text-xs">
              {t("player.yourAnswer")}
            </label>
            <textarea
              id={`essay-${question.id}`}
              value={selectedAnswer ?? ""}
              onChange={(e) => onSelectAnswer(e.target.value)}
              maxLength={MAX_ATTEMPT_ANSWER}
              placeholder={t("player.essayPlaceholder")}
              className="border-border bg-card text-foreground focus:border-ring min-h-32 w-full flex-1 resize-y rounded-md border px-3 py-2 text-sm leading-relaxed outline-none"
            />
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
              <span className="italic">
                {t(essayGradingEnabled ? "player.essayScored" : "player.essayNotScored")}
              </span>
              <span className="shrink-0 tabular-nums">
                {t("player.charsLeft", {
                  remaining: MAX_ATTEMPT_ANSWER - (selectedAnswer?.length ?? 0),
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
