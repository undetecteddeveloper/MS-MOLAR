// EssayReviewBlock — trình bày MỘT câu tự luận trên `/result/detail`, năm
// trạng thái RS-2…RS-6 (UI Spec § Component: EssayReviewBlock).
//
// ═══ NÓ LÀ MỘT NHÁNH CON BÊN TRONG `notScored`, KHÔNG PHẢI MỘT NHÁNH THỨ BA ═══
//
// Dưới W1, một câu tự luận LUÔN rơi vào nhánh `notScored`, ở CẢ BA trạng thái
// vòng đời — `scored` và `isCorrect` đều `false` vĩnh viễn. Nên trình bày tự
// luận là một nhánh CON, rẽ theo `essayState` (UI-D1); nó không bao giờ là một
// nhánh mới đứng cạnh, và không bao giờ đụng tới nhánh CÓ-chấm.
//
// ═══ LUẬT CỨNG, VÀ NÓ ĐƯỢC CƯỠNG CHẾ BẰNG CẤU TRÚC ═══
//
// Mọi nhánh rẽ theo `EssayView.state`, KHÔNG BAO GIỜ theo `scored` hay
// `isCorrect`. Cả hai đều `false` ở CẢ BẢY trạng thái nên chúng không phân biệt
// được gì — trong khi chúng nằm ngay đó, trong cùng object mà mã render đang
// cầm. Cơ chế chặn KHÔNG phải kỷ luật: props của component này KHÔNG MANG hai
// trường ấy, nên đọc chúng là một lỗi BIÊN DỊCH (MSA-F6).
//
// Cùng lý do, props cũng KHÔNG mang `hasBeenWrongTwice`: `ExplainStepAffordance`
// không bao giờ được mount cho một câu tự luận (AC-016), và cách chắc chắn nhất
// để điều đó đúng là làm cho nó không biên dịch được.
//
// ═══ RS-2 GIẤU ĐÁP ÁN MẪU — QUYẾT ĐỊNH VỀ TRẢI NGHIỆM ĐỌC, KHÔNG PHẢI BẢO MẬT ═══
//
// `getResult()` ĐÃ được phép trả đáp án mẫu sau khi nộp (`queries.ts:633-657`),
// và AC-043 ràng buộc đường ĐANG LÀM BÀI chứ không ràng buộc màn xem lại. Lý do
// giấu là khác: đưa đáp án mẫu ra TRƯỚC khi có band là mời học sinh tự chấm rồi
// vài giây sau bị chính con số đáp xuống phản bác.
//
// ═══ BÀI LÀM CỦA HỌC SINH LÀ TEXT NODE, KHÔNG QUA `RichText` ═══
//
// ADR-0002 đọc NGƯỢC: mở một đường markdown/KaTeX cho văn bản do HỌC SINH soạn
// là một bề mặt mới mà hôm nay không ai thiếu. Nhánh không-chấm hiện tại cũng
// đang in text thuần. `whitespace-pre-wrap break-words` giữ xuống dòng của học
// sinh mà không diễn giải gì.

import { EssayLifecycleBadge } from "@/components/essay/EssayLifecycleBadge";
import { EssayRegradeControl } from "./EssayRegradeControl";
import { getTranslate } from "@/lib/i18n/server";
import { isEssayIncomplete, type EssayView } from "@/lib/scoring/essayLifecycle";

/** Bảng tra NĂM chuỗi (UI-D12) — KHÔNG `toFixed`, KHÔNG làm tròn, KHÔNG nội suy.
 *
 *  Tập band là ĐÓNG và chỉ có năm phần tử, nên một bảng tra làm cho việc render
 *  một giá trị THỨ SÁU trở thành bất khả thi VỀ MẶT CẤU TRÚC — thay vì phụ thuộc
 *  vào việc validator ở tầng ghi luôn đúng. Một hàm định dạng thì render `0.3`
 *  gọn gàng y như render `0.25`, tức là nó CHE đúng cái khuyết tật mà W3 nói SQL
 *  sẽ không bắt được. */
const BAND_LABEL: Record<string, string> = {
  "0": "0",
  "0.25": "0.25",
  "0.5": "0.5",
  "0.75": "0.75",
  "1": "1",
};

/** Nhãn phụ đứng cạnh bài làm — dùng lại chuỗi sẵn có của nhánh không-chấm. */
function AnswerRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="text-muted-foreground">{label}</p>
      {/* Text node, không phải RichText — xem đầu file. */}
      <p className="text-foreground break-words whitespace-pre-wrap">{text}</p>
    </div>
  );
}

export async function EssayReviewBlock({
  view,
  studentAnswer,
  modelAnswer,
  attemptId,
  questionId,
}: {
  /** Trạng thái ĐÃ SUY RA. Đây là thứ DUY NHẤT được rẽ nhánh. */
  view: EssayView;
  studentAnswer: string;
  modelAnswer: string;
  /** Hai định danh mà nút chấm lại cần. Chúng KHÔNG phải trạng thái và không
   *  được rẽ nhánh theo — thêm chúng không mở lại đường đọc `scored`/
   *  `isCorrect` mà LUẬT CỨNG ở đầu file đóng lại. */
  attemptId: string;
  questionId: string;
}) {
  const t = await getTranslate();

  // RS-6 = "thất bại VÀ hết lượt". Biểu thức ấy KHÔNG được viết lại ở đây:
  // `isEssayIncomplete()` là LỜI KHAI DUY NHẤT của RS-6 trong toàn repo
  // (EG-BE-036), và một phép quét mã nguồn trong `essayLifecycle.test.ts` cưỡng
  // chế điều đó — bản nháp đầu của file này tự suy lại
  // `state === "failed" && !retryAvailable` và làm đúng ca kiểm ấy ĐỎ. Hai lời
  // khai của cùng một trạng thái là hai chỗ để chúng trôi lệch nhau, và RS-6 là
  // trạng thái CUỐI: lệch ở đây nghĩa là một học sinh còn lượt bị bảo là hết,
  // hoặc ngược lại.
  //
  // `failed` + còn lượt ⇒ RS-4/RS-5 (giống nhau TỪNG CHỮ, UI-D6).
  const exhausted = isEssayIncomplete(view);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <EssayLifecycleBadge state={view.state} />

        {view.state === "graded" && view.earned !== null && (
          <span className="font-serif text-lg tabular-nums">
            {t("result.essay.band", {
              band: BAND_LABEL[String(view.earned)] ?? String(view.earned),
            })}
          </span>
        )}

        {/* Cờ tin cậy thấp là CHỮ, không phải màu, và nó KHÔNG đổi con số nào
            (AC-047) — nó chỉ mời học sinh đối chiếu. */}
        {view.state === "graded" && view.lowConfidence && (
          <span className="text-muted-foreground text-xs font-medium">
            {t("result.essay.lowConfidence")}
          </span>
        )}
      </div>

      {view.state === "graded" && view.lowConfidence && (
        <p className="text-muted-foreground text-sm">{t("result.essay.lowConfidenceHelp")}</p>
      )}

      {view.state === "pending" && (
        <p className="text-muted-foreground text-sm">{t("result.essay.pendingBody")}</p>
      )}

      {view.state === "failed" && (
        <div className="flex flex-col gap-1 text-sm">
          {/* RS-4 và RS-5 giống nhau TỪNG CHỮ (UI-D6): một câu "kẹt pending quá
              hạn" và một câu "chấm hỏng" là cùng một sự thật với học sinh — bài
              chưa có điểm và bấm được nút chấm lại. */}
          <p className="text-muted-foreground">{t("result.essay.failedBody")}</p>
          {exhausted ? (
            <p className="text-muted-foreground">{t("result.essay.retryExhausted")}</p>
          ) : (
            // UI-D9: KHÔNG nêu số lượt còn lại — con số ấy tụt vì những lý do
            // học sinh không gây ra. Câu này nói đúng cơ học thay vì hứa một số.
            <p className="text-muted-foreground">{t("result.essay.attemptsNote")}</p>
          )}

          {/* Nút chấm lại có mặt ở CẢ BA trạng thái thất bại, KỂ CẢ RS-6. Ở
              RS-6 nó `aria-disabled` nhưng VẪN nằm trong cây và VẪN focus được
              — gỡ nó đi sẽ lấy mất của người dùng bàn phím cả cái nút LẪN câu
              giải thích vì sao nó không bấm được (AC-064). */}
          <div className="pt-1">
            <EssayRegradeControl
              attemptId={attemptId}
              questionId={questionId}
              exhausted={exhausted}
            />
          </div>
        </div>
      )}

      <AnswerRow label={t("result.yourAnswerLabel")} text={studentAnswer || t("result.skipped")} />

      {/* RS-2 GIẤU đáp án mẫu — xem đầu file. Mọi trạng thái khác đều hiện. */}
      {view.state !== "pending" && (
        <AnswerRow label={t("result.storedAnswerLabel")} text={modelAnswer || "—"} />
      )}
    </div>
  );
}
