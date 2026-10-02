import { describe, expect, it } from "vitest";
import { groupQuestionsByPart } from "@/lib/exams/questionGroups";

describe("groupQuestionsByPart", () => {
  it("đề một phần hoặc không có dữ liệu phần → undefined (bảng rơi về lưới phẳng)", () => {
    expect(groupQuestionsByPart([{}, {}, {}])).toBeUndefined();
    expect(groupQuestionsByPart([{ partNumber: 1 }, { partNumber: 1 }])).toBeUndefined();
    expect(groupQuestionsByPart([])).toBeUndefined();
  });

  it("đề nhiều phần → một mục mỗi phần theo thứ tự xuất hiện, indices vào chính mảng câu", () => {
    const groups = groupQuestionsByPart(
      [{ partNumber: 1 }, { partNumber: 1 }, { partNumber: 2 }, { partNumber: 3 }, { partNumber: 3 }],
      [
        { number: 1, title: "PHẦN I. Trắc nghiệm" },
        { number: 2, title: "PHẦN II. Đúng sai" },
      ]
    );

    expect(groups).toEqual([
      { title: "PHẦN I. Trắc nghiệm", indices: [0, 1] },
      { title: "PHẦN II. Đúng sai", indices: [2] },
      { title: "Phần 3", indices: [3, 4] },
    ]);
  });

  it("câu không khai phần được coi là phần 1; phần không có tiêu đề dùng 'Phần n'", () => {
    const groups = groupQuestionsByPart([{}, { partNumber: 2 }]);

    expect(groups).toEqual([
      { title: "Phần 1", indices: [0] },
      { title: "Phần 2", indices: [1] },
    ]);
  });
});
