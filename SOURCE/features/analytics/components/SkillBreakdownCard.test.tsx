// @vitest-environment jsdom

// SkillBreakdownCard [integration] — thẻ "Kết quả theo dạng bài" (2026-09-16).
//
// Cùng kỹ thuật với SkillRecommendationCard.test.tsx: render thật với từ điển
// thật (`t()` là bảng thuần, không cần next/headers), mọi truy vấn scope vào
// `container` của chính render() đó vì repo không cài auto-cleanup.
//
// Ba điều thẻ phải làm đúng, và mỗi điều có một ca:
//   1. hiện ĐỦ mọi môn/dạng bài nhận được, theo nhãn tiếng Việt của môn — thẻ
//      này là lý do cây kỹ năng mở ra 7 môn, một môn rơi là hỏng mục tiêu;
//   2. ô skillNodeId null hiện thành "Chưa phân loại" chứ không phải chuỗi
//      rỗng/"null"/crash — đây là ca đông nhất ngay sau khi ship (câu chưa
//      gắn thẻ, câu dưới ngưỡng tin cậy);
//   3. rỗng thì nói vì sao rỗng (chỉ có tự luận), không hiện thẻ trống.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillBreakdownCard } from "@/features/analytics/components/SkillBreakdownCard";
import type { SubjectSkillBreakdown } from "@/lib/analytics/skillBreakdown";

// Copy viết ĐỘC LẬP với lib/copy.ts — sửa lặng lẽ từ điển thì ca này đỏ.
const TITLE = "Kết quả theo dạng bài";
const UNTAGGED = "Chưa phân loại";
const EMPTY_COPY =
  "Các lượt trong khoảng này chỉ có câu tự luận — chưa có dạng bài nào để tính tỉ lệ đúng.";

const BREAKDOWN: SubjectSkillBreakdown[] = [
  {
    subject: "Math",
    skills: [
      { skillNodeId: "so-phuc", labelVi: "Số phức", correct: 1, total: 4, accuracy: 0.25 },
      { skillNodeId: null, labelVi: null, correct: 3, total: 3, accuracy: 1 },
    ],
  },
  {
    subject: "Physics",
    skills: [
      {
        skillNodeId: "ly-dong-hoc",
        labelVi: "Động học chất điểm",
        correct: 2,
        total: 2,
        accuracy: 1,
      },
    ],
  },
];

describe("SkillBreakdownCard", () => {
  it("hiện tiêu đề, mỗi môn một mục theo nhãn tiếng Việt, mỗi dạng bài một hàng với % và Đúng a/b", () => {
    const { container } = render(<SkillBreakdownCard breakdown={BREAKDOWN} />);
    const text = container.textContent ?? "";

    expect(text).toContain(TITLE);
    // Nhãn môn là tiếng Việt, không phải khoá "Math"/"Physics".
    expect(container.querySelectorAll("h3").length).toBe(2);
    expect([...container.querySelectorAll("h3")].map((h) => h.textContent)).toEqual([
      "Toán",
      "Vật lý",
    ]);
    expect(text).not.toMatch(/\bMath\b|\bPhysics\b/);

    expect(text).toContain("Số phức");
    expect(text).toContain("25%");
    expect(text).toContain("Đúng 1/4");
    expect(text).toContain("Động học chất điểm");
    expect(text).toContain("Đúng 2/2");

    // Mỗi hàng một progressbar, giá trị = % làm tròn.
    const bars = container.querySelectorAll('[role="progressbar"]');
    expect(bars.length).toBe(3);
    expect(bars[0].getAttribute("aria-valuenow")).toBe("25");
  });

  it("ô skillNodeId null hiện 'Chưa phân loại' và đứng cuối môn", () => {
    const { container } = render(<SkillBreakdownCard breakdown={BREAKDOWN} />);

    const mathRows = [...container.querySelectorAll("section ol")[0].querySelectorAll("li")];
    expect(mathRows.length).toBe(2);
    expect(mathRows[1].textContent).toContain(UNTAGGED);
    expect(mathRows[1].textContent).toContain("Đúng 3/3");
    expect(container.textContent).not.toContain("null");
  });

  it("rỗng → nói vì sao rỗng, không render mục môn nào", () => {
    const { container } = render(<SkillBreakdownCard breakdown={[]} />);

    expect(container.textContent).toContain(TITLE);
    expect(container.textContent).toContain(EMPTY_COPY);
    expect(container.querySelectorAll("h3").length).toBe(0);
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
  });
});
