// Off-screen only — never shown to the user. HARD CONSTRAINT (ADR-0009): every
// style value below must be a literal hex or rgb()/rgba() string. No Tailwind
// className anywhere in this file, no components/ui/button.tsx import.
//
// Centered "receipt" layout (2026-08-22 redesign, replaces the old
// logo-header/left-aligned layout) — matches the pdf_format.png design
// reference: eyebrow + accent rule, subject/title, score, examinee/submitted
// row, correct/wrong/total row, brand footer. Every label prop is optional
// with an English default (mirrors the old footerPrefix pattern) so the
// template still stands alone when rendered outside the `t()` flow (unit
// tests) — only the underlying DATA (subject/examTitle/score/examinee/
// correct/total) is required.
export interface AttemptPdfTemplateProps {
  subject: string;
  examTitle: string;
  totalScore: number;
  examineeName: string;
  submittedDateLabel: string;
  submittedTimeLabel: string;
  correct: number;
  total: number;
  resultTitleLabel?: string;
  scoreLabel?: string;
  examineeLabel?: string;
  submittedLabel?: string;
  correctLabel?: string;
  wrongLabel?: string;
  totalQuestionsLabel?: string;
  /** Có ít nhất một câu tự luận ở RS-6 (thất bại VÀ hết lượt) hay không.
   *
   *  BẮT BUỘC, không tuỳ chọn: một mặc định `false` nghĩa là mỗi chỗ dựng mới
   *  im lặng xuất ra một tệp trông như kết quả ĐẦY ĐỦ trong khi nó không phải
   *  — đúng phương án mà O-8 đã cân nhắc và LOẠI. */
  hasIncompleteEssay: boolean;
  /** Nhãn đã dịch cho dòng chú thích ấy. Tuỳ chọn, đúng khuôn mọi nhãn khác ở
   *  đây: bỏ trống thì dùng bản tiếng Anh mặc định bên dưới. */
  essayIncompleteLabel?: string;
}

const DEFAULT_RESULT_TITLE_LABEL = "EXAM RESULT";
const DEFAULT_SCORE_LABEL = "SCORE";
const DEFAULT_EXAMINEE_LABEL = "EXAMINEE";
const DEFAULT_SUBMITTED_LABEL = "SUBMITTED AT";
const DEFAULT_CORRECT_LABEL = "CORRECT";
const DEFAULT_WRONG_LABEL = "WRONG";
const DEFAULT_ESSAY_INCOMPLETE_LABEL =
  "This exam has essay questions that were not scored automatically. The score in this file does not include the essay part.";

function defaultTotalQuestionsLabel(total: number): string {
  return `${total} questions total`;
}

const HAIRLINE = { height: 1, backgroundColor: "#d8c9a8", marginTop: 28 };

const EYEBROW = {
  color: "#605a52",
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase" as const,
};

const SERIF = "'Source Serif 4', serif";

export function AttemptPdfTemplate({
  subject,
  examTitle,
  totalScore,
  examineeName,
  submittedDateLabel,
  submittedTimeLabel,
  correct,
  total,
  resultTitleLabel = DEFAULT_RESULT_TITLE_LABEL,
  scoreLabel = DEFAULT_SCORE_LABEL,
  examineeLabel = DEFAULT_EXAMINEE_LABEL,
  submittedLabel = DEFAULT_SUBMITTED_LABEL,
  correctLabel = DEFAULT_CORRECT_LABEL,
  wrongLabel = DEFAULT_WRONG_LABEL,
  totalQuestionsLabel = defaultTotalQuestionsLabel(total),
  hasIncompleteEssay,
  essayIncompleteLabel,
}: AttemptPdfTemplateProps) {
  const wrong = total - correct;

  return (
    <div
      style={{
        width: 720,
        backgroundColor: "#ede1c8",
        color: "#1b1512",
        padding: 48,
        fontFamily: "'Be Vietnam Pro', sans-serif",
        textAlign: "center",
      }}
    >
      <p style={EYEBROW}>{resultTitleLabel}</p>
      <div style={{ width: 40, height: 2, backgroundColor: "#b8863b", margin: "10px auto 0" }} />

      <h1 style={{ fontFamily: SERIF, color: "#1b1512", fontSize: 34, marginTop: 22 }}>
        {subject}
      </h1>
      <p style={{ color: "#605a52", fontSize: 15, marginTop: 6 }}>{examTitle}</p>

      <div style={HAIRLINE} />

      <p style={{ ...EYEBROW, marginTop: 28 }}>{scoreLabel}</p>
      <p style={{ fontFamily: SERIF, color: "#a62c2b", fontSize: 56, marginTop: 8 }}>
        {totalScore.toFixed(1)}
        <span style={{ fontSize: 20, color: "#605a52" }}>/10</span>
      </p>

      <div style={HAIRLINE} />

      <div style={{ display: "flex", marginTop: 28 }}>
        <div style={{ flex: 1 }}>
          <p style={EYEBROW}>{examineeLabel}</p>
          <p style={{ fontSize: 18, marginTop: 6 }}>{examineeName}</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={EYEBROW}>{submittedLabel}</p>
          <p style={{ fontSize: 18, marginTop: 6 }}>
            {submittedTimeLabel}, {submittedDateLabel}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", marginTop: 24 }}>
        <div style={{ flex: 1 }}>
          <p style={EYEBROW}>{correctLabel}</p>
          <p style={{ fontFamily: SERIF, fontSize: 22, marginTop: 6 }}>{correct}</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={EYEBROW}>{wrongLabel}</p>
          <p style={{ fontFamily: SERIF, fontSize: 22, marginTop: 6 }}>{wrong}</p>
        </div>
      </div>

      <p style={{ color: "#605a52", fontSize: 13, marginTop: 12 }}>{totalQuestionsLabel}</p>

      {/* CHÚ THÍCH TỰ LUẬN CHƯA HOÀN TẤT (O-8). Không chặn xuất ở RS-6 — chặn
          ở một trạng thái CUỐI là chặn vĩnh viễn — nhưng cũng KHÔNG xuất im
          lặng: khi đó tệp trông như một kết quả đầy đủ và KHÔNG CÓ GÌ TRÊN ĐÓ
          NÓI NGƯỢC LẠI, nên người đọc không có cách nào biết một câu bị thiếu
          khỏi điểm.

          Hex viết thẳng `#605a52` — CÙNG giá trị `EYEBROW` đang dùng. Đây là
          NGOẠI LỆ DUY NHẤT ĐƯỢC NÊU TÊN của quy tắc cấm hex, và nó là một RÀNG
          BUỘC CỨNG của ADR-0009 chứ không phải một vi phạm: html2canvas ném
          hoặc render sai nếu bất kỳ style nào trong cây này giải qua các hàm
          màu hiện đại mà token của theme dùng. Không class Tailwind, không
          `components/ui`, không màu mới.

          Ghi chú về câu chữ: hai tên hàm ấy CỐ Ý không được viết ra ở đây —
          một rào chắn sẵn có trong `AttemptPdfTemplate.test.tsx` quét NGUYÊN
          VĂN file này tìm chúng, và cách tôn trọng đúng nhất một rào chắn nói
          "chuỗi này không được xuất hiện trong file" là đừng viết chuỗi ấy. */}
      {hasIncompleteEssay && (
        <p style={{ color: "#605a52", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
          {essayIncompleteLabel ?? DEFAULT_ESSAY_INCOMPLETE_LABEL}
        </p>
      )}

      <div style={HAIRLINE} />

      <p style={{ color: "#605a52", fontSize: 12, letterSpacing: 1.5, marginTop: 20 }}>MS-MOLAR</p>
    </div>
  );
}
