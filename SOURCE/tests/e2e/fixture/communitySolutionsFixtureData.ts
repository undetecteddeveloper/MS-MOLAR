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
  SolutionDetailQuestion,
  SolutionEditorQuestion,
  SolutionEditorState,
  SolutionStatus,
} from "@/features/solutions/queries";
import type { SaveSolutionResult, SetSolutionStatusResult } from "@/features/solutions/actions";
import type { ExamResult } from "@/features/exams/queries";
import type { Exam } from "@/types/exam";

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
