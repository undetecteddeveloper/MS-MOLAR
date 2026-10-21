"use client";

// Nút "Mua Premium". `canPurchase` do Server Component quyết từ cờ
// GEMINI_PAID_TIER_ENABLED; component này không đọc env.
//
// Không dùng `disabled` gốc (nút rơi khỏi thứ tự tab); chốt thật là
// `canPurchase` trong onClick và `busyRef`. Chỉ điều hướng khi đơn đã tạo
// xong — điều hướng lạc quan làm cú bấm hỏng trông như thành công.
//
// Khi chưa mở bán, lý do hiện trong MỘT BONG BÓNG nổi dưới nút (không nằm trong dòng
// chảy, nên hiện/ẩn không đẩy layout): rê chuột hoặc focus bàn phím thì hiện; trên
// điện thoại hiện khi bấm nút rồi tự tắt sau BUBBLE_PIN_MS. Escape tắt được
// (WCAG 1.4.13). Bản chữ cho trình đọc màn hình luôn nằm trong DOM (sr-only, nối
// qua aria-describedby) vì bong bóng thị giác chỉ có mặt lúc đang hiện.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { POP_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { Button } from "@/components/ui/button";
import { createOrder, type CreateOrderError } from "@/lib/billing/orderActions";
import { t, type MessageKey } from "@/lib/copy";

const ERROR_KEY: Record<CreateOrderError, MessageKey> = {
  unauthenticated: "profile.error.sessionExpired",
  rate_limited: "billing.recheck.rateLimited",
  provider_unavailable: "billing.recheck.providerUnavailable",
  server: "billing.orders.loadError",
};

/** Bong bóng do cú BẤM mở (điện thoại không có hover) ở lại bấy nhiêu rồi tự tắt. */
const BUBBLE_PIN_MS = 4000;

type Phase = { kind: "idle" } | { kind: "busy" } | { kind: "failed"; key: MessageKey };

export function PurchaseCta({
  canPurchase,
  label = "billing.cta.buy",
}: {
  canPurchase: boolean;
  /** Nhãn nút: "Mua Premium" mặc định; người đang Premium thấy "Gia hạn thêm 30 ngày". */
  label?: MessageKey;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busyRef = useRef(false);
  const reasonId = "billing-cta-reason";

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  // Escape tắt bong bóng dù chuột/focus vẫn đang ở trên nút; hết hiệu lực khi rời đi
  // hoặc tương tác lại.
  const [dismissed, setDismissed] = useState(false);
  const bubbleOpen = !canPurchase && !dismissed && (hovered || focused || pinned);
  const { present: bubblePresent, closing: bubbleClosing } = usePresence(bubbleOpen, POP_EXIT_MS);

  useEffect(() => {
    if (!pinned) return;
    const id = window.setTimeout(() => setPinned(false), BUBBLE_PIN_MS);
    return () => window.clearTimeout(id);
  }, [pinned]);

  function fail(key: MessageKey) {
    busyRef.current = false;
    setPhase({ kind: "failed", key });
  }

  async function startPurchase() {
    if (busyRef.current) return; // trước mọi setState/await: chặn cú bấm đôi
    busyRef.current = true;
    setPhase({ kind: "busy" });
    try {
      const outcome = await createOrder();
      if ("error" in outcome) {
        fail(ERROR_KEY[outcome.error]);
        return;
      }
      // Thành công thì giữ chốt: màn hình đang rời đi.
      router.push(`/pricing/checkout?order=${outcome.orderCode}`);
    } catch (err) {
      console.error("[PurchaseCta] createOrder threw", {
        digest: (err as { digest?: string } | null)?.digest,
      });
      fail("billing.orders.loadError");
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        className="w-full"
        aria-disabled={canPurchase ? "false" : "true"}
        aria-describedby={canPurchase ? undefined : reasonId}
        aria-busy={phase.kind === "busy"}
        onClick={() => {
          if (!canPurchase) {
            setDismissed(false);
            setPinned(true);
            return;
          }
          void startPurchase();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setDismissed(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
          setDismissed(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && bubbleOpen) setDismissed(true);
        }}
      >
        {t(label)}
      </Button>
      {!canPurchase && (
        <>
          <span id={reasonId} className="sr-only">
            {t("billing.cta.unavailableReason")}
          </span>
          {/* Bong bóng: nổi (absolute) dưới nút, đuôi chỉ lên nút, `pointer-events-none`
              để không cản cú chạm vào thứ nằm dưới nó. `.motion-pop` + usePresence cho
              cả chiều vào lẫn chiều ra; gốc phóng ở GIỮA mép trên (đuôi). */}
          {bubblePresent && (
            <p
              aria-hidden
              data-cta-bubble
              data-closing={bubbleClosing ? "" : undefined}
              style={{ transformOrigin: "top center" }}
              className="motion-pop bg-card text-foreground before:bg-card pointer-events-none absolute inset-x-0 top-full z-20 mt-2.5 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-lg before:absolute before:-top-1 before:left-1/2 before:size-2.5 before:-translate-x-1/2 before:rotate-45 before:rounded-[2px]"
            >
              {t("billing.cta.unavailableReason")}
            </p>
          )}
        </>
      )}
      {phase.kind === "failed" && (
        <p role="alert" className="text-destructive text-sm leading-relaxed">
          {t(phase.key)}
        </p>
      )}
    </div>
  );
}
