// Off-screen only — never shown to the user. HARD CONSTRAINT (ADR-0009): every
// colour below must be a literal hex or rgb()/rgba() string. No Tailwind
// className anywhere in this file, no components/ui/button.tsx import.
// html2canvas throws or paints wrong when a style resolves through the modern
// colour functions theme tokens use (their names are deliberately NOT written
// here: AttemptPdfTemplate.test.tsx scans this file's text for them).
//
// Theme "Sân trường" (2026-09-13, engineer test on a real phone: the file still
// carried the old cream/red "Mực & Sơn mài" look). Values are the resolved hex
// of app/globals.css `:root`, copied by hand because tokens cannot be read
// here: white page `#ffffff`, ink `#14291c`, muted `#4f6656`, surface tint
// `#eef7f1` (layering by tinted fill, no borders), action green `#117a45`,
// wrong red `#c43e2a`, hairline `#cfe3d6`, and ONE bold place — sun yellow
// `#ffc531` as the short rule under the eyebrow. Change a token in globals.css
// → change the twin literal here.
//
// Font: the page's own Lexend via the CSS variable next/font sets on <html>
// (`--font-lexend`, app/layout.tsx). The container is mounted under
// document.body, so the variable is inherited and getComputedStyle — which is
// what html2canvas reads — resolves it to the self-hosted face. A literal
// family name ("Lexend") would NOT match next/font's hashed @font-face name.
// The old template named two fonts the site no longer loads and fell back to
// the system face.
//
// Centered "receipt" layout: eyebrow + sun rule, subject/title, score panel
// (tinted), examinee/submitted row, correct/wrong cells with the same colour
// dots as ScoreCard, total-questions line, brand footer. Every label prop is
// optional with an English default (mirrors the old footerPrefix pattern) so
// the template still stands alone when rendered outside the `t()` flow (unit
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

const DEFAULT_RESULT_TITLE_LABEL = "Exam result";
const DEFAULT_SCORE_LABEL = "Score";
const DEFAULT_EXAMINEE_LABEL = "Examinee";
const DEFAULT_SUBMITTED_LABEL = "Submitted at";
const DEFAULT_CORRECT_LABEL = "Correct";
const DEFAULT_WRONG_LABEL = "Wrong";
const DEFAULT_ESSAY_INCOMPLETE_LABEL =
  "This exam has essay questions that were not scored automatically. The score in this file does not include the essay part.";

function defaultTotalQuestionsLabel(total: number): string {
  return `${total} questions total`;
}

const INK = "#14291c";
const MUTED = "#4f6656";
const SURFACE = "#eef7f1";
const GREEN = "#117a45";
const RED = "#c43e2a";

const HAIRLINE = { height: 1, backgroundColor: "#cfe3d6", marginTop: 28 };

// Cùng `.eyebrow` của globals.css: 12px, đậm 600, chữ phụ — KHÔNG in hoa, không
// giãn chữ (nhãn in hoa khó đọc với dấu tiếng Việt, design doc §5).
const EYEBROW = {
  color: MUTED,
  fontSize: 12,
  fontWeight: 600 as const,
  margin: 0,
};

const TABULAR = { fontVariantNumeric: "tabular-nums" as const };

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
        backgroundColor: "#ffffff",
        color: INK,
        padding: 48,
        fontFamily: "var(--font-lexend), system-ui, sans-serif",
        textAlign: "center",
        lineHeight: 1.3,
      }}
    >
      <p style={EYEBROW}>{resultTitleLabel}</p>
      {/* Chỗ táo bạo DUY NHẤT của tệp: một vạch vàng nắng ngắn (§4.1). */}
      <div
        style={{ width: 40, height: 4, backgroundColor: "#ffc531", borderRadius: 2, margin: "10px auto 0" }}
      />

      <h1 style={{ color: INK, fontSize: 34, fontWeight: 700, margin: "20px 0 0" }}>{subject}</h1>
      <p style={{ color: MUTED, fontSize: 15, margin: "6px 0 0" }}>{examTitle}</p>

      {/* Ô điểm — nền surface, cùng ngôn ngữ với thẻ điểm ở trang kết quả. */}
      <div style={{ backgroundColor: SURFACE, borderRadius: 18, padding: "24px 28px", marginTop: 28 }}>
        <p style={EYEBROW}>{scoreLabel}</p>
        <p style={{ ...TABULAR, color: GREEN, fontSize: 64, fontWeight: 700, lineHeight: 1, margin: "10px 0 0" }}>
          {totalScore.toFixed(1)}
          <span style={{ color: MUTED, fontSize: 20, fontWeight: 500, marginLeft: 6 }}>/10</span>
        </p>
      </div>

      <div style={{ display: "flex", marginTop: 28 }}>
        <div style={{ flex: 1 }}>
          <p style={EYEBROW}>{examineeLabel}</p>
          <p style={{ fontSize: 18, fontWeight: 500, margin: "6px 0 0" }}>{examineeName}</p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={EYEBROW}>{submittedLabel}</p>
          <p style={{ ...TABULAR, fontSize: 18, fontWeight: 500, margin: "6px 0 0" }}>
            {submittedTimeLabel}, {submittedDateLabel}
          </p>
        </div>
      </div>

      {/* Đúng / Sai — hai ô surface, chấm màu ĐI KÈM chữ (trạng thái bằng
          hình lẫn màu, §4.3), cùng cặp màu với ScoreCard. */}
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <StatCell label={correctLabel} value={correct} dot={GREEN} />
        <StatCell label={wrongLabel} value={wrong} dot={RED} />
      </div>

      <p style={{ color: MUTED, fontSize: 13, margin: "12px 0 0" }}>{totalQuestionsLabel}</p>

      {/* CHÚ THÍCH TỰ LUẬN CHƯA HOÀN TẤT (O-8). Không chặn xuất ở RS-6 — chặn
          ở một trạng thái CUỐI là chặn vĩnh viễn — nhưng cũng KHÔNG xuất im
          lặng: khi đó tệp trông như một kết quả đầy đủ và KHÔNG CÓ GÌ TRÊN ĐÓ
          NÓI NGƯỢC LẠI, nên người đọc không có cách nào biết một câu bị thiếu
          khỏi điểm. Dùng đúng màu chữ phụ đã có trong file, không mang màu mới
          (rào chắn trong AttemptPdfTemplate.test.tsx quét nguyên văn file này). */}
      {hasIncompleteEssay && (
        <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, margin: "10px 0 0" }}>
          {essayIncompleteLabel ?? DEFAULT_ESSAY_INCOMPLETE_LABEL}
        </p>
      )}

      <div style={HAIRLINE} />

      <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, margin: "20px 0 0" }}>
        MS-MOLAR
      </p>
    </div>
  );
}

/** Một ô thống kê: nhãn nhỏ kèm chấm màu trên, số dưới — bản inline-style của
 *  `Stat` trong ScoreCard. */
function StatCell({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div style={{ flex: 1, backgroundColor: SURFACE, borderRadius: 14, padding: "14px 12px" }}>
      <p style={{ ...EYEBROW, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, display: "inline-block" }} />
        {label}
      </p>
      <p style={{ ...TABULAR, color: INK, fontSize: 22, fontWeight: 700, margin: "6px 0 0" }}>{value}</p>
    </div>
  );
}
