// History — Hành trình đầy đủ [fixture-e2e] Script driver
// Design Docs: docs/design/history-backend-design.md (v1.2), docs/design/history-frontend-design.md (v1.3)
// UI Spec: docs/ui-spec/history-ui-spec.md (v1.1)
// PRD: docs/prd/history-prd.md (v1.3, AC-001..AC-019)
// Sinh (skeleton): 2026-07-30 | Điền: Task 15 (Work Plan Phase 4.3)
//
// Repo này không có phụ thuộc @playwright/test và không có playwright.config.ts —
// chỉ máy chủ tự động hoá trình duyệt Playwright MCP được cấu hình (`.mcp.json`)
// cho các phiên tương tác/thủ công (xem Test Boundaries của frontend Design Doc:
// "Playwright MCP / lượt thủ công (không CI)"). Theo đúng tiền lệ mà
// SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts đã thiết lập, script này
// được viết dựa trên một interface `HistoryDriver` tối thiểu là một tập CON cấu trúc
// của API `Page`/`Locator` thật của Playwright (`goto`, `url`, `getByRole`, `getByText`,
// `.click`, `.getAttribute`, `.textContent`, `.first`, `.count`, `.allTextContents`, cộng
// `waitForDownload`/`networkRequestCount` cho các nghĩa vụ tải xuống/không-fetch-thêm)
// — một `Page` Playwright thật (mở rộng bằng helper đếm tải xuống/mạng mỏng)
// thoả interface này, nên khi có harness, script này chạy không đổi, hoặc bọc trong một
// khối `test()` của `@playwright/test` hoặc điều khiển trực tiếp qua công cụ Playwright MCP.
// Các khẳng định dùng `node:assert/strict` có sẵn của Node (không phụ thuộc mới).
//
// Phần dư dữ liệu fixture (khoảng trống Task 01 — ghi trong Investigation
//Notes của task này): Task 01 (`history-work-plan-task-01.md`) lẽ ra phải giao
// `SOURCE/tests/e2e/fixture/historyFixtureData.ts` — một module dữ liệu fixture riêng
// cộng cơ chế mock/override-boundary được chọn để nối
// `listMyHistory()`/`getResult()`/`getCurrentUser()` với dữ liệu fixture trên một
// phiên `npm run dev` thật. File đó chưa bao giờ được viết (xác nhận vắng khỏi
// cả cây làm việc lẫn `git log --all` lúc task này chạy).
// Thay vì import từ một file không tồn tại (ngoài Target Files của chính task này —
// tạo một module fixture mới không có trong danh sách), bốn hồ sơ dữ liệu
// fixture (danh-sách-rỗng, người-dùng-null, ném-lỗi, nhiều-hàng
// hợp lệ) được định nghĩa thẳng trong file này, theo
// quy ước mà `rating.fixture.e2e.test.ts` đã thiết lập cho
// FIXTURE_EXAMS/FIXTURE_SUBMITTED_EXAM_IDS/FIXTURE_USER của nó (định nghĩa nội tuyến, không ở
// một module riêng). Đây là một cấu trúc cục bộ, đảo ngược được: không gì ở đây
// phụ thuộc vào một module không tồn tại, và nếu `historyFixtureData.ts` được viết
// về sau, các hồ sơ bên dưới đổi được sang một import mà hình dạng không đổi.
// Interface `FixtureBackend` bên dưới tài liệu hoá đúng hợp đồng override-boundary
// (spy đếm lời gọi + hành vi throw/reject cấu hình lại được) mà một harness thật phải phơi
// trên `listMyHistory()`/`getCurrentUser()`/
// `generateAttemptPdfFile()`; `createInMemoryFixtureBackend()` là một cài đặt tham chiếu
// xác định của hợp đồng đó.
//
// Ghi chú trình tự (quyết định tường minh của chính task file, không do Work
//Plan tự giải quyết): Task Dependency Diagram của Work Plan đặt task này (4.3)
// *trước* Phase 5 (nối nav, Tasks 16/17). Tại thời điểm task này chạy,
// mục nav "History" của SiteHeader vẫn có `href="#"` (xác nhận:
// SOURCE/features/exams/components/SiteHeader.tsx:27) — bấm vào nó sẽ không điều hướng
// đi đâu. Mọi bước điều hướng bên dưới (kể cả bước "quay lại
// History") dùng `driver.goto("/history")` trực tiếp thay vì bấm
// mục nav. Nghĩa vụ HE1 (f) (tô sáng nav đang hoạt động) được ghi là
// đang-chờ-kỳ-vọng ở đây, không bị lặng lẽ đánh dấu là qua hay bỏ — xem
// `checkHE1NavActiveHighlightExpectedPending` bên dưới.
//
// Phát hiện nhất quán xuyên bề mặt (nghĩa vụ HE1 (e)): `ScoreCard` của trang Kết quả
//(SOURCE/features/exams/components/ScoreCard.tsx) render điểm
// (`{totalScore}/10`) và thời gian hoàn thành, nhưng — khác HistoryRow — không bao giờ
// render ngày nộp; `submittedAt` chỉ dùng cho
// phép tính hiệu của `formatCompletionTime` và nội dung của chính PDF, không bao giờ là
// chuỗi ngày nhìn thấy được trên chính trang Kết quả. Đây là một sự thật về
// UI Task 12 đã ship (ScoreCard.tsx nằm ngoài Target
// Files của task này), không phải một thu hẹp phạm vi do ta chọn — nên phép so sánh xuyên bề mặt
// bên dưới kiểm hai trường mà cả hai bề mặt thực sự render (điểm +
// thời gian hoàn thành), không phải ngày.

import assert from "node:assert/strict";
import { formatCompletionTime } from "@/lib/history/format";

// --- Driver (Playwright `Page`/`Locator` structural subset) ---------------

export interface HistoryLocator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
  textContent(): Promise<string | null>;
  first(): HistoryLocator;
  count(): Promise<number>;
  allTextContents(): Promise<string[]>;
}

export interface HistoryDriver {
  goto(url: string): Promise<void>;
  url(): string;
  getByRole(role: string, options?: { name?: string | RegExp }): HistoryLocator;
  getByText(text: string | RegExp): HistoryLocator;
  /** Tương tự cấu trúc của `page.waitForEvent("download")` của Playwright —
   *  resolve với lượt tải xuống quan sát được khi `action` kích hoạt một cái; `null`
   *  nếu không cái nào bắn trong timeout riêng của harness. */
  waitForDownload(action: () => Promise<void>): Promise<{ filename: string } | null>;
  /** Số đếm tích luỹ các request fetch/XHR mà harness đã quan sát từ khi
   *  điều hướng của trang hiện tại bắt đầu. */
  networkRequestCount(): Promise<number>;
}

// --- Dữ liệu fixture -----------------------------------------------------------
// Xem ghi chú đầu file "Phần dư dữ liệu fixture" ở trên — các hồ sơ này thế chỗ
// historyFixtureData.ts chưa được giao của Task 01, khớp đúng hình dạng trường của MyHistoryEntry
// (SOURCE/features/history/queries.ts).

export interface FixtureHistoryEntry {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  totalScore: number;
  startedAt: string;
  submittedAt: string;
}

/** Hồ sơ nhiều-hàng hợp lệ — thứ tự mới-nhất-trước, trải trên các giá trị
 *  submitted_at khác nhau (AC-001/003/004). */
export const FIXTURE_HISTORY_VALID: readonly FixtureHistoryEntry[] = [
  {
    attemptId: "attempt-fixture-2",
    examId: "exam-fixture-geometry",
    examTitle: "Geometry Intro",
    subject: "Toán",
    totalScore: 9.0,
    startedAt: "2026-07-20T09:00:00.000Z",
    submittedAt: "2026-07-20T09:15:00.000Z",
  },
  {
    attemptId: "attempt-fixture-1",
    examId: "exam-fixture-algebra",
    examTitle: "Algebra Basics",
    subject: "Toán",
    totalScore: 7.5,
    startedAt: "2026-07-15T08:00:00.000Z",
    submittedAt: "2026-07-15T08:32:00.000Z",
  },
];

/** Empty-list profile (AC-002). */
export const FIXTURE_HISTORY_EMPTY: readonly FixtureHistoryEntry[] = [];

/** Người dùng fixture đã đăng nhập (hồ sơ người-dùng-null đơn giản là `setCurrentUser(null)`, AC-016). */
export const FIXTURE_USER = { id: "user-history-fixture-1", email: "fixture-history@example.com" };

/** Tài liệu hoá hợp đồng override-boundary mà một harness thật phải phơi trên
 *  listMyHistory()/getCurrentUser()/generateAttemptPdfFile() — spy đếm lời gọi
 *  (HE2(b)/HE3(a) đòi quan sát số lần gọi chính xác) cộng hành vi
 *  throw/reject cấu hình lại được (hồ sơ ném-lỗi của HE3(a)/(b)).
 *  Đây là cùng hình dạng mà Task 01 lẽ ra phải bàn giao. */
export interface FixtureBackend {
  listMyHistoryCallCount: number;
  generateAttemptPdfCallCount: number;
  setCurrentUser(user: typeof FIXTURE_USER | null): void;
  setHistoryEntries(entries: readonly FixtureHistoryEntry[]): void;
  configureListMyHistoryToThrow(shouldThrow: boolean): void;
  configureGenerateAttemptPdfToReject(shouldReject: boolean): void;
  /** Được lớp chặn request của harness thật gọi thay cho lời gọi
   *  getCurrentUser() thật — trả về người dùng fixture đang được cấu hình. */
  simulateGetCurrentUser(): typeof FIXTURE_USER | null;
  /** Được lớp chặn của harness thật gọi thay cho lời gọi
   *  listMyHistory() thật — tăng spy đếm lời gọi, rồi trả về các mục
   *  đã cấu hình hoặc ném lỗi, theo hồ sơ đang được cấu hình. */
  simulateListMyHistory(): FixtureHistoryEntry[];
  /** Được lớp chặn của harness thật gọi thay cho lời gọi
   *  generateAttemptPdfFile() thật — tăng spy đếm lời gọi, rồi
   *  resolve hoặc reject theo hồ sơ đang được cấu hình. */
  simulateGenerateAttemptPdf(): void;
}

/** Cài đặt tham chiếu trong bộ nhớ, xác định của FixtureBackend — không có
 *  thời gian đồng hồ thật, chỉ dữ liệu fixture cố định (yêu cầu pha Refactor).
 *  Một harness thật nối cùng các bộ đếm/cờ này với các nơi gọi thật của
 *  listMyHistory()/getCurrentUser()/generateAttemptPdfFile() (mỗi lời gọi bị chặn
 *  uỷ quyền cho phương thức `simulateXxx` tương ứng ở đây,
 *  là thứ thực sự đọc trạng thái người dùng/mục/throw-reject đã cấu hình
 *  và tăng spy đếm lời gọi tương ứng). */
export function createInMemoryFixtureBackend(): FixtureBackend {
  let currentUser: typeof FIXTURE_USER | null = FIXTURE_USER;
  let entries: readonly FixtureHistoryEntry[] = FIXTURE_HISTORY_VALID;
  let shouldThrowOnList = false;
  let shouldRejectOnGenerate = false;

  const backend: FixtureBackend = {
    listMyHistoryCallCount: 0,
    generateAttemptPdfCallCount: 0,
    setCurrentUser(user) {
      currentUser = user;
    },
    setHistoryEntries(next) {
      entries = next;
    },
    configureListMyHistoryToThrow(shouldThrow) {
      shouldThrowOnList = shouldThrow;
    },
    configureGenerateAttemptPdfToReject(shouldReject) {
      shouldRejectOnGenerate = shouldReject;
    },
    simulateGetCurrentUser() {
      return currentUser;
    },
    simulateListMyHistory() {
      backend.listMyHistoryCallCount += 1;
      if (shouldThrowOnList) throw new Error("fixture: simulated list-read failure");
      return [...entries];
    },
    simulateGenerateAttemptPdf() {
      backend.generateAttemptPdfCallCount += 1;
      if (shouldRejectOnGenerate) throw new Error("fixture: simulated PDF-generation failure");
    },
  };
  return backend;
}

// =============================================================================
// Nhóm nghĩa vụ HE1 (suất fixture-e2e giữ chỗ) — Danh sách History -> Lưu/
// Chia sẻ trên một hàng -> Xem chi tiết -> Trang Kết quả -> Lưu/Chia sẻ trên trang Kết quả,
// nhất quán xuyên bề mặt
// =============================================================================
// Xem comment đầu file để biết toàn bộ lời kể hành trình, ROI, và ngữ cảnh quy mô ADR
// (không đổi so với skeleton — ROI 105, tham chiếu ADR/PRD ở đó).

export interface HE1Context {
  selectedRow: { examId: string; attemptId: string };
  historyRowScoreText: string;
  historyRowTimeText: string;
}

/** (a) AC-001/003/004 — /history render N hàng theo thứ tự fixture (mới-nhất-trước),
 *  mỗi hàng có tên đề, điểm X/10, và thời gian hoàn thành không phải
 *  giữ chỗ (tính qua bộ định dạng dùng chung lib/history/format.ts, không
 *  cài lại ở đây — Reference Contract). */
export async function checkHE1RendersRowsNewestFirst(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<HE1Context> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_VALID);
  backend.configureListMyHistoryToThrow(false);

  await driver.goto("/history");

  const rows = driver.getByRole("listitem");
  assert.equal(
    await rows.count(),
    FIXTURE_HISTORY_VALID.length,
    "rendered row count must equal fixture entry count"
  );

  const rowTexts = await rows.allTextContents();
  FIXTURE_HISTORY_VALID.forEach((entry, i) => {
    const text = rowTexts[i];
    const scoreText = `${entry.totalScore.toFixed(1)}/10`;
    const timeText = formatCompletionTime(entry.startedAt, entry.submittedAt);
    assert.ok(text.includes(entry.examTitle), `row ${i} must show exam title "${entry.examTitle}"`);
    assert.ok(text.includes(scoreText), `row ${i} must show score "${scoreText}"`);
    assert.ok(text.includes(timeText), `row ${i} must show completion time "${timeText}"`);
    assert.ok(
      !text.includes("—"),
      `row ${i} must not show the placeholder em-dash for a complete fixture row`
    );
  });

  const firstEntry = FIXTURE_HISTORY_VALID[0];
  return {
    selectedRow: { examId: firstEntry.examId, attemptId: firstEntry.attemptId },
    historyRowScoreText: `${firstEntry.totalScore.toFixed(1)}/10`,
    historyRowTimeText: formatCompletionTime(firstEntry.startedAt, firstEntry.submittedAt),
  };
}

/** (b) AC-009 — bấm Lưu (bên trong menu ⋯ của hàng, front-adjust:
 *  HistoryRow nay gộp Lưu/Chia sẻ/Xem chi tiết sau một
 *  nút HistoryRowMenu duy nhất) kích hoạt một lượt tải xuống chỉ dựng từ dữ liệu
 *  đã render sẵn của hàng đó; không request mạng thêm nào bắn. */
export async function checkHE1SaveTriggersDownloadNoExtraFetch(
  driver: HistoryDriver
): Promise<void> {
  const menuTrigger = driver.getByRole("button", { name: /More actions/ }).first();
  await menuTrigger.click();
  const saveItem = driver.getByRole("menuitem", { name: "Save" }).first();
  const requestsBefore = await driver.networkRequestCount();

  const download = await driver.waitForDownload(() => saveItem.click());
  assert.ok(download, "clicking Save must trigger an observable download");

  const requestsAfter = await driver.networkRequestCount();
  assert.equal(
    requestsAfter,
    requestsBefore,
    "Save must not trigger any network/fetch call beyond what the page already loaded"
  );
}

/** (c) AC-005 — "View details" (bên trong menu ⋯ của hàng) trên một hàng cụ thể
 *  điều hướng tới trang Kết quả của ĐÚNG lượt làm đó, không phải bất kỳ
 *  trang Kết quả nào. Menu tự đóng sau lần Lưu thành công ở (b)
 *  (tự đóng khi thành công), nên nó được mở lại ở đây. */
export async function checkHE1ViewDetailsNavigatesToExactAttempt(
  driver: HistoryDriver,
  ctx: HE1Context
): Promise<void> {
  const expectedPath = `/exams/${ctx.selectedRow.examId}/attempt/${ctx.selectedRow.attemptId}/result`;
  const menuTrigger = driver.getByRole("button", { name: /More actions/ }).first();
  await menuTrigger.click();
  const viewDetailsLink = driver.getByRole("menuitem", { name: "View details" }).first();
  assert.equal(await viewDetailsLink.getAttribute("href"), expectedPath);

  await viewDetailsLink.click();
  assert.equal(driver.url(), expectedPath, "post-click URL must match the exact attempt clicked");
}

/** (d) AC-014 — trên trang Kết quả đã tới, Lưu/Chia sẻ của ResultActions là
 *  các <button> enabled (aria-disabled="false", không thuộc tính disabled gốc),
 *  và không có chữ "sắp có" ở bất kỳ đâu. */
export async function checkHE1ResultActionsNoComingSoon(driver: HistoryDriver): Promise<void> {
  const saveButton = driver.getByRole("button", { name: "Save" }).first();
  const shareButton = driver.getByRole("button", { name: "Share" }).first();

  assert.equal(await saveButton.getAttribute("aria-disabled"), "false");
  assert.equal(await shareButton.getAttribute("aria-disabled"), "false");
  assert.equal(
    await saveButton.getAttribute("disabled"),
    null,
    "Save must never carry a native disabled attribute"
  );
  assert.equal(
    await shareButton.getAttribute("disabled"),
    null,
    "Share must never carry a native disabled attribute"
  );
  assert.equal(await driver.getByText(/coming soon/i).count(), 0);
}

/** (e) Nhất quán xuyên bề mặt (tinh thần của AC-007) — chữ điểm/thời gian hoàn thành
 *  mà ScoreCard của trang Kết quả hiện cho lượt làm này giống hệt về chữ với
 *  thứ hàng History đã hiện cho cùng lượt làm. Ngày nộp
 *  bị loại khỏi phép so sánh này — ScoreCard không có ô ngày (xem phát hiện
 *  ở comment đầu file); điều này phản ánh nội dung thực sự đã render của hai bề mặt,
 *  không phải một phép kiểm bị thu hẹp. */
export async function checkHE1CrossSurfaceConsistency(
  driver: HistoryDriver,
  ctx: HE1Context
): Promise<void> {
  const scoreOnResultPage = driver.getByText(ctx.historyRowScoreText);
  assert.ok(
    (await scoreOnResultPage.count()) >= 1,
    `Result page ScoreCard must show the identical score text "${ctx.historyRowScoreText}" the History row showed`
  );

  const timeOnResultPage = driver.getByText(ctx.historyRowTimeText);
  assert.ok(
    (await timeOnResultPage.count()) >= 1,
    `Result page ScoreCard must show the identical completion-time text "${ctx.historyRowTimeText}" the History row showed`
  );
}

/** (f) AC-015 — đóng bởi Task 18 (lượt quét Final QA). Phase 5 (Tasks 16/17)
 *  đã đáp xuống: SiteHeader.tsx:27/HomeSidebar.tsx:22 đều mang
 *  `href: "/history"` (xác nhận không còn `href === "#"` nào cho
 *  mục nav History), nên chốt `item.href !== "#"` của SiteHeader.tsx:64 không
 *  còn chặn tín hiệu tô sáng đang-hoạt-động trên các route `/history*`. Cái này
 *  trước đây là "đang-chờ-kỳ-vọng" (Task 15, trước Phase 5) — nay được khẳng định
 *  thật, đóng nghĩa vụ bị hoãn đó. */
export async function checkHE1NavActiveHighlight(driver: HistoryDriver): Promise<void> {
  await driver.goto("/history");
  const historyNav = driver.getByRole("link", { name: "History" });
  assert.equal(
    await historyNav.getAttribute("aria-current"),
    "page",
    'History nav item must carry aria-current="page" while on /history (AC-015)'
  );
}

/** Bộ điều phối — chạy toàn bộ hành trình của HE1 tuần tự, luồn danh tính của
 *  hàng đã chọn qua các bước. */
export async function runHE1(driver: HistoryDriver, backend: FixtureBackend): Promise<void> {
  const ctx = await checkHE1RendersRowsNewestFirst(driver, backend); // (a)
  await checkHE1SaveTriggersDownloadNoExtraFetch(driver); // (b)
  await checkHE1ViewDetailsNavigatesToExactAttempt(driver, ctx); // (c)
  await checkHE1ResultActionsNoComingSoon(driver); // (d)
  await checkHE1CrossSurfaceConsistency(driver, ctx); // (e)
  await checkHE1NavActiveHighlight(driver); // (f) — closed, Phase 5 landed
}

// =============================================================================
// Nhóm nghĩa vụ HE2 — Trạng thái rỗng + chốt truy cập của khách
// =============================================================================
// AC-002/AC-016 — xem comment đầu file / comment skeleton được giữ trong lịch sử git
// để biết đầy đủ ROI và lời kể hành vi.

/** (a) AC-002 — với fixture rỗng, /history hiện chữ "No results yet"
 *  và một liên kết "Browse exams" tới /exams, với không phần tử role="alert" nào. */
export async function checkHE2EmptyStateRendersCallToAction(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_EMPTY);
  backend.configureListMyHistoryToThrow(false);

  await driver.goto("/history");

  const emptyStateText = driver.getByText("No results yet");
  assert.equal(await emptyStateText.isVisible(), true);

  const browseLink = driver.getByRole("link", { name: "Browse exams" });
  assert.equal(await browseLink.getAttribute("href"), "/exams");
  assert.equal(await driver.getByRole("alert").count(), 0);
}

/** (b) AC-016 — không có phiên fixture, /history chuyển hướng tới
 *  /?auth=signin trước khi bất kỳ lượt đọc hàng lượt-làm nào bắn (spy đếm lời gọi vẫn 0). */
export async function checkHE2GuestRedirectsWithZeroListReads(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(null);
  const callsBefore = backend.listMyHistoryCallCount;

  await driver.goto("/history");

  assert.equal(driver.url(), "/?auth=signin");
  assert.equal(
    backend.listMyHistoryCallCount,
    callsBefore,
    "no attempt-row read may fire before the guest guard redirects"
  );
  assert.equal(backend.listMyHistoryCallCount, 0);
}

export async function runHE2(driver: HistoryDriver, backend: FixtureBackend): Promise<void> {
  await checkHE2EmptyStateRendersCallToAction(driver, backend);
  await checkHE2GuestRedirectsWithZeroListReads(driver, backend);
}

// =============================================================================
// Nhóm nghĩa vụ HE3 — Trạng thái lỗi đọc danh sách + trạng thái lỗi tạo PDF,
// cả hai đều thử lại được
// =============================================================================
// AC-018/AC-019 — xem comment đầu file / comment skeleton được giữ trong lịch sử git
// để biết đầy đủ ROI và lời kể hành vi.

/** (a) AC-019 — một lỗi đọc danh sách giả lập render role="alert" + "Retry" của
 *  (history)/history/error.tsx; bấm Retry thử lại lượt đọc (spy đếm lời gọi
 *  tăng đúng 1). */
export async function checkHE3ListReadFailureRendersErrorAndRetries(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_VALID);
  backend.configureListMyHistoryToThrow(true);

  await driver.goto("/history");

  const alert = driver.getByRole("alert");
  assert.equal(await alert.isVisible(), true);
  assert.equal(await alert.textContent(), "Couldn't load your history right now.");

  const callsBefore = backend.listMyHistoryCallCount;
  // AC-019 nói lỗi này thử lại được — cấu hình lại cho thành công trước
  // cú bấm để lần thử lại của Retry quan sát được chỉ qua spy đếm lời gọi.
  backend.configureListMyHistoryToThrow(false);
  const retryButton = driver.getByRole("button", { name: "Retry" });
  await retryButton.click();

  assert.equal(backend.listMyHistoryCallCount, callsBefore + 1);
}

/** (b) AC-018 — một lỗi tạo PDF giả lập render role="alert"
 *  bên trong menu ⋯ của hàng (front-adjust: HistoryRowMenu giữ menu mở
 *  khi lỗi thay vì tự đóng, để mục vẫn tới được), vẫn
 *  thử lại được (aria-disabled="false"), và một cú bấm tiếp theo (fixture
 *  cấu hình lại cho thành công) hoàn tất bình thường. */
export async function checkHE3PdfGenerationFailureRetryable(
  driver: HistoryDriver,
  backend: FixtureBackend
): Promise<void> {
  backend.setCurrentUser(FIXTURE_USER);
  backend.setHistoryEntries(FIXTURE_HISTORY_VALID);
  backend.configureListMyHistoryToThrow(false);
  backend.configureGenerateAttemptPdfToReject(true);

  await driver.goto("/history");

  const menuTrigger = driver.getByRole("button", { name: /More actions/ }).first();
  await menuTrigger.click();
  const saveItem = driver.getByRole("menuitem", { name: "Save" }).first();
  await saveItem.click();

  const alert = driver.getByRole("alert").first();
  assert.equal(await alert.textContent(), "Couldn't generate the PDF. Try again.");
  assert.equal(await saveItem.getAttribute("aria-disabled"), "false");

  backend.configureGenerateAttemptPdfToReject(false);
  const download = await driver.waitForDownload(() => saveItem.click());
  assert.ok(download, "the retry click (fixture reconfigured to succeed) must complete normally");
}

export async function runHE3(driver: HistoryDriver, backend: FixtureBackend): Promise<void> {
  await checkHE3ListReadFailureRendersErrorAndRetries(driver, backend);
  await checkHE3PdfGenerationFailureRetryable(driver, backend);
}

// =============================================================================
// Chốt chặn cấu trúc AC-007 nửa xuyên-file (hoãn từ Task 10)
// =============================================================================
// Đã hoàn tất dưới dạng kiểm tra unit trong tiến trình bên trong
// SOURCE/components/history/ActionButton.test.tsx (Task 15) thay vì ở đây —
// Boundary cần thực thi của chính nó là "unit trong tiến trình (tìm kiếm văn bản
// mã nguồn tĩnh)", không phải fixture-e2e, theo Proof Obligations của task này. Không
// lặp lại trong file này.
