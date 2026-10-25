// Rating System [integration] Bộ khung test
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
// Sinh ngày: 2026-07-24 | Ngân sách đã dùng: integration 3/3, fixture-e2e 2/3, service-integration-e2e 2/2
//
// Test 2 đã chuyển thành vitest thật (backend task 4). Test 1 vẫn chỉ là
// skeleton cho tới task cài đặt riêng của nó; file này giữ xanh
// dưới tsc/eslint/build cho tới khi được chuyển đổi.
//
// Test 3 (RatingEntry — dialog tự mở ?rate=auto ở trang kết quả) đã bị
// xoá 2026-07-27: nút đánh giá của trang Kết quả giờ điều hướng thẳng
// tới trang độc lập /exams/[id]/rate thay vì mở popup ở đó,
// nên RatingEntry/dialog/dấu ?rate=auto mà nó test không còn tồn tại.
// Đó cũng là lý do môi trường của file này quay lại từ jsdom về node thuần và
// @testing-library/react + mock next/navigation nó cần đã biến mất —
// không còn gì trong file này render một component.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// queries.ts import "server-only" (ném lỗi ngoài bundle server Next/react-server)
// → stub, cùng mẫu với SOURCE/lib/ugc/__tests__/extractMeta.test.ts.
vi.mock("server-only", () => ({}));

// Ranh giới mock: chỉ client Supabase (Test Boundaries của backend DD) — chứng minh cách dựng
// lời gọi JS; ngữ nghĩa NULL/thứ tự/khoảng của Postgres thật được phủ bởi spike của Task 1
// (S1-S4) và SE2 của Task 9-backend, không phải bởi mock này.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

const { listExams, listExamsRanked } = await import("@/features/exams/queries");
const { rateExam, getMyRating } = await import("@/features/exams/actions");

type BuilderCall = { method: string; args: unknown[] };

/** Giả có thể xích chuỗi và await được, phản chiếu bề mặt query-builder Supabase mà listExams dùng. */
function createQueryBuilder(result: { data: unknown[]; error: null }) {
  const calls: BuilderCall[] = [];
  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  // "limit": các lệnh đọc danh sách đi qua `readBounded` (P3), nó áp biên bằng
  // .limit() trước khi await builder.
  for (const method of ["select", "eq", "gte", "lt", "ilike", "order", "limit"]) {
    builder[method] = chain(method);
  }
  builder.then = (onFulfilled: (value: typeof result) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

// =============================================================================
// Test 1 — rateExam: cổng kiểm tra hợp lệ, hình dạng lời gọi upsert, ánh xạ lỗi không rò rỉ
// =============================================================================
// AC-002: "...mỗi giá trị được chấp nhận là số nguyên trong [1, 5] và một giá trị ngoài
//   khoảng đó hoặc không nguyên thì không gửi được."
// AC-012: "...hàng đánh giá sẵn có của họ được cập nhật tại chỗ (không tạo hàng thứ hai)
//   và ba điểm mới thay thế ba điểm cũ."
// AC-025: "...người dùng thấy một thông báo hành động được và ba điểm họ đã nhập được
//   giữ lại để thử lại."
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
// Hành vi: rateExam(examId, scores) được gọi trên ranh giới client Supabase mock
//   -> isValidPartScore chạy trước mọi lời gọi DB -> một lời gọi hợp lệ phát một
//   upsert khoá theo (exam_id, user_id) -> một lỗi DB giả lập được ánh xạ thành một
//   object trạng thái, không bao giờ là lỗi thô/rò rỉ.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/actions.ts (rateExam) + client Supabase mock
//   (ranh giới createClient())
// @complexity: medium
// @real-dependency: không có — client Supabase là ranh giới mock được phê duyệt theo
//   Test Boundaries của backend Design Doc ("Supabase client bên trong rateExam — Có (mock);
//   đường ghi thật được phủ bởi bộ RLS"). Việc kiểm hợp lệ và luồng điều khiển của chính rateExam
//   chạy thật; chỉ lời gọi mạng/DB bị stub.
// Kiểu hỏng chính: một điểm phần không nguyên hoặc ngoài khoảng tới được lời gọi
//   upsert; HOẶC một lỗi DB giả lập làm rò chi tiết lỗi Supabase thô cho người gọi thay vì
//   { error: "server" } đã ánh xạ; HOẶC một lần đánh giá lại phát INSERT trần thay vì
//   upsert khoá theo (exam_id, user_id).
// Nghĩa vụ chứng minh:
//   (a) một lời gọi có bất kỳ điểm phần không nguyên hoặc ngoài [1,5] resolve thành
//       { error: "invalid" } và upsert của client mock không bao giờ được gọi (AC-002);
//   (b) một lời gọi có ba điểm hợp lệ gọi upsert(..., { onConflict: "exam_id,user_id" })
//       đúng một lần, với score_part1/2/3 ánh xạ từ partI/partII/partIII (AC-012);
//   (c) một lỗi Supabase giả lập ở upsert resolve thành đúng { error: "server" } —
//       khẳng định object trả về không có khoá nào khác và không chứa
//       message/code của lỗi mock (AC-025, ánh xạ không rò rỉ).

describe("rateExam — validation gate, upsert call shape, non-leaking error mapping (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  const validScores = { partI: 4, partII: 3, partIII: 5 };

  // Khoá rate-limit lấy từ chính dòng attempt của precheck. Mỗi test dùng một
  // id RIÊNG (ngẫu nhiên) để bộ đếm in-memory của lib/security/rateLimit không
  // rò rỉ giữa các case — cả file chạy trong cùng một tiến trình.
  const RATER_ID = `rater-${Math.random().toString(36).slice(2)}`;

  /** Nối fromMock để bước kiểm trước điều kiện (exam_attempts) thấy một lượt làm
   * đã nộp và upsert (exam_difficulty_ratings) resolve qua upsertMock.
   *
   * 2026-08-03 (Security review Low): bước kiểm trước đổi từ truy vấn count-head
   * sang `.select("user_id").limit(1).maybeSingle()`. Vẫn cùng một lượt khứ hồi, nhưng nay
   * còn cho ra khoá rate-limit — phương án khác là thêm một lời gọi mạng
   * `auth.getUser()` ở mỗi lần đánh giá. Ngữ nghĩa đủ điều kiện không đổi:
   * có hàng là đủ điều kiện, null là không. */
  function mockEligibleWithUpsert(upsertMock: ReturnType<typeof vi.fn>) {
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { user_id: RATER_ID }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "exam_difficulty_ratings") {
        return { upsert: upsertMock };
      }
      throw new Error(`unexpected table: ${table}`);
    });
  }

  it("obligation (a): a non-integer or out-of-range part score resolves to {error:'invalid'} without touching the Supabase client (AC-002)", async () => {
    const outOfRange = await rateExam("exam-1", { partI: 6, partII: 5, partIII: 5 });
    expect(outOfRange).toEqual({ error: "invalid" });

    const nonInteger = await rateExam("exam-1", { partI: 2.5, partII: 5, partIII: 5 });
    expect(nonInteger).toEqual({ error: "invalid" });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("obligation (b): three valid scores invoke upsert(..., {onConflict:'exam_id,user_id'}) exactly once with score_part1/2/3 mapped from partI/partII/partIII (AC-012)", async () => {
    const upsertMock = vi.fn(async () => ({ error: null }));
    mockEligibleWithUpsert(upsertMock);

    const result = await rateExam("exam-1", validScores);

    expect(result).toEqual({});
    expect(upsertMock).toHaveBeenCalledTimes(1);
    // Khớp chính xác (không phải objectContaining): chứng minh user_id vắng trong payload
    // (DB tự đặt mặc định auth.uid(), không bao giờ lấy từ đầu vào — backend DD Security
    // Considerations). objectContaining sẽ để một user_id do client cung cấp bị rò
    // lọt qua khẳng định này mà không bị phát hiện.
    expect(upsertMock).toHaveBeenCalledWith(
      { exam_id: "exam-1", score_part1: 4, score_part2: 3, score_part3: 5 },
      { onConflict: "exam_id,user_id" }
    );
  });

  it("obligation (c): a simulated Supabase error on upsert resolves to exactly {error:'server'} with no leaked message/code (AC-025)", async () => {
    const upsertMock = vi.fn(async () => ({
      error: { code: "23503", message: "secret constraint detail" },
    }));
    mockEligibleWithUpsert(upsertMock);

    const result = await rateExam("exam-1", validScores);

    expect(result).toEqual({ error: "server" });
    expect(Object.keys(result)).toEqual(["error"]);
    expect(JSON.stringify(result)).not.toContain("secret constraint detail");
    expect(JSON.stringify(result)).not.toContain("23503");
  });

  // AC-003 (backend DD Data Contracts, rateExam): bước kiểm trước điều kiện (có
  //   lượt làm đã nộp) -> nếu không thì { error: "ineligible" } (UX; RLS with-check
  //   vẫn là cổng có thẩm quyền theo ADR-0008 Decision 3 — không được phủ bởi
  //   nghĩa vụ (a)-(c) của skeleton, thêm để kiểm tuân thủ Binding Decision).
  // Hành vi: rateExam(examId, validScores) được gọi với count exam_attempts mock
  //   bằng 0 (không có lượt làm đã nộp) -> bước kiểm trước cắt ngắn trước mọi lời gọi
  //   upsert.
  // @category: edge-case
  // @dependency: SOURCE/features/exams/actions.ts (rateExam) + client Supabase
  //   mock (ranh giới createClient())
  it("no submitted attempt resolves to {error:'ineligible'} without invoking upsert (backend DD eligibility precheck; UX-only, RLS remains authoritative)", async () => {
    const upsertMock = vi.fn();
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_attempts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                // Không có lượt làm đã nộp → maybeSingle() cho null (trước đây là count:0).
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "exam_difficulty_ratings") {
        return { upsert: upsertMock };
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const result = await rateExam("exam-1", validScores);

    expect(result).toEqual({ error: "ineligible" });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

// AC-013: "...getMyRating(examId) trả về ba điểm hiện đang lưu của họ (hoặc
//   null nếu chưa có)..." — không nằm trong nghĩa vụ chứng minh (a)-(c) của Test 1 trong skeleton;
//   thêm theo Proof Obligations của task này (suy ra từ AC-013).
// Hành vi: getMyRating(examId) được gọi trên ranh giới client Supabase mock
//   -> chỉ đọc hàng của chính người gọi (phạm vi RLS ratings_select_own) ->
//   ánh xạ score_part1/2/3 thành partI/partII/partIII, hoặc trả null nếu vắng, hoặc
//   ném lỗi khi hạ tầng hỏng (ranh giới Server Component, nhất quán với getExam).
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/actions.ts (getMyRating) + client Supabase
//   mock (ranh giới createClient())
// @real-dependency: không có — cùng ranh giới mock được phê duyệt như rateExam; việc cô lập
//   select-own giữa các người dùng được chứng minh bởi bộ RLS của Task 2 (R-u), không phải test này.
describe("getMyRating — caller's own three stored scores, or null (Test 1 extension, AC-013)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  function mockRow(row: { score_part1: number; score_part2: number; score_part3: number } | null) {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    });
  }

  it("returns {partI,partII,partIII} mapped from score_part1/2/3 when a row exists", async () => {
    mockRow({ score_part1: 4, score_part2: 3, score_part3: 5 });

    const result = await getMyRating("exam-1");

    expect(result).toEqual({ partI: 4, partII: 3, partIII: 5 });
  });

  it("returns null when the caller has not rated this exam", async () => {
    mockRow(null);

    const result = await getMyRating("exam-1");

    expect(result).toBeNull();
  });

  it("throws on infrastructure error instead of swallowing it", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: "500", message: "infra failure" },
          }),
        }),
      }),
    });

    await expect(getMyRating("exam-1")).rejects.toBeTruthy();
  });
});

// =============================================================================
// Test 2 — listExams: dựng truy vấn sắp xếp Khó nhất và lọc theo Mức
// =============================================================================
// AC-017: "...nó trình bày ba nhóm thật Dễ / Vừa / Khó (không phải panel
//   biểu tượng 'Sắp có')."
// AC-019/AC-020: "...đề đã được đánh giá xuất hiện trước, xếp theo độ khó cộng đồng
//   giảm dần, và mọi đề dưới ngưỡng xuất hiện sau chúng theo một thứ tự xác định
//   (theo created_at/id)... phân định hoà theo created_at/id."
// AC-021: "...nó chỉ chứa các đề có độ khó cộng đồng >= 3 lượt đánh giá và
//   rơi vào nhóm đó, và loại các đề dưới ngưỡng và các đề ở nhóm khác."
// ROI: 80 (BV:8 x Freq:9 + Legal:0 + Defect:8)
// Hành vi: listExams({ sort: "hardest" }) và listExams({ level: "easy"|"medium"|"hard" })
//   được gọi trên chuỗi query-builder Supabase mock (from/select/eq/order/
//   gte/lt); khẳng định chuỗi lời gọi chính xác được dựng khớp đặc tả
//   Data Flow của backend Design Doc.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (listExams) + chuỗi
//   query-builder Supabase mock
// @complexity: medium
// @real-dependency: không có — test này chỉ chứng minh cách dựng lời gọi JS. Ngữ nghĩa
//   NULL/thứ tự/khoảng của Postgres thật nằm ngoài phạm vi ở đây và được phủ bởi làn
//   service-integration-e2e (Test SE2) và spike phase-0 của backend (S1-S4).
// Kiểu hỏng chính: sort:"hardest" bỏ nullsFirst:false, hoặc bỏ chốt phân định
//   hoà .order("created_at").order("id") nối thêm; HOẶC cặp .gte/.lt của một nhóm level
//   không khớp [1,2.5)/[2.5,3.5)/[3.5,5]; HOẶC chốt .eq("status","published") sẵn có
//   bị bỏ khi quan hệ nguồn đổi sang view.
// Nghĩa vụ chứng minh:
//   (a) với sort:"hardest", khẳng định .order() được gọi với
//       ("avg_overall", { ascending: false, nullsFirst: false }) rồi
//       .order("created_at") rồi .order("id") (AC-019/020);
//   (b) với level:"easy"/"medium"/"hard", khẳng định cặp biên .gte/.lt chính xác mỗi
//       nhóm ([1,2.5) / [2.5,3.5) / [3.5,5]) và .eq("status","published") vẫn
//       có mặt trong chuỗi (AC-017/021);
//   (c) với sort:"newest"/"oldest" và không lọc level, khẳng định chuỗi sẵn có
//       không đổi (chốt hồi quy cho tính liên tục của AC-023 — không có tác dụng phụ
//       lọc-theo-độ-khó ngoài ý muốn trên các lời gọi không liên quan).

describe("listExams — Hardest-sort and Level-filter query construction (Test 2)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("sort:'hardest' chains .order(avg_overall desc, nullsFirst:false).order(created_at).order(id) (AC-019/020, obligation a)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "hardest" });

    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls).toEqual([
      { method: "order", args: ["avg_overall", { ascending: false, nullsFirst: false }] },
      { method: "order", args: ["created_at"] },
      { method: "order", args: ["id"] },
    ]);
  });

  it.each([
    ["easy", 1, 2.5],
    ["medium", 2.5, 3.5],
  ] as const)(
    "level:'%s' chains .gte(avg_overall,%d).lt(avg_overall,%d) and preserves .eq(status,published) (AC-017/021, obligation b)",
    async (level, gte, lt) => {
      const { builder, calls } = createQueryBuilder({ data: [], error: null });
      fromMock.mockReturnValue(builder);

      await listExams({ level });

      expect(calls).toContainEqual({ method: "gte", args: ["avg_overall", gte] });
      expect(calls).toContainEqual({ method: "lt", args: ["avg_overall", lt] });
      expect(calls).toContainEqual({ method: "eq", args: ["status", "published"] });
    }
  );

  it("level:'hard' chains .gte(avg_overall,3.5) with no upper bound and preserves .eq(status,published) (AC-017/021, obligation b)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ level: "hard" });

    expect(calls).toContainEqual({ method: "gte", args: ["avg_overall", 3.5] });
    expect(calls.some((c) => c.method === "lt")).toBe(false);
    expect(calls).toContainEqual({ method: "eq", args: ["status", "published"] });
  });

  it("sort:'newest' leaves the pre-existing chain unchanged, with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "newest" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
  });

  it("sort:'oldest' leaves the pre-existing chain unchanged, with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "oldest" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
  });

  // RE-SCOPED 2026-08-16 (exam-recommendation v1.2, Success Criteria #5): câu
  // này KHÔNG còn là phát biểu về thứ tự mặc định mà /exams hiển thị — thứ tự
  // đó nay do listExamsRanked quyết (ADR-0015 Decision 1b, xem describe cuối
  // file). Nó vẫn đúng và vẫn có giá trị với tư cách hợp đồng của LƯỢT FETCH
  // NỀN: listExams giữ nguyên hành vi, và một thứ tự nền ổn định là thứ làm
  // đầu vào của bộ xếp hạng tất định. Giữ lại chứ KHÔNG xoá — xoá nó là đúng
  // hình dạng rủi ro R-d.
  it("no sort/no level falls back to .order(id), with no gte/lt (AC-023 regression guard, obligation c)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({});

    expect(calls).toContainEqual({ method: "order", args: ["id"] });
    expect(calls.some((c) => c.method === "gte" || c.method === "lt")).toBe(false);
  });
});

describe("listExams — dir overrides a sort axis's default direction (ExamFilters direction toggle)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("sort:'hardest', dir:'asc' flips avg_overall to ascending, nullsFirst still false (easiest-first, below-threshold still sinks)", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "hardest", dir: "asc" });

    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls).toEqual([
      { method: "order", args: ["avg_overall", { ascending: true, nullsFirst: false }] },
      { method: "order", args: ["created_at"] },
      { method: "order", args: ["id"] },
    ]);
  });

  it("sort:'newest', dir:'asc' flips created_at to ascending (same effective order as 'oldest')", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "newest", dir: "asc" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: true }] });
  });

  it("sort:'oldest', dir:'desc' flips created_at to descending (same effective order as 'newest')", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ sort: "oldest", dir: "desc" });

    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
  });

  // RE-SCOPED 2026-08-16 (exam-recommendation v1.2, Success Criteria #5 / I005):
  // `dir` không kèm `sort` vẫn là no-op Ở TẦNG NÀY — listExams vẫn .order("id").
  // Nhưng ở tầng TRANG thì không còn no-op: listExamsRanked xếp hạng cá nhân hoá
  // cho đúng trường hợp đó (PRD AC-037 — một chiều mà không có trục để áp vào
  // thì không phải là một phát biểu về thứ tự). Hai câu không mâu thuẫn; chúng
  // nói về hai tầng khác nhau, và câu ở tầng trang nằm ở describe cuối file.
  it("dir without sort is a no-op — falls back to .order(id) same as no filters at all", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ dir: "asc" });

    expect(calls).toContainEqual({ method: "order", args: ["id"] });
    expect(calls.some((c) => c.method === "order" && c.args[0] === "avg_overall")).toBe(false);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "created_at")).toBe(false);
  });
});

describe("toExam — communityDifficulty mapping is additive, byte-identical below threshold (backend DD Output Comparison)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  const baseRow = {
    id: "exam-1",
    title: "Đề kiểm tra",
    question_ids: ["q1", "q2"],
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    school: "THPT A",
    school_year: 2025,
    semester: "HK1",
    author_display_name: "Cô B",
    parts: null,
  };

  it("below-threshold row (rating_count<3) maps to communityDifficulty:null with every pre-existing field byte-identical", async () => {
    const { builder } = createQueryBuilder({
      data: [{ ...baseRow, rating_count: 2, avg_overall: null }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [exam] = await listExams();

    expect(exam).toEqual({
      id: "exam-1",
      title: "Đề kiểm tra",
      questionIds: ["q1", "q2"],
      durationMinutes: 45,
      subject: "Toán",
      grade: 10,
      school: "THPT A",
      schoolYear: 2025,
      semester: "HK1",
      authorDisplayName: "Cô B",
      parts: undefined,
      communityDifficulty: null,
    });
  });

  it("at-threshold row (rating_count=3) maps avg_overall/rating_count through communityDifficultyFrom without re-deriving bucket logic locally", async () => {
    const { builder } = createQueryBuilder({
      data: [{ ...baseRow, rating_count: 3, avg_overall: 3.0 }],
      error: null,
    });
    fromMock.mockReturnValue(builder);

    const [exam] = await listExams();

    expect(exam.communityDifficulty).toEqual({ bucket: "Medium", mean: 3.0, count: 3 });
  });
});


// =============================================================================
// listExamsRanked — hợp đồng thứ tự MẶC ĐỊNH của /exams + ngân sách round-trip
// =============================================================================
// PRD: docs/prd/exam-recommendation-prd.md (v1.2) — AC-001/015/016/021/037,
//      Success Criteria #5; ADR-0015 Decision 1b/6.
//
// Thêm MỚI (2026-08-16), không thay thế câu nào: hai assertion `.order("id")`
// ở trên vẫn xanh và vẫn nói đúng về listExams. Cái được ghim ở đây là thứ
// KHÁC — thứ tự mà trang thực sự render, và số lượt đi mạng để có nó.
describe("listExamsRanked — thứ tự mặc định của /exams và ngân sách round-trip", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  const examRow = (id: string, grade: number, createdAt: string) => ({
    id,
    title: `Đề ${id}`,
    question_ids: ["q1"],
    duration_minutes: 45,
    subject: "Toán",
    grade,
    school: null,
    school_year: null,
    semester: null,
    author_display_name: null,
    parts: null,
    rating_count: 0,
    avg_overall: null,
    created_at: createdAt,
  });

  /**
   * Một builder RIÊNG cho mỗi bảng — khác hẳn `fromMock.mockReturnValue(builder)`
   * dùng ở các test trên, và đó chính là điểm mấu chốt: dùng chung một builder
   * thì mọi lượt đọc đều được phục vụ cùng một fixture đề, và `exam_attempts`
   * sẽ nhận nhầm dòng đề làm lịch sử làm bài — test vẫn XANH trong khi đang đo
   * sai thứ. Map theo tên bảng để chuyện đó không xảy ra được.
   */
  function mockTables(byTable: Record<string, unknown[]>) {
    const order: string[] = [];
    fromMock.mockImplementation((table: string) => {
      order.push(table);
      const { builder } = createQueryBuilder({ data: byTable[table] ?? [], error: null });
      return builder;
    });
    return order;
  }

  it("không có ?sort: thứ tự là xếp hạng cá nhân hoá, KHÔNG phải thứ tự id", async () => {
    // Theo id thì "a" đứng đầu. Theo xếp hạng: "a" đã nộp nên bị đẩy xuống, và
    // giữa hai đề chưa làm thì "z" (lớp 12, khớp lịch sử) trên "m" (lớp 9).
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("m", 9, "2026-06-01T00:00:00.000Z"),
        examRow("z", 12, "2026-02-01T00:00:00.000Z"),
      ],
      exam_attempts: [
        {
          id: "att-1",
          exam_id: "a",
          submitted_at: "2026-05-01T00:00:00.000Z",
          exams: { grade: 12 },
        },
      ],
      exam_results: [{ attempt_id: "att-1", total_score: 5 }],
    });

    const { exams, submittedExamIds } = await listExamsRanked({});

    expect(exams.map((e) => e.id)).toEqual(["z", "m", "a"]);
    expect(submittedExamIds).toEqual(new Set(["a"]));
  });

  it("?dir không kèm ?sort vẫn được xếp hạng cá nhân hoá (AC-037)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("z", 12, "2026-06-01T00:00:00.000Z"),
      ],
      exam_attempts: [],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({ dir: "asc" });

    // Thứ tự id sẽ là a,z — xếp hạng cho z trước vì mới hơn.
    expect(exams.map((e) => e.id)).toEqual(["z", "a"]);
  });

  it("?sort tường minh thắng cá nhân hoá: thứ tự DB-side giữ nguyên (AC-016)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("z", 12, "2026-06-01T00:00:00.000Z"),
      ],
      exam_attempts: [],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({ sort: "oldest" });

    expect(exams.map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("0 đề bị thêm hay mất so với tập ứng viên (AC-021)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("a", 12, "2026-01-01T00:00:00.000Z"),
        examRow("b", 9, "2026-02-01T00:00:00.000Z"),
        examRow("c", 12, "2026-03-01T00:00:00.000Z"),
      ],
      exam_attempts: [
        { id: "att-1", exam_id: "b", submitted_at: null, exams: { grade: 9 } },
      ],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({});

    expect(exams.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });

  // Hình dạng THẬT đã đo 2026-08-16 là OBJECT (xem chú thích ở AttemptRow trong
  // queries.ts). Case này giữ lại cho nhánh MẢNG vì nó bảo vệ một giả định về
  // thư viện bên thứ ba, thứ có thể đổi khi nâng cấp @supabase/supabase-js —
  // không phải vì hình dạng còn là ẩn số.
  it("embed to-one trả về MẢNG vẫn đọc được lớp (phòng khi PostgREST/SDK đổi hành vi)", async () => {
    mockTables({
      exams_with_difficulty: [
        examRow("g9", 9, "2026-06-01T00:00:00.000Z"),
        examRow("g12", 12, "2026-01-01T00:00:00.000Z"),
      ],
      exam_attempts: [
        { id: "att-1", exam_id: "other", submitted_at: null, exams: [{ grade: 12 }] },
      ],
      exam_results: [],
    });

    const { exams } = await listExamsRanked({});

    // Lớp đọc được -> g12 (khớp lớp) thắng g9 dù g9 mới hơn. Nếu embed bị bỏ
    // qua thì thứ tự sẽ là g9,g12 và câu này đỏ.
    expect(exams.map((e) => e.id)).toEqual(["g12", "g9"]);
  });

  it("ngân sách: đúng 3 lượt đọc, đúng 3 bảng, 0 lượt ghi (ADR-0015 Decision 6)", async () => {
    const tables = mockTables({
      exams_with_difficulty: [examRow("a", 12, "2026-01-01T00:00:00.000Z")],
      exam_attempts: [],
      exam_results: [],
    });

    await listExamsRanked({});

    expect(tables).toHaveLength(3);
    expect([...tables].sort()).toEqual(["exam_attempts", "exam_results", "exams_with_difficulty"]);
  });

  it("ba lượt đọc chạy SONG SONG: cả ba được phát trước khi lượt nào kịp resolve", async () => {
    // Đây là hồi quy thực sự sẽ xảy ra: ai đó chèn một `await` vào giữa hai
    // lượt đọc và biến chúng thành tuần tự. Mock hoãn resolve để "chúng chạy
    // song song" trở thành một câu kiểm chứng được, offline, không cần DB.
    const issued: string[] = [];
    let settle: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      settle = resolve;
    });

    fromMock.mockImplementation((table: string) => {
      issued.push(table);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lt", "ilike", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.then = (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) =>
        gate.then(() => onFulfilled({ data: [], error: null }));
      return builder;
    });

    const pending = listExamsRanked({});
    // Nhường microtask cho cả ba nhánh của Promise.all được phát đi.
    await Promise.resolve();
    await Promise.resolve();

    expect(issued).toHaveLength(3);

    settle();
    await pending;
  });
});

// =============================================================================
// Tìm đề theo tên (ADR-0020) — `q` là MỘT vị từ ILIKE trên cột chuẩn hoá
// =============================================================================
// Hợp đồng ở tầng fetch nền: `q` chuẩn hoá bằng `toSearchTerm` (thường hoá, bỏ
// dấu, đ→d, chỉ còn [a-z0-9 ]) rồi thành đúng MỘT `.ilike("title_search",
// "%term%")`; rỗng/quá ngắn sau chuẩn hoá thì KHÔNG có `.ilike` nào. Chỉ mục và
// RLS thật do làn localdb (`tests/e2e/service/exam-search.*`) chứng minh; ở đây
// chỉ chứng minh HÌNH DẠNG truy vấn — bỏ vị từ này là tìm kiếm âm thầm thành
// "trả cả kho".
describe("listExams — q lọc theo tên qua cột title_search (ADR-0020)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("q có dấu, hoa, ký tự lạ → một .ilike('title_search', '%term%') với term đã chuẩn hoá", async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listExams({ q: "  Toán 10 (Giữa kì) %_\ " });

    const ilikes = calls.filter((c) => c.method === "ilike");
    expect(ilikes).toEqual([{ method: "ilike", args: ["title_search", "%toan 10 giua ki%"] }]);
    // Vẫn là danh mục published, vẫn thứ tự nền ổn định — q chỉ hẹp tập ứng viên.
    expect(calls).toContainEqual({ method: "eq", args: ["status", "published"] });
    expect(calls).toContainEqual({ method: "order", args: ["id"] });
  });

  it("q rỗng hoặc chỉ còn dưới 2 ký tự sau chuẩn hoá → không có .ilike nào", async () => {
    for (const q of ["", "   ", "!", "a", "đ"]) {
      const { builder, calls } = createQueryBuilder({ data: [], error: null });
      fromMock.mockReturnValue(builder);

      await listExams({ q });

      expect(calls.some((c) => c.method === "ilike")).toBe(false);
    }
  });
});

// =============================================================================
// Kho đề theo kệ [integration] — ứng viên 3/3 của ngân sách integration
// của tính năng này (ứng viên 1-2 nằm trong file anh em shelves.int.test.ts)
// =============================================================================
// Design Docs: docs/design/exam-shelves-backend-design.md (v1.2, § Test Boundaries
//   and Placement :619, "?sort=garbage = 3 + 0 rpc (lưới phẳng, F-005)")
// PRD: docs/prd/exam-shelves-prd.md (v1.2, AC-009, AC-010, AC-018, AC-034)
// Sinh ngày: 2026-09-18 | Ngân sách đã dùng: integration 1/3 (phần đóng góp của file này;
//   tổng tính năng 3/3 qua file này + shelves.int.test.ts)
//
// TRẠNG THÁI FILE: chỉ skeleton (`it.todo`). Khối describe này được NỐI THÊM vào
// file sẵn có ở trên — không nội dung Rating System nào phía trên bị sửa, theo
// chỉ dẫn của chính backend DD rằng "các ca AC-016/AC-017 ở :319-457 qua
// KHÔNG SỬA". Nó dùng lại các helper `fromMock` / `createQueryBuilder` /
// kiểu `mockTables` đã định nghĩa ở trên của chính file này (không cần import lại — cùng
// phạm vi module), cộng `listExamsRanked` đã import ở đầu file này.
// Nhánh mã `sort: "hot"` và nhánh `rpc` trong `listExamsRanked` CHƯA TỒN TẠI
// (backend DD Implementation Plan bước 6) — `it.todo` tránh phụ thuộc vào
// hành vi chưa viết mà vẫn đăng ký một task vitest thật trong file này.
//
// AC-009: "...thứ tự đúng bằng thứ tự SQL hôm nay, không cá nhân hoá, và
//   các khẳng định dựng truy vấn trong rating.int.test.ts:317-440 qua không sửa."
// AC-010: "...hoặc một giá trị ?sort= không nhận ra, khi trang render, thì lưới
//   phẳng render theo thứ tự cá nhân hoá hôm nay...và 0 kệ xuất hiện."
// AC-018: "...thứ tự hot được tính...số lượt làm đã nộp GIẢM DẦN, id đề TĂNG DẦN,
//   trong đó số đếm gồm lượt làm của mọi học sinh, không chỉ người gọi."
// AC-034: "...lưới phẳng render theo cùng số đếm xuyên người dùng như AC-018."
// Test Boundaries and Placement của backend DD: "Ngân sách hợp thành: kệ = 4,
//   đã lọc = 3 + 0 rpc, ?sort=hot = 3 + 1 rpc, ?sort=garbage = 3 + 0 rpc (lưới
//   phẳng, F-005)."
// ROI: 64 (BV:8 x Freq:7 + Legal:0 + Defect:8)
//   BV 8 — bảo vệ Success Criteria #5 ("rating.int.test.ts:317-440 qua
//     không sửa") và ngân sách lượt khứ hồi mà bảng Risks gọi là bề mặt
//     hồi quy thường trực.
//   Freq 7 — mọi cú chạm chip ?sort=hot tường minh, cộng mọi giá trị ?sort= rác/sai
//     dạng mà vẫn phải lùi về hợp đồng lưới phẳng (một URL mà người dùng
//     sửa tay hoặc đánh dấu được).
//   Defect 8 — kiểu hỏng riêng của F-005 (một giá trị sort rác vô tình
//     khớp nhánh "hot", hoặc nhánh hot phát một lời gọi rpc mà khẳng định
//     ngân sách không mong đợi) không có triệu chứng nhìn thấy trên màn hình nào ngoài
//     một thứ tự sai thầm lặng — cùng dạng "không lỗi, chỉ sai" như mọi rủi ro
//     ngân sách lượt khứ hồi khác trong tính năng này.
// Hành vi: listExamsRanked({ sort: "hot" }) được gọi trên ranh giới client Supabase
//   mock -> đúng 3 lời gọi .from(...) + 1 lời gọi .rpc("exam_hot_counts", ...),
//   và các đề trả về được xếp theo total_count giảm dần của rpc mock,
//   id đề tăng dần -> listExamsRanked({ sort: "garbage-value-not-in-ExamSort" }) được
//   gọi -> đúng 3 lời gọi .from(...) và 0 lời gọi .rpc(...), tức cùng
//   ngân sách như mọi lời gọi sort tường minh khác đã chứng minh ở trên.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/queries/ranking.ts (listExamsRanked, nhánh sort==="hot"
//   chưa cài đặt) + client Supabase mock ({ from, rpc })
// @complexity: medium
// @real-dependency: không có — cùng ranh giới client mock như mọi describe khác trong
//   file này; tính đúng của RLS/grant cho exam_hot_counts được chứng minh trong
//   làn service-integration-e2e, không phải ở đây.
// Kiểu hỏng chính: một giá trị ?sort= không nhận ra (ví dụ do URL sửa tay hoặc
//   một bookmark cũ cung cấp) được so sánh lỏng đến mức khớp nhánh "hot"
//   và phát một lời gọi rpc ngoài ý muốn với giá trị mà AC-010 đòi phải rơi
//   xuống đường lưới phẳng thông thường; HOẶC thứ tự phía Node của nhánh "hot"
//   lặng lẽ quay về thứ tự phía DB của `.order("id")` vì kết quả rpc
//   chưa từng thực sự được tham khảo.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) listExamsRanked({ sort: "hot" }) phát đúng 3 lời gọi .from(...) (cùng
//       3 bảng như mọi ca sort tường minh ở trên) CỘNG đúng 1
//       lời gọi .rpc("exam_hot_counts", ...) — tổng 4, không phải 3 và không phải 5;
//   (b) thứ tự mảng `exams` trả về khớp `total_count DESC, exam id ASC`
//       tính từ phản hồi rpc mock — một mảng kỳ vọng literal tính độc lập với
//       cài đặt, không chỉ "khác `.order(id)`";
//   (c) listExamsRanked({ sort: "garbage-not-a-real-value" as ExamSort }) phát
//       đúng 3 lời gọi .from(...) và 0 lời gọi .rpc(...) (F-005) — cùng hình dạng như
//       the existing "?sort tường minh thắng cá nhân hoá" case above, so a value
//       ngoài danh sách trắng không bao giờ lặng lẽ tới nhánh hot;
//   (d) CHỐT HỒI QUY, không phải nghĩa vụ mới: khối describe này không sửa
//       hay chạy lại các ca AC-016/AC-017 ở đầu file — nó chỉ thêm
//       ca; người cài đặt phải xác nhận các ca đó vẫn qua không sửa trong
//       cùng commit thêm các khẳng định thật của khối này (Success Criteria #5).
// Chính `createClient` là MỚI trong ứng viên này — các test của khối describe này
// mở rộng client trả về của mock dùng chung bằng `rpc` cho đúng MỘT
// lời gọi `createClient()` mà `listExamsRanked` gọi trực tiếp (ranking.ts:105);
// `mockResolvedValueOnce` bên dưới tự hoàn nguyên sau lời gọi đó, được nạp lại
// mới ở mỗi test trong `beforeEach`. Lời gọi `createClient()` THỨ HAI, nội bộ
// trong `fetchExamRows` (catalogue.ts:77) vẫn resolve qua
// `{ from: fromMock }` mặc định không đụng từ :29-31 — chỗ gọi đó
// chỉ làm `.from(...)`, không bao giờ `.rpc(...)`, nên mặc định là đủ cho nó.
// Điều này giữ chính :29-31 giống từng byte: đụng vào factory mock dùng chung
// sẽ đụng vào dòng 1-747, và theo Failure response của chính task này, một
// khẳng định qua mà đòi sửa vùng dùng chung báo hiệu rằng cách sửa
// thuộc về địa phận P4-T2, không phải ở đây.
import type { ExamSort } from "@/features/exams/queries";
const { createClient } = await import("@/lib/supabase/server");

describe("listExamsRanked — ?sort=hot / ?sort=garbage composition budget (AC-009, AC-010, AC-018, AC-034, F-005)", () => {
  const rpcMock = vi.fn();

  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    vi.mocked(createClient).mockResolvedValueOnce({ from: fromMock, rpc: rpcMock } as never);
  });

  /** Dòng `exams_with_difficulty` tối giản — chỉ field mà nhánh `?sort=hot`/
   *  DB-side thật sự đọc (`id`, dùng bởi `orderIdsByHotCount`/`toExam`); cùng
   *  field set với `examRow` của candidate 1-2 ngay TRONG file này (:531-546). */
  function hotExamRow(id: string) {
    return {
      id,
      title: `Đề ${id}`,
      question_ids: ["q1"],
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      school: null,
      school_year: null,
      semester: null,
      author_display_name: null,
      parts: null,
      rating_count: 0,
      avg_overall: null,
      created_at: "2026-01-01T00:00:00.000Z",
    };
  }

  /**
   * Nối `fromMock`/`rpcMock` vào map theo tên bảng/rpc, builder RIÊNG cho mỗi
   * bảng — cùng kỹ thuật `mockTables` (:555-563, candidate 1-2 trong CHÍNH file
   * này) và `mockBoundary` của `shelves.int.test.ts` (cùng feature, cùng ngân
   * sách D3): dùng chung một builder thì `exam_attempts`/`exam_results` có thể
   * nhận nhầm dòng đề, và test vẫn XANH trong khi đang đo sai thứ. Trả về
   * `issued` để assertion ngân sách đếm `from()`+`rpc()` CỘNG LẠI, đúng
   * Compliance Check của Binding Decision (task file § Binding Decisions).
   */
  function mockHotBoundary(byTable: Record<string, unknown[]>, hotRows: unknown[]) {
    const issued: string[] = [];
    fromMock.mockImplementation((table: string) => {
      issued.push(table);
      const { builder } = createQueryBuilder({ data: byTable[table] ?? [], error: null });
      return builder;
    });
    rpcMock.mockImplementation((fnName: string) => {
      issued.push(fnName);
      const { builder } = createQueryBuilder({ data: hotRows, error: null });
      return builder;
    });
    return issued;
  }

  it(
    '?sort=hot issues exactly 3 .from(...) calls + 1 .rpc("exam_hot_counts", ...) call, and orders exams by the mocked rpc\'s total_count DESC, exam id ASC (AC-018/AC-034, obligations a+b)',
    async () => {
      // total_count DESC, exam id ASC tính TAY từ fixture dưới đây, KHÔNG chạy
      // implementation trước (xem task file § Investigation Notes):
      //   a: 5, b: 5 (hoà tổng -> id ASC nên "a" trước "b"), z: 1, m: không có
      //   dòng hot -> total mặc định 0 (orderIdsByHotCount, examShelves.ts:301-308).
      // => literal expected: ["a", "b", "z", "m"].
      const issued = mockHotBoundary(
        {
          exams_with_difficulty: [hotExamRow("z"), hotExamRow("a"), hotExamRow("m"), hotExamRow("b")],
          exam_attempts: [],
          exam_results: [],
        },
        [
          { exam_id: "a", recent_count: 0, wide_count: 0, total_count: 5 },
          { exam_id: "b", recent_count: 0, wide_count: 0, total_count: 5 },
          { exam_id: "z", recent_count: 0, wide_count: 0, total_count: 1 },
        ]
      );

      const { exams } = await listExamsRanked({ sort: "hot" });

      expect(issued).toHaveLength(4);
      expect(new Set(issued)).toEqual(
        new Set(["exams_with_difficulty", "exam_attempts", "exam_results", "exam_hot_counts"])
      );
      expect(exams.map((e) => e.id)).toEqual(["a", "b", "z", "m"]);
    }
  );

  it(
    "?sort=<value not in ExamSort> issues exactly 3 .from(...) calls and 0 .rpc(...) calls — same budget as every other explicit-sort case (AC-009/AC-010, F-005, obligation c)",
    async () => {
      const issued = mockHotBoundary(
        { exams_with_difficulty: [hotExamRow("a")], exam_attempts: [], exam_results: [] },
        []
      );

      await listExamsRanked({ sort: "garbage-not-a-real-value" as ExamSort });

      expect(issued).toHaveLength(3);
      expect(new Set(issued)).toEqual(new Set(["exams_with_difficulty", "exam_attempts", "exam_results"]));
      expect(rpcMock).not.toHaveBeenCalled();
    }
  );
});
