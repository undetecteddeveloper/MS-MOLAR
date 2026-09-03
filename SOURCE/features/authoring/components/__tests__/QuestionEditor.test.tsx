// @vitest-environment jsdom

// QuestionEditor — màn review sau upload phải HIỂN THỊ công thức, không in nguồn.
//
// Trước bản vá đầu tiên layer4 không dùng <RichText> ở đâu cả: tác giả upload đề
// Toán và nhìn thấy "$\frac{1}{2}$" nguyên văn ở màn duyệt, trong khi màn làm bài
// lại render đúng. Không có cách nào biết đề hiển thị đúng hay sai trước khi
// publish. Chế độ SỬA cố ý giữ chuỗi NGUỒN trong input — sửa công thức thì phải
// sửa được LaTeX. Test này ghim đúng ranh giới đó: xem = đã render, sửa = nguồn thô.
//
// TD-027 (2026-08-27) đổi CÁCH đạt được điều đó mà KHÔNG được đổi chính điều đó,
// nên file này nay ghim CẢ HAI đường:
//   · chuỗi CHƯA bị sửa  → dùng node server dựng sẵn (`nodes`), 0 byte JS client;
//   · chuỗi ĐÃ bị sửa    → nạp động RichText ở client rồi render.
// Đường thứ hai là thứ dễ hỏng trong im lặng nhất: nếu nó gãy, tác giả vẫn thấy
// chữ (chuỗi nguồn) nên không ai báo lỗi — chỉ là công thức không còn hiện ra
// nữa, đúng cái bug mà file này sinh ra để chặn.
//
// @category: core-functionality
// @dependency: none — real QuestionEditor + real RichText, no mocks

// Không có auto-cleanup của RTL trong cấu hình vitest này → truy vấn bó trong
// `container`, không dùng `screen`.
import { fireEvent, render, waitFor, within } from "@testing-library/react";

import { describe, expect, it, vi } from "vitest";
import type { AssembledQuestion } from "@/lib/ugc/types";
import { QuestionEditor } from "@/features/authoring/components/QuestionEditor";
import { renderReviewNodes } from "@/features/authoring/components/reviewNodes";
import { reviewNodeKey } from "@/features/authoring/components/reviewNodes.types";

// Nạp động (`next/dynamic`) trong jsdom phải đi qua cả cây module
// react-markdown + remark + rehype + katex, và nó chỉ được KHỞI ĐỘNG khi nhánh
// "chuỗi đã sửa" chạy — tức không có cách nào hâm nóng trước trong test.
// Mặc định 1000ms của `waitFor` đã đo được 1290ms một lần khi chạy CẢ bộ test
// (máy đang bận), nên nó là nguồn flake chứ không phải một phép kiểm. Ghim
// thành hằng số có tên để lần sau ai chỉnh còn biết mình đang chỉnh cái gì.
const LAZY_CHUNK_BUDGET_MS = 5000;

const MCQ: AssembledQuestion = {
  part: 1,
  number: 1,
  type: "mcq",
  stem: "Tính $\\frac{1}{2} + \\frac{1}{3}$.",
  choices: [
    { id: "A", text: "$\\frac{5}{6}$" },
    { id: "B", text: "$\\frac{2}{5}$" },
    { id: "C", text: "1" },
    { id: "D", text: "2" },
  ],
  correctAnswer: "A",
  topic: "Phân số",
};

/** Dựng node y hệt server làm cho chính câu này (đường đi thật của trang). */
function nodesFor(question: AssembledQuestion) {
  return renderReviewNodes([question])[reviewNodeKey(question.part, question.number)];
}

function renderEditor(question: AssembledQuestion = MCQ, onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <QuestionEditor
        question={question}
        onChange={onChange}
        hasError={false}
        nodes={nodesFor(question)}
      />,
    ),
  };
}

describe("QuestionEditor — LaTeX ở chế độ xem", () => {
  it("stem có công thức render thành math, không in chuỗi nguồn", () => {
    const { container } = renderEditor();

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toContain("$\\frac{1}{2} + \\frac{1}{3}$");
  });

  it("lựa chọn A–D có công thức cũng render thành math", () => {
    const { container } = renderEditor();

    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (a) => a.textContent,
    );
    expect(annotations).toContain("\\frac{5}{6}");
    expect(annotations).toContain("\\frac{2}{5}");
  });

  it("chế độ sửa trả lại chuỗi NGUỒN để sửa được công thức", () => {
    const { container } = renderEditor();

    fireEvent.click(within(container).getByRole("button", { name: /edit/i }));

    expect(within(container).getByDisplayValue("Tính $\\frac{1}{2} + \\frac{1}{3}$.")).toBeTruthy();
    expect(within(container).getByDisplayValue("$\\frac{5}{6}$")).toBeTruthy();
  });

  it("ý a–d của true_false cũng render math ở chế độ xem", () => {
    const { container } = renderEditor({
      part: 2,
      number: 1,
      type: "true_false",
      stem: "Xét tính đúng sai:",
      subItems: [{ id: "a", text: "Hàm số nghịch biến trên $(-\\infty; 2)$." }],
      subAnswers: { a: true },
      topic: "Hàm số",
    });

    expect(container.querySelector(".katex")).not.toBeNull();
  });
});

describe("QuestionEditor — node server sẵn có so với chuỗi vừa bị sửa (TD-027)", () => {
  it("chuỗi CHƯA đụng tới thì dùng thẳng node của server, không cần chunk client", () => {
    // Không `waitFor`: khẳng định ở đây chính là "có ngay, đồng bộ". Nếu một
    // ngày nào đó nhánh này phải chờ, tức node của server đã ngừng được dùng và
    // cả route quay lại tải 126.3 KB — test đỏ ngay tại dòng này.
    const { container } = renderEditor();

    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("chuỗi ĐÃ sửa khác node của server thì vẫn render math (nạp động)", async () => {
    // Đúng đường đi của tác giả: bấm Sửa (hâm nóng chunk) → gõ công thức mới →
    // bấm Xong. Node của server lúc này ôi, nên chỗ hiển thị phải tự dựng lại
    // bằng chunk client. Đây là nhánh mà `ssr: false` phụ thuộc vào.
    const question = { ...MCQ, stem: "$x^2$" };
    const nodes = nodesFor(question);
    const edited = { ...question, stem: "Đã sửa: $\\sqrt{9}=3$." };

    // Dựng với node của chuỗi CŨ nhưng câu hỏi mang chuỗi MỚI — chính trạng
    // thái mà ReviewScreen rơi vào ngay sau một lần gõ.
    const { container } = render(
      <QuestionEditor question={edited} onChange={vi.fn()} hasError={false} nodes={nodes} />,
    );

    await waitFor(
      () => {
        const annotations = Array.from(container.querySelectorAll("annotation")).map(
          (a) => a.textContent,
        );
        expect(annotations).toContain("\\sqrt{9}=3");
      },
      { timeout: LAZY_CHUNK_BUDGET_MS },
    );
    // Và chuỗi nguồn KHÔNG được lọt ra màn hình — đúng bug ban đầu.
    expect(container.textContent).not.toContain("$\\sqrt{9}=3$");
  });

  it("không có node nào (câu server chưa từng thấy) thì vẫn render math", async () => {
    // `nodes` vắng mặt là trạng thái hợp lệ, không phải lỗi. Nếu nhánh này im
    // lặng trả về chuỗi rỗng thì tác giả mất hẳn nội dung câu hỏi.
    const { container } = render(
      <QuestionEditor question={MCQ} onChange={vi.fn()} hasError={false} />,
    );

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: LAZY_CHUNK_BUDGET_MS,
    });
  });
});

// =============================================================================
// Task E4 / OQ-5 — the author-facing essay footnote follows the flag
// =============================================================================
// The old string ("stored, not auto-scored yet") tells the EXAM AUTHOR that
// essays are not graded. It becomes false the moment the flag is on. Decision
// (b) keeps BOTH strings and selects by the flag, mirroring what AC-051/UI-D8
// already do for the player footnote -- because a single rewritten string is
// simply false in the other direction whenever the flag is off, and the flag
// HAS an off path: E6 keeps a kill switch, and preview need not carry the same
// variable as production.
//
// Both directions live in ONE case so neither can be fixed by breaking the
// other -- an inverted ternary passes a test that only ever checks one branch.
describe("Task E4 — essay footnote follows ESSAY_GRADING_ENABLED", () => {
  const ESSAY: AssembledQuestion = {
    part: 1,
    number: 1,
    type: "essay",
    stem: "Nêu định nghĩa hàm số bậc nhất.",
    essayAnswer: "Dạng y = ax + b với a khác 0.",
  } as AssembledQuestion;

  const OFF = "stored, not auto-scored yet";
  const ON = "auto-scored after the student submits";

  it("shows the not-scored string when the flag is absent, the scored string when it is on, and never both", () => {
    // Default (prop omitted) must be the OFF text: fail-closed, so a call site
    // that forgets the prop shows something merely stale rather than promising
    // the author a feature that may be switched off.
    const fallback = render(
      <QuestionEditor question={ESSAY} onChange={vi.fn()} hasError={false} />,
    );
    expect(fallback.container.textContent).toContain(OFF);
    expect(fallback.container.textContent).not.toContain(ON);

    const off = render(
      <QuestionEditor
        question={ESSAY}
        onChange={vi.fn()}
        hasError={false}
        essayGradingEnabled={false}
      />,
    );
    expect(off.container.textContent).toContain(OFF);
    expect(off.container.textContent).not.toContain(ON);

    const on = render(
      <QuestionEditor
        question={ESSAY}
        onChange={vi.fn()}
        hasError={false}
        essayGradingEnabled
      />,
    );
    expect(on.container.textContent).toContain(ON);
    expect(on.container.textContent).not.toContain(OFF);
  });
});
