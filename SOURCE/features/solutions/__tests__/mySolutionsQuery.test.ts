// getMySolutions() — bộ ánh xạ mỏng quanh RPC community_my_solutions (schema.sql
// §28, 2026-10-03). `.rpc()` mock ở biên Supabase client, nuôi bằng một hàng thô
// đúng hình dạng hàm SQL trả (snake_case) — cùng khuôn reputationQuery.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

const { getMySolutions } = await import("@/features/solutions/queries");

const RAW_ROW = {
  solution_id: "sol-1",
  exam_id: "exam-1",
  exam_title: "Đề Toán giữa kỳ",
  exam_subject: "Math",
  exam_grade: 10,
  status: "published",
  attempt_id: "att-1",
  updated_at: "2026-10-01T09:00:00.000Z",
  helpful_count: 4,
  exam_visible: true,
};

describe("getMySolutions", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("gọi .rpc đúng một lần, đúng tên hàm, KHÔNG tham số (không tra được bài của người khác)", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await getMySolutions();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("community_my_solutions");
  });

  it("ánh xạ snake_case → camelCase đủ mười trường, giữ nguyên thứ tự hàng", async () => {
    rpcMock.mockResolvedValue({
      data: [RAW_ROW, { ...RAW_ROW, solution_id: "sol-2", status: "draft", attempt_id: null, exam_visible: false }],
      error: null,
    });

    const result = await getMySolutions();

    expect(result).toEqual([
      {
        solutionId: "sol-1",
        examId: "exam-1",
        examTitle: "Đề Toán giữa kỳ",
        examSubject: "Math",
        examGrade: 10,
        status: "published",
        attemptId: "att-1",
        updatedAt: "2026-10-01T09:00:00.000Z",
        helpfulCount: 4,
        examVisible: true,
      },
      expect.objectContaining({ solutionId: "sol-2", status: "draft", attemptId: null, examVisible: false }),
    ]);
  });

  it("data null → mảng rỗng, không ném", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    expect(await getMySolutions()).toEqual([]);
  });

  it("lỗi RPC → NÉM (tab tự dựng băng lỗi cục bộ), không nuốt thành mảng rỗng", async () => {
    const error = { message: "boom", code: "XX000" };
    rpcMock.mockResolvedValue({ data: null, error });

    await expect(getMySolutions()).rejects.toBe(error);
  });
});
