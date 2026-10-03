// listExamIdsBySkill / getSkillLabel — features/exams/queries/skill.ts: phần
// RIÊNG của Kho đề trong bộ lọc `?skill=` (brief 20261003 AC-06/07). Phép nối
// "dạng bài → đề chứa nó" được test ở lib/exams/__tests__/skillExams.test.ts.
//
// BIÊN MOCK: `server-only` + `@/lib/supabase/server` (client thật đầu kia là
// Postgres/RLS). Query builder giả: `.limit()` là điểm await của `readBounded`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const { listExamIdsBySkill, getSkillLabel } = await import("@/features/exams/queries/skill");

type Op = [method: string, args: unknown[]];
interface Call {
  table: string;
  ops: Op[];
}

let calls: Call[];
let questionRows: { id: string; skill_node_id: string | null }[];
let examRows: { id: string; subject: string; question_ids: string[] | null }[];
let skillNodeRow: { label_vi: string } | null;
let skillNodeError: { message: string } | null;

function client() {
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
      builder.limit = async () => ({
        data: table === "questions" ? questionRows : examRows,
        error: null,
      });
      builder.maybeSingle = async () => ({ data: skillNodeRow, error: skillNodeError });
      return builder;
    },
  };
}

beforeEach(() => {
  calls = [];
  questionRows = [];
  examRows = [];
  skillNodeRow = null;
  skillNodeError = null;
  createClientMock.mockReset();
  createClientMock.mockImplementation(async () => client());
});

describe("listExamIdsBySkill", () => {
  it("trả id các đề chứa dạng, theo thứ tự đọc", async () => {
    questionRows = [{ id: "q1", skill_node_id: "a" }];
    examRows = [
      { id: "E2", subject: "Math", question_ids: ["q1"] },
      { id: "E1", subject: "Math", question_ids: ["q1"] },
    ];

    const ids = await listExamIdsBySkill(await createClientMock(), "a");

    expect(ids).toEqual(["E2", "E1"]);
  });

  it("không đề nào chứa → mảng rỗng (fetchExamRows trả rỗng ngay, không gọi .in('id', []))", async () => {
    questionRows = [];

    const ids = await listExamIdsBySkill(await createClientMock(), "a");

    expect(ids).toEqual([]);
  });
});

describe("getSkillLabel", () => {
  it("trả label_vi của dạng bài", async () => {
    skillNodeRow = { label_vi: "Hàm số bậc hai" };

    expect(await getSkillLabel("ham-so-bac-hai")).toBe("Hàm số bậc hai");
    expect(calls[0].table).toBe("skill_nodes");
    expect(calls[0].ops).toContainEqual(["eq", ["id", "ham-so-bac-hai"]]);
  });

  it("id không tồn tại / RLS không cho đọc → null", async () => {
    skillNodeRow = null;

    expect(await getSkillLabel("khong-co")).toBeNull();
  });

  it("lỗi truy vấn được ném nguyên", async () => {
    skillNodeError = { message: "boom" };

    await expect(getSkillLabel("a")).rejects.toMatchObject({ message: "boom" });
  });
});
