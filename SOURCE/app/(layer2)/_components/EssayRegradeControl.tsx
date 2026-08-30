"use client";

// EssayRegradeControl — nút "Chấm lại", chỉ có mặt ở S-02 bên trong
// `EssayReviewBlock`, tại RS-4 / RS-5 / RS-6 (UI Spec § Component:
// EssayRegradeControl).
//
// HÌNH DẠNG XỬ LÝ CHÉP TỪ `RecheckOrderControl` — cùng bài toán, cùng bảy
// bước, và tiền lệ ấy đã ghi sẵn lý do cho từng bước.
//
// ═══ VÌ SAO `router.refresh()` CHỨ KHÔNG VÁ STATE TẠI CHỖ ═══
//
// MÁY CHỦ quyết định band (ghi-lần-đầu-thắng). Một lượt vá state cục bộ sẽ để
// `EssayScoreLine` phía trên nói một đằng còn thẻ câu hỏi nói một nẻo — trên
// cùng một màn hình, về cùng một lượt thi. Sau `refresh()`, cả hai đọc lại từ
// một nguồn duy nhất.
//
// ═══ KHÔNG BAO GIỜ `disabled` GỐC, KỂ CẢ Ở RS-6 ═══
//
// Nút ở lại trong cây, vẫn focus được, mang `aria-disabled="true"` và
// `aria-describedby` trỏ tới câu "đã hết lượt". `disabled` sẽ gỡ nó khỏi thứ
// tự tab VÀ đẩy lý do ra ngoài tầm với của trình đọc màn hình — đúng hai thứ
// AC-064 muốn có. Repo đã sửa lỗi này hai lần ở hai component khác.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryEssayGrading, type RetryRefusal } from "@/app/(layer2)/essayActions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

/** NĂM lý do, NĂM câu — khai bằng `Record` chứ KHÔNG bằng `switch` có
 *  `default`. Đó là toàn bộ điểm của nó: thêm một lý do vào `RetryRefusal` trở
 *  thành một lỗi BIÊN DỊCH NGAY TẠI ĐÂY, thay vì một nhánh im lặng rơi vào câu
 *  chữ của lý do khác — tức nói với học sinh một điều không đúng về tình cảnh
 *  của họ.
 *
 *  Hai khoá được DÙNG LẠI chứ không nhân bản (quy ước `en.ts:5-6`):
 *  `not_found` và `server` mượn hai câu `profile.error.*` sẵn có.
 *
 *  `not_failed` → "Câu này đã có điểm rồi." vì dưới AC-063, chấm lại trên một
 *  câu đã có band là kết cục BÌNH THƯỜNG, không phải lỗi: đó là cuộc đua thật,
 *  khi bộ poll đáp một band xuống trong lúc học sinh đang bấm. */
const REFUSAL_KEY: Record<RetryRefusal, MessageKey> = {
  not_found: "profile.error.sessionExpired",
  not_failed: "result.essay.retryAlreadyGraded",
  exhausted: "result.essay.retryExhausted",
  budget: "result.essay.retryBudgetOut",
  server: "profile.error.generic",
};

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "refused"; reason: RetryRefusal }
  | { kind: "done" }
  | { kind: "threw" };

export function EssayRegradeControl({
  attemptId,
  questionId,
  exhausted,
}: {
  attemptId: string;
  questionId: string;
  /** RS-6. Đến từ `EssayView.retryAvailable` đã suy ở tầng đọc — component này
   *  KHÔNG tự suy lại `state === "failed" && !retryAvailable` (EG-BE-036). */
  exhausted: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busyRef = useRef(false);

  const reasonId = `essay-retry-${questionId}-reason`;
  const busy = phase.kind === "busy";

  async function run() {
    // BƯỚC 1 — về sớm TRƯỚC cả chốt bận. Ở RS-6 không có gì để gửi đi: không
    // lượt gọi action, không pha bận, không node kết cục. `aria-disabled` chỉ
    // THÔNG BÁO, nó không chặn một cú click DOM, nên chốt thật phải nằm ở đây.
    if (exhausted) return;
    // BƯỚC 2 — TRƯỚC mọi `setState`, TRƯỚC mọi `await`. Một chốt bằng state đọc
    // giá trị của lượt render TRƯỚC, nên cú bấm thứ hai trong cùng một tick vẫn
    // lọt qua.
    if (busyRef.current) return;

    busyRef.current = true;
    setPhase({ kind: "busy" });
    try {
      const result = await retryEssayGrading(attemptId, questionId);
      setPhase(result.ok ? { kind: "done" } : { kind: "refused", reason: result.reason });
      // Lượt re-render của máy chủ đáp xuống DƯỚI cái alert vừa hiện.
      router.refresh();
    } catch (err) {
      // CHỈ `digest`. KHÔNG log `err`: thông điệp lỗi Postgres băng qua biên
      // Server Action có thể vọng lại chính bài làm của học sinh, và
      // `Error#message` KHÔNG enumerable nên một lượt rò kiểu đó không lộ ra
      // dưới `JSON.stringify` — nó chỉ lộ ra ở console thật, tức là muộn.
      console.error("[EssayRegradeControl] retryEssayGrading threw", {
        digest: (err as { digest?: string } | null)?.digest,
      });
      setPhase({ kind: "threw" });
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={run}
        aria-disabled={busy || exhausted ? "true" : "false"}
        aria-busy={busy}
        aria-describedby={reasonId}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCw className="size-4" aria-hidden />
        )}
        {busy ? t("result.essay.retryBusy") : t("result.essay.retry")}
      </Button>

      {/* Node này VẮNG MẶT trước hành động và XUẤT HIỆN sau, mang `role="alert"`
          và KHÔNG mang `aria-live`. Đây LÀ một hành động do người dùng khởi
          động — ngược hẳn vùng `polite` của bộ poll, nơi thứ đang đổi là thứ
          học sinh không bấm gì cả. */}
      {(phase.kind === "refused" || phase.kind === "threw") && (
        <p role="alert" className="text-muted-foreground mt-2 text-sm">
          {/* Một exception DÙNG LẠI câu của `server`: cùng một sự thật nói cho
              cùng một người, đến bằng hai đường. Đây là ngoại lệ DUY NHẤT của
              luật một-lý-do-một-câu, và nó tồn tại để không có câu thứ hai nào
              trôi lệch khỏi câu thứ nhất. */}
          {phase.kind === "threw"
            ? t(REFUSAL_KEY.server)
            : t(REFUSAL_KEY[phase.reason])}
        </p>
      )}

      {/* Chính việc chuỗi này ĐỔI ("" → lý do → "") là cơ chế thông báo. Không
          `aria-live`: học sinh tự khởi động lượt chờ này. */}
      <span id={reasonId} className="sr-only">
        {busy
          ? t("result.essay.retryBusyReason")
          : exhausted
            ? t("result.essay.retryExhausted")
            : ""}
      </span>
    </div>
  );
}
