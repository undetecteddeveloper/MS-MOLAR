// @vitest-environment jsdom

// `EssayLifecycleBadge` — ba diện mạo vòng đời chấm tự luận (UI Spec
// § Component: EssayLifecycleBadge).
//
// BIÊN MOCK: chỉ `server-only` và `cookies()` của next/headers. TỪ ĐIỂN LÀ
// THẬT — nên mỗi ca khẳng định "đúng KHOÁ giải ra đúng CHUỖI", chứ không phải
// "có một chuỗi nào đó". Một test mock từ điển sẽ xanh cả khi component đọc
// nhầm khoá.
//
// `render(await EssayLifecycleBadge(...))` hợp lệ Ở ĐÂY (AB-3) vì component
// này KHÔNG có con async. Ngay khi nó có, kỹ thuật này trả về CÂY RỖNG và mọi
// khẳng định phủ định sẽ xanh trên hư không — đó là lý do F-A3 phải dùng
// `renderServerTree()`.
//
// MỌI CA ĐỀU CÓ ÍT NHẤT MỘT KHẲNG ĐỊNH DƯƠNG, kể cả ca có mục đích phủ định.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { EssayLifecycleBadge } from "../EssayLifecycleBadge";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/translate";

afterEach(cleanup);

/** Không có cookie ⇒ `DEFAULT_LOCALE`. Chuỗi mong đợi lấy TỪ CHÍNH từ điển mà
 *  component sẽ giải ra, qua `getDictionary(DEFAULT_LOCALE)` — KHÔNG gõ lại và
 *  KHÔNG chọn cứng một ngôn ngữ. Gõ lại là tạo một lời khai thứ hai sẽ trôi
 *  lệch; chọn cứng `vi` là làm ca này đỏ vào ngày ai đó đổi ngôn ngữ mặc định,
 *  vì một lý do chẳng liên quan gì tới cái huy hiệu này. */
const DICT = getDictionary(DEFAULT_LOCALE);
const EXPECTED = {
  pending: DICT["result.essay.state.pending"],
  graded: DICT["result.essay.state.graded"],
  failed: DICT["result.essay.state.failed"],
} as const;

describe("EssayLifecycleBadge — ba trạng thái, ba chuỗi ĐÚNG từ từ điển thật", () => {
  it.each([
    ["pending", "◌"],
    ["graded", "✓"],
    ["failed", "✕"],
  ] as const)("state %o hiện đúng chuỗi của nó kèm glyph %o", async (state, glyph) => {
    const { container } = render(await EssayLifecycleBadge({ state }));

    // KHẲNG ĐỊNH DƯƠNG: cây không rỗng và mang đúng chữ.
    expect(container.textContent).toContain(EXPECTED[state]);
    expect(container.querySelector("span")).not.toBeNull();
    expect(container.textContent).toContain(glyph);
  });

  it("ba trạng thái cho ba chuỗi KHÁC NHAU — không hai cái nào trùng", async () => {
    // Nếu hai trạng thái giải ra cùng một chuỗi thì học sinh không phân biệt
    // được "đang chấm" với "chấm thất bại", và mọi ca ở trên vẫn xanh.
    const rendered = await Promise.all(
      (["pending", "graded", "failed"] as const).map(async (state) => {
        const { container } = render(await EssayLifecycleBadge({ state }));
        const text = container.textContent ?? "";
        cleanup();
        return text;
      })
    );

    expect(new Set(rendered).size).toBe(3);
    expect(rendered.every((t) => t.length > 0)).toBe(true);
  });
});

describe("khả truy cập — CHỮ mang thông tin, glyph thì không", () => {
  it("glyph là `aria-hidden`, nên trình đọc màn hình chỉ đọc CHỮ", async () => {
    const { container } = render(await EssayLifecycleBadge({ state: "failed" }));

    const glyph = container.querySelector("[aria-hidden]");
    expect(glyph).not.toBeNull();
    expect(glyph?.textContent).toBe("✕");
    // Và chữ VẪN có mặt — đó là nửa quan trọng: ẩn glyph mà không có chữ là
    // một huy hiệu câm.
    expect(container.textContent).toContain(EXPECTED.failed);
  });

  it("KHÔNG phần tử nào mang thuộc tính `disabled`", async () => {
    const { container } = render(await EssayLifecycleBadge({ state: "pending" }));

    expect(container.querySelector("[disabled]")).toBeNull();
    // Khẳng định dương đi kèm để ca này không xanh trên một cây rỗng.
    expect(container.textContent).toContain(EXPECTED.pending);
  });

  it("thông tin KHÔNG nằm ở màu — chữ sống sót qua bản in trắng đen", async () => {
    // Kiểm bằng cách bỏ hết class đi rồi đọc lại nội dung: nếu chữ vẫn nói đủ
    // trạng thái thì màu chỉ là lớp trang trí.
    const { container } = render(await EssayLifecycleBadge({ state: "graded" }));
    container.querySelectorAll("*").forEach((el) => el.removeAttribute("class"));

    expect(container.textContent).toContain(EXPECTED.graded);
  });
});

describe("Theme Token Map — không hex, không shadow, không gradient", () => {
  const raw = readFileSync(
    join(process.cwd(), "components/essay/EssayLifecycleBadge.tsx"),
    "utf8"
  );
  /** Quét MÃ, không quét văn xuôi. File ấy GIẢI THÍCH vì sao nó không mượn
   *  `#4F7942` và không dùng `?? CONFIG.default`, nên một lượt quét thô sẽ đỏ
   *  vì chính lời giải thích — tức trừng phạt việc ghi lại lý do. Bỏ comment
   *  trước khi quét giữ được cả hai: lý do nằm trong file, và rào chắn vẫn đo
   *  đúng thứ nó định đo. */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("KHÔNG có literal hex nào trong file", () => {
    // Quy tắc cứng của theme: màu lấy từ token ở globals.css, không gõ hex.
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("KHÔNG mượn `#4F7942` — màu 'đáp án đúng'", () => {
    // Ba lý do độc lập: nó là hex viết cứng; nó đang là TBD-04 ở một spec khác
    // và tính năng này không nhân bản một món nợ; và NGHĨA của nó SAI — một
    // band không phải một phán quyết đúng/sai, `isCorrect` là `false` vĩnh
    // viễn (W1), nên tô nó màu "đúng" là khẳng định một điều không thật.
    expect(source).not.toContain("4F7942");
    expect(source).not.toContain("4f7942");
  });

  it("KHÔNG box-shadow, KHÔNG gradient", () => {
    expect(source).not.toMatch(/shadow-|box-shadow|gradient/);
  });

  it("KHÔNG có `?? CONFIG.default` và KHÔNG có `as` ép kiểu (UI-D13)", () => {
    // Một giá trị lạ phải có diện mạo RIÊNG, không được rơi im lặng vào một
    // trạng thái hợp lệ. Ở đây điều đó được bảo đảm sớm hơn: `deriveEssayView()`
    // trả `null` cho giá trị lạ nên nó không bao giờ tới được component này,
    // và `Record<EssayRenderState, …>` là vét cạn nên `tsc` canh phần còn lại.
    expect(source).not.toMatch(/\?\?\s*\w*CONFIG/);
    expect(source).not.toMatch(/\bas\s+EssayRenderState\b/);
  });
});
