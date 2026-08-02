// Short-Answer Scoring [fixture-e2e] Driver Script
// Design Docs: docs/design/short-answer-scoring-backend-design.md (v1.1),
//   docs/design/short-answer-scoring-frontend-design.md (v1.0)
// UI Spec: docs/ui-spec/short-answer-scoring-ui-spec.md (v1.0), AC-001..AC-007
// Skeleton generated: 2026-08-02 | Converted (Work Plan Phase 1, Task 1.6 /
//   frontend-task-02): 2026-08-02
//
// This repo has no `@playwright/test` dependency and no `playwright.config.ts`
// committed yet — only the Playwright MCP browser-automation server is
// configured (`.mcp.json`) for interactive/manual sessions (see the frontend
// Design Doc's Test Boundaries: "Playwright MCP / manual pass (no CI)").
// Following the exact precedent `rating.fixture.e2e.test.ts` (FE2Driver/
// FE2Locator) and `history.fixture.e2e.test.ts` (HistoryDriver/HistoryLocator)
// already established, this script is written against a minimal `SADriver`/
// `SALocator` interface that is a structural SUBSET of Playwright's real
// `Page`/`Locator` API (`goto`/`url`/`getByRole`/`getByText`/`click`/
// `getAttribute`/`first`/`count`, per the task's own required subset, plus
// `nth`/`textContent` — genuine Playwright `Locator` methods too — added only
// where a proof obligation below needs subtree scoping that the base subset
// cannot express, mirroring how `history.fixture.e2e.test.ts` itself extended
// FE2's subset with `waitForDownload`/`networkRequestCount` for its own
// obligations). A real Playwright `Page`/`Locator` satisfies this interface
// as-is, so once a harness exists this script runs unchanged.
// Assertions use Node's built-in `node:assert/strict` (no new dependency).
//
// Fixture-driven backend (task's own framing, Implementation Content line 1):
// "backend state (attempt, questions, exam_results) is fixture-driven, not
// live Supabase." Concretely: `getExamForPlayer()`/`submitExam()`/
// `getResult()` must resolve against `FIXTURE_RESULT_DATA` below instead of a
// live Supabase instance for this script to run against `npm run dev` — this
// repo has no existing request/route-mocking layer (no MSW, no test-mode
// query override), so wiring this fixture into a real running page is a
// residual left for whoever stands up the Playwright harness, same class of
// residual already flagged by `rating.fixture.e2e.test.ts`'s and
// `history.fixture.e2e.test.ts`'s own header notes.
//
// Driver-capability residual (specific to this journey): the `SALocator`
// interface deliberately has no `fill`/`type` method (matching the task's
// specified structural subset exactly). The exam player's `short_answer`
// `<input>` (`QuestionRenderer.tsx`) therefore is not literally typed into by
// this script. This is intentional, not an oversight: per the task's own
// Behavior description and Failure Response guidance ("confirm whether the
// fixture-driven backend state — simulating `computeScore()`'s output —
// matches what a real `submitExam()` call would produce"), the design here is
// that `FIXTURE_RESULT_DATA.result.perQuestion` IS the already-computed
// `computeScore()` output the fixture-driven `submitExam()` override must
// resolve to once the "Submit" button is clicked, regardless of whatever (or
// no) value the DOM inputs hold at click time — the subject under test is the
// scoring-output-to-render composition (backend `computeScore()` semantics x
// frontend `page.tsx` render), not the literal browser-level text-entry
// interaction, which carries no risk this feature introduces (the `<input>`'s
// `onChange`/`value` wiring is unmodified by both dependency tasks). The real
// harness's fixture-driven `submitExam()` override is what must ignore actual
// keystroke state and return this fixture's per-question rows verbatim — that
// wiring is the same class of residual as the fixture-injection gap already
// noted above, not a new one this task introduces.

import assert from "node:assert/strict";

// --- Driver (Playwright `Page`/`Locator` structural subset) ---------------

export interface SALocator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  textContent(): Promise<string | null>;
  first(): SALocator;
  /** Real Playwright `Locator.nth()` — used to select a specific per-question
   *  `<li>` card by its known fixture-order index (see FIXTURE_PER_QUESTION),
   *  since cards carry no distinguishing `aria-label`. */
  nth(index: number): SALocator;
  count(): Promise<number>;
  /** Real Playwright `Locator.getByText()` — scopes a text search to this
   *  locator's own subtree, needed to disambiguate e.g. the status chip's
   *  exact "Correct" text from the body's "Correct answer:" label within the
   *  same card. */
  getByText(text: string | RegExp): SALocator;
}

export interface SADriver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): SALocator;
  getByText(text: string | RegExp): SALocator;
}

// --- Fixture data -----------------------------------------------------------
// 3 short_answer sub-states (correct via numeric equivalence, genuinely wrong,
// skipped) + 1 mcq baseline (Test 1, AC-001-006) + 1 essay question
// (Test 2, AC-007), all in one attempt — mirrors the skeleton's own Test 2
// Behavior ("alongside the short_answer questions from Test 1").

export type FixtureChoiceId = "A" | "B" | "C" | "D";

/** Structural stand-in for `PerQuestionResult` (`SOURCE/types/result.ts`) —
 *  field names match exactly so this fixture is a faithful stand-in for
 *  `computeScore()`'s real output shape. */
export interface FixturePerQuestionResult {
  questionId: string;
  selected?: string;
  /** mcq-only per `PerQuestionResult`'s own contract (`types/result.ts:11-12`,
   *  "CHỈ câu mcq" / MCQ only) — intentionally never set on the 3
   *  short_answer rows below. Enforced by `checkSANeverPopulatesCorrectField`
   *  (Reference Contract: UI Spec Decisions Record D3). */
  correct?: FixtureChoiceId;
  isCorrect: boolean;
  scored?: boolean;
}

/** Structural stand-in for `ResultQuestion` (`SOURCE/app/(layer2)/queries.ts`). */
export interface FixtureResultQuestion {
  content: string;
  choices: { id: FixtureChoiceId; text: string }[];
  questionType: "mcq" | "essay" | "true_false" | "short_answer";
  essayAnswer?: string;
}

export const FIXTURE_EXAM_ID = "exam-short-answer-scoring";
export const FIXTURE_ATTEMPT_ID = "attempt-short-answer-scoring-1";
export const SHORT_ANSWER_PLAYER_PATH = `/exams/${FIXTURE_EXAM_ID}/attempt/${FIXTURE_ATTEMPT_ID}`;
export const SHORT_ANSWER_RESULT_PATH = `${SHORT_ANSWER_PLAYER_PATH}/result`;
export const SHORT_ANSWER_DETAIL_PATH = `${SHORT_ANSWER_RESULT_PATH}/detail`;

// Question content deliberately never repeats the literal submitted/expected
// answer text (e.g. no "1.04" inside a question's own prose) — Playwright's
// getByText matches the deepest element containing a substring, and every
// answer-line assertion below depends on each searched string being unique
// to exactly one leaf element on the page.
const SA_CORRECT_ID = "q-sa-correct";
const SA_WRONG_ID = "q-sa-wrong";
const SA_SKIPPED_ID = "q-sa-skipped";
const MCQ_BASELINE_ID = "q-mcq-baseline";
const ESSAY_ID = "q-essay-regression";

export const FIXTURE_QUESTIONS: Record<string, FixtureResultQuestion> = {
  [SA_CORRECT_ID]: {
    content: "Question SA-1: convert the given measurement to standard decimal notation.",
    choices: [],
    questionType: "short_answer",
    essayAnswer: "1.04",
  },
  [SA_WRONG_ID]: {
    content: "Question SA-2: compute two raised to the eighth power.",
    choices: [],
    questionType: "short_answer",
    essayAnswer: "256",
  },
  [SA_SKIPPED_ID]: {
    content:
      "Question SA-3: state the ratio of a circle's circumference to its diameter, rounded to two decimals.",
    choices: [],
    questionType: "short_answer",
    essayAnswer: "3.14",
  },
  [MCQ_BASELINE_ID]: {
    content: "Question MCQ-1: which planet is known as the Red Planet?",
    choices: [
      { id: "A", text: "Venus" },
      { id: "B", text: "Mars" },
      { id: "C", text: "Jupiter" },
      { id: "D", text: "Saturn" },
    ],
    questionType: "mcq",
  },
  [ESSAY_ID]: {
    content: "Question ESSAY-1: explain the significance of the water cycle for agriculture.",
    choices: [],
    questionType: "essay",
    essayAnswer:
      "A full-paragraph model answer discussing evaporation, precipitation, and irrigation timing.",
  },
};

/** Render order == array order (`result.perQuestion.map(...)`, `page.tsx`) —
 *  index 0-2 the 3 short_answer sub-states, index 3 the mcq baseline
 *  (obligation (e)), index 4 the essay regression card (Test 2). */
export const FIXTURE_PER_QUESTION: FixturePerQuestionResult[] = [
  { questionId: SA_CORRECT_ID, selected: "1,04", isCorrect: true, scored: true },
  { questionId: SA_WRONG_ID, selected: "128", isCorrect: false, scored: true },
  { questionId: SA_SKIPPED_ID, selected: undefined, isCorrect: false, scored: true },
  { questionId: MCQ_BASELINE_ID, selected: "B", correct: "B", isCorrect: true, scored: true },
  { questionId: ESSAY_ID, selected: undefined, isCorrect: false, scored: false },
];

export const FIXTURE_RESULT_DATA = {
  examId: FIXTURE_EXAM_ID,
  examTitle: "Short-Answer Scoring Fixture Exam",
  result: {
    totalScore: 5,
    correct: 2,
    total: 4,
    perQuestion: FIXTURE_PER_QUESTION,
    topicBreakdown: [{ topic: "Toán", correct: 2, total: 4 }],
  },
  questions: FIXTURE_QUESTIONS,
  startedAt: "2026-08-02T09:00:00.000Z",
  submittedAt: "2026-08-02T09:20:00.000Z",
};

const SHORT_ANSWER_ROW_INDEXES = { correct: 0, wrong: 1, skipped: 2, mcqBaseline: 3, essay: 4 } as const;

// =============================================================================
// Test 1 (RESERVED SLOT) — Full journey: submit an exam containing
// short_answer questions -> view result detail -> all three scored sub-states
// (correct / wrong / skipped) render correctly instead of the pre-feature
// blank <ul>
// =============================================================================
// AC: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006 (UI Spec).
// ROI: 74 (BV:8 x Freq:8 + Legal:0 + Defect:10) — highest-value slot in this
//   suite: proves the full backend-scoring x frontend-render composition for
//   all 3 short_answer sub-states at once, guarding the exact defect this
//   feature exists to fix (pre-feature blank <ul> for short_answer rows).
// Behavior: submitting an exam with 3 short_answer sub-states (correct via
//   numeric equivalence, genuinely wrong, skipped) plus an mcq baseline ->
//   the fixture-driven scoring pipeline resolves each row's isCorrect/scored
//   state -> the result detail page renders each row's correct/wrong/skipped
//   text and color and the matching status chip, without ever reading
//   PerQuestionResult.correct.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend / fixture-driven state) — exam player
//   route, result summary route, result detail route (page.tsx); backend
//   scoring pipeline (submitExam -> computeScore -> exam_results) driven by
//   FIXTURE_RESULT_DATA, not a live Supabase instance.
// @complexity: high
// @real-dependency: none — fixture/mocked backend throughout.

/** Static (non-DOM) invariant check — the fixture data itself never
 *  populates `correct` for any short_answer row (obligation (d) first half:
 *  "the fixture data does not populate `correct` for any short_answer row —
 *  absence itself is part of the fixture setup, not merely an assertion").
 *  The second half of (d) — "no assertion in this test reads or depends on
 *  `PerQuestionResult.correct`" — is a static code-review guarantee: no
 *  function in this file reads `.correct` on any FIXTURE_PER_QUESTION row. */
export function checkSANeverPopulatesCorrectField(): void {
  const shortAnswerRows = [
    FIXTURE_PER_QUESTION[SHORT_ANSWER_ROW_INDEXES.correct],
    FIXTURE_PER_QUESTION[SHORT_ANSWER_ROW_INDEXES.wrong],
    FIXTURE_PER_QUESTION[SHORT_ANSWER_ROW_INDEXES.skipped],
  ];
  for (const row of shortAnswerRows) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(row, "correct"),
      false,
      `short_answer row "${row.questionId}" must not populate PerQuestionResult.correct (mcq-only field)`
    );
  }
}

/** Drives the multi-step journey (exam player -> submit -> result summary ->
 *  "View details" -> result detail) and returns the per-question `<li>`
 *  locator collection for the sub-state checks below. */
async function navigateToResultDetail(driver: SADriver): Promise<SALocator> {
  await driver.goto(SHORT_ANSWER_PLAYER_PATH);

  const submitButton = driver.getByRole("button", { name: /Submit/ });
  await submitButton.click();
  assert.match(
    driver.url(),
    new RegExp(`/exams/${FIXTURE_EXAM_ID}/attempt/${FIXTURE_ATTEMPT_ID}/result$`),
    "submitting must land on the result summary route"
  );

  const viewDetailsLink = driver.getByRole("link", { name: "View details" });
  await viewDetailsLink.click();
  assert.equal(driver.url(), SHORT_ANSWER_DETAIL_PATH, "'View details' must land on result detail");

  const questionCards = driver.getByRole("listitem");
  assert.equal(
    await questionCards.count(),
    FIXTURE_PER_QUESTION.length,
    "result detail must render exactly one card per fixture per-question row"
  );
  return questionCards;
}

/** (a) scored-correct sub-state — "Your answer" fern, "Correct answer" fern,
 *  status chip "Correct" (AC-001, AC-002, AC-003, AC-006). */
async function checkSA1ScoredCorrect(cards: SALocator): Promise<void> {
  const card = cards.nth(SHORT_ANSWER_ROW_INDEXES.correct);

  const yourAnswer = card.getByText("1,04");
  assert.ok(
    (await yourAnswer.getAttribute("class"))?.includes("text-[#4F7942]"),
    "scored-correct 'Your answer' must be fern"
  );

  const correctAnswer = card.getByText("1.04");
  assert.ok(
    (await correctAnswer.getAttribute("class"))?.includes("text-[#4F7942]"),
    "'Correct answer' line must always be fern"
  );

  const chip = card.getByText(/^Correct$/);
  assert.ok(
    (await chip.getAttribute("class"))?.includes("text-[#4F7942]"),
    "status chip must read 'Correct' in fern"
  );
}

/** (b) scored-wrong sub-state — "Your answer" destructive, "Correct answer"
 *  stays fern, status chip "Wrong" (AC-001, AC-002, AC-004, AC-006). */
async function checkSA1ScoredWrong(cards: SALocator): Promise<void> {
  const card = cards.nth(SHORT_ANSWER_ROW_INDEXES.wrong);

  const yourAnswer = card.getByText("128");
  assert.ok(
    (await yourAnswer.getAttribute("class"))?.includes("text-destructive"),
    "scored-wrong 'Your answer' must be destructive"
  );

  const correctAnswer = card.getByText("256");
  assert.ok(
    (await correctAnswer.getAttribute("class"))?.includes("text-[#4F7942]"),
    "'Correct answer' line must stay fern even when wrong"
  );

  const chip = card.getByText(/^Wrong$/);
  assert.ok(
    (await chip.getAttribute("class"))?.includes("text-destructive"),
    "status chip must read 'Wrong' in destructive"
  );
}

/** (c) scored-skipped sub-state — "Your answer" renders literal
 *  "— skipped —" in muted, "Correct answer" stays fern, status chip
 *  "Skipped" (AC-001, AC-002, AC-005, AC-006). */
async function checkSA1ScoredSkipped(cards: SALocator): Promise<void> {
  const card = cards.nth(SHORT_ANSWER_ROW_INDEXES.skipped);

  const yourAnswer = card.getByText("— skipped —");
  assert.ok(
    (await yourAnswer.getAttribute("class"))?.includes("text-muted-foreground"),
    "scored-skipped 'Your answer' must render '— skipped —' in muted"
  );

  const correctAnswer = card.getByText("3.14");
  assert.ok(
    (await correctAnswer.getAttribute("class"))?.includes("text-[#4F7942]"),
    "'Correct answer' line must stay fern even when skipped"
  );

  const chip = card.getByText(/^Skipped$/);
  assert.ok(
    (await chip.getAttribute("class"))?.includes("text-muted-foreground"),
    "status chip must read 'Skipped' in muted"
  );
}

/** (e) status chip zero-change confirmation — the chip's text/color for a
 *  short_answer row matches the identical rule already used for the mcq
 *  baseline in the same result set (no questionType-specific chip logic
 *  exists or is needed) (AC-006). */
async function checkSA1StatusChipMatchesMcqBaselineConvention(cards: SALocator): Promise<void> {
  const correctCard = cards.nth(SHORT_ANSWER_ROW_INDEXES.correct);
  const mcqCard = cards.nth(SHORT_ANSWER_ROW_INDEXES.mcqBaseline);

  const shortAnswerChipClass = await correctCard.getByText(/^Correct$/).getAttribute("class");
  const mcqChipClass = await mcqCard.getByText(/^Correct$/).getAttribute("class");

  assert.ok(shortAnswerChipClass, "short_answer row's chip must render a class");
  assert.equal(
    shortAnswerChipClass,
    mcqChipClass,
    "short_answer and mcq rows in the same result set must share the identical chip class — no per-type chip logic"
  );
}

/** Orchestrator — Test 1 (AC-001-006): the full journey, then all 5 proof
 *  obligations (a)-(e). */
export async function runSA1ShortAnswerSubStatesRenderCorrectly(driver: SADriver): Promise<void> {
  checkSANeverPopulatesCorrectField(); // (d), static half
  const cards = await navigateToResultDetail(driver);
  await checkSA1ScoredCorrect(cards); // (a)
  await checkSA1ScoredWrong(cards); // (b)
  await checkSA1ScoredSkipped(cards); // (c)
  await checkSA1StatusChipMatchesMcqBaselineConvention(cards); // (e)
  // (d), DOM half: no call above reads `.correct` on any FIXTURE_PER_QUESTION
  // row — verified by code inspection of this function and its callees.
}

// =============================================================================
// Test 2 (additional slot, ROI 37) — essay regression: an essay question's
// result detail card renders byte-for-byte unchanged (not-scored branch)
// =============================================================================
// AC: AC-007 (UI Spec / frontend DD).
// ROI: 37 (BV:5 x Freq:6 + Legal:0 + Defect:7) — regression guard only (essay
//   never enters the new branch); lower value than Test 1 since it protects
//   against an accidental diff to a neighboring branch, not a new feature path.
// Behavior: submitting the same fixture attempt's essay question (alongside
//   the short_answer questions from Test 1) -> the essay row stays
//   scored:false and never enters the new short_answer sub-branch -> its
//   result detail card renders the pre-existing not-scored branch unchanged
//   (muted "Not auto-scored" chip, "Stored answer:" label, no correctness
//   color-coding on the status chip or the "Your answer" value).
// @category: edge-case
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend / fixture-driven state) — result
//   detail route (page.tsx), not-scored branch only.
// @complexity: medium
// @real-dependency: none — same fixture-driven boundary as Test 1.

/** (a) The essay question's card shows the "Not auto-scored" chip in muted
 *  color — unchanged from pre-feature behavior. */
async function checkSA2EssayChipUnchanged(essayCard: SALocator): Promise<void> {
  const chip = essayCard.getByText(/^Not auto-scored$/);
  assert.equal(await chip.isVisible(), true, "essay card must show the 'Not auto-scored' chip");
  assert.ok(
    (await chip.getAttribute("class"))?.includes("text-muted-foreground"),
    "'Not auto-scored' chip must be muted"
  );
}

/** (b) The essay question's second text line reads "Stored answer:" (not
 *  "Correct answer:" — exclusive to the new scored short_answer sub-branch,
 *  UI Spec Decision D2). */
async function checkSA2EssayUsesStoredAnswerLabel(essayCard: SALocator): Promise<void> {
  const storedAnswerLabel = essayCard.getByText("Stored answer:");
  assert.ok(
    (await storedAnswerLabel.count()) >= 1,
    "essay card must show the 'Stored answer:' label (not-scored branch)"
  );

  const correctAnswerLabel = essayCard.getByText("Correct answer:");
  assert.equal(
    await correctAnswerLabel.count(),
    0,
    "essay card must never show 'Correct answer:' — that label is scored-short_answer-only"
  );
}

/** (c) Neither element that would carry *correctness* color-coding if the
 *  essay question incorrectly fell into the scored branch — the status/eyebrow
 *  chip and the "Your answer" value span — is fern (#4F7942) or destructive
 *  colored on the essay card.
 *
 *  Deliberately NOT a whole-subtree "zero fern-classed element anywhere" scan:
 *  page.tsx's unchanged not-scored branch (`page.tsx:103-114`, confirmed via
 *  `git show 9887bbe`, pre-existing/untouched by this feature) unconditionally
 *  renders the "Stored answer:" value in a fern-classed span
 *  (`text-[#4F7942]`) for EVERY not-scored question type (true_false AND
 *  essay) — that span is not correctness color-coding (its color is not
 *  conditioned on `isCorrect`/`isScored`), so a whole-subtree scan would fail
 *  even against the correct, unregressed implementation. This narrows to the
 *  two elements whose color IS correctness-conditioned in the scored branch
 *  (the status chip's `status.cls` and the short_answer sub-branch's "Your
 *  answer" `status.cls`-colored span) and asserts neither carries that coding
 *  on the essay card. */
async function checkSA2EssayCardHasNoCorrectnessColorClass(essayCard: SALocator): Promise<void> {
  const statusChip = essayCard.getByText(/^Not auto-scored$/);
  const statusChipClass = (await statusChip.getAttribute("class")) ?? "";
  assert.ok(
    !statusChipClass.includes("4F7942") && !statusChipClass.includes("destructive"),
    "essay card's status/eyebrow chip must carry no correctness color (fern/destructive)"
  );

  // page.tsx's not-scored branch renders the student input via `studentInput
  // || "— skipped —"`; the essay fixture row's `selected` is undefined, so
  // this resolves to the literal "— skipped —" text, in a `text-foreground`
  // span (never `status.cls`) — unlike the scored short_answer sub-branch's
  // "Your answer" span, whose color IS `status.cls`-driven.
  const yourAnswerValue = essayCard.getByText("— skipped —");
  const yourAnswerClass = (await yourAnswerValue.getAttribute("class")) ?? "";
  assert.ok(
    !yourAnswerClass.includes("4F7942") && !yourAnswerClass.includes("destructive"),
    "essay card's 'Your answer' value must carry no correctness color (fern/destructive)"
  );
}

/** Orchestrator — Test 2 (AC-007): independently re-drives the same journey
 *  (test independence — does not depend on Test 1 having already run), then
 *  all 3 proof obligations (a)-(c) against the essay question's card only. */
export async function runSA2EssayRegressionRendersUnchanged(driver: SADriver): Promise<void> {
  const cards = await navigateToResultDetail(driver);
  const essayCard = cards.nth(SHORT_ANSWER_ROW_INDEXES.essay);

  await checkSA2EssayChipUnchanged(essayCard); // (a)
  await checkSA2EssayUsesStoredAnswerLabel(essayCard); // (b)
  await checkSA2EssayCardHasNoCorrectnessColorClass(essayCard); // (c)
}

/** Top-level orchestrator — runs both fixture-e2e tests in this file against
 *  a supplied driver wired to the fixture-driven backend (see file header). */
export async function runShortAnswerScoringFixtureE2E(driver: SADriver): Promise<void> {
  await runSA1ShortAnswerSubStatesRenderCorrectly(driver);
  await runSA2EssayRegressionRendersUnchanged(driver);
}
