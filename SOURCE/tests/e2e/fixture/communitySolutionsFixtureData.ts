// Community Solutions — dữ liệu fixture + một "backend fixture" nhỏ trong bộ nhớ có trạng thái
// cho Test J1 (community-solutions.fixture.e2e.test.ts). Theo hình dạng của
// supportFixtureData.ts (hằng + hàm dựng thuần) — thêm một thứ ở đây
// là `FixtureStore`, cần vì J1 nối BA ranh giới route trong một phiên driver
// (task file § Proof Obligations: "đầu ra của bước TRƯỚC ảnh hưởng quan sát được
// tới render do fixture điều khiển của bước SAU"). Một fixture "đã đăng"
// độc lập, soạn tay cho điểm kiểm màn xem có thể lặng lẽ lệch khỏi thứ
// màn viết thực sự đã làm; định tuyến mọi lượt ghi bị mock qua một store này và đọc
// lại nó cho điểm kiểm màn xem là thứ làm chuỗi thật thay vì
// ba lần tải trang độc lập tình cờ khớp nhau theo cấu trúc.
import type {
  ResultCardSummary,
  SolutionDetail,
  SolutionDetailComment,
  SolutionDetailQuestion,
  SolutionEditorQuestion,
  SolutionEditorState,
  SolutionListItem,
  SolutionStatus,
} from "@/features/solutions/queries";
import type { SaveSolutionResult, SetSolutionStatusResult } from "@/features/solutions/actions";
import type { ExamResult } from "@/features/exams/queries";
import type { Exam } from "@/types/exam";
// Các hàm che THẬT, không mock (ràng buộc cứng task 24: identity.ts không bao giờ bị mock) —
// module fixture này thế chỗ bước ánh xạ mà
// `features/solutions/queries.ts` thường chạy (module đó bị `vi.mock` hoàn toàn
// trong file test), nên các hàng bị che của Test 2 vẫn được tạo bởi
// code che thật, không phải một literal `{kind:"anonymous"}` gõ tay.
import { toAuthorIdentity, toScoreField } from "@/lib/solutions/identity";

export const FIXTURE_EXAM_ID = "exam-fixture-1";
export const FIXTURE_ATTEMPT_ID = "attempt-fixture-1";
export const FIXTURE_SOLUTION_ID = "solution-fixture-1";

/** >=15 từ — gỡ cổng đăng trên một hàng. */
export const FIFTEEN_WORD_NOTE =
  "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm";
/** <15 từ (4) — giữ cổng đăng bị chặn ở hàng nào đang giữ nó. */
export const SHORT_NOTE = "chưa đủ mười lăm từ";

/** Tiền tố mà "backend" fixture đóng dấu lên mọi ghi chú nó phản hồi qua
 *  `getSolutionDetail` — chuỗi duy nhất CHỈ có thể xuất hiện ở S-05 nếu màn
 *  đó thực sự render phản hồi lấy-sau-đăng, không bao giờ một vọng lại phía
 *  client của thứ đã gõ ở S-04 (về kiến trúc không có vọng lại nào như vậy,
 *  nhưng điều này giữ bằng chứng tự hiển nhiên chỉ từ chữ đã render). */
export const SERVER_NOTE_PREFIX = "[fixture-server] ";

export function fixtureQuestion(overrides: Partial<SolutionEditorQuestion> = {}): SolutionEditorQuestion {
  return {
    questionId: "q1",
    stem: "Đề bài fixture",
    correctAnswer: "A",
    myResult: null,
    note: "",
    wordCount: 0,
    hasChanged: false,
    essayPrefillApplied: false,
    questionType: "mcq",
    choices: [
      { id: "A", text: "Phương án A" },
      { id: "B", text: "Phương án B" },
    ],
    ...overrides,
  };
}

/** Lượt tải ban đầu của người viết (S-04) cho một người nộp CHƯA có bài giải
 *  (myStatus="none") — `solutionId: null`, hai câu hỏi hiện hành. */
export function fixtureWriterState(overrides: Partial<SolutionEditorState> = {}): SolutionEditorState {
  return {
    solutionId: null,
    attemptId: FIXTURE_ATTEMPT_ID,
    status: null,
    showProfile: true,
    showScore: true,
    questions: [fixtureQuestion({ questionId: "q1" }), fixtureQuestion({ questionId: "q2" })],
    ...overrides,
  };
}

/** Fixture `getResultCardSummary` cho S-01 — myStatus="none" (chưa có bài giải)
 *  hiện CTA viết, không phải các nhãn tiếp tục/sửa/ẩn. */
export function fixtureResultCardSummary(overrides: Partial<ResultCardSummary> = {}): ResultCardSummary {
  return {
    publishedCount: 0,
    myStatus: null,
    changedQuestionCount: 0,
    unseenDeletionReason: null,
    ...overrides,
  };
}

/** `ExamResult` cũ (không có khoá essay* nào) — giữ `EssayGradingPoller`
 *  không mount (vị từ tính-năng-tắt của chính frontend DD), nên `useRouter()`
 *  không bao giờ được gọi và render trang kết quả không cần mock `next/navigation`
 *  ngoài `redirect`. */
export function fixtureExamResult(overrides: Partial<ExamResult> = {}): ExamResult {
  return {
    examId: FIXTURE_EXAM_ID,
    examTitle: "Đề fixture J1",
    subject: "Toán",
    result: {
      totalScore: 8,
      correct: 4,
      total: 5,
      topicBreakdown: [],
      perQuestion: [],
    },
    questions: {},
    startedAt: "2026-09-20T09:00:00.000Z",
    submittedAt: "2026-09-20T09:40:00.000Z",
    overtimeSeconds: 0,
    hasIncompleteEssay: false,
    ...overrides,
  };
}

export function fixtureExam(overrides: Partial<Exam> = {}): Exam {
  return { id: FIXTURE_EXAM_ID, title: "Đề fixture J1", ...overrides } as Exam;
}

function fixtureDetailQuestion(overrides: Partial<SolutionDetailQuestion> = {}): SolutionDetailQuestion {
  return {
    questionId: "q1",
    stem: "Đề bài fixture",
    correctAnswer: "A",
    hasChanged: false,
    comments: [],
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// FixtureStore — "backend fixture" có trạng thái làm 3 điểm kiểm nối chuỗi thật
// (pha Refactor: các HÀNG fixture nằm ở đây, file driver/test chỉ nối
// dây vi.mock quanh chúng).
// -----------------------------------------------------------------------------

export interface FixtureStore {
  solutionId: string | null;
  status: SolutionStatus | null;
  /** questionId -> đúng thân ghi chú mà màn viết đã thực sự lưu. */
  notes: Record<string, string>;
}

export function createFixtureStore(): FixtureStore {
  return { solutionId: null, status: null, notes: {} };
}

/** `saveSolution()` fixture — lần gọi đầu tạo hàng (gán
 *  `FIXTURE_SOLUTION_ID` và trạng thái "draft"), khớp ngữ nghĩa upsert thật của
 *  `save_community_solution`; mỗi lần gọi ghi lại các ghi chú nó nhận. */
export function fixtureSaveSolution(
  store: FixtureStore,
  patch: { notes: { questionId: string; body: string }[] }
): SaveSolutionResult {
  for (const note of patch.notes) store.notes[note.questionId] = note.body;
  if (store.solutionId === null) {
    store.solutionId = FIXTURE_SOLUTION_ID;
    store.status = "draft";
  }
  return { ok: true, solutionId: store.solutionId, status: store.status as SolutionStatus };
}

/** `setSolutionStatus()` fixture — resolve ở ranh giới microtask (không bao giờ
 *  đồng bộ), điều cho phép J1 quan sát chuyển đổi đăng không-lạc-quan của màn viết
 *  mà không cần Promise giữ tay nào. */
export async function fixtureSetSolutionStatus(
  store: FixtureStore,
  action: "publish" | "draft"
): Promise<SetSolutionStatusResult> {
  await Promise.resolve();
  store.status = action === "publish" ? "published" : "draft";
  return { ok: true, status: store.status };
}

/** `getMySolutionForWriter()` fixture gắn với store — được màn xem (S-05) đọc lại
 *  sau khi đăng, nên `own`/`editHref` ở đó phản ánh CÙNG solutionId
 *  mà màn viết đã tạo, không phải một giá trị soạn độc lập. */
export function fixtureGetMySolutionForWriter(store: FixtureStore): SolutionEditorState {
  return fixtureWriterState({
    solutionId: store.solutionId,
    status: store.status,
    questions: [
      fixtureQuestion({ questionId: "q1", note: store.notes.q1 ?? "", wordCount: (store.notes.q1 ?? "").trim() === "" ? 0 : store.notes.q1.trim().split(/\s+/).length }),
      fixtureQuestion({ questionId: "q2", note: store.notes.q2 ?? "", wordCount: (store.notes.q2 ?? "").trim() === "" ? 0 : store.notes.q2.trim().split(/\s+/).length }),
    ],
  });
}

/** `getSolutionDetail()` fixture — `null` trừ khi bài giải VỪA là cái
 *  store này tạo ra VỪA đã đăng (phản chiếu cổng R1 của chính
 *  `community_solution_detail`); mọi thân ghi chú được đóng dấu bằng `SERVER_NOTE_PREFIX` nên
 *  một khẳng định S-05 qua là bằng chứng màn đã render phản hồi lấy dữ liệu NÀY. */
export function fixtureGetSolutionDetail(store: FixtureStore, solutionId: string): SolutionDetail | null {
  if (store.solutionId === null || solutionId !== store.solutionId || store.status !== "published") {
    return null;
  }
  return {
    id: store.solutionId,
    author: { kind: "named", displayName: "Người viết fixture" },
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: true,
    helpfulCount: 0,
    iMarkedHelpful: false,
    iReported: false,
    questions: [
      fixtureDetailQuestion({
        questionId: "q1",
        note: { body: `${SERVER_NOTE_PREFIX}${store.notes.q1 ?? ""}` },
      }),
      fixtureDetailQuestion({
        questionId: "q2",
        note: { body: `${SERVER_NOTE_PREFIX}${store.notes.q2 ?? ""}` },
      }),
    ],
  };
}

// -----------------------------------------------------------------------------
// Test 2 (task 24) — các hàng ẩn danh/che điểm của S-03 (danh sách) + S-05 (chi tiết).
// -----------------------------------------------------------------------------
// Ba bài giải, mỗi cái cô lập đúng MỘT thuộc tính đang kiểm: một hàng CÓ TÊN
// (mốc — chứng minh kỹ thuật truy vấn/DOM bên dưới CÓ THỂ tìm thấy một danh tính
// thật khi có), một hàng ẨN DANH (danh tính bị che, điểm
// vẫn hiện — show_profile và show_score là cờ độc lập, nên
// ẩn danh không được đồng thời làm trống một điểm hiện hợp lệ), và
// một hàng show_score=false (danh tính hiện, điểm bị che). `.author`/`.score`
// trên mỗi hàng được tạo bằng gọi `toAuthorIdentity`/
// `toScoreField` THẬT trên đầu vào `null`-tại-nguồn (author_display_name/
// author_avatar_url/score đều `null`) — phản chiếu hợp đồng RPC thật,
// nơi việc che đã xảy ra trước khi hàng tới frontend
// (backend DD § Field Propagation Map; D003).

/** Origin `isAllowedImageUrl` của `components/shared/QuestionFigure.ts` cho phép
 *  qua `NEXT_PUBLIC_SUPABASE_URL` — cùng origin fixture
 *  mà `AuthorIdentity.test.tsx` dùng. Test 2 đặt biến env này để `<img>`
 *  của hàng CÓ TÊN là thật và quan sát được (không bị bỏ vì trượt danh sách cho phép),
 *  điều làm các phép kiểm vắng-mặt của hàng ẨN DANH/ẩn điểm
 *  có ý nghĩa thay vì đúng một cách rỗng nghĩa. */
export const T2_AVATAR_ORIGIN = "https://test-project.supabase.co";

export const T2_NAMED_SOLUTION_ID = "solution-fixture-t2-named";
export const T2_ANONYMOUS_SOLUTION_ID = "solution-fixture-t2-anonymous";
export const T2_HIDDEN_SCORE_SOLUTION_ID = "solution-fixture-t2-hidden-score";

export const T2_NAMED_AUTHOR_DISPLAY_NAME = "Nguyễn Thị Công Khai";
export const T2_NAMED_AUTHOR_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/named/a.png?token=x`;
const T2_NAMED_AUTHOR_SCORE = 8.5;

/** Điểm của hàng ẩn danh ĐƯỢC hiện — show_score/show_profile là cờ che độc lập
 *  (backend DD), nên điều này chứng minh chỉ ẩn danh thì không đồng thời
 *  làm trống một điểm hiện hợp lệ. */
export const T2_ANONYMOUS_AUTHOR_SCORE = 6.0;

/** Danh tính thật đằng sau hàng ẨN DANH — phản chiếu hồ sơ của tác giả này
 *  thực sự là gì trước khi RPC che `author_display_name`/
 *  `author_avatar_path` thành `null` cho hàng `show_profile=false` (D003). Chuỗi
 *  này KHÔNG BAO GIỜ được đưa vào `toAuthorIdentity` cho hàng thực sự được render
 *  trong Test 2 bên dưới (chỉ `null` được đưa, khớp dạng RPC che thật) — nó
 *  tồn tại để các khẳng định vắng-mặt trong test kiểm một giá trị THẬT
 *  có thể đã rò, không phải một chuỗi rơm mà không gì sinh ra (yêu cầu cứng
 *  của task 24). Nó cũng là giá trị dùng cho bằng chứng
 *  phân biệt ở pha RED (Investigation Notes): tạm dựng `.author` của
 *  hàng này là `{kind:"named", displayName: T2_ANONYMOUS_REAL_DISPLAY_NAME,
 *  avatarUrl: T2_ANONYMOUS_REAL_AVATAR_URL}` — bỏ qua `toAuthorIdentity`,
 *  đúng lớp hồi quy mà test này canh — làm các khẳng định vắng-mặt đỏ; trả lại
 *  lời gọi `null`-tại-nguồn làm chúng xanh lại. */
export const T2_ANONYMOUS_REAL_DISPLAY_NAME = "Đặng Văn Giấu Tên Thật";
export const T2_ANONYMOUS_REAL_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/anon/b.png?token=y`;

export const T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME = "Lê Văn Ẩn Điểm";
/** Cùng lý do với `T2_ANONYMOUS_REAL_DISPLAY_NAME`, cho hàng che điểm:
 *  điểm thật mà tác giả này thực sự đạt, mà `toScoreField` phải
 *  gỡ thành một khoá VẮNG (không bao giờ `null`/`0` thay thế nó). */
export const T2_HIDDEN_SCORE_REAL_VALUE = 9.9;

/** Phản chiếu `mapScoreFields` (`features/solutions/queries.ts`) dùng
 *  `toScoreField` THẬT — `score: null` là dạng che-tại-nguồn mà một
 *  hàng RPC `show_score=false` thực sự mang. */
function t2MapScore(score: number | null): { score?: number } {
  const scored = toScoreField({ score });
  return "score" in scored ? { score: scored.score } : {};
}

function t2ListItem(overrides: Partial<SolutionListItem> = {}): SolutionListItem {
  return {
    id: "solution-fixture-t2-base",
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    author: { kind: "anonymous" },
    helpfulCount: 1,
    iMarkedHelpful: false,
    commentCount: 0,
    changedQuestionCount: 0,
    ...overrides,
  };
}

/** Fixture `listSolutions()` cho S-03 — bộ ba CÓ TÊN/ẨN DANH/ẩn điểm
 *  mô tả ở trên. */
export function fixtureListSolutionsForAnonymityCheck(): SolutionListItem[] {
  return [
    t2ListItem({
      id: T2_NAMED_SOLUTION_ID,
      author: toAuthorIdentity({
        author_display_name: T2_NAMED_AUTHOR_DISPLAY_NAME,
        author_avatar_url: T2_NAMED_AUTHOR_AVATAR_URL,
      }),
      ...t2MapScore(T2_NAMED_AUTHOR_SCORE),
    }),
    t2ListItem({
      id: T2_ANONYMOUS_SOLUTION_ID,
      author: toAuthorIdentity({ author_display_name: null, author_avatar_url: null }),
      ...t2MapScore(T2_ANONYMOUS_AUTHOR_SCORE),
    }),
    t2ListItem({
      id: T2_HIDDEN_SCORE_SOLUTION_ID,
      author: toAuthorIdentity({
        author_display_name: T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME,
        author_avatar_url: null,
      }),
      ...t2MapScore(null),
    }),
  ];
}

function t2DetailBase(overrides: Partial<SolutionDetail> = {}): SolutionDetail {
  return {
    id: "solution-fixture-t2-base",
    author: { kind: "anonymous" },
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    helpfulCount: 1,
    iMarkedHelpful: false,
    iReported: false,
    questions: [],
    ...overrides,
  };
}

const T2_SOLUTION_DETAILS: Record<string, SolutionDetail> = {
  [T2_NAMED_SOLUTION_ID]: t2DetailBase({
    id: T2_NAMED_SOLUTION_ID,
    author: toAuthorIdentity({
      author_display_name: T2_NAMED_AUTHOR_DISPLAY_NAME,
      author_avatar_url: T2_NAMED_AUTHOR_AVATAR_URL,
    }),
    ...t2MapScore(T2_NAMED_AUTHOR_SCORE),
  }),
  [T2_ANONYMOUS_SOLUTION_ID]: t2DetailBase({
    id: T2_ANONYMOUS_SOLUTION_ID,
    author: toAuthorIdentity({ author_display_name: null, author_avatar_url: null }),
    ...t2MapScore(T2_ANONYMOUS_AUTHOR_SCORE),
  }),
  [T2_HIDDEN_SCORE_SOLUTION_ID]: t2DetailBase({
    id: T2_HIDDEN_SCORE_SOLUTION_ID,
    author: toAuthorIdentity({
      author_display_name: T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME,
      author_avatar_url: null,
    }),
    ...t2MapScore(null),
  }),
};

/** Fixture `getSolutionDetail()` cho S-05 — cùng bộ ba, khoá theo solutionId
 *  (tham số route) vì màn chi tiết render một bài giải mỗi lượt xem. */
export function fixtureGetSolutionDetailForAnonymityCheck(solutionId: string): SolutionDetail | null {
  return T2_SOLUTION_DETAILS[solutionId] ?? null;
}

// -----------------------------------------------------------------------------
// Test 2 (task 30) — phần sheet bình luận O-02. Cùng kỷ luật cô lập như
// bộ ba S-03/S-05 ở trên: một bài giải riêng (danh tính tác giả của chính nó
// không liên quan ở đây, dùng lại từ T2_NAMED_* — test này chỉ khẳng định trên
// các hàng BÌNH LUẬN, không bao giờ trên thẻ tác giả bài giải) mang đúng một câu hỏi
// với ba hàng bình luận, mỗi hàng cô lập MỘT thuộc tính: một bình luận CÓ TÊN
// (mốc), một bình luận ẨN DANH (danh tính bị che), và một bình luận của
// NGƯỜI VIẾT bài giải mà CŨNG bình luận ẩn danh (`is_solution_author: true`
// + `{kind:"anonymous"}` cùng nhau — đúng tổ hợp mà các unit test của chính task 28
// (CommentItem.test.tsx Required Test #3) đã chứng minh riêng lẻ;
// test fixture-e2e này chứng minh CÙNG tổ hợp qua màn hình render thật). `.author` trên
// các hàng ẩn danh/người viết được tạo bằng `toAuthorIdentity` THẬT
// gọi trên đầu vào `null`-tại-nguồn (cùng kỹ thuật như bộ ba S-03/S-05) —
// không bao giờ một literal `{kind:"anonymous"}` gõ tay.
// -----------------------------------------------------------------------------

export const T2_COMMENTS_SOLUTION_ID = "solution-fixture-t2-comments";
export const T2_COMMENTS_QUESTION_ID = "q1";

export const T2_COMMENT_NAMED_ID = "comment-fixture-t2-named";
export const T2_COMMENT_NAMED_DISPLAY_NAME = "Phạm Thị Bình Luận Công Khai";
export const T2_COMMENT_NAMED_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/comment-named/c.png?token=z`;
export const T2_COMMENT_NAMED_BODY = "Bình luận có tên hiển thị bình thường.";

export const T2_COMMENT_ANONYMOUS_ID = "comment-fixture-t2-anonymous";
/** Danh tính thật đằng sau bình luận ẨN DANH — cùng lý do như
 *  `T2_ANONYMOUS_REAL_DISPLAY_NAME` ở trên: không bao giờ đưa vào `toAuthorIdentity`
 *  cho hàng thực sự được render (chỉ `null` được đưa); tồn tại để các khẳng định
 *  vắng-mặt kiểm một giá trị THẬT có thể đã rò, và kiêm
 *  giá trị thay thế của bằng chứng phân biệt pha RED (Investigation Notes:
 *  tạm dựng `.author` của hàng này là
 *  `{kind:"named", displayName: T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME,
 *  avatarUrl: T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL}` — bỏ qua
 *  `toAuthorIdentity` — làm các khẳng định vắng-mặt đỏ; trả lại lời gọi
 *  `null`-tại-nguồn làm chúng xanh lại). */
export const T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME = "Vũ Văn Ẩn Danh Bình Luận";
export const T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/comment-anon/d.png?token=w`;
export const T2_COMMENT_ANONYMOUS_BODY = "Bình luận ẩn danh của một người dùng khác.";

export const T2_COMMENT_WRITER_ID = "comment-fixture-t2-writer";
/** Cùng lý do với `T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME`, cho hàng
 *  VỪA là người viết bài giải VỪA ẩn danh — danh tính thật mà
 *  must stay absent even though "Người viết" renders alongside "Ẩn danh". */
export const T2_COMMENT_WRITER_REAL_DISPLAY_NAME = "Đỗ Thị Người Viết Ẩn Danh";
export const T2_COMMENT_WRITER_REAL_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/comment-writer/e.png?token=v`;
export const T2_COMMENT_WRITER_BODY = "Bình luận ẩn danh của chính người viết bài giải.";

/** Ba hàng bình luận cho câu hỏi duy nhất của `T2_COMMENTS_SOLUTION_ID` — cũ
 *  trước, mới sau (thứ tự bố cục của UI Spec § Component: CommentSheet). */
function fixtureT2Comments(): SolutionDetailComment[] {
  return [
    {
      id: T2_COMMENT_NAMED_ID,
      author: toAuthorIdentity({
        author_display_name: T2_COMMENT_NAMED_DISPLAY_NAME,
        author_avatar_url: T2_COMMENT_NAMED_AVATAR_URL,
      }),
      isSolutionAuthor: false,
      isMine: false,
      body: T2_COMMENT_NAMED_BODY,
      iReported: false,
      createdAt: "2026-09-20T10:00:00.000Z",
    },
    {
      id: T2_COMMENT_ANONYMOUS_ID,
      author: toAuthorIdentity({ author_display_name: null, author_avatar_url: null }),
      isSolutionAuthor: false,
      isMine: false,
      body: T2_COMMENT_ANONYMOUS_BODY,
      iReported: false,
      createdAt: "2026-09-20T10:01:00.000Z",
    },
    {
      id: T2_COMMENT_WRITER_ID,
      author: toAuthorIdentity({ author_display_name: null, author_avatar_url: null }),
      isSolutionAuthor: true,
      isMine: false,
      body: T2_COMMENT_WRITER_BODY,
      iReported: false,
      createdAt: "2026-09-20T10:02:00.000Z",
    },
  ];
}

T2_SOLUTION_DETAILS[T2_COMMENTS_SOLUTION_ID] = t2DetailBase({
  id: T2_COMMENTS_SOLUTION_ID,
  author: toAuthorIdentity({
    author_display_name: T2_NAMED_AUTHOR_DISPLAY_NAME,
    author_avatar_url: T2_NAMED_AUTHOR_AVATAR_URL,
  }),
  ...t2MapScore(T2_NAMED_AUTHOR_SCORE),
  questions: [fixtureDetailQuestion({ questionId: T2_COMMENTS_QUESTION_ID, comments: fixtureT2Comments() })],
});

// -----------------------------------------------------------------------------
// Test 3 (task 31) — MỘT payload XSS dùng chung áp lên CẢ một fixture ghi chú
// (S-05, RichText render trực tiếp ở server của SolutionNoteBlock) và một fixture bình luận
// (O-02, RichText import động của CommentItem) — điểm là chứng minh
// CÙNG payload đó vô hại trên cả hai đường render độc lập, chứ không phải hai
// payload chọn riêng. Dùng lại CÙNG bảng tra `T2_SOLUTION_DETAILS`/
// `fixtureGetSolutionDetailForAnonymityCheck` mà Test 2 đã nối
// qua `getSolutionDetailMock` — task này thêm một mục nữa, không đưa vào
// một cơ chế tra cứu fixture thứ hai.
//
// HÌNH DẠNG payload phản chiếu (không chép) các nhóm task 11/28 trong
// `RichText.xss.test.tsx`: một vector <script> + một vector <img onerror>,
// gộp thành một chuỗi.
// -----------------------------------------------------------------------------

export const XSS_SHARED_PAYLOAD =
  'Xem hình <img src="x" onerror="alert(1)"> rồi đọc <script>alert("xss")</script> kỹ nhé';

export const T3_XSS_SOLUTION_ID = "solution-fixture-t3-xss";
export const T3_XSS_QUESTION_ID = "q1";
export const T3_XSS_COMMENT_ID = "comment-fixture-t3-xss";
/** Dùng lại làm tên tác giả của bình luận duy nhất — test tìm hàng bình luận O-02
 *  theo CHÍNH tên này (không bao giờ theo chuỗi payload thô, theo Proof
 *  Obligation của task này: khẳng định trên DOM đã render, không phải chuỗi
 *  fixture). */
export const T3_XSS_COMMENT_AUTHOR_DISPLAY_NAME = T2_COMMENT_NAMED_DISPLAY_NAME;

T2_SOLUTION_DETAILS[T3_XSS_SOLUTION_ID] = t2DetailBase({
  id: T3_XSS_SOLUTION_ID,
  author: toAuthorIdentity({
    author_display_name: T2_NAMED_AUTHOR_DISPLAY_NAME,
    author_avatar_url: T2_NAMED_AUTHOR_AVATAR_URL,
  }),
  ...t2MapScore(T2_NAMED_AUTHOR_SCORE),
  questions: [
    fixtureDetailQuestion({
      questionId: T3_XSS_QUESTION_ID,
      // Thân ghi chú S-05 — cùng chuỗi với thân bình luận bên dưới.
      note: { body: XSS_SHARED_PAYLOAD },
      comments: [
        {
          id: T3_XSS_COMMENT_ID,
          author: toAuthorIdentity({
            author_display_name: T3_XSS_COMMENT_AUTHOR_DISPLAY_NAME,
            author_avatar_url: T2_COMMENT_NAMED_AVATAR_URL,
          }),
          isSolutionAuthor: false,
          isMine: false,
          // Thân bình luận O-02 — CÙNG chuỗi đó, không phải một payload thứ hai
          // soạn độc lập.
          body: XSS_SHARED_PAYLOAD,
          iReported: false,
          createdAt: "2026-09-20T10:03:00.000Z",
        },
      ],
    }),
  ],
});
