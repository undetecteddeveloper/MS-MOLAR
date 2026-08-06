// Hợp đồng của lớp i18n. Ba thứ dễ hỏng âm thầm nhất khi thêm chuỗi mới:
//   1. Bản dịch sót khoá → giao diện lòi tiếng Anh giữa trang tiếng Việt.
//   2. Bản dịch copy-paste quên dịch → khoá có, chữ vẫn nguyên tiếng Anh.
//   3. Chuỗi có tham số `{name}` mà bản dịch đánh rơi tham số → hiện "{count}".
// Kiểu TypeScript bắt được (1) lúc biên dịch, nhưng (2) và (3) thì không —
// nên phải kiểm ở đây.

import { describe, expect, it } from "vitest";
import { en } from "../dictionaries/en";
import { vi } from "../dictionaries/vi";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "../locales";
import { createTranslate, getDictionary } from "../translate";

const enKeys = Object.keys(en).sort();
const viKeys = Object.keys(vi).sort();

/** Rút các tham số `{name}` trong một chuỗi mẫu. */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("từ điển", () => {
  it("tiếng Việt phủ đúng bộ khoá của tiếng Anh — không thừa, không thiếu", () => {
    expect(viKeys).toEqual(enKeys);
  });

  it("không khoá nào bỏ trống", () => {
    const empty = enKeys.filter((k) => {
      const e = en[k as keyof typeof en];
      const v = vi[k as keyof typeof vi];
      return e.trim() === "" || v.trim() === "";
    });
    expect(empty).toEqual([]);
  });

  it("mỗi khoá giữ NGUYÊN bộ tham số giữa hai ngôn ngữ", () => {
    // Bản dịch đánh rơi `{count}` sẽ hiện câu cụt; thêm `{foo}` lạ sẽ hiện
    // nguyên dấu ngoặc ra màn hình vì `createTranslate` không thay được.
    const mismatched = enKeys.filter((k) => {
      const e = placeholders(en[k as keyof typeof en]);
      const v = placeholders(vi[k as keyof typeof vi]);
      return JSON.stringify(e) !== JSON.stringify(v);
    });
    expect(mismatched).toEqual([]);
  });

  it("phần lớn chuỗi tiếng Việt thực sự KHÁC tiếng Anh", () => {
    // Một số khoá trùng nhau là hợp lệ và cố ý ("Email", "Google", "HK1"…),
    // nhưng nếu tỷ lệ trùng vọt lên thì gần như chắc chắn có mảng bị quên dịch.
    const identical = enKeys.filter((k) => en[k as keyof typeof en] === vi[k as keyof typeof vi]);
    expect(identical.length / enKeys.length).toBeLessThan(0.1);
  });
});

describe("createTranslate", () => {
  const t = createTranslate(getDictionary("en"));

  it("trả chuỗi theo khoá", () => {
    expect(t("common.cancel")).toBe("Cancel");
  });

  it("thay tham số `{name}`", () => {
    expect(t("player.secondsRemaining", { count: 30 })).toBe("30 seconds remaining");
  });

  it("giữ nguyên dấu ngoặc khi thiếu tham số, thay vì nuốt mất chữ", () => {
    expect(t("player.secondsRemaining")).toBe("{count} seconds remaining");
  });

  it("tra từ điển tiếng Việt ra chữ tiếng Việt", () => {
    const tv = createTranslate(getDictionary("vi"));
    expect(tv("common.cancel")).toBe("Huỷ");
  });
});

describe("locales", () => {
  it("chỉ nhận đúng mã trong danh sách", () => {
    // `isLocale` là chốt chặn giá trị cookie do client gửi lên (xem actions.ts).
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale("<script>")).toBe(false);
  });

  it("ngôn ngữ mặc định nằm trong danh sách", () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });

  it("mọi ngôn ngữ đều có từ điển", () => {
    for (const l of LOCALES) expect(Object.keys(getDictionary(l)).length).toBe(enKeys.length);
  });
});
