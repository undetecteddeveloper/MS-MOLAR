"use client";

// useTutorAction — máy trạng thái của nút gợi ý (PRD R6/R7, UI Spec D1/D5),
// sao đúng hình dạng của usePdfAction (components/history/usePdfAction.ts):
// cùng chốt chặn nháy đúp bằng busyRef, cùng lối phase dẫn UI, chỉ đổi việc bên
// trong từ dựng PDF cục bộ sang gọi Server Action hintDuringAttempt(). Xem
// docs/design/engine1-adaptive-ai-backend-design.md § explainStep() cho hợp đồng
// typed-result mà hook này tiêu thụ (tên action đổi 2026-09-13, hợp đồng không).

import { useRef, useState } from "react";
import { hintDuringAttempt } from "@/features/exams/tutorActions";

export type TutorPhase = "idle" | "busy" | "hint-shown" | "error";

export interface UseTutorActionResult {
  phase: TutorPhase;
  /** Chỉ có giá trị khi phase là "hint-shown"; ngoài ra là null (D5 — gợi ý
   *  không được lưu để hiện lại TRONG hook; ExamPlayer giữ bản đã nhận theo câu
   *  qua `onHint`, để quay lại câu ấy vẫn thấy). */
  hint: string | null;
  /** Gọi gia sư với bản nháp bài làm HIỆN TẠI của câu (đọc lúc bấm, không lúc
   *  mount — người dùng gõ tiếp giữa hai lần render). */
  run: (draftAnswer: string) => void;
}

export function useTutorAction(
  attemptId: string,
  questionId: string,
  onHint?: (hint: string) => void
): UseTutorActionResult {
  const [phase, setPhase] = useState<TutorPhase>("idle");
  const [hint, setHint] = useState<string | null>(null);
  // Chốt ĐỒNG BỘ, không phải state: aria-disabled không chặn sự kiện click, và
  // một lần đọc `phase === "busy"` thì đọc phải giá trị của lượt render TRƯỚC —
  // cú nhấp thứ hai trong cùng một tick sẽ lọt qua (AC-025).
  const busyRef = useRef(false);

  async function run(draftAnswer: string) {
    if (busyRef.current) return; // AC-025 — kiểm TRƯỚC mọi cập nhật state
    busyRef.current = true;
    setPhase("busy");
    try {
      // Thứ tự tham số là (attemptId, questionId, draftAnswer) — ĐÚNG chữ ký
      // của hintDuringAttempt(), KHÔNG phải thứ tự khai báo của
      // ExplainStepAffordanceProps (questionId, attemptId). Hai id đều là string
      // nên hoán vị vẫn biên dịch trót lọt; ExplainStepAffordance.test.tsx giữ
      // khoá thứ tự này bằng hai giá trị fixture phân biệt được.
      const result = await hintDuringAttempt(attemptId, questionId, draftAnswer);
      if ("hint" in result) {
        setHint(result.hint);
        setPhase("hint-shown");
        onHint?.(result.hint);
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
