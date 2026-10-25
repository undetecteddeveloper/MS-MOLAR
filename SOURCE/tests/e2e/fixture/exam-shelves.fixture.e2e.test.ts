// @vitest-environment jsdom

// Kho đề theo kệ (Exam Shelves) — FIXTURE-E2E lane skeleton
// Design Docs: docs/design/exam-shelves-frontend-design.md (v1.0, § Test Plan :405-417,
//                "the ONE new fixture file", ranh giới mock :417)
//              docs/design/exam-shelves-backend-design.md (v1.2, § Implementation Path
//                Mapping — hasBrowseParam(sp), vị từ rẽ nhánh AC-008/AC-010)
// UI Spec:     docs/ui-spec/exam-shelves-ui-spec.md (v1.1, § Screens S-01/S-02,
//                § Page State Matrix hàng #1-#10, § Component: ExamShelf)
// PRD:         docs/prd/exam-shelves-prd.md (v1.2, AC-001-AC-004, AC-007-AC-010,
//                AC-013, AC-026, AC-032, AC-033, AC-051)
// ADR:         docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
// Sinh ngày:   2026-09-18 | Ngân sách đã dùng: fixture-e2e 2/3 (1 suất giữ chỗ + 1
//                bổ sung, ROI >= 20). Suất thứ 3 cố ý để trống — không
//                ứng viên nào khác vừa được Test Plan của chính các Design Doc nêu tên
//                vừa chưa được phủ ở chỗ khác trong đợt sinh này.
//
// =============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// CẢ HAI ỨNG VIÊN BÊN DƯỚI LÀ SKELETON (`it.todo`). `ExamShelf.tsx`, `ExamRibbon.tsx`,
// `ExamShelfTile`, `features/exams/queries/shelves.ts` và `lib/exams/browseParams.ts`
// CHƯA TỒN TẠI (Existing Codebase Analysis của frontend DD — mọi dòng đều "New" hoặc
// "External dep"). File này KHÔNG import gì từ chúng: import một module chưa
// tồn tại sẽ làm hỏng `tsc --noEmit`/`eslint`/`build` ngay khi skeleton này
// được commit. Nó phải giữ xanh dưới cả ba cổng cho tới khi task cài đặt
// (frontend DD Implementation Plan lát cắt 5, "điểm tích hợp") thêm các import thật,
// phép ghép cây route và các khẳng định trong cùng commit.
//
// LÀN NÀY CHẠY THẾ NÀO: `npm run test:fixture` (từ `SOURCE/`), tức
// `vitest run --config vitest.fixture.config.ts`. Config đó glob CẢ
// thư mục (`tests/e2e/fixture/**/*.test.{ts,tsx}`) và loại sáu file ĐÍCH DANH
// (`vitest.fixture.config.ts:45-52`) — file này không nằm trong đó, nên nó được
// THU THẬP TỪ LÚC ĐƯỢC COMMIT và không cần sửa config. Một file được thu thập
// mà không có task test nào làm vitest báo "No test suite found in file" và
// thoát mã 1 (sự kiện đã đo, ghi trong comment đầu của chính config đó) — đây
// chính là lý do cả hai ứng viên bên dưới mang lời gọi `it.todo(...)` thật, không bao giờ
// comment trần, và vì sao file này KHÔNG được thêm vào danh sách loại của config đó.
//
// Dòng 1 ở trên là `// @vitest-environment jsdom` — `vitest.fixture.config.ts:43` đặt
// `environment: "node"`, và `renderServerTree()` cần `document`. Tiền lệ:
// `essay-auto-scoring.fixture.e2e.test.ts:1`, `RichText.regression.test.tsx:1`.
//
// -----------------------------------------------------------------------------
// RANH GIỚI MOCK — nêu một lần, áp dụng cho cả hai ứng viên (frontend DD § Test Plan,
// dòng "Mock boundary", quyết định nguyên văn)
// -----------------------------------------------------------------------------
// MOCK — `listExamShelves`, `listExamFacets`, `getCurrentUser` (fixture dựng
//   tay, theo frontend DD).
// KHÔNG VỚI TỚI — `features/exams/actions` (không lượt làm nào được bắt đầu từ
//   làn này — dù sao cũng không bấm được dưới `renderServerTree()`, xem
//   ghi chú mối nguy bên dưới; cây render đã ghép không bao giờ tới module này, nên
//   nó không bị mock).
// THẬT — `lib/copy.ts` và mọi tra cứu từ điển (khẳng định đọc các chuỗi
//   tiếng Việt đã phân giải, ví dụ `copy["exams.shelfHotTitle"]`, không bao giờ khoá thô hay
//   literal tiếng Anh); `ExamShelf`, `ExamCard`, `ExamRibbon`, `ExamFilters`, cả hai
//   layout `ExamBrowser`, `subjectLabel`, `hasBrowseParam` (import thật để
//   vị từ rẽ nhánh đang kiểm là CHÍNH đoạn code mà trang gọi, không phải bản
//   chép tay cài lại danh sách mười khoá).
// KHÔNG DATABASE, KHÔNG MẠNG, KHÔNG MSW — làn này không cần `HAS_LIVE_DB` cũng không cần
//   thông tin đăng nhập Supabase sống nào; nó chỉ chứng minh ghép UI trên dữ liệu fixture.
// @real-dependency: không có.
//
// -----------------------------------------------------------------------------
// MỘT MỐI NGUY KHIẾN MỘT CA XANH VÔ NGHĨA — đọc trước khi viết khẳng định
// -----------------------------------------------------------------------------
// QUA RỖNG TRÊN CÂY TRỐNG. `render(await Component())` trả về một CÂY TRỐNG khi
// server component được await có con async, và mọi
// `expect(queryBy…).toBeNull()` viết trên nó QUA TRÊN HƯ KHÔNG.
// `ExamsPage`, `ExamShelf` và `ExamCard` đều async VÀ `ExamCard` render
// `AuthorByline` async, nên file này rơi thẳng vào mối nguy mà mục Containment Rule
// của chính frontend DD nêu tên. Mọi ca bên dưới PHẢI dùng
// `renderServerTree()` (import nguyên văn: `import { renderServerTree } from
// "@/tests/helpers/renderServerTree";` — KHÔNG phải đường dẫn cũ mà comment của một số file
// fixture cũ hơn trích) VÀ mang ít nhất một khẳng định DƯƠNG (một tiêu đề kệ hay tiêu đề
// thẻ thực sự tìm thấy trong cây) trước mọi khẳng định phủ định, để một cây
// trống luôn đỏ, không bao giờ qua thầm lặng.
//
// -----------------------------------------------------------------------------
// CHỌN LỌC — vì sao hai cái này
// -----------------------------------------------------------------------------
//   Ứng viên 1   109  /exams trần = 3 kệ ⇄ bất kỳ tham số nào trong danh sách = lưới phẳng   <- GIỮ CHỖ
//                      (hành trình nhiều bước hướng người dùng có ROI cao nhất: S-01 ⇄ S-02,
//                      trạng thái = sự có mặt của tham số URL, điểm hoàn tất = nhánh đúng
//                      được render — stateDiagram-v2 của UI Spec). Được phát
//                      bất kể ngưỡng; nó cũng vượt ngưỡng với biên lớn.
//   Ứng viên 2    56  một kệ mà lựa chọn cho 0 thẻ vắng hoàn toàn
//                      ở mức trang đã render (AC-051/AC-013)             <- bổ sung,
//                      ROI 56 >= sàn 20.
//   KHÔNG ĐƯỢC CHỌN (ngoài phạm vi agent này, hoặc đã được phủ ở chỗ khác):
//     - Giống hệt từng byte của việc chứa trong ExamCard (AC-043) — làn Component,
//       `ExamCard.snapshot.test.tsx`, không đặt tên `.int.`/`.fixture.e2e.`/`.service.e2e.`;
//       xem báo cáo bàn giao.
//     - Lượt lấy có cổng ở trang chủ (`/`) (F-001, AC-036-038) — Test
//       Plan của chính frontend DD KHÔNG nêu file fixture-e2e nào cho khối trang chủ; F-001 được
//       chứng minh ở làn Integration (`shelves.int.test.ts` Ứng viên 2, cùng
//       đợt sinh này) theo cách giao của chính backend DD.
//     - Tiếp cận được bằng bàn phím (AC-047) — Success Criteria #8, một lượt
//       THỦ CÔNG đã ghi (bàn phím + TalkBack); repo này không có phụ thuộc axe và không
//       thêm (Quality Assurance Mechanisms của frontend DD).

import { describe, expect, it, vi } from "vitest";

// =============================================================================
// RANH GIỚI MOCK (cài đặt) — các nguồn dữ liệu theo khai báo Test Plan của frontend DD,
// cộng các shim framework và hai module Server Action
// được với tới (không bao giờ được gọi — không thể bấm dưới `renderServerTree()`) qua
// các import tĩnh của SiteHeader/SupportWidget. Cùng hình dạng ghép như
// `essay-auto-scoring.fixture.e2e.test.ts`, ca duy nhất khác trong làn này
// thực sự chạy hôm nay (D005) — bắt chước sát thay vì
// phát minh lại, vì nó là tiền lệ đã chứng minh duy nhất cho RootLayout -> layout (exams)
// -> page trong repo này.
// =============================================================================

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/font/google", () => {
  const font = (options: { variable?: string }) => ({
    variable: options.variable ?? "",
    className: "",
  });
  return { Lexend: font };
});
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
// `ExamFilters` (client, render ở CẢ HAI nhánh) và `SiteHeader`/`BottomNav`/
// `SupportWidget` (AppShell) đều đọc các hook này khi mount.
vi.mock("next/navigation", () => ({
  usePathname: () => "/exams",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
// SkipLink là Server Component async — được stub vì cùng lý do
// `(exams)/__tests__/layout.test.tsx` và `essay-auto-scoring.fixture.e2e.test.ts`
// stub nó (nằm ngoài mọi khẳng định mà file này đưa ra; nó đứng trước navbar).
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));
// Chỉ được với tới qua import tĩnh HeaderProfile của SiteHeader và import tĩnh
// SupportWidgetDialog của SupportWidget. Chính `SupportWidget`
// trả về `null` cho người dùng chưa đăng nhập (chốt `user === null`,
// `SupportWidget.tsx:40`), nên export của cả hai module không bao giờ được gọi ở đây.
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));

const {
  listExamShelvesMock,
  listExamsRankedMock,
  listExamFacetsMock,
  getCurrentUserMock,
  getCurrentUserProfileMock,
} = vi.hoisted(() => ({
  listExamShelvesMock: vi.fn(),
  listExamsRankedMock: vi.fn(),
  listExamFacetsMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getCurrentUserProfileMock: vi.fn(),
}));

vi.mock("@/features/exams/queries/shelves", () => ({
  listExamShelves: listExamShelvesMock,
}));
vi.mock("@/features/exams/queries", () => ({
  listExamsRanked: listExamsRankedMock,
  listExamFacets: listExamFacetsMock,
}));
// `getCurrentUser` (page.tsx) và `getCurrentUserProfile` (AppShell) chung một
// module — cả hai được stub thành người dùng chưa đăng nhập để `readEntitlement(null)`
// THẬT, KHÔNG mock đi đường nhanh không I/O (`readEntitlement.ts:61`)
// thay vì với tới Supabase/Redis, giữ lời hứa KHÔNG DATABASE/KHÔNG
// MẠNG của làn này mà không cần mock thứ ba. `readEntitlement`/`AppShell` giữ THẬT
// theo Mock boundary của frontend DD ("cả hai layout").
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: getCurrentUserMock,
  getCurrentUserProfile: getCurrentUserProfileMock,
}));

import { renderServerTree } from "@/tests/helpers/renderServerTree";
import RootLayout from "@/app/layout";
import Layer2Layout from "@/app/(exams)/layout";
import ExamsPage from "@/app/(exams)/exams/page";
import { copy } from "@/lib/copy";
import type { Exam } from "@/types/exam";

function makeExam(overrides: Partial<Exam> & { id: string }): Exam {
  return {
    title: `Đề ${overrides.id}`,
    questionIds: ["q1"],
    durationMinutes: 45,
    subject: "Math",
    grade: 10,
    ...overrides,
  };
}

const FACETS = { subjects: [], grades: [], schools: [], years: [], semesters: [] };

/** Fixture khởi động nguội của Ứng viên 1 — cả ba kệ đều đủ điều kiện. */
const THREE_SHELVES_FIXTURE = {
  practice: {
    subject: "Chemistry",
    exams: [makeExam({ id: "practice-1", subject: "Chemistry" })],
  },
  hot: {
    rung: "grade-recent" as const,
    grade: 10,
    exams: [makeExam({ id: "hot-1" }), makeExam({ id: "hot-2" })],
  },
  explore: {
    exams: [makeExam({ id: "explore-1" }), makeExam({ id: "explore-2" })],
  },
  submittedExamIds: new Set<string>(),
};

/** Fixture cold-start của Ứng viên 2 — CÙNG các kệ hot/explore như
 *  Ứng viên 1 (ghi chú "Behavior" của chính skeleton: "cùng phép ghép cây route
 *  như Ứng viên 1 được render, lần này với listExamShelves
 *  stub thành một fixture mà dữ liệu kệ luyện tập là null ... trong khi hot
 *  và explore đều đủ điều kiện"); chỉ `practice` khác. */
const COLD_START_FIXTURE = { ...THREE_SHELVES_FIXTURE, practice: null };

/** `pageCount: 2` là chịu lực — `ExamPagination` trả về `null` khi
 *  `pageCount <= 1` (`ExamPagination.tsx:62`), và nghĩa vụ (g) đòi ca
 *  lưới-phẳng chứng minh phần tử `<nav>` phân trang THỰC SỰ có mặt,
 *  chứ không chỉ là không bao giờ bị khẳng định ngược vì nó không bao giờ render. */
const RANKED_FIXTURE = {
  exams: [makeExam({ id: "ranked-1" }), makeExam({ id: "ranked-2" })],
  page: 1,
  pageCount: 2,
  total: 12,
  submittedExamIds: new Set<string>(),
};

/** Mọi `<section>` kệ trong cây, theo thứ tự DOM. */
function shelfSections(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("section[aria-labelledby^='shelf-']"));
}

/** `<nav>` PHÂN TRANG nói riêng — chỉ `container.querySelector("nav")`
 *  là vô nghĩa trong cây route đã ghép này: `SiteHeader` mang
 *  `<nav aria-label="Điều hướng phụ">` thường trực của nó và `BottomNav` có
 *  `<nav aria-label="...">` riêng, cả hai có mặt ở mọi lần render bất kể
 *  nhánh. Chỉ `<nav>` của `ExamPagination` mang nhãn đã phân giải này. */
function paginationNav(container: HTMLElement): Element | null {
  return container.querySelector(`nav[aria-label="${copy["exams.pagination"]}"]`);
}

async function renderExamsRoute(searchParams: Record<string, string | undefined>) {
  const page = await ExamsPage({ searchParams: Promise.resolve(searchParams) });
  return renderServerTree(
    await RootLayout({ children: await Layer2Layout({ children: page }) })
  );
}

// =============================================================================
// Ứng viên 1 — SUẤT GIỮ CHỖ (hành trình). /exams trần render ba kệ theo
// thứ tự; bất kỳ tham số nào trong mười tham số URL được liệt kê — kể cả các ca
// phân tích ra undefined — render lưới phẳng thay vào đó, và không bao giờ cả hai
// =============================================================================
// AC-001: "...nó chứa mọi kệ đủ điều kiện...và — vô điều kiện,
//   bất kể cái gì đủ điều kiện — 0 thể hiện của lưới phẳng và 0 ExamPagination."
// AC-002: "...nó chứa tối đa 10 phần tử ExamCard."
// AC-003: "...DOM order is Cần luyện → Nổi nhất → Khám phá..."
// AC-004: "...nó mang icon lucide của nó..., một tiêu đề h2, một dòng phụ đề, và —
//   for Cần luyện and Nổi nhất — a right-aligned Xem tất cả link; the Khám phá
//   kệ kết thúc bằng ô Xem toàn bộ kho đề thay vào đó." [Kỹ sư 2026-09-19:
//   the Xem tất cả links were removed; only icon/h2/subtitle + the Khám phá tile remain.]
// AC-007: "...không cái nào mất hay đổi kích thước một phần tử so với hôm nay."
// AC-008: "Cho một request mang bất kỳ một trong q, subject, grade, school, year,
//   semester, sort, level, dir, page, khi trang render, thì 0 section kệ
//   xuất hiện và ExamBrowser + ExamPagination render đúng như hôm nay."
// AC-009/AC-010: "...một giá trị ?sort= không nhận ra...render theo thứ tự
//   cá nhân hoá hôm nay...và 0 kệ xuất hiện."
// AC-026: "...đúng 1 thẻ (hạng 1) mang ruy băng Hot nhất và hạng 2-10
//   mang 0 ruy băng."
// AC-032: "...mục cuối của nó là ô Xem toàn bộ kho đề..."
// AC-033: "...it contains Bộ lọc, Mới nhất, Cũ nhất, Khó nhất...plus 1 new chip
//   Nổi nhất; the four existing chips gain 0 changed props."
// R-3 của Frontend DD: "Nhánh viết dựa trên các biến cục bộ đã chuẩn hoá thay vì khoá
//   thô, nên ?dir=asc hay ?sort=bogus render kệ | High | Medium | Nhánh
//   uỷ quyền cho hasBrowseParam(sp)...ca fixture phủ ?sort=hot, và ?dir /
//   ?page=2 được nêu trong AC-010."
// ROI: 109 (BV:10 x Freq:10 + Legal:0 + Defect:9)
//   BV 10 — đây CHÍNH LÀ bề mặt người dùng chính của tính năng; hành trình suất-giữ-chỗ
//     theo Multi-Step User Journey Definition (2 trạng thái route riêng biệt, trạng thái =
//     sự có mặt của tham số URL được mang qua chuyển đổi, điểm hoàn tất = nhánh
//     đúng được render — stateDiagram-v2 của chính UI Spec, S01 ⇄ S02).
//   Freq 10 — mọi lượt vào /exams mặc định của học sinh đã đăng nhập, và mọi tương tác lọc/
//     sắp xếp/tìm kiếm làm các kệ lùi xuống.
//   Defect 9 — R-3 được nêu tường minh là tác động High/xác suất Medium, với
//     ĐÚNG kiểu hỏng mà ứng viên này dựng để bắt: một vị từ rẽ nhánh
//     viết dựa trên các biến cục bộ đã phân tích (là `undefined` cho CẢ "vắng mặt"
//     lẫn "có mặt nhưng rác") không phân biệt được hai ca, nên `?sort=garbage`,
//     `?page=abc` và `?dir=asc` sẽ lặng lẽ render kệ thay vì lưới
//     phẳng — sai với một URL mà người dùng có thể đánh dấu, chia sẻ hay sửa tay.
// Hành vi: RootLayout -> layout (exams) -> ExamsPage được ghép trong tiến trình với
//   listExamShelves/listExamFacets/getCurrentUser stub thành dữ liệu fixture ->
//   render với 0 searchParams -> 3 phần tử <section> xuất hiện theo thứ tự DOM
//   practice→hot→explore, 0 <ul> ExamBrowser và 0 <nav> ExamPagination, <=10 thẻ
//   mỗi hàng, đúng 1 [data-slot="ribbon"] cả trang (ở hạng 1 của hot), ô
//   Khám phá có mặt như <li> cuối của hàng và không ở đâu khác, và hàng chip mang
//   4 chip sắp xếp gồm "Nổi nhất" -> CÙNG phép ghép được render lại, lần này
//   với từng tham số trong một tập đại diện (?sort=hot, ?sort=garbage,
//   ?page=abc, ?dir=asc) trên searchParams -> mỗi cái render 0 phần tử <section>
//   kệ và cây ExamBrowser + ExamPagination thay vào đó.
// @category: core-functionality
// @lane: fixture-e2e
// @dependency: toàn UI trong tiến trình (RootLayout -> layout (exams) ->
//   app/(exams)/exams/page.tsx), backend bị mock (stub listExamShelves/listExamFacets/
//   getCurrentUser), hasBrowseParam thật, từ điển thật
// @complexity: high
// @real-dependency: không có
// Kiểu hỏng chính: vị từ rẽ nhánh của /exams được viết dựa trên các biến cục bộ đã phân tích
//   `sort`/`page`/`dir` (mỗi cái `undefined`/`NaN` cho cả "vắng mặt" lẫn
//   "có mặt nhưng rác") thay vì phép kiểm sự-có-mặt-của-khoá-thô của `hasBrowseParam(sp)`,
//   nên `?sort=garbage`, `?page=abc` hay `?dir=asc` render nhánh kệ
//   — một trang mà người dùng tới được bằng sửa tay hoặc đánh dấu một URL lặng lẽ hiện
//   bề mặt sai, không lỗi và không dấu hiệu nhìn thấy nào rằng có gì sai.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) DƯƠNG TRƯỚC (mối nguy cây trống): lần render /exams trần thực sự
//       tạo ra markup — chữ tiêu đề `h2` của một kệ (ví dụ
//       `exams.shelfHotTitle` đã phân giải) tìm thấy qua `getByText`/`container.textContent`.
//       Mọi khẳng định bên dưới chỉ có ý nghĩa khi cái này qua.
//   (b) đúng 3 phần tử `<section aria-labelledby="shelf-...">` theo thứ tự DOM
//       practice, hot, explore (chỉ các kệ đủ điều kiện dưới dữ liệu của fixture
//       mới có mặt — dựng fixture sao cho cả ba đều đủ điều kiện cho ứng viên này;
//       ca kệ-0-thẻ là việc của Ứng viên 2, không phải của cái này);
//   (c) 0 phần tử khớp container danh sách riêng của lưới phẳng và 0 phần tử `<nav>`
//       phân trang ở bất kỳ đâu trong cây (AC-001);
//   (d) mỗi hàng kệ chứa tối đa 10 thẻ `<li>` (AC-002), và đúng 1
//       `[data-slot="ribbon"]` tồn tại trong TOÀN BỘ trang (AC-026), nằm bên trong
//       thẻ đầu tiên của kệ hot — không chỉ "ít nhất 1";
//   (e) the Khám phá row's last `<li>` is the "Xem toàn bộ kho đề" tile, and no
//       hàng của kệ khác nào chứa ô đó (AC-032);
//   (f) hàng chip chứa đúng 4 phần tử chip sắp xếp, gồm một cái mà
//       resolved text is `exams.sortHot` = "Nổi nhất" (AC-033);
//   (g) DẠNG BẢNG, cùng test hoặc một `describe.each`: với MỖI
//       `{ sort: "hot" }`, `{ sort: "garbage" }`, `{ page: "abc" }`, `{ dir: "asc" }`
//       trên `searchParams`, render lại CÙNG phép ghép và khẳng định 0 phần tử `<section>`
//       kệ tồn tại và cây lưới phẳng (container danh sách của nó +
//       `<nav>` phân trang) có mặt thay vào đó — đây là chốt hồi quy R-3,
//       và `?sort=garbage`/`?page=abc`/`?dir=asc` là các ca phân-tích-ra-undefined
//       mà một vị từ dựa trên biến cục bộ làm sai trong khi một vị từ
//       sự-có-mặt-khoá-thô làm đúng.
describe("Bare /exams renders three shelves; any listed URL parameter renders the flat grid instead, including parsed-to-undefined values (AC-001-004, AC-007-010, AC-026, AC-032, AC-033, R-3)", () => {
  it("bare /exams (0 searchParams): 3 <section> shelves in DOM order practice→hot→explore, 0 flat-grid list, 0 pagination <nav>, <=10 cards/row, exactly 1 ribbon page-wide on hot rank 1, Khám phá tile only as the last <li> of its own row, chip row has 4 chips incl. Nổi nhất (obligations a-f)", async () => {
    listExamShelvesMock.mockResolvedValue(THREE_SHELVES_FIXTURE);
    listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
    listExamFacetsMock.mockResolvedValue(FACETS);
    getCurrentUserMock.mockResolvedValue(null);
    getCurrentUserProfileMock.mockResolvedValue(null);

    const { container } = await renderExamsRoute({});

    // (a) DƯƠNG TRƯỚC (mối nguy cây trống): một tiêu đề kệ thật đã
    // được phân giải và render, trước khi bất kỳ khẳng định phủ định nào được tin.
    expect(container.textContent).toContain(copy["exams.shelfHotTitle"]);

    // (b) đúng 3 kệ, thứ tự DOM practice -> hot -> explore (AC-003).
    const sections = shelfSections(container);
    expect(sections.map((s) => s.getAttribute("aria-labelledby"))).toEqual([
      "shelf-practice",
      "shelf-hot",
      "shelf-explore",
    ]);
    const [practiceSection, hotSection, exploreSection] = sections;

    // (c) 0 container danh sách lưới phẳng, 0 <nav> phân trang ở bất kỳ đâu (AC-001).
    expect(container.querySelector("ul.grid")).toBeNull();
    expect(paginationNav(container)).toBeNull();

    // (d) <=10 thẻ mỗi hàng kệ (AC-002); đúng 1 ruy băng cả trang, ở
    // thẻ đầu tiên của kệ hot (AC-026).
    for (const section of sections) {
      expect(section.querySelectorAll("ul > li").length).toBeLessThanOrEqual(10);
    }
    expect(container.querySelectorAll('[data-slot="ribbon"]')).toHaveLength(1);
    const hotCards = hotSection.querySelectorAll("ul > li");
    expect(hotCards[0].querySelector('[data-slot="ribbon"]')).not.toBeNull();

    // (e) the Khám phá row's last <li> is the "Xem toàn bộ kho đề" tile, and
    // không hàng của kệ khác nào chứa nó (AC-032).
    const exploreCards = exploreSection.querySelectorAll("ul > li");
    const lastExploreCard = exploreCards[exploreCards.length - 1];
    expect(lastExploreCard.querySelector('a[href="/exams?page=1"]')).not.toBeNull();
    expect(lastExploreCard.textContent).toContain(copy["exams.shelfViewAllStore"]);
    expect(container.querySelectorAll('a[href="/exams?page=1"]')).toHaveLength(1);
    expect(practiceSection.querySelector('a[href="/exams?page=1"]')).toBeNull();
    expect(hotSection.querySelector('a[href="/exams?page=1"]')).toBeNull();

    // (f) the chip row carries exactly 4 sort chips, incl. Nổi nhất (AC-033).
    const sortChips = container.querySelectorAll("button[aria-pressed]");
    expect(sortChips).toHaveLength(4);
    expect(
      Array.from(sortChips).some((chip) => chip.textContent === copy["exams.sortHot"])
    ).toBe(true);
  });

  it.each([
    { name: "?sort=hot", params: { sort: "hot" } },
    { name: "?sort=garbage", params: { sort: "garbage" } },
    { name: "?page=abc", params: { page: "abc" } },
    { name: "?dir=asc", params: { dir: "asc" } },
  ])(
    "$name renders 0 shelf <section> elements and the flat-grid + pagination tree instead — the parsed-to-undefined R-3 regression guard (obligation g)",
    async ({ params }) => {
      listExamShelvesMock.mockResolvedValue(THREE_SHELVES_FIXTURE);
      listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
      listExamFacetsMock.mockResolvedValue(FACETS);
      getCurrentUserMock.mockResolvedValue(null);
      getCurrentUserProfileMock.mockResolvedValue(null);

      const { container } = await renderExamsRoute(params);

      // DƯƠNG TRƯỚC (mối nguy cây trống): cây lưới phẳng thực sự
      // có mặt với nội dung thật, không chỉ "không phải các kệ".
      const grid = container.querySelector("ul.grid");
      expect(grid).not.toBeNull();
      expect(grid?.textContent).toContain(RANKED_FIXTURE.exams[0].title);
      expect(paginationNav(container)).not.toBeNull();

      // Nghĩa vụ (g): 0 phần tử <section> kệ ở bất kỳ đâu (chốt R-3).
      expect(shelfSections(container)).toHaveLength(0);
    }
  );
});

// =============================================================================
// Ứng viên 2 — Một kệ mà lựa chọn cho 0 thẻ vắng hoàn toàn khỏi
// trang đã render, ở mọi breakpoint mà phép ghép render
// =============================================================================
// AC-051: "Cho một kệ bất kỳ, khi lựa chọn riêng của nó cho 0 thẻ, thì kệ đó
//   vắng hoàn toàn khỏi trang — 0 tiêu đề, 0 phụ đề, 0 chỗ giữ chỗ, 0
//   thẻ rỗng, 0 lỗi — và các kệ còn lại giữ thứ tự tương đối
//   (D8). AC-013 và AC-024 là hai ví dụ được đặt tên của luật này, không phải
//   định nghĩa của nó."
// AC-013: "Cho một học sinh có 0 lượt làm đã nộp, hoặc có lượt đã nộp
//   nhưng 0 lượt đại diện đã chấm, khi /exams render, thì lựa chọn Cần luyện
//   cho 0 thẻ và kệ vắng theo AC-051, và Nổi nhất
//   đứng đầu."
// UI Spec Page State Matrix hàng #5: "Đã đăng nhập, 0 lượt làm đã nộp (không có
//   grade) | Nổi nhất → Khám phá | Cần luyện (AC-013) | ..."
// ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
//   BV 8 — đây là user story cold-start được PRD nêu tên ("Là học sinh mới
//     chưa có lịch sử, tôi muốn một trang dùng được ở lần ghé đầu tiên, để tôi không bị hiện
//     một trạng thái rỗng hay một chẩn đoán giả") — một chỗ giữ chỗ nhìn thấy được hay một
//     tiêu đề ma ở đây chính là kiểu hỏng mà story đó loại trừ.
//   Freq 6 — mọi học sinh lần-đầu / cold-start, một phân khúc nhỏ hơn nhưng được PRD nêu tên và
//     khác biệt về cấu trúc so với dân số trạng thái ổn định mà Ứng viên 1
//     đã phủ.
//   Defect 8 — kiểu hỏng (một `<section>` rỗng-nhưng-có-mặt, hoặc một tiêu đề
//     không có thẻ nào bên dưới) chính là điều mà hợp đồng `null`-so-với-`{exams:[]}`
//     phân biệt của frontend DD (shelves.int.test.ts Ứng viên 2, cùng
//     đợt sinh này) sinh ra để ngăn ở tầng dữ liệu; ứng viên này chứng minh
//     TRANG thực sự thu hẹp theo nó (`data && <ExamShelf .../>`), điều mà một
//     khẳng định ở mức phép ghép một mình không cho thấy được.
// Hành vi: cùng phép ghép cây route như Ứng viên 1 được render, lần này
//   với listExamShelves stub thành một fixture mà dữ liệu kệ luyện tập là
//   null (cold-start: 0 lượt đại diện đã chấm) trong khi hot và explore đều
//   đủ điều kiện -> trang chứa 0 phần tử tham chiếu kệ luyện tập (không
//   id "shelf-practice", không chữ `exams.shelfPracticeTitle`, không thẻ giữ chỗ
//   nét đứt) và đúng 2 phần tử <section>, theo thứ tự hot rồi explore.
// @category: edge-case
// @lane: fixture-e2e
// @dependency: toàn UI trong tiến trình (RootLayout -> layout (exams) ->
//   app/(exams)/exams/page.tsx), backend bị mock (stub listExamShelves trả về
//   practice: null)
// @complexity: medium
// @real-dependency: không có
// Kiểu hỏng chính: phép thu hẹp `SHELF_ORDER.map` của trang (`data && <ExamShelf
//   .../>`) được viết thành một biểu thức ba ngôi với nhánh dự phòng rỗng-nhưng-vẫn-render, hoặc
//   chính `ExamShelf` được gọi với `exams: []` thay vì nơi gọi bỏ qua nó
//   hoàn toàn, nên một tiêu đề + phụ đề (hoặc một thẻ rỗng nét đứt) xuất hiện cho một kệ
//   mà học sinh không có dữ liệu — đúng "chẩn đoán giả" mà user story
//   cold-start của PRD cấm.
// Nghĩa vụ chứng minh — test được cài đặt phải khẳng định gì:
//   (a) DƯƠNG TRƯỚC: tiêu đề kệ hot và explore đều tìm thấy trong
//       cây đã render, chứng minh phép ghép đã render trước khi bất kỳ
//       khẳng định phủ định nào được tin;
//   (b) 0 phần tử có `id="shelf-practice"` hay `aria-labelledby="shelf-practice"`
//       tồn tại ở bất kỳ đâu trong tài liệu, và chuỗi
//       `exams.shelfPracticeTitle` đã phân giải xuất hiện Ở ĐÂU CŨNG KHÔNG trong
//       `container.textContent` (phụ đề của kệ luyện tập đã bị xoá 2026-09-19);
//   (c) đúng 2 phần tử `<section>` kệ tồn tại, theo thứ tự DOM hot rồi explore
//       (D8 — "các kệ còn lại giữ thứ tự tương đối");
//   (d) 0 phần tử thẻ nét đứt/giữ chỗ tồn tại thay cho kệ bị thiếu —
//       khẳng định tổng số thẻ cả trang bằng đúng tổng số thẻ của fixture
//       hot và explore, để một thẻ giữ chỗ lạc bị bắt bằng số đếm
//       dù nó không mang tên class dễ nhận ra nào.
describe("A shelf whose selection yields 0 cards is entirely absent from the rendered page — no header, no subtitle, no placeholder (AC-051, AC-013, cold-start user story)", () => {
  it("cold-start fixture (practice shelf data = null): 0 nodes reference shelf-practice, exactly 2 <section> shelves render in order hot→explore, and the total card count equals exactly the hot+explore fixtures' card counts (obligations a-d)", async () => {
    listExamShelvesMock.mockResolvedValue(COLD_START_FIXTURE);
    listExamsRankedMock.mockResolvedValue(RANKED_FIXTURE);
    listExamFacetsMock.mockResolvedValue(FACETS);
    getCurrentUserMock.mockResolvedValue(null);
    getCurrentUserProfileMock.mockResolvedValue(null);

    const { container } = await renderExamsRoute({});

    // (a) DƯƠNG TRƯỚC (mối nguy cây trống): tiêu đề của cả hai kệ còn lại
    // thực sự được tìm thấy trước khi bất kỳ khẳng định phủ định nào được tin.
    expect(container.textContent).toContain(copy["exams.shelfHotTitle"]);
    expect(container.textContent).toContain(copy["exams.shelfExploreTitle"]);

    // (b) 0 node tham chiếu shelf-practice ở bất kỳ đâu — id, aria-labelledby,
    // hay các chuỗi copy đã phân giải.
    expect(container.querySelector("#shelf-practice")).toBeNull();
    expect(container.querySelector('[aria-labelledby="shelf-practice"]')).toBeNull();
    expect(container.textContent).not.toContain(copy["exams.shelfPracticeTitle"]);

    // (c) đúng 2 kệ, thứ tự DOM hot rồi explore (D8).
    const sections = shelfSections(container);
    expect(sections.map((s) => s.getAttribute("aria-labelledby"))).toEqual([
      "shelf-hot",
      "shelf-explore",
    ]);

    // (d) 0 thẻ giữ chỗ/nét đứt thay cho kệ bị thiếu: tổng số
    // <li> dưới hàng của hai kệ còn lại bằng đúng số thẻ của
    // fixture cộng ô duy nhất mà hàng Khám phá luôn mang
    // (ô "Xem toàn bộ kho đề") — một phần tử lạc bị bắt bằng số đếm
    // bất kể nó có mang tên class dễ nhận ra hay không.
    const totalListItems = sections.reduce(
      (sum, section) => sum + section.querySelectorAll("ul > li").length,
      0
    );
    const expectedListItems =
      COLD_START_FIXTURE.hot.exams.length + COLD_START_FIXTURE.explore.exams.length + 1;
    expect(totalListItems).toBe(expectedListItems);
  });
});
