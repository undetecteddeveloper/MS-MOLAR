// Bản cài đặt tạo PDF dùng chung duy nhất (AC-007, ADR-0009). Xem
// docs/design/history-frontend-design.md § PDF Generation Module — Deep Dive
// và § Data Contracts. `jspdf`/`html2canvas`/`react-dom`/`react-dom/client`
// chỉ được import động bên trong phần thân async của generateAttemptPdfFile
// (ADR-0009 § Implementation Guidance) — không bao giờ ở cấp cao nhất của file này,
// nên các thư viện nặng không bao giờ tải cho tới lần bấm Lưu/Chia sẻ đầu tiên.
import { createElement } from "react";
import { AttemptPdfTemplate } from "@/components/pdf/AttemptPdfTemplate";
import { buildPdfFilename, formatSubmittedDate, formatSubmittedTime } from "@/lib/history/format";

export interface AttemptPdfData {
  subject: string;
  examTitle: string;
  totalScore: number;
  examineeName: string;
  submittedAt: string | null;
  correct: number;
  total: number;
  /** Có câu tự luận nào đã dừng hẳn ở RS-6 (thất bại VÀ hết lượt) không —
   *  điều kiện in chú thích PDF (O-8).
   *
   *  BẮT BUỘC, và đó là toàn bộ cơ chế của task này: `AttemptPdfData` là chỗ
   *  HỢP LƯU của cả hai lối xuất PDF, nên một trường bắt buộc ở đây làm hai
   *  lối trở nên KHÔNG THỂ bất đồng về mặt cấu trúc, và `tsc` gọi tên bất kỳ
   *  chỗ dựng nào quên nó.
   *
   *  Mỗi chỗ dựng ĐỌC trường đã published của đường đọc của chính nó
   *  (`ExamResult.hasIncompleteEssay`, `MyHistoryEntry.hasIncompleteEssay`) và
   *  KHÔNG chỗ nào suy lại `state === "failed" && !retryAvailable` — biểu thức
   *  đó được khai đúng một chỗ, trong `essayLifecycle.ts` (EG-BE-036). Suy lại
   *  tại chỗ là mở lại đúng khuyết tật F-06: hai tệp PDF khác nhau cho cùng
   *  một lượt thi. */
  hasIncompleteEssay: boolean;
  /** Nhãn đã dịch — usePdfAction bơm vào từ `t`. Bỏ trống thì template dùng
   *  bản tiếng Anh mặc định của nó (AttemptPdfTemplate's own defaults). */
  resultTitleLabel?: string;
  scoreLabel?: string;
  examineeLabel?: string;
  submittedLabel?: string;
  correctLabel?: string;
  wrongLabel?: string;
  totalQuestionsLabel?: string;
  essayIncompleteLabel?: string;
}

export async function generateAttemptPdfFile(data: AttemptPdfData): Promise<File> {
  const [{ default: jsPDF }, { default: html2canvas }, { flushSync }, { createRoot }] =
    await Promise.all([
      import("jspdf"),
      import("html2canvas"),
      import("react-dom"),
      import("react-dom/client"),
    ]);

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;top:-9999px;left:-9999px;pointer-events:none;";
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    const submittedDateLabel = formatSubmittedDate(data.submittedAt);
    const submittedTimeLabel = formatSubmittedTime(data.submittedAt);

    flushSync(() => {
      root.render(
        createElement(AttemptPdfTemplate, {
          subject: data.subject,
          examTitle: data.examTitle,
          totalScore: data.totalScore,
          examineeName: data.examineeName,
          submittedDateLabel,
          submittedTimeLabel,
          correct: data.correct,
          total: data.total,
          resultTitleLabel: data.resultTitleLabel,
          scoreLabel: data.scoreLabel,
          examineeLabel: data.examineeLabel,
          submittedLabel: data.submittedLabel,
          correctLabel: data.correctLabel,
          wrongLabel: data.wrongLabel,
          totalQuestionsLabel: data.totalQuestionsLabel,
          // Chuyển tiếp CẢ HAI. Boolean đáp xuống từ đường đọc (Task B2.3),
          // nhãn đáp xuống từ `usePdfAction` — nên hai lối xuất PDF sinh ra
          // CÙNG một tệp cho cùng một lượt thi (D-13).
          hasIncompleteEssay: data.hasIncompleteEssay,
          essayIncompleteLabel: data.essayIncompleteLabel,
        }),
      );
    });

    await waitForTemplateAssets(container);

    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      // Cùng nền với template (theme "Sân trường": trang trắng, 2026-09-13).
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });

    const widthPx = canvas.width / 2;
    const heightPx = canvas.height / 2;
    const doc = new jsPDF({ unit: "px", hotfixes: ["px_scaling"], format: [widthPx, heightPx] });
    doc.addImage(canvas.toDataURL("image/png", 1.0), "PNG", 0, 0, widthPx, heightPx);

    const blob = doc.output("blob");
    return new File([blob], buildPdfFilename(data.examTitle, data.submittedAt), {
      type: "application/pdf",
    });
  } finally {
    root.unmount();
    container.remove();
  }
}

/**
 * Lấp khoảng trống giữa lần commit DOM đồng bộ của flushSync (phần tử <img>
 * đã tồn tại) và lúc bitmap ảnh thực sự được giải mã, đồng thời chờ
 * webfont, trước khi html2canvas chụp container.
 *
 * `document.fonts?.ready` được bọc optional chaining chỉ như một biện pháp
 * phòng thủ: jsdom cài trong repo này (^29.1.1) không cài đặt
 * CSS Font Loading API (document.fonts là undefined ở đó), trong khi mọi
 * trình duyệt thuộc ma trận hỗ trợ của dự án đều luôn có nó — lớp bọc
 * không bao giờ chọn nhánh khác trong trình duyệt thật, nó chỉ ngăn
 * một TypeError chỉ xảy ra ở jsdom trong test.
 */
async function waitForTemplateAssets(container: HTMLElement): Promise<void> {
  await (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
}

export function downloadPdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  return navigator.canShare({ files: [file] });
}
