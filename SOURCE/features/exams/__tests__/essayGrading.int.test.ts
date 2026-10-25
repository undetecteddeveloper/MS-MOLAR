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
//   BV 10 — đây là trạng thái mà tính năng XUẤT XƯỞNG. AC-067 là cổng người duyệt (Groq
//     Zero Data Retention, chưa xác minh, chưa có tài khoản), và người dùng là
//     trẻ vị thành niên; "cờ vắng mặt => không request nào" chính là lời hứa về quyền riêng tư.
//   Freq 10 — mọi lượt nộp bài trên production đều chạy đường này.
//   Legal false — coi là chính sách sản phẩm/quyền riêng tư chứ không phải
//     yêu cầu luật định, cố ý thận trọng; lưu ý R-12 đánh giá tác động là "Cao".
//   Defect 9 — lỗi thầm lặng ở cả hai hướng: mặc định nhầm là
//     `true` làm rò bài viết học sinh cho bên thứ ba không có bảo đảm ZDR, và
//     một khoá thừa nhầm làm đổi thứ mọi bề mặt phía sau render.
// Hành vi: submitExam(attemptId, answers) được gọi với ESSAY_GRADING_ENABLED
//   không đặt -> computeScore chạy với cờ được truyền như một TUỲ CHỌN (không bao giờ
//   đọc từ process.env bên trong hàm thuần, AC-013) -> ScoreResult được lưu
//   giống từng byte với hôm nay và không có callback after() nào được đăng ký ->
//   redirect vẫn xảy ra.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/actions.ts (submitExam) + computeScore() thật
//   + client Supabase mock + thao tác service-role mock + after() mock +
//   redirect() mock + fetch toàn cục mock
// @complexity: medium
// @real-dependency: không có
// Kiểu hỏng chính: lượt đọc cờ mặc định là BẬT khi biến env vắng mặt
//   (ví dụ `process.env.ESSAY_GRADING_ENABLED !== "false"` thay vì
//   `=== "true"`), nên một bản build ship trước cổng AC-067 phát khoá tự luận
//   và đăng ký một lượt chấm gửi bài viết thật của học sinh tới Groq. Kiểu
//   thứ hai, kín đáo hơn: cờ được tôn trọng nhưng `after()` được đăng ký SAU
//   `redirect()` (`actions.ts:192`), mà trong Next nghĩa là không bao giờ được đăng ký
//   — việc chấm lặng lẽ không bao giờ chạy khi cờ ĐƯỢC bật, và không gì ở
//   trạng thái cờ tắt có thể để lộ điều đó.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) CỜ VẮNG MẶT, phủ định vét cạn: khi `ESSAY_GRADING_ENABLED` bị xoá khỏi
//       môi trường, payload per_question trao cho `recordExamResult` mock toEqual một
//       literal TỰ SOẠN ĐỘC LẬP (không phải "whatever computeScore trả về"), và Object.keys của
//       mọi phần tử tự luận KHÔNG chứa essayState / essayEarned / essayMax /
//       essayLowConfidence / essayAttempts / essayGradedAt. Khẳng định trên TẬP khoá,
//       không phải `essayState === undefined` — khoá có mặt với giá trị undefined
//       serialise khác vào jsonb.
//       Ghi chú chồng lấn: `computeScore.test.ts` sở hữu nửa THUẦN của việc này (hình dạng
//       computeScore trả về). Làn này bổ sung rằng hình dạng đó SỐNG SÓT qua
//       nơi gọi — rằng `submitExam` truyền tuỳ chọn qua và lưu đúng
//       payload đó — điều mà test hàm thuần không nhìn thấy.
//   (b) Không lời gọi nhà cung cấp nào, đo chứ không giả định: fetch toàn cục là mock có đếm;
//       số đếm đúng bằng 0. Không request `api.groq.com` nào được dựng, kể cả để
//       bị huỷ.
//   (c) Không lượt chấm nào được đăng ký: mock `after()` ghi 0 lần đăng ký.
//   (d) Cùng ba cách viết env đều nghĩa là TẮT (fail-closed, backend DD :2015):
//       vắng mặt, "", "TRUE" (sai hoa thường), "1". Mỗi cách cho (a)+(b)+(c). "true"
//       có khoảng trắng bao quanh nghĩa là BẬT (giá trị được trim) — đưa vào
//       làm đối chứng dương DUY NHẤT để ca này không qua được nhờ lượt đọc cờ
//       là mã chết.
//   (e) Thứ tự, cờ BẬT: với đối chứng "true" đã trim, mock `after()` được
//       gọi TRƯỚC mock `redirect()`. Khẳng định bằng so sánh thứ tự gọi
//       của hai spy (`mock.invocationCallOrder`), không phải khẳng định cả hai đều
//       được gọi — "cả hai đều được gọi" cũng đúng trong thứ tự hỏng.
//   (f) Lỗi lượt chấm được khoanh vùng: với cờ BẬT và callback đã đăng ký
//       bị ép reject khi gọi đồng bộ, `recordExamResult` và
//       `recordSkillMastery` vẫn đều được gọi và redirect vẫn xảy ra.
//       Đây là EG-BE-033, và là thứ giữ cho sự cố nhà cung cấp không
//       thành mất bài nộp.
//   Ranh giới có thể mock và vì sao: client Supabase / service-role / after / redirect /
//   fetch đều là I/O bên ngoài hoặc của bộ lập lịch. `computeScore()` chạy THẬT — nó là
//   đối tượng kiểm của (a), và backend DD nêu rõ là "Không — chạy thật".
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
// INT-2 — Hai lối ra PDF không thể bất đồng: hasIncompleteEssay giống hệt trên
//         getResult() và listMyHistory() cho cùng một lượt làm
// =============================================================================
// AC: EG-BE-035 — "Khi một lượt làm có ít nhất một câu tự luận ở RS-6,
//   hasIncompleteEssay phải là true trên CẢ ExamResult và MyHistoryEntry cho
//   cùng attemptId; và khi không câu nào ở RS-6 thì phải là false trên cả hai —
//   kể cả với lượt làm không có câu tự luận nào và với hàng ghi trước khi
//   tính năng ship (KHÔNG BAO GIỜ undefined)."
// AC: EG-BE-034 — "Với cùng mảng per_question và cùng created_at,
//   hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0."
// AC: EG-BE-031 — "Khi getResult() đọc một hàng exam_results ghi trước khi
//   tính năng ship, đầu ra phải giống hệt hôm nay và essaySummary phải là
//   undefined."
// Cũng hoàn thành: PRD AC-012, AC-058 (nửa dữ liệu), O-8; frontend DD MSA-F5,
//   CR-4, tiền điều kiện FE-AC-14; UI Spec UI-D11.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
//   BV 9 — PDF là hiện vật vĩnh viễn mà học sinh chia sẻ; hai lối ra cho hai
//     file khác nhau của cùng một lượt làm là lỗi mà O-8 sinh ra để ngăn.
//   Freq 8 — mọi lần render /history và /result đều tính cả hai trường.
//   Defect 9 — hai nơi gọi suy ra "cùng một sự thật" bằng hai đường là
//     dạng mà F-06 đã bắt một lần trong lịch sử review của chính tính năng này.
// Hành vi: CÙNG fixture per_question và CÙNG created_at được đưa vào
//   getResult() và listMyHistory() qua các client Supabase (mock riêng) của chúng
//   -> các vị từ essayLifecycle thật chạy trên cả hai đường -> hai boolean
//   được so với nhau và so với các literal tự soạn độc lập.
// @category: integration
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (getResult) +
//   SOURCE/features/history/queries.ts (listMyHistory) + SOURCE/lib/scoring/essayLifecycle.ts
//   thật + client Supabase mock trên cả hai đường
// @complexity: medium
// @real-dependency: không có — ranh giới mock được phê duyệt của getResult.int.test.ts
//   và history.int.test.ts. Ca này chứng minh SỰ THỐNG NHẤT GIỮA HAI
//   PHÉP SUY RA bằng TypeScript cộng HÌNH DẠNG truy vấn; nó cố ý không tuyên bố
//   chứng minh ngữ nghĩa Postgres.
// Kiểu hỏng chính: một đường đọc được mở rộng còn đường kia thì không — nhiều khả năng nhất
//   là select của `listMyHistory()` có thêm `per_question` nhưng không có `created_at`
//   (backend DD § Implementation Path Mapping, `features/history/queries.ts:64-66`), nên
//   phép suy ra hạn chót của nó chạy trên timestamp thiếu/`undefined` và một câu
//   pending quá hạn bị phân loại là còn pending ở đó trong khi /result
//   phân loại là RS-6. Học sinh khi đó nhận PDF có dòng bài tự luận chưa hoàn tất
//   từ một nút và không có từ nút kia, cho cùng một lượt làm.
//   Kiểu thứ hai: một trong hai trường bị để `undefined` cho hàng cũ thay vì
//   `false`, mà `undefined` là falsy — nên lỗi hôm nay vẫn render đúng và
//   lộ ra lần đầu tiên có thứ gì đó so sánh nghiêm ngặt.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) THỐNG NHẤT, trọng tâm của ca: với MỘT id lượt làm fixture, chạy cả hai hàm và khẳng định
//       `examResult.hasIncompleteEssay === historyEntry.hasIncompleteEssay`
//       VÀ giá trị chung bằng một literal `true` tự soạn độc lập.
//       Chỉ khẳng định bằng nhau là chưa đủ — hai đường cùng sai theo
//       một hướng thì bằng nhau.
//   (b) Fixture phải có đúng một phần tử RS-6: essayState "failed"
//       với essayAttempts === ESSAY_MAX_ATTEMPTS (3), tức retryAvailable false.
//       RS-4 (failed, attempts < 3) KHÔNG được đặt hasIncompleteEssay — đưa nó vào
//       làm phần tử thứ hai trong cùng fixture để ca phân biệt được
//       "mọi lỗi" với "lỗi không khôi phục được".
//   (c) PHỦ ĐỊNH, ba hình dạng, đều cho `false` trên CẢ HAI đường và đều
//       `typeof === "boolean"` (không bao giờ undefined): lượt làm mà mọi bài tự luận
//       đã chấm; lượt làm không có câu tự luận nào; một hàng cũ không mang
//       khoá essay* nào cả.
//   (d) Đẳng thức EG-BE-034, chạy trên CÙNG fixture trong cùng ca:
//       `hasUnresolvedEssay(pq, createdAt, now) === ((summariseEssays(pq, createdAt, now)?.unresolvedCount ?? 0) > 0)`
//       cho từng fixture ở (b) và (c). Đây là chốt chặn ngăn
//       hai phép suy ra của một sự thật trôi lệch khỏi nhau.
//   (e) Hình dạng truy vấn, cả hai đường: select của getResult() có `created_at`
//       (backend DD :579-581) và select nhúng của listMyHistory() có CẢ `per_question`
//       và `created_at` (:64-66). Thiếu một cột ở đây chính là cơ chế
//       của kiểu hỏng chính và không khẳng định nào trên đầu ra đã ánh xạ thấy được.
//   (f) So sánh đầu ra hàng cũ (EG-BE-031 / backend DD đường ống 2 và 3):
//       với fixture hàng cũ, toàn bộ ExamResult toEqual một literal dựng tay của
//       hình dạng trước khi đổi, với `essaySummary === undefined` và mọi
//       `PerQuestionResult.essay === undefined`; và toàn bộ MyHistoryEntry[]
//       toEqual một literal mang cả chín trường sẵn có cộng hai boolean mới
//       là `false`, theo thứ tự submittedAt giảm dần không đổi.
//   Kiểm soát thời gian: `now` phải được tiêm/đóng băng, không bao giờ `Date.now()` — phép
//   suy ra hạn chót (ESSAY_PENDING_DEADLINE_MS = 600_000) phụ thuộc thời gian và một
//   đồng hồ thật biến ca này thành quả bom hẹn giờ thay vì một test.

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
  /** Ba cột điểm đã lưu. `getResult()` đọc chúng thẳng từ
   *  hàng — nó KHÔNG tính lại — nên fixture nêu chúng tường minh. */
  triple?: { totalScore: number; correct: number; total: number };
  /** Các lượt làm thêm cho lượt đọc lịch sử wrong-twice xuyên lượt làm. */
  historyRows?: unknown[];
  createdAt?: string;
}

/** Nối client mock cho `getResult()`: lượt đọc có join, lượt đọc wrong-twice
 *  xuyên lượt làm (thenable — nó await thẳng builder), và RPC khoá đáp án.
 *  Ghi lại mọi chuỗi select để INT-2(e) khẳng định trên HÌNH DẠNG truy vấn. */
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
      // Lượt đọc lịch sử wrong-twice tự await builder. Thiếu điều này thì nó
      //  resolve ra chính object builder, rơi về [], và INT-3(c) sẽ qua
      //  cho một tính năng chết vĩnh viễn.
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

/** Nối client mock cho `listMyHistory()` — một lượt đọc có giới hạn, thenable. */
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

/** MỘT fixture, CẢ HAI cửa. Trả về đầu ra của mỗi đường và các chuỗi select nó
 *  đã phát ra, để một ca khẳng định được về thống nhất, về giá trị và về hình dạng truy vấn. */
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

  // Fixture mà (b) xây quanh: MỘT bài tự luận không khôi phục được và MỘT bài
  // vẫn thử lại được. Chính cặp đó phân biệt "mọi lỗi" với
  // "lỗi không khôi phục được" — một cài đặt coi mọi `failed` là chưa hoàn tất
  // sẽ qua một fixture chỉ có cái đầu.
  const RS6_AND_RS4: unknown[] = [
    essayEl({ questionId: "q-rs6", essayState: "failed", essayAttempts: ESSAY_MAX_ATTEMPTS }),
    essayEl({ questionId: "q-rs4", essayState: "failed", essayAttempts: 1 }),
  ];

  it("(a)+(b): one attempt, both doors — hasIncompleteEssay agrees AND equals an independently authored true; an RS-4 sibling does not cause it", async () => {
    const { examResult, historyEntry } = await driveBothReadPaths({ perQuestion: RS6_AND_RS4 });

    // Thống nhất là điều kiện cần nhưng KHÔNG đủ: hai đường cùng sai theo
    // một hướng thì bằng nhau. Nên giá trị chung cũng được đối chiếu với một literal
    // soạn tay từ fixture.
    expect(examResult.hasIncompleteEssay).toBe(historyEntry.hasIncompleteEssay);
    expect(examResult.hasIncompleteEssay).toBe(true);

    // …và phần tử RS-4 thật sự có mặt và thật sự thử lại được, nên cái
    // `true` ở trên quy được cho riêng q-rs6.
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
    // Chỉ RS-4. Nếu cái này trả true, học sinh sẽ nhận chú thích PDF
    // "chấm chưa hoàn tất" vĩnh viễn trong khi vẫn còn thể thử lại.
    const { examResult, historyEntry } = await driveBothReadPaths({
      perQuestion: [essayEl({ questionId: "q-rs4", essayState: "failed", essayAttempts: 1 })],
    });

    expect(examResult.hasIncompleteEssay).toBe(false);
    expect(historyEntry.hasIncompleteEssay).toBe(false);
    // Vẫn CHƯA GIẢI QUYẾT — hai vị từ loại trừ nhau về cấu trúc,
    // và hàng này là bằng chứng rằng một boolean không thể mang cả hai đáp án.
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

      // `typeof`, không chỉ giá trị: `undefined` là falsy, nên phiên bản sai
      // hôm nay vẫn render đúng và chỉ lộ ra khi đường ống PDF phải
      // quyết định một chú thích từ nó.
      expect(typeof examResult.hasIncompleteEssay).toBe("boolean");
      expect(typeof historyEntry.hasIncompleteEssay).toBe("boolean");
      expect(typeof historyEntry.hasUnresolvedEssay).toBe("boolean");
      expect(examResult.hasIncompleteEssay).toBe(false);
      expect(historyEntry.hasIncompleteEssay).toBe(false);
    },
  );

  it("(d) EG-BE-034: history's hasUnresolvedEssay equals (result's essaySummary.unresolvedCount ?? 0) > 0, across every fixture", async () => {
    // Cố ý so sánh GIỮA hai đường thay vì tính lại vế phải ở cục bộ.
    // Hai phép suy ra của một sự thật trôi lệch khỏi nhau là lỗi F-06, và một
    // đối chứng tính lại cục bộ sẽ không thấy nó.
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
    // Đối chứng dương VÀ âm: thiếu cả hai, đẳng thức ở trên vẫn đúng
    // với một cài đặt lúc nào cũng trả lời cùng một thứ.
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

    // Vì sao khẳng định trên CHUỖI SELECT chứ không phải đầu ra đã ánh xạ: khi
    // `created_at` thiếu ở một đường, cả hai boolean vẫn tính ra — chỉ là
    // tính trên `undefined`. Một câu pending quá hạn khi đó "vẫn pending" ở đường đó
    // trong khi đường kia gọi nó là RS-6, và học sinh nhận PDF CÓ dòng bài tự luận
    // chưa hoàn tất từ một nút và KHÔNG CÓ từ nút kia, cho cùng một lượt làm.
    // Không khẳng định nào trên đầu ra đã ánh xạ thấy được điều đó.
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
    // `toEqual` coi khoá chứa `undefined` là vắng mặt, nên trường
    // phải là undefined được khẳng định riêng.
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
// INT-3 — Một bài tự luận đã chấm vẫn là scored:false / isCorrect:false, nên Layer 3 và
//         bộ ba điểm không bao giờ dịch chuyển vì nó
// =============================================================================
// AC: EG-BE-004 — "Ở MỌI trạng thái vòng đời (pending, graded, failed) phần tử
//   đã lưu phải giữ scored: false và isCorrect: false. Một phần tử đã chấm
//   mang scored: true, isCorrect: true, hoặc THIẾU khoá scored, là hỏng tiêu chí này."
// Cũng hoàn thành: PRD AC-009 (exam_results.correct không bao giờ dịch chuyển vì một
//   bài tự luận), AC-014, AC-016 (wrongTwice), AC-017 (bộ lọc record_skill_mastery),
//   AC-011/AC-015 số học phía đọc (EG-BE-027); ADR-0018 F1.
// ROI: 71 (BV:9 x Freq:7 + Legal:0 + Defect:8)
//   BV 9 — F1 là sự thật duy nhất cho phép tính năng này ship mà không sửa
//     `schema.sql:1354` hay `wrongTwice.ts:45`. Nếu nó hỏng, câu tự luận bắt đầu
//     nuôi mô hình mastery và tập wrong-twice, đổi thứ mà Layer 3
//     đề xuất cho học sinh — một câu trả lời cho một câu hỏi hoàn toàn khác.
//   Freq 7 — mọi lần render kết quả của mọi lượt làm có một bài tự luận đã chấm.
//   Defect 8 — bản năng tự nhiên khi một band hạ cánh là đặt scored:true, và
//     không gì ở thay đổi đó trông sai tại chỗ nó được viết.
// Hành vi: một fixture per_question chứa phần tử tự luận ĐÃ CHẤM (essayState
//   "graded", essayEarned 0.75, essayMax 1, scored false, isCorrect false) được đọc
//   qua getResult() ở ranh giới Supabase mock -> essayLifecycle thật
//   tóm tắt nó -> bộ ba điểm cũ không bị đụng, phần tử vẫn
//   báo scored:false, và phép suy ra wrongTwice thật bỏ qua nó.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (getResult) + SOURCE/lib/scoring/essayLifecycle.ts
//   thật + SOURCE/lib/scoring/wrongTwice.ts thật +
//   client Supabase mock
// @complexity: medium
// @real-dependency: không có TRONG LÀN NÀY — nhưng lưu ý sự phân chia, vì ca này
//   chỉ chứng minh nửa TypeScript. Việc loại trừ riêng của `record_skill_mastery()`
//   (`coalesce((pq->>'scored')::boolean, true)`, schema.sql:1354) là một vị từ Postgres;
//   nó được khẳng định trên database thật bởi `recordSkillMastery.int.test.ts` sẵn có
//   và bởi làn service, KHÔNG phải ở đây. Nói rõ ở ranh giới
//   chính là mục đích: mock không chứng minh được một bộ lọc SQL.
// Kiểu hỏng chính: `record_essay_grade()` hoặc một lần refactor về sau đặt
//   `scored: true` lên phần tử khi band hạ cánh ("giờ nó ĐÃ được chấm"),
//   khi đó `record_skill_mastery()` thôi loại hàng và bài tự luận bắt đầu
//   đóng góp vào mastery kỹ năng; và `computeWrongTwiceQuestionIds()`
//   (`wrongTwice.ts:45` chỉ bỏ qua khi `row.scored === false`) bắt đầu trả về
//   essay question ids, so the tutor surfaces essay questions as "sai hai lần".
//   Kiểu kề cận: band của bài tự luận rò vào `result.correct` / `result.total`
//   trên đường đọc, lặng lẽ định nghĩa lại ý nghĩa của phép suy ra
//   `wrong = total - correct` của `ScoreCard`.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) Phần tử đã chấm do getResult() trả về có `scored === false` và
//       `isCorrect === false`, và khoá `scored` CÓ MẶT (khẳng định
//       `"scored" in element`, không chỉ giá trị — khoá thiếu sẽ dính mặc định
//       `coalesce(..., true)` trong SQL và đảo bộ lọc).
//   (b) Bộ ba điểm không bị đụng: `result.totalScore`, `result.correct` và
//       `result.total` toEqual các literal tự soạn độc lập, tính chỉ từ các
//       câu KHÔNG phải tự luận. Dùng fixture mà việc tính cả bài tự luận sẽ làm thay đổi
//       thấy được cả ba (ví dụ 4 MCQ, 3 đúng, cộng một bài tự luận
//       đã chấm ở band 0.75) — với fixture mà các con số trùng nhau, khẳng định này
//       chẳng chứng minh gì.
//   (c) `computeWrongTwiceQuestionIds()` thật trên các hàng chứa bài tự luận đã chấm này
//       HAI LẦN (hai lượt làm, cả hai "sai") trả về một mảng KHÔNG
//       chứa questionId của bài tự luận, trong khi vẫn chứa id của một MCQ thật sự
//       sai hai lần trong cùng fixture — đối chứng dương ngăn (c)
//       qua chỉ vì hàm không trả về gì cả.
//       KHỬ TRÙNG LẶP, đọc trước khi viết nghĩa vụ này: việc loại trừ `scored: false`
//       thuần ĐÃ được phủ ở mức unit bởi
//       `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` Test 2 (:105-140), mà
//       fixture đã tên là `Q-ESSAY`. Đừng lặp lại. Điều MỚI ở đây —
//       và là thứ duy nhất biện minh cho (c) trong làn này — là phần tử giờ
//       CŨNG mang sáu khoá mới (essayState/essayEarned/essayMax/
//       essayLowConfidence/essayAttempts/essayGradedAt) và đến qua đường đọc
//       thật thay vì một fixture unit dựng tay: nghĩa vụ là việc có mặt của các khoá đó
//       không đảo vị từ. Nếu bỏ cách đặt vấn đề này, (c) là phủ trùng lặp và nên bị xoá thay vì
//       viết.
//   (d) Số học EG-BE-027: `essaySummary.earned` / `.max` chỉ đếm bài tự luận
//       đã chấm. Trong fixture có một bài đã chấm (0.75), một pending và một
//       failed: earned === 0.75, max === 1, gradedCount === 1 — KHÔNG phải max === 3.
//       Một bài failed đóng góp 0 vào earned và 1 vào max chính là số 0 thầm lặng
//       mà AC-015 cấm.
//   (e) `essayLowConfidence: true` trên phần tử đã chấm KHÔNG đổi con số nào ở
//       (b) hay (d) — cùng fixture chạy hai lần, lật cờ, đầu ra số toEqual.
describe("Graded essay stays out of the score triple and Layer 3 (INT-3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(READ_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 4 MCQ, 3 đúng, cộng một bài tự luận đã chấm ở band 0.75.
   *
   *  Chọn sao cho việc tính bài tự luận sẽ dịch chuyển CẢ BA con số: bộ ba
   *  sẽ thành 5 / 3.75 / 6.75 thay vì 4 / 3 / 7.5. Với fixture mà
   *  các con số trùng nhau, nghĩa vụ (b) chẳng chứng minh gì. */
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

  /** Bộ ba tự soạn độc lập: 3 đúng trên 4 câu CHẤM ĐIỂM ⇒ 7.5.
   *  Tính tay chỉ từ bốn MCQ — bài tự luận không có trong đó. */
  const NON_ESSAY_TRIPLE = { totalScore: 7.5, correct: 3, total: 4 };

  it("(a) the graded element keeps scored:false and isCorrect:false, and the `scored` KEY is present", async () => {
    const { examResult } = await driveBothReadPaths({
      perQuestion: FOUR_MCQ_AND_A_GRADED_ESSAY,
      triple: NON_ESSAY_TRIPLE,
    });

    const graded = examResult.result.perQuestion.find((r) => r.questionId === "q-graded")!;
    expect(graded.scored).toBe(false);
    expect(graded.isCorrect).toBe(false);
    // KHOÁ, không chỉ giá trị. Một `scored` thiếu sẽ dính mặc định
    // `coalesce((pq->>'scored')::boolean, true)` của SQL (schema.sql:1354) và
    // ĐẢO bộ lọc mastery, kéo bài tự luận đã chấm vào mô hình mastery.
    expect("scored" in graded).toBe(true);
    // MỐI NỐI TRUNG THỰC, nêu đúng chỗ áp dụng: cái này chỉ chứng minh nửa TypeScript.
    // Chính vị từ SQL được chứng minh bởi recordSkillMastery.int.test.ts và bởi
    // làn service. Mock không chứng minh được một bộ lọc SQL.
    expect(graded.essay?.state).toBe("graded");
  });

  it("(b) the score triple equals literals computed from the NON-essay questions only", async () => {
    const { examResult } = await driveBothReadPaths({
      perQuestion: FOUR_MCQ_AND_A_GRADED_ESSAY,
      triple: NON_ESSAY_TRIPLE,
    });

    // Nếu tính bài tự luận thì các số này thành 5 / 3.75 / 6.75 — cả ba
    // đều dịch chuyển, nhờ vậy fixture này mới có khả năng hỏng.
    expect(examResult.result.total).toBe(4);
    expect(examResult.result.correct).toBe(3);
    expect(examResult.result.totalScore).toBe(7.5);
    // ScoreCard suy ra `wrong = total - correct`; bài tự luận lặng lẽ chui vào
    // mẫu số sẽ định nghĩa lại ý nghĩa của con số đó trên một bề mặt đang chạy.
    expect(examResult.result.total - examResult.result.correct).toBe(1);
  });

  it("(c) the six new keys, arriving through the REAL read path, do not flip the wrong-twice predicate", async () => {
    // CÁCH ĐẶT VẤN ĐỀ — đây là điều biện minh cho sự tồn tại của ca này. Việc loại trừ
    // `scored: false` thuần đã được phủ ở mức unit bởi
    // wrongTwice.test.ts Test 2 (:105-140), trên fixture đã tên là Q-ESSAY,
    // và lặp lại ở đây là phủ trùng lặp. Điều MỚI: phần tử
    // giờ CŨNG mang các khoá vòng đời và đến qua lượt đọc lịch sử thật của getResult()
    // thay vì một fixture unit dựng tay.
    const viewed: unknown[] = [
      mcqEl("q-wrong-twice", false),
      essayEl({ questionId: "q-graded", essayState: "graded", essayEarned: 0.75, essayMax: 1 }),
    ];
    // Cùng hai câu, lại sai ở lượt làm KHÁC THỨ HAI.
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

    // Đối chứng dương trước: thiếu nó, ca này sẽ qua với một vị từ
    // chẳng trả về gì cả.
    expect(mcq.hasBeenWrongTwice).toBe(true);
    // …và bài tự luận vẫn nằm ngoài, DÙ sáu khoá có mặt trên nó.
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

    // max là 1, KHÔNG phải 3. Một bài failed cộng 0 vào earned và 1 vào max chính là
    // số 0 thầm lặng mà AC-015 cấm — và nó trông hoàn toàn hợp lý
    // tại lúc ai đó viết ra.
    expect(examResult.essaySummary).toEqual({
      earned: 0.75,
      max: 1,
      gradedCount: 1,
      pendingCount: 1,
      failedCount: 1,
      unresolvedCount: 1,
    });
    // Số học tự luận và bộ ba điểm là hai sổ riêng; thêm hai bài tự luận
    // kia không làm dịch chuyển con số nào trong ba số.
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

    // AC-046: cờ chỉ để hiển thị. Nó phải tới được view…
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
    // …được khẳng định ở đây để `on.toEqual(off)` không thể thoả mãn bằng
    // việc cờ bị bỏ rơi hoàn toàn.
    expect(examResult.result.perQuestion[0].essay?.lowConfidence).toBe(true);
  });
});
