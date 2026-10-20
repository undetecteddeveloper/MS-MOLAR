"use client";

// "Hỏi lại payOS xem đơn này đã trả chưa" — dùng ở /pricing/checkout (nút
// chính) và ở từng dòng /me/orders. `variant` chỉ đổi nhãn và kiểu nút.
//
// Không dùng `disabled` gốc: nút disabled rơi khỏi thứ tự tab, người dùng bàn
// phím không đọc được vì sao không bấm được. Chốt thật là `busyRef` + `terminal`.

import { Loader2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { recheckOrder, type RecheckOutcome } from "@/lib/billing/orderActions";
import type { SettleResult } from "@/lib/billing/settleOrder";
import { t, type MessageKey } from "@/lib/copy";
import { formatDate } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";

const REASON_KEY: Record<Extract<SettleResult, { settled: false }>["reason"], MessageKey> = {
  unknown_order: "billing.recheck.unknownOrder",
  not_pending: "billing.recheck.notPending",
  not_paid_yet: "billing.recheck.stillPending",
  amount_mismatch: "billing.recheck.amountMismatch",
  provider_unavailable: "billing.recheck.providerUnavailable",
};

const ERROR_KEY: Record<Extract<RecheckOutcome, { error: string }>["error"], MessageKey> = {
  rate_limited: "billing.recheck.rateLimited",
  unauthenticated: "profile.error.sessionExpired",
};

// Tập hợp tường minh, không phải `status !== "pending"`: một giá trị lạ KHÔNG
// được khoá nút hỏi lại — hỏi lại là cách duy nhất gỡ một trạng thái lạ.
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["paid", "expired", "cancelled"]);

export type RecheckVariant = "row" | "primary";

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; outcome: RecheckOutcome }
  | { kind: "threw" };

export function RecheckOrderControl({
  orderCode,
  variant,
  status,
}: {
  orderCode: number;
  variant: RecheckVariant;
  status: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busyRef = useRef(false);

  const reasonId = `recheck-${orderCode}-reason`;
  const busy = phase.kind === "busy";
  const terminal = TERMINAL_STATUSES.has(status);
  const primary = variant === "primary";

  async function run() {
    if (terminal) return;
    if (busyRef.current) return; // trước mọi setState/await: chặn cú bấm đôi
    busyRef.current = true;
    setPhase({ kind: "busy" });
    try {
      const outcome = await recheckOrder(orderCode);
      setPhase({ kind: "done", outcome });
      router.refresh();
    } catch (err) {
      // Chỉ log `digest`: message lỗi DB có thể mang số tiền/số tài khoản/memo.
      console.error("[RecheckOrderControl] recheckOrder threw", {
        digest: (err as { digest?: string } | null)?.digest,
      });
      setPhase({ kind: "threw" });
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", primary && "w-full")}>
      <Button
        type="button"
        variant={primary ? "default" : "secondary"}
        size={primary ? "lg" : "sm"}
        className={cn(primary && "w-full")}
        onClick={run}
        aria-disabled={busy || terminal ? "true" : "false"}
        aria-busy={busy}
        aria-describedby={reasonId}
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <RotateCw aria-hidden />
        )}
        {t(primary ? "billing.confirm.action" : "billing.recheck.action")}
      </Button>

      {phase.kind === "done" || phase.kind === "threw" ? (
        <p role="alert" className="text-muted-foreground text-sm leading-relaxed">
          {phase.kind === "threw"
            ? t("billing.orders.loadError")
            : t(outcomeKey(phase.outcome), { date: settledDate(phase.outcome) })}
        </p>
      ) : null}

      <span id={reasonId} className="sr-only">
        {busy ? t("billing.recheck.busy") : terminal ? t("billing.recheck.notPending") : ""}
      </span>
    </div>
  );
}

function outcomeKey(outcome: RecheckOutcome): MessageKey {
  if ("error" in outcome) return ERROR_KEY[outcome.error];
  if (outcome.settled) return "billing.recheck.settled";
  return REASON_KEY[outcome.reason];
}

function settledDate(outcome: RecheckOutcome): string {
  if ("error" in outcome || !outcome.settled) return "";
  return formatDate(outcome.expiresAt);
}
