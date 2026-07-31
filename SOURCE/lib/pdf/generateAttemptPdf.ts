// Single shared PDF-generation implementation (AC-007, ADR-0009). See
// docs/design/history-frontend-design.md § PDF Generation Module — Deep Dive
// and § Data Contracts. `jspdf`/`html2canvas`/`react-dom`/`react-dom/client`
// are dynamically imported exclusively inside generateAttemptPdfFile's async
// body (ADR-0009 § Implementation Guidance) — never at this file's top level,
// so the heavy libraries never load until the first Save/Share click.
import { createElement } from "react";
import { AttemptPdfTemplate } from "@/components/pdf/AttemptPdfTemplate";
import { buildPdfFilename, formatCompletionTime, formatSubmittedDate } from "@/lib/history/format";

export interface AttemptPdfData {
  examTitle: string;
  totalScore: number;
  startedAt: string;
  submittedAt: string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * "DD/MM/YYYY HH:mm". Local, unexported helper — `lib/history/format.ts`
 * (Task 07's already-completed, already-tested contract) exports only
 * formatSubmittedDate/formatCompletionTime/buildPdfFilename, so the
 * "generated at" label used only by the PDF template is kept local here
 * rather than expanding that module's out-of-scope contract.
 */
function formatGeneratedAt(date: Date): string {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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
    const completionTimeLabel = formatCompletionTime(data.startedAt, data.submittedAt);

    flushSync(() => {
      root.render(
        createElement(AttemptPdfTemplate, {
          examTitle: data.examTitle,
          totalScore: data.totalScore,
          submittedDateLabel,
          completionTimeLabel,
          generatedAtLabel: formatGeneratedAt(new Date()),
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
