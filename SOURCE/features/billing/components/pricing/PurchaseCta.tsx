"use client";

// PurchaseCta — UI Spec C-03. Nút mua, và trạng thái KHÔNG KHẢ DỤNG của nó khi
// cổng phát hành R14 chưa mở (AC-049/AC-054).
//
// `canPurchase` được quyết ở Server Component và truyền xuống dưới dạng boolean
// (UI-D8). Component này KHÔNG đọc process.env: cờ là server-only, và repo chưa
// từng có cờ tính năng nào đọc được ở client.
//
// KHÔNG BAO GIỜ dùng `disabled` gốc — cùng lý do đã ghi ở ExplainStepAffordance
// và ActionButton: nút sẽ rơi khỏi thứ tự tab, nên người dùng bàn phím không
// tới được nó để ĐỌC lý do vì sao nó không khả dụng. Con bug này đã phải sửa
// hai lần trong repo (RateButton, rồi ActionButton).

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createOrder, type CreateOrderError } from "@/lib/billing/orderActions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

/** Bốn lối từ chối của `createOrder()`, mỗi lối một câu.
 *
 *  Khai bằng `Record<…>` chứ không bằng `switch` có `default`: thêm một mã vào
 *  `CreateOrderError` sẽ là một LỖI BIÊN DỊCH ngay tại đây, chứ không phải một
 *  nhánh im lặng rơi vào câu của một lý do khác.
 *
 *  KHÔNG khoá mới nào được thêm vào từ điển. Ngân sách khoá của UI Spec không
 *  cấp chuỗi nào cho lối thất bại của C-03, và quy ước "chuỗi dùng chung thì
 *  tái dùng, không nhân bản" (en.ts:5-6) đã có sẵn bốn câu ĐÚNG NGHĨA — chính
 *  bảng mà C-10 dùng cho cùng bốn tình huống ấy. Điều kiện được nghiệm thu là
 *  `rate_limited` KHÁC câu lỗi chung, và nó khác. */
const ERROR_KEY: Record<CreateOrderError, MessageKey> = {
  unauthenticated: "profile.error.sessionExpired",
  rate_limited: "billing.recheck.rateLimited",
  provider_unavailable: "billing.recheck.providerUnavailable",
  server: "billing.orders.loadError",
};

/** Câu lỗi CHUNG, dùng cho một exception — cùng câu và cùng lý do như
 *  `RecheckOrderControl` (một promise bị từ chối không băng qua Error Boundary,
 *  nên nhánh này phải tự nói). */
const GENERIC_ERROR_KEY: MessageKey = "billing.orders.loadError";

type Phase = { kind: "idle" } | { kind: "busy" } | { kind: "failed"; key: MessageKey };

export function PurchaseCta({ canPurchase }: { canPurchase: boolean }) {
  const t = useT();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busyRef = useRef(false);
  const reasonId = "billing-cta-reason";
  const busy = phase.kind === "busy";

  /** Nhả chốt CÙNG LÚC với việc hiện câu lỗi: một lượt tạo đơn hỏng tuyệt đối
   *  không được để nút kẹt vĩnh viễn (cùng luật `finally` của C-10). */
  function fail(key: MessageKey) {
    busyRef.current = false;
    setPhase({ kind: "failed", key });
  }

  /** THỨ TỰ TRONG HÀM NÀY LÀ TÍNH ĐÚNG ĐẮN, KHÔNG PHẢI PHONG CÁCH:
   *
   *  1. `if (busyRef.current) return;` TRƯỚC mọi setState và TRƯỚC mọi await.
   *     Đây là tiền: `aria-disabled` chỉ THÔNG BÁO, nó không chặn một cú click
   *     DOM, còn một chốt viết bằng state đọc phải giá trị của lượt render
   *     TRƯỚC nên cú bấm thứ hai trong cùng một tick vẫn lọt và đẻ ra lượt gọi
   *     thứ hai (useTutorAction.ts:26-32, và C-10 đã ghi lại đúng bài học này).
   *  2. KHÔNG ĐIỀU HƯỚNG LẠC QUAN. Route chỉ được vào khi `orderCode` đã có
   *     thật: `/pricing/checkout` không mã là một trạng thái hợp lệ nhưng vô
   *     dụng (C-13 Rỗng), nên tới đó bằng sự lạc quan sẽ làm một cú bấm THÀNH
   *     CÔNG không phân biệt nổi với một cú bấm HỎNG.
   *  3. Mã đơn đi vào query string bằng phép nối chuỗi THÔ. S-06 nhận theo một
   *     DANH SÁCH CHẤP NHẬN (`checkout/page.tsx:110-115`): `/^\d+$/` rồi
   *     `Number.isSafeInteger`. Mọi lượt định dạng theo vùng miền chèn dấu phân
   *     nhóm vào một mã 13 chữ số, và S-06 sẽ vẽ trạng thái Rỗng cho một đơn
   *     vừa được tạo thật.
   *  4. Thành công thì KHÔNG nhả chốt: lượt điều hướng đã phát và màn hình này
   *     đang trên đường rời đi. Nhả ra ở đây là mở lại một cửa sổ bấm-lần-nữa
   *     ngay trên đường tiền, đúng thứ chốt này tồn tại để đóng.
   */
  async function startPurchase() {
    if (busyRef.current) return; // TRƯỚC mọi setState, TRƯỚC mọi await
    busyRef.current = true;
    setPhase({ kind: "busy" });
    try {
      const outcome = await createOrder();
      if ("error" in outcome) {
        fail(ERROR_KEY[outcome.error]);
        return;
      }
      router.push(`/pricing/checkout?order=${outcome.orderCode}`);
    } catch (err) {
      // CHỈ `digest` — định danh Next gắn lên lỗi lúc nó băng qua biên Server
      // Action, đối chiếu được với log máy chủ. Đúng hình dạng hai file
      // `error.tsx` của chính nhóm route này đã chạy thật
      // (`(billing)/me/orders/error.tsx:39`, `(billing)/pricing/checkout/error.tsx:43`),
      // và đúng thứ frontend DD § Logging đòi.
      //
      // KHÔNG log `err`: câu chữ của một lỗi Postgres/PostgREST băng qua đây
      // mang nguyên số tiền, số tài khoản và memo của đơn. `Error#message`
      // không enumerable nên một lượt rò kiểu đó KHÔNG lộ ra dưới
      // `JSON.stringify` — nó chỉ lộ ra ở console thật, tức là muộn.
      console.error("[PurchaseCta] createOrder threw", {
        digest: (err as { digest?: string } | null)?.digest,
      });
      fail(GENERIC_ERROR_KEY);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="lg"
        className="min-h-11 w-full md:w-auto"
        // Chuỗi "true"/"false" chứ không phải boolean — quy ước của ActionButton.
        aria-disabled={canPurchase ? "false" : "true"}
        // aria-describedby chỉ trỏ tới lý do khi lý do có thật; trỏ tới một id
        // không tồn tại là nói dối với trình đọc màn hình.
        aria-describedby={canPurchase ? undefined : reasonId}
        // BOOLEAN, ngược với `aria-disabled` ngay trên — đúng thế bất đối xứng
        // mà ActionButton/ExplainStepAffordance đã chạy thật. Đây là thứ DUY
        // NHẤT nói ra pha "đang tạo đơn"; hai dòng aria phía trên là hợp đồng
        // của `canPurchase` và không được viết đè lên (plan Task 4.4).
        aria-busy={busy}
        onClick={() => {
          // aria-disabled KHÔNG chặn click — nó chỉ thông báo. Chốt chặn hành vi
          // phải là câu lệnh này.
          if (!canPurchase) return;
          // `void`: onClick giữ nguyên là một handler ĐỒNG BỘ, còn chốt bận
          // nằm ở dòng đầu của startPurchase() — vẫn chạy đồng bộ, TRƯỚC mọi
          // await, nên hai cú bấm trong một tick chỉ qua được một lượt gọi.
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
      {/* Idiom 1: node này VẮNG MẶT trước hành động và XUẤT HIỆN sau, mang
          `role="alert"` và KHÔNG mang `aria-live`. Một vùng aria-live chèn sẵn
          chữ có thể KHÔNG BAO GIỜ được đọc lên (SuccessToast.tsx:13-20), còn
          `role="alert"` thì được đọc lúc CHÈN. */}
      {phase.kind === "failed" && (
        <p role="alert" className="text-muted-foreground text-sm leading-relaxed">
          {t(phase.key)}
        </p>
      )}
    </div>
  );
}
