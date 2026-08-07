"use client";

// usePdfAction — the shared Save/Share state machine (AC-007's single PDF
// pipeline), extracted from ActionButton so HistoryRowMenu (front-adjust:
// merged ⋯ menu) can drive the identical busy/error/fallback logic without a
// second implementation. ActionButton keeps its own UI shell and now simply
// delegates to this hook.
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import {
  canShareFile,
  downloadPdfFile,
  generateAttemptPdfFile,
  type AttemptPdfData,
} from "@/lib/pdf/generateAttemptPdf";

export type PdfActionPhase = "idle" | "busy" | "error" | "fallback-confirmed";

/**
 * Isolates the Share branch (canShareFile check + navigator.share +
 * AbortError handling) so run() itself never nests past 3 levels
 * (typescript-rules max-nesting guideline).
 */
async function attemptShare(file: File): Promise<"shared" | "fallback"> {
  if (!canShareFile(file)) {
    downloadPdfFile(file); // D1: same download as Save
    return "fallback";
  }
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (shareErr) {
    if (shareErr instanceof DOMException && shareErr.name === "AbortError") {
      return "shared"; // user cancelled — not a failure, resolves the same as a completed share
    }
    throw shareErr;
  }
}

export function usePdfAction(action: "save" | "share", pdfInput: AttemptPdfData) {
  const t = useT();
  const [phase, setPhase] = useState<PdfActionPhase>("idle");
  const busyRef = useRef(false); // synchronous guard — aria-disabled does not block the click event (D4/AC-010)

  async function run() {
    if (busyRef.current) return; // AC-010
    busyRef.current = true;
    setPhase("busy");
    try {
      // Chân trang dịch ở ĐÂY chứ không ở nơi dựng pdfInput: HistoryRow là
      // server component, còn hook này luôn chạy client nên bắt được ngôn ngữ
      // đang bật mà không phải kéo `t` qua props từng chỗ gọi.
      const file = await generateAttemptPdfFile({
        ...pdfInput,
        footerPrefix: t("history.pdfFooterPrefix"),
      });
      if (action === "save") {
        downloadPdfFile(file);
        setPhase("idle");
        return;
      }
      const shareOutcome = await attemptShare(file);
      setPhase(shareOutcome === "shared" ? "idle" : "fallback-confirmed");
    } catch (err) {
      console.error("PDF action failed", { action, examTitle: pdfInput.examTitle, err });
      setPhase("error");
    } finally {
      busyRef.current = false;
    }
  }

  return { phase, run };
}
