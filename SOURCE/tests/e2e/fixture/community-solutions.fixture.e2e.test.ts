// @vitest-environment jsdom

// Community Solutions [fixture-e2e] Bộ khung test
// Design Docs: docs/design/community-solutions-backend-design.md (v1.1),
//   docs/design/community-solutions-frontend-design.md (v1.1)
// UI Spec: docs/ui-spec/community-solutions-ui-spec.md
// PRD: docs/prd/community-solutions-prd.md (v1.3)
// Sinh ngày: 2026-09-17 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/1-2
//
// CHỈ LÀ SKELETON — ý định thiết kế dạng comment. Chưa có import, chưa có lời gọi driver,
// chưa có khẳng định. Đường dẫn chính xác này được cả hai design doc đặt tên trước (frontend
// DD § Fact Disposition Table, dòng "test-conventions": "một file
// tests/e2e/fixture/community-solutions.fixture.e2e.test.ts có thể được thêm
// về sau"). Theo tiền lệ SupportDriver tập-con-cấu-trúc-của-Playwright
// đã có trong làn này (SOURCE/tests/e2e/fixture/
// support-ticket-submission.fixture.e2e.test.ts, rating.fixture.e2e.test.ts,
// history.fixture.e2e.test.ts) — backend điều khiển bằng fixture (Server
// Action/truy vấn bị mock), không Supabase sống. Phải giữ xanh dưới
// tsc/eslint/build cho tới khi task cài đặt thêm import driver thật + module
// dữ liệu fixture + khẳng định trong cùng commit với tính năng UI.
//
// Ranh giới mock (frontend DD § Test Boundaries, bảng Mock Boundary Decisions):
// features/solutions/{queries,actions,adminActions}.ts bị mock ở ranh giới module
// bằng dữ liệu fixture, theo quy ước vi.mock toàn module sẵn có mà
// essay-auto-scoring.fixture.e2e.test.ts đã dùng.
// lib/solutions/identity.ts và RichText render THẬT (không mock) ở mọi
// màn hình mà file này điều khiển — cả hai tài liệu đều gọi tên chúng là ranh giới
// an toàn trọng yếu mà một test component/trình duyệt không được làm giả.

// =============================================================================
// Test J1 [SUẤT GIỮ CHỖ — hành trình nhiều bước hướng người dùng, luôn được phát
//   bất kể ROI] — Người nộp viết, đăng, và mở được bài giải cộng đồng
//   đã đăng của chính mình
// =============================================================================
// Hành trình người dùng (PRD R1-R2, R4-R7, R11-R12; bảng chuyển màn hình của UI Spec:
//   S-01 result page -> S-04 write screen ("Viết bài giải của bạn" CTA, no
//   bài giải hiện có) -> màn xem S-05, tới qua chính nút "Xem bài giải" ở thanh
//   dưới của màn viết, mà UI Spec nêu là chỉ xuất hiện khi bài giải của tôi
//   đã đăng, AC-030): một người dùng đã nộp bài, chưa có bài giải, mở trang kết quả,
//   thấy CTA viết ở thẻ lối vào bài giải, đi tới màn viết, điền một ghi chú >=15 từ
//   cho mỗi câu hiện hành, đăng, và — từ chính màn viết đó —
//   mở màn xem của chính bài giải đã đăng đó.
// ROI: 109 (BV:10 x Freq:9 + Legal:0 + Defect:9) — được giữ chỗ bất kể ROI:
//   đi qua tuần tự 3 ranh giới route riêng biệt (S-01 -> S-04 -> S-05),
//   trạng thái được mang qua các bước (ghi chú đã gõ + kết quả đăng quyết định
//   S-05 hiện gì), và hành trình có một điểm hoàn tất (bài giải đã đăng của chính mình
//   xem được), theo định nghĩa hành trình nhiều bước hướng người dùng của ngân sách Phase 4.
// Hành vi: đầu ra của mỗi bước ảnh hưởng render do fixture điều khiển của bước kế —
//   số từ nhập ở màn viết quyết định nút đăng có dùng được hay không trước khi
//   lời gọi đăng nào bắn, và kết quả đăng (fixture thành công) là thứ khiến
//   chuyển sang "Xem bài giải" của S-05 tới được (AC-030: nút đó vắng với một
//   bài giải chưa đăng).
// @category: core-functionality
// @lane: fixture-e2e
// @dependency: toàn bộ UI (backend bị mock) — dữ liệu fixture SolutionEntryCard,
//   SolutionEditorScreen, NoteEditor, SolutionPublishBar, SolutionViewScreen
// @complexity: high
// @real-dependency: không có cho file này — khẳng định bền vững DB thật
//   đằng sau "đăng thành công và bền" được chứng minh riêng trong
//   service-integration-e2e (Test SE1), phản chiếu Early Verification Point của chính
//   backend DD (Slice 2). Test này chỉ chứng minh chuỗi UI không
//   hỏng khi có backend fixture được cấu hình trả về thành công.
// Kiểu hỏng chính: một bước bất kỳ trong chuỗi lặng lẽ không làm gì (ví dụ
//   cú bấm nút "Đăng" không gọi setSolutionStatus của fixture,
//   hoặc một lần đăng thành công không làm nút "Xem bài giải" của màn viết
//   xuất hiện/điều hướng) — lớp hồi quy mà các test component/integration
//   cô lập không bắt được vì từng bước tự nó đều qua trong khi chuỗi nối giữa chúng hỏng.
// Nghĩa vụ chứng minh: mỗi trong 3 ranh giới được đi qua với đầu ra của bước
//   TRƯỚC ảnh hưởng quan sát được tới render do fixture điều khiển của bước SAU
//   (không phải 3 lần tải trang độc lập với một lần đặt lại ở giữa) — số từ
//   nhập ở bước viết phải phản ánh trong trạng thái bộ đếm trực tiếp/cổng đăng
//   trước khi lời gọi đăng bắn, và kết quả đăng phải là
//   thứ làm cho chuyển sang S-05 khả dụng ngay sau đó, không có
//   lần tải lại thủ công giữa các bước.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - trang kết quả S-01 (fixture: myStatus="none") hiện CTA viết, không phải một
//     trạng thái "published"/"draft"/"hidden" (bộ nhãn AC-010)
//   - màn viết S-04 render một hàng NoteEditor cho mỗi câu hiện hành;
//     gõ <15 từ ở bất kỳ hàng nào giữ nút đăng aria-disabled
//     với lý do aria-describedby; gõ >=15 từ ở mọi hàng gỡ
//     chặn đó
//   - bấm "Đăng" (Publish) với backend fixture cấu hình thành công
//     chuyển sang một xác nhận nhìn thấy được, không bao giờ hiện trạng thái
//     "published" lạc quan trước khi promise của fixture resolve
//   - thanh dưới của màn viết khi đó đưa ra "Xem bài giải" (AC-030),
//     điều hướng tới S-05, nơi render nội dung bài giải của chính người dùng này
//     từ phản hồi fixture sau-đăng — không phải từ state chỉ có ở client
//   - tiêu chí qua: cả bốn điểm kiểm đều đúng trong một phiên driver liên tục
//     (không đặt lại state cục bộ của test giữa các bước)

// -----------------------------------------------------------------------------
// DRIVER THẬT + DỮ LIỆU FIXTURE (task 23) — cài đặt Test J1
// -----------------------------------------------------------------------------
// Không có `@playwright/test` trong repo này (xem comment đầu file) — hình dạng thực thi
// duy nhất của làn này là render trong-tiến-trình cây route THẬT
// (tiền lệ essay-auto-scoring.fixture.e2e.test.ts): `ResultPage` ->
// `SolutionEditorPage` -> `SolutionViewPage`, mỗi trang được await và render
// bằng RTL, nối qua MỘT `FixtureStore` khả biến (communitySolutionsFixtureData.ts)
// thay vì ba fixture soạn tay độc lập — chính store khiến các lời gọi
// `saveSolution`/`setSolutionStatus` ở bước 2 quan sát được cấp cho
// render `getSolutionDetail` ở bước 3, theo Proof Obligation của chính test này.
//
// jsdom (không phải "node" mặc định của làn — xem vitest.fixture.config.ts) là
// bắt buộc từ file này trở đi cho render RTL; Test 2/Test 3 (truy vấn DOM
// theo chú thích của chính chúng ở trên) cũng cần nó.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copy, t } from "@/lib/copy";
import {
  FIFTEEN_WORD_NOTE,
  FIXTURE_ATTEMPT_ID,
  FIXTURE_EXAM_ID,
  SERVER_NOTE_PREFIX,
  SHORT_NOTE,
  T2_ANONYMOUS_AUTHOR_SCORE,
  T2_ANONYMOUS_REAL_AVATAR_URL,
  T2_ANONYMOUS_REAL_DISPLAY_NAME,
  T2_ANONYMOUS_SOLUTION_ID,
  T2_AVATAR_ORIGIN,
  T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME,
  T2_HIDDEN_SCORE_REAL_VALUE,
  T2_HIDDEN_SCORE_SOLUTION_ID,
  T2_NAMED_AUTHOR_AVATAR_URL,
  T2_NAMED_AUTHOR_DISPLAY_NAME,
  T2_NAMED_SOLUTION_ID,
  T2_COMMENTS_SOLUTION_ID,
  T2_COMMENT_NAMED_AVATAR_URL,
  T2_COMMENT_NAMED_BODY,
  T2_COMMENT_NAMED_DISPLAY_NAME,
  T2_COMMENT_ANONYMOUS_BODY,
  T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL,
  T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME,
  T2_COMMENT_WRITER_BODY,
  T2_COMMENT_WRITER_REAL_AVATAR_URL,
  T2_COMMENT_WRITER_REAL_DISPLAY_NAME,
  T3_XSS_COMMENT_AUTHOR_DISPLAY_NAME,
  T3_XSS_SOLUTION_ID,
  createFixtureStore,
  fixtureExam,
  fixtureExamResult,
  fixtureGetMySolutionForWriter,
  fixtureGetSolutionDetail,
  fixtureGetSolutionDetailForAnonymityCheck,
  fixtureListSolutionsForAnonymityCheck,
  fixtureResultCardSummary,
  fixtureSaveSolution,
  fixtureSetSolutionStatus,
  fixtureWriterState,
  type FixtureStore,
} from "./communitySolutionsFixtureData";

const {
  getResultMock,
  getMyRatingMock,
  getProfileMock,
  getResultCardSummaryMock,
  getMySolutionForWriterMock,
  getSolutionDetailMock,
  listSolutionsMock,
  getMyUnreadCommentCountMock,
  saveSolutionMock,
  setSolutionStatusMock,
  toggleHelpfulMock,
  setPinMock,
  getExamMock,
  getQuestionPartNumbersMock,
  isExamAuthorMock,
  generatePdfMock,
  redirectMock,
} = vi.hoisted(() => ({
  getResultMock: vi.fn(),
  getMyRatingMock: vi.fn(),
  getProfileMock: vi.fn(),
  getResultCardSummaryMock: vi.fn(),
  getMySolutionForWriterMock: vi.fn(),
  getSolutionDetailMock: vi.fn(),
  listSolutionsMock: vi.fn(),
  // task 29 (AC-091/AC-092): huy hiệu chưa đọc trên thẻ của chính mình ở S-03 — file
  // fixture này không bao giờ khẳng định một số đếm cụ thể, nên một `undefined` đã resolve
  // (bên dưới) giữ nguyên mọi khẳng định ảnh chụp/rò rỉ sẵn có; chỉ việc nó
  // có mặt như một export là quan trọng ở đây (page.tsx import nó vô điều kiện).
  getMyUnreadCommentCountMock: vi.fn(),
  saveSolutionMock: vi.fn(),
  setSolutionStatusMock: vi.fn(),
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
  getExamMock: vi.fn(),
  // Trang bài giải gọi `getQuestionPartNumbers` để chia bảng câu hỏi theo phần; file này
  // không khẳng định cách chia, nên một Map rỗng (không câu nào thuộc phần nào) là đủ.
  getQuestionPartNumbersMock: vi.fn().mockResolvedValue(new Map()),
  isExamAuthorMock: vi.fn(),
  generatePdfMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

// Ranh giới mock (frontend DD § Test Boundaries; comment đầu file của chính file này
// ở trên): features/solutions/{queries,actions} bị mock ở ranh giới
// module bằng dữ liệu fixture. features/exams/{queries,actions} và
// lib/auth/getCurrentUser là dữ liệu trang kết quả NGOÀI tính năng này, bị mock
// với cùng dạng factory mà essay-auto-scoring.fixture.e2e.test.ts dùng.
// lib/solutions/identity.ts và RichText KHÔNG BAO GIỜ bị mock ở bất kỳ đâu bên dưới —
// cả hai render thật trên mọi màn hình mà file này điều khiển.
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUserProfile: getProfileMock }));
vi.mock("@/features/exams/queries", () => ({
  getResult: getResultMock,
  getExam: getExamMock,
  getQuestionPartNumbers: getQuestionPartNumbersMock,
  isExamAuthor: isExamAuthorMock,
}));
vi.mock("@/features/exams/actions", () => ({ getMyRating: getMyRatingMock }));
// jsPDF + html2canvas không chạy trong jsdom (cùng ghi chú mà ranh giới
// mock của essay-auto-scoring ghi) — usePdfAction của ResultActions import cái này thật.
vi.mock("@/lib/pdf/generateAttemptPdf", () => ({
  generateAttemptPdfFile: generatePdfMock,
  downloadPdfFile: vi.fn(),
  canShareFile: () => false,
}));
vi.mock("@/features/solutions/queries", () => ({
  getResultCardSummary: getResultCardSummaryMock,
  getMySolutionForWriter: getMySolutionForWriterMock,
  getSolutionDetail: getSolutionDetailMock,
  listSolutions: listSolutionsMock,
  getMyUnreadCommentCount: getMyUnreadCommentCountMock,
}));
vi.mock("@/features/solutions/actions", () => ({
  saveSolution: saveSolutionMock,
  setSolutionStatus: setSolutionStatusMock,
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
}));

import ResultPage from "@/app/(exams)/exams/[id]/attempt/[attemptId]/result/page";
import SolutionEditorPage from "@/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page";
import SolutionViewPage from "@/app/(exams)/exams/[id]/solutions/[solutionId]/page";
import SolutionsListPage from "@/app/(exams)/exams/[id]/solutions/page";
import { renderServerTree } from "@/tests/helpers/renderServerTree";

beforeAll(() => {
  // jsdom không có scrollIntoView (cùng ghi chú như SolutionViewPage.test.tsx) —
  // effect deep-link của SolutionViewScreen gọi nó vô điều kiện khi mount.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  redirectMock.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

afterEach(() => {
  cleanup();
});

/** Mọi phần tử mang thuộc tính `disabled` gốc — luật của làn fixture
 * mà task này mang (UI-D25: chỉ aria-disabled, không bao giờ disabled gốc). */
function disabledNodes(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("[disabled]"));
}

/** Các phần tử `<img>` trong một cây con có `src` khớp một giá trị kỳ vọng CHÍNH XÁC —
 *  giới hạn theo từng hàng (helper truy vấn cây con của chính Test 2, dùng chung cho S-03/S-05)
 *  để avatar riêng của một hàng KHÁC không bao giờ vô tình thoả một
 *  phép kiểm có-mặt hay vắng-mặt làm trên hàng này. */
function imagesWithSrc(root: HTMLElement, src: string): Element[] {
  return Array.from(root.querySelectorAll(`img[src="${src}"]`));
}

/** `<section>` của chính `SolutionAuthorCard` (S-05) — `<section>` DUY NHẤT trên
 *  route này (`Breadcrumbs` render `<nav>`), cần thiết vì tên/nhãn của tác giả CŨNG
 *  được lặp vào breadcrumb của trang, điều sẽ khiến một `getByText` toàn trang
 *  mơ hồ (nhiều kết quả khớp) bất kể thẻ tự render gì. */
function authorCardSection(container: HTMLElement): HTMLElement {
  return container.querySelector("section") as HTMLElement;
}

/** Bằng chứng của riêng Test 3: không `<script>`, không thuộc tính `on*`,
 *  ở bất cứ đâu trong cây con cho trước — theo `assertSafe` của chính
 *  `RichText.xss.test.tsx` (làn unit), giới hạn ở đây trong một cây con của cây
 *  route THỰC SỰ đã render thay vì một lần render `<RichText/>` cô lập. Khẳng định chỉ trên DOM
 *  ĐÃ RENDER (không bao giờ chuỗi fixture thô), theo Proof Obligation của
 *  chính test này. Bằng chứng phân biệt ở pha RED (Investigation Notes):
 *  tạm đổi `RichText` bằng một double `dangerouslySetInnerHTML` thô
 *  làm nó ném lỗi ở cả cây con ghi chú lẫn cây con hàng bình luận;
 *  trả lại `RichText` thật làm nó qua lại. */
function assertPayloadInert(root: HTMLElement) {
  expect(root.querySelectorAll("script")).toHaveLength(0);
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      expect(
        attr.name.toLowerCase().startsWith("on"),
        `thuộc tính ${attr.name} trên <${el.tagName.toLowerCase()}> (Test 3 XSS payload)`
      ).toBe(false);
    }
  }
}

describe("J1 — write, publish, and open my own published community solution", () => {
  it("chains S-01 (write CTA) -> S-04 (gated publish, non-optimistic) -> S-05 (own published content), in one driver session", async () => {
    const store: FixtureStore = createFixtureStore();

    getResultMock.mockResolvedValue(fixtureExamResult());
    getMyRatingMock.mockResolvedValue(null);
    getProfileMock.mockResolvedValue({ id: "u1", displayName: "Người viết fixture", email: "a@b.c" });
    getResultCardSummaryMock.mockResolvedValue(fixtureResultCardSummary());
    getExamMock.mockResolvedValue(fixtureExam());
    isExamAuthorMock.mockResolvedValue(false);
    // Gắn với CÙNG store suốt phiên — được S-05 đọc lại
    // sau khi S-04 đăng, nên `own`/`editHref` ở đó phản ánh đúng thứ màn ghi
    // đã tạo ra, không phải một giá trị soạn độc lập.
    getMySolutionForWriterMock.mockImplementation(() =>
      Promise.resolve(fixtureGetMySolutionForWriter(store))
    );
    saveSolutionMock.mockImplementation(
      (_examId: string, patch: { notes: { questionId: string; body: string }[] }) =>
        Promise.resolve(fixtureSaveSolution(store, patch))
    );
    setSolutionStatusMock.mockImplementation((_examId: string, action: "publish" | "draft") =>
      fixtureSetSolutionStatus(store, action)
    );
    getSolutionDetailMock.mockImplementation((solutionId: string) =>
      Promise.resolve(fixtureGetSolutionDetail(store, solutionId))
    );

    // ── S-01: trang kết quả, myStatus="none" — CTA viết, không phải tiếp tục/sửa/ẩn (AC-010) ──
    //
    // `ScoreCard` là Server Component async có con async của riêng nó
    // (cùng mối nguy mà comment đầu của essay-auto-scoring.fixture.e2e.test.ts
    // ghi lại) — `render(await ResultPage(...))` của RTL bị treo và trả về
    // một cây RỖNG ở đây, nên chỉ MỘT điểm kiểm này dùng `renderServerTree`
    // (S-01 không cần tương tác — chỉ đọc href/chữ/role).
    const resultJsx = await ResultPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, attemptId: FIXTURE_ATTEMPT_ID }),
    });
    const resultScreen = await renderServerTree(resultJsx);
    // ĐỐI CHỨNG DƯƠNG TRƯỚC (cùng mối nguy): chứng minh trang thực sự đã render trước
    // khi bất kỳ khẳng định phủ định nào bên dưới được phép mang ý nghĩa.
    expect(resultScreen.container.textContent).toContain(t("result.nextTitle"));
    const writeLink = within(resultScreen.container).getByRole("link", {
      name: copy["solutions.entry.write"],
    });
    const writeHref = writeLink.getAttribute("href");
    expect(writeHref).toBe(`/exams/${FIXTURE_EXAM_ID}/attempt/${FIXTURE_ATTEMPT_ID}/solution`);
    expect(resultScreen.container.textContent).not.toContain(copy["solutions.entry.continue"]);
    expect(resultScreen.container.textContent).not.toContain(copy["solutions.entry.edit"]);
    expect(resultScreen.container.textContent).not.toContain(copy["solutions.entry.hidden"]);
    expect(disabledNodes(resultScreen.container)).toHaveLength(0);

    // ── S-04: màn viết, tới qua CHÍNH href của CTA S-01 ──
    const editorJsx = await SolutionEditorPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, attemptId: FIXTURE_ATTEMPT_ID }),
    });
    const editor = render(editorJsx);

    const questionRows = screen.getAllByRole("button", { name: /^Câu \d,/ });
    expect(questionRows).toHaveLength(2);
    expect(disabledNodes(editor.container)).toHaveLength(0);

    const publishButton = () => screen.getByRole("button", { name: t("solutions.bar.publish") });
    const publishReason = () => {
      const id = publishButton().getAttribute("aria-describedby");
      return document.getElementById(id ?? "");
    };

    // Hàng 2 trước: >=15 từ chỉ ở MỘT hàng là chưa đủ khi hàng 1 vẫn
    // rỗng — cổng đọc mọi hàng hiện hành, không chỉ một.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 2,/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: FIFTEEN_WORD_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByRole("button", { name: "Câu 2, đã ghi chú" });

    expect(publishButton().getAttribute("aria-disabled")).toBe("true");
    expect(publishReason()?.textContent).toBe(t("solutions.bar.remaining", { count: 1, total: 2 }));

    // Hàng 1 với <15 từ: một ghi chú NGẮN không giống như không có ghi chú,
    // nhưng cả hai đều không gỡ cổng — "bất kỳ hàng nào dưới 15 từ" vẫn đúng.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: SHORT_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByRole("button", { name: "Câu 1, chưa đủ 15 từ" });

    expect(publishButton().getAttribute("aria-disabled")).toBe("true");
    expect(publishReason()?.textContent).toBe(t("solutions.bar.remaining", { count: 1, total: 2 }));

    // Hàng 1 nâng lên >=15 từ: mọi hàng hiện hành giờ gỡ được cổng.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1,/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: FIFTEEN_WORD_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByRole("button", { name: "Câu 1, đã ghi chú" });

    expect(publishButton().getAttribute("aria-disabled")).toBe("false");
    expect(publishReason()?.textContent).toBe(t("solutions.bar.ready", { total: 2 }));
    expect(disabledNodes(editor.container)).toHaveLength(0);

    // Đăng — không lạc quan (Kiểu hỏng chính: một UI lạc quan sẽ
    // lật sang "published" trước khi setSolutionStatus của fixture resolve).
    // Fixture resolve ở ranh giới microtask, không bao giờ đồng bộ, nên một
    // phép kiểm làm trong CÙNG tick đồng bộ với cú bấm — không có `await`
    // giữa chúng — vẫn phải quan sát được trạng thái trước-khi-đăng.
    fireEvent.click(publishButton());
    expect(screen.queryByText(t("status.published"))).toBeNull();
    expect(screen.getByRole("button", { name: t("solutions.bar.publishing") })).toBeTruthy();

    const viewLink = await screen.findByRole("button", { name: t("solutions.bar.viewMine") });
    expect(screen.getByText(t("status.published"))).toBeTruthy();
    expect(setSolutionStatusMock).toHaveBeenCalledWith(FIXTURE_EXAM_ID, "publish");
    expect(store.status).toBe("published");

    const viewHref = viewLink.getAttribute("href");
    // Lỗi mà điểm kiểm này sinh ra để bắt: một lần đăng thành công
    // nhưng không bao giờ luồn solutionId vừa tạo trở lại state client
    // để lại liên kết này trỏ vào "#" mãi mãi — AC-030 hứa một liên kết CHẠY ĐƯỢC
    // "Xem bài giải" link, not a dead one (see SolutionEditorScreen.tsx fix,
    // Investigation Notes).
    expect(viewHref).not.toBe("#");
    expect(viewHref).toBe(`/exams/${FIXTURE_EXAM_ID}/solutions/${store.solutionId}`);
    expect(disabledNodes(editor.container)).toHaveLength(0);
    cleanup();

    // ── S-05: điều hướng qua CHÍNH href "Xem bài giải" của màn viết ──
    const solutionIdFromHref = viewHref?.split("/").pop() ?? "";
    expect(solutionIdFromHref).toBe(store.solutionId);

    const viewJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: solutionIdFromHref }),
      searchParams: Promise.resolve({}),
    });
    const viewScreen = render(viewJsx);

    expect(getSolutionDetailMock).toHaveBeenCalledWith(solutionIdFromHref);
    // Bài giải của chính mình (AC-062): một SỐ ĐẾM hữu ích, không phải nút hữu ích — một lần
    // render chỉ-state-client cũng không biết được `isMine` nếu không có lượt lấy này.
    expect(screen.getByText(t("solutions.view.helpfulCount", { count: 0 }))).toBeTruthy();

    const serverNote = `${SERVER_NOTE_PREFIX}${FIFTEEN_WORD_NOTE}`;
    fireEvent.click(screen.getByRole("button", { name: "Câu 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Câu 2" }));
    // Cả hai hàng hiện thân ghi chú do SERVER của fixture đóng dấu — một chuỗi
    // chỉ có thể đến từ phản hồi getSolutionDetail của lần render này, không bao giờ
    // từ bất kỳ vọng lại chỉ-ở-client nào của thứ đã gõ ở S-04.
    expect(screen.getAllByText(serverNote)).toHaveLength(2);
    expect(disabledNodes(viewScreen.container)).toHaveLength(0);
  });
});

// =============================================================================
// Test 2 [suất bổ sung, ROI >= 20] — Hàng tác giả/bình luận ẩn danh không bao giờ
//   render tên, avatar, hay điểm trong DOM trình duyệt
// =============================================================================
// AC: "Khi show_profile của một bài giải là false... bỏ author_id, tên hiển thị
//   tác giả, và đường dẫn avatar tác giả khỏi mọi payload" (AC-039, M5);
//   "Khi is_anonymous của một bình luận là true... bỏ author_id, tên hiển thị,
//   đường dẫn avatar... trừ một cờ boolean 'có phải người viết bài giải không'"
//   (AC-105, D42); EARS của frontend DD: "hệ thống phải render AuthorIdentity
//   là {kind:'anonymous'} và không bao giờ truyền displayName/avatarUrl... cho
//   bất kỳ component nào."
// ROI: 79 (BV:10 x Freq:7 + Legal:0 + Defect:9)
// Hành vi: danh sách bài giải (S-03), chi tiết (S-05), và sheet bình luận
//   (O-02) được render với các hàng fixture gồm cả một bài giải/bình luận CÓ TÊN
//   và một ẨN DANH -> DOM đã render của hàng ẩn danh không chứa
//   chữ tên tác giả nào, không ảnh avatar nào trỏ tới URL avatar thật
//   của fixture, và (với hàng show_score=false bị che) không giá trị điểm nào
//   -> DOM của hàng có tên hiện đúng tên/avatar/điểm của nó.
// @category: edge-case
// @lane: fixture-e2e
// @dependency: toàn bộ UI (backend bị mock) — dữ liệu fixture SolutionList,
//   SolutionAuthorCard, CommentItem, AnonymousAvatar
// @complexity: medium
// @real-dependency: không có — các hàng fixture được dựng tay khớp dạng
//   RPC đã che (trường danh tính null); việc RPC THẬT có thực sự trả về
//   dạng đó hay không chỉ được chứng minh trong service-integration-e2e (Test SE2), không phải
//   ở đây — test này chứng minh phản ứng của UI với một hàng đã che sẵn, theo
//   frontend DD § Test Boundaries ("test component frontend không bao giờ khẳng định
//   tính đúng của việc che ở mức SQL").
// Kiểu hỏng chính: một component render row.author_display_name
//   trực tiếp (bỏ qua mapper AuthorIdentity/union phân biệt), nên
//   tên thật của một hàng fixture ẩn danh rò vào DOM ngay khi một
//   lần sửa sau này tái đưa vào việc đọc trường thô — rủi ro mà cả hai tài liệu thiết kế
//   gọi là rủi ro hàng đầu của tính năng này.
// Nghĩa vụ chứng minh: truy vấn DOM đã render (không phải props/state nội bộ của
//   component) cho thẻ/mục của hàng ẩn danh và khẳng định vắng
//   chuỗi tên hiển thị fixture của tác giả có tên ở bất kỳ đâu trong cây con của nó,
//   vắng <img> trỏ tới URL avatar thật của fixture, và
//   có mặt marker dự phòng của AnonymousAvatar thay vào đó; lặp lại cho hàng
//   có tên, khẳng định có mặt danh tính của chính nó.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - danh sách bài giải S-03: hàng ẩn danh không hiện tên/avatar; hàng có tên
//     hiện cả hai
//   - chi tiết S-05 / sheet bình luận O-02: tương tự cho một bình luận ẩn danh, cộng
//     huy hiệu boolean "có phải người viết bài giải" render khi áp dụng,
//     không có rò rỉ danh tính nào khác đi kèm
//   - một hàng show_score=false: không huy hiệu/giá trị điểm nào được render ở bất kỳ đâu trong
//     cây con của hàng đó
//   - tiêu chí qua: không lần xuất hiện nào của chuỗi tên/avatar/điểm thật của fixture
//     trong cây con đã render của hàng ẩn danh, trên mọi màn hình
//     được kiểm

// -----------------------------------------------------------------------------
// DỮ LIỆU FIXTURE THẬT — phần Test 2 S-03 (danh sách) + S-05 (chi tiết) (task 24),
// cộng phần O-02 (sheet bình luận) (task 30) — Test 2 giờ đã hoàn chỉnh.
// -----------------------------------------------------------------------------
describe("Test 2 — anonymous author and hidden score never leak into rendered DOM (S-03, S-05, O-02)", () => {
  beforeAll(() => {
    // `isAllowedImageUrl` của `components/shared/QuestionFigure.ts` chỉ cho một
    // `<img>` render với URL khớp origin này — cùng origin fixture mà
    // `AuthorIdentity.test.tsx` dùng. Thiếu nó, avatar của chính hàng CÓ TÊN
    // cũng sẽ không render, khiến khẳng định "không <img> nào khớp" của hàng ẩn danh
    // đúng một cách rỗng nghĩa thay vì là bằng chứng thật.
    process.env.NEXT_PUBLIC_SUPABASE_URL = T2_AVATAR_ORIGIN;
  });

  beforeEach(() => {
    getExamMock.mockResolvedValue(fixtureExam());
    isExamAuthorMock.mockResolvedValue(false);
    getMySolutionForWriterMock.mockResolvedValue(
      fixtureWriterState({ solutionId: T2_NAMED_SOLUTION_ID, status: "published" })
    );
    listSolutionsMock.mockResolvedValue(fixtureListSolutionsForAnonymityCheck());
    getSolutionDetailMock.mockImplementation((solutionId: string) =>
      Promise.resolve(fixtureGetSolutionDetailForAnonymityCheck(solutionId))
    );
    // own.status là "published" ở trên, nên page.tsx CÓ gọi cái này — huy hiệu của
    // task 29 nằm ngoài các khẳng định rò rỉ của file này (0 -> không huy hiệu).
    getMyUnreadCommentCountMock.mockResolvedValue(0);
  });

  it("S-03 solutions list: each row's OWN subtree shows only what that row is allowed to show", async () => {
    const listJsx = await SolutionsListPage({ params: Promise.resolve({ id: FIXTURE_EXAM_ID }) });
    render(listJsx);

    // Ranh giới hàng (Nghĩa vụ chứng minh: truy vấn DOM đã render cho cây con của
    // "thẻ của hàng ẩn danh...") — liên kết phủ-cả-thẻ của mỗi hàng
    // được tìm theo CHÍNH tên truy cập được của nó, rồi tổ tiên `<li>` của nó là
    // cây con mà mọi khẳng định bên dưới giới hạn vào. Một rò rỉ ở hàng KHÁC
    // không thể vô tình thoả phép kiểm vắng-mặt làm trên hàng này.
    const namedRow = screen
      .getByRole("link", { name: t("solutions.card.openLabel", { name: T2_NAMED_AUTHOR_DISPLAY_NAME }) })
      .closest("li") as HTMLElement;
    const anonymousRow = screen
      .getByRole("link", {
        name: t("solutions.card.openLabel", { name: t("solutions.identity.anonymous") }),
      })
      .closest("li") as HTMLElement;
    const hiddenScoreRow = screen
      .getByRole("link", {
        name: t("solutions.card.openLabel", { name: T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME }),
      })
      .closest("li") as HTMLElement;

    // Hàng có tên hiện đúng danh tính thật CỦA NÓ — chứng minh kỹ thuật ở trên
    // không rỗng nghĩa (một hàng CÓ THỂ hiện tên/avatar trong cùng lần render này).
    expect(within(namedRow).getByText(T2_NAMED_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(imagesWithSrc(namedRow, T2_NAMED_AUTHOR_AVATAR_URL)).toHaveLength(1);

    // Hàng ẩn danh: có "Ẩn danh"; tên/avatar THẬT có thể đã rò
    // (T2_ANONYMOUS_REAL_* — xem tài liệu fixture) vắng khỏi cây con NÀY. Điểm
    // vẫn hiện (show_score độc lập với show_profile) — chỉ ẩn danh thôi thì không được
    // đồng thời làm trống một điểm thật.
    expect(within(anonymousRow).getByText(t("solutions.identity.anonymous"))).toBeTruthy();
    expect(within(anonymousRow).queryByText(T2_ANONYMOUS_REAL_DISPLAY_NAME)).toBeNull();
    expect(imagesWithSrc(anonymousRow, T2_ANONYMOUS_REAL_AVATAR_URL)).toHaveLength(0);
    expect(
      within(anonymousRow).getByText(`${T2_ANONYMOUS_AUTHOR_SCORE.toFixed(1)} ${t("result.outOfTen")}`)
    ).toBeTruthy();

    // Hàng ẩn điểm: tên của chính nó hiện bình thường (việc che danh tính không bị đụng
    // ở đây); không huy hiệu/giá trị điểm nào ở bất kỳ đâu trong cây con CỦA NÓ.
    expect(within(hiddenScoreRow).getByText(T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(within(hiddenScoreRow).queryByText(new RegExp(t("result.outOfTen")))).toBeNull();
    expect(within(hiddenScoreRow).queryByText(String(T2_HIDDEN_SCORE_REAL_VALUE))).toBeNull();
  });

  it("S-05 solution detail: SolutionAuthorCard subtree repeats the same guarantees, per solution", async () => {
    const namedJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_NAMED_SOLUTION_ID }),
      searchParams: Promise.resolve({}),
    });
    const namedScreen = render(namedJsx);
    const namedCard = authorCardSection(namedScreen.container);
    expect(within(namedCard).getByText(T2_NAMED_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(imagesWithSrc(namedCard, T2_NAMED_AUTHOR_AVATAR_URL)).toHaveLength(1);
    cleanup();

    const anonymousJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_ANONYMOUS_SOLUTION_ID }),
      searchParams: Promise.resolve({}),
    });
    const anonymousScreen = render(anonymousJsx);
    const anonymousCard = authorCardSection(anonymousScreen.container);
    expect(within(anonymousCard).getByText(t("solutions.identity.anonymous"))).toBeTruthy();
    expect(within(anonymousCard).queryByText(T2_ANONYMOUS_REAL_DISPLAY_NAME)).toBeNull();
    expect(imagesWithSrc(anonymousCard, T2_ANONYMOUS_REAL_AVATAR_URL)).toHaveLength(0);
    expect(
      within(anonymousCard).getByText(`${T2_ANONYMOUS_AUTHOR_SCORE.toFixed(1)} ${t("result.outOfTen")}`)
    ).toBeTruthy();
    cleanup();

    const hiddenScoreJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_HIDDEN_SCORE_SOLUTION_ID }),
      searchParams: Promise.resolve({}),
    });
    const hiddenScoreScreen = render(hiddenScoreJsx);
    const hiddenScoreCard = authorCardSection(hiddenScoreScreen.container);
    expect(within(hiddenScoreCard).getByText(T2_HIDDEN_SCORE_AUTHOR_DISPLAY_NAME)).toBeTruthy();
    expect(within(hiddenScoreCard).queryByText(new RegExp(t("result.outOfTen")))).toBeNull();
    expect(within(hiddenScoreCard).queryByText(String(T2_HIDDEN_SCORE_REAL_VALUE))).toBeNull();
    cleanup();
  });

  it("O-02 comment sheet: named/anonymous/writer-anonymous comment rows each show only what they are allowed to show", async () => {
    // Deep link `?q=1&comments=1` (task 21/28) — mở CommentSheet thật của màn hình
    // cho câu hỏi duy nhất của bài giải này KHÔNG cần bấm nút nào,
    // theo chỉ dẫn "hoặc... hoặc" của chính task này.
    const commentsJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T2_COMMENTS_SOLUTION_ID }),
      searchParams: Promise.resolve({ q: "1", comments: "1" }),
    });
    render(commentsJsx);

    // Chờ thân bình luận CÓ TÊN của chính nó cũng chờ hết
    // "loading" chunk-state (RichText nạp động, AC-103) — the sheet renders no
    // hàng bình luận nào trước khi cái này resolve.
    await screen.findByText(T2_COMMENT_NAMED_BODY);
    const sheet = screen.getByRole("dialog", { name: `${t("solutions.comments.title")} · ${t("upload.questionLabel", { number: 1 })}` });

    // Ranh giới hàng (cùng kỹ thuật như S-03/S-05 ở trên): mỗi hàng bình luận được
    // tìm theo CHÍNH chữ thân của nó, rồi `.closest("li")` (phần tử gốc của CommentItem)
    // là cây con mà mọi khẳng định bên dưới giới hạn vào.
    const namedRow = within(sheet).getByText(T2_COMMENT_NAMED_BODY).closest("li") as HTMLElement;
    const anonymousRow = within(sheet).getByText(T2_COMMENT_ANONYMOUS_BODY).closest("li") as HTMLElement;
    const writerRow = within(sheet).getByText(T2_COMMENT_WRITER_BODY).closest("li") as HTMLElement;

    // Hàng có tên hiện đúng danh tính thật CỦA NÓ — chứng minh kỹ thuật ở trên
    // không rỗng nghĩa, giống mốc S-03/S-05.
    expect(within(namedRow).getByText(T2_COMMENT_NAMED_DISPLAY_NAME)).toBeTruthy();
    expect(imagesWithSrc(namedRow, T2_COMMENT_NAMED_AVATAR_URL)).toHaveLength(1);
    expect(within(namedRow).queryByText(t("solutions.comments.writerBadge"))).toBeNull();

    // Hàng ẩn danh: có "Ẩn danh"; tên/avatar THẬT có thể đã rò
    // (T2_COMMENT_ANONYMOUS_REAL_*) vắng khỏi cây con NÀY; không có
    // huy hiệu "Người viết" (người bình luận này không phải người viết bài giải).
    expect(within(anonymousRow).getByText(t("solutions.identity.anonymous"))).toBeTruthy();
    expect(within(anonymousRow).queryByText(T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME)).toBeNull();
    expect(imagesWithSrc(anonymousRow, T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL)).toHaveLength(0);
    expect(within(anonymousRow).queryByText(t("solutions.comments.writerBadge"))).toBeNull();

    // Writer row: "Người viết" badge renders (AC-105/D42) alongside "Ẩn danh"
    // — người bình luận này VỪA là người viết bài giải VỪA ẩn danh — không có
    // rò rỉ danh tính KHÁC đi kèm (tên/avatar thật đằng sau hàng NÀY
    // cũng vắng, giống Required Test #3 của CommentItem.test.tsx, nay
    // được chứng minh qua màn hình render thật thay vì component bị mock).
    expect(within(writerRow).getByText(t("solutions.identity.anonymous"))).toBeTruthy();
    expect(within(writerRow).getByText(t("solutions.comments.writerBadge"))).toBeTruthy();
    expect(within(writerRow).queryByText(T2_COMMENT_WRITER_REAL_DISPLAY_NAME)).toBeNull();
    expect(imagesWithSrc(writerRow, T2_COMMENT_WRITER_REAL_AVATAR_URL)).toHaveLength(0);
    cleanup();
  });
});

// =============================================================================
// Test 3 [suất bổ sung, ROI >= 20] — Markdown ghi chú/bình luận độc hại
//   render thành nội dung vô hại qua RichText, không bao giờ thực thi
//   (ranh giới ADR-0002 — prompt điều phối yêu cầu có >=1
//   skeleton test chứng minh ranh giới này, không chỉ nêu trong tài liệu)
// =============================================================================
// ADR: docs/adr/ADR-0002-published-content-rendering-and-sanitization.md —
//   đường render duy nhất được phê duyệt cho thân ghi chú/bình luận. Bổ sung cho
//   (không lặp lại) các bổ sung fixture
//   SOURCE/components/shared/__tests__/RichText.xss.test.tsx của làn unit mà cả hai
//   design doc nêu trong Integration Verification Points (M8) — file đó chứng minh sanitizer
//   của RichText khi cô lập; test này chứng minh cùng ranh giới ở mức render
//   trình duyệt đầy đủ, qua màn xem S-05 thật và sheet bình luận O-02,
//   hai bề mặt render markdown do người dùng viết đầu tiên mà tính năng này đưa vào.
// ROI: 41 (BV:8 x Freq:4 + Legal:0 + Defect:9)
// Hành vi: một fixture ghi chú bài giải và một fixture bình luận đều chứa
//   một payload XSS đã biết (ví dụ một thử chèn markdown-HTML <script>/onerror=)
//   -> khối ghi chú của S-05 và thân bình luận của O-02 đều render
//   qua RichText -> DOM kết quả không chứa phần tử <script> thực thi được,
//   không URL javascript:, và không thuộc tính on* nào xuất phát từ
//   payload.
// @category: edge-case
// @lane: fixture-e2e
// @dependency: toàn bộ UI (backend bị mock) — dữ liệu fixture SolutionNoteBlock, CommentItem;
//   RichText render thật (không mock, theo Mock Boundary
//   Decisions)
// @complexity: low
// @real-dependency: RichText.tsx render không mock trong test này (Mock Boundary
//   Decisions của frontend DD: "RichText trong test component render
//   nội dung ghi chú/bình luận — Không — dùng component thật... hành vi XSS/sanitize
//   phải được thực thi thật, không được giả định").
// Kiểu hỏng chính: một thay đổi về sau ở đường render ghi chú/bình luận
//   bỏ qua RichText (ví dụ một lối tắt dangerouslySetInnerHTML thô), hoặc
//   sanitizer của RichText thoái lui, để script của payload thực thi hay
//   tồn tại như markup sống trong DOM.
// Nghĩa vụ chứng minh: khẳng định trên DOM ĐÃ RENDER (không phải chuỗi fixture thô)
//   rằng nội dung <script>/event-handler của payload vắng mặt dưới dạng markup
//   thực thi được — không phần tử <script> khớp nào tồn tại, không phần tử nào
//   mang thuộc tính onerror/onclick của payload — độc lập cho
//   cả đường render thân ghi chú (S-05, render ở server) và
//   đường render thân bình luận (O-02, RichText import động theo UI-D10).
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - thân ghi chú ở màn xem bài giải S-05: payload render thành chữ
//     vô hại/markup an toàn; 0 phần tử <script>; 0 thuộc tính on* từ
//     payload
//   - thân bình luận ở sheet bình luận O-02: tương tự, kiểm độc lập (một
//     chỗ gọi render khác với thân ghi chú)
//   - tiêu chí qua: cả hai đường render không có bằng chứng markup thực thi được
//     nào từ fixture payload dùng chung

// -----------------------------------------------------------------------------
// DRIVER THẬT + DỮ LIỆU FIXTURE (task 31) — cài đặt Test 3. Dùng lại CÙNG
// dây nối `getSolutionDetailMock` (`fixtureGetSolutionDetailForAnonymityCheck`)
// mà Test 2 đã thiết lập — thêm một id bài giải (`T3_XSS_SOLUTION_ID`) vào
// cùng bảng tra, không phải một cơ chế fixture thứ hai.
// -----------------------------------------------------------------------------
describe("Test 3 — malicious note/comment markdown renders inert through RichText (S-05, O-02)", () => {
  beforeEach(() => {
    getExamMock.mockResolvedValue(fixtureExam());
    isExamAuthorMock.mockResolvedValue(false);
    getMySolutionForWriterMock.mockResolvedValue(
      fixtureWriterState({ solutionId: T2_NAMED_SOLUTION_ID, status: "published" })
    );
    getSolutionDetailMock.mockImplementation((solutionId: string) =>
      Promise.resolve(fixtureGetSolutionDetailForAnonymityCheck(solutionId))
    );
  });

  it("S-05 note body and O-02 comment body each render the shared payload as inert markup, independently", async () => {
    // Deep link `?q=1&comments=1` (cùng kỹ thuật với ca O-02 của Test 2):
    // hàng 1 mở KÈM thân ghi chú đã có sẵn trong cây (`defaultOpen`, không cần
    // bấm) VÀ CommentSheet mount cho cùng câu hỏi, trong MỘT lần
    // render — cả hai bề mặt được thực thi trong CÙNG phiên driver, theo
    // Boundary cần thực thi của chính task này ("render đầy đủ cây route của S-05
    // với O-02 đã mở").
    const viewJsx = await SolutionViewPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, solutionId: T3_XSS_SOLUTION_ID }),
      searchParams: Promise.resolve({ q: "1", comments: "1" }),
    });
    render(viewJsx);

    // S-05: cây con của chính SolutionNoteBlock, tìm theo nhãn eyebrow duy nhất của nó
    // (`.closest("section")` — KHÔNG phải truy vấn toàn-container mà
    // `authorCardSection` của Test 2 dùng, vì lần render NÀY cũng mở một khối ghi chú,
    // tức một `<section>` riêng biệt cạnh section của SolutionAuthorCard).
    const noteLabel = screen.getByText(t("solutions.view.solutionLabel"));
    const noteBlock = noteLabel.closest("section") as HTMLElement;
    assertPayloadInert(noteBlock);

    // O-02: RichText import động của CommentSheet — await chunk
    // (cùng mối nguy mà ca O-02 của Test 2 ghi: không có hàng bình luận nào để
    // truy vấn trước khi cái này resolve) trước khi giới hạn vào cây con của hàng bình luận,
    // tìm theo tên tác giả của nó (cùng quy ước truy vấn cây con
    // như Test 2) — không bao giờ theo chuỗi payload thô (Nghĩa vụ chứng minh: khẳng định
    // trên DOM đã render, không phải chuỗi fixture).
    const sheet = await screen.findByRole("dialog", {
      name: `${t("solutions.comments.title")} · ${t("upload.questionLabel", { number: 1 })}`,
    });
    await within(sheet).findByText(T3_XSS_COMMENT_AUTHOR_DISPLAY_NAME);
    const commentRow = within(sheet)
      .getByText(T3_XSS_COMMENT_AUTHOR_DISPLAY_NAME)
      .closest("li") as HTMLElement;
    assertPayloadInert(commentRow);

    cleanup();
  });
});
