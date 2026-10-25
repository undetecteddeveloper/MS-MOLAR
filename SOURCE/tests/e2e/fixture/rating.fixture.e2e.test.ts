// Rating System [fixture-e2e]
// Design Docs: docs/design/rating-system-backend-design.md, docs/design/rating-system-frontend-design.md
// UI Spec: docs/design/rating-system-ui-spec.md
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026)
//
// Test FE1 (lối vào đánh giá ở trang kết quả) được chuyển đổi bên dưới — xem mục
// FE1 phía dưới file này để biết interface driver và ghi chú đầu mục của riêng nó. 2026-07-27: FE1 từng
// chứng minh một hành trình modal-tự-mở (RatingModal/RatingModalController, sau là RatingEntry);
// lối vào đánh giá của trang Kết quả nay điều hướng thẳng tới trang độc lập /exams/[id]/rate
// thay vì đó, nên toàn bộ bề mặt dialog/tự-mở (và dấu ?rate=auto
// điều khiển nó) không còn tồn tại — FE1 được viết lại cho khớp.
//
//Test FE2 được chuyển đổi bên dưới thành một script thật dựa trên driver. Repo này không có
// phụ thuộc `@playwright/test` và chưa commit playwright.config.ts nào
// (chỉ máy chủ tự động hoá trình duyệt Playwright MCP được cấu hình, trong
// `.mcp.json`, cho các phiên tương tác/thủ công — xem Test Boundaries của frontend Design
// Doc: "Playwright MCP / lượt thủ công (không CI)"). Thêm một phụ thuộc
// framework test npm mới nằm ngoài Target Files của task này (sẽ đụng
// package.json/playwright.config.ts, không cái nào được liệt kê) và là một quyết định
// "thư viện ngoài mới" mà người cài đặt này escalate thay vì tự quyết
// (xem phản hồi JSON cuối của task cho ghi nhận escalation).
// Nên script này được viết dựa trên một interface `FE2Driver` tối thiểu
// là một tập CON cấu trúc của API `Page`/`Locator` thật của Playwright
// (`goto`, `url`, `getByRole`, `getByText`, `.click`, `.check`,
// `.getAttribute`, `.first`, `.count`) — một `Page` Playwright thật thoả
// interface này nguyên trạng, nên khi có harness, script này chạy không đổi
// (hoặc bọc trong một khối `test()` của `@playwright/test`, hoặc điều khiển trực tiếp
// qua công cụ Playwright MCP). Các khẳng định dùng
// `node:assert/strict` có sẵn của Node (cũng không phụ thuộc mới).
//
//Backend điều khiển bằng fixture: `listExams`/`listMySubmittedExamIds`/`getCurrentUser`
// phải resolve ra dữ liệu fixture bên dưới thay vì Supabase sống để script này
// chạy được trên `npm run dev`. Repo này chưa có lớp
// mock request/route nào (không MSW, không ghi đè truy vấn chế độ test) — nối
// FIXTURE_EXAMS/FIXTURE_SUBMITTED_EXAM_IDS/FIXTURE_USER vào một trang `/exams`
// đang chạy thật (ví dụ qua một cờ env chỉ-cho-test mà `queries.ts`/
// `getCurrentUser.ts` đọc, hoặc chặn mạng kiểu MSW) là phần dư
// để lại cho ai dựng harness Playwright — ngoài Target Files của task này
// (queries.ts/getCurrentUser.ts thuộc backend, Task 4).

import assert from "node:assert/strict";
import type { Bucket } from "@/lib/rating";

// --- Driver (Playwright `Page`/`Locator` structural subset) ---------------

export interface FE2Locator {
  click(): Promise<void>;
  check(): Promise<void>;
  isVisible(): Promise<boolean>;
  /** Trạng thái `<input type="checkbox">` gốc (các checkbox sắp xếp nhanh Mới nhất/Cũ nhất/Khó nhất
   *  — ExamFilters.tsx) — trạng thái checked là thuộc tính DOM, không phải
   *  attribute `aria-checked`, nên được truy vấn riêng khỏi getAttribute. */
  isChecked(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  first(): FE2Locator;
  count(): Promise<number>;
  allTextContents(): Promise<string[]>;
}

export interface FE2Driver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp; level?: number }): FE2Locator;
  getByText(text: string | RegExp): FE2Locator;
}

// --- Dữ liệu fixture -----------------------------------------------------------
// Trải 0/1/2/>=3 đánh giá (AC-014/015/016) qua ba nhóm, cộng một
// người dùng hiện tại có đủ điều kiện hỗn hợp (một đề đã nộp -> đủ điều kiện; một đề chưa).

export interface FixtureExam {
  id: string;
  title: string;
  communityDifficulty: { bucket: Bucket; mean: number; count: number } | null;
}

export const FIXTURE_EXAMS: readonly FixtureExam[] = [
  { id: "exam-0-ratings", title: "Algebra Basics", communityDifficulty: null },
  { id: "exam-1-rating", title: "Geometry Intro", communityDifficulty: null },
  { id: "exam-2-ratings", title: "Trigonometry Warmup", communityDifficulty: null },
  {
    id: "exam-easy",
    title: "Fractions Practice",
    communityDifficulty: { bucket: "Easy", mean: 2.3, count: 5 },
  },
  {
    id: "exam-medium",
    title: "Quadratic Equations",
    communityDifficulty: { bucket: "Medium", mean: 5.1, count: 4 },
  },
  {
    id: "exam-hard",
    title: "Calculus Challenge",
    communityDifficulty: { bucket: "Hard", mean: 8.7, count: 6 },
  },
];

/** Người dùng fixture đã đăng nhập đã nộp exam-hard (-> đủ điều kiện) nhưng chưa nộp
 *  exam-medium (-> chưa-làm). AC-026 chạy lại cùng trang khi chưa đăng nhập. */
export const FIXTURE_SUBMITTED_EXAM_IDS = new Set(["exam-hard"]);
export const FIXTURE_USER = { id: "user-1", email: "fixture@example.com" };

// =============================================================================
// Test FE2 — Duyệt: sắp xếp Khó nhất, lọc theo Mức, và các trạng thái đủ điều kiện của nút Đánh giá
// =============================================================================
// AC-010, AC-011, AC-026 (nút Đánh giá ở các trạng thái đủ điều kiện / chưa làm / chưa đăng nhập)
// AC-014, AC-015, AC-016 (DifficultyBadge nhóm+trung bình so với "—")
// AC-017, AC-019, AC-020, AC-021 (lọc Mức theo nhóm thật; thứ tự Khó nhất)
// code:F1 (stretched-link: thân thẻ so với RateButton là hai đích độc lập)
// ROI: 80 (BV:8 x Freq:9 + Legal:0 + Defect:8)
// Hành vi: trên /exams với một bộ đề fixture trải 0/1/2/>=3 đánh giá và một
//   người dùng hiện tại đủ điều kiện hỗn hợp (một đề đủ điều kiện, một chưa-làm; chạy
//   thêm một lần khi chưa đăng nhập cho AC-026) -> thao tác ExamCard
//   stretched-link, ba trạng thái của RateButton, và các điều khiển Khó nhất/Mức.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: toàn UI (backend bị mock) — listExams/listMySubmittedExamIds/
//   getCurrentUser điều khiển bằng fixture
// @complexity: medium
// Kiểu hỏng chính: bấm thân thẻ không còn điều hướng tới /exams/[id],
//   hoặc đích bấm độc lập của RateButton bị nuốt bởi anchor stretched-link
//   (hồi quy lồng tương tác không hợp lệ, code:F1); HOẶC chọn Khó nhất
//   vẫn kết hợp với Mới nhất/Cũ nhất thay vì thay thế chúng (hồi quy D002);
//   HOẶC một đề dưới ngưỡng bị xen lẫn với các đề đã đánh giá thay vì chìm xuống
//   cuối; HOẶC bộ lọc Mức gồm một đề dưới ngưỡng hay sai nhóm.
// Nghĩa vụ chứng minh:
//   (a) bấm thân của một ExamCard (ngoài RateButton) điều hướng tới
//       /exams/[id]; bấm một RateButton đang bật điều hướng tới /exams/[id]/rate
//       độc lập; một RateButton bị tắt (chưa-làm hoặc chưa đăng nhập) không
//       điều hướng và phơi chữ lý do cho AT ("Finish this exam first" /
//       "Log in to rate") qua aria-describedby (AC-010/011/026);
//   (b) với bộ fixture, DifficultyBadge hiện "<Nhóm> · <trung bình>" cho mọi
//       đề có >=3 đánh giá và literal "—" cho mọi đề có <3 đánh giá, trên
//       cả ô Mức của ExamCard lẫn ô Độ khó của trang chi tiết đề (AC-014/
//       015/016);
//   (c) chọn Khó nhất ghi ?sort=hardest, bỏ chọn trực quan Mới nhất/Cũ nhất, và
//       sắp xếp lại danh sách sao cho mọi đề dưới ngưỡng xuất hiện sau mọi đề
//       đã đánh giá theo thứ tự kỳ vọng của fixture (AC-019/020);
//   (d) chọn Mức=Khó chỉ hiện các đề fixture có >=3 đánh giá mà độ khó
//       cộng đồng rơi vào nhóm Khó, loại các đề dưới ngưỡng và
//       đề nhóm khác (AC-017/021).
//
// Ghi chú cài đặt: được chuyển bên dưới thành các hàm `checkXxx(driver)` (mỗi nghĩa vụ
// đánh chữ một hàm, cộng một hàm thêm cho lượt chạy lại chưa-đăng-nhập AC-026) thay vì
// các khối `it()` — file này chưa có harness chạy test (xem comment đầu file); comment
// của mỗi hàm lặp lại chữ cái + ID AC của nó để truy vết về
// khối ở trên, theo cách Test 2 (`rating.int.test.ts`) nhúng
// "(AC-xxx, nghĩa vụ x)" vào tiêu đề mỗi `it()`.

/** (a) thân thẻ -> /exams/[id]; RateButton đang bật -> /exams/[id]/rate
 *  độc lập; RateButton bị tắt (chưa-làm/chưa-đăng-nhập) không
 *  điều hướng và phơi lý do AT qua aria-describedby (AC-010/011/026). */
export async function checkCardBodyAndRateButtonIndependentTargets(
  driver: FE2Driver
): Promise<void> {
  await driver.goto("/exams");

  // RateButton đã bật (exam-hard, đã nộp -> đủ điều kiện) tự điều hướng.
  const enabledRate = driver.getByRole("link", { name: "Rate →" }).first();
  await enabledRate.click();
  assert.match(driver.url(), /\/exams\/exam-hard\/rate$/);

  // Thân thẻ (liên kết tiêu đề) điều hướng tới route chi tiết, độc lập với Đánh giá.
  await driver.goto("/exams");
  const cardBody = driver.getByRole("link", { name: "Calculus Challenge" });
  await cardBody.click();
  assert.match(driver.url(), /\/exams\/exam-hard$/);

  // RateButton bị tắt — .first() resolve ra exam-0-ratings (mục FIXTURE_EXAMS đầu tiên
  // không có trong FIXTURE_SUBMITTED_EXAM_IDS, theo thứ tự DOM), cũng
  // đã-đăng-nhập-chưa-làm như exam-medium: không điều hướng, lý do tới được
  // qua aria-describedby.
  await driver.goto("/exams");
  const disabledRate = driver.getByRole("button", { name: "Rate →" }).first();
  const urlBefore = driver.url();
  await disabledRate.click();
  assert.equal(driver.url(), urlBefore, "disabled RateButton must not navigate");
  assert.equal(await disabledRate.getAttribute("aria-disabled"), "true");
  const reasonId = await disabledRate.getAttribute("aria-describedby");
  assert.ok(reasonId, "disabled RateButton must expose aria-describedby");
  const reason = driver.getByText("Finish this exam first");
  assert.equal(await reason.isVisible(), true);
}

/** (a, AC-026) chưa đăng nhập: mọi RateButton bị tắt với lý do
 *  "Log in to rate", bất kể có thuộc submitted-exam-id hay không. */
export async function checkLoggedOutRateButtonsDisabled(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  const disabledRate = driver.getByRole("button", { name: "Rate →" }).first();
  assert.equal(await disabledRate.getAttribute("aria-disabled"), "true");
  const reason = driver.getByText("Log in to rate");
  assert.equal(await reason.isVisible(), true);
}

/** (b) DifficultyBadge hiện "<Nhóm> · <trung bình>" cho mọi đề >=3 đánh giá và
 *  literal "—" cho mọi đề <3 đánh giá, trên ô Mức của ExamCard VÀ ô
 *  Độ khó của trang chi tiết đề (AC-014/015/016). */
export async function checkDifficultyBadgeAcrossFixtures(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  for (const exam of FIXTURE_EXAMS) {
    const label = exam.communityDifficulty
      ? `${exam.communityDifficulty.bucket} · ${exam.communityDifficulty.mean.toFixed(1)}`
      : "—";
    assert.equal((await driver.getByText(label).first().count()) >= 1, true, exam.id);

    await driver.goto(`/exams/${exam.id}`);
    assert.equal((await driver.getByText(label).first().count()) >= 1, true, `${exam.id} detail`);
  }
}

/** (c) chọn Khó nhất ghi ?sort=hardest, bỏ chọn Mới nhất/Cũ nhất, và
 *  làm mọi đề dưới ngưỡng chìm xuống sau mọi đề đã đánh giá (AC-019/020;
 *  chốt hồi quy D002 — KHÔNG được kết hợp với Mới nhất/Cũ nhất). */
export async function checkHardestSortOrdering(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  await driver.getByRole("checkbox", { name: "Hardest" }).check();
  assert.match(driver.url(), /[?&]sort=hardest(&|$)/);

  const newest = driver.getByRole("checkbox", { name: "Newest" });
  const oldest = driver.getByRole("checkbox", { name: "Oldest" });
  assert.equal(await newest.isChecked(), false);
  assert.equal(await oldest.isChecked(), false);

  // Tiêu đề ExamCard render dạng <h3> (ExamCard.tsx) theo thứ tự DOM == thứ tự render.
  const renderedTitles = await driver.getByRole("heading", { level: 3 }).allTextContents();
  const ratedTitles = FIXTURE_EXAMS.filter((e) => e.communityDifficulty).map((e) => e.title);
  const belowThresholdTitles = FIXTURE_EXAMS.filter((e) => !e.communityDifficulty).map(
    (e) => e.title
  );
  for (const ratedTitle of ratedTitles) {
    for (const belowTitle of belowThresholdTitles) {
      assert.ok(
        renderedTitles.indexOf(ratedTitle) < renderedTitles.indexOf(belowTitle),
        `${ratedTitle} (rated) must sort before ${belowTitle} (below-threshold) under Hardest`
      );
    }
  }
}

/** (d) chọn Mức=Khó chỉ hiện các đề >=3 đánh giá thuộc nhóm Khó
 *  (AC-017/021) — loại các đề dưới ngưỡng và đề nhóm khác. */
export async function checkLevelHardFilter(driver: FE2Driver): Promise<void> {
  await driver.goto("/exams");
  // FilterRow của Mức chỉ render bên trong panel overlay `{open && (...)}` của ExamFilters.tsx
  // — mở nút "Filters" tổng trước (ExamFilters.tsx:113).
  await driver.getByRole("button", { name: "Filters" }).click();
  await driver.getByRole("button", { name: "Level" }).click();
  await driver.getByRole("button", { name: "Hard" }).click();
  assert.match(driver.url(), /[?&]level=hard(&|$)/);

  for (const exam of FIXTURE_EXAMS) {
    const shouldShow = exam.communityDifficulty?.bucket === "Hard";
    const count = await driver.getByText(exam.title).count();
    assert.equal(count > 0, shouldShow, exam.id);
  }
}

/** Bộ điều phối — chạy bốn nghĩa vụ chứng minh của FE2 trên một driver được cấp
 *  nối với một phiên `/exams` điều khiển bằng fixture (xem comment đầu file). */
export async function runFE2(driver: FE2Driver, loggedOutDriver: FE2Driver): Promise<void> {
  await checkCardBodyAndRateButtonIndependentTargets(driver);
  await checkLoggedOutRateButtonsDisabled(loggedOutDriver);
  await checkDifficultyBadgeAcrossFixtures(driver);
  await checkHardestSortOrdering(driver);
  await checkLevelHardFilter(driver);
}


// =============================================================================
// Test FE1 — Lối vào đánh giá ở trang kết quả điều hướng thẳng tới trang Đánh giá
// (viết lại 2026-07-27 — thay hành trình modal-tự-mở cũ. Lối vào đánh giá
// của trang Kết quả không còn mở popup nào: RatingModal/
// RatingModalController/RatingEntry, dấu ?rate=auto, và dialog mà
// chúng điều khiển đều đã xoá. AC-004/005 của PRD ("...tự mở như một
// modal...") mô tả hành vi đã bị gỡ đó — bị quyết định sản phẩm này thay thế,
// xem comment 2026-07-27 của chính result/page.tsx.)
// =============================================================================
// AC-006: "...nó hiện trạng thái 'đã đánh giá' có thể sửa..." — vẫn
//   đúng về tinh thần: NHÃN của lối vào vẫn phản ánh trạng thái
//   đánh giá trước đó, chỉ là giờ nó là một liên kết điều hướng thường thay vì
//   một nút mở dialog điền sẵn (bản thân trang /rate đọc các điểm trước đó phía server
//   — được chứng minh bởi lời gọi getMyRating/mapFromMyRating của chính rate/page.tsx, không bởi
//   test này).
// ROI: 40 (BV:6 x Freq:6 + Legal:0 + Defect:6) — giảm từ 57 của
//   hành trình modal cũ vì không còn bề mặt dialog/bẫy-focus/aria-live nào
//   để chứng minh ở mức trình duyệt; còn lại là một liên kết thường + nhãn.
// Hành vi: trên trang kết quả, nhãn của lối vào đánh giá phản ánh
//   người dùng hiện tại đã đánh giá đề này chưa, và bấm vào nó
//   điều hướng tới /exams/[id]/rate — một chuyển trang thật, không bao giờ là dialog.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: toàn UI (backend bị mock) — getResult/getMyRating điều khiển bằng fixture
//   (cùng phần dư như ghi chú đầu mục của FE2: nối dữ liệu fixture vào một trang
//   đang chạy thật chưa có lớp tiêm mock nào trong repo này).
// @complexity: low
// @real-dependency: không có — chỉ chứng minh hành vi liên kết/nhãn ở mức trình duyệt;
//   hợp đồng của chính rateExam/getMyRating được chứng minh bởi test của backend
//   Task 6.
// Kiểu hỏng chính: lối vào vẫn mở một overlay/dialog thay vì điều hướng;
//   HOẶC nhãn không phản ánh trạng thái đã đánh giá trước đó; HOẶC đích liên kết
//   sai (ví dụ vẫn trỏ vào trang chi tiết đề thay vì
//   trang đánh giá).
// Nghĩa vụ chứng minh:
//   (1) khi chưa có đánh giá trước, lối vào đọc "Rate this exam", là một
//       liên kết thật (không phải nút) nhắm /exams/[id]/rate, và bấm vào đó
//       điều hướng tới đó trực tiếp mà không bao giờ có role="dialog" xuất hiện;
//   (2) khi đã có đánh giá trước, lối vào đọc "Edit your rating" và
//       nhắm cùng URL /exams/[id]/rate (ca đối chiếu AC-006).

/** Định danh fixture cho hành trình này (tách biệt với các fixture đủ điều kiện của FE2;
 *  FE1 thực thi trang kết quả, không phải /exams). */
export const FE1_EXAM_ID = "exam-fe1-fresh-submit";
export const FE1_ATTEMPT_ID = "attempt-fe1";
export const FE1_RESULT_PATH = `/exams/${FE1_EXAM_ID}/attempt/${FE1_ATTEMPT_ID}/result`;

// --- Driver FE1 (tập con cấu trúc của `Page`/`Locator` Playwright) ------------
// Nhỏ hơn nhiều so với driver hành trình dialog cũ (không cần press/isFocused/reload/
// getByTestId — không còn gì để lật trang, bẫy focus, hay tải lại
// lũy đẳng; đó là một liên kết có nhãn và href).

export interface FE1Locator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  count(): Promise<number>;
}

export interface FE1Driver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): FE1Locator;
}

/** (1) Chưa có đánh giá trước -> lối vào đọc "Rate this exam", là một liên kết thật
 *  nhắm /exams/[id]/rate, và bấm vào đó điều hướng tới đó trực tiếp mà
 *  không bao giờ có role="dialog" xuất hiện (ca mới của AC-006). */
export async function checkFreshEntryNavigatesToRatePage(driver: FE1Driver): Promise<void> {
  await driver.goto(FE1_RESULT_PATH);

  const entry = driver.getByRole("link", { name: "Rate this exam" });
  assert.equal(await entry.isVisible(), true, "fresh entry point must read 'Rate this exam'");
  assert.equal(await entry.getAttribute("href"), `/exams/${FE1_EXAM_ID}/rate`);

  await entry.click();
  assert.match(driver.url(), new RegExp(`/exams/${FE1_EXAM_ID}/rate$`));
  assert.equal(
    await driver.getByRole("dialog").count(),
    0,
    "rating must never open as a popup on the result page"
  );
}

/** (2) Đã có đánh giá trước -> lối vào đọc "Edit your rating" và vẫn
 *  nhắm cùng URL /exams/[id]/rate (ca đối chiếu AC-006). */
export async function checkRatedEntryReadsEditYourRating(driver: FE1Driver): Promise<void> {
  await driver.goto(FE1_RESULT_PATH);

  const entry = driver.getByRole("link", { name: "Edit your rating" });
  assert.equal(
    await entry.isVisible(),
    true,
    "already-rated entry point must read 'Edit your rating'"
  );
  assert.equal(await entry.getAttribute("href"), `/exams/${FE1_EXAM_ID}/rate`);
}

/** Bộ điều phối — chạy hai nghĩa vụ của FE1 trên hai phiên driver: một
 *  cho người dùng chưa đánh giá đề này, một cho người đã đánh giá
 *  (theo mẫu hai-driver mới-so-với-chưa-đăng-nhập của FE2). */
export async function runFE1(freshDriver: FE1Driver, ratedDriver: FE1Driver): Promise<void> {
  await checkFreshEntryNavigatesToRatePage(freshDriver);
  await checkRatedEntryReadsEditYourRating(ratedDriver);
}
