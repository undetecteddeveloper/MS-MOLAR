"use client";

// C-10 RecheckOrderControl — "hỏi lại nhà cung cấp xem đơn này đã trả chưa"
// (PRD R10 / AC-035..AC-037, UI Spec § Component: `RecheckOrderControl`,
// frontend Design Doc Decision 1 + Decision 2).
//
// MỘT component cho CẢ HAI màn hình, và `variant` chỉ chọn NHÃN với diện mạo
// nút — hành vi thì y hệt (frontend DD § E1). Lý do không phải là tiết kiệm
// file: bảng bảy nhánh dưới đây mà tồn tại hai bản thì đó là hai chỗ để bảy câu
// TRÔI LỆCH khỏi nhau, trong khi "không hai lý do nào dùng chung một câu" là
// một ràng buộc về NGHĨA, không phải về văn phong.
//
// THỨ TỰ TRONG HANDLER LÀ TÍNH ĐÚNG ĐẮN, KHÔNG PHẢI PHONG CÁCH (Decision 2):
//   1. `if (busyRef.current) return;` — TRƯỚC mọi setState và TRƯỚC mọi await.
//      `aria-disabled` chỉ THÔNG BÁO, nó không chặn một cú click DOM; còn một
//      chốt viết bằng state (`phase === "busy"`) thì đọc phải giá trị của lượt
//      render TRƯỚC, nên cú bấm thứ hai trong cùng một tick vẫn lọt
//      (useTutorAction.ts:26-32 đã ghi lại đúng bài học này).
//   2. Đặt cờ bận rồi mới setState → `aria-busy` BOOLEAN, `aria-disabled` CHUỖI,
//      và một ô lý do sr-only ĐỔI CHỮ (idiom 3, KHÔNG `aria-live`).
//   3. `await recheckOrder(orderCode)`.
//   4. Cất kết cục vào state → node `role="alert"` XUẤT HIỆN (idiom 1). Vùng
//      `aria-live` chèn sẵn chữ có thể KHÔNG BAO GIỜ được đọc lên
//      (SuccessToast.tsx:13-20 — phát hiện của chính repo này), còn
//      `role="alert"` thì được đọc lúc CHÈN. Vì thế không có `aria-live` nào ở
//      đây, và cũng không có vùng nào bọc badge.
//   5. `router.refresh()` — KHÔNG phải `revalidatePath()`: control này sống
//      trên HAI route và chỉ phía client mới biết mình đang đứng ở route nào.
//      Máy chủ quyết định dòng đơn nói gì; ở đây KHÔNG vá badge cục bộ, vì một
//      lượt vá cục bộ sẽ để C-11 phía trên nói "Free" còn hàng phía dưới nói
//      "đã thanh toán" (UI-D16).
//   6. `finally` nhả chốt — một lượt gọi hỏng tuyệt đối không được để nút kẹt
//      vĩnh viễn.
//
// KHÔNG BAO GIỜ `disabled` gốc, ở MỌI trạng thái. Nút disabled rơi khỏi thứ tự
// tab (bug đã phải sửa hai lần trong repo này: RateButton rồi ActionButton), mà
// đúng người cần với tới control này nhất là người có đơn trông như đã đóng và
// cần đọc *vì sao* hỏi lại cũng không đổi được gì.
//
// VÌ SAO CÓ PROP THỨ BA `status` (UI Spec § C-10 hành vi (5) + § State ×
// Display Matrix cột "Partial"; frontend DD § C-10, bảng `status`). Bảng ấy có
// BA dòng, và `orderCode` với `variant` không phân biệt nổi dòng nào với dòng
// nào: một đơn `paid` phải mount, phải focus được, phải mang `aria-disabled`
// CHUỖI "true" kèm một LÝ DO, và handler của nó phải VỀ SỚM. `status` để kiểu
// `string` chứ không phải union bốn literal — cùng lý do `MyOrderRow.status`
// (`(billing)/queries.ts`) và C-09 để `string`: ràng buộc CHECK của CSDL đổi
// được mà không một dòng TypeScript nào đổi theo, nên nhánh "không nhận ra"
// phải là một GIÁ TRỊ CHẠY ĐƯỢC, không phải một lỗi biên dịch không bao giờ
// xảy ra.
//
// CONTROL KHÔNG BAO GIỜ TỰ THÁO KHỎI CÂY sau khi có kết cục, nên focus của
// người dùng bàn phím ở nguyên đó và không cần cơ chế cứu focus nào (UI-D16).
// Bất kỳ thay đổi tương lai nào gỡ nó đi khi thành công sẽ tái tạo lại đúng vấn
// đề focus mà C-05 phải xử lý bằng ref-trên-`tabIndex={-1}`.
//
// HAI NHÁNH KHÔNG CÓ TRONG BẢNG BẢY CÂU, ghi ra đây để không ai tưởng là sót:
//   · `{ error: "unauthenticated" }` là một nhánh THẬT của `RecheckOutcome`
//     (phiên hết hạn giữa chừng) nhưng không có dòng nào trong bảng C-10 và
//     không có khoá nào được cấp ngân sách trong bảng i18n của UI Spec. Nó dùng
//     LẠI `profile.error.sessionExpired` — đúng nghĩa, đã có ở cả hai ngôn ngữ,
//     và theo đúng quy ước "chuỗi dùng chung thì tái dùng, không nhân bản"
//     (en.ts:5-6).
//   · Một EXCEPTION không phải một kết cục: nó là sự cố thật (lượt đọc CSDL
//     hỏng). Nó KHÔNG được dịch thành một trong bảy câu — làm thế là bịa ra một
//     lý do thanh toán từ một lỗi hạ tầng. Vì một handler async không có đường
//     nào tới `error.tsx` của route (một promise bị từ chối không băng qua
//     Error Boundary), nhánh này ghi log rồi hiện câu lỗi CHUNG đã có sẵn,
//     `billing.orders.loadError` — chính "generic error string" mà plan Task 3.9
//     đòi phải KHÁC câu rate-limit.

import { Loader2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { recheckOrder, type RecheckOutcome } from "@/lib/billing/orderActions";
import type { SettleResult } from "@/lib/billing/settleOrder";
import { formatDate } from "@/lib/format/datetime";
import { useLocale, useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

/** Năm lý do từ chối của `settleOrder()`, mỗi lý do MỘT câu.
 *
 *  Khai bằng `Record<…>` chứ không bằng `switch` có `default`, và đó là cả mục
 *  đích: thêm một lý do vào `SettleResult` sẽ là một LỖI BIÊN DỊCH ngay tại
 *  đây, chứ không phải một nhánh im lặng rơi vào câu của một lý do khác. */
const REASON_KEY: Record<Extract<SettleResult, { settled: false }>["reason"], MessageKey> = {
  unknown_order: "billing.recheck.unknownOrder",
  not_pending: "billing.recheck.notPending",
  not_paid_yet: "billing.recheck.stillPending",
  amount_mismatch: "billing.recheck.amountMismatch",
  provider_unavailable: "billing.recheck.providerUnavailable",
};

/** Hai lối từ chối mà chỉ lớp bọc-đã-đăng-nhập `recheckOrder()` mới có. */
const ERROR_KEY: Record<Extract<RecheckOutcome, { error: string }>["error"], MessageKey> = {
  rate_limited: "billing.recheck.rateLimited",
  unauthenticated: "profile.error.sessionExpired",
};

/** Ba giá trị KẾT THÚC, và ĐÚNG ba (frontend DD § C-10: "Terminal statuses are
 *  `paid`, `expired` and `cancelled`. An unrecognised status is NOT terminal").
 *
 *  Viết bằng một tập hợp CHỨ KHÔNG bằng `status !== "pending"`: hai vị từ ấy
 *  đồng ý ở hai dòng đầu của bảng và LỆCH ở dòng thứ ba — một giá trị không
 *  nhận ra — mà dòng thứ ba mới là dòng FE-AC-10 bảo vệ. Hỏi lại là hành động
 *  DUY NHẤT gỡ được một trạng thái lạ, nên một lần đổi ràng buộc CHECK phía
 *  CSDL không được ship thành một cái khoá lên đúng cái control đó (UI Spec
 *  C-09: "the row's re-check control stays available").
 *
 *  So SÁT NGHĨA, không hạ chữ hoa và không cắt khoảng trắng: "PAID" là một giá
 *  trị lạ chứ không phải "paid" viết khác đi, và đoán hộ CSDL ở đây là cách
 *  lặng lẽ mở rộng tập kết thúc. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["paid", "expired", "cancelled"]);

const LABEL_KEY: Record<RecheckVariant, MessageKey> = {
  row: "billing.recheck.action",
  primary: "billing.confirm.action",
};

const BUTTON_VARIANT: Record<RecheckVariant, "outline" | "default"> = {
  row: "outline",
  primary: "default",
};

export type RecheckVariant = "row" | "primary";

/** MỘT useState cho kết cục, MỘT useRef cho chốt (frontend DD § C-10). Không
 *  giữ dữ liệu đơn trong state: sự thật của dòng nằm ở Postgres, và nó tới màn
 *  hình qua lượt re-render của máy chủ chứ không qua một bản sao phía client. */
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
  /** Trạng thái CỦA DÒNG, nguyên si như tầng truy vấn giao. `string`, không
   *  phải union — xem khối đầu file. */
  status: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busyRef = useRef(false);

  // `orderCode` là khoá chính của dòng nên tự nó duy nhất trong một trang —
  // không cần thêm prop idPrefix.
  const reasonId = `recheck-${orderCode}-reason`;
  const busy = phase.kind === "busy";
  const terminal = TERMINAL_STATUSES.has(status);

  async function run() {
    // Đơn đã đóng thì không có gì để hỏi lại: về sớm TRƯỚC cả chốt bận, nên
    // không có lượt gọi action, không có pha bận và không có node kết cục nào.
    // `aria-disabled` chỉ THÔNG BÁO — nó không chặn một cú click DOM, nên chốt
    // thật phải nằm ở đây (cùng lập luận với `busyRef` ngay dưới).
    if (terminal) return;
    if (busyRef.current) return; // TRƯỚC mọi setState, TRƯỚC mọi await
    busyRef.current = true;
    setPhase({ kind: "busy" });
    try {
      const outcome = await recheckOrder(orderCode);
      setPhase({ kind: "done", outcome });
      // Lượt re-render của máy chủ đáp xuống DƯỚI cái alert vừa hiện: badge,
      // hàng đơn và C-11 đều đọc lại từ nguồn duy nhất là database.
      router.refresh();
    } catch (err) {
      // Chỉ id + kiểu lỗi, không bao giờ log nội dung đơn (frontend DD § Logging).
      console.error("[RecheckOrderControl] recheckOrder threw", { orderCode, err });
      setPhase({ kind: "threw" });
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant={BUTTON_VARIANT[variant]}
        className="min-h-11"
        onClick={run}
        // Chuỗi "true"/"false" cho aria-disabled, boolean cho aria-busy — đúng
        // quy ước ActionButton/ExplainStepAffordance đã chạy thật.
        aria-disabled={busy || terminal ? "true" : "false"}
        aria-busy={busy}
        aria-describedby={reasonId}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCw className="size-4" aria-hidden />
        )}
        {t(LABEL_KEY[variant])}
      </Button>

      {/* Idiom 1: node này VẮNG MẶT trước hành động và XUẤT HIỆN sau, mang
          `role="alert"` và KHÔNG mang `aria-live`. Câu chữ tự nói ra trạng thái
          kết quả bằng LỜI — không dựa vào việc badge đổi màu, vì một badge đổi
          lặng lẽ thì không thông báo gì cả. */}
      {phase.kind !== "idle" && phase.kind !== "busy" && (
        <p role="alert" className="text-muted-foreground mt-2 text-sm">
          {phase.kind === "threw"
            ? t("billing.orders.loadError")
            : t(outcomeKey(phase.outcome), { date: settledDate(phase.outcome, locale) })}
        </p>
      )}

      {/* Idiom 3: chính việc chuỗi này ĐỔI ("" → lý do bận → "") là cơ chế
          thông báo. Không `aria-live` — người dùng tự khởi động lượt chờ này
          nên một lần ngắt lời là không mong muốn. */}
      {/* Hai lý do, hai câu, MỘT ô. Câu của trạng thái kết thúc dùng LẠI
          `billing.recheck.notPending` — đúng câu bảng bảy kết cục đã cấp cho
          `not_pending`, cùng một sự thật ("đơn này đã đóng rồi") nói cho cùng
          một người — nên bảng i18n của UI Spec không phải cấp thêm khoá nào,
          và không có câu thứ hai nào để trôi lệch khỏi câu thứ nhất. */}
      <span id={reasonId} className="sr-only">
        {busy ? t("billing.recheck.busy") : terminal ? t("billing.recheck.notPending") : ""}
      </span>
    </div>
  );
}

/** Kết cục → khoá. Bảy nhánh, bảy khoá, không nhánh nào dùng chung khoá với
 *  nhánh khác — xem bảng của UI Spec C-10. */
function outcomeKey(outcome: RecheckOutcome): MessageKey {
  if ("error" in outcome) return ERROR_KEY[outcome.error];
  if (outcome.settled) return "billing.recheck.settled";
  return REASON_KEY[outcome.reason];
}

/** Chỉ nhánh `settled` mới có ngày, và nó lấy từ `SettleResult.expiresAt` —
 *  KHÔNG tính lại từ "hôm nay + 30 ngày". Đây cũng là lý do câu thành công tự
 *  nêu mốc hết hạn: nếu bảng tóm tắt phía trên có trễ một nhịp thì lời khẳng
 *  định có thẩm quyền vẫn tới được người dùng (Decision 2, giảm nhẹ R-2). */
function settledDate(outcome: RecheckOutcome, locale: ReturnType<typeof useLocale>): string {
  if ("error" in outcome || !outcome.settled) return "";
  return formatDate(outcome.expiresAt, locale);
}
