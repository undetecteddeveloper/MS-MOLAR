// Essay (Tự luận) Auto-Scoring — INTEGRATION lane skeleton
// Design Docs: docs/design/essay-auto-scoring-backend-design.md (v1.3, § Test
//                Boundaries :2181, § Output Comparison :2236, § Cờ tính năng :2011)
//              docs/design/essay-auto-scoring-frontend-design.md (v1.1, § Test
//                Boundaries :2134)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3)
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-001..AC-072)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted, D1..D6)
// Generated:   2026-08-29 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// ALL THREE CASES ARE NOW CONVERTED. This file no longer contains a skeleton:
//   INT-1 — Task B1.6 (11 executing cases)
//   INT-2 — Task B2.4 (7 executing cases)
//   INT-3 — Task B2.4 (5 executing cases)
// Integration lane resolution for this feature: 3/3. Unresolved `it.todo`: 0.
//
// The paragraph that used to stand here said "nothing executes an assertion yet"
// and explained why every case was `it.todo`. It is kept below in one line rather
// than deleted, because the REASON still governs anyone adding a case: this file
// is collected by `SOURCE/vitest.config.ts:19` (`app/**/*.test.{ts,tsx}`), so a
// file with zero collected tasks makes vitest report "No test suite found in
// file" and exit 1 — a red CI caused by the shape of a skeleton rather than by a
// defect. `it.todo` is collected, reports as todo, and keeps the gate green.
//
// Each conversion landed IN THE SAME COMMIT as the production code it covers
// (Red -> Green in one task), following the shipped precedent in this directory
// (`getResult.int.test.ts`, `submitExam.int.test.ts`, `rating.int.test.ts`).
//
// HOW THIS LANE RUNS: `npm test` (from `SOURCE/`). NOT `npm run test:integration`
// — that config collects `tests/integration/**` only and needs a real Supabase dev
// database. Every case in this file is DB-free by construction.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — stated once, applies to all three cases
// -----------------------------------------------------------------------------
// Backend DD § Mock Boundary Decisions (:2183) is the authority; this file adopts
// it verbatim:
//   MOCKED  — the Supabase client at the `createClient()` boundary (the sanctioned
//             boundary of `getResult.int.test.ts` / `rating.int.test.ts` /
//             `history.int.test.ts`); `lib/supabase/service-role.ts` operations;
//             `after()` (replaced by a synchronous invocation, since the subject is
//             WHAT is registered and WHEN, not how Next schedules it); Redis;
//             `redirect()`.
//   MOCKED  — `fetch` to `api.groq.com`, at the fetch boundary and no deeper.
//             GRADING SHIPS DISABLED behind the AC-067 human gate (Zero Data
//             Retention in the Groq console) and NO GROQ ACCOUNT EXISTS YET, so
//             every case here runs with ZERO real provider calls. INT-1 asserts
//             that count is zero as its own subject; INT-2/INT-3 never reach the
//             write path at all.
//   REAL    — `computeScore()`, `lib/scoring/essayLifecycle.ts`
//             (`deriveEssayView`, `summariseEssays`, `isEssayIncomplete`,
//             `hasIncompleteEssay`, `hasUnresolvedEssay`), `lib/scoring/wrongTwice.ts`,
//             `lib/i18n` dictionaries. These are pure and they ARE the subject;
//             mocking them tests the wiring instead of the behaviour.
// @real-dependency: none — no case in this file touches Postgres. The three
//   properties a mocked client CANNOT prove (jsonb array order, the
//   `<> 'graded'` predicate matching zero rows, the real grants) are OUT of this
//   lane by design and live in the service lane —
//   `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts`.
//
// -----------------------------------------------------------------------------
// WHY THESE THREE, AND WHAT WAS PUSHED DOWN
// -----------------------------------------------------------------------------
// Ranked by ROI (BV x Freq + Legal x 10 + Defect), top 3 of 7 candidates:
//   INT-1  109  feature-off submit path                       <- selected
//   INT-2   81  hasIncompleteEssay agreement, both read paths <- selected
//   INT-3   71  graded essay stays out of Layer 3             <- selected
//   (I-E)   57  gradeEssays orchestration order (AC-072)      <- NOT selected, budget full
//   (I-D)   49  retryEssayGrading refusal matrix (EG-BE-022)  <- NOT selected, budget full
//   (I-F/G)  —  deriveEssayView deadline boundary (EG-BE-023),
//               parseGrade band/boolean validation (EG-BE-014/015)
//               <- PUSHED DOWN: pure functions with no collaborators; a unit test
//                  proves strictly more per second here. Backend DD § Correctness
//                  Proof Method row 1 and row 3 already assign them to the unit lane.
// I-E and I-D are the two the engineer should swap in first if any case below is
// judged unit-level; their annotations are preserved in the generation report.
//
// EXISTING COVERAGE CHECKED (dedup pass, 2026-08-29) — these already-shipped tests
// touch this feature's surface and must NOT be restated here:
//   `lib/scoring/__tests__/computeScore.test.ts`  — the current essay branch
//     ({ scored:false, isCorrect:false }) and the `essay()` fixture helper.
//   `lib/scoring/__tests__/wrongTwice.test.ts` Test 2 (:105-140) — the
//     `scored: false` exclusion, on a fixture already named `Q-ESSAY`.
//   `features/exams/components/__tests__/QuestionRenderer.test.tsx` — the essay
//     footer string and the `maxLength` coupled site.
//   `features/exams/__tests__/submitExam.int.test.ts` — the `essay_answer` key path.
// Where a case below overlaps one of them, the overlap is called out at the
// obligation itself with the narrower thing this lane adds.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ESSAY_KEYS, ESSAY_MAX_ATTEMPTS } from "@/lib/scoring/essayLifecycle";

// -----------------------------------------------------------------------------
// INT-1 test infrastructure — the mock boundary declared in the header, wired.
// INT-2 and INT-3 further down have their OWN harness (`driveBothReadPaths`),
// added by Task B2.4: they drive the two READ paths, while everything here drives
// the WRITE path. The two sets deliberately share nothing but the module mocks.
// -----------------------------------------------------------------------------

const {
  afterMock,
  redirectMock,
  createClientMock,
  recordExamResultMock,
  recordSkillMasteryMock,
  guardMock,
  gradeEssaysForAttemptMock,
} = vi.hoisted(() => ({
  afterMock: vi.fn(),
  redirectMock: vi.fn(),
  createClientMock: vi.fn(),
  recordExamResultMock: vi.fn(),
  recordSkillMasteryMock: vi.fn(),
  guardMock: vi.fn(),
  gradeEssaysForAttemptMock: vi.fn(),
}));

// actions.ts pulls in "server-only" transitively — same stub as
// getResult.int.test.ts / rating.int.test.ts / submitExam.int.test.ts.
vi.mock("server-only", () => ({}));

// after() is a spy that RECORDS BUT DOES NOT INVOKE by default. The subject of
// (c) and (e) is what is registered and when; obligation (f) is the single case
// that opts into synchronous invocation.
vi.mock("next/server", () => ({ after: afterMock }));

// redirect() is mocked, but it MUST still throw — see nextRedirectError below.
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/service-role", () => ({
  recordExamResult: recordExamResultMock,
  recordSkillMastery: recordSkillMasteryMock,
}));
// The Redis boundary: guard() reads the shared Upstash counter.
vi.mock("@/lib/security/rateLimit", () => ({ guard: guardMock }));
// The grading pass itself is Task B1.4's subject and has its own unit lane. Here
// it is a stand-in whose only jobs are to be identifiable as "the thing that was
// registered" and, in (f), to fail.
vi.mock("@/lib/essay/gradeEssays", () => ({
  gradeEssaysForAttempt: gradeEssaysForAttemptMock,
}));

const { submitExam } = await import("@/features/exams/actions");

const ATTEMPT_ID = "attempt-int1";
const EXAM_ID = "exam-int1";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const RESULT_URL = `/exams/${EXAM_ID}/attempt/${ATTEMPT_ID}/result`;

/** WHY redirect() STILL THROWS even though it is mocked.
 *
 *  A no-op redirect spy would silently defeat obligation (e). In Next,
 *  `redirect()` raises a NEXT_REDIRECT control-flow exception, so every statement
 *  after it is unreachable — which is exactly why registering the grading pass
 *  after the redirect means never registering it at all. Mock it as a no-op and
 *  the broken ordering keeps running to the end of the function, `after()` still
 *  gets called, and the case that exists to catch that bug passes anyway. So the
 *  spy reproduces the throw, with the digest shape `submitExam.int.test.ts`
 *  already recognises. */
function nextRedirectError(url: string): Error {
  const err = new Error("NEXT_REDIRECT");
  (err as Error & { digest: string }).digest = `NEXT_REDIRECT;push;${url};307;`;
  return err;
}

/** Swallows exactly the expected NEXT_REDIRECT and re-throws everything else,
 *  mirroring `submitExam.int.test.ts`'s helper of the same shape. */
async function callSubmitExam(answers: Record<string, string>) {
  try {
    await submitExam(ATTEMPT_ID, answers);
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) throw err;
  }
}

// questions rows in DB shape (snake_case), as claim_attempt_answer_key() returns
// them. Two scored MCQs plus one essay WITH a reference answer — the essay needs
// ground truth or the lifecycle-key branch never fires and every flag-ON case
// below would pass vacuously.
const QUESTION_ROWS = [
  {
    id: "q1",
    content: "2 + 2 = ?",
    choices: [
      { id: "A", text: "3" },
      { id: "B", text: "4" },
    ],
    correct_answer: "B",
    subject: "Toán",
    grade: 10,
    topic: "Số học",
    question_type: "mcq",
    sub_answers: null,
    essay_answer: null,
  },
  {
    id: "q2",
    content: "Diện tích hình vuông cạnh 3 là?",
    choices: [
      { id: "A", text: "9" },
      { id: "B", text: "6" },
    ],
    correct_answer: "A",
    subject: "Toán",
    grade: 10,
    topic: "Hình học",
    question_type: "mcq",
    sub_answers: null,
    essay_answer: null,
  },
  {
    id: "q3",
    content: "Phân tích diễn biến tâm trạng nhân vật.",
    choices: [],
    correct_answer: null,
    subject: "Văn",
    grade: 11,
    topic: "Văn học hiện thực",
    question_type: "essay",
    sub_answers: null,
    essay_answer: "Đáp án mẫu: nêu được ba giai đoạn chuyển biến.",
  },
];

const QUESTION_IDS = ["q1", "q2", "q3"];
const ANSWERS = { q1: "B", q2: "C", q3: "Bài làm của học sinh." };

/** INDEPENDENTLY AUTHORED — hand-computed from QUESTION_ROWS and ANSWERS above,
 *  never captured from computeScore()'s output. q1 right, q2 wrong, so 1 of the
 *  2 scored questions is correct => 5 on the 10-point scale; the essay sits
 *  outside the denominator AND outside the topic breakdown, which is why "Văn
 *  học hiện thực" does not appear here at all. */
const EXPECTED_SCORE_FLAG_OFF = {
  totalScore: 5,
  correct: 1,
  total: 2,
  perQuestion: [
    // B1 — `earnedPoints`/`maxPoints` là KÊNH ĐIỂM có trọng số. Ở đây cả hai
    // câu đều dùng trọng số mặc định 1, nên `totalScore` vẫn đúng bằng 5 như
    // trước B1: với đề cân bằng, tổng có trọng số rút gọn về công thức cũ.
    {
      questionId: "q1",
      selected: "B",
      correct: "B",
      isCorrect: true,
      scored: true,
      earnedPoints: 1,
      maxPoints: 1,
    },
    {
      questionId: "q2",
      selected: "C",
      correct: "A",
      isCorrect: false,
      scored: true,
      earnedPoints: 0,
      maxPoints: 1,
    },
    {
      // Cờ TẮT ⇒ không ai sẽ chấm câu này ⇒ nó đứng ngoài CẢ tử lẫn mẫu, tức
      // KHÔNG mang `maxPoints`. Đưa nó vào mẫu số khi không có người chấm là
      // trừ điểm học sinh vĩnh viễn.
      questionId: "q3",
      selected: "Bài làm của học sinh.",
      isCorrect: false,
      scored: false,
    },
  ],
  topicBreakdown: [
    { topic: "Số học", correct: 1, total: 1 },
    { topic: "Hình học", correct: 0, total: 1 },
  ],
};

/** The exhaustive key set of the essay element with the flag OFF. `toEqual`
 *  above cannot carry this obligation on its own: it treats a key present with
 *  value `undefined` as absent, and `undefined` vs missing is exactly the
 *  distinction that survives into jsonb. */
const EXPECTED_ESSAY_KEYS_OFF = ["isCorrect", "questionId", "scored", "selected"];

/** The same element with the flag ON: those four plus the five keys
 *  `newEssayEntry()` emits. `essayGradedAt` is deliberately NOT here — only
 *  `record_essay_grade()` ever writes it. */
const EXPECTED_ESSAY_KEYS_ON = [
  // B3 — hai khoá của KÊNH ĐIỂM. Câu tự luận nay có mặt trong MẪU SỐ ngay từ
  // lúc nộp (`maxPoints`) với 0 điểm đã được (`earnedPoints`);
  // `record_essay_grade()` cộng tử số vào khi band đáp xuống. Chúng KHÁC
  // `essayEarned`/`essayMax` ngay trên: cặp kia là BAND (thang 0..1) để hiển
  // thị, cặp này là điểm thật trong thang của đề.
  "earnedPoints",
  "essayAttempts",
  "essayEarned",
  "essayLowConfidence",
  "essayMax",
  "essayState",
  "isCorrect",
  "maxPoints",
  "questionId",
  "scored",
  "selected",
];

/** The six jsonb key literals, typed out BY HAND rather than imported, because
 *  the obligation is "none of these strings appears". Cross-checked against
 *  ESSAY_KEYS in its own case below, so the list cannot rot silently — and the
 *  key-set assertions cannot go vacuous if ESSAY_KEYS is ever emptied. */
const SIX_ESSAY_KEY_LITERALS = [
  "essayAttempts",
  "essayEarned",
  "essayGradedAt",
  "essayLowConfidence",
  "essayMax",
  "essayState",
];

/** Wires the mocked client for submitExam()'s full happy path: exam_attempts
 *  (select) -> exams (select) -> claim_attempt_answer_key (rpc) ->
 *  attempt_answers (upsert). exam_results is deliberately absent — reaching it
 *  through the student's own client is a 42501 in production, so it must throw
 *  here rather than meet a friendly mock (submitExam.int.test.ts obligation f). */
function mockSubmitExamChain() {
  const attemptAnswersUpsertMock = vi.fn(async () => ({ error: null }));

  const rpcMock = vi.fn(async (fn: string) => {
    if (fn === "claim_attempt_answer_key") return { data: QUESTION_ROWS, error: null };
    throw new Error(`unexpected rpc: ${fn}`);
  });

  const fromMock = vi.fn((table: string) => {
    if (table === "exam_attempts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: ATTEMPT_ID,
                exam_id: EXAM_ID,
                status: "in_progress",
                user_id: USER_ID,
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "exams") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { question_ids: QUESTION_IDS }, error: null }),
          }),
        }),
      };
    }
    if (table === "attempt_answers") return { upsert: attemptAnswersUpsertMock };
    throw new Error(`unexpected table: ${table}`);
  });

  createClientMock.mockResolvedValue({ from: fromMock, rpc: rpcMock });
  return { fromMock, rpcMock, attemptAnswersUpsertMock };
}

/** The counted fetch boundary of obligation (b).
 *
 *  It returns a benign response rather than throwing, deliberately. A throwing
 *  stub would abort submitExam() at the stray call and fail every case in the
 *  file with a transport error, so the COUNT — the thing obligation (b) is
 *  actually about — would never be the assertion that fired. Returning a
 *  plausible response lets the run continue and lets `toHaveBeenCalledTimes(0)`
 *  be the discriminator, which is what makes (b) a measurement and not a
 *  side effect of some other failure. */
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

/** process.env is restored by hand rather than through vi.stubEnv, because
 *  obligation (d)'s first spelling is the variable being ABSENT — a state
 *  stubEnv expresses only indirectly. */
const ORIGINAL_FLAG = process.env.ESSAY_GRADING_ENABLED;

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.ESSAY_GRADING_ENABLED;
  else process.env.ESSAY_GRADING_ENABLED = value;
}

/** The score object handed to the single recordExamResult() call. */
function persistedScore() {
  expect(recordExamResultMock).toHaveBeenCalledTimes(1);
  return recordExamResultMock.mock.calls[0][1];
}

/** Obligations (a), (b) and (c) together. They are asserted through one helper
 *  because (d) has to repeat all three for every env spelling, and four drifting
 *  copies of them would be worse than one shared function. */
function expectShippedState() {
  // (a) — the payload that reaches the write, not merely what computeScore returned
  expect(persistedScore()).toEqual(EXPECTED_SCORE_FLAG_OFF);
  const essayEl = persistedScore().perQuestion[2];
  expect(Object.keys(essayEl).sort()).toEqual(EXPECTED_ESSAY_KEYS_OFF);
  for (const key of SIX_ESSAY_KEY_LITERALS) {
    expect(Object.hasOwn(essayEl, key)).toBe(false);
  }
  // (b) — zero provider calls, measured
  expect(fetchMock).toHaveBeenCalledTimes(0);
  // (c) — no pass registered
  expect(afterMock).toHaveBeenCalledTimes(0);
  expect(gradeEssaysForAttemptMock).toHaveBeenCalledTimes(0);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  redirectMock.mockImplementation((url: string) => {
    throw nextRedirectError(url);
  });
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  recordExamResultMock.mockResolvedValue({ error: null });
  recordSkillMasteryMock.mockResolvedValue({ error: null });
  gradeEssaysForAttemptMock.mockResolvedValue(undefined);
  mockSubmitExamChain();
});

afterEach(() => {
  vi.unstubAllGlobals();
  setFlag(ORIGINAL_FLAG);
});

// =============================================================================
// INT-1 — Feature-off is the SHIPPED state: no keys, no after(), zero Groq
// =============================================================================
// AC: EG-BE-002 — "When computeScore() runs with options.essayGrading === false
//   (the default), the system must emit the per_question element for an essay
//   question BYTE-FOR-BYTE as today: { questionId, selected, isCorrect: false,
//   scored: false } and NOT ONE essay* key."
// AC: EG-BE-032 — "submitExam() must emit 0 provider requests synchronously, and
//   the grading pass registration must sit BEFORE the redirect() call."
// AC: EG-BE-033 — "Any failure of the grading pass must not change submitExam()'s
//   observable outcome: the exam_results row is still written, record_skill_mastery()
//   is still called, and the redirect still happens."
// Also discharges: PRD AC-010, AC-013, AC-067; ADR-0018 R-12; backend DD § Cờ tính
//   năng :2011 read site (1); § Feature-Off Window (frontend DD :1605) backend half.
// ROI: 109 (BV:10 x Freq:10 + Legal:0 + Defect:9)
//   BV 10 — this is the state the feature SHIPS in. AC-067 is a human gate (Groq
//     Zero Data Retention, unverified, no account exists), and the users are
//     minors; "flag absent => zero requests" is the privacy promise itself.
//   Freq 10 — every single exam submission in production runs this path.
//   Legal false — treated as product/privacy policy rather than a statutory
//     requirement, deliberately conservative; note R-12 rates the impact "Cao".
//   Defect 9 — the failure is silent in both directions: an accidental default of
//     `true` leaks student prose to a third party with no ZDR guarantee, and an
//     accidental extra key changes what every downstream surface renders.
// Behavior: submitExam(attemptId, answers) is invoked with ESSAY_GRADING_ENABLED
//   unset -> computeScore runs with the flag threaded through as an OPTION (never
//   read from process.env inside the pure function, AC-013) -> the persisted
//   ScoreResult is byte-identical to today and no after() callback is registered ->
//   redirect still happens.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/actions.ts (submitExam) + real computeScore()
//   + mocked Supabase client + mocked service-role operations + mocked after() +
//   mocked redirect() + mocked global fetch
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the flag read defaults to ON when the env var is absent
//   (e.g. `process.env.ESSAY_GRADING_ENABLED !== "false"` instead of
//   `=== "true"`), so a build that ships before the AC-067 gate emits essay keys
//   and registers a grading pass that sends real student writing to Groq. The
//   second, quieter mode: the flag is respected but `after()` is registered AFTER
//   `redirect()` (`actions.ts:192`), which in Next means it is never registered at
//   all — grading silently never runs once the flag IS turned on, and nothing in
//   the flag-off state can reveal it.
// Proof obligation — what the implemented test must assert:
//   (a) FLAG ABSENT, exhaustive negative: with `ESSAY_GRADING_ENABLED` deleted from
//       the environment, the per_question payload handed to the mocked
//       `recordExamResult` toEqual an INDEPENDENTLY AUTHORED literal (not "whatever
//       computeScore returned"), and Object.keys of every essay element contains
//       NONE of essayState / essayEarned / essayMax / essayLowConfidence /
//       essayAttempts / essayGradedAt. Assert on the key SET, not on
//       `essayState === undefined` — a key present with value undefined
//       serialises differently into jsonb.
//       Overlap note: `computeScore.test.ts` owns the PURE half of this (the shape
//       computeScore returns). What this lane adds is that the shape SURVIVES the
//       call site — that `submitExam` passes the option through and persists that
//       exact payload — which a pure-function test cannot see.
//   (b) Zero provider calls, measured not assumed: global fetch is a counted mock;
//       the count is exactly 0. No `api.groq.com` request is constructed even to
//       be aborted.
//   (c) No pass registered: the `after()` mock records 0 registrations.
//   (d) Same three env spellings all mean OFF (fail-closed, backend DD :2015):
//       absent, "", "TRUE" (wrong case), "1". Each yields (a)+(b)+(c). "true"
//       with surrounding whitespace means ON (the value is trimmed) — include it
//       as the ONE positive control so this case cannot pass by the flag read
//       being dead code.
//   (e) Ordering, flag ON: with the trimmed "true" control, the `after()` mock is
//       called BEFORE the `redirect()` mock. Assert by comparing invocation order
//       on the two spies (`mock.invocationCallOrder`), not by asserting both were
//       called — "both were called" is true in the broken ordering too.
//   (f) Pass failure is contained: with the flag ON and the registered callback
//       forced to reject when invoked synchronously, `recordExamResult` and
//       `recordSkillMastery` were still both called and the redirect still
//       happened. This is EG-BE-033, and it is what keeps a provider outage from
//       becoming a lost submission.
//   Mockable boundaries and why: Supabase client / service-role / after / redirect /
//   fetch are all external or scheduler I/O. `computeScore()` runs REAL — it is the
//   subject of (a), and the backend DD names it explicitly as "Không — chạy thật".
describe("submitExam() — essay grading feature flag (INT-1)", () => {
  it("obligation (a): with the flag absent, the payload handed to recordExamResult equals an independently authored literal and carries none of the six essay keys", async () => {
    setFlag(undefined);

    await callSubmitExam(ANSWERS);

    // What this adds over computeScore.test.ts: that the shape SURVIVES the call
    // site. The pure test proves the function returns it; only this lane can see
    // that submitExam threads the option through and persists that exact object.
    expect(persistedScore()).toEqual(EXPECTED_SCORE_FLAG_OFF);

    const essayEl = persistedScore().perQuestion[2];
    // Key SET, not `essayState === undefined`: a key present with value undefined
    // passes the value check and still serialises into jsonb as `"essayState": null`.
    expect(Object.keys(essayEl).sort()).toEqual(EXPECTED_ESSAY_KEYS_OFF);
    for (const key of SIX_ESSAY_KEY_LITERALS) {
      expect(Object.hasOwn(essayEl, key)).toBe(false);
    }

    // The write went through the service-role path, once, for this attempt.
    expect(recordExamResultMock.mock.calls[0][0]).toBe(ATTEMPT_ID);
  });

  it("the six hand-written key literals still match ESSAY_KEYS, so the negative assertions above cannot go stale or vacuous", () => {
    // Without this, obligation (a) has two silent failure modes: a renamed key
    // (the hand-written list keeps testing a string nothing emits any more) and
    // an emptied ESSAY_KEYS (nothing to leak, so nothing to catch).
    expect([...Object.values(ESSAY_KEYS)].sort()).toEqual(SIX_ESSAY_KEY_LITERALS);
    expect(SIX_ESSAY_KEY_LITERALS).toHaveLength(6);
  });

  it("obligation (b): zero provider calls, measured — global fetch is called exactly 0 times and no api.groq.com request is constructed", async () => {
    setFlag(undefined);

    await callSubmitExam(ANSWERS);

    // Measured, not assumed. A request that is built and then aborted is still a
    // request and still student prose leaving the process, so the count is the
    // assertion — not "no response was used".
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(fetchMock.mock.calls).toEqual([]);
  });

  it("obligation (c): with the flag absent, after() records zero registrations", async () => {
    setFlag(undefined);

    await callSubmitExam(ANSWERS);

    // A pass registered while the feature is off does nothing visible — it just
    // keeps the invocation alive past the response, which shows up as cost and
    // as latency, never as an error.
    expect(afterMock).toHaveBeenCalledTimes(0);
    expect(gradeEssaysForAttemptMock).toHaveBeenCalledTimes(0);
  });

  it.each([
    ["absent", undefined],
    ["empty string", ""],
    ["wrong case TRUE", "TRUE"],
    ["the string 1", "1"],
  ])(
    "obligation (d): ESSAY_GRADING_ENABLED %s means OFF — no essay keys, no registration, no provider call",
    async (_label, value) => {
      setFlag(value);

      await callSubmitExam(ANSWERS);

      expectShippedState();
    },
  );

  it("obligation (d) POSITIVE CONTROL: a trimmed \"  true  \" means ON, so the flag read cannot be dead code", async () => {
    // Without this case every spelling above passes for an implementation whose
    // flag read never executes at all — the whole group would be proving nothing.
    setFlag("  true  ");

    await callSubmitExam(ANSWERS);

    const essayEl = persistedScore().perQuestion[2];
    expect(Object.keys(essayEl).sort()).toEqual(EXPECTED_ESSAY_KEYS_ON);
    expect(essayEl.essayState).toBe("pending");
    expect(afterMock).toHaveBeenCalledTimes(1);

    // SCOPE CHANGED BY B3 (2026-09-01). This block used to assert the score was
    // byte-identical with the flag ON and OFF, on EG-BE-004's original reading
    // that "emitting lifecycle keys and scoring are independent".
    //
    // B3 deliberately breaks HALF of that, and the half it breaks is the bug:
    // an essay that someone is actually going to grade now occupies its share of
    // the paper's marks from the moment of submission. Two auto-scored questions
    // (1 correct) plus one essay worth 1 mark, not yet graded, is 1/3 of the
    // paper — 3.33, not 5.0. Leaving it at 5.0 is precisely how a Literature
    // attempt showed 10.0/10 on a paper worth 4.75/10.
    //
    // The half that MUST still hold is the COUNT triple: `correct`/`total` keep
    // counting auto-scored questions only, so `wrong = total − correct` on
    // ScoreCard stays derivable (AC-057) and mastery is never fed by an essay.
    expect(persistedScore().totalScore).toBe(3.33);
    expect(persistedScore().correct).toBe(EXPECTED_SCORE_FLAG_OFF.correct);
    expect(persistedScore().total).toBe(EXPECTED_SCORE_FLAG_OFF.total);
    expect(persistedScore().topicBreakdown).toEqual(EXPECTED_SCORE_FLAG_OFF.topicBreakdown);

    // …and the essay is in the DENOMINATOR with a zero numerator, which is the
    // shape `record_essay_grade()` later adds the band into.
    expect(essayEl.maxPoints).toBe(1);
    expect(essayEl.earnedPoints).toBe(0);

    // Registered with the right target set: only the essay that HAS a reference
    // answer, carrying the student's text and the attempt it belongs to. A pass
    // registered over the MCQs would burn provider budget on questions the
    // lifecycle keys were never emitted for.
    const registered = afterMock.mock.calls[0][0] as () => unknown;
    registered();
    expect(gradeEssaysForAttemptMock).toHaveBeenCalledTimes(1);
    expect(gradeEssaysForAttemptMock.mock.calls[0][0]).toMatchObject({
      attemptId: ATTEMPT_ID,
      targets: [
        {
          questionId: "q3",
          questionContent: "Phân tích diễn biến tâm trạng nhân vật.",
          referenceAnswer: "Đáp án mẫu: nêu được ba giai đoạn chuyển biến.",
          studentAnswer: "Bài làm của học sinh.",
        },
      ],
    });
  });

  it("obligation (e): with the flag ON, after() is invoked BEFORE redirect()", async () => {
    setFlag("true");

    await callSubmitExam(ANSWERS);

    // `mock.invocationCallOrder` and not "both were called": both ARE called in
    // the broken ordering too, under a redirect that does not throw. Compare the
    // sequence numbers, which is the only observable that distinguishes them.
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(afterMock.mock.invocationCallOrder[0]).toBeLessThan(
      redirectMock.mock.invocationCallOrder[0],
    );
    expect(redirectMock).toHaveBeenCalledWith(RESULT_URL);
  });

  it("obligation (f): a grading pass that rejects leaves the result write, the mastery write and the redirect all intact (EG-BE-033)", async () => {
    setFlag("true");
    gradeEssaysForAttemptMock.mockRejectedValue(new Error("groq is down"));

    // Next owns the callback's failure handling; this mock stands in for both
    // halves of that — it invokes synchronously (so the rejection really does
    // happen inside submitExam's frame) and it absorbs the rejection the way the
    // runtime would, instead of letting a test artifact become an unhandled one.
    let passRejected = false;
    afterMock.mockImplementation((task: unknown) => {
      if (typeof task !== "function") return;
      const result = (task as () => unknown)();
      if (result instanceof Promise) {
        result.catch(() => {
          passRejected = true;
        });
      }
    });

    await callSubmitExam(ANSWERS);
    // Let the swallowed rejection settle before asserting on it.
    await Promise.resolve();

    expect(passRejected).toBe(true);
    // The score-write path is load-bearing (ADR-0011); everything attached to it
    // is allowed to fail. A provider outage must not cost the student the attempt.
    expect(recordExamResultMock).toHaveBeenCalledTimes(1);
    expect(recordSkillMasteryMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(RESULT_URL);
  });
});

// =============================================================================
// INT-2 — The two PDF exits cannot disagree: hasIncompleteEssay is identical on
//         getResult() and listMyHistory() for the same attempt
// =============================================================================
// AC: EG-BE-035 — "When an attempt has at least one essay question at RS-6,
//   hasIncompleteEssay must be true on BOTH ExamResult and MyHistoryEntry for the
//   same attemptId; and when no question is at RS-6 it must be false on both —
//   including for an attempt with no essay questions at all and for a row written
//   before the feature shipped (NEVER undefined)."
// AC: EG-BE-034 — "For the same per_question array and the same created_at,
//   hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0."
// AC: EG-BE-031 — "When getResult() reads an exam_results row written before the
//   feature shipped, the output must be identical to today and essaySummary must
//   be undefined."
// Also discharges: PRD AC-012, AC-058 (data half), O-8; frontend DD MSA-F5,
//   CR-4, FE-AC-14 precondition; UI Spec UI-D11.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
//   BV 9 — a PDF is a permanent artifact a student shares; two exits producing
//     two different files for one attempt is the defect O-8 exists to prevent.
//   Freq 8 — every /history render and every /result render evaluates both fields.
//   Defect 9 — two call sites deriving "the same" truth by two routes is the
//     shape F-06 already caught once in this feature's own review history.
// Behavior: the SAME per_question fixture and the SAME created_at are fed to
//   getResult() and to listMyHistory() through their (separately mocked) Supabase
//   clients -> real essayLifecycle predicates run on both paths -> the two
//   booleans are compared to each other and to independently authored literals.
// @category: integration
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (getResult) +
//   SOURCE/app/(HM)/queries.ts (listMyHistory) + real
//   SOURCE/lib/scoring/essayLifecycle.ts + mocked Supabase client on both paths
// @complexity: medium
// @real-dependency: none — the sanctioned mock boundary of getResult.int.test.ts
//   and history.int.test.ts. What this case proves is AGREEMENT BETWEEN TWO
//   TypeScript derivations plus the query SHAPE; it deliberately does not claim to
//   prove Postgres semantics.
// Primary failure mode: one read path is extended and the other is not — most
//   likely `listMyHistory()`'s select gains `per_question` but not `created_at`
//   (backend DD § Implementation Path Mapping, `(HM)/queries.ts:64-66`), so its
//   deadline derivation runs against a missing/`undefined` timestamp and an
//   overdue pending question is classified as still-pending there while /result
//   classifies it as RS-6. The student then gets a PDF with the incomplete-essay
//   line from one button and without it from the other, for the same attempt.
//   The second mode: either field is left `undefined` for a legacy row instead of
//   `false`, and `undefined` is falsy — so the bug renders correctly today and
//   surfaces the first time anything does a strict comparison.
// Proof obligation — what the implemented test must assert:
//   (a) AGREEMENT, the point of the case: for ONE fixture attempt id, drive both
//       functions and assert
//       `examResult.hasIncompleteEssay === historyEntry.hasIncompleteEssay`
//       AND that the shared value equals an independently authored literal `true`.
//       Asserting only the equality is not enough — two paths that are both wrong
//       in the same direction are equal.
//   (b) Fixture must contain an RS-6 element specifically: essayState "failed"
//       with essayAttempts === ESSAY_MAX_ATTEMPTS (3), i.e. retryAvailable false.
//       RS-4 (failed, attempts < 3) must NOT set hasIncompleteEssay — include it
//       as a second element in the same fixture so the case distinguishes
//       "any failure" from "unrecoverable failure".
//   (c) NEGATIVE, three shapes, all yielding `false` on BOTH paths and all
//       `typeof === "boolean"` (never undefined): an attempt whose essays are all
//       graded; an attempt with no essay questions at all; a legacy row carrying
//       no essay* key whatsoever.
//   (d) EG-BE-034 equality, run on the SAME fixture in the same case:
//       `hasUnresolvedEssay(pq, createdAt, now) === ((summariseEssays(pq, createdAt, now)?.unresolvedCount ?? 0) > 0)`
//       for each of the fixtures in (b) and (c). This is the pin that stops the
//       two derivations of one truth from drifting.
//   (e) Query shape, both paths: getResult()'s select carries `created_at`
//       (backend DD :579-581) and listMyHistory()'s embedded select carries BOTH
//       `per_question` and `created_at` (:64-66). A missing column here is the
//       exact mechanism of the primary failure mode and it is invisible to any
//       assertion made on mapped output alone.
//   (f) Legacy-row Output Comparison (EG-BE-031 / backend DD đường ống 2 and 3):
//       for the legacy fixture, the whole ExamResult toEqual a hand-built literal
//       of the pre-change shape, with `essaySummary === undefined` and every
//       `PerQuestionResult.essay === undefined`; and the whole MyHistoryEntry[]
//       toEqual a literal carrying all nine pre-existing fields plus the two new
//       booleans as `false`, in unchanged submittedAt-descending order.
//   Time control: `now` must be injected/frozen, never `Date.now()` — the deadline
//   derivation (ESSAY_PENDING_DEADLINE_MS = 600_000) is time-dependent and a
//   real clock makes this case a time bomb rather than a test.

// -----------------------------------------------------------------------------
// INT-2 / INT-3 harness — the two READ paths, driven for one fixture attempt.
//
// Both `getResult()` and `listMyHistory()` build their own client through the
// same mocked `createClient()`, so the two are driven in sequence with the mock
// re-pointed between them. That is what lets one fixture reach both doors, which
// is the entire subject of INT-2.
// -----------------------------------------------------------------------------

const { getResult } = await import("@/features/exams/queries");
const { listMyHistory } = await import("@/app/(HM)/queries");

/** Frozen. The deadline is 600 000 ms with an exclusive boundary, so a real clock
 *  would make every lifecycle fixture below a time bomb. */
const READ_NOW = new Date("2026-08-29T12:00:00.000Z");
/** One minute old — comfortably inside the deadline, so a `pending` element stays
 *  `pending` and the cases below are about the STORED state, not about time. */
const READ_CREATED_AT = "2026-08-29T11:59:00.000Z";

const READ_ATTEMPT_ID = "attempt-read";
const READ_EXAM = { id: "exam-read", title: "Đề Văn cuối kỳ", subject: "Ngữ văn" };
const READ_STARTED_AT = "2026-08-29T11:00:00.000Z";
const READ_SUBMITTED_AT = "2026-08-29T11:58:00.000Z";

/** A stored essay element. Defaults to RS-2 (`pending`, no attempts spent). */
function essayEl(overrides: Record<string, unknown> = {}) {
  return {
    questionId: "q-essay",
    selected: "Bài làm của học sinh.",
    isCorrect: false,
    scored: false,
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 0,
    ...overrides,
  };
}

/** A stored MCQ element, exactly the shape `computeScore()` emits today. */
function mcqEl(id: string, isCorrect: boolean) {
  return {
    questionId: id,
    selected: isCorrect ? "A" : "B",
    correct: "A",
    isCorrect,
    scored: true,
  };
}

interface ReadFixture {
  perQuestion: unknown[];
  /** The three stored score columns. `getResult()` reads them straight from the
   *  row — it does NOT recompute — so a fixture states them explicitly. */
  triple?: { totalScore: number; correct: number; total: number };
  /** Extra attempts for the cross-attempt wrong-twice history read. */
  historyRows?: unknown[];
  createdAt?: string;
}

/** Wires the mocked client for `getResult()`: the joined read, the cross-attempt
 *  wrong-twice read (thenable — it awaits the builder directly), and the answer-key
 *  RPC. Records every select string so INT-2(e) can assert on query SHAPE. */
function makeGetResultClient(fx: ReadFixture, selectArgs: string[]) {
  const triple = fx.triple ?? { totalScore: 5, correct: 1, total: 2 };
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "exam_answer_key") return { data: [], error: null };
    throw new Error(`unexpected rpc: ${fn}`);
  });
  const from = vi.fn((table: string) => {
    if (table !== "exam_results") throw new Error(`unexpected table: ${table}`);
    const builder: Record<string, unknown> = {
      select: (arg: string) => {
        selectArgs.push(arg);
        return builder;
      },
      eq: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({
        data: {
          total_score: triple.totalScore,
          correct: triple.correct,
          total: triple.total,
          per_question: fx.perQuestion,
          topic_breakdown: [],
          overtime_seconds: 0,
          created_at: fx.createdAt ?? READ_CREATED_AT,
          exam_attempts: {
            started_at: READ_STARTED_AT,
            submitted_at: READ_SUBMITTED_AT,
            exams_with_difficulty: READ_EXAM,
          },
        },
        error: null,
      }),
      // The wrong-twice history read awaits the builder itself. Without this it
      // resolves to the builder object, degrades to [], and INT-3(c) would pass
      // for a permanently dead feature.
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve().then(() =>
          onFulfilled({
            data: fx.historyRows ?? [
              { attempt_id: READ_ATTEMPT_ID, per_question: fx.perQuestion },
            ],
            error: null,
          }),
        ),
    };
    return builder;
  });
  return { from, rpc };
}

/** Wires the mocked client for `listMyHistory()` — one bounded, thenable read. */
function makeHistoryClient(fx: ReadFixture, selectArgs: string[]) {
  const triple = fx.triple ?? { totalScore: 5, correct: 1, total: 2 };
  const from = vi.fn((table: string) => {
    if (table !== "exam_results") throw new Error(`unexpected table: ${table}`);
    const builder: Record<string, unknown> = {
      select: (arg: string) => {
        selectArgs.push(arg);
        return builder;
      },
      eq: () => builder,
      limit: () => builder,
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve().then(() =>
          onFulfilled({
            data: [
              {
                attempt_id: READ_ATTEMPT_ID,
                total_score: triple.totalScore,
                correct: triple.correct,
                total: triple.total,
                per_question: fx.perQuestion,
                created_at: fx.createdAt ?? READ_CREATED_AT,
                exam_attempts: {
                  exam_id: READ_EXAM.id,
                  started_at: READ_STARTED_AT,
                  submitted_at: READ_SUBMITTED_AT,
                  exams: { title: READ_EXAM.title, subject: READ_EXAM.subject },
                },
              },
            ],
            error: null,
          }),
        ),
    };
    return builder;
  });
  return { from };
}

/** ONE fixture, BOTH doors. Returns each path's output and the select strings it
 *  issued, so a case can assert on agreement, on values and on query shape. */
async function driveBothReadPaths(fx: ReadFixture) {
  const resultSelectArgs: string[] = [];
  const historySelectArgs: string[] = [];

  createClientMock.mockResolvedValue(makeGetResultClient(fx, resultSelectArgs));
  const examResult = await getResult(READ_ATTEMPT_ID);

  createClientMock.mockResolvedValue(makeHistoryClient(fx, historySelectArgs));
  const [historyEntry] = await listMyHistory();

  return { examResult: examResult!, historyEntry, resultSelectArgs, historySelectArgs };
}

describe("getResult() / listMyHistory() — hasIncompleteEssay agreement (INT-2)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(READ_NOW);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  // The fixture (b) is built around: ONE unrecoverable essay and ONE that can
  // still be retried. That pairing is what separates "any failure" from
  // "unrecoverable failure" — an implementation that treats every `failed` as
  // incomplete passes a fixture containing only the first.
  const RS6_AND_RS4: unknown[] = [
    essayEl({ questionId: "q-rs6", essayState: "failed", essayAttempts: ESSAY_MAX_ATTEMPTS }),
    essayEl({ questionId: "q-rs4", essayState: "failed", essayAttempts: 1 }),
  ];

  it("(a)+(b): one attempt, both doors — hasIncompleteEssay agrees AND equals an independently authored true; an RS-4 sibling does not cause it", async () => {
    const { examResult, historyEntry } = await driveBothReadPaths({ perQuestion: RS6_AND_RS4 });

    // Agreement is necessary but NOT sufficient: two paths wrong in the same
    // direction are equal. So the shared value is also held against a literal
    // authored from the fixture by hand.
    expect(examResult.hasIncompleteEssay).toBe(historyEntry.hasIncompleteEssay);
    expect(examResult.hasIncompleteEssay).toBe(true);

    // …and the RS-4 element is genuinely present and genuinely retryable, so the
    // `true` above is attributable to q-rs6 alone.
    const rs4 = examResult.result.perQuestion.find((r) => r.questionId === "q-rs4");
    expect(rs4?.essay).toEqual({
      state: "failed",
      earned: null,
      max: null,
      lowConfidence: false,
      retryAvailable: true,
    });
    const rs6 = examResult.result.perQuestion.find((r) => r.questionId === "q-rs6");
    expect(rs6?.essay?.retryAvailable).toBe(false);
  });

  it("(b) negative half: an attempt whose only failed essay is RETRYABLE must NOT report hasIncompleteEssay on either path", async () => {
    // RS-4 alone. If this returned true, the student would get the permanent
    // "grading incomplete" PDF annotation while a retry was still available.
    const { examResult, historyEntry } = await driveBothReadPaths({
      perQuestion: [essayEl({ questionId: "q-rs4", essayState: "failed", essayAttempts: 1 })],
    });

    expect(examResult.hasIncompleteEssay).toBe(false);
    expect(historyEntry.hasIncompleteEssay).toBe(false);
    // Still UNRESOLVED though — the two predicates are structurally exclusive,
    // and this row is the proof that one boolean could not carry both answers.
    expect(historyEntry.hasUnresolvedEssay).toBe(true);
  });

  it.each([
    [
      "every essay graded",
      [essayEl({ essayState: "graded", essayEarned: 1, essayMax: 1, essayAttempts: 1 })],
    ],
    ["no essay question at all", [mcqEl("q-mcq", true)]],
    [
      "a legacy row carrying no essay* key whatsoever",
      [{ questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false }],
    ],
  ])(
    "(c) negative shape — %s ⇒ false on BOTH paths, and a real boolean on both",
    async (_label, perQuestion) => {
      const { examResult, historyEntry } = await driveBothReadPaths({
        perQuestion: perQuestion as unknown[],
      });

      // `typeof`, not just the value: `undefined` is falsy, so the wrong version
      // renders correctly today and only surfaces when the PDF pipeline has to
      // decide an annotation from it.
      expect(typeof examResult.hasIncompleteEssay).toBe("boolean");
      expect(typeof historyEntry.hasIncompleteEssay).toBe("boolean");
      expect(typeof historyEntry.hasUnresolvedEssay).toBe("boolean");
      expect(examResult.hasIncompleteEssay).toBe(false);
      expect(historyEntry.hasIncompleteEssay).toBe(false);
    },
  );

  it("(d) EG-BE-034: history's hasUnresolvedEssay equals (result's essaySummary.unresolvedCount ?? 0) > 0, across every fixture", async () => {
    // Deliberately compares ACROSS the two paths rather than recomputing the
    // right-hand side locally. Two derivations of one truth drifting apart is
    // defect F-06, and a locally recomputed control would not see it.
    const fixtures: unknown[][] = [
      RS6_AND_RS4,
      [essayEl()],
      [essayEl({ essayState: "failed", essayAttempts: 1 })],
      [essayEl({ essayState: "graded", essayEarned: 0.5, essayMax: 1, essayAttempts: 1 })],
      [mcqEl("q-mcq", true)],
    ];

    const observed: boolean[] = [];
    for (const perQuestion of fixtures) {
      const { examResult, historyEntry } = await driveBothReadPaths({ perQuestion });
      const fromSummary = (examResult.essaySummary?.unresolvedCount ?? 0) > 0;
      expect(historyEntry.hasUnresolvedEssay).toBe(fromSummary);
      observed.push(historyEntry.hasUnresolvedEssay);
    }
    // Positive AND negative control: without both, the equality above would hold
    // for an implementation that answers the same thing every time.
    expect(observed).toContain(true);
    expect(observed).toContain(false);
  });

  it("(e) query shape on BOTH paths — getResult carries created_at, listMyHistory carries per_question AND created_at", async () => {
    const { resultSelectArgs, historySelectArgs } = await driveBothReadPaths({
      perQuestion: RS6_AND_RS4,
    });

    const joinSelect = resultSelectArgs.find((arg) => arg.includes("exam_attempts!inner("));
    expect(joinSelect).toContain("created_at");

    const historySelect = historySelectArgs[0];
    expect(historySelect).toContain("per_question");
    expect(historySelect).toContain("created_at");

    // Why this is asserted on the SELECT STRING and not on mapped output: with
    // `created_at` missing on one path, both booleans still compute — they just
    // compute against `undefined`. An overdue pending question is then "still
    // pending" on that path while the other calls it RS-6, and the student gets
    // a PDF WITH the incomplete-essay line from one button and WITHOUT it from
    // the other, for the same attempt. No assertion on mapped output can see it.
  });

  it("(f) legacy Output Comparison, BOTH pipelines: hand-built literals, no snapshots", async () => {
    const legacy = [{ questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false }];
    const { examResult, historyEntry } = await driveBothReadPaths({
      perQuestion: legacy,
      triple: { totalScore: 5, correct: 1, total: 2 },
    });

    expect(examResult).toEqual({
      examId: "exam-read",
      examTitle: "Đề Văn cuối kỳ",
      subject: "Ngữ văn",
      result: {
        totalScore: 5,
        correct: 1,
        total: 2,
        perQuestion: [
          { questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false },
        ],
        topicBreakdown: [],
      },
      questions: {},
      startedAt: READ_STARTED_AT,
      submittedAt: READ_SUBMITTED_AT,
      overtimeSeconds: 0,
      hasIncompleteEssay: false,
    });
    // `toEqual` treats a key holding `undefined` as absent, so the field that
    // must be undefined is asserted separately.
    expect(examResult.essaySummary).toBeUndefined();
    expect(examResult.result.perQuestion[0].essay).toBeUndefined();

    expect([historyEntry]).toEqual([
      {
        attemptId: READ_ATTEMPT_ID,
        examId: "exam-read",
        examTitle: "Đề Văn cuối kỳ",
        subject: "Ngữ văn",
        totalScore: 5,
        startedAt: READ_STARTED_AT,
        submittedAt: READ_SUBMITTED_AT,
        correct: 1,
        total: 2,
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
      },
    ]);
  });
});

// =============================================================================
// INT-3 — A graded essay is still scored:false / isCorrect:false, so Layer 3 and
//         the score triple never move because of it
// =============================================================================
// AC: EG-BE-004 — "In EVERY lifecycle state (pending, graded, failed) the stored
//   element must keep scored: false and isCorrect: false. A graded element
//   carrying scored: true, isCorrect: true, or MISSING the scored key, fails this
//   criterion."
// Also discharges: PRD AC-009 (exam_results.correct never moves because of an
//   essay), AC-014, AC-016 (wrongTwice), AC-017 (record_skill_mastery filter),
//   AC-011/AC-015 read-side arithmetic (EG-BE-027); ADR-0018 F1.
// ROI: 71 (BV:9 x Freq:7 + Legal:0 + Defect:8)
//   BV 9 — F1 is the single fact that lets this feature ship without editing
//     `schema.sql:1354` or `wrongTwice.ts:45`. If it breaks, essay questions start
//     feeding the mastery model and the wrong-twice set, which changes what Layer 3
//     recommends to the student — a wrong answer to a different question entirely.
//   Freq 7 — every result render of every attempt containing a graded essay.
//   Defect 8 — the natural instinct when a band lands is to set scored:true, and
//     nothing about that change looks wrong at the point it is written.
// Behavior: a per_question fixture containing a GRADED essay element (essayState
//   "graded", essayEarned 0.75, essayMax 1, scored false, isCorrect false) is read
//   through getResult() at the mocked Supabase boundary -> real essayLifecycle
//   summarises it -> the legacy score triple is untouched, the element still
//   reports scored:false, and the real wrongTwice derivation ignores it.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (getResult) + real
//   SOURCE/lib/scoring/essayLifecycle.ts + real SOURCE/lib/scoring/wrongTwice.ts +
//   mocked Supabase client
// @complexity: medium
// @real-dependency: none IN THIS LANE — but note the split, because this case
//   proves only the TypeScript half. `record_skill_mastery()`'s own exclusion
//   (`coalesce((pq->>'scored')::boolean, true)`, schema.sql:1354) is a Postgres
//   predicate; it is asserted on the real database by the existing
//   `recordSkillMastery.int.test.ts` and by the service lane, NOT here. Saying so
//   at the boundary is the point: a mock cannot prove a SQL filter.
// Primary failure mode: `record_essay_grade()` or a later refactor sets
//   `scored: true` on the element when the band lands ("it IS scored now"),
//   whereupon `record_skill_mastery()` stops excluding the row and the essay starts
//   contributing to skill mastery; and `computeWrongTwiceQuestionIds()`
//   (`wrongTwice.ts:45` skips only on `row.scored === false`) starts returning
//   essay question ids, so the tutor surfaces essay questions as "sai hai lần".
//   The adjacent mode: the essay's band leaks into `result.correct` / `result.total`
//   on the read path, which silently redefines what `ScoreCard`'s
//   `wrong = total - correct` derivation means.
// Proof obligation — what the implemented test must assert:
//   (a) The graded element as returned by getResult() has `scored === false` and
//       `isCorrect === false`, and the `scored` key is PRESENT (assert
//       `"scored" in element`, not just the value — a missing key hits the
//       `coalesce(..., true)` default in SQL and flips the filter).
//   (b) The score triple is untouched: `result.totalScore`, `result.correct` and
//       `result.total` toEqual independently authored literals computed from the
//       NON-essay questions only. Use a fixture where including the essay would
//       visibly change every one of the three (e.g. 4 MCQ, 3 correct, plus a
//       graded essay at band 0.75) — with a fixture where the numbers coincide,
//       this assertion proves nothing.
//   (c) Real `computeWrongTwiceQuestionIds()` over rows containing this graded
//       essay TWICE (two attempts, both "wrong") returns an array that does NOT
//       contain the essay's questionId, while still containing the id of a
//       genuinely twice-wrong MCQ in the same fixture — the positive control that
//       stops (c) from passing because the function returned nothing at all.
//       DEDUPLICATION, read before writing this obligation: the plain
//       `scored: false` exclusion is ALREADY covered at unit level by
//       `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` Test 2 (:105-140), whose
//       fixture is already named `Q-ESSAY`. Do not restate it. What is NEW here —
//       and the only thing justifying (c) in this lane — is that the element now
//       ALSO carries the six new keys (essayState/essayEarned/essayMax/
//       essayLowConfidence/essayAttempts/essayGradedAt) and arrives through the
//       real read path rather than a hand-built unit fixture: the obligation is
//       that the presence of those keys does not flip the predicate. If that
//       framing is dropped, (c) is duplicate coverage and should be deleted rather
//       than written.
//   (d) EG-BE-027 arithmetic: `essaySummary.earned` / `.max` count the graded
//       essay only. In a fixture with one graded (0.75), one pending and one
//       failed essay: earned === 0.75, max === 1, gradedCount === 1 — NOT max === 3.
//       A failed essay contributing 0 to earned and 1 to max is exactly the silent
//       zero AC-015 forbids.
//   (e) `essayLowConfidence: true` on the graded element changes NO number in
//       (b) or (d) — same fixture run twice, flag flipped, numeric output toEqual.
describe("Graded essay stays out of the score triple and Layer 3 (INT-3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(READ_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 4 MCQ, 3 of them correct, plus one graded essay at band 0.75.
   *
   *  Chosen so that counting the essay would move ALL THREE numbers: the triple
   *  would become 5 / 3.75 / 6.75 instead of 4 / 3 / 7.5. With a fixture where
   *  the numbers coincide, obligation (b) would prove nothing. */
  const FOUR_MCQ_AND_A_GRADED_ESSAY: unknown[] = [
    mcqEl("q1", true),
    mcqEl("q2", true),
    mcqEl("q3", true),
    mcqEl("q4", false),
    essayEl({
      questionId: "q-graded",
      essayState: "graded",
      essayEarned: 0.75,
      essayMax: 1,
      essayAttempts: 1,
    }),
  ];

  /** The independently authored triple: 3 correct of 4 SCORED questions ⇒ 7.5.
   *  Hand-computed from the four MCQs only — the essay is not in it. */
  const NON_ESSAY_TRIPLE = { totalScore: 7.5, correct: 3, total: 4 };

  it("(a) the graded element keeps scored:false and isCorrect:false, and the `scored` KEY is present", async () => {
    const { examResult } = await driveBothReadPaths({
      perQuestion: FOUR_MCQ_AND_A_GRADED_ESSAY,
      triple: NON_ESSAY_TRIPLE,
    });

    const graded = examResult.result.perQuestion.find((r) => r.questionId === "q-graded")!;
    expect(graded.scored).toBe(false);
    expect(graded.isCorrect).toBe(false);
    // The KEY, not just the value. A missing `scored` hits SQL's
    // `coalesce((pq->>'scored')::boolean, true)` default (schema.sql:1354) and
    // FLIPS the mastery filter, enrolling graded essays into the mastery model.
    expect("scored" in graded).toBe(true);
    // HONEST SEAM, stated where it applies: this proves the TypeScript half only.
    // The SQL predicate itself is proven by recordSkillMastery.int.test.ts and by
    // the service lane. A mock cannot prove a SQL filter.
    expect(graded.essay?.state).toBe("graded");
  });

  it("(b) the score triple equals literals computed from the NON-essay questions only", async () => {
    const { examResult } = await driveBothReadPaths({
      perQuestion: FOUR_MCQ_AND_A_GRADED_ESSAY,
      triple: NON_ESSAY_TRIPLE,
    });

    // Counting the essay would make these 5 / 3.75 / 6.75 — every one of the
    // three moves, which is what makes this fixture able to fail.
    expect(examResult.result.total).toBe(4);
    expect(examResult.result.correct).toBe(3);
    expect(examResult.result.totalScore).toBe(7.5);
    // ScoreCard derives `wrong = total - correct`; the essay silently entering
    // the denominator would redefine what that number means on a live surface.
    expect(examResult.result.total - examResult.result.correct).toBe(1);
  });

  it("(c) the six new keys, arriving through the REAL read path, do not flip the wrong-twice predicate", async () => {
    // FRAMING — this is what justifies the case existing at all. The plain
    // `scored: false` exclusion is already covered at unit level by
    // wrongTwice.test.ts Test 2 (:105-140), on a fixture already named Q-ESSAY,
    // and restating it here would be duplicate coverage. What is NEW: the element
    // now ALSO carries the lifecycle keys and arrives through getResult()'s real
    // history read rather than a hand-built unit fixture.
    const viewed: unknown[] = [
      mcqEl("q-wrong-twice", false),
      essayEl({ questionId: "q-graded", essayState: "graded", essayEarned: 0.75, essayMax: 1 }),
    ];
    // The same two questions, wrong again on a SECOND distinct attempt.
    const historyRows = [
      { attempt_id: READ_ATTEMPT_ID, per_question: viewed },
      { attempt_id: "attempt-earlier", per_question: viewed },
    ];

    const { examResult } = await driveBothReadPaths({
      perQuestion: viewed,
      triple: { totalScore: 0, correct: 0, total: 1 },
      historyRows,
    });

    const mcq = examResult.result.perQuestion.find((r) => r.questionId === "q-wrong-twice")!;
    const essay = examResult.result.perQuestion.find((r) => r.questionId === "q-graded")!;

    // Positive control first: without it, this case would pass for a predicate
    // that returned nothing at all.
    expect(mcq.hasBeenWrongTwice).toBe(true);
    // …and the essay stays out, WITH the six keys present on it.
    expect(essay.hasBeenWrongTwice).toBeUndefined();
    expect(essay.essay?.state).toBe("graded");
  });

  it("(d) EG-BE-027 arithmetic in the same attempt as the triple: one graded, one pending, one failed ⇒ earned 0.75, max 1", async () => {
    const { examResult } = await driveBothReadPaths({
      perQuestion: [
        ...FOUR_MCQ_AND_A_GRADED_ESSAY,
        essayEl({ questionId: "q-pending" }),
        essayEl({ questionId: "q-failed", essayState: "failed", essayAttempts: ESSAY_MAX_ATTEMPTS }),
      ],
      triple: NON_ESSAY_TRIPLE,
    });

    // max is 1, NOT 3. A failed essay adding 0 to earned and 1 to max is exactly
    // the silent zero AC-015 forbids — and it looks completely reasonable at the
    // point someone writes it.
    expect(examResult.essaySummary).toEqual({
      earned: 0.75,
      max: 1,
      gradedCount: 1,
      pendingCount: 1,
      failedCount: 1,
      unresolvedCount: 1,
    });
    // The essay arithmetic and the score triple are separate ledgers; adding the
    // two extra essays moved neither of the three numbers.
    expect(examResult.result.total).toBe(4);
    expect(examResult.result.correct).toBe(3);
    expect(examResult.result.totalScore).toBe(7.5);
  });

  it("(e) essayLowConfidence changes NO number — same fixture, flag flipped, numeric output identical", async () => {
    async function numbersWith(lowConfidence: boolean) {
      const { examResult } = await driveBothReadPaths({
        perQuestion: [
          ...FOUR_MCQ_AND_A_GRADED_ESSAY.slice(0, 4),
          essayEl({
            questionId: "q-graded",
            essayState: "graded",
            essayEarned: 0.75,
            essayMax: 1,
            essayAttempts: 1,
            essayLowConfidence: lowConfidence,
          }),
        ],
        triple: NON_ESSAY_TRIPLE,
      });
      return {
        totalScore: examResult.result.totalScore,
        correct: examResult.result.correct,
        total: examResult.result.total,
        essaySummary: examResult.essaySummary,
      };
    }

    const off = await numbersWith(false);
    const on = await numbersWith(true);

    // AC-046: the flag is display-only. It must reach the view…
    expect(on).toEqual(off);
    const { examResult } = await driveBothReadPaths({
      perQuestion: [
        essayEl({
          questionId: "q-graded",
          essayState: "graded",
          essayEarned: 0.75,
          essayMax: 1,
          essayAttempts: 1,
          essayLowConfidence: true,
        }),
      ],
      triple: NON_ESSAY_TRIPLE,
    });
    // …which is asserted here so that `on.toEqual(off)` cannot be satisfied by
    // the flag being dropped on the floor entirely.
    expect(examResult.result.perQuestion[0].essay?.lowConfidence).toBe(true);
  });
});
