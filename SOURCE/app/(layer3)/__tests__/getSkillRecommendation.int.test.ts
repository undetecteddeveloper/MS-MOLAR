// getSkillRecommendation() [integration] — AC-012/014-017/028/031
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0)
// Skeleton sinh 2026-08-08, chuyển thành test thật ở backend-task-08.
// Budget: integration 2/3 (backend sub-budget — xem header của
//   tutorActions.int.test.ts cho phần hạch toán đầy đủ).
//
// Mock boundary (backend DD Test Boundaries — Mock Boundary Decisions): CHỈ
//   Supabase client bên trong getSkillRecommendation() được mock, đúng tiền lệ
//   getResult.int.test.ts / rating.int.test.ts / tutorActions.int.test.ts.
//   recommendNextSkill() KHÔNG bị mock — nó chạy thật, in-process (chính hàm
//   đang được unit test riêng ở lib/adaptive/__tests__/route.test.ts), nên file
//   này chứng minh getSkillRecommendation() thật sự gọi nó với dữ liệu lấy từ
//   fixture và map kết quả đúng, chứ không phải chứng minh một mock trả về đúng
//   hình dạng mình tự đặt.
//   buildTelemetryPayload() cũng chạy thật — hàng rào chặn answer-key nằm trong
//   chính nó (lib/tutor/telemetry.ts), thay bằng mock là vứt luôn hàng rào đó.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, getUserMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getUserMock: vi.fn(),
}));

// queries.ts kéo theo "server-only" — stub, cùng lối getResult.int.test.ts.
vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, auth: { getUser: getUserMock } })),
}));

const { getSkillRecommendation } = await import("../queries");

const USER_ID = "user-1";

const NODE_ROWS = [
  { id: "node-x", label_vi: "Lũy thừa" },
  { id: "node-y", label_vi: "Lôgarit" },
];

const EDGE_ROWS = [{ skill_node_id: "node-y", prerequisite_node_id: "node-x" }];

/** node-x ratio 0.2, node-y ratio 0.9 → node-x là yếu nhất, không bị chặn. */
const MASTERY_ROWS = [
  { skill_node_id: "node-x", correct_count: 2, total_count: 10, last_wrong_at: null },
  { skill_node_id: "node-y", correct_count: 9, total_count: 10, last_wrong_at: null },
];

type Scenario = {
  nodes?: typeof NODE_ROWS;
  edges?: typeof EDGE_ROWS;
  mastery?: typeof MASTERY_ROWS;
  /** Bắt lệnh insert telemetry_log trả lỗi (fire-and-forget). */
  telemetryError?: { code: string; message: string } | null;
  /** Bắt lệnh insert telemetry_log NÉM lỗi (chứ không chỉ trả error). */
  telemetryThrows?: boolean;
};

/** Nối fromMock cho chuỗi gọi của getSkillRecommendation(): skill_nodes,
 *  skill_prerequisites, user_skill_mastery (đều await thẳng builder — builder
 *  PostgREST là thenable) và telemetry_log (insert). */
function mockChain(scenario: Scenario = {}) {
  const insertPayloads: Record<string, unknown>[] = [];
  const tablesTouched: string[] = [];
  const selectArgsByTable: Record<string, string[]> = {};

  fromMock.mockImplementation((table: string) => {
    tablesTouched.push(table);
    const builder: Record<string, unknown> = {
      select: (arg?: string) => {
        (selectArgsByTable[table] ??= []).push(String(arg ?? ""));
        return builder;
      },
      insert: (payload: Record<string, unknown>) => {
        if (scenario.telemetryThrows) throw new Error("bùng nổ ở tầng mạng");
        insertPayloads.push(payload);
        return builder;
      },
      // Ba lệnh đọc đi qua `readBounded` (P3) nên builder thật LUÔN nhận
      // `.limit()` trước khi được await. Fake thiếu method này không phải "fake
      // gọn hơn" mà là fake SAI hình dạng builder nó đóng thế.
      limit: () => builder,
      then: (onFulfilled: (value: unknown) => unknown) => {
        const data =
          table === "skill_nodes"
            ? (scenario.nodes ?? NODE_ROWS)
            : table === "skill_prerequisites"
              ? (scenario.edges ?? EDGE_ROWS)
              : table === "user_skill_mastery"
                ? (scenario.mastery ?? MASTERY_ROWS)
                : null;
        const error = table === "telemetry_log" ? (scenario.telemetryError ?? null) : null;
        return Promise.resolve({ data, error }).then(onFulfilled);
      },
    };
    return builder;
  });

  return { insertPayloads, tablesTouched, selectArgsByTable };
}

beforeEach(() => {
  fromMock.mockReset();
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
});

// =============================================================================
// Test 1 — AC-012 (nửa routing của R4): telemetry adaptive_route có bắn
// =============================================================================
// Primary failure mode: telemetry chỉ được cài cho nhánh gia sư (explainStep())
//   và bị bỏ quên ở nhánh routing, khiến nửa "adaptive-routing events are
//   recorded" của R4 không bao giờ được cài — dù CHECK constraint §19 đã đặt
//   sẵn tên 'adaptive_route' chính là để chặn khoảng trống này.
describe("Test 1 (AC-012) — telemetry 'adaptive_route'", () => {
  it("bắn đúng MỘT lệnh insert telemetry_log với event_type='adaptive_route' và user_id của caller", async () => {
    const { insertPayloads } = mockChain();

    await getSkillRecommendation();

    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({
      event_type: "adaptive_route",
      user_id: USER_ID,
      success: true,
    });
  });

  it("ghi lại skill_node_id được gợi ý — nhưng KHÔNG trả nó về cho UI", async () => {
    // Telemetry là chỗ DUY NHẤT nodeId được phép đi tiếp: nó phục vụ truy vấn
    // vận hành AC-012, không phải render.
    const { insertPayloads } = mockChain();

    const result = await getSkillRecommendation();

    expect(insertPayloads[0]).toMatchObject({ skill_node_id: "node-x" });
    expect(result).not.toHaveProperty("nodeId");
  });
});

// =============================================================================
// Test 2 — AC-028: cold start trả null; lỗi ghi telemetry không đổi kết quả
// =============================================================================
// Primary failure mode: người dùng cold start (0 dòng mastery — mọi tài khoản
//   vừa đăng ký, ca tần suất cao nhất trong production) làm hàm NÉM lỗi thay vì
//   trả null như hợp đồng, phá luôn Promise.all của DashboardPage; HOẶC lỗi ghi
//   telemetry được cho phép lan ra và đổi/từ chối giá trị trả về, biến một lệnh
//   ghi quan sát thành điểm hỏng thứ hai của một lệnh đọc người dùng đang chờ.
describe("Test 2 (AC-028) — cold start + fire-and-forget", () => {
  it("0 dòng mastery → resolve strictly null, không ném lỗi", async () => {
    mockChain({ mastery: [] });

    const result = await getSkillRecommendation();

    expect(result).toBe(null);
  });

  it("cold start vẫn ghi telemetry với success:true và skill_node_id null", async () => {
    // Một lượt routing có xảy ra — chỉ là không gợi ý được gì. R4 đếm lượt gọi,
    // nên bỏ qua dòng log ở đây sẽ làm số liệu cold start biến mất hoàn toàn.
    const { insertPayloads } = mockChain({ mastery: [] });

    await getSkillRecommendation();

    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({
      event_type: "adaptive_route",
      skill_node_id: null,
      success: true,
    });
  });

  it("telemetry trả error → giá trị trả về KHÔNG đổi (ca cold start)", async () => {
    mockChain({ mastery: [], telemetryError: { code: "42501", message: "denied" } });

    expect(await getSkillRecommendation()).toBe(null);
  });

  it("telemetry trả error → giá trị trả về KHÔNG đổi (ca có gợi ý)", async () => {
    mockChain({ telemetryError: { code: "42501", message: "denied" } });

    expect(await getSkillRecommendation()).toEqual({
      skillLabel: "Lũy thừa",
      reasonCode: "lowest-mastery",
    });
  });

  it("telemetry NÉM lỗi → giá trị trả về KHÔNG đổi, không lan ra ngoài", async () => {
    mockChain({ telemetryThrows: true });

    expect(await getSkillRecommendation()).toEqual({
      skillLabel: "Lũy thừa",
      reasonCode: "lowest-mastery",
    });
  });
});

// =============================================================================
// Test 3 — AC-014-017/031: map đúng hình dạng (bỏ nodeId, labelVi → skillLabel)
// =============================================================================
// Primary failure mode: phép map vô tình để lọt nodeId vào object trả về (mở
//   rộng hợp đồng SkillRecommendation vốn bị UI Spec khoá), hoặc map labelVi
//   sang sai tên trường — làm SkillRecommendationCard render ra rỗng chứ không
//   crash, đúng kiểu trôi lệch hình dạng mà một assertion toEqual tường minh
//   mới bắt được.
describe("Test 3 (AC-031) — trung thực về hình dạng dữ liệu", () => {
  it("map {nodeId, labelVi, reasonCode} → {skillLabel, reasonCode}, bỏ hẳn nodeId", async () => {
    mockChain();

    const result = await getSkillRecommendation();

    expect(result).toEqual({ skillLabel: "Lũy thừa", reasonCode: "lowest-mastery" });
    expect(result).not.toHaveProperty("nodeId");
    expect(result).not.toHaveProperty("labelVi");
  });

  it("gọi recommendNextSkill() THẬT: cổng tiên quyết đổi kết quả theo dữ liệu fixture", async () => {
    // node-y yếu nhất theo ratio thô (0.1) nhưng tiên quyết node-x (0.3) chưa
    // đạt ngưỡng 0.7 → phải trả node-x với lý do prerequisite-gate. Nếu
    // recommendNextSkill() bị mock hay bị viết lại tại chỗ, ca này sẽ trượt.
    mockChain({
      mastery: [
        { skill_node_id: "node-x", correct_count: 3, total_count: 10, last_wrong_at: null },
        { skill_node_id: "node-y", correct_count: 1, total_count: 10, last_wrong_at: null },
      ],
    });

    expect(await getSkillRecommendation()).toEqual({
      skillLabel: "Lũy thừa",
      reasonCode: "prerequisite-gate",
    });
  });

  it("đọc đúng 3 bảng nguồn của DAG + mastery", async () => {
    const { tablesTouched } = mockChain();

    await getSkillRecommendation();

    expect(tablesTouched).toContain("skill_nodes");
    expect(tablesTouched).toContain("skill_prerequisites");
    expect(tablesTouched).toContain("user_skill_mastery");
  });
});
