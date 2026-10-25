// @vitest-environment jsdom

// Essay (Tự luận) Auto-Scoring — FIXTURE-E2E lane skeleton
// Design Docs: docs/design/essay-auto-scoring-frontend-design.md (v1.1, § Test
//                Boundaries :2134, § Feature-Off Window :1605, § EssayGradingPoller
//                mount condition F-05 :1383)
//              docs/design/essay-auto-scoring-backend-design.md (v1.3, § Cờ tính
//                năng :2011)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3, RS-0..RS-6 :333,
//                usePdfAction :643, ActionButton :681, HistoryRowMenu :708,
//                Copy Inventory :822, Golden States :966)
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-012, AC-023, AC-057,
//                AC-058, AC-064, AC-067)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted; Amendment
//                to ADR-0010 — ba bề mặt phải tôn trọng một điểm số đang dịch chuyển)
// Sinh ngày:   2026-08-29 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// CẢ BA CA BÊN DƯỚI LÀ SKELETON (`it.todo`). Chưa có gì ở đây render bất cứ thứ gì,
// và chưa component nào của tính năng này tồn tại.
//
// LÀN NÀY CHẠY THẾ NÀO: `npm run test:fixture` (từ `SOURCE/`), tức
// `vitest run --config vitest.fixture.config.ts`. Config đó glob cả thư mục
// (`tests/e2e/fixture/**/*.test.{ts,tsx}`), nên FILE NÀY ĐƯỢC THU THẬP
// TỪ LÚC ĐƯỢC COMMIT và không cần sửa config. Đó chính xác là lý do
// các ca là `it.todo` chứ không phải comment trần: một file được thu thập mà không có task nào
// làm vitest báo "No test suite found in file" và thoát mã 1 — kiểu hỏng mà
// sáu DRIVER SCRIPT trong thư mục này bị loại đích danh để tránh
// (`vitest.fixture.config.ts:45-52`). ĐỪNG thêm file này vào danh sách loại đó;
// `it.todo` đã giữ làn xanh, và bị loại là cách một ca được
// viết, review và merge mà không bao giờ chạy.
//
// VÌ SAO LÀN NÀY MÀ KHÔNG PHẢI SCRIPT DRIVER PLAYWRIGHT. Sáu anh em đã ship ở đây
// (`history.`, `rating.`, `short-answer-scoring.`, ba `support-*.`) được viết
// theo một tập con cấu trúc của API Playwright và KHÔNG GÌ CHẠY CHÚNG — repo
// không có `@playwright/test` và không có `playwright.config.ts`. Hình dạng ca duy nhất
// trong thư mục này thực sự chạy là `subscription.fixture.e2e.test.ts`: một lần
// render TRONG TIẾN TRÌNH của cây route THẬT (RootLayout -> layout nhóm route ->
// page), chỉ stub module action và các nguồn dữ liệu, từ điển thật,
// không MSW, không database, không mạng. Cả ba ca bên dưới theo hình dạng đó.
// Đó là hình dạng duy nhất trong repo này đủ sức hoàn thành các khẳng định bên dưới,
// vì mỗi cái đều là khẳng định về thứ TRANG ghép nên — không phải về
// thứ một component render khi test trao props cho nó.
//
// -----------------------------------------------------------------------------
// RANH GIỚI MOCK — nêu một lần, áp dụng cho cả ba ca
// -----------------------------------------------------------------------------
// Frontend DD § Mock Boundary Decisions (:2136) là thẩm quyền:
//   MOCK    — `next/navigation` (`useRouter().refresh`), để các lần refresh được ĐẾM
//             chính xác (tiền lệ `RecheckOrderControl.test.tsx:55`);
//             Server Action `retryEssayGrading()`; `lib/pdf/generateAttemptPdf`
//             (jsPDF + html2canvas không chạy trong jsdom); hai nguồn dữ liệu mà
//             trang/hàng đọc (`getResult()`, `listMyHistory()`), stub để trả về
//             các fixture `ExamResult` / `MyHistoryEntry[]` dựng tay.
//   STUB    — `document.visibilityState` qua `Object.defineProperty`.
//   THẬT    — `deriveEssayView()`, `summariseEssays()`, `isEssayIncomplete()`;
//             `useT()`/`getTranslate()` và CẢ HAI từ điển (để các ca khẳng định
//             đúng KHOÁ được phân giải ra đúng chuỗi, không phải "một chuỗi nào đó");
//             `EssayLifecycleBadge`; các layout, provider và bộ định dạng.
//   KHÔNG LỜI GỌI NHÀ CUNG CẤP — việc chấm xuất xưởng Ở TRẠNG THÁI TẮT sau cổng người duyệt AC-067
//             (Groq Zero Data Retention) và CHƯA CÓ TÀI KHOẢN GROQ. Không ca nào trong
//             file này có ranh giới mạng: band là một GIÁ TRỊ FIXTURE
//             trong `ExamResult` đã stub. FE2E-1 còn khẳng định số lần gọi
//             `router.refresh()` bằng không, là nửa phía-client của
//             "cờ tắt => không gì được đặt chuyển động".
// @real-dependency: không có. Làn này không cần database hay thông tin đăng nhập.
//
// -----------------------------------------------------------------------------
// HAI MỐI NGUY KHIẾN MỘT CA XANH VÔ NGHĨA — đọc trước khi viết khẳng định
// -----------------------------------------------------------------------------
// (1) QUA RỖNG TRÊN CÂY TRỐNG. `render(await Component())` trả về một CÂY TRỐNG
//     khi server component được await có con async, và mọi
//     `expect(queryBy…).toBeNull()` viết trên nó QUA TRÊN HƯ KHÔNG.
//     `EssayScoreLine` và `EssayReviewBlock` đều async VÀ có con async
//     (`EssayLifecycleBadge`), nên rơi thẳng vào đó. Mọi ca render
//     một trong hai PHẢI dùng `renderServerTree()` VÀ mang ít nhất một
//     khẳng định DƯƠNG (`getByText`/`getByRole` thành công), để cây trống
//     luôn đỏ. Early Verification Point của frontend DD biến đây thành luật cho
//     cả lát cắt, không chỉ lời khuyên.
//     SỬA ĐƯỜNG DẪN, đã kiểm trong cây ngày 2026-08-29: helper nằm ở
//     `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx`.
//     `SOURCE/lib/test/renderServerTree.tsx` KHÔNG TỒN TẠI — frontend DD :2158
//     nêu nó là đích đến ở người dùng THỨ BA, và lát cắt này là
//     thứ hai. Import từ đường dẫn sẵn có, hoặc chuyển helper và cập nhật
//     test orders trong cùng commit; đừng import một đường dẫn không có.
// (2) VA CHẠM FAKE-TIMER / REAL-TIMER TRONG MỘT FILE. FE2E-2 đòi
//     `vi.useFakeTimers()` (poller là vòng lặp setTimeout lồng nhau; frontend DD
//     :2160 ghim harness và cấm `waitFor` ở đó). FE2E-3 KHÔNG được dùng
//     fake timer. Giới hạn đồng hồ giả vào `describe` riêng của FE2E-2 với
//     `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => { cleanup();
//     vi.useRealTimers(); })` — một đồng hồ giả cấp file sẽ treo các tương tác
//     menu của FE2E-3.
//
// -----------------------------------------------------------------------------
// CHỌN LỌC — vì sao ba cái này
// -----------------------------------------------------------------------------
//   FE2E-1  108  tính-năng-tắt giống từng byte qua S-01 + S-02  <- được chọn (hạng 1)
//   FE2E-2   81  bài tự luận cuối được giải quyết: thông báo + bỏ chặn  <- được chọn, GIỮ CHỖ
//                 (hành trình nhiều bước hướng người dùng có ROI cao nhất)
//   FE2E-3   72  chốt PDF ở CẢ HAI lối ra, một lượt làm       <- được chọn (hạng 3)
//   (F-4)    40  nút thử lại RS-6 aria-disabled + click no-op <- KHÔNG chọn ở đây;
//                 ĐẨY XUỐNG làn component
//                 (`EssayRegradeControl.test.tsx`, `npm test`), nơi chứng minh
//                 cả thành ngữ aria-disabled rẻ hơn. MỘT phần mà một test component
//                 không chứng minh được — control sống sót qua một `router.refresh()`
//                 mà không unmount — được gộp vào nghĩa vụ (f) của FE2E-2.
//   (F-5)    64  ma trận render RS-0..RS-6 trên /result/detail     <- KHÔNG chọn;
//                 đó là bảng trạng thái x hiển thị của một component, thuộc về
//                 component lane per frontend DD § Phân tầng.

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =============================================================================
// RANH GIỚI MOCK — CHỈ các nguồn dữ liệu và module action
// =============================================================================
// Thật: mọi từ điển, mọi component, cả hai layout route, toàn bộ
// cây component. Stub: thứ với ra ngoài tiến trình (lượt đọc Supabase, đường ống
// PDF, router) cộng các shim framework mà jsdom không có câu trả lời.
//
// Điểm của làn này là một lỗi ở DÂY NỐI giữa hai component thật nhìn thấy được.
// Mock một component sẽ giấu chính điều đó.

const {
  getResultMock,
  getMyRatingMock,
  getProfileMock,
  readEntitlementMock,
  listMyHistoryMock,
  refreshMock,
  generatePdfMock,
  getResultCardSummaryMock,
} = vi.hoisted(() => ({
  getResultMock: vi.fn(),
  getMyRatingMock: vi.fn(),
  getProfileMock: vi.fn(),
  readEntitlementMock: vi.fn(),
  listMyHistoryMock: vi.fn(),
  refreshMock: vi.fn(),
  generatePdfMock: vi.fn(),
  // Task 08 — một truy vấn bổ sung của SolutionEntryCard trên /result. Mock cả
  // module theo quy ước của chính file này (UI Spec :164, dòng frontend DD
  // "Fixture lane's getResult/getMyRating mock factory"): mọi export mà trang
  // import từ một module bị mock đều resolve thành `undefined` và ném lỗi
  // trừ khi được thêm vào đây trong CÙNG thay đổi với import của trang.
  getResultCardSummaryMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
// `next/font/google` la mot compiler transform; goi nhu mot ham thuong thi no
// nem. Tra ve dung ten CSS-variable ma tung call site hoi giu nguyen duong ma
// that cua root layout (phep noi suy `className`). Ba font, dung nhu
// `subscription.fixture.e2e.test.ts` đã chạy thật.
vi.mock("next/font/google", () => {
  const font = (options: { variable?: string }) => ({
    variable: options.variable ?? "",
    className: "",
  });
  return { Lexend: font, Geist_Mono: font, Source_Serif_4: font, Be_Vietnam_Pro: font };
});
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: refreshMock, back: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`unexpected redirect to ${to}`);
  },
}));
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getProfileMock,
}));
vi.mock("@/lib/billing/readEntitlement", () => ({ readEntitlement: readEntitlementMock }));
vi.mock("@/features/exams/queries", () => ({ getResult: getResultMock }));
vi.mock("@/features/exams/actions", () => ({ getMyRating: getMyRatingMock }));
vi.mock("@/features/history/queries", () => ({ listMyHistory: listMyHistoryMock }));
// Task 08 — nguồn dữ liệu duy nhất của SolutionEntryCard (truy vấn bổ sung duy nhất của
// result/page.tsx, AC-012). `renderResultRoute()` mặc định cái này là `null` để
// bốn describe tự luận ở trên giữ nguyên giống từng byte (không thẻ, không node mới)
// trừ khi một ca task-08 bên dưới ghi đè theo từng lần render.
vi.mock("@/features/solutions/queries", () => ({
  getResultCardSummary: getResultCardSummaryMock,
}));
// Đường ống PDF là thứ duy nhất mà SỰ VẮNG MẶT của một lời gọi chính là khẳng định.
vi.mock("@/lib/pdf/generateAttemptPdf", () => ({
  generateAttemptPdfFile: generatePdfMock,
  downloadPdfFile: vi.fn(),
  canShareFile: () => false,
}));

import { renderServerTree } from "@/tests/helpers/renderServerTree";
import RootLayout from "@/app/layout";
import Layer2Layout from "@/app/(exams)/layout";
import ResultPage from "@/app/(exams)/exams/[id]/attempt/[attemptId]/result/page";
import ResultDetailPage from "@/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page";
import { HistoryRow } from "@/features/history/components/HistoryRow";
import { HistoryRowMenu } from "@/components/history/HistoryRowMenu";
import { ResultActions } from "@/features/exams/components/ResultActions";
import { EssayGradingPoller } from "@/features/exams/components/EssayGradingPoller";
import type { ExamResult } from "@/features/exams/queries";
import type { MyHistoryEntry } from "@/features/history/queries";
import type { ResultCardSummary, SolutionStatus } from "@/features/solutions/queries";
import { copy } from "@/lib/copy";
import {
  ESSAY_POLL_FAST_INTERVAL_MS,
} from "@/features/exams/components/EssayGradingPoller";

const DICT = copy;
const EXAM_ID = "11111111-1111-1111-1111-111111111111";
const ATTEMPT_ID = "22222222-2222-2222-2222-222222222222";
const ESSAY_QID = "essay-q1";
const MCQ_QID = "mcq-q1";

const PROFILE = { id: "u1", displayName: "Nguyen Phat", email: "a@b.c" };

/** Hinh dang THAT cua `Entitlement` — khong phai mot object rut gon.
 *  `TutorQuotaNote` doc `.tutor.state`, nen mot stub thieu truong lam CA CAY
 *  server nem, va loi ay hien ra o day duoi dang mot cay rong. */
const FREE_ENTITLEMENT = {
  plan: "free",
  expiresAt: null,
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
} as unknown as Parameters<typeof readEntitlementMock>[0] extends never
  ? never
  : Awaited<ReturnType<typeof import("@/lib/billing/readEntitlement").readEntitlement>>;

/** Một lượt làm cũ: KHÔNG phần tử nào mang khoá vòng đời, nên `summariseEssays()`
 *  trả về `undefined` và cả bề mặt tự luận phải vắng mặt. Đây là trạng thái
 *  đã ship — cờ tính năng tắt — và AC-012 nói trang phải giống từng byte
 *  như trước khi tính năng này tồn tại. */
function legacyResult(): ExamResult {
  return {
    examId: EXAM_ID,
    examTitle: "Fixture exam: cell biology",
    subject: "Biology",
    result: {
      totalScore: 5,
      correct: 1,
      total: 2,
      topicBreakdown: [],
      perQuestion: [
        { questionId: MCQ_QID, selected: "B", correct: "A", isCorrect: false, scored: true },
        { questionId: ESSAY_QID, selected: "hoc sinh viet o day", isCorrect: false, scored: false },
      ],
    },
    questions: {
      [MCQ_QID]: {
        content: "Where does photosynthesis mostly happen?",
        choices: [
          { id: "A", text: "In the chloroplast" },
          { id: "B", text: "In the nucleus" },
        ],
        questionType: "mcq",
      },
      [ESSAY_QID]: {
        content: "Explain why chloroplasts matter.",
        choices: [],
        questionType: "essay",
        essayAnswer: "They capture light energy.",
      },
    },
    startedAt: "2026-08-18T11:00:00.000Z",
    submittedAt: "2026-08-18T11:40:00.000Z",
    overtimeSeconds: 0,
    hasIncompleteEssay: false,
  };
}

/** Cùng lượt làm đó KHI tính năng đang chạy và một bài tự luận vẫn đang được chấm. */
function pendingResult(): ExamResult {
  const base = legacyResult();
  return {
    ...base,
    result: {
      ...base.result,
      perQuestion: base.result.perQuestion.map((r) =>
        r.questionId === ESSAY_QID
          ? {
              ...r,
              essay: {
                state: "pending" as const,
                earned: null,
                max: null,
                lowConfidence: false,
                retryAvailable: false,
              },
            }
          : r
      ),
    },
    essaySummary: {
      earned: 0,
      max: 0,
      gradedCount: 0,
      pendingCount: 1,
      failedCount: 0,
      unresolvedCount: 1,
    },
  };
}

/** Cùng lượt làm đó khi band đã hạ cánh. */
function resolvedResult(): ExamResult {
  const base = legacyResult();
  return {
    ...base,
    result: {
      ...base.result,
      perQuestion: base.result.perQuestion.map((r) =>
        r.questionId === ESSAY_QID
          ? {
              ...r,
              essay: {
                state: "graded" as const,
                earned: 1,
                max: 1,
                lowConfidence: false,
                retryAvailable: false,
              },
            }
          : r
      ),
    },
    essaySummary: {
      earned: 1,
      max: 1,
      gradedCount: 1,
      pendingCount: 0,
      failedCount: 0,
      unresolvedCount: 0,
    },
  };
}

function historyEntry(over: Partial<MyHistoryEntry> = {}): MyHistoryEntry {
  return {
    attemptId: ATTEMPT_ID,
    examId: EXAM_ID,
    examTitle: "Fixture exam: cell biology",
    subject: "Biology",
    totalScore: 5,
    correct: 1,
    total: 2,
    startedAt: "2026-08-18T11:00:00.000Z",
    submittedAt: "2026-08-18T11:40:00.000Z",
    hasUnresolvedEssay: false,
    hasIncompleteEssay: false,
    ...over,
  } as MyHistoryEntry;
}

/** Fixture cho `ResultCardSummary` — task 08's SolutionEntryCard. `null` (0
 *  dong that) khong di qua ham nay, chi bon myStatus + so du lieu duong. */
function cardSummary(over: Partial<ResultCardSummary> = {}): ResultCardSummary {
  return {
    publishedCount: 3,
    myStatus: null,
    changedQuestionCount: 0,
    unseenDeletionReason: null,
    ...over,
  };
}

/** `RootLayout -> (exams)/layout -> /result`, ghép đúng như production
 *  ghép. Không gì ở đây cấp `EntitlementProvider` — nó chỉ tới được
 *  vì layout nhóm route mount nó, là điều duy nhất mà một unit test bọc provider
 *  không bao giờ chứng minh được.
 *
 *  ═══ VI SAO `renderServerTree()` CHU KHONG `render()` ═══
 *
 *  Cay route nay CHUA component server ASYNC (`EssayScoreLine`,
 *  `EssayLifecycleBadge`, `EssayReviewBlock`). Renderer CLIENT cua React tu
 *  choi mot async component, treo lai, va tra ve CAY RONG — do dung la hiem
 *  hoa so 1 ma task nay neu ten. Ban nhap dau file nay dung `render()` va moi
 *  khang dinh PHU DINH deu xanh tren HU KHONG; chi mot khang dinh DUONG
 *  ("trang co ten de bai") lam lo ra dieu do (`expected '' to contain ...`).
 *  Do la ly do luat "moi ca phai co it nhat mot khang dinh duong" ton tai.
 *
 *  Da do: cung mot cay, qua `render()` cho 0 ky tu; qua `renderServerTree()`
 *  cho mot cay that. */
// `cardSummary` mặc định `null` — 0 dòng thật (không đủ điều kiện), giữ FE2E-
// 1..4 o tren byte-for-byte (SolutionEntryCard khong render gi). Cac ca cua
// task 08 truyen gia tri rieng qua tham so nay, KHONG set mock truoc/sau lan
// goi ham nay — tranh dua thu tu voi dong ben duoi.
async function renderResultRoute(
  result: ExamResult,
  cardSummaryValue: ResultCardSummary | null = null
) {
  getResultMock.mockResolvedValue(result);
  getMyRatingMock.mockResolvedValue(null);
  getProfileMock.mockResolvedValue(PROFILE);
  readEntitlementMock.mockResolvedValue(FREE_ENTITLEMENT);
  getResultCardSummaryMock.mockResolvedValue(cardSummaryValue);

  const page = await ResultPage({
    params: Promise.resolve({ id: EXAM_ID, attemptId: ATTEMPT_ID }),
  });
  return renderServerTree(
    await RootLayout({ children: await Layer2Layout({ children: page }) })
  );
}

/** Cung cay do, nhung cho `/result/detail` — nua thu hai cua loi hua FE2E-1.
 *  Nhanh khong-cham cu (`result.notAutoScored`) song o TRANG NAY, khong phai o
 *  `/result`, nen mot ca chi render `/result` KHONG the phat bieu ve no. */
async function renderDetailRoute(result: ExamResult) {
  getResultMock.mockResolvedValue(result);
  getProfileMock.mockResolvedValue(PROFILE);
  readEntitlementMock.mockResolvedValue(FREE_ENTITLEMENT);

  const page = await ResultDetailPage({
    params: Promise.resolve({ id: EXAM_ID, attemptId: ATTEMPT_ID }),
  });
  return renderServerTree(
    await RootLayout({ children: await Layer2Layout({ children: page }) })
  );
}

/** Mọi phần tử mang thuộc tính `disabled` gốc. FE-AC-21 nói
 *  không bao giờ được có cái nào, ở bất kỳ trạng thái nào. */
function disabledNodes(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("[disabled]"));
}

// =============================================================================
// FE2E-1 — Trạng thái đã ship: cờ tắt, bốn bề mặt giống từng byte như hôm nay
// =============================================================================
// AC: FE-AC-14 — "Khi KHÔNG phần tử nào của lượt làm mang khoá essayState,
//   trang kết quả KHÔNG ĐƯỢC chèn node mới nào: không EssayScoreLine, không
//   poller đang chạy, không đổi ScoreCard." (AC-012)
// AC: FE-AC-13 — "Khi một phần tử per_question không mang essayState (hàng
//   cũ, tính năng tắt, hoặc câu không có đáp án mẫu), thẻ câu hỏi PHẢI
//   render BYTE-FOR-BYTE as before this change: 'Bạn trả lời:' / 'Đáp án đã lưu:' /
//   nhãn result.notAutoScored." (AC-012/AC-018)
// Cũng hoàn thành: PRD AC-067; UI Spec Golden States 7, 8, 10; frontend DD
//   § Feature-Off Window (S-01, S-02, file PDF) và lời hứa kiểm thử được F-09 của nó:
//   "poller không mount, không lập lịch timer nào, gọi router.refresh() không lần nào";
//   frontend DD § Output Comparison column "tính năng tắt".
// ROI: 108 (BV:10 x Freq:10 + Legal:0 + Defect:8)
//   BV 10 — đây là trạng thái mà tính năng XUẤT XƯỞNG, và nó có thể ở đó rất
//     lâu: AC-067 là cổng người duyệt trên một tài khoản Groq chưa tồn tại.
//     Mọi thứ khác trong file này mô tả một trạng thái chưa người dùng nào tới.
//   Freq 10 — mọi học sinh mở bất kỳ trang kết quả nào, hôm nay và suốt
//     cửa sổ tính-năng-tắt.
//   Defect 8 — một hồi quy ở đây là hồi quy một trang ĐÃ SHIP, đang chạy,
//     do một tính năng đáng lẽ đang tắt. Đó cũng là lớp lỗi duy nhất
//     mà người review ít có khả năng tìm nhất.
// Hành vi: cây route thật cho /result và /result/detail được ghép với một
//   `getResult()` stub trả về ExamResult CŨ (không khoá essay* nào ở đâu cả,
//   `essaySummary === undefined`, mọi `PerQuestionResult.essay === undefined`) ->
//   trang render -> không node tự luận nào tồn tại, không timer nào được lập lịch, và thẻ
//   tự luận là nhánh không-tự-chấm không đổi.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: toàn UI trong tiến trình (RootLayout -> layout (exams) -> result/page.tsx
//   và result/detail/page.tsx), backend bị mock (stub getResult), mock
//   next/navigation, mock generateAttemptPdf
// @complexity: medium
// @real-dependency: không có
// Kiểu hỏng chính: `EssayGradingPoller` được mount vô điều kiện (hoặc theo một vị từ
//   đúng với `undefined`), nên mọi trang kết quả cũ trên
//   production bắt đầu một vòng lặp `router.refresh()` render lại trang 30 lần
//   vô cớ — vô hình trên màn hình, tốn kém ở các request RSC, và không ai
//   báo vì không gì trông sai. Kiểu thứ hai: `EssayScoreLine` trả về
//   một fragment rỗng thay vì `null`, chèn một node vào cột `gap-5`
//   và làm lệch nhịp dọc của một trang đã ship.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) DƯƠNG TRƯỚC (mối nguy 1): khẳng định trang thực sự đã render — chữ điểm của
//       ScoreCard và chuỗi `result.notAutoScored` của thẻ tự luận
//       đều tìm được bằng `getByText`. Mọi khẳng định phủ định bên dưới chỉ
//       có ý nghĩa sau khi cái này qua.
//   (b) Không node tự luận: không chuỗi huy hiệu nào phân giải từ từ điển THẬT
//       (`result.essay.state.pending` = "Đang chấm", `.graded` = "Đã chấm",
//       `.failed` = "Chấm thất bại") and none of `result.essay.label`,
//       `result.essay.points`, `result.essay.denominator` xuất hiện ở bất kỳ đâu trong
//       container. Khẳng định trên các chuỗi đã phân giải qua từ điển thật, không phải trên
//       tên component hay test id.
//   (c) Không timer, không refresh — lời hứa ba phần mà F-09 nêu là
//       kiểm thử được: `vi.getTimerCount()` bằng 0 ngay sau khi render, đẩy
//       đồng hồ 200_000 ms không lập lịch gì, và mock `refresh` được đếm
//       đã được gọi 0 lần. (Đây là chỗ duy nhất FE2E-1 cần đồng hồ giả; giữ
//       nó trong describe này.)
//   (d) Thẻ tự luận là nhánh dùng chung KHÔNG ĐỔI: "Bạn trả lời:" và
//       "Đáp án đã lưu:" are both present, `result.notAutoScored` is present, and
//       KHÔNG chip đúng/sai nào được render trên nó.
//   (e) Control PDF mở, không bị chặn: cả hai control PDF mang
//       `aria-disabled="false"` và phần tử lý do sr-only mà chúng trỏ tới
//       KHÔNG chứa `result.essay.pdfBlocked`.
//   (f) ScoreCard 0-diff (ADR-0018 Amendment, UI-D3): chữ đã render của cây con ScoreCard
//       toEqual một literal tự soạn độc lập — điểm tới một
//       decimal + "/10", "Đúng" = correct, "Sai" = total - correct — computed from
//       fixture bằng tay. `ScoreCard.tsx` được khai báo là vùng 0-diff; đây là
//       nửa tự động của lời khai báo đó.
describe("Feature off — /result and /result/detail render as today (FE2E-1)", () => {
  // Dong ho GIA duoc pham vi hoa vao RIENG describe nay — KHONG BAO GIO o muc
  // file. FE2E-3 ben duoi tuong tac voi menu va se TREO duoi mot dong ho gia.
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    generatePdfMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("inserts no essay node, mounts no poller, schedules no timer and calls router.refresh() zero times for a legacy attempt, while the not-auto-scored branch and ScoreCard render unchanged", async () => {
    const { container } = await renderResultRoute(legacyResult());

    // (a) KHANG DINH DUONG TRUOC: trang co that va da render.
    expect(container.textContent).toContain("Fixture exam: cell biology");
    expect(container.textContent).toContain("5.0");

    // (b) KHONG mot node tu luan nao. `EssayScoreLine` tra `null` khi
    //     `essaySummary === undefined`, nen mot dong cu KHONG moc them gi —
    //     do la thu giu AC-012 dung TUNG BYTE.
    expect(container.textContent).not.toContain(DICT["result.essay.label"]);
    expect(container.textContent).not.toContain(DICT["result.essay.state.pending"]);

    // (c) KHONG poller: chu ky DOM rieng cua no khong ton tai.
    //     Chon `p[aria-live="polite"]` chu khong phai `[aria-live="polite"]`:
    //     layout cua nhom route da mang san mot vung `role="status"` cua rieng
    //     no, nen mot selector rong se do vi mot node KHONG lien quan gi toi
    //     tinh nang nay — va ban nhap dau da do dung nhu the.
    expect(container.querySelector('p[aria-live="polite"]')).toBeNull();

    // (d) KHONG timer nao duoc hen.
    //
    //     GIOI HAN DUOC GHI NGAY TAI CHO DE CA NAY KHONG DOI CONG HON THU NO
    //     CHUNG MINH: `renderServerTree()` dung renderer SERVER, nen effect cua
    //     client component KHONG CHAY o day. Vay phep dem timer duoi day chung
    //     minh dieu KIEN CAN ("khong co gi hen timer"), khong phai dieu kien DU
    //     ("poller da mount va tu quyet dinh khong hen"). Nua DU nam o
    //     `EssayGradingPoller.test.tsx`, noi component duoc mount that bang RTL.
    //     Thu ca nay THUC SU chung minh la (c): node cua poller khong co mat
    //     trong cay, nen khong co gi de mount ca.
    act(() => {
      vi.advanceTimersByTime(ESSAY_POLL_FAST_INTERVAL_MS * 48);
    });
    expect(vi.getTimerCount()).toBe(0);

    // (e) `router.refresh()` KHONG duoc goi lan nao.
    expect(refreshMock).not.toHaveBeenCalled();

    // (f) Nhanh khong-cham cu VAN render y nhu truoc — kiem tren `/result/detail`,
    //     vi do la trang co nhanh ay. Mot ca chi render `/result` khong the
    //     phat bieu ve no, va ban nhap dau da thu lam dung the roi do.
    const detail = await renderDetailRoute(legacyResult());
    expect(detail.container.textContent).toContain(DICT["result.notAutoScored"]);
    // Va o do cung KHONG mot node tu luan nao.
    expect(detail.container.textContent).not.toContain(DICT["result.essay.state.pending"]);
    expect(detail.container.querySelector('p[aria-live="polite"]')).toBeNull();
  });
});

// =============================================================================
// FE2E-2 — SUẤT GIỮ CHỖ (hành trình). Lần render mà bài tự luận CUỐI được giải quyết:
//          vùng aria-live vẫn được mount, và các control PDF được bỏ chặn
//          tại chỗ mà không chuyển focus
// =============================================================================
// AC: FE-AC-16 — "Khi số câu chưa giải quyết GIẢM giữa hai lần render, vùng
//   aria-live='polite' của poller PHẢI nhận đúng một câu; khi nó không
//   giảm, vùng đó PHẢI rỗng." (AC-023)
// AC: PRD AC-023 — band hạ cánh được thông báo, và focus không bị cướp cũng không
//   bị mất.
// AC: FE-AC-05 — "Khi mọi câu tự luận đã được giải quyết, cả Lưu và Chia sẻ
//   (S-01) và cả hai mục PDF trong menu ⋯ (S-03) PHẢI mang aria-disabled='false'
//   và một cú bấm PHẢI gọi generateAttemptPdfFile đúng một lần." (AC-058)
// Cũng hoàn thành: frontend DD F-05 (vị từ mount là
//   `essaySummary !== undefined`, KHÔNG phải `pendingCount > 0`), các ca poller P-1/P-6,
//   ba ca aria-live, luật "không bao giờ bị gỡ khỏi cây" của UI-D5.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
//   BV 9 — đây là toàn bộ lời hứa của tính năng với học sinh không nhìn thấy
//     màn hình: điểm đã đến. Nếu vùng bị unmount ở lần render giải quyết bài tự luận cuối,
//     thông báo không có chỗ đáp xuống và không bao giờ được đọc; người dùng nhìn thấy
//     không bị ảnh hưởng, nên không ai báo.
//   Freq 8 — mọi lượt làm đã chấm đi qua đúng chuyển đổi này một lần.
//   Defect 9 — cách phát biểu đầu tiên của chính UI Spec về vị từ mount
//     (`pendingCount > 0`) GÂY RA lỗi này; nó được bắt ở review (F-05) và
//     sửa. Một test viết theo vị từ trông-tự-nhiên là cách nó quay lại.
//   BIỆN MINH SUẤT GIỮ CHỖ: hành trình nhiều bước hướng người dùng có ROI cao nhất
//   của tính năng — /result render với các bài tự luận pending, trạng thái được mang qua một
//   ranh giới router.refresh(), và hành trình có một điểm hoàn tất (mọi bài tự luận
//   đã giải quyết, PDF được bỏ chặn). Được phát bất kể ngưỡng; nó cũng vượt ngưỡng.
//   VÌ SAO KHÔNG PHẢI service-integration-e2e: không gì ở đây cần một lượt ghi DB thật, một
//   sự kiện thật hay một lời gọi ngoài thật. Việc band đến được mô hình hoá bằng
//   `getResult()` stub trả về một fixture KHÁC ở lần gọi thứ hai — cũng là
//   cách duy nhất chạm chuyển đổi một cách xác định.
// Hành vi: cây route /result thật render với `essaySummary.pendingCount`
//   = 1 -> đồng hồ giả đẩy một khoảng poll -> mock `refresh` được đếm
//   bắn và `getResult()` stub giờ trả về fixture đã-giải-quyết-hết ->
//   trang render lại TẠI CHỖ -> vùng aria-live vẫn đang mount nhận
//   `result.essay.announceAllDone`, và các control PDF lật sang không bị chặn mà
//   không control nào bị unmount.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: toàn UI trong tiến trình (result/page.tsx ghép EssayScoreLine +
//   EssayGradingPoller), mock next/navigation (refresh có đếm), mock
//   getResult (fixture hai pha), mock generateAttemptPdf, fake timer
// @complexity: high
// @real-dependency: không có
// Kiểu hỏng chính: điều kiện mount của poller bị viết là
//   `pendingCount > 0` (dạng mà UI Spec công bố đầu tiên), nên ở lần render
//   mà bài tự luận cuối được giải quyết, component bị unmount, vùng `aria-live`
//   rời DOM trong cùng commit mà câu thông báo lẽ ra được chèn,
//   và việc hoàn tất không bao giờ được thông báo. Một test render trạng thái đã giải quyết
//   TRỰC TIẾP vẫn qua — vùng vắng mặt ở cả cài đặt đúng lẫn hỏng tại thời điểm đó;
//   chỉ CHUYỂN ĐỔI mới phân biệt được chúng, đó là
//   lý do ca này phải đẩy trang qua chuyển đổi thay vì khẳng định
//   trạng thái cuối.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) TRƯỚC: với pendingCount 1, vùng aria-live tồn tại
//       (`container.querySelector('[aria-live="polite"]')` khác null) và RỖNG.
//       Khẳng định rỗng trên textContent, không phải trên việc vắng node.
//   (b) CHUYỂN ĐỔI, được điều khiển chứ không khẳng định vòng quanh: đẩy đúng một khoảng trong
//       `act()` (frontend DD :2160 — setTimeout lồng nhau nghĩa là mỗi tick cần
//       lần đẩy riêng; một lần đẩy dài để React không có điểm commit), để
//       fixture `getResult()` thứ hai render.
//   (c) SAU: CHÍNH node aria-live đó vẫn còn trong tài liệu (so sánh danh tính node
//       với tham chiếu bắt ở (a) — một lần remount tình cờ thêm lại một node tương đương
//       chính là lỗi, và truy vấn lại theo selector không thể
//       phân biệt hai trường hợp), và textContent của nó giờ bằng
//       `result.essay.announceAllDone` = "Đã chấm xong toàn bộ câu tự luận."
//       đã phân giải qua từ điển THẬT.
//   (d) ĐỐI CHỨNG ÂM trong cùng ca: một lần refresh mà pendingCount KHÔNG
//       giảm để vùng rỗng. Thiếu cái này, (c) qua với một cài đặt
//       thông báo ở mỗi tick — chính là lỗi AC-023 theo hướng
//       ngược lại (trình đọc màn hình bị ngắt ở mỗi lần poll).
//   (e) BỎ CHẶN TẠI CHỖ: sau chuyển đổi cả hai control PDF mang
//       `aria-disabled="false"`, và một cú bấm gọi `generateAttemptPdfFile` mock
//       ĐÚNG MỘT LẦN (không phải "ít nhất một lần" — chốt chống dồn dập
//       là lý do cần số đếm chính xác).
//   (f) KHÔNG CONTROL NÀO BỊ UNMOUNT qua chuyển đổi (đây là phần gộp vào của
//       F-4 bị đẩy xuống, và là nửa tự động hoá được của AB-5/R-F3): bắt
//       các node DOM của control PDF và của bất kỳ control thử lại nào trước
//       refresh và khẳng định cùng các object node đó vẫn còn nối vào
//       (`node.isConnected === true`) sau đó. GIỚI HẠN ĐÃ GHI, nêu tại chỗ
//       khẳng định: jsdom không có `router.refresh()` thật và không có vòng focus được vẽ,
//       nên điều này chứng minh điều kiện CẦN (không gì bị unmount) chứ không phải
//       điều kiện ĐỦ (focus thực sự sống sót trong trình duyệt). Nửa đủ
//       thuộc về lượt kiểm trình duyệt thủ công; đừng để tên ca này tuyên bố nó.
//   Tính xác định: chỉ fake timer, không `waitFor` ở bất kỳ đâu trong describe này
//   (`waitFor` + fake timer là chỗ treo thường trực trong repo này), mọi chuyển động đồng hồ
//   qua `vi.advanceTimersByTime` trong `act()`.
describe("Last essay resolves — announcement lands and PDF unblocks in place (FE2E-2)", () => {
  // Dong ho GIA, pham vi hoa vao RIENG describe nay — cau truc do do Task F-C3
  // dung san, va task nay THEM mot describe vao do chu khong phai gioi thieu no.
  // Mot dong ho gia o muc FILE se lam FE2E-3 (mo menu) TREO.
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    generatePdfMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the aria-live region mounted across the render that resolves the final essay, inserts announceAllDone exactly once, stays silent on a refresh that resolves nothing, and unblocks both PDF controls without unmounting them", async () => {
    // ═══ GIOI HAN GHI NGAY TAI CHO, DE TEN CA NAY KHONG DOI CONG HON ═══
    //
    // jsdom KHONG co `router.refresh()` that: mot lan refresh that se lam may
    // chu render lai va tra ve cay moi. O day lan refresh duoc DEM (mock), con
    // viec "band da dap xuong" duoc MO HINH HOA bang cach re-render voi fixture
    // da nga ngu. Do cung la cach TAT DINH duy nhat de cham vao dung buoc
    // chuyen tiep ay.
    //
    // Vay ca nay chung minh dieu kien CAN — khong co gi bi unmount qua buoc
    // chuyển tiếp — chứ KHÔNG chứng minh điều kiện ĐỦ (focus thật sự sống sót
    // trong mot trinh duyet that). Nua DU nam o luot kiem tay bang trinh duyet
    // (FE-OQ-4 / IV-4 / R-F3).

    // ── (a) Poller CHAY THAT: mot nhip, mot luot refresh ───────────────────
    const poller = render(
      createElement(EssayGradingPoller, { pendingCount: 1, gradedCount: 0 })
    );
    const liveRegion = poller.container.querySelector('p[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // RONG o luot render dau — mot vung da mang san chu co the khong duoc doc len.
    expect(liveRegion?.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(ESSAY_POLL_FAST_INTERVAL_MS);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // ── (b) Mot luot refresh KHONG giai quyet duoc gi thi IM LANG ──────────
    act(() => {
      poller.rerender(
        createElement(EssayGradingPoller, { pendingCount: 1, gradedCount: 0 })
      );
    });
    expect(
      poller.container.querySelector('p[aria-live="polite"]')?.textContent
    ).toBe("");

    // ── (c) Cau CUOI nga ngu: vung VAN o trong cay, va cau bao duoc CHEN ───
    act(() => {
      poller.rerender(
        createElement(EssayGradingPoller, { pendingCount: 0, gradedCount: 1 })
      );
    });

    const afterResolve = poller.container.querySelector('p[aria-live="polite"]');
    // KHONG BI UNMOUNT — day la ca ma dieu kien mount `pendingCount > 0` se pha:
    // vung roi khoi DOM TRONG CUNG commit ma cau nay le ra duoc chen vao.
    expect(afterResolve).not.toBeNull();
    expect(afterResolve).toBe(liveRegion);
    expect(afterResolve?.textContent).toBe(DICT["result.essay.announceAllDone"]);

    // DUNG MOT lan: dem so node mang cau ay tren toan bo cay.
    const announcements = Array.from(
      poller.container.querySelectorAll("p")
    ).filter((el) => el.textContent === DICT["result.essay.announceAllDone"]);
    expect(announcements).toHaveLength(1);
    cleanup();

    // ── (d) Ca HAI dieu khien PDF mo khoa, va KHONG cai nao bi unmount ─────
    const pdfInput = {
      subject: "Biology",
      examTitle: "Fixture exam: cell biology",
      totalScore: 5,
      examineeName: PROFILE.displayName,
      submittedAt: "2026-08-18T11:40:00.000Z",
      correct: 1,
      total: 2,
      hasIncompleteEssay: false,
    };

    const actions = render(
      createElement(ResultActions, {
        pdfInput,
        blockedReason: DICT["result.essay.pdfBlocked"],
      })
    );
    const blockedButtons = Array.from(actions.container.querySelectorAll("button"));
    expect(blockedButtons).toHaveLength(2);
    for (const b of blockedButtons) {
      expect(b.getAttribute("aria-disabled")).toBe("true");
      expect(b.hasAttribute("disabled")).toBe(false);
    }

    act(() => {
      actions.rerender(createElement(ResultActions, { pdfInput, blockedReason: null }));
    });

    const openButtons = Array.from(actions.container.querySelectorAll("button"));
    expect(openButtons).toHaveLength(2);
    for (const [i, b] of openButtons.entries()) {
      expect(b.getAttribute("aria-disabled")).toBe("false");
      expect(b.hasAttribute("disabled")).toBe(false);
      // DIEU KIEN CAN cua "khong bi unmount": cung mot node DOM truoc va sau.
      expect(b).toBe(blockedButtons[i]);
    }
    // Va gio bam duoc that.
    fireEvent.click(openButtons[0]);
    expect(generatePdfMock).toHaveBeenCalledTimes(1);
  });
});

describe("PDF export guard — both exits agree for one attempt (FE2E-3)", () => {
  // KHONG dong ho gia trong describe nay — day la ly do dong ho duoc pham vi
  // hoa theo tung describe thay vi dat o muc file: cac buoc mo menu o day treo
  // duoi mot dong ho gia.
  beforeEach(() => {
    generatePdfMock.mockReset();
    refreshMock.mockReset();
  });
  afterEach(cleanup);

  it("blocks Save and Share on both /result and the /history row menu with the same readable reason, generates zero files, keeps every control focusable and free of the disabled attribute, leaves the details link open, and unblocks all four once the attempt resolves", async () => {
    // ── CUA THU NHAT: /result, con mot cau chua nga ngu ────────────────────
    const blocked = await renderResultRoute(pendingResult());

    const resultButtons = Array.from(
      blocked.container.querySelectorAll('button[aria-describedby$="-reason"]')
    );
    expect(resultButtons.length).toBeGreaterThanOrEqual(2);

    for (const button of resultButtons) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      // KHONG BAO GIO `disabled` goc: no go phan tu khoi thu tu tab VA day ly do
      // ra ngoai tam voi cua trinh doc man hinh.
      expect(button.hasAttribute("disabled")).toBe(false);
      const reason = blocked.container.querySelector(
        `#${button.getAttribute("aria-describedby")}`
      );
      expect(reason?.textContent).toBe(DICT["result.essay.pdfBlocked"]);
      fireEvent.click(button);
    }
    // KHONG mot tep nao duoc sinh ra.
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(disabledNodes(blocked.container)).toHaveLength(0);
    cleanup();

    // ── CUA THU HAI: hang /history cua CUNG mot lat, CUNG mot cau ──────────
    //
    // Nua nay can TUONG TAC (mo menu), ma `renderServerTree()` tra ve DOM tinh
    // — khong co interactivity. Nen `HistoryRowMenu` (mot CLIENT component)
    // duoc render THANG bang RTL, con `HistoryRow` (server, async) duoc dung o
    // ngay tren de chung minh no TRUYEN dung `blockedReason` xuong. Hai nua,
    // hai renderer, va ly do ghi ra chu khong giau.
    const rowTree = await renderServerTree(
      await HistoryRow({
        entry: historyEntry({ hasUnresolvedEssay: true }),
        examineeName: PROFILE.displayName,
      })
    );
    // Huy hieu "dang cham" o CUOI dong meta — con so `{score}/10` KHONG di
    // chuyen (AC-057 + D5).
    expect(rowTree.container.textContent).toContain(DICT["result.essay.state.pending"]);
    expect(rowTree.container.textContent).toContain("5.0/10");

    const row = render(
      createElement(HistoryRowMenu, {
        pdfInput: {
          subject: "Biology",
          examTitle: "Fixture exam: cell biology",
          totalScore: 5,
          examineeName: PROFILE.displayName,
          submittedAt: "2026-08-18T11:40:00.000Z",
          correct: 1,
          total: 2,
          hasIncompleteEssay: false,
        },
        resultHref: `/exams/${EXAM_ID}/attempt/${ATTEMPT_ID}/result`,
        examTitle: "Fixture exam: cell biology",
        blockedReason: DICT["result.essay.pdfBlocked"],
      })
    );

    const trigger = row.container.querySelector("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger as HTMLElement);

    const menuItems = await screen.findAllByRole("menuitem");
    // Hai muc PDF bi chan; "xem chi tiet" (mot <a>) KHONG bi chan — no la loi di
    // DUY NHAT toi nut cham lai se GO duoc cai chan kia.
    const pdfItems = menuItems.filter((el) => el.tagName === "BUTTON");
    const detailItem = menuItems.find((el) => el.tagName === "A");

    expect(pdfItems.length).toBe(2);
    for (const item of pdfItems) {
      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.hasAttribute("disabled")).toBe(false);
      fireEvent.click(item);
    }
    expect(detailItem).toBeTruthy();
    expect(detailItem?.getAttribute("aria-disabled")).not.toBe("true");

    // CUNG MOT CAU CHU o ca hai cua — day la nua thu hai cua UI-D4: mot cong,
    // hai cua, mot loi giai thich.
    //
    // Doc tu `document.body` chu khong tu `row.container`: panel cua menu duoc
    // PORTAL thang vao body (`createPortal`), nen no khong nam trong container
    // cua lan render nay.
    expect(document.body.textContent).toContain(DICT["result.essay.pdfBlocked"]);
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(disabledNodes(document.body)).toHaveLength(0);
    cleanup();

    // ── DA NGA NGU: ca bon dieu khien mo khoa ──────────────────────────────
    const open = await renderResultRoute(resolvedResult());
    const openButtons = Array.from(
      open.container.querySelectorAll('button[aria-describedby$="-reason"]')
    );
    expect(openButtons.length).toBeGreaterThanOrEqual(2);
    for (const button of openButtons) {
      expect(button.getAttribute("aria-disabled")).toBe("false");
    }
    cleanup();

    const openRow = render(
      createElement(HistoryRowMenu, {
        pdfInput: {
          subject: "Biology",
          examTitle: "Fixture exam: cell biology",
          totalScore: 5,
          examineeName: PROFILE.displayName,
          submittedAt: "2026-08-18T11:40:00.000Z",
          correct: 1,
          total: 2,
          hasIncompleteEssay: false,
        },
        resultHref: `/exams/${EXAM_ID}/attempt/${ATTEMPT_ID}/result`,
        examTitle: "Fixture exam: cell biology",
        blockedReason: null,
      })
    );
    fireEvent.click(openRow.container.querySelector("button") as HTMLElement);
    const openItems = await screen.findAllByRole("menuitem");
    for (const item of openItems.filter((el) => el.tagName === "BUTTON")) {
      expect(item.getAttribute("aria-disabled")).toBe("false");
    }
  });
});

// =============================================================================
// FE2E-4 — Một thẻ đã chấm KHÔNG in "chưa tự chấm" phía trên band của chính nó
// =============================================================================
// AC: FE-AC-03 — "Khi một câu tự luận là `graded`, thẻ của câu đó trên trang
//   chi tiết PHẢI hiện EssayLifecycleBadge đọc 'Da cham', điểm
//   `{band} / 1 diem`, câu trả lời của học sinh và đáp án mẫu; và KHÔNG ĐƯỢC
//   hiện chuỗi `result.notAutoScored`." (AC-053)
// AC: FE-AC-13 — đối ứng KHÔNG ĐƯỢC hồi quy: một phần tử không có khoá
//   vòng đời vẫn render nhãn, giống từng byte như trước (AC-012/018).
//
// VÌ SAO CA NÀY TỒN TẠI, VÀ VÌ SAO TRƯỚC ĐÂY KHÔNG CÓ.
//   Frontend DD đã dự đoán đúng lỗi này bằng từng ấy chữ: `r.scored === false`
//   là VĨNH VIỄN true với một bài tự luận ở cả bảy trạng thái render (RS-0..RS-6), nên
//   một nhánh khoá theo nó "vẫn chạy và vẫn render thứ gì đó -- chỉ là nó
//   in nhãn `result.notAutoScored` cạnh một điểm vừa được chấm", và
//   kết luận "không crash, không cảnh báo, và không test sẵn có nào bắt được". Mệnh đề cuối
//   hoàn toàn đúng. FE2E-1(f) render `/result/detail`, nhưng chỉ với
//   `legacyResult()` -- fixture duy nhất mà nhãn ĐÚNG. Không ca nào render
//   route chi tiết với một bài tự luận đã chấm, nên sự mâu thuẫn không có test nào nhìn thấy.
//
//  Nó được phát hiện bởi lượt chạy dev L1 ngày 2026-08-30, trên một lượt làm đã chấm thật: thẻ
//   ghi "Not auto-scored" ở tiêu đề và "Scored - 1 / 1 point" ba
//   dòng bên dưới. Unit test cũng không thể tìm ra -- test của chính EssayReviewBlock
//   render khối đó khi cô lập, còn nhãn nằm ở TRANG bọc quanh nó. Chỉ
//   route đã ghép mới hiện cả hai cùng lúc.
//
//ROI: 90 (BV:10 x Freq:9 + Legal:0 + Defect:0 -- lỗi đã thành hiện thực)
//   BV 10 -- thẻ tự mâu thuẫn về sự thật duy nhất mà học sinh tới
//     trang để biết: bài trả lời này đã được chấm hay chưa.
//   Freq 9 -- mọi thẻ tự luận đã chấm, mọi lượt làm, của mọi học sinh.
// @lane: fixture-e2e
// @dependency: toàn UI trong tiến trình (RootLayout -> layout (exams) ->
//   result/detail/page.tsx), backend bị mock (stub getResult)
// @complexity: low
// @real-dependency: không có
describe("A graded essay card does not also claim to be unscored (FE2E-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits result.notAutoScored on a graded card while still showing the band, and keeps printing it on a card with no lifecycle key", async () => {
    // --- Thẻ đã chấm: có band, không có mâu thuẫn.
    const graded = await renderDetailRoute(resolvedResult());

    // Khẳng định dương TRƯỚC. Cây này chứa các async server component, nên một
    // lần render rỗng lặng lẽ sẽ làm mọi khẳng định phủ định bên dưới qua
    // trên hư không -- mối nguy AB-2/AB-3 mà file này đã ghi.
    expect(graded.container.textContent).toContain(DICT["result.essay.state.graded"]);

    // Chính lỗi đó.
    expect(graded.container.textContent).not.toContain(DICT["result.notAutoScored"]);

    // --- Đối ứng, trong CÙNG ca để không cái nào sửa được bằng cách phá
    //     cái kia: không có khoá vòng đời => nhãn vẫn đúng, và vẫn ở nguyên.
    const legacy = await renderDetailRoute(legacyResult());
    expect(legacy.container.textContent).toContain(DICT["result.notAutoScored"]);
    expect(legacy.container.textContent).not.toContain(DICT["result.essay.state.graded"]);
  });
});

// =============================================================================
// Task 08 — điểm vào SolutionEntryCard trên /result
//   (Frontend Early Verification Point)
// =============================================================================
// AC: PRD AC-010 (Reference Contract Value #1) — đúng một trong bốn nhãn
//   cho mỗi `myStatus`; AC-110 — dòng lý do hiện một lần cho bài bị xoá cứng qua
//   ModerationReasonBanner; AC-012 — tối đa một truy vấn bổ sung cho mỗi lần render.
// Cũng hoàn thành: frontend DD § Data Contracts `ResultCardSummary` "Zero
//   rows" (null -> không thẻ, không chỗ giữ chỗ) và § Test Boundaries "Zero-row
//   read branches"; backend DD § State Transitions/System Invariants
//   (`viewed_at` đơn điệu — chữ lý do đến từ đúng một lời gọi, không cache phía
//   client hay lượt đọc thứ hai).
// Proof Obligations (task file, nguyên văn các khẳng định): nhãn-theo-trạng-thái;
//   ca-null-không-hàng; số-đếm-tối-đa-một-truy-vấn-mỗi-lần-render.
// @lane: fixture-e2e
// @dependency: toàn UI trong tiến trình (RootLayout -> layout (exams) ->
//   result/page.tsx ghép SolutionEntryCard), mock getResultCardSummary
//   chỉ ở ranh giới module features/solutions/queries — trang, thẻ và
//   banner render thật (theo luật ranh giới mock sẵn có của file này).
// @real-dependency: không có
describe("SolutionEntryCard — result-page entry point (task 08)", () => {
  const REASON = "Vi phạm quy định cộng đồng.";

  beforeEach(() => {
    getResultCardSummaryMock.mockClear();
  });
  afterEach(cleanup);

  it.each([
    ["none (chua co bai)", null, DICT["solutions.entry.write"]],
    ["draft", "draft", DICT["solutions.entry.continue"]],
    ["published", "published", DICT["solutions.entry.edit"]],
    ["hidden", "hidden", DICT["solutions.entry.hidden"]],
  ] as const)(
    "myStatus=%s -> primary button label is exactly the Reference Contract string, zero [disabled] nodes",
    async (_label, myStatus, expectedLabel) => {
      const { container } = await renderResultRoute(
        legacyResult(),
        cardSummary({ myStatus: myStatus as SolutionStatus | null })
      );

      // DƯƠNG TRƯỚC (mối nguy 1, luật riêng của file này): chính thẻ
      // đã render, không phải một cây trống.
      expect(container.textContent).toContain(DICT["solutions.eyebrow"]);

      expect(
        within(container).getByRole("link", { name: expectedLabel })
      ).toBeTruthy();
      expect(disabledNodes(container)).toHaveLength(0);
    }
  );

  it("renders the one-time deletion-reason line exactly once via ModerationReasonBanner (role=status)", async () => {
    const { container } = await renderResultRoute(
      legacyResult(),
      cardSummary({ myStatus: null, unseenDeletionReason: REASON })
    );

    // Layout nhóm route đã mang vùng `role="status"` của riêng nó
    // (không liên quan tính năng này — cùng lưu ý mà FE2E-1 của file này ghi cho
    // `[aria-live="polite"]`), nên lọc theo chữ lý do thay vì
    // giả định banner là node `[role="status"]` duy nhất trên trang.
    const reasonBanners = Array.from(
      container.querySelectorAll('[role="status"]')
    ).filter((el) => el.textContent?.includes(REASON));

    expect(reasonBanners).toHaveLength(1);
    expect(reasonBanners[0].textContent).toBe(
      DICT["solutions.entry.deleted"].replace("{reason}", REASON)
    );
  });

  it("renders no SolutionEntryCard and no placeholder when getResultCardSummary resolves null (zero rows), while the rest of the result page still renders", async () => {
    // cardSummaryValue mặc định là `null` — nhánh không-hàng / không-đủ-điều-kiện.
    const { container } = await renderResultRoute(legacyResult());

    // DƯƠNG TRƯỚC: phần còn lại của trang là thật (mối nguy 1).
    expect(container.textContent).toContain(DICT["result.nextTitle"]);

    expect(container.textContent).not.toContain(DICT["solutions.eyebrow"]);
    expect(
      within(container).queryByRole("link", { name: DICT["solutions.entry.write"] })
    ).toBeNull();
    expect(disabledNodes(container)).toHaveLength(0);
  });

  it("calls getResultCardSummary exactly once per render, with this page's own examId", async () => {
    await renderResultRoute(legacyResult(), cardSummary());

    expect(getResultCardSummaryMock).toHaveBeenCalledTimes(1);
    expect(getResultCardSummaryMock).toHaveBeenCalledWith(EXAM_ID);
  });
});
