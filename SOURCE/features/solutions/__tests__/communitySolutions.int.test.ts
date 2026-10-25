// Community Solutions [integration] Bộ khung test
// Design Docs: docs/design/community-solutions-backend-design.md (v1.1),
//   docs/design/community-solutions-frontend-design.md (v1.1)
// UI Spec: docs/ui-spec/community-solutions-ui-spec.md
// PRD: docs/prd/community-solutions-prd.md (v1.3)
// Sinh ngày: 2026-09-17 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/1-2
//
// CHỈ LÀ SKELETON — ý định thiết kế dạng comment. Chưa có import, describe/it,
// khẳng định, theo thiết kế (skill testing-principles: một skeleton đã commit
// phải giữ xanh dưới tsc/eslint/build trước khi các module được tham chiếu tồn tại).
// features/solutions/** chưa tồn tại; migration của tính năng này CHƯA
// được áp lên dev (hynwleaxtbtjzkvpjsug) — vẫn là giai đoạn thiết kế.
// Task cài đặt thêm import thật + khối runner vitest + khẳng định
// cạnh features/solutions/actions.ts / queries.ts / adminActions.ts, trong
// cùng commit (Red -> Green trong một task), theo tiền lệ rating.int.test.ts của repo này
// (SOURCE/features/exams/__tests__/rating.int.test.ts).
//
// Ranh giới mock (backend DD § Test Boundaries, bảng Mock Boundary Decisions):
// client Supabase PHIÊN (các lời gọi .rpc/.from do
// createClient() của @/lib/supabase/server trả về) là mock được phê duyệt duy nhất trong
// file này — theo quy ước vi.mock("@/lib/supabase/server") sẵn có của rating.int.test.ts.
// Tính đúng của RLS/RPC/che Postgres thật rõ ràng KHÔNG
// chứng minh được bằng mock ("không mock nào xác minh được rằng... các biểu thức case
// when che thực sự cho ra null trong phản hồi sống" — backend DD
// § Data Layer Testing Strategy); bằng chứng đó nằm trong file
// service-integration-e2e của tính năng này, không phải ở đây. File này chỉ chứng minh logic nghiệp vụ
// Server Action / lớp bọc truy vấn, cách dựng lời gọi, và ánh xạ lỗi.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts và lib/auth/admin.ts import "server-only" (ném lỗi ngoài
// bundle server Next/react-server) — cùng stub với rating.int.test.ts /
// getResult.int.test.ts.
vi.mock("server-only", () => ({}));

const { getUserMock, rpcMock, fromMock, isAdminUserIdMock, createSignedUrlsMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  // Test 1 (b): một spy, để "không lời gọi .from(...) nào" là khẳng định trên
  // nhật ký lời gọi được ghi thay vì trên một TypeError do thiếu phương thức.
  fromMock: vi.fn(),
  isAdminUserIdMock: vi.fn(),
  // Test 3 (bàn giao tích hợp task 42, xem Investigation Notes của task 14):
  // listSolutions/getSolutionDetail giờ ký theo lô author_avatar_path của mọi hàng
  // có tên trước toAuthorIdentity. Phản hồi một giá trị đã ký xác định cho mỗi
  // đường dẫn — chính hợp đồng gộp lô/fail-closed của Storage được chứng minh trong
  // features/solutions/__tests__/avatarSigner.test.ts (task 42).
  createSignedUrlsMock: vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `signed:${path}`, error: null })),
    error: null,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: fromMock,
    storage: { from: () => ({ createSignedUrls: createSignedUrlsMock }) },
  })),
}));

// phép kiểm trước ở tầng app của adminActions.ts (Test 1 + các hàng admin bên dưới).
vi.mock("@/lib/auth/admin", () => ({ isAdminUserId: isAdminUserIdMock }));

// adminActions.ts revalidate /admin sau khi một kiểm duyệt được chấp nhận; ngoài
// một request Next, revalidatePath thật không có store để ghi.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveSolution, setSolutionStatus } = await import("@/features/solutions/actions");
const { listSolutions, getSolutionDetail } = await import("@/features/solutions/queries");
const { listCommunityReports, getSolutionNotesForAdmin, moderateSolutionAction, moderateCommentAction } =
  await import("@/features/solutions/adminActions");

const ADMIN_ACTIONS_SOURCE_PATH = fileURLToPath(new URL("../adminActions.ts", import.meta.url));
const ADMIN_ACTION_ERROR_KEY = "admin.solutions.actionError";

// =============================================================================
// Test 1 — adminActions.ts: kiểm duyệt admin không bao giờ chạm service-role.ts;
//   các lượt ghi kiểm duyệt chỉ đi qua lời gọi RPC của client phiên
//   (ranh giới TD-029 — prompt điều phối yêu cầu có >=1
//   skeleton chứng minh ranh giới này, không chỉ nêu trong tài liệu)
// =============================================================================
// AC: "Hệ thống phải cài đặt mọi lượt ghi kiểm duyệt của admin dưới dạng một
//   hàm SECURITY DEFINER được cấp cho authenticated, và phải thêm không
//   hàm export nào và không bộ ghi bảng trực tiếp nào vào
//   SOURCE/lib/supabase/service-role.ts." (PRD NFR Bảo mật, M9; backend DD
//   § Agreement Checklist Non-Scope: "SOURCE/lib/supabase/service-role.ts —
//   không thêm hàm export nào, không thêm bộ ghi trực tiếp nào")
// ROI: 59 (BV:8 x Freq:5 + Legal:10 + Defect:9)
// Hành vi: moderateSolutionAction / moderateCommentAction
//   (features/solutions/adminActions.ts) được gọi trên client Supabase phiên
//   mock -> mỗi lời gọi phát đúng một
//   .rpc("admin_moderate_community_solution" | "admin_moderate_community_comment",
//   {...}) trên client PHIÊN -> module đang kiểm không import gì
//   từ "@/lib/supabase/service-role".
// @category: core-functionality
// @lane: integration
// @dependency: features/solutions/adminActions.ts (moderateSolutionAction,
//   moderateCommentAction) + client Supabase phiên mock
// @complexity: low
// @real-dependency: không có — client phiên là ranh giới mock được phê duyệt
//   ở đây; việc DB từ chối is_admin_user() thật với người gọi
//   không phải admin được chứng minh trong ca hướng-admin của file service-integration-e2e
//   (lượt đọc admin-so-với-không-admin của Test SE2), không phải ở đây.
// Kiểu hỏng chính: một lần sửa sau này định tuyến kiểm duyệt admin qua
//   lib/supabase/service-role.ts (thao tác export thứ 14 hoặc bộ ghi
//   trực tiếp thứ 5), lặng lẽ mở lại bề mặt đóng băng mà TD-029/ADR-0019 cấm.
// Nghĩa vụ chứng minh: (a) kiểm import tĩnh — features/solutions/adminActions.ts
//   không chứa import "@/lib/supabase/service-role" nào; (b) khẳng định mẫu lời gọi
//   — .rpc() của client phiên mock được gọi với đúng
//   "admin_moderate_community_solution" / "admin_moderate_community_comment",
//   không bao giờ là lượt ghi .from("community_solutions").update(...) trực tiếp; (c) ghi chú
//   rằng SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts (13
//   export / 4 bộ ghi trực tiếp, không sửa) là bằng chứng bổ sung toàn repo
//   mà test này không lặp lại — file đó chứng minh "cả repo
//   không phình ra," file này chứng minh "code của chính tính năng này không bao giờ
//   với tới nó."
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - moderateSolutionAction(id, "hide", reason) -> .rpc của client mock được gọi
//     đúng một lần với "admin_moderate_community_solution"; không lời gọi
//     .from("community_solutions") nào
//   - moderateCommentAction(id, "hide", reason) -> cùng hình dạng, tên RPC
//     "admin_moderate_community_comment"
//   - kiểm tĩnh: không có chỗ nào một đường import "service-role" xuất hiện
//     trong nguồn của features/solutions/adminActions.ts
//   - tiêu chí qua: cả ba phép kiểm đều đúng; test hỏng nếu bất kỳ đường ghi admin nào
//     bỏ qua RPC hoặc import service-role.ts
// SK-1 (plan § Open Items, giải quyết 2026-09-20): chữ ký đã khai báo là
//   (prevState, formData), nên lời gọi ở trên được thực hiện với một FormData mang
//   id, "hide" và lý do — không có overload tham số vị trí nào.

let adminUidCounter = 0;
/** Một id admin mới cho mỗi test: guard() thật giữ một bộ đếm trong bộ nhớ
 *  theo từng người dùng, nên dùng lại một id qua nhiều lời gọi kiểm duyệt có thể chạm
 *  giới hạn 30/giờ và làm một khẳng định không liên quan đỏ. */
function signInFreshAdmin() {
  adminUidCounter += 1;
  const id = `admin-actions-admin-${adminUidCounter}`;
  getUserMock.mockResolvedValue({ data: { user: { id } } });
  isAdminUserIdMock.mockImplementation((userId: string | null | undefined) => userId === id);
  return id;
}

function signInNonAdmin() {
  getUserMock.mockResolvedValue({ data: { user: { id: "admin-actions-not-an-admin" } } });
  isAdminUserIdMock.mockReturnValue(false);
}

function moderationForm(idField: "solutionId" | "commentId", id: string, action: string, reason?: string) {
  const formData = new FormData();
  formData.set(idField, id);
  formData.set("action", action);
  if (reason !== undefined) formData.set("reason", reason);
  return formData;
}

function readAdminActionsSource() {
  return readFileSync(ADMIN_ACTIONS_SOURCE_PATH, "utf8");
}

function resetAdminMocks() {
  getUserMock.mockReset();
  rpcMock.mockReset();
  fromMock.mockReset();
  isAdminUserIdMock.mockReset();
}

describe("adminActions.ts — admin moderation writes flow only through session-client RPCs, never service-role.ts (Test 1)", () => {
  beforeEach(() => {
    resetAdminMocks();
    signInFreshAdmin();
  });

  it("(b) moderateSolutionAction(undefined, FormData{solutionId, 'hide', reason}) -> exactly one .rpc('admin_moderate_community_solution'), zero .from(...) calls", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ status: "hidden" }], error: null });

    const result = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-t1", "hide", "Nội dung sai lệch")
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_moderate_community_solution", {
      p_solution_id: "solution-t1",
      p_action: "hide",
      p_reason: "Nội dung sai lệch",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, status: "hidden" });
  });

  it("(b) moderateCommentAction(undefined, FormData{commentId, 'hide', reason}) -> exactly one .rpc('admin_moderate_community_comment'), zero .from(...) calls", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ status: "hidden" }], error: null });

    const result = await moderateCommentAction(
      null,
      moderationForm("commentId", "comment-t1", "hide", "Xúc phạm người khác")
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_moderate_community_comment", {
      p_comment_id: "comment-t1",
      p_action: "hide",
      p_reason: "Xúc phạm người khác",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, status: "hidden" });
  });

  it("(a)/(c) static check: adminActions.ts contains zero 'service-role' import paths (serviceRoleSurface.test.ts is the complementary repo-wide proof)", () => {
    const source = readAdminActionsSource();

    expect(source).not.toMatch(/service-role/);
    expect(source).not.toMatch(/\.from\(/);
  });
});

describe("adminActions.ts — Required test list rows 4-8 (validation, admin pre-check, error mapping)", () => {
  beforeEach(() => {
    resetAdminMocks();
    signInFreshAdmin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("row 4: a crafted action outside {hide, restore, delete} is rejected before any call, for both actions", async () => {
    const solutionResult = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-r4", "purge", "lý do")
    );
    const commentResult = await moderateCommentAction(
      null,
      moderationForm("commentId", "comment-r4", "purge", "lý do")
    );

    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(commentResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
  });

  it("row 5: 'hide' or 'delete' with an empty / whitespace-only / missing reason -> .rpc count 0 and { error: key } (AC-082, AC-106)", async () => {
    const results = [
      await moderateSolutionAction(null, moderationForm("solutionId", "solution-r5", "hide", "")),
      await moderateSolutionAction(null, moderationForm("solutionId", "solution-r5", "delete", "   \n\t ")),
      await moderateSolutionAction(null, moderationForm("solutionId", "solution-r5", "hide")),
      await moderateCommentAction(null, moderationForm("commentId", "comment-r5", "hide", "  ")),
      await moderateCommentAction(null, moderationForm("commentId", "comment-r5", "delete", "")),
    ];

    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(results).toEqual(Array(5).fill({ error: ADMIN_ACTION_ERROR_KEY }));
  });

  it("row 6: 'restore' with no reason is accepted — the RPC is called for both actions", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [{ status: "published" }], error: null })
      .mockResolvedValueOnce({ data: [{ status: "visible" }], error: null });

    const solutionResult = await moderateSolutionAction(null, moderationForm("solutionId", "solution-r6", "restore"));
    const commentResult = await moderateCommentAction(null, moderationForm("commentId", "comment-r6", "restore"));

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "admin_moderate_community_solution", {
      p_solution_id: "solution-r6",
      p_action: "restore",
      p_reason: "",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "admin_moderate_community_comment", {
      p_comment_id: "comment-r6",
      p_action: "restore",
      p_reason: "",
    });
    expect(solutionResult).toEqual({ ok: true, status: "published" });
    expect(commentResult).toEqual({ ok: true, status: "visible" });
  });

  it("row 7: isAdminUserId -> false refuses all four functions with .rpc count 0 (AC-085)", async () => {
    signInNonAdmin();

    const solutionResult = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-r7", "hide", "lý do")
    );
    const commentResult = await moderateCommentAction(
      null,
      moderationForm("commentId", "comment-r7", "hide", "lý do")
    );
    await expect(listCommunityReports()).rejects.toThrow();
    await expect(getSolutionNotesForAdmin("solution-r7")).rejects.toThrow();

    expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(commentResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(fromMock).toHaveBeenCalledTimes(0);
  });

  it("row 7 (signed out): no session user is refused the same way, with .rpc count 0", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    isAdminUserIdMock.mockReturnValue(false);

    const solutionResult = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-r7b", "hide", "lý do")
    );
    await expect(listCommunityReports()).rejects.toThrow();

    expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(rpcMock).toHaveBeenCalledTimes(0);
  });

  it.each([
    {
      code: "42501",
      expectedLogCalls: [
        ["[admin_moderate_community_solution]", "42501"],
        ["[admin_moderate_community_comment]", "42501"],
      ],
    },
    { code: "22023", expectedLogCalls: [] },
    { code: "P0002", expectedLogCalls: [] },
  ])(
    "row 8: RPC error $code -> both moderation actions return the fixed key; error.message is never read nor forwarded; only 42501 is logged (RPC name + code)",
    async ({ code, expectedLogCalls }) => {
      const databaseMessage = `admin_moderate_community_x: leaked detail for ${code}`;
      let messageReads = 0;
      const rpcError = {
        code,
        get message() {
          messageReads += 1;
          return databaseMessage;
        },
      };
      rpcMock.mockResolvedValue({ data: null, error: rpcError });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const solutionResult = await moderateSolutionAction(
        null,
        moderationForm("solutionId", "solution-r8", "hide", "lý do kiểm duyệt riêng tư")
      );
      const commentResult = await moderateCommentAction(
        null,
        moderationForm("commentId", "comment-r8", "hide", "lý do kiểm duyệt riêng tư")
      );

      expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
      expect(commentResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
      expect(messageReads).toBe(0);
      expect(JSON.stringify([solutionResult, commentResult])).not.toContain("leaked detail");
      expect(errorSpy.mock.calls).toEqual(expectedLogCalls);
      for (const call of errorSpy.mock.calls) {
        expect(call.map(String).join(" ")).not.toContain("lý do kiểm duyệt riêng tư");
      }
    }
  );

  it("row 8 (source): adminActions.ts never reads error.message", () => {
    expect(readAdminActionsSource()).not.toMatch(/error\.message|\.message\b/);
  });
});

/** Một hàng hàng-đợi ở dạng snake_case của RPC (migration task 32), không che (S5). */
function queueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "solution-q1",
    exam_id: "exam-q1",
    exam_title: "Đề thi thử THPT 2026",
    author_display_name: "Nguyễn Văn A",
    author_is_anonymous_to_readers: false,
    status: "published",
    report_count: 2,
    report_reasons: ["spam", "sai đáp án"],
    reported_comments: [],
    hidden_comments: [],
    ...overrides,
  };
}

describe("listCommunityReports / getSolutionNotesForAdmin — Required test list rows 9-16 (unmasked admin mappers)", () => {
  beforeEach(() => {
    resetAdminMocks();
    signInFreshAdmin();
  });

  it("row 9: author_is_anonymous_to_readers = true keeps the real name; AdminReportedAuthor has exactly {displayName, isAnonymousToReaders}", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [queueRow({ author_display_name: "Trần Thị Bích", author_is_anonymous_to_readers: true })],
      error: null,
    });

    const [row] = await listCommunityReports();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_list_community_reports");
    expect(row.author.isAnonymousToReaders).toBe(true);
    expect(row.author.displayName).toBe("Trần Thị Bích");
    expect(row.author.displayName).not.toBe("Ẩn danh");
    expect("avatarUrl" in row.author).toBe(false);
    expect(Object.keys(row.author).sort()).toEqual(["displayName", "isAnonymousToReaders"]);
    expect(row).toEqual({
      id: "solution-q1",
      examId: "exam-q1",
      examTitle: "Đề thi thử THPT 2026",
      author: { displayName: "Trần Thị Bích", isAnonymousToReaders: true },
      status: "published",
      reportCount: 2,
      reportReasons: ["spam", "sai đáp án"],
      reportedComments: [],
      hiddenComments: [],
    });
  });

  it("row 10: a hidden_comments entry with question_number null -> questionNumber: null (key present), commenter unmasked", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        queueRow({
          hidden_comments: [
            {
              id: "comment-h1",
              question_number: null,
              body: "Bình luận **thô**",
              commenter_display_name: "Lê Văn C",
              commenter_is_anonymous_to_readers: true,
              hidden_reason: "Xúc phạm",
              hidden_at: "2026-09-20T10:00:00+00:00",
              report_count: 0,
            },
          ],
        }),
      ],
      error: null,
    });

    const [row] = await listCommunityReports();
    const [hidden] = row.hiddenComments;

    expect("questionNumber" in hidden).toBe(true);
    expect(hidden.questionNumber).toBeNull();
    expect(hidden).toEqual({
      id: "comment-h1",
      questionNumber: null,
      body: "Bình luận **thô**",
      commenter: { displayName: "Lê Văn C", isAnonymousToReaders: true },
      hiddenReason: "Xúc phạm",
      hiddenAt: "2026-09-20T10:00:00+00:00",
      reportCount: 0,
    });
  });

  it("row 11: a reported_comments entry with question_number null -> questionNumber: null (the visible half is nullable too)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        queueRow({
          reported_comments: [
            {
              id: "comment-v1",
              question_number: null,
              body: "Bình luận đang hiện",
              commenter_display_name: "Phạm Thị D",
              commenter_is_anonymous_to_readers: false,
              report_count: 3,
              report_reasons: ["spam", "spam", "quấy rối"],
            },
            {
              id: "comment-v2",
              question_number: 4,
              body: "Bình luận câu 4",
              commenter_display_name: "Hoàng Văn E",
              commenter_is_anonymous_to_readers: true,
              report_count: 1,
              report_reasons: ["spam"],
            },
          ],
        }),
      ],
      error: null,
    });

    const [row] = await listCommunityReports();

    expect("questionNumber" in row.reportedComments[0]).toBe(true);
    expect(row.reportedComments).toEqual([
      {
        id: "comment-v1",
        questionNumber: null,
        body: "Bình luận đang hiện",
        commenter: { displayName: "Phạm Thị D", isAnonymousToReaders: false },
        reportCount: 3,
        reportReasons: ["spam", "spam", "quấy rối"],
      },
      {
        id: "comment-v2",
        questionNumber: 4,
        body: "Bình luận câu 4",
        commenter: { displayName: "Hoàng Văn E", isAnonymousToReaders: true },
        reportCount: 1,
        reportReasons: ["spam"],
      },
    ]);
  });

  it("row 12: a hidden row with report_count 0, no reasons, no reported comments and one hidden comment is returned, not filtered out (Reference Contract Value #26)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        queueRow({
          id: "solution-hidden",
          status: "hidden",
          report_count: 0,
          report_reasons: [],
          reported_comments: [],
          hidden_comments: [
            {
              id: "comment-h2",
              question_number: 2,
              body: "Đã ẩn",
              commenter_display_name: "Võ Thị F",
              commenter_is_anonymous_to_readers: false,
              hidden_reason: "Spam",
              hidden_at: "2026-09-21T08:30:00+00:00",
              report_count: 0,
            },
          ],
        }),
      ],
      error: null,
    });

    const rows = await listCommunityReports();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("solution-hidden");
    expect(rows[0].status).toBe("hidden");
    expect(rows[0].reportCount).toBe(0);
    expect(rows[0].reportReasons).toEqual([]);
    expect(rows[0].reportedComments).toEqual([]);
    expect(rows[0].hiddenComments).toHaveLength(1);
  });

  it("row 13: a row with no hidden comment maps hiddenComments to [] (never null or absent)", async () => {
    rpcMock.mockResolvedValueOnce({ data: [queueRow({ hidden_comments: [] })], error: null });

    const [row] = await listCommunityReports();

    expect("hiddenComments" in row).toBe(true);
    expect(row.hiddenComments).toEqual([]);
  });

  it("row 14: no admin row passes through a masking mapper — adminActions.ts references neither toAuthorIdentity nor toScoreField", () => {
    const source = readAdminActionsSource();

    expect(source).not.toContain("toAuthorIdentity");
    expect(source).not.toContain("toScoreField");
    expect(source).not.toMatch(/lib\/solutions\/identity/);
  });

  it("row 15: getSolutionNotesForAdmin(S) maps notes for positions 1 and 3 in array order, body kept as the raw string", async () => {
    const rawBody = "Ta có $x^2 = 4$ nên **x = ±2**.\n\n- bước 1\n- bước 2";
    rpcMock.mockResolvedValueOnce({
      data: [
        { question_number: 1, question_id: "q-1", body: rawBody },
        { question_number: 3, question_id: "q-3", body: "Câu 3: chọn C" },
      ],
      error: null,
    });

    const notes = await getSolutionNotesForAdmin("solution-n1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_get_community_solution_notes", { p_solution_id: "solution-n1" });
    expect(notes).toEqual([
      { questionNumber: 1, questionId: "q-1", body: rawBody },
      { questionNumber: 3, questionId: "q-3", body: "Câu 3: chọn C" },
    ]);
  });

  it("row 16: getSolutionNotesForAdmin(S) with an empty RPC result returns [] as a legal, non-error state", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    await expect(getSolutionNotesForAdmin("solution-empty")).resolves.toEqual([]);
  });
});

// =============================================================================
// Test 2 — saveSolution / setSolutionStatus: cổng kiểm số từ chạy
//   trước mọi lời gọi DB; một từ chối do số từ ánh xạ thành lỗi không rò rỉ,
//   riêng của AC-029, và không bao giờ xoá chữ ghi chú chưa lưu của người gọi
// =============================================================================
// AC: "...nếu status = 'published', từ chối mọi ghi chú có số từ
//   (count_words()) tụt dưới 15 cho một câu hỏi vẫn còn hiện hành (S1)
//   — cả lời gọi rollback, không có gì được lưu một phần" (backend DD § Data
//   Flow, "Writer saves a draft" bước 3); § Error Handling bảng hàng 1
//   (errcode 23514 -> AC-029's "nêu số câu chưa đạt" message; "note text is
//   không bao giờ mất (state nháp phía client độc lập với phản hồi
//   của server)").
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
// Hành vi: setSolutionStatus(examId, "publish") được gọi trên client Supabase
//   phiên mock trả về một phản hồi 23514 (vi phạm check) giả lập
//   -> Server Action ánh xạ nó sang đúng khoá copy.ts của AC-029,
//   không bao giờ là chuỗi/mã lỗi Postgres thô -> một lỗi giả lập thứ hai không liên quan
//   (ví dụ rớt mạng chung) ánh xạ sang thông báo chung riêng biệt
//   "Thao tác thất bại", chứng minh phép ánh xạ đặc thù theo mã lỗi
//   -> không đường mã nào ở cả hai nhánh xoá/đặt lại chữ ghi chú
//   do người gọi cung cấp.
// @category: core-functionality
// @lane: integration
// @dependency: features/solutions/actions.ts (setSolutionStatus, saveSolution)
//   + client Supabase phiên mock
// @complexity: medium
// @real-dependency: không có — client phiên bị mock; việc đánh giá SQL count_words() thật
//   và bảo đảm giao dịch "cả lời gọi rollback" được chứng minh trong
//   service-integration-e2e (Test SE1, theo Early Verification Point của chính
//   backend DD).
// Kiểu hỏng chính: một ghi chú 9 từ được phép đăng vì phản hồi 23514
//   của server bị nuốt hoặc ánh xạ nhầm sang thông báo chung
//   thay vì chữ "chưa đạt" của AC-029, hoặc chữ ghi chú người gọi gõ
//   bị xoá ở nhánh đăng-thất-bại (vi phạm "chữ ghi chú không bao giờ
//   mất").
// Nghĩa vụ chứng minh: khẳng định object kết quả đã ánh xạ cho ca 23514 giả lập
//   mang khoá/chữ thông báo của AC-029 — không phải mã/chuỗi lỗi
//   Postgres thô; khẳng định ca lỗi hạ tầng giả lập mang một
//   khoá thông báo chung, khác; khẳng định giá trị trả về hay tác dụng phụ của
//   cả hai nhánh lỗi đều không tham chiếu việc xoá/đặt lại tham số chữ ghi chú
//   truyền vào action.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - 23514 giả lập -> kết quả Server Action mang khoá thông báo AC-029
//   - lỗi chung/hạ tầng giả lập -> khoá thông báo chung, khác với
//     ca 23514
//   - tham số chữ ghi chú truyền vào saveSolution/setSolutionStatus
//     không bao giờ bị đường mã "xoá"/"đặt lại" nào đụng tới ở cả hai nhánh lỗi
//   - tiêu chí qua: cả hai nhánh lỗi ánh xạ sang các khoá copy riêng biệt, đúng
//     mà không khẳng định nào phụ thuộc một lượt khứ hồi DB thật

describe("saveSolution / setSolutionStatus — word-count validation gate, non-leaking error mapping, note text preserved (Test 2)", () => {
  const CALLER_ID = "writer-test2-caller";

  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
  });

  it("simulated 23514 (check-violation) maps to the AC-029 result code {belowWordCount, missingCount}, never a raw Postgres code/string", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "23514", details: "2" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "belowWordCount", missingCount: 2 } });
    expect(JSON.stringify(result)).not.toContain("23514");
  });

  it("a second, unrelated simulated infra error maps to a distinct generic code, proving the mapping is error-code-specific", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "08006", message: "connection reset" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("neither failure branch's result or the caller's note text is touched (note text is never lost, AC-024/AC-032)", async () => {
    const originalNote = "Ghi chú của người viết, chưa đủ 15 từ, không được đổi.";
    const patch = {
      attemptId: "attempt-1",
      showProfile: true,
      showScore: false,
      notes: [{ questionId: "q1", body: originalNote }],
    };

    rpcMock.mockResolvedValue({ data: null, error: { code: "23514", details: "below_word_count" } });
    const saveResult = await saveSolution("exam-1", patch);
    expect(saveResult).toEqual({ ok: false, error: { code: "belowWordCount" } });
    // Kết quả của chính action không mang chữ ghi chú nào, và object bản vá mà
    // người gọi dựng không bị đụng ở nhánh thất bại — không gì ở đây xoá hay
    // đặt lại nó (reducer giữ chữ nháp nằm ở frontend task 11).
    expect(patch.notes[0].body).toBe(originalNote);
    expect(JSON.stringify(saveResult)).not.toContain(originalNote);

    rpcMock.mockResolvedValue({ data: null, error: { code: "57P01", message: "infra failure" } });
    const statusResult = await setSolutionStatus("exam-1", "publish");
    expect(statusResult).toEqual({ ok: false, error: { code: "generic" } });
    expect(patch.notes[0].body).toBe(originalNote);
  });
});

// =============================================================================
// Test 3 — listSolutions / getSolutionDetail: lượt đọc chỉ đi qua các RPC che,
//   không bao giờ select bảng thô; mapper TS không bao giờ điền bù một trường
//   danh tính/điểm mà hàng RPC không mang
// =============================================================================
// AC: "...định tuyến mọi lượt đọc công khai qua các hàm SECURITY DEFINER che,
//   được xác minh bằng một integration test liệt kê tên các trường trả về"
//   (backend DD § Design Summary, biggest_risks hàng 1); "một mapper được chỉ định
//   là nơi duy nhất xảy ra chuẩn hoá null-sang-vắng"
//   (frontend DD § Design Summary, main_constraints).
// ROI: 88 (BV:9 x Freq:9 + Legal:0 + Defect:7)
// Hành vi: listSolutions(examId) / getSolutionDetail(solutionId)
//   (features/solutions/queries.ts) được gọi trên client Supabase phiên
//   mock -> đúng một lời gọi .rpc cho mỗi hàm
//   ("community_solutions_list" / "community_solution_detail"), không bao giờ
//   .from("community_solutions").select(...) -> khi author_id /
//   author_display_name / author_avatar_path của hàng RPC mock là null (dạng đã che),
//   object TS đã ánh xạ hoàn toàn không có khoá displayName/avatarUrl/authorId
//   cho hàng đó (vắng, không phải có-với-null) -> khi hàng mock
//   không bị che, object đã ánh xạ mang nguyên giá trị của chính fixture.
// @category: core-functionality
// @lane: integration
// @dependency: features/solutions/queries.ts (listSolutions,
//   getSolutionDetail) + client Supabase phiên mock
// @complexity: medium
// @real-dependency: không có — client phiên bị mock với một fixture hàng dựng tay
//   khớp dạng che đã tài liệu hoá của RPC; việc RPC THẬT có thực sự tạo ra
//   dạng đó hay không (che bằng `case when` SQL) chỉ được chứng minh trong
//   service-integration-e2e (Test SE2, khẳng định giá trị null trên một lời gọi
//   sống) — test này không thể và không tuyên bố chứng minh điều đó.
// Kiểu hỏng chính: một thay đổi về sau ở queries.ts đọc thẳng
//   .from("community_solutions") (bỏ qua RPC che) cho một truy vấn danh sách
//   "nhanh", hoặc mapper TS đọc row.author_display_name
//   mà không kiểm null và chuyển tiếp một giá trị lạc/giữ chỗ thay vì
//   bỏ trường — tái mở rủi ro rò danh tính mà cả hai tài liệu thiết kế gọi là rủi ro hàng đầu
//   của tính năng này, lần này ở tầng ánh xạ.
// Nghĩa vụ chứng minh: (a) khẳng định mẫu lời gọi — nhật ký phương thức của
//   client mock chứa đúng một lời gọi .rpc(name, ...) cho mỗi hàm truy vấn
//   đang kiểm, và không lời gọi .from("community_solutions" | "community_solution_notes")
//   nào; (b) khẳng định liệt kê trường trên kết quả đã ánh xạ —
//   Object.keys() của hàng đã ánh xạ cho fixture đã che KHÔNG được chứa
//   "displayName" / "avatarUrl" / "authorId" (khớp nhánh {kind:"anonymous"} của
//   union phân biệt AuthorIdentity), và PHẢI chứa chúng,
//   với giá trị nguyên của chính fixture, cho hàng fixture không che.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - listSolutions() -> đúng một .rpc("community_solutions_list", { p_exam_id })
//   - getSolutionDetail() -> đúng một .rpc("community_solution_detail", { p_solution_id })
//   - hàng fixture đã che -> object đã ánh xạ không có khoá danh tính nào
//   - hàng fixture không che -> object đã ánh xạ có khoá danh tính bằng
//     giá trị của chính fixture (không trôi do biến đổi)
//   - tiêu chí qua: cả bốn khẳng định đúng trong cùng một lượt chạy test

describe("listSolutions / getSolutionDetail — reads route only through the masking RPCs, mapper never backfills identity (Test 3)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("listSolutions() -> exactly one .rpc(\"community_solutions_list\", { p_exam_id }), never .from(\"community_solutions\")", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await listSolutions("exam-1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("community_solutions_list", { p_exam_id: "exam-1" });
  });

  it("getSolutionDetail() -> exactly one .rpc(\"community_solution_detail\", { p_solution_id })", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await getSolutionDetail("sol-1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("community_solution_detail", { p_solution_id: "sol-1" });
  });

  it("masked fixture row (author_display_name null) -> mapped object has no identity keys present", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "sol-1",
          status: "published",
          is_pinned: false,
          updated_at: "2026-09-01T00:00:00.000Z",
          is_mine: false,
          author_id: null,
          author_display_name: null,
          author_avatar_path: null,
          score: null,
          score_grading: null,
          helpful_count: 0,
          i_marked_helpful: false,
          comment_count: 0,
          changed_question_count: 0,
        },
      ],
      error: null,
    });

    const [item] = await listSolutions("exam-1");

    expect(item.author).toEqual({ kind: "anonymous" });
    expect("displayName" in item).toBe(false);
    expect("avatarUrl" in item).toBe(false);
    expect("authorId" in item).toBe(false);
  });

  it("non-masked fixture row -> displayName equals the fixture's own, unchanged; avatarUrl is the signed URL for the fixture's path (task 42 batch signer)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "sol-2",
          status: "published",
          is_pinned: false,
          updated_at: "2026-09-01T00:00:00.000Z",
          is_mine: false,
          author_id: "author-2",
          author_display_name: "Trần Thị B",
          author_avatar_path: "https://example.com/b.png",
          score: null,
          score_grading: null,
          helpful_count: 0,
          i_marked_helpful: false,
          comment_count: 0,
          changed_question_count: 0,
        },
      ],
      error: null,
    });

    const [item] = await listSolutions("exam-1");

    expect(item.author).toEqual({
      kind: "named",
      displayName: "Trần Thị B",
      avatarUrl: "signed:https://example.com/b.png",
    });
  });

  it("empty RPC result -> getSolutionDetail() returns null and listSolutions() returns [] (never throws, AC-063/S11)", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(getSolutionDetail("missing")).resolves.toBeNull();

    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(listSolutions("exam-1")).resolves.toEqual([]);
  });

  it("a nested masked comment row -> mapped comment has no identity keys, identity is exactly {kind:'anonymous'}", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "sol-3",
          author_id: "author-3",
          author_display_name: "Tác giả",
          author_avatar_path: "a.png",
          is_pinned: false,
          updated_at: "2026-09-01T00:00:00.000Z",
          score: null,
          score_grading: null,
          per_question: null,
          is_mine: false,
          helpful_count: 0,
          i_marked_helpful: false,
          i_reported: false,
          questions: [
            {
              question_id: "q1",
              stem: "stem",
              correct_answer: "A",
              has_changed: false,
              note: "Ghi chú đủ mười lăm từ để mở khoá bề mặt bình luận cho câu hỏi này hôm nay",
              comment_count: 1,
              comments: [
                {
                  id: "c1",
                  author_id: null,
                  author_display_name: null,
                  author_avatar_path: null,
                  is_solution_author: false,
                  is_mine: false,
                  body: "Bình luận ẩn danh",
                  is_hidden_by_admin: false,
                  hidden_reason: null,
                  i_reported: false,
                  created_at: "2026-09-01T00:00:00.000Z",
                },
              ],
            },
          ],
        },
      ],
      error: null,
    });

    const detail = await getSolutionDetail("sol-3");

    const [comment] = detail!.questions[0].comments;
    expect(comment.author).toEqual({ kind: "anonymous" });
    expect("displayName" in comment).toBe(false);
    expect("avatarUrl" in comment).toBe(false);
  });
});
