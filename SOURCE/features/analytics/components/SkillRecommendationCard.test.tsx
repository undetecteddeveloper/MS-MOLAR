// @vitest-environment jsdom

// SkillRecommendationCard [component] — thẻ vàng "Nên luyện gì tiếp theo" cho 7 môn
// (brief docs/plans/20261003-feature-weak-skill-suggestions.md, AC-01/02/04/05/08/10;
// hướng B "Vàng chỉ khi có việc" do người dùng chọn từ prototype).
//
// Không mock gì: thẻ nhận `suggestions` đã tính sẵn (reducer thuần có test riêng ở
// lib/analytics/__tests__/weakSkillSuggestions.test.ts), `t()` và Chip/Card/Button
// là thật. Câu chữ kỳ vọng viết TAY ở đây, độc lập với từ điển, để một lần sửa
// copy.ts lặng lẽ không tự kéo test theo.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SUBJECT_ORDER } from "@/lib/analytics/constants";
import type { SubjectSuggestion } from "@/lib/analytics/weakSkillSuggestions";
import { SkillRecommendationCard } from "./SkillRecommendationCard";

afterEach(cleanup);

const CHIP_LABELS = ["Toán", "Vật lý", "Hóa học", "Sinh học", "Ngữ văn", "Tiếng Anh", "Lịch sử"];

function none(subject: SubjectSuggestion["subject"]): SubjectSuggestion {
  return { kind: "none", subject, reason: "no-data" };
}

/** Bảy môn: mặc định `no-data`, môn nào cần thì ghi đè. */
function suggestions(overrides: Partial<Record<SubjectSuggestion["subject"], SubjectSuggestion>> = {}) {
  return SUBJECT_ORDER.map((subject) => overrides[subject] ?? none(subject));
}

const HOA_SUGGEST: SubjectSuggestion = {
  kind: "suggest",
  subject: "Chemistry",
  skillNodeId: "hoa-can-bang-phan-ung",
  skillLabel: "Cân bằng phương trình phản ứng",
  correct: 1,
  total: 5,
  openExamCount: 2,
};

const LY_ALL_DONE: SubjectSuggestion = {
  kind: "none",
  subject: "Physics",
  reason: "all-done",
  skillLabel: "Động học chất điểm",
  correct: 2,
  total: 6,
};

const SINH_NO_EXAM: SubjectSuggestion = {
  kind: "none",
  subject: "Biology",
  reason: "no-exam",
  skillLabel: "Di truyền quần thể",
  correct: 0,
  total: 3,
};

const TOAN_NO_WEAK: SubjectSuggestion = { kind: "none", subject: "Math", reason: "no-weak" };

function chip(label: string) {
  return screen.getByRole("button", { name: label });
}

function card() {
  return screen.getByRole("region", { name: "Nên luyện gì tiếp theo" });
}

describe("SkillRecommendationCard — hàng chip môn (AC-01)", () => {
  it("đủ 7 chip, nhãn tiếng Việt, đúng thứ tự SUBJECT_ORDER, vùng chạm cao 44px", () => {
    render(<SkillRecommendationCard suggestions={suggestions()} />);

    const chips = screen.getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(CHIP_LABELS);
    // h-11 = 44px (Chip mặc định 40px thấp hơn sàn vùng chạm của repo).
    for (const c of chips) expect(c.className).toContain("h-11");
  });

  it("mở sẵn môn đầu tiên CÓ gợi ý, không phải môn đầu danh sách", () => {
    render(
      <SkillRecommendationCard suggestions={suggestions({ Math: TOAN_NO_WEAK, Chemistry: HOA_SUGGEST })} />,
    );

    expect(chip("Hóa học").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Toán").getAttribute("aria-pressed")).toBe("false");
  });

  it("không môn nào có gợi ý → mở môn đầu tiên đã có dữ liệu; chưa có gì → Toán", () => {
    const { unmount } = render(
      <SkillRecommendationCard suggestions={suggestions({ Biology: SINH_NO_EXAM })} />,
    );
    expect(chip("Sinh học").getAttribute("aria-pressed")).toBe("true");
    unmount();

    render(<SkillRecommendationCard suggestions={suggestions()} />);
    expect(chip("Toán").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("SkillRecommendationCard — có gợi ý (AC-04, AC-05)", () => {
  it("in NGUYÊN VĂN nhãn dạng yếu, đúng a/b, phần trăm, số đề chưa làm", () => {
    render(<SkillRecommendationCard suggestions={suggestions({ Chemistry: HOA_SUGGEST })} />);

    expect(card().textContent).toContain("Cân bằng phương trình phản ứng");
    expect(card().textContent).toContain("Đúng 1/5 câu (20%) · Còn 2 đề chưa làm");
  });

  it("nút 'Tìm đề dạng này' dẫn tới Kho đề lọc CẢ môn lẫn dạng bài", () => {
    render(<SkillRecommendationCard suggestions={suggestions({ Chemistry: HOA_SUGGEST })} />);

    const link = screen.getByRole("link", { name: "Tìm đề dạng này" });
    expect(link.getAttribute("href")).toBe("/exams?subject=Chemistry&skill=hoa-can-bang-phan-ung");
  });

  it("thẻ VÀNG khi có việc (hướng B)", () => {
    render(<SkillRecommendationCard suggestions={suggestions({ Chemistry: HOA_SUGGEST })} />);

    expect(card().className).toContain("bg-sun-soft");
  });
});

describe("SkillRecommendationCard — không có gì để luyện (AC-02)", () => {
  it("đã làm hết đề: nêu dạng yếu và lý do, KHÔNG có nút, thẻ đổi sang trung tính", () => {
    render(<SkillRecommendationCard suggestions={suggestions({ Physics: LY_ALL_DONE })} />);

    expect(card().textContent).toContain("Không có gì để luyện");
    expect(card().textContent).toContain(
      "Dạng “Động học chất điểm” còn yếu (đúng 2/6 câu), nhưng bạn đã làm hết các đề có dạng này. Khi có đề mới chứa dạng này, nó sẽ hiện ở đây.",
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(card().className).not.toContain("bg-sun-soft");
    expect(card().className).toContain("bg-card");
  });

  it("không có đề nào chứa dạng yếu: lý do riêng, khác 'đã làm hết', không nút", () => {
    render(<SkillRecommendationCard suggestions={suggestions({ Biology: SINH_NO_EXAM })} />);

    expect(card().textContent).toContain(
      "Dạng “Di truyền quần thể” còn yếu (đúng 0/3 câu), nhưng hiện chưa có đề nào chứa dạng này.",
    );
    expect(card().textContent).not.toContain("đã làm hết");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("không yếu dạng nào: nói ngưỡng 70% lấy từ hằng số, không nút", () => {
    render(<SkillRecommendationCard suggestions={suggestions({ Math: TOAN_NO_WEAK })} />);

    expect(card().textContent).toContain(
      "Mọi dạng bài bạn đã làm ở môn này đều đúng từ 70% trở lên.",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("chưa có dữ liệu: lý do + MỘT liên kết chữ tới đề của môn, không phải nút lớn", () => {
    render(<SkillRecommendationCard suggestions={suggestions()} />);

    expect(card().textContent).toContain(
      "Bạn chưa làm câu nào đã gắn dạng bài ở môn này, nên chưa biết dạng nào còn yếu.",
    );
    const link = screen.getByRole("link", { name: "Xem đề Toán" });
    expect(link.getAttribute("href")).toBe("/exams?subject=Math");
    expect(link.className).toContain("min-h-11");
    expect(screen.queryByRole("link", { name: "Tìm đề dạng này" })).toBeNull();
  });
});

describe("SkillRecommendationCard — bấm chip đổi môn tại chỗ", () => {
  it("chuyển trạng thái, chip, màu thẻ theo môn vừa chọn; bấm lại môn cũ trả nội dung cũ", () => {
    render(
      <SkillRecommendationCard
        suggestions={suggestions({ Chemistry: HOA_SUGGEST, Physics: LY_ALL_DONE })}
      />,
    );
    expect(card().textContent).toContain("Cân bằng phương trình phản ứng");
    expect(card().className).toContain("bg-sun-soft");

    fireEvent.click(chip("Vật lý"));
    expect(chip("Vật lý").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Hóa học").getAttribute("aria-pressed")).toBe("false");
    expect(card().textContent).toContain("Không có gì để luyện");
    expect(card().textContent).not.toContain("Cân bằng phương trình phản ứng");
    expect(card().className).not.toContain("bg-sun-soft");

    fireEvent.click(chip("Hóa học"));
    expect(card().textContent).toContain("Cân bằng phương trình phản ứng");
    expect(card().className).toContain("bg-sun-soft");
  });

  it("vùng nội dung là aria-live=polite để trình đọc màn hình nghe được môn mới", () => {
    render(<SkillRecommendationCard suggestions={suggestions()} />);

    expect(card().querySelector("[aria-live='polite']")).not.toBeNull();
  });
});

describe("SkillRecommendationCard — không lộ khoá kỹ thuật (AC-10)", () => {
  it("bảy môn ở cả bảy trạng thái: màn hình không có khoá môn tiếng Anh, id dạng bài hay khoá copy", () => {
    const all = suggestions({
      Math: TOAN_NO_WEAK,
      Physics: LY_ALL_DONE,
      Chemistry: HOA_SUGGEST,
      Biology: SINH_NO_EXAM,
    });
    render(<SkillRecommendationCard suggestions={all} />);

    for (const label of CHIP_LABELS) {
      fireEvent.click(chip(label));
      const text = card().textContent ?? "";
      expect(text).not.toMatch(/Math|Physics|Chemistry|Biology|Literature|English|History/);
      expect(text).not.toContain("hoa-can-bang-phan-ung");
      expect(text).not.toContain("analytics.");
    }
  });
});
