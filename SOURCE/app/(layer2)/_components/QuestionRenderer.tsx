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
import { decodeTfAnswer, encodeTfAnswer } from "@/lib/ugc/tfCodec";
import { RichText } from "@/components/shared/RichText";
import { QuestionFigure } from "@/components/shared/QuestionFigure";
import { AnswerChoice } from "./AnswerChoice";
import { FlagButton } from "./FlagButton";

const SUB_ITEM_IDS: SubItemId[] = ["a", "b", "c", "d"];

interface QuestionRendererProps {
  /** Số thứ tự câu (1-based) — để hiển thị "Câu N". */
  index: number;
  /** Không cần đáp án để render — dùng PublicQuestion (bảo mật, M2.6/v2.1). */
  question: PublicQuestion;
  /** Input hiện tại của câu này (string — xem useExamPlayer), undefined nếu chưa. */
  selectedAnswer?: string;
  onSelectAnswer: (value: string) => void;
  flagged: boolean;
  onToggleFlag: () => void;
}

export function QuestionRenderer({
  index,
  question,
  selectedAnswer,
  onSelectAnswer,
  flagged,
  onToggleFlag,
}: QuestionRendererProps) {
  const t = useT();
  const type = question.questionType ?? "mcq";

  return (
    <div className="border-border flex flex-col gap-5 rounded-lg border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">Question {index}</span>
        <FlagButton flagged={flagged} onToggle={onToggleFlag} />
      </div>

      <RichText text={question.content} className="text-foreground text-lg leading-relaxed" />

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
                  <RichText
                    text={item.text}
                    inline
                    className="text-card-foreground flex-1 text-sm leading-relaxed"
                  />
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
              maxLength={100}
              className="border-border bg-card text-foreground focus:border-ring w-full max-w-xs rounded-md border px-3 py-2 text-sm outline-none"
              placeholder="e.g. 1260 / 1,04"
            />
            <p className="text-muted-foreground mt-1 text-xs italic">
              {t("player.shortAnswerScored")}
            </p>
          </div>
        )}

        {/* essay: người làm bài không nhập bài luận trong player MVP. */}
        {type === "essay" && (
          <p className="text-muted-foreground text-sm italic">{t("player.essayNotScored")}</p>
        )}
      </div>
    </div>
  );
}
