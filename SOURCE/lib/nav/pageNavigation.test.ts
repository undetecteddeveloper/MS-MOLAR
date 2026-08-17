// startsPageNavigation — bộ lọc quyết định lớp phủ "Loading" có bật hay không.
//
// Nghĩa vụ chứng minh của file này KHÔNG phải "hàm trả đúng true/false" mà là
// "mọi cú bấm KHÔNG rời trang đều bị loại". Lý do bất đối xứng: bỏ sót một
// trường hợp `true` chỉ làm mất chỉ báo trong một lượt điều hướng; bỏ sót một
// trường hợp `false` thì lớp phủ bật lên và không bao giờ có route mới nào
// commit để tắt nó — người dùng nhìn màn hình khoá cứng cho tới khi hết hẹn
// giờ chặn trên (12s).

import { describe, expect, it } from "vitest";
import { startsPageNavigation, type NavIntent } from "./pageNavigation";

const HERE = "https://ms-molar.test/exams?subject=Math#q3";

/** Cú bấm chuột trái, không phím bổ trợ, sang một path khác. */
function intent(overrides: Partial<NavIntent> = {}): NavIntent {
  return {
    href: "https://ms-molar.test/history",
    target: "",
    hasDownload: false,
    currentUrl: HERE,
    button: 0,
    modifierKey: false,
    ...overrides,
  };
}

describe("startsPageNavigation", () => {
  it("bấm trái sang path khác cùng site → true", () => {
    expect(startsPageNavigation(intent())).toBe(true);
  });

  describe("KHÔNG rời trang — mọi nhánh phải trả false", () => {
    it("chuột giữa (mở tab mới)", () => {
      expect(startsPageNavigation(intent({ button: 1 }))).toBe(false);
    });

    it("giữ Ctrl/Meta/Shift/Alt (mở tab/cửa sổ mới, hoặc tải xuống)", () => {
      expect(startsPageNavigation(intent({ modifierKey: true }))).toBe(false);
    });

    it("thẻ có `download` — tải file, trang vẫn đứng yên", () => {
      expect(startsPageNavigation(intent({ hasDownload: true }))).toBe(false);
    });

    it("target=_blank", () => {
      expect(startsPageNavigation(intent({ target: "_blank" }))).toBe(false);
    });

    it("khác origin", () => {
      expect(startsPageNavigation(intent({ href: "https://google.com/x" }))).toBe(false);
    });

    it("mailto: và tel: — /about dùng cả hai, và chúng KHÔNG điều hướng", () => {
      expect(startsPageNavigation(intent({ href: "mailto:a@b.c" }))).toBe(false);
      expect(startsPageNavigation(intent({ href: "tel:0912037624" }))).toBe(false);
    });

    it("cùng path, chỉ đổi query — `/?auth=signin` của trang chủ swap panel tại chỗ", () => {
      expect(
        startsPageNavigation({
          ...intent(),
          currentUrl: "https://ms-molar.test/",
          href: "https://ms-molar.test/?auth=signin",
        })
      ).toBe(false);
    });

    it("cùng path, chỉ đổi hash — neo trong trang", () => {
      expect(startsPageNavigation(intent({ href: "https://ms-molar.test/exams#q9" }))).toBe(false);
    });

    it("không có href", () => {
      expect(startsPageNavigation(intent({ href: null }))).toBe(false);
    });

    it("`currentUrl` không parse được — không đoán bừa, coi như không điều hướng", () => {
      // Không có đường nào trong app tạo ra tình huống này; nhánh try/catch tồn
      // tại để một `window.location.href` lạ (extension, about:blank trong
      // iframe) không ném lỗi ra giữa handler click của TOÀN SITE.
      expect(startsPageNavigation(intent({ currentUrl: "::::" }))).toBe(false);
    });
  });

  it("href TƯƠNG ĐỐI được resolve theo trang hiện tại, không so chuỗi thô", () => {
    // "/history" so nguyên chuỗi với "https://…/exams?…" thì khác nhau bằng
    // cách nào cũng ra true — kể cả khi nó trỏ về đúng chỗ đang đứng.
    expect(startsPageNavigation(intent({ href: "/history" }))).toBe(true);
    expect(startsPageNavigation(intent({ href: "/exams" }))).toBe(false);
  });

  it("KHÔNG kiểm `defaultPrevented` — <Link> của Next huỷ mặc định ở mọi cú bấm", () => {
    // Ghim bằng cấu trúc kiểu chứ không bằng lời hứa trong comment: thêm lại
    // trường đó vào NavIntent sẽ làm dòng này đỏ ở tsc (excess property), tức
    // là người thêm buộc phải đọc lý do trước khi đi tiếp.
    // @ts-expect-error `defaultPrevented` cố ý KHÔNG thuộc NavIntent — xem
    // khối chú thích trong pageNavigation.ts.
    expect(startsPageNavigation({ ...intent(), defaultPrevented: true })).toBe(true);
  });
});
