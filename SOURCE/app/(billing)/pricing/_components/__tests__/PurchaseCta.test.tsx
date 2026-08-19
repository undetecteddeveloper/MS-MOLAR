// @vitest-environment jsdom

// C-03 PurchaseCta — lượt bấm mua: `createOrder()` rồi ĐIỀU HƯỚNG (plan Task 4.4,
// UI Spec § Component: `PurchaseCta` — C-03 delta v1.2, frontend DD FE-I3 /
// `code:25`).
//
// NGHĨA VỤ CHỨNG MINH của task này, và vì sao từng khẳng định tồn tại:
//
//   1. BIÊN S-05 → S-06 LÀ MỘT PHÉP SO BẰNG, KHÔNG PHẢI MỘT PHÉP KIỂM HÌNH
//      DẠNG. Giá trị đi vào query string được đọc NGƯỢC ra khỏi URL vừa push,
//      phân tích theo ĐÚNG luật của `checkout/page.tsx:110-115`, rồi so BẰNG với
//      chính `orderCode` mà `createOrder()` trả về. "Có điều hướng" và "chuỗi
//      trông giống chữ số" đều xanh trên một mã SAI.
//   2. HAI CÚ BẤM TRONG MỘT CỬA SỔ ĐANG BAY ⇒ ĐÚNG MỘT lượt gọi action. Đây là
//      tiền: khẳng định đặt trên SỐ LƯỢT GỌI, và hai cú bấm nằm trong CÙNG một
//      `act()` với promise chưa resolve — `fireEvent` bọc mỗi lời gọi trong một
//      `act` riêng và flush state ở giữa, nên một chốt viết bằng state sẽ trông
//      như đúng (useTutorAction.ts:26-32; RecheckOrderControl.test.tsx).
//   3. THẤT BẠI ⇒ SỐ LƯỢT ĐIỀU HƯỚNG BẰNG 0, và người dùng ĐƯỢC BÁO — khẳng
//      định trên CHỮ (chuỗi cố định viết thẳng ở đây, theo từng ngôn ngữ), không
//      trên sự tồn tại của một node. Một `<p role="alert">` rỗng qua được mọi
//      phép kiểm "có alert".
//   4. KHÔNG ĐIỀU HƯỚNG LẠC QUAN: trong lúc promise còn bay, 0 lượt push. Một
//      lượt push phát sớm làm cú bấm HỎNG trông y hệt cú bấm THÀNH CÔNG.
//
// Mock boundary (frontend DD § Test Boundaries, FE-I3): CHỈ module action được
// stub (kèm bộ đếm) và `next/navigation`. Từ điển, `Button`, `I18nProvider` chạy
// THẬT — chính việc phân giải chữ thật mới làm các phép so bằng có nghĩa.
//
// render() không auto-cleanup (vitest.config.ts không có setupFiles) nên mỗi
// case tự dọn; cũng vì vậy không có matcher jest-dom nào ở đây.

import { act, cleanup, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseCta } from "../PurchaseCta";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import type { CreateOrderError, CreateOrderOutcome } from "@/lib/billing/orderActions";
import { I18nProvider } from "@/lib/i18n/client";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi as viDict } from "@/lib/i18n/dictionaries/vi";
import type { Locale } from "@/lib/i18n/locales";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/billing/orderActions", () => ({ createOrder: vi.fn() }));

import { createOrder } from "@/lib/billing/orderActions";

const mockCreate = vi.mocked(createOrder);

/** Mã đơn THẬT có hình dạng epoch-millisecond 13 chữ số (`freshOrderCode()` =
 *  `Date.now()`), nên mọi lượt định dạng theo vùng miền sẽ chèn dấu phân nhóm —
 *  đó chính là mutant mà biên này phải loại. Cố ý KHÁC `amountVnd` bên dưới:
 *  hai trường cùng kiểu mang cùng một giá trị thì một handler serialise nhầm
 *  trường vẫn xanh. */
const ORDER_CODE = 1755600000000;

/** Tám trường `CheckoutOrder`, mỗi trường một giá trị KHÁC NHAU. `accountNumber`
 *  cố ý cũng là một chuỗi toàn chữ số: nó qua được regex của S-06, nên chỉ phép
 *  so BẰNG với `orderCode` mới bắt được một handler serialise nhầm cột. */
const STUB_ORDER: CheckoutOrder = {
  orderCode: ORDER_CODE,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2026-08-19T17:30:00.000Z",
  qrPayload: "00020101021238QRPAYLOAD5802VN",
  accountNumber: "0123456789",
  accountName: "CONG TY MS MOLAR",
  memo: `MSMOLAR ${ORDER_CODE}`,
};

/** Luật của NGƯỜI TIÊU THỤ, chép nguyên văn từ `parseOrderCode()` ở
 *  `app/(billing)/pricing/checkout/page.tsx:110-115`. Ba điều kiện, đúng thứ tự
 *  ấy, và KHÔNG BAO GIỜ `parseInt`. Chép sang đây (thay vì import) vì hàm ấy là
 *  chi tiết cục bộ của một Server Component không export nó; bù lại có một case
 *  riêng bên dưới chứng minh bản chép này thật sự LOẠI được mutant. */
const S06_ORDER_CODE = /^\d+$/;
function parseOrderCodeAsS06Does(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  if (!S06_ORDER_CODE.test(raw)) return null;
  const orderCode = Number(raw);
  return Number.isSafeInteger(orderCode) && orderCode > 0 ? orderCode : null;
}

/** Bốn lối từ chối của `createOrder()`, mỗi lối một câu — chuỗi kỳ vọng viết TAY
 *  ở đây theo từng ngôn ngữ. So với `dict[key]` thôi thì không chứng minh được
 *  gì: hoán đổi hai giá trị trong từ điển làm lệch cả hai vế cùng lúc. Nên có CẢ
 *  HAI — chuỗi cố định ghim CHỮ, phép so với `dict[key]` ghim KHOÁ. */
const FAILURES: ReadonlyArray<{
  name: string;
  error: CreateOrderError;
  key: keyof typeof en;
  en: string;
  vi: string;
}> = [
  {
    name: "unauthenticated",
    error: "unauthenticated",
    key: "profile.error.sessionExpired",
    en: "Your session has expired. Sign in again.",
    vi: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
  },
  {
    name: "rate_limited",
    error: "rate_limited",
    key: "billing.recheck.rateLimited",
    en: "You checked several times in a row. Wait a moment, then check again.",
    vi: "Bạn vừa kiểm tra liên tiếp nhiều lần. Chờ một chút rồi kiểm tra lại nhé.",
  },
  {
    name: "provider_unavailable",
    error: "provider_unavailable",
    key: "billing.recheck.providerUnavailable",
    en: "We could not reach the payment provider. Nothing about your order changed; try again shortly.",
    vi: "Chúng tôi chưa liên lạc được với nhà cung cấp thanh toán. Đơn của bạn không có gì thay đổi; bạn thử lại sau ít phút.",
  },
  {
    name: "server",
    error: "server",
    key: "billing.orders.loadError",
    en: "We could not load your orders just now. Try again.",
    vi: "Chưa tải được danh sách đơn của bạn. Bạn thử lại nhé.",
  },
];

/** Câu lỗi CHUNG — chính câu mà Completion Criteria đòi câu rate-limit phải
 *  KHÁC. Cùng câu C-10 dùng cho một exception (RecheckOrderControl.tsx:63-69). */
const GENERIC = { en: "We could not load your orders just now. Try again.", vi: "Chưa tải được danh sách đơn của bạn. Bạn thử lại nhé." } as const;

function Cta({ locale = "en", canPurchase = true }: { locale?: Locale; canPurchase?: boolean }) {
  return (
    <I18nProvider locale={locale}>
      <PurchaseCta canPurchase={canPurchase} />
    </I18nProvider>
  );
}

/** NÉM khi không có nút — một helper trả về `null` sẽ làm mọi khẳng định "0 lượt
 *  gọi" xanh trên một cây DOM rỗng. */
function buttonOf(container: HTMLElement): HTMLButtonElement {
  const button = within(container).getByRole("button");
  if (!(button instanceof HTMLButtonElement)) throw new Error("no button rendered");
  return button;
}

/** Giá trị `?order=` ĐÚNG NHƯ NÓ TỚI S-06: đi qua chính bộ giải mã query của nền
 *  tảng (`URLSearchParams`), không phải qua một phép cắt chuỗi tự chế. */
function pushedOrderParam(): unknown {
  expect(push.mock.calls.length).toBe(1);
  const href = push.mock.calls[0][0];
  expect(typeof href).toBe("string");
  const url = new URL(String(href), "https://ms-molar.test");
  expect(url.pathname).toBe("/pricing/checkout");
  return url.searchParams.get("order");
}

async function clickAndSettle(view: ReturnType<typeof render>) {
  await act(async () => {
    buttonOf(view.container).click();
  });
}

beforeEach(() => {
  mockCreate.mockReset();
  push.mockReset();
});

afterEach(cleanup);

describe("biên S-05 → S-06: mã đơn băng qua một lượt điều hướng", () => {
  it("thành công ⇒ ĐÚNG MỘT lượt điều hướng, tới đúng chuỗi đã đóng băng", async () => {
    mockCreate.mockResolvedValue(STUB_ORDER);
    const view = render(<Cta />);
    await clickAndSettle(view);

    expect(mockCreate.mock.calls.length).toBe(1);
    expect(push.mock.calls.length).toBe(1);
    expect(push).toHaveBeenCalledWith("/pricing/checkout?order=1755600000000");
  });

  it("ROUNDTRIP: giá trị trên query string, phân tích theo ĐÚNG luật S-06, BẰNG chính orderCode mà createOrder() trả về", async () => {
    mockCreate.mockResolvedValue(STUB_ORDER);
    const view = render(<Cta />);
    await clickAndSettle(view);

    const raw = pushedOrderParam();
    // Điều kiện 1 của luật: giá trị tới S-06 phải là một CHUỖI.
    expect(typeof raw).toBe("string");
    // Và đây là phép so bằng, không phải phép kiểm hình dạng.
    expect(parseOrderCodeAsS06Does(raw)).toBe(STUB_ORDER.orderCode);
    expect(parseOrderCodeAsS06Does(raw)).toBe(ORDER_CODE);
    // Không phải một trường khác cùng kiểu chữ số lọt vào chỗ này.
    expect(parseOrderCodeAsS06Does(raw)).not.toBe(Number(STUB_ORDER.accountNumber));
  });

  it("bản chép luật S-06 thật sự LOẠI được dạng có phân nhóm — nên phép so ở trên có răng", async () => {
    // `toLocaleString()` là mutant kinh điển của biên này: nó vẫn "là mã đơn",
    // vẫn điều hướng, và S-06 vẫn rơi vào trạng thái Rỗng.
    const grouped = ORDER_CODE.toLocaleString("en-US");
    expect(grouped).toContain(",");
    expect(parseOrderCodeAsS06Does(grouped)).toBeNull();
    expect(parseOrderCodeAsS06Does(` ${ORDER_CODE} `)).toBeNull();
    expect(parseOrderCodeAsS06Does(`+${ORDER_CODE}`)).toBeNull();
    expect(parseOrderCodeAsS06Does(String(ORDER_CODE))).toBe(ORDER_CODE);

    mockCreate.mockResolvedValue(STUB_ORDER);
    const view = render(<Cta />);
    await clickAndSettle(view);
    expect(pushedOrderParam()).not.toBe(grouped);
  });

  it("KHÔNG điều hướng lạc quan: trong lúc lượt tạo đơn còn bay, 0 lượt push", async () => {
    let resolveCreate!: (outcome: CreateOrderOutcome) => void;
    mockCreate.mockImplementation(
      () =>
        new Promise<CreateOrderOutcome>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const view = render(<Cta />);
    act(() => {
      buttonOf(view.container).click();
    });

    expect(mockCreate.mock.calls.length).toBe(1);
    expect(push.mock.calls.length).toBe(0);
    expect(buttonOf(view.container).getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolveCreate(STUB_ORDER);
    });
    expect(push.mock.calls.length).toBe(1);
  });
});

describe("chốt busyRef đồng bộ — hai cú bấm không được thành hai đơn", () => {
  it("HAI cú bấm trong CÙNG một cửa sổ đang bay ⇒ ĐÚNG MỘT lượt gọi createOrder()", async () => {
    let resolveCreate!: (outcome: CreateOrderOutcome) => void;
    mockCreate.mockImplementation(
      () =>
        new Promise<CreateOrderOutcome>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const view = render(<Cta />);
    const button = buttonOf(view.container);

    // CẢ HAI cú bấm trong MỘT act(), với promise CHƯA resolve: đây mới là cửa sổ
    // mà một chốt viết bằng state để lọt.
    act(() => {
      button.click();
      button.click();
    });

    expect(mockCreate.mock.calls.length).toBe(1);
    expect(mockCreate).toHaveBeenCalledWith();
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      resolveCreate(STUB_ORDER);
    });
    expect(mockCreate.mock.calls.length).toBe(1);
    expect(push.mock.calls.length).toBe(1);
  });

  it("THẤT BẠI thì chốt được NHẢ: cú bấm thứ hai gọi action lần nữa", async () => {
    mockCreate.mockResolvedValue({ error: "server" });
    const view = render(<Cta />);
    await clickAndSettle(view);
    expect(mockCreate.mock.calls.length).toBe(1);

    await clickAndSettle(view);
    expect(mockCreate.mock.calls.length).toBe(2);
    expect(push.mock.calls.length).toBe(0);
  });

  it("THÀNH CÔNG thì chốt KHÔNG nhả: lượt điều hướng đã phát, cú bấm sau không tạo đơn thứ hai", async () => {
    mockCreate.mockResolvedValue(STUB_ORDER);
    const view = render(<Cta />);
    await clickAndSettle(view);
    await clickAndSettle(view);

    expect(mockCreate.mock.calls.length).toBe(1);
    expect(push.mock.calls.length).toBe(1);
  });
});

describe("thất bại: 0 lượt điều hướng, và một câu CỤ THỂ", () => {
  it.each(FAILURES)("$name (en): alert VẮNG trước, CÓ sau, đúng chữ và đúng khoá", async (row) => {
    mockCreate.mockResolvedValue({ error: row.error });
    const view = render(<Cta locale="en" />);
    const scope = within(view.container);
    expect(scope.queryByRole("alert")).toBeNull();

    await clickAndSettle(view);

    const alert = scope.getByRole("alert");
    expect(alert.textContent).toBe(row.en);
    expect(alert.textContent).toBe(en[row.key]);
    expect(alert.hasAttribute("aria-live")).toBe(false);
    expect(push.mock.calls.length).toBe(0);
  });

  it.each(FAILURES)("$name (vi): đúng chữ tiếng Việt và đúng khoá", async (row) => {
    mockCreate.mockResolvedValue({ error: row.error });
    const view = render(<Cta locale="vi" />);
    await clickAndSettle(view);

    const alert = within(view.container).getByRole("alert");
    expect(alert.textContent).toBe(row.vi);
    expect(alert.textContent).toBe(viDict[row.key]);
    expect(push.mock.calls.length).toBe(0);
  });

  it.each(FAILURES)("$name: nút trở lại BẤM ĐƯỢC, không kẹt busy, không disabled gốc", async (row) => {
    mockCreate.mockResolvedValue({ error: row.error });
    const view = render(<Cta />);
    await clickAndSettle(view);

    const button = buttonOf(view.container);
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it.each<Locale>(["en", "vi"])(
    "%s: bốn lý do, bốn câu — 6 phép so đôi một, không lý do nào dùng chung câu",
    async (locale) => {
      const sentences: string[] = [];
      for (const row of FAILURES) {
        mockCreate.mockResolvedValue({ error: row.error });
        const view = render(<Cta locale={locale} />);
        await clickAndSettle(view);
        sentences.push(within(view.container).getByRole("alert").textContent ?? "");
        view.unmount();
      }
      expect(sentences).toHaveLength(4);
      let pairs = 0;
      for (let i = 0; i < sentences.length; i++) {
        for (let j = i + 1; j < sentences.length; j++) {
          const label = `${FAILURES[i].name} vs ${FAILURES[j].name}`;
          expect(`${label}: ${sentences[i]}`).not.toBe(`${label}: ${sentences[j]}`);
          pairs++;
        }
      }
      expect(pairs).toBe(6);
      expect(new Set(sentences).size).toBe(4);
    }
  );

  it.each<Locale>(["en", "vi"])(
    "%s: câu RATE-LIMITED đúng chuỗi cố định và KHÁC câu lỗi chung",
    async (locale) => {
      mockCreate.mockResolvedValue({ error: "rate_limited" });
      const view = render(<Cta locale={locale} />);
      await clickAndSettle(view);
      const sentence = within(view.container).getByRole("alert").textContent ?? "";

      const expected = locale === "en" ? FAILURES[1].en : FAILURES[1].vi;
      expect(sentence).toBe(expected);
      expect(sentence).not.toBe(GENERIC[locale]);
      expect(GENERIC[locale]).not.toBe("");
    }
  );

  it("action NÉM ⇒ câu lỗi chung, 0 lượt điều hướng, nút không kẹt", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockCreate.mockRejectedValue(new Error("network down"));
      const view = render(<Cta locale="en" />);
      await clickAndSettle(view);

      const alert = within(view.container).getByRole("alert");
      expect(alert.textContent).toBe(GENERIC.en);
      expect(push.mock.calls.length).toBe(0);
      expect(buttonOf(view.container).getAttribute("aria-busy")).toBe("false");
      expect(errorSpy.mock.calls.length).toBe(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("các dòng ĐÓNG BĂNG :29 / :32 / :36 — hành vi không đổi", () => {
  it("canPurchase=false: bấm ⇒ 0 lượt gọi action, 0 lượt điều hướng, không alert", async () => {
    mockCreate.mockResolvedValue(STUB_ORDER);
    const view = render(<Cta canPurchase={false} />);
    await clickAndSettle(view);

    expect(mockCreate.mock.calls.length).toBe(0);
    expect(push.mock.calls.length).toBe(0);
    expect(within(view.container).queryByRole("alert")).toBeNull();
  });

  it("canPurchase=false: aria-disabled là CHUỖI 'true', lý do được trỏ tới và đọc được, không disabled gốc", () => {
    const view = render(<Cta canPurchase={false} />);
    const button = buttonOf(view.container);

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.disabled).toBe(false);
    const reasonId = button.getAttribute("aria-describedby");
    expect(reasonId).toBe("billing-cta-reason");
    expect(view.container.querySelector(`#${reasonId}`)?.textContent).toBe(
      en["billing.cta.unavailableReason"]
    );
  });

  it("canPurchase=true lúc rảnh: aria-disabled CHUỖI 'false', không describedby, không alert, aria-busy BOOLEAN false", () => {
    const view = render(<Cta />);
    const button = buttonOf(view.container);

    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-describedby")).toBeNull();
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(within(view.container).queryByRole("alert")).toBeNull();
    expect(button.textContent).toBe(en["billing.cta.buy"]);
    expect(button.className).toContain("min-h-11");
  });

  it("KHÔNG có vùng aria-live nào trong cây, ở cả ba pha", async () => {
    mockCreate.mockImplementation(() => new Promise<CreateOrderOutcome>(() => {}));
    const busyView = render(<Cta />);
    expect(busyView.container.querySelector("[aria-live]")).toBeNull();
    act(() => {
      buttonOf(busyView.container).click();
    });
    expect(busyView.container.querySelector("[aria-live]")).toBeNull();
    busyView.unmount();

    mockCreate.mockResolvedValue({ error: "server" });
    const failedView = render(<Cta />);
    await clickAndSettle(failedView);
    expect(failedView.container.querySelector("[aria-live]")).toBeNull();
  });
});
