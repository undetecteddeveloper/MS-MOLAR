"use client";

// RatingForm — shared client core (Rating System, UI Spec Component: RatingForm;
// frontend DD § Rating-form State Management, Minimal Surface Element 3). Giữ
// scores + activePart (local useState, không persist) và điều khiển state
// machine 5 trạng thái Empty/Partial/Complete/Submitting/Saved/Error qua
// `submitState`. `onSubmit` do shell truyền vào (RatePageShell wires
// submitRating(examId, scores) → rateExam) — đây LÀ ranh giới server-action mà
// component này test qua, không tự import submitRating/rateExam (giữ
// RatingForm không phụ thuộc shell, tái dùng được cho layout="modal" ở Task 8).
//
// Bubble-expand (ERP_transitions_animations.md §1-2) CHỈ áp cho layout="page"
// (RatePageShell — phạm vi task này); layout="modal" (RatingModal, Task 8) sẽ
// tự thêm cross-fade riêng, giữ RatingForm không biết về animation của modal.
// Không thể thêm @keyframes vào globals.css (ngoài phạm vi file task này) nên
// dùng transition Tailwind thuần (scale/opacity, không đo rect thật) — bản
// gần đúng tĩnh có thể kiểm; growth-from-card-rect chính xác + tôn trọng
// prefers-reduced-motion xác nhận bằng mắt ở Playwright pass (Task 9).

import { useEffect, useState } from "react";
import { PART_IDS, readoutModel, type PartId, type PartScore } from "@/lib/rating";
import { PartDetail } from "./PartDetail";
import { RatingOverview } from "./RatingOverview";

export interface RatingFormProps {
  examId: string;
  /** "page" → bubble-expand overview↔detail; "modal" → cross-fade (Task 8). */
  layout: "page" | "modal";
  /** Pre-fill cho user đã đánh giá trước đó (AC-006/013); undefined = chưa chấm. */
  initialScores?: Partial<Record<PartId, PartScore>>;
  onSubmit: (
    scores: Record<PartId, PartScore>
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** Chỉ dùng ở layout="modal" — shell đóng modal + trả focus khi lưu thành công. */
  onSaved?: () => void;
}

type SubmitState = "idle" | "submitting" | "saved" | "error";

/** jsdom (vitest) không polyfill window.matchMedia — guard runtime để test
 *  component không throw; hành vi fallback (không reduced) tương đương môi
 *  trường không hỗ trợ media query, chấp nhận được vì reduced-motion chỉ ảnh
 *  hưởng animation, không ảnh hưởng chức năng (verify thật ở Playwright pass). */
function supportsMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => supportsMatchMedia() && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (!supportsMatchMedia()) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Bubble-expand reveal wrapper — mount tại "thu nhỏ", rAF sau chuyển "đầy đủ"
 *  để transition Tailwind chạy được (áp class đích ngay lần render đầu thì
 *  không có transition). Tách component riêng (thay vì effect trong
 *  RatingForm) để state `revealed` tự khởi tạo lại mỗi lần PartDetail mount
 *  mới (RatingForm chỉ mount wrapper này khi activePart != null) — không cần
 *  nhánh "reset về false" khi đóng, tránh setState đồng bộ trong effect. */
function BubbleReveal({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      className={`origin-top transition-all duration-[480ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
        revealed ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

const SAVED_LABEL_DURATION_MS = 1600;

export function RatingForm({ examId, layout, initialScores, onSubmit, onSaved }: RatingFormProps) {
  const [scores, setScores] = useState<Partial<Record<PartId, PartScore>>>(initialScores ?? {});
  const [activePart, setActivePart] = useState<PartId | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const reducedMotion = usePrefersReducedMotion();

  const headingId = `rating-form-heading-${examId}`;
  const submitHintId = `rating-form-submit-hint-${examId}`;
  const allRated = PART_IDS.every((id) => scores[id] !== undefined);
  const readout = readoutModel(scores);

  function handleCommit(part: PartId, value: PartScore) {
    setScores((prev) => ({ ...prev, [part]: value }));
    setActivePart(null);
  }

  async function handleSubmit() {
    if (!allRated || submitState === "submitting") return;
    setSubmitState("submitting");
    setErrorMessage(null);
    const result = await onSubmit(scores as Record<PartId, PartScore>);
    if (result.ok) {
      setSubmitState("saved");
      setAnnouncement("Rating saved.");
      onSaved?.();
      setTimeout(() => setSubmitState("idle"), SAVED_LABEL_DURATION_MS);
    } else {
      setSubmitState("error");
      setErrorMessage(result.message);
    }
  }

  const submitLabel =
    submitState === "submitting" ? "Submitting…" : submitState === "saved" ? "Sent" : "SUBMIT";
  const bubbleExpand = layout === "page" && !reducedMotion;

  let body: React.ReactNode;
  if (activePart === null) {
    body = (
      <RatingOverview
        headingId={headingId}
        scores={scores}
        readout={readout}
        onOpenPart={(part) => submitState !== "submitting" && setActivePart(part)}
        submitDisabled={!allRated || submitState === "submitting"}
        submitBusy={submitState === "submitting"}
        submitLabel={submitLabel}
        submitHintId={submitHintId}
        onSubmit={handleSubmit}
        errorMessage={errorMessage}
      />
    );
  } else {
    const detail = (
      <PartDetail
        part={activePart}
        value={scores[activePart]}
        onCommit={(value) => handleCommit(activePart, value)}
        onBack={() => setActivePart(null)}
      />
    );
    body = bubbleExpand ? <BubbleReveal key={activePart}>{detail}</BubbleReveal> : detail;
  }

  return (
    <div data-layout={layout}>
      {/* Announcement dùng chung cho cả 2 shell (RatePageShell/RatingModal) —
          "the shell's aria-live" trong UI Spec được thoả mãn ở đây vì mọi shell
          bọc RatingForm đều thừa hưởng region này, tránh lặp lại ở từng shell. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {body}
    </div>
  );
}
