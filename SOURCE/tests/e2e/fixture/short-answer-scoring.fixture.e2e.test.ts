// Short-Answer Scoring [fixture-e2e] Script driver
// Design Docs: docs/design/short-answer-scoring-backend-design.md (v1.1),
//   docs/design/short-answer-scoring-frontend-design.md (v1.0)
// UI Spec: docs/ui-spec/short-answer-scoring-ui-spec.md (v1.0), AC-001..AC-007
// Skeleton sinh: 2026-08-02 | Chuyển đổi (Work Plan Phase 1, Task 1.6 /
//   frontend-task-02): 2026-08-02
//
// Repo này không có phụ thuộc `@playwright/test` và chưa commit `playwright.config.ts`
// — chỉ máy chủ tự động hoá trình duyệt Playwright MCP được
// cấu hình (`.mcp.json`) cho các phiên tương tác/thủ công (xem Test Boundaries của
// frontend Design Doc: "Playwright MCP / lượt thủ công (không CI)").
// Theo đúng tiền lệ `rating.fixture.e2e.test.ts` (FE2Driver/
// FE2Locator) và `history.fixture.e2e.test.ts` (HistoryDriver/HistoryLocator)
// đã thiết lập, script này được viết dựa trên một interface `SADriver`/
// `SALocator` tối thiểu là một tập CON cấu trúc của API `Page`/`Locator` thật của Playwright
// (`goto`/`url`/`getByRole`/`getByText`/`click`/
// `getAttribute`/`first`/`count`, theo tập con bắt buộc của chính task, cộng
// `nth`/`textContent` — cũng là phương thức `Locator` thật của Playwright — chỉ thêm
// ở chỗ một nghĩa vụ chứng minh bên dưới cần giới hạn cây con mà tập con
// cơ sở không diễn đạt được, theo cách `history.fixture.e2e.test.ts` tự mở rộng
// tập con của FE2 bằng `waitForDownload`/`networkRequestCount` cho các nghĩa vụ
// của riêng nó). Một `Page`/`Locator` Playwright thật thoả interface này
// nguyên trạng, nên khi có harness, script này chạy không đổi.
// Các khẳng định dùng `node:assert/strict` có sẵn của Node (không phụ thuộc mới).
//
// Backend điều khiển bằng fixture (cách đặt vấn đề của chính task, Implementation Content dòng 1):
// "trạng thái backend (lượt làm, câu hỏi, exam_results) do fixture điều khiển, không phải
// Supabase sống." Cụ thể: `getExamForPlayer()`/`submitExam()`/
// `getResult()` phải resolve theo `FIXTURE_RESULT_DATA` bên dưới thay vì một
// instance Supabase sống để script này chạy được trên `npm run dev` — repo này
// chưa có lớp mock request/route nào (không MSW, không ghi đè truy vấn
// chế độ test), nên nối fixture này vào một trang đang chạy thật là một
// phần dư để lại cho ai dựng harness Playwright, cùng loại phần dư đã được
// ghi cờ trong comment đầu của `rating.fixture.e2e.test.ts` và
// `history.fixture.e2e.test.ts`.
//
// Phần dư khả năng driver (đặc thù của hành trình này): interface `SALocator`
// cố ý không có phương thức `fill`/`type` (khớp chính xác tập con cấu trúc mà task
// chỉ định). `<input>` `short_answer` của trình làm bài (`QuestionRenderer.tsx`)
// vì vậy không được script này gõ vào theo nghĩa đen.
// Đây là cố ý, không phải sơ suất: theo mô tả Behavior của chính task và hướng dẫn Failure
// Response ("xác nhận trạng thái backend điều khiển bằng fixture — mô phỏng
// đầu ra của `computeScore()` — khớp với thứ một lời gọi `submitExam()` thật sẽ tạo ra"),
// thiết kế ở đây là
// `FIXTURE_RESULT_DATA.result.perQuestion` CHÍNH LÀ đầu ra `computeScore()`
// đã tính mà phần ghi đè `submitExam()` điều khiển bằng fixture phải
// resolve ra khi nút "Submit" được bấm, bất kể giá trị nào (hay không giá trị nào)
// mà các input DOM giữ tại lúc bấm — đối tượng kiểm là phép ghép
// đầu-ra-chấm-điểm-sang-render (ngữ nghĩa `computeScore()` của backend x
// render `page.tsx` của frontend), không phải thao tác nhập chữ ở mức trình duyệt theo nghĩa đen, vốn
// không mang rủi ro nào mà tính năng này đưa vào (dây `onChange`/`value` của `<input>`
// không bị cả hai task phụ thuộc đụng tới). Phần ghi đè
// `submitExam()` điều khiển bằng fixture của harness thật là thứ phải bỏ qua trạng thái gõ phím thực tế
// và trả về nguyên văn các hàng theo-câu-hỏi của fixture này — việc nối dây đó
// là cùng loại phần dư với khoảng trống tiêm fixture đã
// nêu ở trên, không phải một cái mới mà task này đưa vào.

import assert from "node:assert/strict";

// --- Driver (Playwright `Page`/`Locator` structural subset) ---------------

export interface SALocator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  textContent(): Promise<string | null>;
  first(): SALocator;
  /** `Locator.nth()` thật của Playwright — dùng để chọn một thẻ
   *  `<li>` theo-từng-câu cụ thể bằng chỉ số theo thứ tự fixture đã biết
   *  (xem FIXTURE_PER_QUESTION), vì các thẻ không mang `aria-label` phân biệt nào. */
  nth(index: number): SALocator;
  count(): Promise<number>;
  /** `Locator.getByText()` thật của Playwright — giới hạn tìm kiếm chữ vào cây con của
   *  chính locator này, cần để phân biệt ví dụ chữ "Correct" chính xác của chip trạng thái
   *  với nhãn "Correct answer:" của thân trong cùng một
   *  thẻ. */
  getByText(text: string | RegExp): SALocator;
}

export interface SADriver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): SALocator;
  getByText(text: string | RegExp): SALocator;
}

// --- Dữ liệu fixture -----------------------------------------------------------
// 3 trạng thái con của short_answer (đúng nhờ tương đương số, sai thật,
// bỏ qua) + 1 mốc mcq (Test 1, AC-001-006) + 1 câu tự luận
// (Test 2, AC-007), tất cả trong một lượt làm — phản chiếu Behavior của chính Test 2
// trong skeleton ("cùng với các câu short_answer từ Test 1").

export type FixtureChoiceId = "A" | "B" | "C" | "D";

/** Vật thay thế cấu trúc cho `PerQuestionResult` (`SOURCE/types/result.ts`) —
 *  tên trường khớp chính xác nên fixture này là vật thay thế trung thực cho
 *  hình dạng đầu ra thật của `computeScore()`. */
export interface FixturePerQuestionResult {
  questionId: string;
  selected?: string;
  /** chỉ-mcq theo hợp đồng của chính `PerQuestionResult` (`types/result.ts:11-12`,
   *  "CHỈ câu mcq" / MCQ only) — cố ý không bao giờ đặt trên 3 hàng
   *  short_answer bên dưới. Được cưỡng chế bởi `checkSANeverPopulatesCorrectField`
   *  (Reference Contract: UI Spec Decisions Record D3). */
  correct?: FixtureChoiceId;
  isCorrect: boolean;
  scored?: boolean;
}

/** Vật thay thế cấu trúc cho `ResultQuestion` (`SOURCE/features/exams/queries.ts`). */
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

// Nội dung câu hỏi cố ý không bao giờ lặp lại chữ của câu trả lời đã nộp/kỳ vọng
// nguyên văn (ví dụ không có "1.04" trong văn xuôi của chính một câu hỏi) — getByText
// của Playwright khớp phần tử sâu nhất chứa một chuỗi con, và mọi
// khẳng định dòng-câu-trả-lời bên dưới phụ thuộc vào việc mỗi chuỗi tìm kiếm là duy nhất
// với đúng một phần tử lá trên trang.
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

/** Thứ tự render == thứ tự mảng (`result.perQuestion.map(...)`, `page.tsx`) —
 *  chỉ số 0-2 là 3 trạng thái con short_answer, chỉ số 3 là mốc mcq
 *  (nghĩa vụ (e)), chỉ số 4 là thẻ hồi quy tự luận (Test 2). */
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
// Test 1 (SUẤT GIỮ CHỖ) — Hành trình đầy đủ: nộp một đề có các câu
// short_answer -> xem chi tiết kết quả -> cả ba trạng thái con đã chấm
// (đúng / sai / bỏ qua) render đúng thay vì <ul> trống
// trước tính năng
// =============================================================================
// AC: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006 (UI Spec).
// ROI: 74 (BV:8 x Freq:8 + Legal:0 + Defect:10) — suất giá trị cao nhất trong bộ
//   này: chứng minh phép ghép chấm-điểm-backend x render-frontend đầy đủ cho
//   cả 3 trạng thái con short_answer cùng lúc, canh đúng lỗi mà tính năng này
//   sinh ra để sửa (<ul> trống trước tính năng cho các hàng short_answer).
// Hành vi: nộp một đề với 3 trạng thái con short_answer (đúng nhờ tương
//   đương số, sai thật, bỏ qua) cộng một mốc mcq ->
//   đường ống chấm điểm điều khiển bằng fixture giải quyết trạng thái isCorrect/scored của mỗi hàng
//   -> trang chi tiết kết quả render chữ đúng/sai/bỏ qua và màu của mỗi hàng
//   cùng chip trạng thái tương ứng, mà không bao giờ đọc
//   PerQuestionResult.correct.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: toàn UI (backend bị mock / trạng thái do fixture điều khiển) — route trình làm bài,
//   route tóm tắt kết quả, route chi tiết kết quả (page.tsx); đường ống
//   chấm điểm backend (submitExam -> computeScore -> exam_results) điều khiển bởi
//   FIXTURE_RESULT_DATA, không phải instance Supabase sống.
// @complexity: high
// @real-dependency: không có — backend fixture/mock xuyên suốt.

/** Kiểm bất biến tĩnh (không DOM) — chính dữ liệu fixture không bao giờ
 *  điền `correct` cho bất kỳ hàng short_answer nào (nửa đầu nghĩa vụ (d):
 *  "dữ liệu fixture không điền `correct` cho bất kỳ hàng short_answer nào —
 *  sự vắng mặt tự nó là một phần của thiết lập fixture, không chỉ là một khẳng định").
 *  Nửa sau của (d) — "không khẳng định nào trong test này đọc hay phụ thuộc
 *  `PerQuestionResult.correct`" — là một bảo đảm review code tĩnh: không
 *  hàm nào trong file này đọc `.correct` trên bất kỳ hàng FIXTURE_PER_QUESTION nào. */
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

/** Điều khiển hành trình nhiều bước (trình làm bài -> nộp -> tóm tắt kết quả ->
 *  "View details" -> chi tiết kết quả) và trả về bộ locator `<li>`
 *  theo-từng-câu cho các phép kiểm trạng thái con bên dưới. */
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

/** (a) trạng thái con chấm-đúng — "Your answer" fern, "Correct answer" fern,
 *  chip trạng thái "Correct" (AC-001, AC-002, AC-003, AC-006). */
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

/** (b) trạng thái con chấm-sai — "Your answer" destructive, "Correct answer"
 *  vẫn fern, chip trạng thái "Wrong" (AC-001, AC-002, AC-004, AC-006). */
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

/** (c) trạng thái con chấm-bỏ-qua — "Your answer" render literal
 *  "— skipped —" ở màu muted, "Correct answer" vẫn fern, chip trạng thái
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

/** (e) xác nhận không-đổi của chip trạng thái — chữ/màu của chip cho một
 *  hàng short_answer khớp quy tắc y hệt đã dùng cho mốc mcq
 *  trong cùng bộ kết quả (không có logic chip riêng theo questionType
 *  nào tồn tại hay cần thiết) (AC-006). */
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

/** Bộ điều phối — Test 1 (AC-001-006): hành trình đầy đủ, rồi cả 5 nghĩa vụ
 *  chứng minh (a)-(e). */
export async function runSA1ShortAnswerSubStatesRenderCorrectly(driver: SADriver): Promise<void> {
  checkSANeverPopulatesCorrectField(); // (d), static half
  const cards = await navigateToResultDetail(driver);
  await checkSA1ScoredCorrect(cards); // (a)
  await checkSA1ScoredWrong(cards); // (b)
  await checkSA1ScoredSkipped(cards); // (c)
  await checkSA1StatusChipMatchesMcqBaselineConvention(cards); // (e)
  // (d), nửa DOM: không lời gọi nào ở trên đọc `.correct` trên bất kỳ hàng
  //  FIXTURE_PER_QUESTION nào — kiểm chứng bằng đọc code của hàm này và các hàm nó gọi.
}

// =============================================================================
// Test 2 (suất bổ sung, ROI 37) — hồi quy tự luận: thẻ chi tiết kết quả của một câu tự luận
// render giống từng byte không đổi (nhánh không-chấm)
// =============================================================================
// AC: AC-007 (UI Spec / frontend DD).
// ROI: 37 (BV:5 x Freq:6 + Legal:0 + Defect:7) — chỉ là chốt hồi quy (tự luận
//   không bao giờ vào nhánh mới); giá trị thấp hơn Test 1 vì nó bảo vệ
//   khỏi một thay đổi vô tình ở nhánh lân cận, không phải một đường tính năng mới.
// Hành vi: nộp câu tự luận của cùng lượt làm fixture (cùng với
//   các câu short_answer từ Test 1) -> hàng tự luận vẫn là
//   scored:false và không bao giờ vào nhánh con short_answer mới -> thẻ
//   chi tiết kết quả của nó render nhánh không-chấm sẵn có không đổi
//   (chip "Not auto-scored" muted, nhãn "Stored answer:", không tô màu đúng-sai
//   trên chip trạng thái hay giá trị "Your answer").
// @category: edge-case
// @lane: fixture-e2e
// @dependency: toàn UI (backend bị mock / trạng thái do fixture điều khiển) — route
//   chi tiết kết quả (page.tsx), chỉ nhánh không-chấm.
// @complexity: medium
// @real-dependency: không có — cùng ranh giới điều khiển bằng fixture như Test 1.

/** (a) Thẻ của câu tự luận hiện chip "Not auto-scored" ở màu muted
 *  — không đổi so với hành vi trước tính năng. */
async function checkSA2EssayChipUnchanged(essayCard: SALocator): Promise<void> {
  const chip = essayCard.getByText(/^Not auto-scored$/);
  assert.equal(await chip.isVisible(), true, "essay card must show the 'Not auto-scored' chip");
  assert.ok(
    (await chip.getAttribute("class"))?.includes("text-muted-foreground"),
    "'Not auto-scored' chip must be muted"
  );
}

/** (b) Dòng chữ thứ hai của câu tự luận đọc "Stored answer:" (không phải
 *  "Correct answer:" — dành riêng cho nhánh con short_answer đã chấm mới,
 *  Quyết định D2 của UI Spec). */
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

/** (c) Không phần tử nào trong hai phần tử mà sẽ mang tô màu *đúng-sai* nếu
 *  câu tự luận vô tình rơi vào nhánh đã chấm — chip trạng thái/eyebrow
 *  và span giá trị "Your answer" — có màu fern (#4F7942) hay destructive
 *  trên thẻ tự luận.
 *
 *  Cố ý KHÔNG phải phép quét cả cây con "không phần tử nào mang class fern ở bất kỳ đâu":
 *  nhánh không-chấm không đổi của page.tsx (`page.tsx:103-114`, xác nhận qua
 *  `git show 9887bbe`, có sẵn/không bị tính năng này đụng) vô điều kiện
 *  render giá trị "Stored answer:" trong một span mang class fern
 *  (`text-[#4F7942]`) cho MỌI loại câu hỏi không-chấm (true_false VÀ
 *  essay) — span đó không phải tô màu đúng-sai (màu của nó không bị điều kiện hoá bởi
 *  `isCorrect`/`isScored`), nên một phép quét cả cây con sẽ hỏng ngay cả với
 *  cài đặt đúng, không hồi quy. Điều này thu hẹp vào hai phần tử mà màu
 *  BỊ điều kiện hoá theo đúng-sai ở nhánh đã chấm
 *  (`status.cls` của chip trạng thái và span "Your answer" tô bằng `status.cls`
 *  của nhánh con short_answer) và khẳng định cả hai không mang cách tô đó
 *  trên thẻ tự luận. */
async function checkSA2EssayCardHasNoCorrectnessColorClass(essayCard: SALocator): Promise<void> {
  const statusChip = essayCard.getByText(/^Not auto-scored$/);
  const statusChipClass = (await statusChip.getAttribute("class")) ?? "";
  assert.ok(
    !statusChipClass.includes("4F7942") && !statusChipClass.includes("destructive"),
    "essay card's status/eyebrow chip must carry no correctness color (fern/destructive)"
  );

  // Nhánh không-chấm của page.tsx render đầu vào của học sinh qua `studentInput
  // || "— skipped —"`; `selected` của hàng fixture tự luận là undefined, nên
  // cái này resolve ra literal "— skipped —", trong một span
  // `text-foreground` (không bao giờ `status.cls`) — khác span "Your answer" của
  // nhánh con short_answer đã chấm, có màu do `status.cls` quyết định.
  const yourAnswerValue = essayCard.getByText("— skipped —");
  const yourAnswerClass = (await yourAnswerValue.getAttribute("class")) ?? "";
  assert.ok(
    !yourAnswerClass.includes("4F7942") && !yourAnswerClass.includes("destructive"),
    "essay card's 'Your answer' value must carry no correctness color (fern/destructive)"
  );
}

/** Bộ điều phối — Test 2 (AC-007): chạy lại độc lập cùng hành trình
 *  (độc lập test — không phụ thuộc Test 1 đã chạy trước), rồi cả 3 nghĩa vụ
 *  chứng minh (a)-(c) chỉ trên thẻ của câu tự luận. */
export async function runSA2EssayRegressionRendersUnchanged(driver: SADriver): Promise<void> {
  const cards = await navigateToResultDetail(driver);
  const essayCard = cards.nth(SHORT_ANSWER_ROW_INDEXES.essay);

  await checkSA2EssayChipUnchanged(essayCard); // (a)
  await checkSA2EssayUsesStoredAnswerLabel(essayCard); // (b)
  await checkSA2EssayCardHasNoCorrectnessColorClass(essayCard); // (c)
}

/** Bộ điều phối cấp cao nhất — chạy cả hai test fixture-e2e trong file này trên
 *  một driver được cấp nối với backend điều khiển bằng fixture (xem comment đầu file). */
export async function runShortAnswerScoringFixtureE2E(driver: SADriver): Promise<void> {
  await runSA1ShortAnswerSubStatesRenderCorrectly(driver);
  await runSA2EssayRegressionRendersUnchanged(driver);
}
