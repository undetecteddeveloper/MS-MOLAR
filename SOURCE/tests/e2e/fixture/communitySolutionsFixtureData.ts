// Community Solutions — fixture data + a small stateful in-memory "fixture
// backend" for Test J1 (community-solutions.fixture.e2e.test.ts). Mirrors
// supportFixtureData.ts's shape (constants + plain builder functions) — the
// one addition here is `FixtureStore`, needed because J1 chains THREE route
// boundaries in one driver session (task file § Proof Obligations: "the
// PREVIOUS step's output observably affecting the NEXT step's fixture-driven
// render"). A hand-authored, independent "already published" fixture for the
// view-screen checkpoint could silently diverge from what the write screen
// actually did; routing every mocked write through this one store and reading
// it back for the view-screen checkpoint is what makes the chain real instead
// of three independent page loads that happen to agree by construction.
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
// REAL, unmocked masking functions (task 24 hard constraint: identity.ts never
// mocked) — this fixture module stands in for the mapping step that
// `features/solutions/queries.ts` would normally run (that module is fully
// `vi.mock`ed in the test file), so Test 2's masked rows are still produced by
// the actual masking code, not a hand-typed `{kind:"anonymous"}` literal.
import { toAuthorIdentity, toScoreField } from "@/lib/solutions/identity";

export const FIXTURE_EXAM_ID = "exam-fixture-1";
export const FIXTURE_ATTEMPT_ID = "attempt-fixture-1";
export const FIXTURE_SOLUTION_ID = "solution-fixture-1";

/** >=15 words — clears the publish gate on a row. */
export const FIFTEEN_WORD_NOTE =
  "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn mười-lăm";
/** <15 words (4) — keeps the publish gate blocked on whichever row holds it. */
export const SHORT_NOTE = "chưa đủ mười lăm từ";

/** Prefix the fixture "backend" stamps on every note it echoes back through
 *  `getSolutionDetail` — the one string that can ONLY appear on S-05 if that
 *  screen actually rendered the post-publish fetch response, never a client-
 *  side echo of what was typed on S-04 (no such echo exists architecturally,
 *  but this keeps the proof self-evident from the rendered text alone). */
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

/** The writer's initial load (S-04) for a submitter with NO existing solution
 *  (myStatus="none") — `solutionId: null`, two current questions. */
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

/** `getResultCardSummary` fixture for S-01 — myStatus="none" (no existing
 *  solution) shows the write CTA, not the continue/edit/hidden labels. */
export function fixtureResultCardSummary(overrides: Partial<ResultCardSummary> = {}): ResultCardSummary {
  return {
    publishedCount: 0,
    myStatus: null,
    changedQuestionCount: 0,
    unseenDeletionReason: null,
    ...overrides,
  };
}

/** Legacy `ExamResult` (no essay* keys anywhere) — keeps `EssayGradingPoller`
 *  unmounted (frontend DD's own feature-off predicate), so `useRouter()` is
 *  never called and the result-page render needs no `next/navigation` mock
 *  beyond `redirect`. */
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
// FixtureStore — the stateful "fixture backend" that makes the 3 checkpoints
// chain for real (Refactor phase: fixture ROWS live here, the driver/test file
// only wires vi.mock plumbing around them).
// -----------------------------------------------------------------------------

export interface FixtureStore {
  solutionId: string | null;
  status: SolutionStatus | null;
  /** questionId -> the exact note body the write screen actually saved. */
  notes: Record<string, string>;
}

export function createFixtureStore(): FixtureStore {
  return { solutionId: null, status: null, notes: {} };
}

/** Fixture `saveSolution()` — first call creates the row (assigns
 *  `FIXTURE_SOLUTION_ID` and status "draft"), matching `save_community_solution`'s
 *  real upsert semantics; every call records the notes it was given. */
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

/** Fixture `setSolutionStatus()` — resolves on a microtask boundary (never
 *  synchronously), which is what lets J1 observe the write screen's non-
 *  optimistic publish transition without any manually-held Promise. */
export async function fixtureSetSolutionStatus(
  store: FixtureStore,
  action: "publish" | "draft"
): Promise<SetSolutionStatusResult> {
  await Promise.resolve();
  store.status = action === "publish" ? "published" : "draft";
  return { ok: true, status: store.status };
}

/** Fixture `getMySolutionForWriter()` bound to the store — read again by the
 *  view screen (S-05) after publish, so `own`/`editHref` there reflect the
 *  SAME solutionId the write screen produced, not an independently authored
 *  value. */
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

/** Fixture `getSolutionDetail()` — `null` unless the solution is BOTH the one
 *  this store produced AND published (mirrors `community_solution_detail`'s
 *  own R1 gate); every note body is stamped with `SERVER_NOTE_PREFIX` so a
 *  passing S-05 assertion is proof the screen rendered THIS fetch response. */
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
// Test 2 (task 24) — S-03 (list) + S-05 (detail) anonymity/score-masking rows.
// -----------------------------------------------------------------------------
// Three solutions, each isolating exactly ONE property under test: a NAMED
// row (baseline — proves the query/DOM technique below CAN find a real
// identity when one is present), an ANONYMOUS row (identity masked, score
// still visible — show_profile and show_score are independent flags, so
// anonymity must not also blank a legitimately visible score), and a
// show_score=false row (identity visible, score masked). `.author`/`.score`
// on every row is produced by calling the REAL `toAuthorIdentity`/
// `toScoreField` on a `null`-at-the-source input (author_display_name/
// author_avatar_url/score all `null`) — mirroring the actual RPC contract,
// where masking already happened before the row ever reaches the frontend
// (backend DD § Field Propagation Map; D003).

/** Origin `components/shared/QuestionFigure.ts` `isAllowedImageUrl` allow-lists
 *  via `NEXT_PUBLIC_SUPABASE_URL` — same fixture origin
 *  `AuthorIdentity.test.tsx` uses. Test 2 sets this env var so the NAMED row's
 *  `<img>` is real and observable (not skipped for failing the allowlist),
 *  which is what makes the ANONYMOUS/hidden-score rows' absence checks
 *  meaningful rather than vacuously true. */
export const T2_AVATAR_ORIGIN = "https://test-project.supabase.co";

export const T2_NAMED_SOLUTION_ID = "solution-fixture-t2-named";
export const T2_ANONYMOUS_SOLUTION_ID = "solution-fixture-t2-anonymous";
export const T2_HIDDEN_SCORE_SOLUTION_ID = "solution-fixture-t2-hidden-score";

export const T2_NAMED_AUTHOR_DISPLAY_NAME = "Nguyễn Thị Công Khai";
export const T2_NAMED_AUTHOR_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/named/a.png?token=x`;
const T2_NAMED_AUTHOR_SCORE = 8.5;

/** Anonymous row's score IS shown — show_score/show_profile are independent
 *  masking flags (backend DD), so this proves anonymity alone does not also
 *  blank a legitimately visible score. */
export const T2_ANONYMOUS_AUTHOR_SCORE = 6.0;

/** The real identity behind the ANONYMOUS row — mirrors what this author's
 *  profile actually is before the RPC masks `author_display_name`/
 *  `author_avatar_path` to `null` for a `show_profile=false` row (D003). This
 *  string is NEVER fed into `toAuthorIdentity` for the row actually rendered
 *  in Test 2 below (only `null` is, matching the true masked RPC shape) — it
 *  exists so the absence assertions in the test check for a REAL value that
 *  could have leaked, not a strawman string nothing ever produces (task 24
 *  hard requirement). It is also the value used for the RED-phase
 *  discrimination proof (Investigation Notes): temporarily building this
 *  row's `.author` as `{kind:"named", displayName: T2_ANONYMOUS_REAL_DISPLAY_NAME,
 *  avatarUrl: T2_ANONYMOUS_REAL_AVATAR_URL}` — bypassing `toAuthorIdentity`,
 *  the exact class of regression this test guards against — turns the
 *  absence assertions red; reverting to the `null`-at-source call turns them
 *  green again. */
export const T2_ANONYMOUS_REAL_DISPLAY_NAME = "Đặng Văn Giấu Tên Thật";
export const T2_ANONYMOUS_REAL_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/anon/b.png?token=y`;

export const T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME = "Lê Văn Ẩn Điểm";
/** Same rationale as `T2_ANONYMOUS_REAL_DISPLAY_NAME`, for the score-masking
 *  row: the real score this author actually earned, which `toScoreField` must
 *  strip to an ABSENT key (never `null`/`0` standing in for it). */
export const T2_HIDDEN_SCORE_REAL_VALUE = 9.9;

/** Mirrors `mapScoreFields` (`features/solutions/queries.ts`) using the REAL
 *  `toScoreField` — `score: null` is the masked-at-the-source shape a
 *  `show_score=false` RPC row actually carries. */
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

/** `listSolutions()` fixture for S-03 — the NAMED/ANONYMOUS/hidden-score trio
 *  described above. */
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

/** `getSolutionDetail()` fixture for S-05 — same trio, keyed by solutionId
 *  (route param) since the detail screen renders one solution per visit. */
export function fixtureGetSolutionDetailForAnonymityCheck(solutionId: string): SolutionDetail | null {
  return T2_SOLUTION_DETAILS[solutionId] ?? null;
}

// -----------------------------------------------------------------------------
// Test 2 (task 30) — O-02 comment-sheet portion. Same isolation discipline as
// the S-03/S-05 trio above: a dedicated solution (own author identity is
// irrelevant here, reused from T2_NAMED_* — this test only asserts on the
// COMMENT rows, never the solution author card) carrying exactly one question
// with three comment rows, each isolating ONE property: a NAMED comment
// (baseline), an ANONYMOUS comment (identity masked), and a comment by the
// solution's WRITER who ALSO commented anonymously (`is_solution_author: true`
// + `{kind:"anonymous"}` together — the exact combination task 28's own unit
// tests (CommentItem.test.tsx Required Test #3) already proved in isolation;
// this fixture-e2e test proves the SAME combination through the real rendered
// screen). `.author` on the anonymous/writer rows is produced by the REAL
// `toAuthorIdentity` called on a `null`-at-source input (same technique as the
// S-03/S-05 trio) — never a hand-typed `{kind:"anonymous"}` literal.
// -----------------------------------------------------------------------------

export const T2_COMMENTS_SOLUTION_ID = "solution-fixture-t2-comments";
export const T2_COMMENTS_QUESTION_ID = "q1";

export const T2_COMMENT_NAMED_ID = "comment-fixture-t2-named";
export const T2_COMMENT_NAMED_DISPLAY_NAME = "Phạm Thị Bình Luận Công Khai";
export const T2_COMMENT_NAMED_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/comment-named/c.png?token=z`;
export const T2_COMMENT_NAMED_BODY = "Bình luận có tên hiển thị bình thường.";

export const T2_COMMENT_ANONYMOUS_ID = "comment-fixture-t2-anonymous";
/** The real identity behind the ANONYMOUS comment — same rationale as
 *  `T2_ANONYMOUS_REAL_DISPLAY_NAME` above: never fed into `toAuthorIdentity`
 *  for the row actually rendered (only `null` is); exists so the absence
 *  assertions check for a REAL value that could have leaked, and doubles as
 *  the RED-phase discrimination proof's stand-in value (Investigation Notes:
 *  temporarily building this row's `.author` as
 *  `{kind:"named", displayName: T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME,
 *  avatarUrl: T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL}` — bypassing
 *  `toAuthorIdentity` — turns the absence assertions red; reverting to the
 *  `null`-at-source call turns them green again). */
export const T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME = "Vũ Văn Ẩn Danh Bình Luận";
export const T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/comment-anon/d.png?token=w`;
export const T2_COMMENT_ANONYMOUS_BODY = "Bình luận ẩn danh của một người dùng khác.";

export const T2_COMMENT_WRITER_ID = "comment-fixture-t2-writer";
/** Same rationale as `T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME`, for the row
 *  that is BOTH the solution's writer AND anonymous — the real identity that
 *  must stay absent even though "Người viết" renders alongside "Ẩn danh". */
export const T2_COMMENT_WRITER_REAL_DISPLAY_NAME = "Đỗ Thị Người Viết Ẩn Danh";
export const T2_COMMENT_WRITER_REAL_AVATAR_URL = `${T2_AVATAR_ORIGIN}/storage/v1/object/sign/avatars/comment-writer/e.png?token=v`;
export const T2_COMMENT_WRITER_BODY = "Bình luận ẩn danh của chính người viết bài giải.";

/** Three comment rows for `T2_COMMENTS_SOLUTION_ID`'s only question — old
 *  first, new last (UI Spec § Component: CommentSheet layout order). */
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
// Test 3 (task 31) — ONE shared XSS payload applied to BOTH a note fixture
// (S-05, SolutionNoteBlock's server-direct RichText) and a comment fixture
// (O-02, CommentItem's dynamically-imported RichText) — the point is proving
// the SAME payload is inert on both independent render paths, not two
// independently-chosen payloads. Reuses the SAME `T2_SOLUTION_DETAILS` map/
// `fixtureGetSolutionDetailForAnonymityCheck` lookup Test 2 already wires
// through `getSolutionDetailMock` — this task adds one more entry, it does
// not introduce a second fixture-lookup mechanism.
//
// Payload SHAPE mirrors (does not copy) the task 11/28 groups in
// `RichText.xss.test.tsx`: one <script> vector + one <img onerror> vector,
// combined into one string.
// -----------------------------------------------------------------------------

export const XSS_SHARED_PAYLOAD =
  'Xem hình <img src="x" onerror="alert(1)"> rồi đọc <script>alert("xss")</script> kỹ nhé';

export const T3_XSS_SOLUTION_ID = "solution-fixture-t3-xss";
export const T3_XSS_QUESTION_ID = "q1";
export const T3_XSS_COMMENT_ID = "comment-fixture-t3-xss";
/** Reused as the sole comment's author name — the test locates the O-02
 *  comment row by THIS name (never by the raw payload string, per this
 *  task's Proof Obligation: assert on the rendered DOM, not the fixture
 *  string). */
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
      // S-05 note body — same string as the comment body below.
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
          // O-02 comment body — the SAME string, not an independently
          // authored second payload.
          body: XSS_SHARED_PAYLOAD,
          iReported: false,
          createdAt: "2026-09-20T10:03:00.000Z",
        },
      ],
    }),
  ],
});
