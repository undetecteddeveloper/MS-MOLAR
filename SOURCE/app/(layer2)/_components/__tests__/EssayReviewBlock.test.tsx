// @vitest-environment jsdom

// `EssayReviewBlock` — RS-2…RS-6 (UI Spec § Component: EssayReviewBlock).
//
// `renderServerTree()` vì component có con async (`EssayLifecycleBadge`).
// MỌI CA CÓ ÍT NHẤT MỘT KHẲNG ĐỊNH DƯƠNG.

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
// `EssayRegradeControl` (con CLIENT của khối này) goi `useRouter()`, thu nay
// nem "invariant expected app router to be mounted" ngoai mot cay app-router
// that — khong co provider nao trong mot `renderToReadableStream` tran. Stub
// bang dung hinh dang mot-phuong-thuc ma `OrderRow.test.tsx` da chay that.
// BAN THAN control la THAT: chi router bi stub.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import { EssayReviewBlock } from "../EssayReviewBlock";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/translate";
import type { EssayView } from "@/lib/scoring/essayLifecycle";

const DICT = getDictionary(DEFAULT_LOCALE);
const STUDENT = "BAI_LAM_CUA_HOC_SINH";
const MODEL = "DAP_AN_MAU_CUA_TAC_GIA";

function view(over: Partial<EssayView> = {}): EssayView {
  return {
    state: "graded",
    earned: 1,
    max: 1,
    lowConfidence: false,
    retryAvailable: false,
    ...over,
  };
}

function render(v: EssayView, studentAnswer = STUDENT, modelAnswer = MODEL) {
  return renderServerTree(
    <EssayReviewBlock
      view={v}
      studentAnswer={studentAnswer}
      modelAnswer={modelAnswer}
      attemptId="a1"
      questionId="q1"
    />
  );
}

describe("RS-2 (pending) — GIẤU đáp án mẫu", () => {
  it("hiện huy hiệu đang chấm, bài làm của học sinh, và câu chờ", async () => {
    const { container } = await render(view({ state: "pending", earned: null, max: null }));
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.state.pending"]);
    expect(text).toContain(DICT["result.essay.pendingBody"]);
    expect(text).toContain(STUDENT);
  });

  it("KHÔNG hiện đáp án mẫu — đưa ra trước khi có band là mời tự chấm rồi bị phản bác", async () => {
    const { container } = await render(view({ state: "pending", earned: null, max: null }));
    const text = container.textContent ?? "";

    expect(text).not.toContain(MODEL);
    // Khẳng định dương đi kèm: cây có thật và mang bài làm.
    expect(text).toContain(STUDENT);
  });
});

describe("RS-3 (graded) — band từ BẢNG TRA năm chuỗi (UI-D12)", () => {
  it.each([
    [0, "0"],
    [0.25, "0.25"],
    [0.5, "0.5"],
    [0.75, "0.75"],
    [1, "1"],
  ])("band %o hiện đúng chuỗi %o kèm cả hai bài", async (earned, label) => {
    const { container } = await render(view({ state: "graded", earned, max: 1 }));
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.band"].replace("{band}", label));
    expect(text).toContain(DICT["result.essay.state.graded"]);
    // Ở RS-3 CẢ HAI bài đều hiện — đây là lúc đối chiếu có ích.
    expect(text).toContain(STUDENT);
    expect(text).toContain(MODEL);
  });

  it("cờ tin cậy thấp thêm CHỮ và KHÔNG đổi con số nào (AC-047)", async () => {
    const withFlag = await render(view({ state: "graded", earned: 0.75, max: 1, lowConfidence: true }));
    const without = await render(view({ state: "graded", earned: 0.75, max: 1 }));

    const flagged = withFlag.container.textContent ?? "";
    expect(flagged).toContain(DICT["result.essay.lowConfidence"]);
    expect(flagged).toContain(DICT["result.essay.lowConfidenceHelp"]);
    // Con số y hệt ca không có cờ — cờ là một lời mời đối chiếu, không phải một
    // phép trừ điểm.
    const band = DICT["result.essay.band"].replace("{band}", "0.75");
    expect(flagged).toContain(band);
    expect(without.container.textContent ?? "").toContain(band);
  });
});

describe("RS-4 và RS-5 giống nhau TỪNG CHỮ (UI-D6)", () => {
  it("`failed` còn lượt ⇒ câu thất bại + ghi chú số lượt, KHÔNG câu hết lượt", async () => {
    const { container } = await render(view({ state: "failed", earned: null, max: null, retryAvailable: true }));
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.state.failed"]);
    expect(text).toContain(DICT["result.essay.failedBody"]);
    expect(text).toContain(DICT["result.essay.attemptsNote"]);
    expect(text).not.toContain(DICT["result.essay.retryExhausted"]);
  });

  it("KHÔNG câu nào nêu SỐ LƯỢT CÒN LẠI (UI-D9)", async () => {
    const { container } = await render(view({ state: "failed", earned: null, max: null, retryAvailable: true }));
    const text = container.textContent ?? "";

    // Con số ấy tụt vì những lý do học sinh không gây ra, nên hiện nó là hứa sai.
    expect(text).not.toMatch(/\b[123]\s*(lượt|attempts?|lần)\s*(còn|left|remaining)/i);
    expect(text).toContain(DICT["result.essay.attemptsNote"]);
  });
});

describe("RS-6 — hết lượt", () => {
  it("thay ghi chú lượt bằng câu hết lượt", async () => {
    const { container } = await render(view({ state: "failed", earned: null, max: null, retryAvailable: false }));
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.essay.retryExhausted"]);
    expect(text).toContain(DICT["result.essay.failedBody"]);
    expect(text).not.toContain(DICT["result.essay.attemptsNote"]);
  });
});

describe("ba thứ KHÔNG BAO GIỜ xuất hiện", () => {
  it.each(["pending", "graded", "failed"] as const)(
    "state %o: không chip đúng/sai, không gợi ý gia sư",
    async (state) => {
      const { container } = await render(
        view({ state, earned: state === "graded" ? 1 : null, max: state === "graded" ? 1 : null })
      );
      const text = container.textContent ?? "";

      // AC-016: `ExplainStepAffordance` không bao giờ mount cho câu tự luận.
      // Cưỡng chế thật nằm ở KIỂU (props không mang `hasBeenWrongTwice`); ca
      // này chỉ là lưới đọc được.
      expect(text).not.toContain(DICT["result.correctAnswer"]);
      expect(text).not.toContain(DICT["common.correct"]);
      expect(text).not.toContain(DICT["common.wrong"]);
      // Khẳng định dương: cây có thật.
      expect(text).toContain(STUDENT);
    }
  );

  it("bài làm của học sinh KHÔNG đi qua RichText — xuống dòng giữ nguyên, markdown KHÔNG được diễn giải", async () => {
    const raw = "dòng một\n**không phải in đậm**";
    const { container } = await render(view({ state: "graded", earned: 1, max: 1 }), raw);

    // Không có <strong>: mở một đường markdown cho văn bản do học sinh soạn là
    // một bề mặt mới mà hôm nay không ai thiếu (ADR-0002 đọc ngược).
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("**không phải in đậm**");
    // Và xuống dòng được giữ bằng CSS chứ không bằng thẻ.
    expect(container.querySelector(".whitespace-pre-wrap")).not.toBeNull();
  });
});

describe("ô trống", () => {
  it("bài làm rỗng hiện chữ 'bỏ trống', không phải một khoảng trắng câm", async () => {
    const { container } = await render(view({ state: "graded", earned: 0, max: 1 }), "");
    const text = container.textContent ?? "";

    expect(text).toContain(DICT["result.skipped"]);
    expect(text).toContain(DICT["result.essay.band"].replace("{band}", "0"));
  });
});
