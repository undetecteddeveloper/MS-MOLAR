// @vitest-environment jsdom

// C-10 RecheckOrderControl — UI Spec § Component: `RecheckOrderControl` (C-10),
// frontend Design Doc Decision 1 (bảy kết cục) + Decision 2 (lượt cập nhật sau
// hành động, hai idiom thông báo) — plan Task 3.7.
//
// NGHĨA VỤ CHỨNG MINH của task này, và tại sao từng khẳng định tồn tại:
//
//   1. BẢY câu, mỗi câu so với một CHUỖI CỐ ĐỊNH viết thẳng ở đây theo TỪNG
//      NGÔN NGỮ. So với `dict[key]` thôi thì KHÔNG chứng minh được gì: hoán đổi
//      hai giá trị trong từ điển làm lệch cả hai vế cùng lúc và khẳng định vẫn
//      xanh (đúng lỗ hổng OrderStatusBadge.test.tsx đã ghi lại). Nên có CẢ HAI:
//      chuỗi cố định ghim CHỮ, còn phép so với `dict[key]` ghim KHOÁ.
//   2. 21 BẤT ĐẲNG THỨC ĐÔI MỘT trong mỗi ngôn ngữ. Một bảng ánh xạ mà hai
//      nhánh lỡ trỏ vào cùng một khoá vẫn render "một cái alert nào đó" — chỉ
//      phép so đôi một mới bắt được. Và đây không phải phép làm đẹp: "chưa với
//      tới được nhà cung cấp" với "bạn chưa chuyển tiền" đòi hai hành động
//      NGƯỢC nhau (UI Spec C-10).
//   3. MỘT lượt gọi cho HAI lần bấm trong CÙNG một tick — khẳng định trên SỐ
//      LƯỢT GỌI của action, không phải trên giao diện. Chốt là `busyRef` đồng
//      bộ; một chốt viết bằng state (`phase === "busy"`) đọc phải giá trị của
//      lượt render TRƯỚC và để lọt cú thứ hai (useTutorAction.ts:26-32).
//   4. Badge SAU lượt re-render. C-10 không render badge và KHÔNG được vá nó
//      (UI-D16: không vá cục bộ, máy chủ quyết định dòng nói gì) — nên harness
//      dưới đây mô hình hoá đúng hai thứ có thật: một DÒNG máy chủ mà
//      `settleOrder()` là người ghi DUY NHẤT (settled ⇒ 'paid'; mọi lối từ chối
//      KHÔNG ghi gì), và một lượt re-render chỉ xảy ra KHI control gọi
//      `router.refresh()`. Bỏ lời gọi refresh ⇒ badge đứng yên ở giá trị cũ,
//      đúng như trên trình duyệt.
//
// Mock boundary (frontend DD § Test Boundaries): CHỈ module action được stub
// (kèm bộ đếm) và `next/navigation`. Từ điển, `OrderStatusBadge`, `Button`,
// `formatDate` đều CHẠY THẬT — chính việc phân giải chữ THẬT mới làm bảy phép
// so bằng có nghĩa.
//
// render() không auto-cleanup (vitest.config.ts không có setupFiles) nên mỗi
// case tự dọn; cũng vì vậy không có matcher jest-dom nào ở đây.

import { act, cleanup, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { RecheckOrderControl } from "./RecheckOrderControl";
import type { RecheckOutcome } from "@/lib/billing/orderActions";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi as viDict } from "@/lib/i18n/dictionaries/vi";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locales";

/** Dòng đơn phía máy chủ. `settleOrder()` là người ghi DUY NHẤT của cột này —
 *  một lượt đối soát thành công ghi 'paid', còn mọi lối từ chối không ghi gì.
 *  Đó là MỘT luật, không phải một bản sao bảy dòng của bảng kỳ vọng. */
const serverRow = { status: "pending" };

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));

import { recheckOrder } from "@/lib/billing/orderActions";

const mockRecheck = vi.mocked(recheckOrder);

const ORDER_CODE = 8123456789012;

// 17:30Z rơi vào 00:30 giờ ICT của NGÀY HÔM SAU — cố ý chọn một instant lệch
// NGÀY LỊCH giữa UTC và ICT. Máy chạy test ở Asia/Saigon, nên một formatter
// KHÔNG ghim múi giờ vẫn in đúng ở đây rồi hỏng trên Vercel (chạy UTC); chọn
// một mốc chỉ lệch GIỜ sẽ không bao giờ phát hiện ra điều đó.
const SETTLED_EXPIRES_AT = "2026-09-18T17:30:00.000Z";
const SETTLED_DATE = "19/09/2026";

/** Bảy kết cục, bảy khoá, bảy câu, và trạng thái badge SAU lượt re-render —
 *  chép nguyên văn từ bảng của UI Spec C-10. Chuỗi kỳ vọng viết TAY ở đây, phần
 *  của `settled` đã thay sẵn `{date}`. */
const OUTCOMES: ReadonlyArray<{
  name: string;
  result: RecheckOutcome;
  key: keyof typeof en;
  en: string;
  vi: string;
  badgeAfter: "paid" | "pending";
}> = [
  {
    name: "{settled:true}",
    result: { settled: true, expiresAt: SETTLED_EXPIRES_AT },
    key: "billing.recheck.settled",
    en: "Paid — your Premium period runs to 19/09/2026.",
    vi: "Đã thanh toán — kỳ Premium của bạn chạy tới 19/09/2026.",
    badgeAfter: "paid",
  },
  {
    name: "not_paid_yet",
    result: { settled: false, reason: "not_paid_yet" },
    key: "billing.recheck.stillPending",
    en: "Still awaiting payment. Transfer the exact amount with the transfer note shown on the payment screen, then check again.",
    vi: "Vẫn đang chờ khoản chuyển. Bạn chuyển đúng số tiền kèm nội dung chuyển khoản ghi trên màn hình thanh toán, rồi kiểm tra lại.",
    badgeAfter: "pending",
  },
  {
    name: "not_pending",
    result: { settled: false, reason: "not_pending" },
    key: "billing.recheck.notPending",
    en: "This order is already closed, so re-checking will not change it.",
    vi: "Đơn này đã đóng rồi, nên kiểm tra lại cũng không đổi được gì.",
    badgeAfter: "pending",
  },
  {
    name: "unknown_order",
    result: { settled: false, reason: "unknown_order" },
    key: "billing.recheck.unknownOrder",
    en: "We cannot find this order. Use the “Send feedback” button and quote the order code so we can look it up.",
    vi: "Chúng tôi không tìm thấy đơn này. Bạn bấm nút “Gửi phản hồi” và gửi kèm mã đơn để chúng tôi tra giúp.",
    badgeAfter: "pending",
  },
  {
    name: "amount_mismatch",
    result: { settled: false, reason: "amount_mismatch" },
    key: "billing.recheck.amountMismatch",
    en: "The amount received does not match this order. Use the “Send feedback” button and quote the order code — a person has to settle this one.",
    vi: "Số tiền nhận được không khớp với đơn này. Bạn bấm nút “Gửi phản hồi” và gửi kèm mã đơn — trường hợp này cần một người xử lý.",
    badgeAfter: "pending",
  },
  {
    name: "provider_unavailable",
    result: { settled: false, reason: "provider_unavailable" },
    key: "billing.recheck.providerUnavailable",
    en: "We could not reach the payment provider. Nothing about your order changed; try again shortly.",
    vi: "Chúng tôi chưa liên lạc được với nhà cung cấp thanh toán. Đơn của bạn không có gì thay đổi; bạn thử lại sau ít phút.",
    badgeAfter: "pending",
  },
  {
    name: "rate-limited (AC-037)",
    result: { error: "rate_limited" },
    key: "billing.recheck.rateLimited",
    en: "You checked several times in a row. Wait a moment, then check again.",
    vi: "Bạn vừa kiểm tra liên tiếp nhiều lần. Chờ một chút rồi kiểm tra lại nhé.",
    badgeAfter: "pending",
  },
];

/** Chữ của badge theo từng ngôn ngữ — CHUỖI CỐ ĐỊNH, đúng bộ mà
 *  OrderStatusBadge.test.tsx đã ghim, không tra lại từ điển. */
const BADGE_WORD: Record<"paid" | "pending", Record<Locale, string>> = {
  pending: { en: "Awaiting payment", vi: "Chờ thanh toán" },
  paid: { en: "Paid", vi: "Đã thanh toán" },
};

function Row({ locale, status }: { locale: Locale; status: string }) {
  return (
    <I18nProvider locale={locale}>
      <OrderStatusBadge status={status} />
      <RecheckOrderControl orderCode={ORDER_CODE} variant="row" status={status} />
    </I18nProvider>
  );
}

/** NÉM khi không có badge — một helper trả "" sẽ làm mọi phép so "khác X" xanh
 *  trên một cây DOM rỗng. */
function readBadgeWord(container: HTMLElement): string {
  const badge = container.firstElementChild;
  if (!(badge instanceof HTMLElement)) throw new Error("no badge rendered");
  const glyph = badge.querySelector("[aria-hidden]")?.textContent ?? "";
  const word = (badge.textContent ?? "").slice(glyph.length);
  if (word === "") throw new Error("badge rendered an empty word");
  return word;
}

function stubOutcome(outcome: RecheckOutcome) {
  mockRecheck.mockImplementation(async () => {
    if ("settled" in outcome && outcome.settled) serverRow.status = "paid";
    return outcome;
  });
}

/** Một lượt bấm trọn vẹn: đọc badge TRƯỚC, kích hoạt, đọc câu, rồi dựng lại cây
 *  bằng đúng trạng thái mà máy chủ sẽ gửi xuống ở lượt re-render — và CHỈ khi
 *  control thực sự yêu cầu lượt re-render đó. */
async function activate(locale: Locale, outcome: RecheckOutcome) {
  serverRow.status = "pending";
  stubOutcome(outcome);
  const view = render(<Row locale={locale} status="pending" />);
  const scope = within(view.container);
  const button = scope.getByRole("button");
  const badgeBefore = readBadgeWord(view.container);
  const alertBefore = scope.queryByRole("alert");

  await act(async () => {
    button.click();
  });

  const alert = scope.getByRole("alert");
  const sentence = alert.textContent ?? "";
  const statusFromServer = refresh.mock.calls.length > 0 ? serverRow.status : "pending";
  view.rerender(<Row locale={locale} status={statusFromServer} />);

  return {
    view,
    scope,
    button,
    alert,
    sentence,
    alertBefore,
    badgeBefore,
    badgeAfter: readBadgeWord(view.container),
  };
}

beforeEach(() => {
  mockRecheck.mockReset();
  refresh.mockReset();
  serverRow.status = "pending";
});

afterEach(cleanup);

describe("bảy kết cục — bảy câu, bảy khoá, và trạng thái badge sau lượt re-render", () => {
  it.each(OUTCOMES)("$name: câu tiếng Anh đúng CHUỖI đã duyệt và đúng KHOÁ", async (row) => {
    const { sentence } = await activate("en", row.result);
    expect(sentence).toBe(row.en);
    expect(sentence).toBe(en[row.key].replace("{date}", SETTLED_DATE));
  });

  it.each(OUTCOMES)("$name: câu tiếng Việt đúng CHUỖI đã duyệt và đúng KHOÁ", async (row) => {
    const { sentence } = await activate("vi", row.result);
    expect(sentence).toBe(row.vi);
    expect(sentence).toBe(viDict[row.key].replace("{date}", SETTLED_DATE));
  });

  it.each<Locale>(["en", "vi"])(
    "%s: 21 phép so đôi một — không hai lý do nào dùng chung một câu",
    async (locale) => {
      const sentences: string[] = [];
      for (const row of OUTCOMES) {
        const { sentence, view } = await activate(locale, row.result);
        sentences.push(sentence);
        view.unmount();
      }
      expect(sentences).toHaveLength(7);
      let pairs = 0;
      for (let i = 0; i < sentences.length; i++) {
        for (let j = i + 1; j < sentences.length; j++) {
          const label = `${OUTCOMES[i].name} vs ${OUTCOMES[j].name}`;
          expect(`${label}: ${sentences[i]}`).not.toBe(`${label}: ${sentences[j]}`);
          pairs++;
        }
      }
      expect(pairs).toBe(21);
      expect(new Set(sentences).size).toBe(7);
    }
  );

  it.each(OUTCOMES)("$name: badge trước → kích hoạt → badge sau", async (row) => {
    const { badgeBefore, badgeAfter } = await activate("en", row.result);
    expect(badgeBefore).toBe(BADGE_WORD.pending.en);
    expect(badgeAfter).toBe(BADGE_WORD[row.badgeAfter].en);
  });

  it("chỉ settled đổi badge; sáu kết cục còn lại để badge NGUYÊN như trước", async () => {
    const changed: string[] = [];
    for (const row of OUTCOMES) {
      const { badgeBefore, badgeAfter, view } = await activate("vi", row.result);
      if (badgeAfter !== badgeBefore) changed.push(row.name);
      expect(badgeAfter).toBe(BADGE_WORD[row.badgeAfter].vi);
      view.unmount();
    }
    expect(changed).toEqual(["{settled:true}"]);
  });

  it.each(OUTCOMES)("$name: mỗi lượt kích hoạt gọi router.refresh() đúng MỘT lần", async (row) => {
    await activate("en", row.result);
    expect(refresh.mock.calls.length).toBe(1);
  });
});

describe("hai kết cục ngoài bảng — không nhánh nào rơi vào câu của một nhánh khác", () => {
  it("phiên hết hạn dùng câu phiên-hết-hạn đã có sẵn, khác cả bảy câu", async () => {
    const { sentence } = await activate("en", { error: "unauthenticated" });
    expect(sentence).toBe("Your session has expired. Sign in again.");
    for (const row of OUTCOMES) expect(sentence).not.toBe(row.en);
  });

  it("action NÉM thì hiện câu lỗi chung, khác cả bảy câu, và nút không kẹt busy", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockRecheck.mockRejectedValue(new Error("db read failed"));
      const view = render(<Row locale="en" status="pending" />);
      const scope = within(view.container);
      const button = scope.getByRole("button");
      await act(async () => {
        button.click();
      });
      const sentence = scope.getByRole("alert").textContent ?? "";
      expect(sentence).toBe("We could not load your orders just now. Try again.");
      for (const row of OUTCOMES) expect(sentence).not.toBe(row.en);
      expect(button.getAttribute("aria-busy")).toBe("false");
      expect(button.hasAttribute("disabled")).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("chốt busyRef đồng bộ", () => {
  it("HAI lần bấm trong cùng một tick ⇒ ĐÚNG MỘT lượt gọi action", async () => {
    let resolveRecheck!: (outcome: RecheckOutcome) => void;
    mockRecheck.mockImplementation(
      () =>
        new Promise<RecheckOutcome>((resolve) => {
          resolveRecheck = resolve;
        })
    );
    const view = render(<Row locale="en" status="pending" />);
    const button = within(view.container).getByRole("button");

    // CẢ HAI cú bấm trong MỘT act(): fireEvent bọc từng lời gọi trong act riêng
    // và flush state ở giữa, nên một chốt viết bằng state sẽ trông như đúng.
    act(() => {
      button.click();
      button.click();
    });

    expect(mockRecheck.mock.calls.length).toBe(1);
    expect(mockRecheck).toHaveBeenCalledWith(ORDER_CODE);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      resolveRecheck({ settled: false, reason: "not_paid_yet" });
    });
    expect(mockRecheck.mock.calls.length).toBe(1);
  });

  it("nhả chốt sau khi xong: lượt kích hoạt thứ hai gọi action lần nữa", async () => {
    stubOutcome({ settled: false, reason: "not_paid_yet" });
    const view = render(<Row locale="en" status="pending" />);
    const button = within(view.container).getByRole("button");
    await act(async () => {
      button.click();
    });
    await act(async () => {
      button.click();
    });
    expect(mockRecheck.mock.calls.length).toBe(2);
  });
});

describe("ARIA: idiom 1 cho kết cục, idiom 3 cho pha bận, KHÔNG BAO GIỜ disabled gốc", () => {
  it("lúc rảnh: không alert, aria-disabled=false, aria-busy=false, lý do rỗng", () => {
    const view = render(<Row locale="en" status="pending" />);
    const scope = within(view.container);
    const button = scope.getByRole("button");
    expect(scope.queryByRole("alert")).toBeNull();
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");
    const reasonId = button.getAttribute("aria-describedby");
    expect(reasonId).not.toBeNull();
    expect(view.container.querySelector(`#${reasonId}`)?.textContent).toBe("");
  });

  it("lúc bận: aria-busy là BOOLEAN true, aria-disabled là CHUỖI 'true', lý do đổi chữ", () => {
    mockRecheck.mockImplementation(() => new Promise<RecheckOutcome>(() => {}));
    const view = render(<Row locale="en" status="pending" />);
    const button = within(view.container).getByRole("button");
    act(() => {
      button.click();
    });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const reasonId = button.getAttribute("aria-describedby");
    expect(view.container.querySelector(`#${reasonId}`)?.textContent).toBe(
      "Checking with the payment provider…"
    );
  });

  it("node kết cục XUẤT HIỆN (vắng trước, có sau) và mang role=alert", async () => {
    const { alertBefore, alert } = await activate("en", { settled: false, reason: "not_pending" });
    expect(alertBefore).toBeNull();
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.hasAttribute("aria-live")).toBe(false);
  });

  it("KHÔNG có vùng aria-live nào trong cây, ở cả ba pha", async () => {
    mockRecheck.mockImplementation(() => new Promise<RecheckOutcome>(() => {}));
    const busyView = render(<Row locale="en" status="pending" />);
    expect(busyView.container.querySelector("[aria-live]")).toBeNull();
    act(() => {
      within(busyView.container).getByRole("button").click();
    });
    expect(busyView.container.querySelector("[aria-live]")).toBeNull();
    busyView.unmount();

    const { view } = await activate("en", { settled: true, expiresAt: SETTLED_EXPIRES_AT });
    expect(view.container.querySelector("[aria-live]")).toBeNull();
  });

  it.each(OUTCOMES)(
    "$name: sau kết cục, nút vẫn còn trong cây và KHÔNG disabled gốc",
    async (row) => {
      const { button, scope } = await activate("en", row.result);
      expect(scope.getByRole("button")).toBe(button);
      expect(button.hasAttribute("disabled")).toBe(false);
      expect((button as HTMLButtonElement).disabled).toBe(false);
      button.focus();
      expect(document.activeElement).toBe(button);
    }
  );

  it("không disabled gốc ở pha rảnh lẫn pha bận, và có min-h-11", () => {
    mockRecheck.mockImplementation(() => new Promise<RecheckOutcome>(() => {}));
    const view = render(<Row locale="en" status="pending" />);
    const button = within(view.container).getByRole("button") as HTMLButtonElement;
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.disabled).toBe(false);
    expect(button.className).toContain("min-h-11");
    act(() => {
      button.click();
    });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.disabled).toBe(false);
  });
});

describe("variant chỉ đổi NHÃN và diện mạo, không đổi hành vi", () => {
  function renderVariant(variant: "row" | "primary", locale: Locale) {
    const view = render(
      <I18nProvider locale={locale}>
        <RecheckOrderControl orderCode={ORDER_CODE} variant={variant} status="pending" />
      </I18nProvider>
    );
    return { view, button: within(view.container).getByRole("button") };
  }

  it.each<[Locale, string, string]>([
    ["en", "Check this order again", "I have transferred — check now"],
    ["vi", "Kiểm tra lại đơn này", "Tôi đã chuyển khoản — kiểm tra ngay"],
  ])("%s: hai nhãn khác nhau cho hai variant", (locale, rowLabel, primaryLabel) => {
    expect(renderVariant("row", locale).button.textContent).toBe(rowLabel);
    expect(renderVariant("primary", locale).button.textContent).toBe(primaryLabel);
    expect(rowLabel).not.toBe(primaryLabel);
  });

  it("primary dùng lớp nút chính, row dùng lớp outline; cả hai đều min-h-11", () => {
    const primary = renderVariant("primary", "en").button;
    const row = renderVariant("row", "en").button;
    expect(primary.className).toContain("bg-primary");
    expect(row.className).not.toContain("bg-primary");
    expect(row.className).toContain("border-border");
    expect(primary.className).toContain("min-h-11");
    expect(row.className).toContain("min-h-11");
  });

  it("primary render đúng CÙNG một câu kết cục như row", async () => {
    stubOutcome({ settled: false, reason: "provider_unavailable" });
    const { view, button } = renderVariant("primary", "en");
    await act(async () => {
      button.click();
    });
    expect(within(view.container).getByRole("alert").textContent).toBe(
      "We could not reach the payment provider. Nothing about your order changed; try again shortly."
    );
    expect(mockRecheck).toHaveBeenCalledWith(ORDER_CODE);
  });
});

// ===========================================================================
// TRẠNG THÁI KẾT THÚC — UI Spec § C-10 hành vi (5) + § State × Display Matrix
// cột "Partial (terminal status)"; frontend DD § C-10 bảng `status`.
//
// Bảng ba dòng của frontend DD là toàn bộ luật, và nó có BA dòng chứ không hai:
//   · `pending`                       → mount, aria-disabled "false", handler CHẠY
//   · `paid`/`expired`/`cancelled`    → mount, aria-disabled "true",  handler VỀ SỚM
//   · BẤT KỲ giá trị nào khác          → mount, aria-disabled "false", handler CHẠY
//
// Dòng thứ ba là FE-AC-10 và nó là lý do khối này tồn tại: một vị từ viết
// `status !== "pending"` thoả hai dòng đầu và SAI ở dòng ba — một lần đổi ràng
// buộc CHECK phía CSDL sẽ khoá đúng cái control duy nhất gỡ được tình trạng đó
// (UI Spec C-09: "the row's re-check control stays available"). Vì thế danh sách
// KHÔNG-kết-thúc dưới đây cố ý gồm cả những giá trị chỉ SÁT BÊN một giá trị kết
// thúc — "PAID", "paid " — để một vị từ hạ chữ hoa hay cắt khoảng trắng cũng đỏ.
//
// KHÔNG khoá nào được cấp thêm trong bảng i18n của UI Spec cho câu lý do này,
// nên nó DÙNG LẠI `billing.recheck.notPending` — đúng câu mà bảng bảy kết cục ở
// trên đã ghim. Vì vậy mỗi khẳng định dưới đây có CẢ HAI vế: chuỗi cố định viết
// tay (ghim CHỮ) và phép so với `en[...]`/`viDict[...]` (ghim KHOÁ).
// ===========================================================================

const TERMINAL_STATUSES = ["paid", "expired", "cancelled"] as const;

/** Ba giá trị này KHÔNG kết thúc, và mỗi giá trị bác một vị từ sai khác nhau:
 *  `pending` là dòng một của bảng; "refunded" là FE-AC-10 đúng nghĩa (một giá
 *  trị CHECK tương lai); "PAID" và "paid " bác một vị từ chuẩn hoá chuỗi trước
 *  khi so; "" bác một vị từ coi giá trị rỗng là đã đóng. */
const NON_TERMINAL_STATUSES = ["pending", "refunded", "PAID", "paid ", ""] as const;

const TERMINAL_REASON: Record<Locale, string> = {
  en: "This order is already closed, so re-checking will not change it.",
  vi: "Đơn này đã đóng rồi, nên kiểm tra lại cũng không đổi được gì.",
};

function reasonNode(view: { container: HTMLElement }, button: HTMLElement): Element {
  const reasonId = button.getAttribute("aria-describedby");
  expect(reasonId).not.toBeNull();
  const node = view.container.querySelector(`#${reasonId}`);
  if (!node) throw new Error(`aria-describedby="${reasonId}" trỏ vào một node KHÔNG tồn tại`);
  return node;
}

describe("trạng thái kết thúc: vẫn mount, vẫn focus được, aria-disabled='true', handler về sớm", () => {
  it.each(TERMINAL_STATUSES)(
    "%s: nút CÒN trong cây, aria-disabled='true', và lý do đi kèm qua aria-describedby (en)",
    (status) => {
      const view = render(<Row locale="en" status={status} />);
      // getByRole NÉM nếu nút bị gỡ khỏi cây — đó là mutant "biến mất thay vì
      // aria-disabled", và nó phải chết ở đây chứ không ở một khẳng định mềm.
      const button = within(view.container).getByRole("button");

      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-busy")).toBe("false");

      const reason = reasonNode(view, button);
      expect(reason.textContent).toBe(TERMINAL_REASON.en);
      expect(reason.textContent).toBe(en["billing.recheck.notPending"]);
    }
  );

  it.each(TERMINAL_STATUSES)("%s: cùng câu lý do ấy, bằng tiếng Việt", (status) => {
    const view = render(<Row locale="vi" status={status} />);
    const button = within(view.container).getByRole("button");

    expect(button.getAttribute("aria-disabled")).toBe("true");
    const reason = reasonNode(view, button);
    expect(reason.textContent).toBe(TERMINAL_REASON.vi);
    expect(reason.textContent).toBe(viDict["billing.recheck.notPending"]);
  });

  it.each(TERMINAL_STATUSES)(
    "%s: KHÔNG disabled gốc, và vẫn nằm trong thứ tự tab (nhận được focus)",
    (status) => {
      const view = render(<Row locale="en" status={status} />);
      const button = within(view.container).getByRole("button") as HTMLButtonElement;

      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.disabled).toBe(false);
      expect(button.tabIndex).toBe(0); // `tabIndex={-1}` cũng gỡ nút khỏi bàn phím
      button.focus();
      expect(document.activeElement).toBe(button);
    }
  );

  it.each(TERMINAL_STATUSES)(
    "%s: bấm KHÔNG gọi action lần nào — khẳng định trên SỐ LƯỢT GỌI, không trên giao diện",
    async (status) => {
      // Stub này sẽ ĐỔI dòng máy chủ nếu bị gọi: nếu nhánh kết thúc lỡ chạy
      // action thì không chỉ bộ đếm đỏ, `serverRow` cũng bẩn.
      stubOutcome({ settled: true, expiresAt: SETTLED_EXPIRES_AT });
      const view = render(<Row locale="en" status={status} />);
      const scope = within(view.container);
      const button = scope.getByRole("button");

      await act(async () => {
        button.click();
      });

      expect(mockRecheck.mock.calls.length).toBe(0);
      expect(refresh.mock.calls.length).toBe(0);
      expect(scope.queryByRole("alert")).toBeNull();
      expect(serverRow.status).toBe("pending");
      // Và nút vẫn ở đúng trạng thái kết thúc, không rơi vào pha bận.
      expect(button.getAttribute("aria-busy")).toBe("false");
      expect(button.getAttribute("aria-disabled")).toBe("true");
    }
  );

  it.each(NON_TERMINAL_STATUSES)(
    "%s KHÔNG phải trạng thái kết thúc: aria-disabled='false', lý do rỗng, và action CHẠY (FE-AC-10)",
    async (status) => {
      stubOutcome({ settled: false, reason: "not_paid_yet" });
      const view = render(<Row locale="en" status={status} />);
      const scope = within(view.container);
      const button = scope.getByRole("button");

      expect(button.getAttribute("aria-disabled")).toBe("false");
      expect(reasonNode(view, button).textContent).toBe("");

      await act(async () => {
        button.click();
      });

      expect(mockRecheck.mock.calls.length).toBe(1);
      expect(mockRecheck).toHaveBeenCalledWith(ORDER_CODE);
      expect(scope.getByRole("alert").textContent).toBe(
        "Still awaiting payment. Transfer the exact amount with the transfer note shown on the payment screen, then check again."
      );
    }
  );

  it("câu lý do của trạng thái kết thúc KHÁC câu của pha bận — hai lý do, hai câu", () => {
    const terminal = render(<Row locale="en" status="cancelled" />);
    const terminalReason = reasonNode(
      terminal,
      within(terminal.container).getByRole("button")
    ).textContent;
    terminal.unmount();
    // Ghim vế "kết thúc" trước đã: nếu không, một cài đặt để lý do RỖNG cũng
    // thoả "hai câu khác nhau" và ca này trở thành vô nghĩa.
    expect(terminalReason).toBe(TERMINAL_REASON.en);

    mockRecheck.mockImplementation(() => new Promise<RecheckOutcome>(() => {}));
    const busyView = render(<Row locale="en" status="pending" />);
    const busyButton = within(busyView.container).getByRole("button");
    act(() => {
      busyButton.click();
    });

    expect(reasonNode(busyView, busyButton).textContent).toBe(
      "Checking with the payment provider…"
    );
    expect(terminalReason).not.toBe(reasonNode(busyView, busyButton).textContent);
  });

  it("variant primary tuân đúng cùng luật ấy — hành vi không đổi theo variant", async () => {
    stubOutcome({ settled: true, expiresAt: SETTLED_EXPIRES_AT });
    const view = render(
      <I18nProvider locale="en">
        <RecheckOrderControl orderCode={ORDER_CODE} variant="primary" status="expired" />
      </I18nProvider>
    );
    const button = within(view.container).getByRole("button");

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(reasonNode(view, button).textContent).toBe(TERMINAL_REASON.en);

    await act(async () => {
      button.click();
    });
    expect(mockRecheck.mock.calls.length).toBe(0);
  });
});
