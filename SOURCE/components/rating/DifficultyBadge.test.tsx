// @vitest-environment jsdom

// DifficultyBadge — hợp đồng (Rating System, theme "Sân trường" 2026-09-04):
//  - communityDifficulty có giá trị → nhãn bucket tiếng Việt NGUYÊN VẸN từ
//    server (AC-018, không re-bucket); variant `detail` in thêm mean một chữ số
//    thập phân (formatMean).
//  - null/thiếu → "—", không ném (AC-015).
//  - `card` trả <span> (nằm trong hàng meta của ExamCard), `detail` trả <dd>
//    (khớp <dl> của trang chi tiết đề).

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { DifficultyBadge } from "./DifficultyBadge";

const HARD = copy["exams.levelHard"];
const MEDIUM = copy["exams.levelMedium"];
const EASY = copy["exams.levelEasy"];

describe("DifficultyBadge", () => {
  it("card: nhãn bucket, không kèm mean (mean nằm trong title)", () => {
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Hard", mean: 7.2, count: 5 }}
        variant="card"
      />
    );
    const el = container.querySelector("span[title]");
    expect(el?.textContent).toBe(HARD);
    expect(el?.getAttribute("title")).toBe(`${HARD} 7.2`);
    expect(container.querySelector("dd")).toBeNull();
  });

  it("detail: nhãn + mean một chữ số thập phân, trong <dd>", () => {
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Medium", mean: 4, count: 3 }}
        variant="detail"
      />
    );
    expect(container.querySelector("dd")?.textContent).toBe(`${MEDIUM}4.0`);
  });

  it("thang 3 vạch: Dễ 1, Trung bình 2, Khó 3 vạch tô", () => {
    const steps = (bucket: "Easy" | "Medium" | "Hard") => {
      const { container } = render(
        <DifficultyBadge communityDifficulty={{ bucket, mean: 5, count: 3 }} variant="card" />
      );
      return container.querySelectorAll(".bg-primary").length;
    };
    expect(steps("Easy")).toBe(1);
    expect(steps("Medium")).toBe(2);
    expect(steps("Hard")).toBe(3);
  });

  it('null → "—" (card), không ném', () => {
    const { container } = render(<DifficultyBadge communityDifficulty={null} variant="card" />);
    expect(container.querySelector("span[class*='inline-flex']")?.textContent).toBe("—");
    expect(container.querySelectorAll(".bg-primary").length).toBe(0);
  });

  it('undefined → "—" (detail), không ném', () => {
    let container!: HTMLElement;
    expect(() => {
      container = render(
        <DifficultyBadge communityDifficulty={undefined} variant="detail" />
      ).container;
    }).not.toThrow();
    expect(container.querySelector("dd")?.textContent).toBe("—");
  });

  it("render đúng bucket server đưa xuống — không re-bucket từ mean (AC-018)", () => {
    // mean=2 sẽ ra "Easy" nếu tính lại ở client; component phải in "Khó".
    const { container } = render(
      <DifficultyBadge communityDifficulty={{ bucket: "Hard", mean: 2, count: 3 }} variant="card" />
    );
    expect(container.querySelector("span[title]")?.textContent).toBe(HARD);
    expect(container.querySelectorAll(".bg-primary").length).toBe(3);
  });

  it('detail: text-foreground khi có giá trị, text-muted-foreground khi "—"', () => {
    const present = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Easy", mean: 2.3, count: 5 }}
        variant="detail"
      />
    );
    expect(present.container.querySelector("dd")?.className).toContain("text-foreground");
    expect(present.container.querySelector("dd")?.textContent).toContain(EASY);

    const absent = render(<DifficultyBadge communityDifficulty={null} variant="detail" />);
    expect(absent.container.querySelector("dd")?.className).toContain("text-muted-foreground");
  });
});
