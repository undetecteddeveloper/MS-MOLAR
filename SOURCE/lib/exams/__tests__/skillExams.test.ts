// readExamsBySkill [unit] — lib/exams/skillExams.ts (brief 20261003 AC-04/05/06:
// thẻ gợi ý ở Thống kê và lưới Kho đề `?skill=` dùng CHUNG một phép nối "dạng
// bài → đề chứa nó").
//
// Client Supabase do chỗ gọi đưa vào nên KHÔNG cần mock module nào. Query
// builder giả ghi lại mọi bước chain (bảng, `.in`, `.eq`, `.overlaps`) để ghim
// đúng bộ lọc gửi đi; dữ liệu trả về lấy từ fixture theo bảng; `.limit()` là
// điểm await của `readBounded`, nên mock nằm đúng chỗ đó.

import { beforeEach, describe, expect, it } from "vitest";
import { readExamsBySkill } from "../skillExams";

type Op = [method: string, args: unknown[]];
interface Call {
  table: string;
  ops: Op[];
}

let calls: Call[];
let questionRows: { id: string; skill_node_id: string | null }[];
/** Mỗi lệnh đọc `exams` lấy một phần tử, theo thứ tự gọi (một lô = một lệnh). */
let examBatches: { id: string; subject: string; question_ids: string[] | null }[][];
let examsError: { message: string } | null;

function fakeSupabase() {
  let examCall = 0;
  return {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "in", "eq", "overlaps"]) {
        builder[method] = (...args: unknown[]) => {
          call.ops.push([method, args]);
          return builder;
        };
      }
      builder.limit = async () => {
        if (table === "questions") return { data: questionRows, error: null };
        if (table === "exams") {
          return { data: examBatches[examCall++] ?? [], error: examsError };
        }
        throw new Error(`bảng ngoài dự kiến: ${table}`);
      };
      return builder;
    },
  } as unknown as Parameters<typeof readExamsBySkill>[0];
}

beforeEach(() => {
  calls = [];
  questionRows = [];
  examBatches = [];
  examsError = null;
});

describe("readExamsBySkill — hình dạng kết quả", () => {
  it("không có dạng nào → map rỗng, KHÔNG gọi DB", async () => {
    const result = await readExamsBySkill(fakeSupabase(), []);

    expect(result.size).toBe(0);
    expect(calls).toEqual([]);
  });

  it("dạng không có câu nào → khoá vẫn có, mảng rỗng, không đọc bảng exams", async () => {
    questionRows = [];

    const result = await readExamsBySkill(fakeSupabase(), ["a", "b"]);

    expect(result.get("a")).toEqual([]);
    expect(result.get("b")).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(["questions"]);
  });

  it("phân đề về đúng dạng: đề chứa câu của hai dạng xuất hiện ở CẢ HAI, đề chỉ chứa dạng khác thì không", async () => {
    questionRows = [
      { id: "q1", skill_node_id: "a" },
      { id: "q2", skill_node_id: "b" },
    ];
    examBatches = [
      [
        { id: "E-both", subject: "Math", question_ids: ["q1", "q2", "q-khac"] },
        { id: "E-a", subject: "Math", question_ids: ["q1"] },
        { id: "E-b", subject: "Physics", question_ids: ["q2"] },
      ],
    ];

    const result = await readExamsBySkill(fakeSupabase(), ["a", "b"]);

    expect(result.get("a")).toEqual([
      { id: "E-both", subject: "Math" },
      { id: "E-a", subject: "Math" },
    ]);
    expect(result.get("b")).toEqual([
      { id: "E-both", subject: "Math" },
      { id: "E-b", subject: "Physics" },
    ]);
  });

  it("một đề chứa NHIỀU câu cùng dạng chỉ được đếm một lần", async () => {
    questionRows = [
      { id: "q1", skill_node_id: "a" },
      { id: "q2", skill_node_id: "a" },
    ];
    examBatches = [[{ id: "E1", subject: "Math", question_ids: ["q1", "q2"] }]];

    const result = await readExamsBySkill(fakeSupabase(), ["a"]);

    expect(result.get("a")).toEqual([{ id: "E1", subject: "Math" }]);
  });

  it("câu có skill_node_id null bị bỏ, không rò vào kết quả hay vào bộ lọc overlaps", async () => {
    questionRows = [
      { id: "q1", skill_node_id: null },
      { id: "q2", skill_node_id: "a" },
    ];
    examBatches = [[{ id: "E1", subject: "Math", question_ids: ["q1", "q2"] }]];

    const result = await readExamsBySkill(fakeSupabase(), ["a"]);

    expect(result.get("a")).toEqual([{ id: "E1", subject: "Math" }]);
    const overlaps = calls[1].ops.find(([m]) => m === "overlaps")!;
    expect(overlaps[1]).toEqual(["question_ids", ["q2"]]);
  });

  it("đề có question_ids null (dữ liệu hỏng) không làm vỡ phép nối", async () => {
    questionRows = [{ id: "q1", skill_node_id: "a" }];
    examBatches = [[{ id: "E-null", subject: "Math", question_ids: null }]];

    const result = await readExamsBySkill(fakeSupabase(), ["a"]);

    expect(result.get("a")).toEqual([]);
  });
});

describe("readExamsBySkill — bộ lọc gửi đi", () => {
  it("đọc câu theo skill_node_id, đọc đề CHỈ published và overlaps với id câu", async () => {
    questionRows = [{ id: "q1", skill_node_id: "a" }];
    examBatches = [[]];

    await readExamsBySkill(fakeSupabase(), ["a", "b"]);

    expect(calls[0]).toMatchObject({ table: "questions" });
    expect(calls[0].ops).toContainEqual(["in", ["skill_node_id", ["a", "b"]]]);
    expect(calls[1]).toMatchObject({ table: "exams" });
    expect(calls[1].ops).toContainEqual(["eq", ["status", "published"]]);
    expect(calls[1].ops).toContainEqual(["overlaps", ["question_ids", ["q1"]]]);
  });

  it("250 câu → 3 lệnh đọc đề (100/100/50), URL không dài vô hạn", async () => {
    questionRows = Array.from({ length: 250 }, (_, i) => ({ id: `q${i}`, skill_node_id: "a" }));
    examBatches = [[], [], []];

    await readExamsBySkill(fakeSupabase(), ["a"]);

    const examCalls = calls.filter((c) => c.table === "exams");
    const sizes = examCalls.map((c) => {
      const overlaps = c.ops.find(([m]) => m === "overlaps")!;
      return (overlaps[1] as [string, string[]])[1].length;
    });
    expect(sizes).toEqual([100, 100, 50]);
  });

  it("đề rơi vào hai lô được gộp theo id (không đếm đôi)", async () => {
    questionRows = Array.from({ length: 150 }, (_, i) => ({ id: `q${i}`, skill_node_id: "a" }));
    const exam = { id: "E1", subject: "Math", question_ids: ["q0", "q149"] };
    examBatches = [[exam], [exam]];

    const result = await readExamsBySkill(fakeSupabase(), ["a"]);

    expect(result.get("a")).toEqual([{ id: "E1", subject: "Math" }]);
  });

  it("lỗi hạ tầng khi đọc đề được ném nguyên, không nuốt thành 'không có đề'", async () => {
    questionRows = [{ id: "q1", skill_node_id: "a" }];
    examBatches = [[]];
    examsError = { message: "boom" };

    await expect(readExamsBySkill(fakeSupabase(), ["a"])).rejects.toMatchObject({
      message: "boom",
    });
  });
});
