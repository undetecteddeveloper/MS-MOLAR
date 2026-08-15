"use client";

// useTutorAction — máy trạng thái của "Giải thích bước này" (PRD R6/R7, UI Spec
// D1/D5), sao đúng hình dạng của usePdfAction (components/history/usePdfAction.ts):
// cùng chốt chặn nháy đúp bằng busyRef, cùng lối phase dẫn UI, chỉ đổi việc bên
// trong từ dựng PDF cục bộ sang gọi Server Action explainStep(). Xem
// docs/design/engine1-adaptive-ai-backend-design.md § explainStep() cho hợp đồng
// typed-result mà hook này tiêu thụ.

import { useRef, useState } from "react";
import { explainStep } from "@/app/(layer2)/tutorActions";

export type TutorPhase = "idle" | "busy" | "hint-shown" | "error";

export interface UseTutorActionResult {
  phase: TutorPhase;
  /** Chỉ có giá trị khi phase là "hint-shown"; ngoài ra là null (D5 — gợi ý
   *  không được lưu để hiện lại, state của chính lượt render này là bản duy nhất). */
  hint: string | null;
  run: () => void;
}

export function useTutorAction(attemptId: string, questionId: string): UseTutorActionResult {
  const [phase, setPhase] = useState<TutorPhase>("idle");
  const [hint, setHint] = useState<string | null>(null);
  // Chốt ĐỒNG BỘ, không phải state: aria-disabled không chặn sự kiện click, và
  // một lần đọc `phase === "busy"` thì đọc phải giá trị của lượt render TRƯỚC —
  // cú nhấp thứ hai trong cùng một tick sẽ lọt qua (AC-025).
  const busyRef = useRef(false);

  async function run() {
    if (busyRef.current) return; // AC-025 — kiểm TRƯỚC mọi cập nhật state
    busyRef.current = true;
    setPhase("busy");
    try {
      // Thứ tự tham số là (attemptId, questionId) — ĐÚNG chữ ký của
      // explainStep(), KHÔNG phải thứ tự khai báo của ExplainStepAffordanceProps
      // (questionId, attemptId, do UI Spec chốt). Cả hai đều là string nên hoán
      // vị vẫn biên dịch trót lọt; ExplainStepAffordance.test.tsx giữ khoá thứ
      // tự này bằng hai giá trị fixture phân biệt được.
      const result = await explainStep(attemptId, questionId);
      if ("hint" in result) {
        setHint(result.hint);
        setPhase("hint-shown");
        return;
      }
      // Chỉ id + mã lỗi đóng của backend — không bao giờ log nội dung câu hỏi
      // hay chính gợi ý (frontend DD § Logging and Monitoring).
      console.error("Tutor call failed", { attemptId, questionId, errorCode: result.error });
      setPhase("error");
    } catch (err) {
      console.error("Tutor call rejected", { attemptId, questionId, err });
      setPhase("error");
    } finally {
      // Luôn nhả chốt: một lần hỏng không được để nút kẹt vĩnh viễn không thử
      // lại được (AC-021).
      busyRef.current = false;
    }
  }

  return { phase, hint, run };
}
