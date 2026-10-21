// @vitest-environment jsdom

// TransferDetails — khối CHỮ chuyển khoản, đường trả tiền chính (QR chỉ là đường
// tắt). Trường thiếu phải bị BỎ HẲN kèm cảnh báo, không để ô trống hay "—": người
// dùng sẽ tưởng mình bỏ sót rồi chuyển tiền sai.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { t } from "@/lib/copy";
import { TransferDetails } from "@/features/billing/components/checkout/TransferDetails";

afterEach(cleanup);

const FULL = {
  accountNumber: "1903 1234 5678",
  accountName: "NGUYEN VAN A",
  amountVnd: 39000,
  memo: "MSMOLAR 987654",
};

/** Cặp nhãn → giá trị theo thứ tự DOM. */
function pairs(): Array<[string, string]> {
  const terms = Array.from(document.querySelectorAll("dt")).map((n) => n.textContent ?? "");
  const values = Array.from(document.querySelectorAll("dd")).map((n) => n.textContent ?? "");
  return terms.map((term, i) => [term, values[i] ?? ""]);
}

describe("đủ bốn trường", () => {
  it("hiện đúng thứ tự: số tài khoản → chủ tài khoản → số tiền → nội dung", () => {
    render(<TransferDetails {...FULL} />);
    expect(pairs()).toEqual([
      ["Số tài khoản", "1903 1234 5678"],
      ["Chủ tài khoản", "NGUYEN VAN A"],
      ["Số tiền", "39.000 VNĐ"],
      ["Nội dung chuyển khoản", "MSMOLAR 987654"],
    ]);
  });

  it("có cảnh báo phải ghi đúng nội dung, và KHÔNG có cảnh báo thiếu trường", () => {
    render(<TransferDetails {...FULL} />);
    expect(document.body.textContent).toContain(t("billing.checkout.memoWarning"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("giá trị chọn được trong một lần chạm (select-all) để chép trên điện thoại", () => {
    render(<TransferDetails {...FULL} />);
    for (const dd of Array.from(document.querySelectorAll("dd"))) {
      expect(dd.className).toContain("select-all");
    }
  });

  it("số tài khoản và nội dung dùng chữ đơn cách (font-mono) để phân biệt 0/O, 1/l", () => {
    render(<TransferDetails {...FULL} />);
    const dds = Array.from(document.querySelectorAll("dd"));
    expect(dds[0].className).toContain("font-mono");
    expect(dds[3].className).toContain("font-mono");
  });
});

describe("trường thiếu bị bỏ hẳn, kèm cảnh báo", () => {
  it.each([
    ["accountNumber", "Số tài khoản"],
    ["accountName", "Chủ tài khoản"],
    ["memo", "Nội dung chuyển khoản"],
  ] as const)("%s rỗng: bỏ dòng '%s', còn ba dòng, có alert", (field, label) => {
    render(<TransferDetails {...FULL} {...{ [field]: "" }} />);
    const terms = pairs().map(([term]) => term);
    expect(terms).not.toContain(label);
    expect(terms).toHaveLength(3);
    expect(screen.getByRole("alert").textContent).toBe(t("billing.checkout.fieldMissing"));
  });

  it("chuỗi toàn dấu cách cũng tính là thiếu", () => {
    render(<TransferDetails {...FULL} accountNumber="   " />);
    expect(pairs().map(([term]) => term)).not.toContain("Số tài khoản");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "số tiền %s: bỏ dòng 'Số tiền', không in 'NaN'",
    (amountVnd) => {
      render(<TransferDetails {...FULL} amountVnd={amountVnd} />);
      expect(pairs().map(([term]) => term)).not.toContain("Số tiền");
      expect(document.body.textContent).not.toContain("NaN");
      expect(screen.getByRole("alert")).toBeTruthy();
    }
  );

  it("thiếu nội dung chuyển khoản thì cũng không hiện cảnh báo về nội dung", () => {
    render(<TransferDetails {...FULL} memo="" />);
    expect(document.body.textContent).not.toContain(t("billing.checkout.memoWarning"));
  });

  it("số tiền 0 vẫn là số hợp lệ, không bị coi là thiếu", () => {
    render(<TransferDetails {...FULL} amountVnd={0} />);
    expect(pairs()).toContainEqual(["Số tiền", "0 VNĐ"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
