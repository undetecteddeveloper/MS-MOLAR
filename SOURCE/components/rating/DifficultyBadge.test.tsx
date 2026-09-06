// @vitest-environment jsdom

// DifficultyBadge — hợp đồng (Rating System, theme "Sân trường"):
//  - communityDifficulty có giá trị → nhãn bucket tiếng Việt NGUYÊN VẸN từ
//    server (AC-018, không re-bucket); variant `detail` in thêm mean một chữ số
//    thập phân (formatMean), variant `card` giấu mean vào `title`.
//  - null/thiếu → "—", không ném (AC-015).
//  - CẢ HAI biến thể trả <span> nội tuyến và KHÔNG tự mang thẻ ngữ nghĩa nào.
//    Trước 2026-09-06 `detail` trả <dd> để cắm thẳng vào <dl> của trang chi
//    tiết đề; trang đó nay gom <dt>/<dd> về một component dòng dùng chung, nên
//    <dd> tự-mang rơi vào trong một <dd> khác — HTML sai, React báo lỗi
//    hydration. Ca kiểm "không tự mang <dd>" bên dưới giữ cho lỗi đó không quay
//    lại.

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
  });

  it("detail: nhãn + mean một chữ số thập phân", () => {
    const { container } = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Medium", mean: 4, count: 3 }}
        variant="detail"
      />
    );
    expect(container.firstElementChild?.textContent).toBe(`${MEDIUM}4.0`);
  });

  it("không biến thể nào tự mang <dd> — ngữ nghĩa <dl> do nơi gọi quyết định", () => {
    const detail = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Hard", mean: 7.2, count: 5 }}
        variant="detail"
      />
    );
    const card = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Hard", mean: 7.2, count: 5 }}
        variant="card"
      />
    );
    expect(detail.container.firstElementChild?.tagName).toBe("SPAN");
    expect(detail.container.querySelector("dd")).toBeNull();
    expect(card.container.querySelector("dd")).toBeNull();
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
    expect(container.firstElementChild?.textContent).toBe("—");
  });

  it("render đúng bucket server đưa xuống — không re-bucket từ mean (AC-018)", () => {
    // mean=2 sẽ ra "Easy" nếu tính lại ở client; component phải in "Khó".
    const { container } = render(
      <DifficultyBadge communityDifficulty={{ bucket: "Hard", mean: 2, count: 3 }} variant="card" />
    );
    expect(container.querySelector("span[title]")?.textContent).toBe(HARD);
    expect(container.querySelectorAll(".bg-primary").length).toBe(3);
  });

  it('detail: "—" tô màu dịu; có giá trị thì thừa hưởng màu của <dd> bọc ngoài', () => {
    const present = render(
      <DifficultyBadge
        communityDifficulty={{ bucket: "Easy", mean: 2.3, count: 5 }}
        variant="detail"
      />
    );
    expect(present.container.firstElementChild?.className).not.toContain("text-muted-foreground");
    expect(present.container.firstElementChild?.textContent).toContain(EASY);

    const absent = render(<DifficultyBadge communityDifficulty={null} variant="detail" />);
    expect(absent.container.firstElementChild?.className).toContain("text-muted-foreground");
  });
});
