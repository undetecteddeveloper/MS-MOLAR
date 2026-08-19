// @vitest-environment jsdom

// C-11 PlanSummary — bốn giá trị của AC-056 đọ với một `Quota` BA giá trị
// (UI Spec § Component: `PlanSummary`, frontend Design Doc Decision 4) —
// plan Task 3.7.
//
// HAI ĐIỀU KHOẢN NGƯỢC CHIỀU NHAU mà file này tồn tại để giữ:
//
//   · `plan` hỏng-ĐÓNG: không biết thì là Free.
//   · `quota` hỏng-MỞ: không biết thì KHÔNG chặn gì cả — và vì thế màn hình
//     TUYỆT ĐỐI không được in "0" hay "—" ở nhánh `unknown`. In "0" là tuyên bố
//     một sự cạn kiệt mà `isQuotaExhausted()` không hề cưỡng chế
//     (types.ts:77-79); in "—" thì một người đang trả tiền đọc ra "hạn mức của
//     tôi hết rồi". Cả hai biến một hợp đồng hỏng-mở thành một MÀN HÌNH
//     hỏng-đóng, và đẻ ra một phiếu hỗ trợ từ một người mà sản phẩm đang chạy
//     hoàn toàn bình thường.
//
// VÌ SAO HAI HẠN MỨC ĐƯỢC GIEO HAI GIÁ TRỊ KHÁC NHAU, và hai `resetsAt` cũng
// khác nhau: nếu tutor và upload cùng số thì một lần hoán nhầm hai cột là VÔ
// HÌNH, và nếu hai `resetsAt` giống nhau thì việc lấy nhầm mốc của `upload`
// (Decision 4 chỉ định `tutor.resetsAt`) cũng vô hình. Ở đây mọi con số đều
// phân biệt được.
//
// Mốc thời gian chọn ở 17:30Z = 00:30 ICT NGÀY HÔM SAU: máy chạy test ở
// Asia/Saigon nên một formatter KHÔNG ghim múi giờ vẫn in đúng tại đây rồi hỏng
// trên Vercel (chạy UTC). Chọn một mốc chỉ lệch GIỜ sẽ không bao giờ phát hiện
// ra điều đó.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlanSummary } from "../_components/PlanSummary";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement } from "@/lib/billing/types";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locales";

const EXPIRES_AT = "2026-08-18T17:30:00.000Z"; // 19/08/2026 ICT
const TUTOR_RESETS_AT = "2026-09-18T17:30:00.000Z"; // 19/09/2026 ICT
const UPLOAD_RESETS_AT = "2026-10-02T03:00:00.000Z"; // 02/10/2026 ICT — CỐ Ý khác

const KNOWN: Entitlement = {
  plan: "premium",
  expiresAt: EXPIRES_AT,
  inGracePeriod: false,
  tutor: { state: "known", used: 2, limit: 5, resetsAt: TUTOR_RESETS_AT },
  upload: { state: "known", used: 1, limit: 15, resetsAt: UPLOAD_RESETS_AT },
};

const FREE_UNKNOWN: Entitlement = {
  plan: "free",
  expiresAt: null,
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
};

const UNAVAILABLE_SENTENCE: Record<Locale, string> = {
  en: "We could not read your usage counters just now. This does not restrict your access: everything still works.",
  vi: "Chưa đọc được bộ đếm lượt dùng của bạn lúc này. Việc đó không hạn chế quyền truy cập: mọi thứ vẫn chạy bình thường.",
};

function renderSummary(entitlement: Entitlement, locale: Locale = "en") {
  const view = render(
    <I18nProvider locale={locale}>
      <EntitlementProvider value={entitlement}>
        <PlanSummary />
      </EntitlementProvider>
    </I18nProvider>
  );
  const terms = [...view.container.querySelectorAll("dt")].map((n) => n.textContent);
  const values = [...view.container.querySelectorAll("dd")].map((n) => n.textContent);
  return { ...view, terms, values, text: view.container.textContent ?? "" };
}

afterEach(cleanup);

describe("cả hai hạn mức `known` — bốn mục của AC-056, ĐÚNG THỨ TỰ", () => {
  it("tiếng Anh: bốn nhãn và bốn giá trị, đúng chuỗi đã duyệt, đúng thứ tự", () => {
    const { terms, values } = renderSummary(KNOWN, "en");
    expect(terms).toEqual(["Current plan", "Period resets", "Tutor hints", "Exam uploads"]);
    expect(values).toEqual([
      "Premium · until 19/08/2026",
      "19/09/2026",
      "3 of 5 hints left",
      "14 of 15 uploads left",
    ]);
  });

  it("tiếng Việt: bốn nhãn và bốn giá trị, đúng chuỗi đã duyệt, đúng thứ tự", () => {
    const { terms, values } = renderSummary(KNOWN, "vi");
    expect(terms).toEqual(["Gói hiện tại", "Kỳ đặt lại vào", "Lượt gia sư", "Lượt tải đề"]);
    expect(values).toEqual([
      "Premium · đến 19/08/2026",
      "19/09/2026",
      "Còn 3/5 lượt gia sư",
      "Còn 14/15 lượt tải đề",
    ]);
  });

  it("ngày đặt lại lấy từ tutor.resetsAt, KHÔNG phải upload.resetsAt", () => {
    const { values } = renderSummary(KNOWN, "en");
    expect(values[1]).toBe("19/09/2026");
    expect(values[1]).not.toBe("02/10/2026");
    // 17:30Z là ngày HÔM SAU theo giờ ICT — một formatter không ghim múi giờ in
    // ra 18/09/2026 trên Vercel.
    expect(values[1]).not.toBe("18/09/2026");
  });

  it("hai hạn mức không dùng chung một câu — hoán nhầm tutor↔upload là NHÌN THẤY được", () => {
    const { values } = renderSummary(KNOWN, "en");
    expect(values[2]).not.toBe(values[3]);
    expect(values[2]).toContain("hints");
    expect(values[3]).toContain("uploads");
  });

  it("`còn lại` chứ không phải `đã dùng`: 2/5 đọc ra 3, 1/15 đọc ra 14", () => {
    const { values } = renderSummary(KNOWN, "en");
    expect(values[2]).toBe("3 of 5 hints left");
    expect(values[2]).not.toBe("2 of 5 hints left");
    expect(values[3]).toBe("14 of 15 uploads left");
  });

  it("`limit − used` KẸP ở 0: một hạn mức bị hạ giữa kỳ in 0, không bao giờ in số âm", () => {
    const { values, text } = renderSummary(
      {
        ...KNOWN,
        tutor: { state: "known", used: 9, limit: 5, resetsAt: TUTOR_RESETS_AT },
      },
      "en"
    );
    expect(values[2]).toBe("0 of 5 hints left");
    expect(text).not.toContain("-4");
    expect(text).not.toContain("−4");
  });

  it("gói Free hiện tên gói Free, không hiện ngày nào", () => {
    const free = renderSummary({ ...KNOWN, plan: "free", expiresAt: null }, "en");
    expect(free.values[0]).toBe("Free");
    const freeVi = renderSummary({ ...KNOWN, plan: "free", expiresAt: null }, "vi");
    expect(freeVi.values[0]).toBe("Miễn phí");
  });

  it("AC-010 — trong ân hạn thì gói đọc ra CÂU KHÁC hẳn câu Premium thường", () => {
    const grace = renderSummary({ ...KNOWN, inGracePeriod: true }, "en");
    const normal = renderSummary(KNOWN, "en");
    expect(grace.values[0]).toBe("Premium · grace period, expires 19/08/2026");
    expect(grace.values[0]).not.toBe(normal.values[0]);

    const graceVi = renderSummary({ ...KNOWN, inGracePeriod: true }, "vi");
    expect(graceVi.values[0]).toBe("Premium · đang ân hạn, hết hạn 19/08/2026");
    expect(graceVi.values[0]).not.toBe(renderSummary(KNOWN, "vi").values[0]);
  });
});

describe("nhánh `unknown` — MỘT câu thay ba mục, không bao giờ `0`, không bao giờ `—`", () => {
  it.each<Locale>(["en", "vi"])(
    "%s: cả hai hạn mức unknown ⇒ chỉ còn mục gói, cộng đúng MỘT câu",
    (locale) => {
      const { terms, values, text } = renderSummary(FREE_UNKNOWN, locale);
      expect(terms).toHaveLength(1);
      expect(values).toHaveLength(1);
      expect(text).toContain(UNAVAILABLE_SENTENCE[locale]);
      // Không "0" và không "—" ở BẤT KỲ đâu trong bảng đã render.
      expect(text).not.toContain("0");
      expect(text).not.toContain("—");
    }
  );

  it("câu đó nói ĐỦ HAI NỬA: bộ đếm không đọc được, VÀ quyền truy cập không bị ảnh hưởng", () => {
    const { text } = renderSummary(FREE_UNKNOWN, "en");
    expect(text).toContain("We could not read your usage counters");
    expect(text).toContain("This does not restrict your access");
  });

  it("MỘT câu, không phải ba: chỉ đúng một node mang câu ấy", () => {
    const { container } = renderSummary(FREE_UNKNOWN, "en");
    const hits = [...container.querySelectorAll("*")].filter(
      (n) => n.textContent === UNAVAILABLE_SENTENCE.en
    );
    expect(hits).toHaveLength(1);
  });

  it("chỉ tutor unknown (upload vẫn known) ⇒ VẪN là một câu — vị từ là CẢ HAI, không phải MỘT TRONG HAI", () => {
    const { terms, values, text } = renderSummary(
      { ...KNOWN, tutor: { state: "unknown" } },
      "en"
    );
    expect(terms).toHaveLength(1);
    expect(values).toHaveLength(1);
    expect(text).toContain(UNAVAILABLE_SENTENCE.en);
    // Không được lòi ra nửa bảng: 14/15 của upload là con số duy nhất còn đọc
    // được, và in nó ra cạnh một lời xin lỗi là một bảng nửa vời.
    expect(text).not.toContain("14 of 15");
  });

  it("chỉ upload unknown (tutor vẫn known) ⇒ VẪN là một câu", () => {
    const { terms, text } = renderSummary({ ...KNOWN, upload: { state: "unknown" } }, "en");
    expect(terms).toHaveLength(1);
    expect(text).toContain(UNAVAILABLE_SENTENCE.en);
    expect(text).not.toContain("3 of 5");
    expect(text).not.toContain("19/09/2026");
  });

  it("người dùng Premium mà hạn mức unknown: gói vẫn hiện, ba mục kia vẫn là MỘT câu", () => {
    const { terms, values, text } = renderSummary(
      { ...KNOWN, tutor: { state: "unknown" }, upload: { state: "unknown" } },
      "en"
    );
    expect(terms).toEqual(["Current plan"]);
    expect(values).toEqual(["Premium · until 19/08/2026"]);
    expect(text).toContain(UNAVAILABLE_SENTENCE.en);
  });

  it("câu unavailable TỰ NÓ không chứa `0` và không chứa `—` ở cả hai ngôn ngữ", () => {
    for (const locale of ["en", "vi"] as const) {
      expect(UNAVAILABLE_SENTENCE[locale]).not.toContain("0");
      expect(UNAVAILABLE_SENTENCE[locale]).not.toContain("—");
      const { text } = renderSummary({ ...KNOWN, upload: { state: "unknown" } }, locale);
      expect(text).toContain(UNAVAILABLE_SENTENCE[locale]);
    }
  });

  it("thiếu provider ⇒ FREE_FALLBACK: gói Free cộng câu unavailable, không `0`, không `—`", () => {
    // useEntitlement() ngoài provider trả FREE_FALLBACK (fail-closed cho gói,
    // fail-open cho hạn mức) — đúng thứ một trang thiếu EntitlementProvider sẽ
    // render, nên nó phải render ĐƯỢC chứ không nổ.
    const view = render(
      <I18nProvider locale="en">
        <PlanSummary />
      </I18nProvider>
    );
    const text = view.container.textContent ?? "";
    expect(text).toContain("Free");
    expect(text).toContain(UNAVAILABLE_SENTENCE.en);
    expect(text).not.toContain("0");
    expect(text).not.toContain("—");
  });
});

describe("bố cục: lưới TỰ VIẾT, BentoCell dùng lại", () => {
  it("dl mang md:grid-cols-2 và KHÔNG mang sm:grid-cols-12 của BentoGrid", () => {
    const { container } = renderSummary(KNOWN, "en");
    const list = container.querySelector("dl");
    if (!(list instanceof HTMLElement)) throw new Error("PlanSummary rendered no <dl>");
    expect(list.className).toContain("md:grid-cols-2");
    // BentoGrid hardcode `sm:grid-cols-12`, và một lớp `md:grid-cols-*` KHÔNG
    // huỷ được nó (khác breakpoint nên twMerge giữ cả hai) — đó chính là lý do
    // lưới ở đây tự viết (PlanComparison.tsx:69 cùng lý do).
    expect(list.className).not.toContain("sm:grid-cols-12");
  });

  it("đúng MỘT BentoCell bọc ngoài, và nó giữ lớp thẻ của BentoCell", () => {
    const { container } = renderSummary(KNOWN, "en");
    const cell = container.firstElementChild;
    if (!(cell instanceof HTMLElement)) throw new Error("PlanSummary rendered nothing");
    expect(cell.className).toContain("bg-card");
    expect(cell.className).toContain("border");
    expect(container.querySelectorAll("dl")).toHaveLength(1);
  });
});
