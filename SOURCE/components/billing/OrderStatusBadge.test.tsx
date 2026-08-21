// @vitest-environment jsdom

// C-09 OrderStatusBadge — UI Spec UI-D15 / frontend Design Doc Decision 3.
//
// Nghĩa vụ chứng minh của plan Task 2.3: "một giá trị status ngoài tập cho
// phép hiển thị BẰNG DIỆN MẠO RIÊNG của nó và KHÔNG BAO GIỜ bị ép về một giá
// trị hợp lệ". Tiền lệ StatusBadge.tsx:53 làm đúng cái sai đó
// (`?? CONFIG.processing`); trên màn hình tiền, một status lạ hiện thành "chờ
// thanh toán" là bảo một người đã trả tiền đi trả lần nữa.
//
// Cách đọc badge ở đây CỐ Ý ném lỗi khi không có gì được render: một helper
// trả "" cho phần tử thiếu sẽ khiến khẳng định "chữ này KHÁC chữ pending"
// xanh trên một cây DOM rỗng — tức là test không chứng minh gì cả. Presence
// trước, value sau.
//
// render() không auto-cleanup (vitest.config.ts không có setupFiles) nên mỗi
// case tự gọi cleanup(); cũng vì vậy không có matcher jest-dom nào ở đây.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi } from "@/lib/i18n/dictionaries/vi";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locales";
import { OrderStatusBadge } from "./OrderStatusBadge";

afterEach(cleanup);

const DICT = { en, vi } as const;

/**
 * Đọc badge đã render. NÉM khi thiếu phần tử hoặc thiếu chữ — không bao giờ
 * trả chuỗi rỗng, vì một chuỗi rỗng sẽ làm mọi khẳng định "khác X" thành đúng.
 */
function readBadge(container: HTMLElement): { glyph: string; word: string; className: string } {
  const badge = container.firstElementChild;
  if (!(badge instanceof HTMLElement)) {
    throw new Error("OrderStatusBadge rendered no element at all");
  }
  const hidden = badge.querySelector("[aria-hidden]");
  if (!(hidden instanceof HTMLElement)) {
    throw new Error("OrderStatusBadge rendered no aria-hidden glyph");
  }
  const glyph = hidden.textContent ?? "";
  const word = (badge.textContent ?? "").slice(glyph.length);
  if (glyph === "" || word === "") {
    throw new Error(`OrderStatusBadge rendered an empty glyph or word: ${JSON.stringify({ glyph, word })}`);
  }
  return { glyph, word, className: badge.className };
}

function renderBadge(status: string, locale: Locale) {
  const { container } = render(
    <I18nProvider locale={locale}>
      <OrderStatusBadge status={status} />
    </I18nProvider>
  );
  return readBadge(container);
}

describe("bốn status được schema cho phép", () => {
  it("pending hiện đúng chữ của từ điển, kèm glyph riêng", () => {
    const badge = renderBadge("pending", "en");
    expect(badge.word).toBe(en["billing.status.pending"]);
    expect(badge.glyph).toBe("◌");
  });

  it("paid hiện đúng chữ của từ điển, kèm glyph riêng", () => {
    const badge = renderBadge("paid", "en");
    expect(badge.word).toBe(en["billing.status.paid"]);
    expect(badge.glyph).toBe("●");
  });

  it("expired hiện đúng chữ của từ điển, kèm glyph riêng", () => {
    const badge = renderBadge("expired", "en");
    expect(badge.word).toBe(en["billing.status.expired"]);
    expect(badge.glyph).toBe("⊘");
  });

  it("cancelled có chữ và glyph RIÊNG, không bị gộp vào expired", () => {
    // "đơn hết hạn" và "đơn bị huỷ" là hai sự thật khác nhau; người đang khiếu
    // nại một khoản tiền cần phân biệt được (UI-D15).
    const cancelled = renderBadge("cancelled", "en");
    const expired = renderBadge("expired", "en");
    expect(cancelled.word).toBe(en["billing.status.cancelled"]);
    expect(cancelled.glyph).toBe("✕");
    expect(cancelled.word).not.toBe(expired.word);
    expect(cancelled.glyph).not.toBe(expired.glyph);
  });

  it("bốn chữ và bốn glyph đôi một khác nhau — phân biệt được cả khi in đen trắng", () => {
    const statuses = ["pending", "paid", "expired", "cancelled"];
    const words = statuses.map((s) => renderBadge(s, "en").word);
    const glyphs = statuses.map((s) => renderBadge(s, "en").glyph);
    expect(new Set(words).size).toBe(4);
    expect(new Set(glyphs).size).toBe(4);
  });

  // Năm case dưới đây so với CHUỖI CỐ ĐỊNH chứ không tra lại từ điển, và đó là
  // toàn bộ lý do chúng tồn tại: mọi khẳng định kiểu
  // `word === en["billing.status.pending"]` vẫn XANH khi hai giá trị trong từ
  // điển bị hoán cho nhau (đã thử: đổi chỗ pending/paid, 24/24 vẫn qua) — vì
  // phép hoán đổi làm lệch cả hai vế cùng lúc. Trên màn hình tiền, một đơn
  // đang CHỜ THANH TOÁN mà đọc ra "Paid" là hỏng nặng nhất trong các kiểu
  // hỏng, nên bản dịch phải bị ghim bằng chữ thật, theo đúng nghĩa vụ chứng
  // minh mà Design Doc đặt cho C-10 ("fixed expected string per locale").
  it.each([
    ["pending", "Awaiting payment", "Chờ thanh toán"],
    ["paid", "Paid", "Đã thanh toán"],
    ["expired", "Expired", "Hết hiệu lực"],
    ["cancelled", "Cancelled", "Đã huỷ"],
    ["refunded", "Unrecognised", "Không xác định"],
  ])("%s đọc ra đúng chữ đã duyệt của từng ngôn ngữ", (status, enWord, viWord) => {
    expect(renderBadge(status, "en").word).toBe(enWord);
    expect(renderBadge(status, "vi").word).toBe(viWord);
  });

  it("đổi ngôn ngữ thì đổi chữ, glyph giữ nguyên", () => {
    const enBadge = renderBadge("pending", "en");
    const viBadge = renderBadge("pending", "vi");
    expect(viBadge.word).toBe(vi["billing.status.pending"]);
    expect(viBadge.word).not.toBe(enBadge.word);
    expect(viBadge.glyph).toBe(enBadge.glyph);
  });
});

describe("status không nhận ra — nhánh thứ năm, không bao giờ bị ép về nhánh hợp lệ", () => {
  // "refunded" được chọn CỐ Ý: schema KHÔNG có trạng thái này (hoàn tiền là
  // thao tác ngân hàng + một câu SQL sửa tay, D10), nhưng nó là giá trị trông
  // hợp lý nhất mà một người đọc code sẽ tưởng là được chấp nhận.
  it.each<Locale>(["en", "vi"])('"refunded" hiện diện mạo KHÔNG XÁC ĐỊNH ở locale %s', (locale) => {
    const badge = renderBadge("refunded", locale);
    // Presence đã được readBadge đảm bảo (nó ném nếu rỗng) — giờ mới so giá trị.
    expect(badge.word).toBe(DICT[locale]["billing.status.unrecognised"]);
    expect(badge.glyph).toBe("?");
  });

  it.each<Locale>(["en", "vi"])(
    '"refunded" KHÔNG đọc thành pending và KHÔNG đọc thành paid ở locale %s',
    (locale) => {
      const badge = renderBadge("refunded", locale);
      expect(badge.word).not.toBe(DICT[locale]["billing.status.pending"]);
      expect(badge.word).not.toBe(DICT[locale]["billing.status.paid"]);
      expect(badge.glyph).not.toBe(renderBadge("pending", locale).glyph);
      expect(badge.glyph).not.toBe(renderBadge("paid", locale).glyph);
    }
  );

  it.each(["", " ", "PENDING", "Paid", "unknown", "refunded"])(
    "giá trị %j cũng rơi vào nhánh không xác định",
    (status) => {
      const badge = renderBadge(status, "en");
      expect(badge.word).toBe(en["billing.status.unrecognised"]);
    }
  );

  it("nhánh không xác định dùng token --destructive, khác hẳn lớp của pending", () => {
    const unrecognised = renderBadge("refunded", "en");
    const pending = renderBadge("pending", "en");
    expect(unrecognised.className).toContain("border-destructive");
    expect(unrecognised.className).toContain("text-destructive");
    expect(unrecognised.className).not.toContain("text-muted-foreground");
    expect(pending.className).not.toContain("destructive");
  });
});

describe("cấu trúc chép từ StatusBadge.tsx, hai khuyết tật thì không", () => {
  it("glyph mang aria-hidden nên tên khả truy cập chỉ còn CHỮ (AC-043)", () => {
    const { container } = render(
      <I18nProvider locale="en">
        <OrderStatusBadge status="paid" />
      </I18nProvider>
    );
    const badge = container.firstElementChild;
    if (!(badge instanceof HTMLElement)) throw new Error("rendered nothing");
    const hidden = badge.querySelector("[aria-hidden]");
    expect(hidden?.getAttribute("aria-hidden")).toBe("true");
    expect(badge.textContent).toBe(`●${en["billing.status.paid"]}`);
  });

  it("giữ đúng khung lớp của tiền lệ", () => {
    const badge = renderBadge("pending", "en");
    for (const cls of [
      "inline-flex",
      "items-center",
      "gap-1.5",
      "rounded-full",
      "border",
      "px-2.5",
      "py-0.5",
      "text-xs",
      "font-medium",
    ]) {
      expect(badge.className).toContain(cls);
    }
  });

  it.each(["pending", "paid", "expired", "cancelled", "refunded"])(
    "không nhánh nào (%s) mang hex hardcode — mọi màu là token",
    (status) => {
      // Khuyết tật thứ nhất của StatusBadge.tsx (:26,:36 — bốn hex literal).
      expect(renderBadge(status, "en").className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  );
});
