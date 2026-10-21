// @vitest-environment jsdom

// RecheckOrderControl — "hỏi lại payOS xem đơn này đã trả chưa".
//
// Ba điều phải đúng trên màn hình tiền:
//   1. Bấm hai lần liền không bắn hai lượt hỏi (busyRef chặn trước mọi await).
//   2. Đơn đã đóng (paid/expired/cancelled) KHÔNG gọi nhà cung cấp; còn status
//      lạ thì VẪN được hỏi lại — hỏi lại là cách duy nhất gỡ trạng thái lạ.
//   3. Lỗi ném ra từ server không bao giờ lộ nội dung (có thể mang số tiền /
//      số tài khoản) ra màn hình.
//
// Nút dùng aria-disabled chứ không `disabled` (disabled rơi khỏi thứ tự tab).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecheckOutcome } from "@/lib/billing/orderActions";
import { t } from "@/lib/copy";
import { formatDate } from "@/lib/format/datetime";

const mocks = vi.hoisted(() => ({
  recheckOrder: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: mocks.recheckOrder }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { RecheckOrderControl } from "./RecheckOrderControl";

const ROW_LABEL = "Kiểm tra lại đơn này";
const PRIMARY_LABEL = "Tôi đã chuyển khoản — kiểm tra ngay";

beforeEach(() => {
  mocks.recheckOrder.mockReset();
  mocks.refresh.mockReset();
});
afterEach(cleanup);

function setup(props: Partial<Parameters<typeof RecheckOrderControl>[0]> = {}) {
  render(<RecheckOrderControl orderCode={4242} variant="row" status="pending" {...props} />);
  return screen.getByRole("button");
}

/** Bấm và đợi mọi microtask của lượt hỏi lại xong. */
async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("nhãn và trạng thái ban đầu", () => {
  it("variant row: nhãn 'Kiểm tra lại đơn này', chưa bận, chưa có thông báo", () => {
    const button = setup();
    expect(button.textContent).toContain(ROW_LABEL);
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("variant primary: nhãn xác nhận đã chuyển khoản", () => {
    expect(setup({ variant: "primary" }).textContent).toContain(PRIMARY_LABEL);
  });
});

describe("kết quả của lượt hỏi lại", () => {
  it("đã trả: hiện hạn Premium, gọi đúng mã đơn và làm mới trang", async () => {
    const expiresAt = "2099-11-30T23:59:59.000Z";
    mocks.recheckOrder.mockResolvedValue({ settled: true, expiresAt } satisfies RecheckOutcome);
    await click(setup());

    expect(mocks.recheckOrder).toHaveBeenCalledExactlyOnceWith(4242);
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).toContain("Đã thanh toán — kỳ Premium của bạn chạy tới");
    expect(alert).toContain(formatDate(expiresAt));
    expect(alert).toContain("2099");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["not_paid_yet", "billing.recheck.stillPending"],
    ["not_pending", "billing.recheck.notPending"],
    ["unknown_order", "billing.recheck.unknownOrder"],
    ["amount_mismatch", "billing.recheck.amountMismatch"],
    ["provider_unavailable", "billing.recheck.providerUnavailable"],
  ] as const)("chưa settle (%s) hiện đúng câu của lý do đó", async (reason, key) => {
    mocks.recheckOrder.mockResolvedValue({ settled: false, reason });
    await click(setup());
    expect(screen.getByRole("alert").textContent).toBe(t(key));
  });

  it("các câu lý do đôi một khác nhau (không có hai lý do dùng chung một câu)", async () => {
    const texts: string[] = [];
    for (const reason of [
      "not_paid_yet",
      "not_pending",
      "unknown_order",
      "amount_mismatch",
      "provider_unavailable",
    ] as const) {
      mocks.recheckOrder.mockResolvedValue({ settled: false, reason });
      await click(setup());
      texts.push(screen.getByRole("alert").textContent ?? "");
      cleanup();
    }
    expect(new Set(texts).size).toBe(5);
  });

  it.each([
    ["rate_limited", "billing.recheck.rateLimited"],
    ["unauthenticated", "profile.error.sessionExpired"],
  ] as const)("lỗi %s hiện đúng câu và vẫn làm mới trang", async (error, key) => {
    mocks.recheckOrder.mockResolvedValue({ error });
    await click(setup());
    expect(screen.getByRole("alert").textContent).toBe(t(key));
  });

  it("server ném lỗi: hiện câu chung, KHÔNG lộ nội dung lỗi", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recheckOrder.mockRejectedValue(
      Object.assign(new Error("account 9704-0000-1111 amount 39000"), { digest: "d-77" })
    );
    await click(setup());

    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).toBe(t("billing.orders.loadError"));
    expect(alert).not.toContain("9704");
    expect(mocks.refresh).not.toHaveBeenCalled();
    // Chỉ log digest, không log message.
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("9704");
    expect(JSON.stringify(errorSpy.mock.calls)).toContain("d-77");
    errorSpy.mockRestore();
  });
});

describe("chống bấm đôi", () => {
  it("hai cú bấm liền khi lượt đầu chưa xong chỉ bắn MỘT lượt hỏi", async () => {
    let resolve!: (value: RecheckOutcome) => void;
    mocks.recheckOrder.mockReturnValue(new Promise<RecheckOutcome>((r) => (resolve = r)));
    const button = setup();

    await click(button);
    await click(button);
    expect(mocks.recheckOrder).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(document.body.textContent).toContain(t("billing.recheck.busy"));

    await act(async () => resolve({ settled: false, reason: "not_paid_yet" }));
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("sau khi xong, bấm lại được (chốt được mở)", async () => {
    mocks.recheckOrder.mockResolvedValue({ settled: false, reason: "not_paid_yet" });
    const button = setup();
    await click(button);
    await click(button);
    expect(mocks.recheckOrder).toHaveBeenCalledTimes(2);
  });

  it("sau lỗi ném ra, bấm lại được", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.recheckOrder.mockRejectedValueOnce(new Error("boom"));
    mocks.recheckOrder.mockResolvedValueOnce({ settled: false, reason: "not_paid_yet" });
    const button = setup();
    await click(button);
    await click(button);
    expect(mocks.recheckOrder).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert").textContent).toBe(t("billing.recheck.stillPending"));
    vi.restoreAllMocks();
  });
});

describe("đơn đã đóng và status lạ", () => {
  it.each(["paid", "expired", "cancelled"])(
    "status %s: aria-disabled, bấm KHÔNG gọi nhà cung cấp, lý do có trong vùng mô tả",
    async (status) => {
      const button = setup({ status });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      await click(button);
      expect(mocks.recheckOrder).not.toHaveBeenCalled();
      expect(mocks.refresh).not.toHaveBeenCalled();

      const reasonId = button.getAttribute("aria-describedby");
      expect(reasonId).toBeTruthy();
      expect(document.getElementById(reasonId as string)?.textContent).toBe(
        t("billing.recheck.notPending")
      );
    }
  );

  it.each(["pending", "refunded", ""])(
    "status %j VẪN được hỏi lại (không bị khoá nhầm)",
    async (status) => {
      mocks.recheckOrder.mockResolvedValue({ settled: false, reason: "not_paid_yet" });
      const button = setup({ status });
      expect(button.getAttribute("aria-disabled")).toBe("false");
      await click(button);
      expect(mocks.recheckOrder).toHaveBeenCalledWith(4242);
    }
  );
});
