// @vitest-environment jsdom

// PointsPanel — panel gán điểm hàng loạt ở màn sửa đề.
//
// Cái đáng ghim KHÔNG phải là panel vẽ ra đúng mấy cái ô. Đó là: những con số
// nó ghi vào `points` phải là biểu điểm mà cổng publish B1 CHẤP NHẬN — mọi câu
// > 0 và tổng khớp thang. Một panel chia sai vẫn "chạy" hoàn hảo trên màn hình
// rồi đẩy tác giả vào một lỗi POINTS_TOTAL_MISMATCH mà họ không có cách nào
// truy ra, vì mọi ô nhập đều trông đúng.
//
// Nó cũng ghim ranh giới phạm vi: gán điểm cho PHẦN III không được đụng tới
// một câu nào của phần khác. Danh tính câu ở layer 4 là cặp (part, number)
// (ADR-0005), nên một lỗi bỏ quên `part` sẽ ghi nhầm sang "câu 1" của mọi phần
// và chỉ lộ ra trên đề nhiều phần.
//
// @category: core-functionality
// @dependency: none — real PointsPanel, no mocks

// Không có auto-cleanup của RTL trong cấu hình vitest này → truy vấn bó trong
// `container`, không dùng `screen`, VÀ gỡ tay sau mỗi ca (afterEach dưới).
//
// `cleanup()` ở đây không phải thói quen chép từ đâu về: panel có phần tử mang
// `id` cố định (`#points-panel-body`, để `aria-controls` trỏ tới). Các bản
// render cũ còn nằm trong `document.body` nghĩa là id đó trùng nhiều lần, và
// `container.querySelector("#id")` của jsdom tra qua `getElementById` trên CẢ
// tài liệu rồi mới kiểm bao hàm — nó trả phần tử của bản render ĐẦU TIÊN, thấy
// không nằm trong container này, rồi trả null. Ca test cuối cùng đỏ trong khi
// chạy riêng thì xanh, đúng kiểu flake khó truy nhất.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { LIMITS } from "@/lib/ugc/limits";
import type { AssembledQuestion, ExtractedPart } from "@/lib/ugc/types";
import { PointsPanel, type PointsAssignment } from "@/features/authoring/components/PointsPanel";

/** jsdom không có matchMedia — panel đọc nó để chọn mở/thu mặc định. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(cleanup);

function question(part: number, number: number, points?: number): AssembledQuestion {
  return {
    part,
    number,
    type: "short_answer",
    stem: `Câu ${number} phần ${part}`,
    topic: "Ngữ văn",
    points,
  };
}

const PARTS: ExtractedPart[] = [
  { number: 1, title: "I. PHẦN ĐỌC HIỂU" },
  { number: 2, title: "PHẦN II. VIẾT" },
];

/** Đề hai phần: phần 1 có 7 câu, phần 2 có 2 câu. */
const TWO_PART = [
  ...Array.from({ length: 7 }, (_, i) => question(1, i + 1)),
  question(2, 1),
  question(2, 2),
];

function setup(questions: AssembledQuestion[], parts: ExtractedPart[] = PARTS) {
  stubMatchMedia(true); // desktop → panel mở sẵn
  const onApply = vi.fn<(a: PointsAssignment[]) => void>();
  const { container } = render(
    <PointsPanel questions={questions} parts={parts} onApply={onApply} />
  );
  const totalInput = container.querySelector<HTMLInputElement>(
    'input[aria-label="Total marks for the selected range"]'
  )!;
  const applyButton = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Split marks"
  )!;
  return { container, onApply, totalInput, applyButton };
}

describe("PointsPanel — chia theo phần", () => {
  it("chia đúng tổng cho các câu CỦA PHẦN ĐÓ, không đụng phần khác", () => {
    const { onApply, totalInput, applyButton } = setup(TWO_PART);

    fireEvent.change(totalInput, { target: { value: "3" } });
    fireEvent.click(applyButton);

    const assignments = onApply.mock.calls[0][0];
    expect(assignments).toHaveLength(7);
    expect(assignments.every((a) => a.part === 1)).toBe(true);
    // Bất biến trung tâm: tổng khớp ĐÚNG con số tác giả gõ, trong sai số mà
    // cổng publish tha (3/7 làm tròn độc lập sẽ ra 3.01).
    const sum = assignments.reduce((acc, a) => acc + a.points, 0);
    expect(Math.abs(sum - 3)).toBeLessThanOrEqual(LIMITS.POINTS_EPSILON);
    expect(assignments.every((a) => a.points > 0)).toBe(true);
  });

  it("đổi phần thì phạm vi đổi theo", () => {
    const { container, onApply, totalInput, applyButton } = setup(TWO_PART);
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Part to assign marks to"]'
    )!;
    // Dropdown in ĐÚNG tiêu đề đề gốc, không phải "Part 1"/"Part 2".
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "I. PHẦN ĐỌC HIỂU",
      "PHẦN II. VIẾT",
    ]);

    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.change(totalInput, { target: { value: "7" } });
    fireEvent.click(applyButton);

    const assignments = onApply.mock.calls[0][0];
    expect(assignments).toEqual([
      { part: 2, number: 1, points: 3.5 },
      { part: 2, number: 2, points: 3.5 },
    ]);
  });
});

describe("PointsPanel — chia theo dãy câu", () => {
  it("chỉ gán cho các câu trong dãy", () => {
    const { container, onApply, totalInput, applyButton } = setup(TWO_PART);
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Pick a range"
      )!
    );
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[aria-label="From question"]')!,
      { target: { value: "3" } }
    );
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[aria-label="To question"]')!,
      { target: { value: "5" } }
    );
    fireEvent.change(totalInput, { target: { value: "1.5" } });
    fireEvent.click(applyButton);

    expect(onApply.mock.calls[0][0]).toEqual([
      { part: 1, number: 3, points: 0.5 },
      { part: 1, number: 4, points: 0.5 },
      { part: 1, number: 5, points: 0.5 },
    ]);
  });
});

describe("PointsPanel — từ chối thay vì ghi biểu điểm hỏng", () => {
  it("tổng không hợp lệ ⇒ báo lỗi, KHÔNG gọi onApply", () => {
    const { container, onApply, totalInput, applyButton } = setup(TWO_PART);
    fireEvent.change(totalInput, { target: { value: "0" } });
    fireEvent.click(applyButton);

    expect(onApply).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "greater than 0"
    );
  });

  it("dãy câu rỗng ⇒ báo lỗi, KHÔNG gọi onApply", () => {
    const { container, onApply, totalInput, applyButton } = setup(TWO_PART);
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Pick a range"
      )!
    );
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[aria-label="From question"]')!,
      { target: { value: "40" } }
    );
    fireEvent.change(
      container.querySelector<HTMLInputElement>('input[aria-label="To question"]')!,
      { target: { value: "50" } }
    );
    fireEvent.change(totalInput, { target: { value: "2" } });
    fireEvent.click(applyButton);

    expect(onApply).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe("PointsPanel — tổng điểm chạy", () => {
  it("in tổng hiện tại của CẢ ĐỀ trên thang 10", () => {
    const { container } = setup([question(1, 1, 3), question(1, 2, 4)]);
    expect(container.textContent).toContain("7/10");
  });

  it("câu chưa có điểm không được đếm thành 0 rồi cộng vào", () => {
    const { container } = setup([question(1, 1, 10), question(1, 2)]);
    expect(container.textContent).toContain("10/10");
  });
});

describe("PointsPanel — thu gọn trên mobile", () => {
  it("màn hẹp ⇒ thân panel đóng sẵn; bấm tiêu đề thì mở", () => {
    stubMatchMedia(false);
    const { container } = render(
      <PointsPanel questions={TWO_PART} parts={PARTS} onApply={vi.fn()} />
    );
    const body = container.querySelector("#points-panel-body")!;
    expect(body.hasAttribute("hidden")).toBe(true);

    fireEvent.click(container.querySelector('[aria-controls="points-panel-body"]')!);
    expect(body.hasAttribute("hidden")).toBe(false);
  });
});
