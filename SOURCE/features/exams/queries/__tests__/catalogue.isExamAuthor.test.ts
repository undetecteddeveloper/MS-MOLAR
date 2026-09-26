// isExamAuthor — features/exams/queries/catalogue.ts (community-solutions
// frontend task 21, Decision 2). Nguồn DUY NHẤT `SolutionViewPage` dùng để suy
// `SolutionMenu.isExamAuthor` (AC-077, gate ghim/bỏ ghim) — task 19's
// Investigation Notes: không cột nào trong `SolutionDetail`/`SolutionListItem`
// mang tín hiệu này.
//
// BIÊN MOCK: `server-only` (chặn build) + `@/lib/supabase/server` (client
// thật đầu kia là Postgres/RLS) — mã thật của `isExamAuthor` chạy nguyên vẹn.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const { isExamAuthor } = await import("@/features/exams/queries/catalogue");

const EXAM_ID = "E1";
const USER_ID = "11111111-2222-3333-4444-555555555555";

let userId: string | null;
let examRow: { id: string } | null;
let queryError: unknown;

function client() {
  return {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
    from: vi.fn((table: string) => {
      if (table !== "exams") throw new Error(`bảng ngoài dự kiến: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: examRow, error: queryError }),
            }),
          }),
        }),
      };
    }),
  };
}

beforeEach(() => {
  userId = USER_ID;
  examRow = null;
  queryError = null;
  createClientMock.mockImplementation(async () => client());
});

afterEach(() => {
  createClientMock.mockReset();
});

describe("isExamAuthor — chưa đăng nhập", () => {
  it("không đọc bảng exams, trả về false", async () => {
    userId = null;

    const result = await isExamAuthor(EXAM_ID);

    expect(result).toBe(false);
  });
});

describe("isExamAuthor — là tác giả đề", () => {
  it("hàng khớp cả id lẫn author_id: true", async () => {
    examRow = { id: EXAM_ID };

    const result = await isExamAuthor(EXAM_ID);

    expect(result).toBe(true);
  });
});

describe("isExamAuthor — không phải tác giả / đề không tồn tại", () => {
  it("0 dòng (RLS lọc, hoặc đề published của người khác): false — không phân biệt hai ca", async () => {
    examRow = null;

    const result = await isExamAuthor(EXAM_ID);

    expect(result).toBe(false);
  });
});

describe("isExamAuthor — lỗi truy vấn thật", () => {
  it("ném nguyên lỗi, không nuốt thành false", async () => {
    queryError = new Error("boom");

    await expect(isExamAuthor(EXAM_ID)).rejects.toThrow("boom");
  });
});
