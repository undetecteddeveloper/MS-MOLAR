// @vitest-environment jsdom

// `EssayScoreLine` — năm hàng của ma trận trạng thái (UI Spec § Component:
// EssayScoreLine).
//
// ═══ VÌ SAO `renderServerTree()` CHỨ KHÔNG `render(await …)` (AB-2, R-F2) ═══
//
// Component này async VÀ CÓ CON ASYNC (`EssayLifecycleBadge`). Renderer CLIENT
// của React 19 từ chối một async component, treo lại, và trả về CÂY RỖNG — nên
// `render(await …)` sẽ làm MỌI khẳng định phủ định xanh trên hư không. Đó đúng
// là chế độ hỏng mà `renderServerTree.tsx:4-10` được viết ra để mô tả.
//
// Đây là consumer THỨ HAI của helper ấy. Rule of Three CHƯA đạt, nên helper
// KHÔNG được chuyển đi — import từ đúng chỗ nó đang nằm.
//
// MỌI CA CÓ ÍT NHẤT MỘT KHẲNG ĐỊNH DƯƠNG.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import { EssayScoreLine } from "@/features/exams/components/EssayScoreLine";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/translate";
import type { EssaySummary } from "@/lib/scoring/essayLifecycle";

const DICT = getDictionary(DEFAULT_LOCALE);
const HREF = "/exams/e1/attempt/a1/result/detail";

function summary(over: Partial<EssaySummary> = {}): EssaySummary {
  return {
    earned: 0,
    max: 0,
    gradedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    unresolvedCount: 0,
    ...over,
  };
}

function render(s: EssaySummary | undefined) {
  return renderServerTree(<EssayScoreLine summary={s} detailHref={HREF} />);
}

describe("hàng NOT-RENDERED — không khoá vòng đời nào ⇒ KHÔNG node nào (FE-AC-14)", () => {
  it("summary `undefined` ⇒ cây rỗng hoàn toàn", async () => {
    const { container } = await render(undefined);

    // Đây là ca phủ định, nên nó cần một khẳng định DƯƠNG để không xanh vô
    // nghĩa: chứng minh cùng một helper CÓ dựng ra node khi có dữ liệu.
    const populated = await render(summary({ gradedCount: 1, earned: 1, max: 1 }));
    expect(populated.container.querySelector("div")).not.toBeNull();

    // Và với `undefined` thì đúng là không có gì — đó là thứ giữ AC-012 đúng
    // TỪNG BYTE cho một dòng ghi trước khi tính năng ship.
    expect(container.innerHTML).toBe("");
  });
});

describe("hàng DEFAULT — mọi câu đã ngã ngũ, ≥1 đã chấm", () => {
  it("hiện nhãn, điểm, và câu mẫu số ĐẾM ĐÚNG `gradedCount`", async () => {
    const { container } = await render(
      summary({ earned: 1.75, max: 2, gradedCount: 2 })
    );
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.label"]);
    expect(text).toContain("1.75");
    expect(text).toContain("2");
    // AC-059: câu này phải nói rõ nó đếm GÌ — số câu ĐÃ CHẤM XONG, không phải
    // tổng số câu tự luận của đề.
    expect(text).toContain(
      DICT["result.essay.denominator"].replace("{n}", "2")
    );
  });

  it("cắt số 0 thừa: 1.00 hiện là `1`, không phải `1.00`", async () => {
    const { container } = await render(summary({ earned: 1, max: 1, gradedCount: 1 }));
    const text = container.textContent ?? "";

    expect(text).toContain("1 / 1");
    expect(text).not.toContain("1.00");
  });
});

describe("hàng LOADING — còn câu đang chấm", () => {
  it("hiện huy hiệu `đang chấm` cộng câu 'còn {k} câu'", async () => {
    const { container } = await render(
      summary({ earned: 1, max: 1, gradedCount: 1, pendingCount: 2, unresolvedCount: 2 })
    );
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.state.pending"]);
    expect(text).toContain(DICT["result.essay.stillGrading"].replace("{k}", "2"));
    // Điểm đã có thì VẪN hiện — học sinh không phải chờ hết mới thấy phần đã xong.
    expect(text).toContain("1 / 1");
  });

  it("chưa câu nào chấm xong mà còn câu đang chấm ⇒ `—`, KHÔNG `0 / 0`", async () => {
    const { container } = await render(summary({ pendingCount: 3, unresolvedCount: 3 }));
    const text = container.textContent ?? "";

    expect(text).toContain("—");
    expect(text).not.toContain("0 / 0");
  });

  it("`pending` THẮNG `failed`: còn câu đang chấm thì KHÔNG kết luận thất bại", async () => {
    // Khi còn câu chưa xong, cả `earned` lẫn mẫu số đều chưa ngã ngũ. Nói
    // "{k} câu chấm thất bại" lúc ấy là kết luận sớm trên một lượt chạy dở.
    const { container } = await render(
      summary({ earned: 1, max: 1, gradedCount: 1, pendingCount: 1, failedCount: 1 })
    );
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.stillGrading"].replace("{k}", "1"));
    expect(text).not.toContain(DICT["result.essay.someFailed"].replace("{k}", "1"));
  });
});

describe("hàng PARTIAL — hết câu đang chấm, có câu chấm xong VÀ có câu hỏng", () => {
  it("hiện điểm cộng câu 'thất bại' kèm liên kết sang Chi tiết", async () => {
    const { container } = await render(
      summary({ earned: 0.75, max: 1, gradedCount: 1, failedCount: 2 })
    );
    const text = container.textContent ?? "";

    expect(text).toContain("0.75 / 1");
    expect(text).toContain(DICT["result.essay.someFailed"].replace("{k}", "2"));

    // "Chi tiết" là lối đi DUY NHẤT tới nút chấm lại, nên nó phải là một liên
    // kết thật chứ không phải một câu bảo học sinh tự đi tìm.
    const link = container.querySelector(`a[href="${HREF}"]`);
    expect(link).not.toBeNull();
  });
});

describe("hàng EMPTY — chưa câu nào chấm xong (FE-AC-15)", () => {
  it("hiện `—` và câu 'chưa có câu nào', KHÔNG BAO GIỜ `0 / 0 điểm`", async () => {
    const { container } = await render(summary({ failedCount: 3 }));
    const text = container.textContent ?? "";

    expect(text).toContain("—");
    expect(text).toContain(DICT["result.essay.noneGraded"]);
    // `0 / 0` đọc ra là "bạn được 0 điểm" trên đúng bài viết học sinh vừa làm
    // — tái tạo chính khuyết tật mà cả tính năng này tồn tại để chấm dứt.
    expect(text).not.toContain("0 / 0");
    expect(container.querySelector(`a[href="${HREF}"]`)).not.toBeNull();
  });
});

describe("tabular-nums là CHỨC NĂNG, không phải thẩm mỹ", () => {
  it("phần tử mang điểm có class `tabular-nums`", async () => {
    // Mẫu số LỚN LÊN trong lúc học sinh đang nhìn (W7): mỗi band đáp xuống làm
    // `gradedCount` tăng và poller `router.refresh()`. Chữ số không đều bề
    // ngang làm cả dòng giật mỗi lần cập nhật.
    const { container } = await render(summary({ earned: 1, max: 1, gradedCount: 1 }));

    const numeric = container.querySelector(".tabular-nums");
    expect(numeric).not.toBeNull();
    expect(numeric?.textContent).toContain("1 / 1");
  });
});

describe("Theme Token Map", () => {
  it("KHÔNG hex viết cứng, KHÔNG shadow, KHÔNG gradient", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const raw = readFileSync(
      join(process.cwd(), "features/exams/components/EssayScoreLine.tsx"),
      "utf8"
    );
    // Quét MÃ chứ không quét văn xuôi — file này giải thích trong comment vì
    // sao nó không làm mấy việc đó.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/shadow-|gradient/);
    // Khẳng định dương: file có thật và có nội dung.
    expect(source).toContain("EssayScoreLine");
  });
});
