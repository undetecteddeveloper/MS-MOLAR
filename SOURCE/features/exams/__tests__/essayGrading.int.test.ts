// Essay (Tự luận) Auto-Scoring — INTEGRATION lane skeleton
// Design Docs: docs/design/essay-auto-scoring-backend-design.md (v1.3, § Test
//                Boundaries :2181, § Output Comparison :2236, § Cờ tính năng :2011)
//              docs/design/essay-auto-scoring-frontend-design.md (v1.1, § Test
//                Boundaries :2134)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3)
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-001..AC-072)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted, D1..D6)
// Sinh ngày:   2026-08-29 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// CẢ BA CA ĐÃ ĐƯỢC CHUYỂN ĐỔI. File này không còn là skeleton:
//   INT-1 — Task B1.6 (11 ca thực thi)
//   INT-2 — Task B2.4 (7 ca thực thi)
//   INT-3 — Task B2.4 (5 ca thực thi)
// Kết quả cho làn integration của tính năng này: 3/3. `it.todo` chưa giải quyết: 0.
//
// Đoạn từng nằm ở đây nói "chưa có gì thực thi khẳng định" và
// giải thích vì sao mọi ca đều là `it.todo`. Nó được giữ lại dưới đây trong một dòng thay vì
// xoá, vì LÝ DO vẫn chi phối bất kỳ ai thêm một ca: file này
// được `SOURCE/vitest.config.ts:19` thu thập (`app/**/*.test.{ts,tsx}`), nên một
// file không có task nào được thu thập làm vitest báo "No test suite found in
// file" và thoát mã 1 — CI đỏ do hình dạng của một skeleton chứ không phải do
// lỗi thật. `it.todo` được thu thập, báo là todo, và giữ cổng xanh.
//
// Mỗi lần chuyển đổi đáp xuống TRONG CÙNG COMMIT với code production mà nó phủ
// (Red -> Green trong một task), theo tiền lệ đã ship trong thư mục này
// (`getResult.int.test.ts`, `submitExam.int.test.ts`, `rating.int.test.ts`).
//
// LÀN NÀY CHẠY THẾ NÀO: `npm test` (từ `SOURCE/`). KHÔNG phải `npm run test:integration`
// — cấu hình đó chỉ thu thập `tests/integration/**` và cần một database Supabase dev
// thật. Mọi ca trong file này không dùng DB theo cấu trúc.
//
// -----------------------------------------------------------------------------
// RANH GIỚI MOCK — nêu một lần, áp dụng cho cả ba ca
// -----------------------------------------------------------------------------
// Backend DD § Mock Boundary Decisions (:2183) là thẩm quyền; file này áp dụng
// nguyên văn:
//   MOCK     — client Supabase ở ranh giới `createClient()` (ranh giới được phê duyệt
//             của `getResult.int.test.ts` / `rating.int.test.ts` /
//             `history.int.test.ts`); các thao tác `lib/supabase/service-role.ts`;
//             `after()` (thay bằng lời gọi đồng bộ, vì đối tượng kiểm là
//             CÁI GÌ được đăng ký và KHI NÀO, không phải cách Next lập lịch nó); Redis;
//             `redirect()`.
//   MOCK     — `fetch` tới `api.groq.com`, ở ranh giới fetch và không sâu hơn.
//             VIỆC CHẤM XUẤT XƯỞNG Ở TRẠNG THÁI TẮT sau cổng người duyệt AC-067 (Zero Data
//             Retention trong console Groq) và CHƯA CÓ TÀI KHOẢN GROQ NÀO, nên
//             mọi ca ở đây chạy với KHÔNG lời gọi nhà cung cấp thật nào. INT-1
//             khẳng định số đó bằng không như đối tượng kiểm riêng của nó; INT-2/INT-3 không bao giờ
//             tới đường ghi.
//   THẬT     — `computeScore()`, `lib/scoring/essayLifecycle.ts`
//             (`deriveEssayView`, `summariseEssays`, `isEssayIncomplete`,
//             `hasIncompleteEssay`, `hasUnresolvedEssay`), `lib/scoring/wrongTwice.ts`,
//             từ điển `lib/i18n`. Chúng thuần và CHÍNH LÀ đối tượng kiểm;
//             mock chúng là kiểm việc nối dây thay vì hành vi.
// @real-dependency: không có — không ca nào trong file này chạm Postgres. Ba
//   thuộc tính mà một client mock KHÔNG chứng minh được (thứ tự mảng jsonb,
//   vị từ `<> 'graded'` khớp không hàng nào, các grant thật) nằm NGOÀI làn này
//   theo thiết kế và thuộc làn service —
//   `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts`.
//
// -----------------------------------------------------------------------------
// VÌ SAO BA CÁI NÀY, VÀ CÁI GÌ ĐÃ ĐƯỢC ĐẨY XUỐNG
// -----------------------------------------------------------------------------
// Xếp theo ROI (BV x Freq + Legal x 10 + Defect), top 3 trong 7 ứng viên:
//   INT-1  109  đường nộp bài khi tính năng tắt               <- được chọn
//   INT-2   81  hasIncompleteEssay thống nhất ở cả hai đường đọc <- được chọn
//   INT-3   71  bài tự luận đã chấm không rò vào Layer 3        <- được chọn
//   (I-E)   57  thứ tự điều phối gradeEssays (AC-072)         <- KHÔNG chọn, hết ngân sách
//   (I-D)   49  ma trận từ chối retryEssayGrading (EG-BE-022)  <- KHÔNG chọn, hết ngân sách
//   (I-F/G)  —  biên hạn chót deriveEssayView (EG-BE-023),
//               kiểm tra band/boolean của parseGrade (EG-BE-014/015)
//               <- ĐẨY XUỐNG: hàm thuần không có cộng tác viên; một unit test
//                  chứng minh nhiều hơn hẳn mỗi giây ở đây. Backend DD § Correctness
//                  Proof Method dòng 1 và dòng 3 đã giao chúng cho làn unit.
// I-E và I-D là hai ca mà kỹ sư nên đổi vào trước tiên nếu có ca nào bên dưới
// bị đánh giá là mức unit; chú thích của chúng được giữ trong báo cáo sinh test.
//
// ĐỘ PHỦ SẴN CÓ ĐÃ KIỂM (lượt khử trùng lặp, 2026-08-29) — các test đã ship này
// đã chạm bề mặt của tính năng và KHÔNG được lặp lại ở đây:
//   `lib/scoring/__tests__/computeScore.test.ts`  — nhánh tự luận hiện tại
//     ({ scored:false, isCorrect:false }) và hàm hỗ trợ fixture `essay()`.
//   `lib/scoring/__tests__/wrongTwice.test.ts` Test 2 (:105-140) — việc loại
//     `scored: false`, trên một fixture đã tên là `Q-ESSAY`.
//   `features/exams/components/__tests__/QuestionRenderer.test.tsx` — chuỗi chú thích
//     cuối bài tự luận và vị trí ghép đôi `maxLength`.
//   `features/exams/__tests__/submitExam.int.test.ts` — đường khoá `essay_answer`.
// Khi một ca bên dưới chồng lên một trong số đó, phần chồng được nêu rõ
// ngay tại nghĩa vụ, kèm điều hẹp hơn mà làn này bổ sung.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ESSAY_KEYS, ESSAY_MAX_ATTEMPTS } from "@/lib/scoring/essayLifecycle";

// -----------------------------------------------------------------------------
// Hạ tầng test INT-1 — ranh giới mock khai báo ở đầu file, đã nối dây.
// INT-2 và INT-3 phía dưới có harness RIÊNG (`driveBothReadPaths`),
// do Task B2.4 thêm: chúng điều khiển hai đường ĐỌC, trong khi mọi thứ ở đây điều khiển
// đường GHI. Hai bộ cố ý không chia sẻ gì ngoài các mock module.
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

// actions.ts kéo theo "server-only" — cùng stub với
// getResult.int.test.ts / rating.int.test.ts / submitExam.int.test.ts.
vi.mock("server-only", () => ({}));

// after() là một spy GHI LẠI NHƯNG KHÔNG GỌI theo mặc định. Đối tượng kiểm của
// (c) và (e) là cái gì được đăng ký và khi nào; nghĩa vụ (f) là ca duy nhất
// chọn gọi đồng bộ.
vi.mock("next/server", () => ({ after: afterMock }));

// redirect() được mock, nhưng PHẢI vẫn ném lỗi — xem nextRedirectError bên dưới.
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/service-role", () => ({
  recordExamResult: recordExamResultMock,
  recordSkillMastery: recordSkillMasteryMock,
}));
// Ranh giới Redis: guard() đọc bộ đếm Upstash dùng chung.
vi.mock("@/lib/security/rateLimit", () => ({ guard: guardMock }));
// Bản thân lượt chấm là đối tượng kiểm của Task B1.4 và có làn unit riêng. Ở đây
// nó là một vật thay thế mà việc duy nhất là nhận diện được là "cái đã được
// đăng ký" và, ở (f), là hỏng.
vi.mock("@/lib/essay/gradeEssays", () => ({
  gradeEssaysForAttempt: gradeEssaysForAttemptMock,
}));

const { submitExam } = await import("@/features/exams/actions");

const ATTEMPT_ID = "attempt-int1";
const EXAM_ID = "exam-int1";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const RESULT_URL = `/exams/${EXAM_ID}/attempt/${ATTEMPT_ID}/result`;

/** VÌ SAO redirect() VẪN ném lỗi dù đã được mock.
 *
 *  Một spy redirect no-op sẽ lặng lẽ vô hiệu nghĩa vụ (e). Trong Next,
 *  `redirect()` ném một exception luồng điều khiển NEXT_REDIRECT, nên mọi câu lệnh
 *  sau nó đều không tới được — chính vì vậy đăng ký lượt chấm
 *  sau redirect nghĩa là không bao giờ đăng ký nó. Mock thành no-op và
 *  thứ tự hỏng vẫn chạy tới cuối hàm, `after()` vẫn
 *  được gọi, và ca sinh ra để bắt lỗi đó vẫn qua. Nên
 *  spy tái hiện việc ném, với dạng digest mà `submitExam.int.test.ts`
 *  đã nhận ra. */
function nextRedirectError(url: string): Error {
  const err = new Error("NEXT_REDIRECT");
  (err as Error & { digest: string }).digest = `NEXT_REDIRECT;push;${url};307;`;
  return err;
}

/** Nuốt đúng NEXT_REDIRECT mong đợi và ném lại mọi thứ khác,
 *  theo hàm trợ giúp cùng dạng của `submitExam.int.test.ts`. */
async function callSubmitExam(answers: Record<string, string>) {
  try {
    await submitExam(ATTEMPT_ID, answers);
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) throw err;
  }
}

// các hàng questions ở dạng DB (snake_case), như claim_attempt_answer_key() trả
// chúng. Hai MCQ chấm điểm cộng một bài tự luận CÓ đáp án tham khảo — bài tự luận cần
// sự thật nền, nếu không nhánh khoá-vòng-đời không bao giờ chạy và mọi ca bật cờ
// bên dưới sẽ qua rỗng.
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

/** TỰ SOẠN ĐỘC LẬP — tính tay từ QUESTION_ROWS và ANSWERS ở trên,
 *  không bao giờ chụp từ đầu ra của computeScore(). q1 đúng, q2 sai, nên 1 trong
 *  2 câu chấm điểm đúng => 5 trên thang 10; bài tự luận nằm ngoài mẫu số VÀ ngoài
 *  phân tích theo chủ đề, đó là lý do "Văn
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

/** Tập khoá đầy đủ của phần tử tự luận khi cờ TẮT. `toEqual`
 *  ở trên không tự gánh nổi nghĩa vụ này: nó coi khoá có mặt với giá trị
 *  `undefined` là vắng mặt, và `undefined` so với thiếu chính là
 *  sự phân biệt còn sống sót vào jsonb. */
const EXPECTED_ESSAY_KEYS_OFF = ["isCorrect", "questionId", "scored", "selected"];

/** Cùng phần tử khi cờ BẬT: bốn khoá đó cộng năm khoá mà
 *  `newEssayEntry()` phát ra. `essayGradedAt` cố ý KHÔNG có ở đây — chỉ
 *  `record_essay_grade()` mới ghi nó. */
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

/** Sáu literal khoá jsonb, gõ TAY thay vì import, vì
 *  nghĩa vụ là "không chuỗi nào trong số này xuất hiện". Đối chiếu chéo với
 *  ESSAY_KEYS ở ca riêng của nó bên dưới, nên danh sách không thể mục nát lặng lẽ —
 *  và các khẳng định tập-khoá không thể rỗng nghĩa nếu ESSAY_KEYS bị làm rỗng. */
const SIX_ESSAY_KEY_LITERALS = [
  "essayAttempts",
  "essayEarned",
  "essayGradedAt",
  "essayLowConfidence",
  "essayMax",
  "essayState",
];

/** Nối client mock cho toàn bộ đường thành công của submitExam(): exam_attempts
 *  (select) -> exams (select) -> claim_attempt_answer_key (rpc) ->
 *  attempt_answers (upsert). exam_results cố ý vắng mặt — chạm tới nó
 *  qua client của chính học sinh là lỗi 42501 trên production, nên nó phải ném lỗi
 *  ở đây thay vì gặp một mock thân thiện (nghĩa vụ f của submitExam.int.test.ts). */
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

/** Ranh giới fetch có đếm của nghĩa vụ (b).
 *
 *  Nó trả về một phản hồi vô hại thay vì ném lỗi, có chủ đích. Một stub ném lỗi
 *  sẽ huỷ submitExam() tại lời gọi lạc và làm hỏng mọi ca trong
 *  file bằng lỗi truyền tải, nên SỐ ĐẾM — thứ nghĩa vụ (b) thực sự
 *  nói tới — không bao giờ là khẳng định bị kích hoạt. Trả về một phản hồi
 *  hợp lý cho lượt chạy tiếp tục và để `toHaveBeenCalledTimes(0)`
 *  là yếu tố phân biệt, thứ biến (b) thành một phép đo chứ không phải tác dụng phụ
 *  của một lỗi khác. */
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

/** process.env được khôi phục bằng tay chứ không qua vi.stubEnv, vì
 *  cách viết đầu tiên của nghĩa vụ (d) là biến VẮNG MẶT — một trạng thái
 *  stubEnv chỉ diễn đạt gián tiếp. */
const ORIGINAL_FLAG = process.env.ESSAY_GRADING_ENABLED;

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.ESSAY_GRADING_ENABLED;
  else process.env.ESSAY_GRADING_ENABLED = value;
}

/** Đối tượng điểm được trao cho lời gọi recordExamResult() duy nhất. */
function persistedScore() {
  expect(recordExamResultMock).toHaveBeenCalledTimes(1);
  return recordExamResultMock.mock.calls[0][1];
}

/** Các nghĩa vụ (a), (b) và (c) cùng nhau. Chúng được khẳng định qua một hàm trợ giúp
 * vì (d) phải lặp cả ba cho từng cách viết env, và bốn bản sao trôi lệch của chúng
 * còn tệ hơn một hàm dùng chung. */
function expectShippedState() {
  // (a) — payload tới được lượt ghi, không chỉ cái computeScore đã trả về
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
// INT-1 — Tắt tính năng là trạng thái ĐÃ SHIP: không khoá, không after(), không Groq
// =============================================================================
// AC: EG-BE-002 — "Khi computeScore() chạy với options.essayGrading === false
//   (mặc định), hệ thống phải phát phần tử per_question cho một câu tự luận
//   TỪNG BYTE như hôm nay: { questionId, selected, isCorrect: false,
//   scored: false } và KHÔNG MỘT khoá essay* nào."
// AC: EG-BE-032 — "submitExam() phải phát 0 request tới nhà cung cấp một cách đồng bộ, và
//   việc đăng ký lượt chấm phải nằm TRƯỚC lời gọi redirect()."
// AC: EG-BE-033 — "Mọi lỗi của lượt chấm không được đổi kết quả quan sát được của submitExam():
//   hàng exam_results vẫn được ghi, record_skill_mastery() vẫn
//   được gọi, và redirect vẫn xảy ra."
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

    // Điều này bổ sung gì so với computeScore.test.ts: hình dạng đó SỐNG SÓT qua
    // nơi gọi. Test thuần chứng minh hàm trả nó; chỉ làn này thấy được
    // submitExam luồn tuỳ chọn qua và lưu đúng object đó.
    expect(persistedScore()).toEqual(EXPECTED_SCORE_FLAG_OFF);

    const essayEl = persistedScore().perQuestion[2];
    // Tập khoá, KHÔNG phải `essayState === undefined`: khoá có mặt với giá trị undefined
    // qua kiểm giá trị mà vẫn serialise vào jsonb thành `"essayState": null`.
    expect(Object.keys(essayEl).sort()).toEqual(EXPECTED_ESSAY_KEYS_OFF);
    for (const key of SIX_ESSAY_KEY_LITERALS) {
      expect(Object.hasOwn(essayEl, key)).toBe(false);
    }

    // Lượt ghi đi qua đường service-role, một lần, cho lượt làm này.
    expect(recordExamResultMock.mock.calls[0][0]).toBe(ATTEMPT_ID);
  });

  it("the six hand-written key literals still match ESSAY_KEYS, so the negative assertions above cannot go stale or vacuous", () => {
    // Thiếu cái này, nghĩa vụ (a) có hai kiểu hỏng thầm lặng: khoá bị đổi tên
    // (danh sách viết tay vẫn kiểm một chuỗi mà không còn gì phát ra) và
    // ESSAY_KEYS bị làm rỗng (không có gì để rò, nên không có gì để bắt).
    expect([...Object.values(ESSAY_KEYS)].sort()).toEqual(SIX_ESSAY_KEY_LITERALS);
    expect(SIX_ESSAY_KEY_LITERALS).toHaveLength(6);
  });

  it("obligation (b): zero provider calls, measured — global fetch is called exactly 0 times and no api.groq.com request is constructed", async () => {
    setFlag(undefined);

    await callSubmitExam(ANSWERS);

    // Đo thật, không giả định. Một request đã dựng rồi bị huỷ vẫn là
    // một request và vẫn là bài viết của học sinh rời khỏi tiến trình, nên số đếm là
    // khẳng định — chứ không phải "không dùng response nào".
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(fetchMock.mock.calls).toEqual([]);
  });

  it("obligation (c): with the flag absent, after() records zero registrations", async () => {
    setFlag(undefined);

    await callSubmitExam(ANSWERS);

    // Một lượt chấm được đăng ký khi tính năng tắt không làm gì nhìn thấy được — nó chỉ
    // giữ lời gọi sống lâu hơn response, biểu hiện thành chi phí và
    // độ trễ, không bao giờ thành lỗi.
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
    // Thiếu ca này, mọi cách viết ở trên đều qua với một cài đặt mà lượt đọc cờ
    // không bao giờ chạy — cả nhóm sẽ chẳng chứng minh gì.
    setFlag("  true  ");

    await callSubmitExam(ANSWERS);

    const essayEl = persistedScore().perQuestion[2];
    expect(Object.keys(essayEl).sort()).toEqual(EXPECTED_ESSAY_KEYS_ON);
    expect(essayEl.essayState).toBe("pending");
    expect(afterMock).toHaveBeenCalledTimes(1);

    // PHẠM VI ĐÃ ĐỔI BỞI B3 (2026-09-01). Khối này từng khẳng định điểm số
    // giống hệt từng byte khi cờ BẬT và TẮT, theo cách đọc ban đầu của EG-BE-004 rằng
    // "phát khoá vòng đời và chấm điểm là độc lập".
    //
    // B3 cố ý phá MỘT NỬA của điều đó, và nửa bị phá chính là lỗi:
    // một bài tự luận mà ai đó sắp chấm giờ chiếm phần điểm của nó trong
    // đề kể từ lúc nộp. Hai câu tự chấm (1 đúng) cộng một bài tự luận 1 điểm, chưa
    // chấm, là 1/3 đề — 3,33, không phải 5,0. Để nó ở 5,0 chính là cách một
    // bài Ngữ văn hiện 10,0/10 trên một đề đáng 4,75/10.
    //
    //Nửa vẫn PHẢI giữ là bộ ba SỐ ĐẾM: `correct`/`total` chỉ tiếp tục
    // đếm câu tự chấm, nên `wrong = total − correct` trên ScoreCard vẫn
    // suy ra được (AC-057) và mastery không bao giờ được nuôi bởi bài tự luận.
    expect(persistedScore().totalScore).toBe(3.33);
    expect(persistedScore().correct).toBe(EXPECTED_SCORE_FLAG_OFF.correct);
    expect(persistedScore().total).toBe(EXPECTED_SCORE_FLAG_OFF.total);
    expect(persistedScore().topicBreakdown).toEqual(EXPECTED_SCORE_FLAG_OFF.topicBreakdown);

    // …và bài tự luận nằm trong MẪU SỐ với tử số bằng không, đúng dạng
    // mà `record_essay_grade()` về sau cộng band vào.
    expect(essayEl.maxPoints).toBe(1);
    expect(essayEl.earnedPoints).toBe(0);

    // Đăng ký với đúng tập đích: chỉ bài tự luận CÓ đáp án tham khảo,
    // mang chữ của học sinh và lượt làm mà nó thuộc về. Một lượt chấm
    // đăng ký trên các MCQ sẽ đốt ngân sách nhà cung cấp cho những câu mà
    // khoá vòng đời chưa bao giờ được phát.
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

    // `mock.invocationCallOrder` chứ không phải "cả hai đều được gọi": cả hai ĐỀU được gọi
    // trong thứ tự hỏng nữa, dưới một redirect không ném lỗi. So số thứ tự,
    // là thứ quan sát duy nhất phân biệt được chúng.
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

    // Next sở hữu việc xử lý lỗi của callback; mock này đại diện cho cả hai
    // nửa đó — nó gọi đồng bộ (để rejection thật sự xảy ra
    // bên trong frame của submitExam) và hấp thụ rejection theo cách runtime
    // sẽ làm, thay vì để một sản phẩm phụ của test thành unhandled rejection.
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
    // Để rejection bị nuốt lắng xuống trước khi khẳng định về nó.
    await Promise.resolve();

    expect(passRejected).toBe(true);
    // Đường ghi điểm là xương sống (ADR-0011); mọi thứ gắn vào nó
    // được phép hỏng. Một sự cố nhà cung cấp không được làm học sinh mất lượt làm.
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
//   SOURCE/features/history/queries.ts (listMyHistory) + real
//   SOURCE/lib/scoring/essayLifecycle.ts + mocked Supabase client on both paths
// @complexity: medium
// @real-dependency: none — the sanctioned mock boundary of getResult.int.test.ts
//   and history.int.test.ts. What this case proves is AGREEMENT BETWEEN TWO
//   TypeScript derivations plus the query SHAPE; it deliberately does not claim to
//   prove Postgres semantics.
// Primary failure mode: one read path is extended and the other is not — most
//   likely `listMyHistory()`'s select gains `per_question` but not `created_at`
//   (backend DD § Implementation Path Mapping, `features/history/queries.ts:64-66`), so its
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
// Harness INT-2 / INT-3 — hai đường ĐỌC, chạy cho một lượt làm fixture.
//
// Cả `getResult()` và `listMyHistory()` đều dựng client riêng qua cùng
// `createClient()` mock, nên hai hàm được chạy lần lượt với mock
// trỏ lại giữa chúng. Đó là điều cho phép một fixture tới được cả hai cửa, chính
// là toàn bộ đối tượng kiểm của INT-2.
// -----------------------------------------------------------------------------

const { getResult } = await import("@/features/exams/queries");
const { listMyHistory } = await import("@/features/history/queries");

/** Đóng băng. Hạn chót là 600 000 ms với biên loại trừ, nên đồng hồ thật
 *  sẽ biến mọi fixture vòng đời bên dưới thành quả bom hẹn giờ. */
const READ_NOW = new Date("2026-08-29T12:00:00.000Z");
/** Một phút tuổi — thoải mái trong hạn chót, nên phần tử `pending` vẫn là
 *  `pending` và các ca bên dưới nói về trạng thái ĐÃ LƯU, không phải thời gian. */
const READ_CREATED_AT = "2026-08-29T11:59:00.000Z";

const READ_ATTEMPT_ID = "attempt-read";
const READ_EXAM = { id: "exam-read", title: "Đề Văn cuối kỳ", subject: "Ngữ văn" };
const READ_STARTED_AT = "2026-08-29T11:00:00.000Z";
const READ_SUBMITTED_AT = "2026-08-29T11:58:00.000Z";

/** Một phần tử tự luận đã lưu. Mặc định là RS-2 (`pending`, chưa tốn lượt nào). */
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

/** Một phần tử MCQ đã lưu, đúng dạng mà `computeScore()` phát ra hôm nay. */
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
