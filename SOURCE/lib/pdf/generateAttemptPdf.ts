// Single shared PDF-generation implementation (AC-007, ADR-0009). See
// docs/design/history-frontend-design.md § PDF Generation Module — Deep Dive
// and § Data Contracts. `jspdf`/`html2canvas`/`react-dom`/`react-dom/client`
// are dynamically imported exclusively inside generateAttemptPdfFile's async
// body (ADR-0009 § Implementation Guidance) — never at this file's top level,
// so the heavy libraries never load until the first Save/Share click.
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
      backgroundColor: "#ede1c8",
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
 * Closes the gap between flushSync's synchronous DOM commit (the <img>
 * element exists) and the image bitmap actually being decoded, plus waits
 * for webfonts, before html2canvas captures the container.
 *
 * `document.fonts?.ready` is guarded with optional chaining as a defensive
 * measure only: this repo's installed jsdom (^29.1.1) doesn't implement the
 * CSS Font Loading API (document.fonts is undefined there), while every
 * browser in the project's supported matrix always populates it — the guard
 * never selects a different branch in a real browser, it only prevents a
 * jsdom-only TypeError in tests.
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
