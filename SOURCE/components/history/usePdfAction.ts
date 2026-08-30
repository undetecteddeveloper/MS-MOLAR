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

/** Cổng chặn xuất PDF (ADR-0018 / AC-058).
 *
 *  `blockedReason` BẮT BUỘC, không có mặc định. Một tham số tuỳ chọn ở đây
 *  nghĩa là mỗi call site MỚI mặc định KHÔNG bị chặn, tức chế độ hỏng im lặng
 *  là "cho xuất một tệp thiếu điểm" — đúng thứ cổng này sinh ra để chặn. Bắt
 *  buộc thì `tsc` đòi mọi call site phải TRẢ LỜI câu hỏi đó.
 *
 *  MỘT HOOK, HAI CỬA (UI-D4). Điều này NỚI phạm vi AC-058 — vốn chỉ nêu tên
 *  `ResultActions.tsx` — sang cả `/history`, một cách CÓ CHỦ Ý: `/history` là
 *  nơi học sinh quay lại sau vài ngày, tức nơi một lượt xuất PDF DỄ XẢY RA
 *  NHẤT. Chặn ở một cửa mà mở ở cửa kia là không chặn gì cả. */
export function usePdfAction(
  action: "save" | "share",
  pdfInput: AttemptPdfData,
  blockedReason: string | null,
) {
  const t = useT();
  const [phase, setPhase] = useState<PdfActionPhase>("idle");
  const busyRef = useRef(false); // synchronous guard — aria-disabled does not block the click event (D4/AC-010)

  async function run() {
    // CHẶN TRƯỚC CHỐT BẬN, và thứ tự ấy là yêu cầu chứ không phải sở thích:
    // đặt sau `busyRef` thì một lượt bấm bị chặn vẫn nhấp qua pha "đang tạo"
    // rồi mới dừng, tức giao diện nói dối rằng nó đã bắt đầu làm gì đó. Ở đây
    // một lượt bấm bị chặn KHÔNG sinh pha bận và KHÔNG sinh node lỗi nào.
    if (blockedReason !== null) return;
    if (busyRef.current) return; // AC-010
    busyRef.current = true;
    setPhase("busy");
    try {
      // Nhãn dịch ở ĐÂY chứ không ở nơi dựng pdfInput: HistoryRow là server
      // component, còn hook này luôn chạy client nên bắt được ngôn ngữ đang
      // bật mà không phải kéo `t` qua props từng chỗ gọi.
      const file = await generateAttemptPdfFile({
        ...pdfInput,
        resultTitleLabel: t("history.pdfResultTitle"),
        scoreLabel: t("history.pdfScoreLabel"),
        examineeLabel: t("history.pdfExamineeLabel"),
        submittedLabel: t("history.pdfSubmittedLabel"),
        correctLabel: t("history.pdfCorrectLabel"),
        wrongLabel: t("history.pdfWrongLabel"),
        totalQuestionsLabel: t("history.pdfTotalQuestions", { total: pdfInput.total }),
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
