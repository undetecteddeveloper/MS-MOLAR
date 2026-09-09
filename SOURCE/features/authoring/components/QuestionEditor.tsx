"use client";

// QuestionEditor — sửa tại chỗ một câu (UI Spec §QuestionEditor / Task 6.4 + D1).
// Chế độ XEM hiển thị markdown + LaTeX đã render — GIỐNG HỆT màn làm bài. Từ
// TD-027, phần tử đó do SERVER dựng sẵn và đi xuống qua prop `nodes`; chỉ chuỗi
// tác giả VỪA SỬA mới cần tới chunk RichText ở client (xem khối ⚠ bên dưới).
// Trước đây màn này in thẳng chuỗi nguồn, nên đề có công thức hiện ra dưới dạng
// "$\frac{1}{2}$" và tác giả không có cách nào biết đề sẽ hiển thị đúng hay
// không cho tới khi đã publish. Chế độ SỬA vẫn là chuỗi NGUỒN (phải sửa được
// LaTeX thì mới sửa được công thức) — đó là lý do hai chế độ khác nhau.
// Chế độ xem: stem, QuestionFigure cho hình, lựa chọn A–D, đáp án đúng chú
// thích "lấy từ file đáp án"; essay → đáp án mẫu read-only. v2.1 (ADR-0005)
// thêm 2 variant: true_false (4 ý a–d, mỗi ý toggle Đ/S theo file đáp án) và
// short_answer (giá trị mong đợi). Chế độ sửa: input stem/choices/ý/đáp án +
// gỡ hình. Thay đổi đẩy lên ReviewScreen (re-validate live).
//
// Ghi chú phạm vi: THÊM/THAY hình từ màn review chưa hỗ trợ (cần action upload
// hình riêng — ngoài 5 action Task 4.1); MVP chỉ cho GỠ hình (đặt imageUrl=null).
// Hình ban đầu đến từ bước trích xuất.
//
// Theme "Sân trường" (2026-09-09): mỗi câu là thẻ surface bo 18px; câu có lỗi
// mang viền đỏ 2px KÈM huy hiệu "Cần sửa" (trạng thái bằng hình lẫn chữ, §4.3
// — viền đỏ một mình là màu đơn thuần). Huy hiệu A/B/C/D là ô tròn TRẮNG trên
// surface, đáp án đúng tô xanh đặc — cùng ngôn ngữ "huy hiệu đặc = đang chọn"
// của màn làm bài. Ô nhập là primitive Input/Textarea (trắng trên surface, hết
// viền 4px). Nút Sửa/Xong là viên thuốc 36px cỡ nút-trong-thẻ.

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { QuestionFigure } from "@/components/shared/QuestionFigure";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { LIMITS, maxEssayAnswerFor, maxStemFor } from "@/lib/ugc/limits";
import type { AssembledQuestion, ChoiceId, SubItemId } from "@/lib/ugc/types";
import { cn } from "@/lib/utils";
import {
  answerPresentation,
  CHOICE_CLASS,
  STEM_CLASS,
  SUB_ITEM_CLASS,
  type RenderedText,
  type ReviewQuestionNodes,
} from "@/features/authoring/components/reviewNodes.types";

// ---------------------------------------------------------------------------
// RichText Ở MÀN NÀY: node của SERVER là chính, chunk client là đường lui
// (TD-027, 2026-08-27)
// ---------------------------------------------------------------------------
//
// Chế độ XEM lấy phần tử đã render sẵn từ `renderReviewNodes` (server) qua prop
// `nodes`. Nhờ vậy chunk markdown+KaTeX 126.3 KB br KHÔNG nằm trong lượt tải
// đầu của route — nó đi xuống dưới dạng phần tử host trong RSC payload, thứ
// client hydrate được mà không cần một dòng mã nào của react-markdown/KaTeX.
//
// ⚠ ĐỪNG ĐỔI `LazyRichText` THÀNH IMPORT TĨNH, VÀ ĐỪNG BỎ `ssr: false` ⚠
// Một import tĩnh RichText ở file này kéo nguyên 126.3 KB trở lại bundle và
// xoá sạch khoản tiết kiệm — đúng như TD-021 đã đo (route /result/detail đứng
// nguyên 181.8K khi còn MỘT import tĩnh sót lại). Còn `ssr` mặc định thì đã
// được ĐO trên production và KHÔNG được gì: 354.3 → 356.2 KB br, TBT 404 →
// 460ms, vì server vẫn render nên trình duyệt vẫn phải nạp chunk để hydrate.
//
// BẤT BIẾN khiến `ssr: false` an toàn ở đây (nó KHÔNG an toàn ở chỗ khác):
// nhánh `LazyRichText` chỉ chạy khi chuỗi hiện tại KHÁC chuỗi mà server đã
// render. Ở lượt tải đầu, state khởi tạo từ `initialExam` — chính thứ server
// vừa render — nên mọi chuỗi đều khớp và không nhánh nào chạm tới chunk. Muốn
// chuỗi khác đi thì tác giả PHẢI bấm "Sửa" trước, và cú bấm đó đã gọi
// `warmRichText()`. Tức chunk được nạp trong lúc tác giả đang gõ, chứ không
// phải lúc họ bấm "Xong" rồi ngồi chờ. Đây là lý do đây KHÔNG phải cái bẫy
// "trang trống rồi mới có chữ" mà TD-023 cảnh báo.
//
// Cùng một `import()` cho cả `dynamic` lẫn `warmRichText` — bundler gộp về
// MỘT chunk và promise của module được nhớ, nên hâm nóng không tải hai lần.

const LazyRichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), {
  ssr: false,
});

/** Bắt đầu nạp chunk RichText NGAY khi tác giả vào chế độ sửa — xem bất biến ở trên. */
function warmRichText() {
  void import("@/components/shared/RichText");
}

/**
 * Một đoạn nội dung ở chế độ XEM.
 *
 * `rendered` là node server dựng sẵn kèm CHÍNH chuỗi đã dựng ra nó. Còn khớp
 * thì dùng lại (0 byte JS); tác giả vừa sửa thì chuỗi lệch và ta dựng lại bằng
 * chunk client. So sánh CỤC BỘ như thế nên không có cờ dirty nào phải xuyên
 * qua ba tầng component — xem `RenderedText` trong reviewNodes.types.ts.
 *
 * `rendered` vắng mặt là chuyện hợp lệ chứ không phải lỗi: nó cũng là đường
 * chạy khi component được dùng ngoài trang thật (test đơn lẻ).
 */
function ViewText({
  text,
  rendered,
  className,
  inline = false,
}: {
  text: string;
  rendered: RenderedText | undefined;
  className: string;
  inline?: boolean;
}): ReactNode {
  if (rendered && rendered.source === text) return rendered.node;
  return <LazyRichText text={text} inline={inline} className={className} />;
}

const CHOICE_IDS: ChoiceId[] = ["A", "B", "C", "D"];
const SUB_ITEM_IDS: SubItemId[] = ["a", "b", "c", "d"];

const TYPE_LABEL_KEY: Record<AssembledQuestion["type"], MessageKey> = {
  mcq: "upload.typeMcq",
  essay: "upload.typeEssay",
  true_false: "upload.typeTrueFalse",
  short_answer: "upload.typeShortAnswer",
};

/** Nút tròn/viên thuốc chọn trạng thái trong thẻ: trắng khi nghỉ, tô đặc khi
 *  đang chọn. Chung cho huy hiệu A–D và toggle Đ/S. */
const TOGGLE_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-[background-color,color,scale] ease-out motion-safe:active:scale-90 focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none";
const TOGGLE_IDLE =
  "bg-card text-muted-foreground hover:bg-[color-mix(in_oklch,var(--card),var(--foreground)_6%)]";

/** Ô nhập trong thẻ: 40px, chữ 14px — cùng cỡ với panel biểu điểm. */
const FIELD = "h-10 text-sm";
const NOTE = "text-muted-foreground mt-2 text-sm";

interface QuestionEditorProps {
  question: AssembledQuestion;
  /** Cập nhật một phần câu này (ReviewScreen giữ state tổng). */
  onChange: (patch: Partial<AssembledQuestion>) => void;
  /** Câu này có lỗi (để viền cảnh báo + huy hiệu). */
  hasError: boolean;
  /** Nội dung server render sẵn cho CHÍNH câu này (TD-027). Vắng = render ở client. */
  nodes?: ReviewQuestionNodes;
  /** MÔN của đề, dắt từ ReviewScreen xuống để chốt trần độ dài (A6/A7).
   *
   *  KHÔNG dùng `question.topic` dù nó cũng mang tên môn: `topic` là BẢN CHỤP
   *  lúc assemble và chỉ được cascade lại ở server khi lưu, nên nó KHÔNG theo
   *  kịp dropdown môn mà tác giả vừa đổi ngay trên màn này. Lấy topic ở đây =
   *  textarea cắt theo môn CŨ trong khi panel lỗi đã chấm theo môn MỚI, và hai
   *  con số lệch nhau là thứ tác giả không thể nào lý giải được.
   *
   *  Vắng prop → `maxStemFor(undefined)` trả trần RỘNG NHẤT, cùng nhánh
   *  "chưa biết môn" với sentinel "". Cố ý fail-OPEN, ngược với
   *  `essayGradingEnabled` ngay dưới: ở đây chặt tay nghĩa là textarea NUỐT
   *  phím của tác giả giữa chừng một đoạn văn hợp lệ, còn nới tay chỉ dẫn tới
   *  một lỗi hiện rõ trong panel — mà cổng publish thì vẫn chặn thật. */
  subject?: string;
  /** Cờ chấm tự luận, ĐỌC Ở SERVER rồi truyền xuống — component này không bao
   *  giờ tự đọc `process.env` (nó là client, và ở đó biến ấy không tồn tại).
   *
   *  MẶC ĐỊNH `false` chứ không phải `true`: fail-closed, giống hệt ba chỗ đọc
   *  cờ kia. Một call site quên truyền prop sẽ hiện câu chữ CŨ — đúng, chỉ là
   *  cũ — thay vì hứa với tác giả một tính năng có thể đang tắt. */
  essayGradingEnabled?: boolean;
}

export function QuestionEditor({
  question,
  onChange,
  hasError,
  nodes,
  subject,
  essayGradingEnabled = false,
}: QuestionEditorProps) {
  const [editing, setEditing] = useState(false);
  const q = question;
  const empty = <span className="text-destructive">{t("upload.emptyPlaceholder")}</span>;
  // Cùng nguồn trần với validateAssembledExam — nếu hai bên lệch, tác giả gõ
  // tới trần của textarea rồi vẫn thấy lỗi "quá dài" mà không gõ thêm được.
  const maxStem = maxStemFor(subject);
  const maxEssayAnswer = maxEssayAnswerFor(subject);

  // A2/A3 — số ô hiện ra là số ý/lựa chọn CÓ THẬT, cộng đúng MỘT ô trống để
  // thêm tiếp. Trước đây chế độ sửa luôn vẽ đủ 4 ô bất kể đề có mấy: câu
  // True/False một mệnh đề hiện ra kèm 3 ô thừa, và tác giả không có cách nào
  // hiểu 3 ô đó là "không cần điền" hay "đề đọc sót".
  //
  // Ô trống không tự sinh ra dữ liệu — chỉ khi tác giả GÕ vào nó thì phần tử
  // mới xuất hiện, và xoá trắng thì phần tử biến mất (xem onChange bên dưới).
  // Nhờ vậy "4 ô trống" không còn biến thành 4 ý rỗng rồi đẻ ra 4 EMPTY_CHOICE.
  const slots = <T extends string>(all: readonly T[], present: readonly T[], max: number): T[] => {
    const used = all.filter((id) => present.includes(id));
    if (!editing || used.length >= max) return used;
    const free = all.find((id) => !used.includes(id));
    return free ? all.filter((id) => used.includes(id) || id === free) : used;
  };
  const choiceSlots = slots(
    CHOICE_IDS,
    (q.choices ?? []).map((c) => c.id),
    LIMITS.MAX_CHOICES
  );
  const subItemSlots = slots(
    SUB_ITEM_IDS,
    (q.subItems ?? []).map((si) => si.id),
    LIMITS.MAX_SUB_ITEMS
  );

  return (
    <Card
      as="li"
      id={`p${q.part}q${q.number}`}
      // Viền lỗi bằng `outline` (không chiếm chỗ) để thẻ có lỗi không dày hơn
      // thẻ bên cạnh 2px — cùng đệm, cùng bề rộng nội dung.
      className={cn(
        "scroll-mt-24 gap-0",
        hasError && "outline-destructive outline-2 -outline-offset-2"
      )}
    >
      {/* Hàng tiêu đề KHÔNG xuống dòng ở cấp này: khi nó xuống dòng, nhóm bên
          phải (điểm + nút Sửa) rơi xuống dòng hai và `justify-between` dồn nó
          về mép TRÁI — nút hành động của thẻ nhảy vào giữa thẻ, mỗi thẻ một
          chỗ (thấy ở 360px, thẻ có huy hiệu lỗi, 2026-09-09). Thay vào đó chỗ
          co giãn là nhóm NHÃN bên trái: hết chỗ thì huy hiệu tụt xuống dòng
          dưới, còn điểm và nút Sửa đứng yên ở mép phải mọi thẻ — đúng cột mà
          tác giả lướt dọc để soát biểu điểm. */}
      <div className="flex items-center justify-between gap-x-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="mr-0.5 text-sm font-semibold">
            {t("upload.questionLabel", { number: q.number })}
          </span>
          <Badge variant="plain">{t(TYPE_LABEL_KEY[q.type])}</Badge>
          {hasError && (
            <Badge variant="wrong">
              <span aria-hidden>▲</span>
              {t("status.needsFixing")}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* B1 — ĐIỂM của câu. Ở hàng tiêu đề chứ không nằm dưới cùng: nó là
              thuộc tính của cả câu, ngang hàng với loại câu, và tác giả soát
              biểu điểm bằng cách lướt dọc mép phải chứ không mở từng thẻ.

              Chế độ XEM chỉ in khi đề có khai điểm — đề thuần trắc nghiệm cân
              bằng thì một dòng "1 điểm" trên cả 40 thẻ là nhiễu thuần tuý.
              Chế độ SỬA luôn hiện ô, kể cả khi trống, vì đó là lúc tác giả cần
              biết rằng ô ấy TỒN TẠI để mà điền. */}
          {editing ? (
            <label className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                // `any`, KHÔNG phải "0.25": thang bậc PHẦN II có bậc 0.1, và
                // với step="0.25" trình duyệt coi 0.1 là giá trị không hợp lệ
                // (Firefox tô đỏ ô) trong khi cổng publish lại chấp nhận nó —
                // hai nơi nói ngược nhau về cùng một con số.
                step="any"
                value={q.points ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return onChange({ points: undefined });
                  const n = Number(raw);
                  // Số không hợp lệ ⇒ GIỮ NGUYÊN giá trị cũ, không ghi
                  // `undefined`: gõ dở "0." không được phép xoá mất điểm câu.
                  if (!Number.isFinite(n) || n <= 0) return;
                  onChange({ points: n });
                }}
                aria-label={t("upload.pointsLabel")}
                className="h-9 w-20 px-3 text-right text-sm"
              />
              {t("upload.pointsSuffix")}
            </label>
          ) : (
            q.points !== undefined && (
              <span className="text-muted-foreground text-sm tabular-nums">
                {t("upload.pointsValue", { points: String(q.points) })}
              </span>
            )
          )}
          {/* Đang sửa: nút Xong TRẮNG (`plain`) — `secondary` là surface trên
              surface, tan vào thẻ và trông như một chữ trơ. */}
          <Button
            type="button"
            variant={editing ? "plain" : "ghost"}
            size="sm"
            onClick={() => {
              // Vào chế độ sửa = tác giả sắp làm chuỗi lệch khỏi node của
              // server, tức sắp cần chunk RichText. Nạp NGAY từ đây để nó về
              // trong lúc họ đang gõ, chứ không phải lúc họ bấm "Xong" rồi chờ.
              if (!editing) warmRichText();
              setEditing((v) => !v);
            }}
          >
            {editing ? t("common.done") : t("common.edit")}
          </Button>
        </div>
      </div>

      {/* NGỮ LIỆU DÙNG CHUNG (A1) — chỉ ĐỌC ở đây, có chủ đích: nó thuộc về
          NHÓM câu chứ không của riêng câu này, nên một ô sửa trên mỗi card sẽ
          là N ô cùng ghi vào một chỗ. Sửa nội dung bài đọc nằm ở khối riêng
          trên đầu màn review. Ở đây tác giả chỉ cần thấy câu hỏi này gắn với
          bài đọc nào. */}
      {nodes?.passage && (
        <details className="bg-card mt-3 rounded-xl px-4 py-3">
          <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
            {nodes.passageTitle ?? t("upload.sharedPassage")}
          </summary>
          <div className="mt-2 max-h-60 overflow-y-auto">{nodes.passage.node}</div>
        </details>
      )}

      {/* Stem */}
      {editing ? (
        <Textarea
          value={q.stem}
          onChange={(e) => onChange({ stem: e.target.value })}
          maxLength={maxStem}
          rows={3}
          className="mt-3 min-h-24 resize-y text-sm"
          placeholder={t("upload.questionText")}
        />
      ) : (
        <ViewText text={q.stem} rendered={nodes?.stem} className={STEM_CLASS} />
      )}

      {/* Hình */}
      {q.imageUrl && (
        <div className="mt-3">
          <QuestionFigure url={q.imageUrl} questionNumber={q.number} className="max-h-72 w-auto" />
          {editing && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => onChange({ imageUrl: undefined })}
              className="mt-1 px-0"
            >
              {t("upload.removeImage")}
            </Button>
          )}
        </div>
      )}

      {/* MCQ: lựa chọn + đáp án đúng */}
      {q.type === "mcq" && (
        <div className="mt-4 flex flex-col gap-2">
          {choiceSlots.map((cid) => {
            const choice = q.choices?.find((c) => c.id === cid);
            const isCorrect = q.correctAnswer === cid;
            return (
              <div key={cid} className="flex items-center gap-3">
                <button
                  type="button"
                  aria-pressed={isCorrect}
                  aria-label={t("upload.markChoiceCorrect", { choice: cid })}
                  onClick={() => onChange({ correctAnswer: cid })}
                  className={cn(
                    TOGGLE_BASE,
                    "size-9",
                    isCorrect ? "bg-primary text-primary-foreground" : TOGGLE_IDLE
                  )}
                >
                  {cid}
                </button>
                {editing ? (
                  <Input
                    value={choice?.text ?? ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      const others = (q.choices ?? []).filter((c) => c.id !== cid);
                      // Xoá trắng = GỠ lựa chọn, không phải giữ một lựa chọn
                      // rỗng: giữ lại sẽ đẻ ra EMPTY_CHOICE cho đúng cái ô mà
                      // tác giả vừa cố ý dọn đi.
                      const next = (text === "" ? others : [...others, { id: cid, text }]).sort(
                        (a, b) => CHOICE_IDS.indexOf(a.id) - CHOICE_IDS.indexOf(b.id)
                      );
                      onChange({ choices: next });
                    }}
                    maxLength={LIMITS.MAX_CHOICE}
                    className={cn(FIELD, "flex-1")}
                    placeholder={t("upload.choicePlaceholder", { choice: cid })}
                  />
                ) : choice ? (
                  <ViewText
                    text={choice.text}
                    rendered={nodes?.choices[cid]}
                    className={CHOICE_CLASS}
                    inline
                  />
                ) : (
                  <span className="flex-1 text-sm">{empty}</span>
                )}
              </div>
            );
          })}
          <p className={NOTE}>
            {t("upload.correctAnswer")}{" "}
            {q.correctAnswer ? (
              <>
                <span className="text-foreground font-semibold">{q.correctAnswer}</span>{" "}
                {t("upload.fromYourAnswerFile")}
              </>
            ) : (
              <span className="text-destructive">{t("upload.notSet")}</span>
            )}
          </p>
        </div>
      )}

      {/* true_false (v2.1): các ý a–d, mỗi ý toggle Đ/S theo file đáp án.
          A2: số ý là số ý CÓ THẬT (1–4), không còn cứng 4. */}
      {q.type === "true_false" && (
        <div className="mt-4 flex flex-col gap-2">
          {subItemSlots.map((sid) => {
            const item = q.subItems?.find((s) => s.id === sid);
            if (!item && !editing) return null;
            const answer = q.subAnswers?.[sid];
            return (
              <div key={sid} className="flex items-center gap-3">
                <span className="text-muted-foreground w-5 shrink-0 text-sm font-semibold">
                  {sid})
                </span>
                {editing ? (
                  <Input
                    value={item?.text ?? ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      const others = (q.subItems ?? []).filter((s) => s.id !== sid);
                      // Xoá trắng = GỠ ý (cùng lý do với lựa chọn mcq ở trên).
                      const next = (text === "" ? others : [...others, { id: sid, text }]).sort(
                        (a, b) => SUB_ITEM_IDS.indexOf(a.id) - SUB_ITEM_IDS.indexOf(b.id)
                      );
                      onChange({ subItems: next });
                    }}
                    maxLength={LIMITS.MAX_CHOICE}
                    className={cn(FIELD, "flex-1")}
                    placeholder={t("upload.statementPlaceholder", { item: sid })}
                  />
                ) : item ? (
                  <ViewText
                    text={item.text}
                    rendered={nodes?.subItems[sid]}
                    className={SUB_ITEM_CLASS}
                    inline
                  />
                ) : (
                  <span className="flex-1 text-sm">{empty}</span>
                )}
                {/* Toggle Đ/S — đáp án của ý này (từ file đáp án, sửa được).
                    Đ đang chọn tô xanh, S đang chọn tô đỏ; chữ Đ/S là kênh
                    thông tin, màu chỉ tô thêm. */}
                <div
                  className="flex shrink-0 gap-1"
                  role="group"
                  aria-label={t("upload.answerForItem", { item: sid })}
                >
                  {([true, false] as const).map((v) => {
                    const active = answer === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange({ subAnswers: { ...q.subAnswers, [sid]: v } })}
                        className={cn(
                          TOGGLE_BASE,
                          "size-9",
                          active
                            ? v
                              ? "bg-primary text-primary-foreground"
                              : "bg-destructive text-white"
                            : TOGGLE_IDLE
                        )}
                      >
                        {v ? "Đ" : "S"}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className={NOTE}>
            {t("upload.tfPerStatement")} {t("upload.storedNotScored")}
          </p>
        </div>
      )}

      {/* short_answer (v2.1): giá trị mong đợi */}
      {q.type === "short_answer" && (
        <div className="mt-4">
          <p className="text-muted-foreground text-sm">{t("upload.expectedAnswer")}</p>
          {editing ? (
            <Input
              value={q.essayAnswer ?? ""}
              onChange={(e) => onChange({ essayAnswer: e.target.value })}
              maxLength={LIMITS.MAX_SHORT_ANSWER}
              className={cn(FIELD, "mt-1")}
              placeholder={t("upload.shortAnswerExample")}
            />
          ) : q.essayAnswer ? (
            <ViewText
              text={q.essayAnswer}
              rendered={nodes?.answer}
              {...answerPresentation(q.type)}
            />
          ) : (
            <p className="bg-card mt-1 rounded-xl px-4 py-2.5 text-sm">{empty}</p>
          )}
          <p className={NOTE}>{t("upload.shortAnswerStored")}</p>
        </div>
      )}

      {/* Essay: đáp án mẫu */}
      {q.type === "essay" && (
        <div className="mt-4">
          <p className="text-muted-foreground text-sm">{t("upload.modelAnswer")}</p>
          {editing ? (
            <Textarea
              value={q.essayAnswer ?? ""}
              onChange={(e) => onChange({ essayAnswer: e.target.value })}
              maxLength={maxEssayAnswer}
              rows={4}
              className="mt-1 resize-y text-sm"
            />
          ) : q.essayAnswer ? (
            <ViewText
              text={q.essayAnswer}
              rendered={nodes?.answer}
              {...answerPresentation(q.type)}
            />
          ) : (
            <p className="bg-card mt-1 rounded-xl p-4 text-sm">{empty}</p>
          )}
          {/* OQ-5 / Task E4, quyết định (b) — HAI KHOÁ CHỌN THEO CỜ, không phải
              một khoá viết lại.

              Chuỗi cũ ("đã lưu, chưa chấm tự động") nói với TÁC GIẢ ĐỀ rằng
              tự luận không được chấm. Nó thành SAI đúng lúc cờ bật. Nhưng chỉ
              viết đè lên nó thì sai theo chiều NGƯỢC LẠI mỗi khi cờ tắt — và
              cờ này CÓ đường tắt: E6 giữ một kill switch, còn preview thì
              không nhất thiết mang cùng biến với production.

              Nên giữ cả hai và chọn theo cờ, đúng khuôn `player.essayScored` /
              `player.essayNotScored` mà AC-051 / UI-D8 đã dựng cho màn làm bài
              (Task F-D1). Một khoá thì luôn có một trạng thái nó nói dối. */}
          <p className={NOTE}>
            {t(essayGradingEnabled ? "upload.essayScored" : "upload.essayStored")}
          </p>
        </div>
      )}
    </Card>
  );
}
