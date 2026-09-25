"use client";

// HelpfulButton (C-24) — nút "Hữu ích" bật/tắt có số đếm (AC-064). UI Spec §
// Component: HelpfulButton; frontend DD § Main Components "HelpfulButton.tsx"
// + § Data Contracts "Helpful toggle contract". `SolutionAuthorCard` chỉ dựng
// component này khi `!isMine` — bài của chính người xem thay bằng chữ "x hữu
// ích" (AC-062, AC-064), không có nhánh nào trong FILE NÀY tự kiểm `isMine`.
//
// Sequencing (không dựa vào Server Action được framework gọi tuần tự — § Data
// Contracts "Helpful toggle contract"): `stateRef` là NGUỒN SỰ THẬT DUY NHẤT
// cho `desiredOn`/`confirmedOn`/`confirmedCount`/`inFlight` — không tách
// thành hai biến optimistic/confirmed độc lập (đúng lớp lỗi task 16 đã chứng
// minh không thể tồn tại ở backend, không được tái diễn ở client). `apply()`
// tính trạng thái KẾ TIẾP từ `stateRef.current` (không phải từ closure của
// một lượt render cũ) rồi ghi lại cả vào ref lẫn vào state hiển thị — mọi
// quyết định "có cần gọi tiếp không" đọc thẳng giá trị `apply()` vừa trả về,
// không dựa vào mảng dependency của `useEffect` chạy lại theo GIÁ TRỊ thay
// đổi: một lần thử ban đầu dùng `useEffect([desiredOn, confirmedOn])` đã lộ
// đúng lỗ hổng này — khi `on` server trả về TRÙNG giá trị `confirmedOn` cũ dù
// `desiredOn` mới nhất vẫn lệch, `confirmedOn` không đổi GIÁ TRỊ nên effect
// không chạy lại và cuộc gọi sửa không bao giờ được phát.
import { useEffect, useRef, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { toggleHelpful } from "@/features/solutions/actions";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface HelpfulButtonProps {
  solutionId: string;
  initialPressed: boolean;
  initialCount: number;
  /** `SolutionAuthorCard` dựng dòng `role="alert"` NGAY DƯỚI thẻ từ chuỗi này
   *  (frontend DD § Minimal Surface Alternatives Element 6); `null` gỡ dòng. */
  onError: (message: string | null) => void;
}

interface HelpfulState {
  /** Ý định MỚI NHẤT của người dùng — mỗi lần bấm đảo giá trị này. `aria-pressed`
   *  luôn theo giá trị này, không bao giờ theo `confirmedOn`. */
  desiredOn: boolean;
  /** Giá trị server xác nhận lần cuối — hạt giống từ `initialPressed`. */
  confirmedOn: boolean;
  confirmedCount: number;
  inFlight: boolean;
}

type HelpfulAction =
  | { type: "press" }
  | { type: "start" }
  | { type: "resolve"; on: boolean }
  | { type: "reject" };

function helpfulReducer(state: HelpfulState, action: HelpfulAction): HelpfulState {
  switch (action.type) {
    case "press":
      return { ...state, desiredOn: !state.desiredOn };
    case "start":
      return { ...state, inFlight: true };
    case "resolve": {
      const delta = action.on === state.confirmedOn ? 0 : action.on ? 1 : -1;
      return {
        desiredOn: state.desiredOn,
        confirmedOn: action.on,
        confirmedCount: state.confirmedCount + delta,
        inFlight: false,
      };
    }
    // Lỗi ⇒ về đúng giá trị server xác nhận lần cuối, số đếm không đổi
    // (không bao giờ để lại một giá trị lạc quan còn treo — AC-064).
    case "reject":
      return { ...state, desiredOn: state.confirmedOn, inFlight: false };
  }
}

export function HelpfulButton({ solutionId, initialPressed, initialCount, onError }: HelpfulButtonProps) {
  const initial: HelpfulState = {
    desiredOn: initialPressed,
    confirmedOn: initialPressed,
    confirmedCount: initialCount,
    inFlight: false,
  };
  const stateRef = useRef<HelpfulState>(initial);
  const [renderState, setRenderState] = useState<HelpfulState>(initial);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function apply(action: HelpfulAction): HelpfulState {
    const next = helpfulReducer(stateRef.current, action);
    stateRef.current = next;
    setRenderState(next);
    return next;
  }

  function runToggle() {
    apply({ type: "start" });
    toggleHelpful(solutionId).then((result) => {
      if (!mountedRef.current) return;

      if (result.ok) {
        onError(null);
        const next = apply({ type: "resolve", on: result.on });
        // Cuộc gọi vừa resolve có thể đã LỖI THỜI so với ý định mới nhất
        // (người dùng bấm thêm trong lúc chờ) — so khớp lại đúng MỘT lần và
        // phát đúng MỘT cuộc gọi sửa nếu còn lệch, không hơn (AC-064).
        if (next.desiredOn !== next.confirmedOn) runToggle();
        return;
      }

      apply({ type: "reject" });
      onError(
        result.error.code === "rateLimited"
          ? t("profile.error.rateLimited", { seconds: result.error.seconds })
          : t("solutions.view.helpfulError")
      );
    });
  }

  function handlePress() {
    const next = apply({ type: "press" });
    if (!next.inFlight) runToggle();
  }

  const displayCount =
    renderState.desiredOn === renderState.confirmedOn
      ? renderState.confirmedCount
      : renderState.desiredOn
        ? renderState.confirmedCount + 1
        : renderState.confirmedCount - 1;

  return (
    <button
      type="button"
      aria-pressed={renderState.desiredOn}
      aria-busy={renderState.inFlight}
      onClick={handlePress}
      className={cn(
        buttonVariants({ variant: "secondary" }),
        "flex-1",
        renderState.desiredOn && "bg-foreground text-background hover:bg-foreground"
      )}
    >
      <ThumbsUp aria-hidden className="size-4" />
      {t("solutions.view.helpful")} <span className="tabular-nums">{displayCount}</span>
    </button>
  );
}
