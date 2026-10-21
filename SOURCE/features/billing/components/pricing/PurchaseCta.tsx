"use client";

// Nút "Mua Premium". `canPurchase` do Server Component quyết từ cờ
// GEMINI_PAID_TIER_ENABLED; component này không đọc env.
//
// Không dùng `disabled` gốc (nút rơi khỏi thứ tự tab); chốt thật là
// `canPurchase` trong onClick và `busyRef`. Chỉ điều hướng khi đơn đã tạo
// xong — điều hướng lạc quan làm cú bấm hỏng trông như thành công.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createOrder, type CreateOrderError } from "@/lib/billing/orderActions";
import { t, type MessageKey } from "@/lib/copy";

const ERROR_KEY: Record<CreateOrderError, MessageKey> = {
  unauthenticated: "profile.error.sessionExpired",
  rate_limited: "billing.recheck.rateLimited",
  provider_unavailable: "billing.recheck.providerUnavailable",
  server: "billing.orders.loadError",
};

type Phase = { kind: "idle" } | { kind: "busy" } | { kind: "failed"; key: MessageKey };

export function PurchaseCta({ canPurchase }: { canPurchase: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busyRef = useRef(false);
  const reasonId = "billing-cta-reason";

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
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        className="w-full"
        aria-disabled={canPurchase ? "false" : "true"}
        aria-describedby={canPurchase ? undefined : reasonId}
        aria-busy={phase.kind === "busy"}
        onClick={() => {
          if (!canPurchase) return;
          void startPurchase();
        }}
      >
        {t("billing.cta.buy")}
      </Button>
      {!canPurchase && (
        <p id={reasonId} className="text-muted-foreground text-sm leading-relaxed">
          {t("billing.cta.unavailableReason")}
        </p>
      )}
      {phase.kind === "failed" && (
        <p role="alert" className="text-destructive text-sm leading-relaxed">
          {t(phase.key)}
        </p>
      )}
    </div>
  );
}
