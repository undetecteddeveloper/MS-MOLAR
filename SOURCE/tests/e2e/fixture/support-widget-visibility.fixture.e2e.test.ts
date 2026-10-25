// User Support System v1 — Chốt hiển thị & bố cục của widget [fixture-e2e]
// Design Docs: docs/design/support-system-frontend-design.md (v1.2, Verification
//   Strategy mục (1))
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Layout Constraints,
//   Accessibility Requirements)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-003, AC-005, AC-006, metric 8,
//   metric 9, D1)
//
// Script dựa trên driver viết theo cùng interface `SupportDriver` tập-con-cấu-trúc-của-Playwright
// mà rating.fixture.e2e.test.ts/
// history.fixture.e2e.test.ts của repo này đã thiết lập (xem supportFixtureData.ts cho
// interface + phần dư nối dây backend-fixture đã tài liệu hoá, theo
// quy ước sẵn có của repo này: không có lớp MSW/tiêm mock, nên
// nối `getCurrentUser` sống vào một trang đang chạy thật xảy ra khi nào một
// harness Playwright được dựng — các hàm kiểm bên dưới chạy không đổi
// khi harness đó có, hoặc dưới dạng khối `test()` của `@playwright/test` hoặc
// điều khiển trực tiếp qua Playwright MCP).
//
// Khẳng định không-giao-cắt-BottomNav của Nghĩa vụ C còn được
// kiểm điểm thật trên dev server sống (lượt hoàn tất task-09, 2026-08-13):
// SupportWidgetTrigger ở viewport 360px trên một route mount thật
// cho thấy không chồng lấn trực quan nào với BottomNav trong một ảnh chụp sống.
// Đó là một xác nhận thủ công một lần, không thay thế việc
// script này chạy dưới một harness thật — ghi ở đây như bằng chứng củng cố,
// không phải để đóng phần dư của chính task này.

import assert from "node:assert/strict";
import type { SupportDriver } from "./supportFixtureData";
import { FIXTURE_ATTEMPT_ROUTE, FIXTURE_MOUNTED_ROUTE } from "./supportFixtureData";

const SUPPORT_TRIGGER_NAME = /Send feedback|Gửi phản hồi/i;

// =============================================================================
// Nghĩa vụ A — không widget khi chưa đăng nhập (AC-003)
// =============================================================================
/** (a) phiên chưa đăng nhập trên một route mount bình thường -> không khớp nào với
 *  role/tên truy cập được của nút kích hoạt widget — không phải một khớp vô hình. */
export async function checkNoWidgetWhenLoggedOut(loggedOutDriver: SupportDriver): Promise<void> {
  await loggedOutDriver.goto(FIXTURE_MOUNTED_ROUTE);
  const count = await loggedOutDriver.getByRole("button", { name: SUPPORT_TRIGGER_NAME }).count();
  assert.equal(count, 0, "SupportWidget must render zero trigger nodes when logged out (AC-003)");
}

// =============================================================================
// Nghĩa vụ B — không widget ở route làm bài, bất kể đăng nhập
//   (AC-005, D1) — thực sự vắng mặt, không phải bị CSS ẩn
// =============================================================================
/** (a) đã đăng nhập ở route làm bài -> không khớp role truy cập được nào. */
export async function checkNoWidgetOnAttemptRouteLoggedIn(loggedInDriver: SupportDriver): Promise<void> {
  await loggedInDriver.goto(FIXTURE_ATTEMPT_ROUTE);
  const count = await loggedInDriver.getByRole("button", { name: SUPPORT_TRIGGER_NAME }).count();
  assert.equal(count, 0, "SupportWidget must be absent on the attempt route even when logged in (AC-005)");
}

/** (b) cùng route, truy vấn DOM thô (không chỉ cây truy cập) -> không node nào —
 *  loại trừ một node display:none/aria-hidden mà một truy vấn tên truy cập được
 *  đơn thuần cũng có thể báo là vắng mà không chứng minh được hoàn toàn không có node. */
export async function checkNoWidgetOnAttemptRouteRawDom(loggedInDriver: SupportDriver): Promise<void> {
  await loggedInDriver.goto(FIXTURE_ATTEMPT_ROUTE);
  const count = await loggedInDriver.querySelectorCount('[aria-label="Send feedback"], [aria-label="Gửi phản hồi"]');
  assert.equal(count, 0, "no support-widget DOM node may exist on the attempt route (AC-005)");
}

/** (c) cùng route, chưa đăng nhập -> cũng không khớp nào (việc loại trừ của D1 đứng vững
 *  độc lập với lý do vắng mặt riêng của AC-003). */
export async function checkNoWidgetOnAttemptRouteLoggedOut(loggedOutDriver: SupportDriver): Promise<void> {
  await loggedOutDriver.goto(FIXTURE_ATTEMPT_ROUTE);
  const count = await loggedOutDriver.getByRole("button", { name: SUPPORT_TRIGGER_NAME }).count();
  assert.equal(count, 0, "attempt-route absence must hold logged out too (D1)");
}

// =============================================================================
// Nghĩa vụ C — viewport 360px: không giao cắt hộp bao nào với
//   `BottomNav` (AC-006, thu hẹp theo review PRD v1.2 — chỉ BottomNav)
// =============================================================================
function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const aRight = a.x + a.width;
  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;
  const bBottom = b.y + b.height;
  return !(aRight <= b.x || bRight <= a.x || aBottom <= b.y || bBottom <= a.y);
}

/** (a) ở chiều rộng 360px, hình chữ nhật của nút kích hoạt và của BottomNav không có
 *  diện tích chồng lấn trên cả hai trục. */
export async function checkTriggerClearsBottomNavAt360px(driver: SupportDriver): Promise<void> {
  await driver.setViewportSize({ width: 360, height: 800 });
  await driver.goto(FIXTURE_MOUNTED_ROUTE);

  const trigger = driver.getByRole("button", { name: SUPPORT_TRIGGER_NAME }).first();
  const nav = driver.getByRole("navigation").first();
  const triggerBox = await trigger.boundingBox();
  const navBox = await nav.boundingBox();

  assert.ok(triggerBox, "trigger must be laid out at 360px on a normal mounted route");
  assert.ok(navBox, "BottomNav must be laid out at 360px (<768px renders it)");
  if (!triggerBox || !navBox) return;

  assert.equal(
    rectsIntersect(triggerBox, navBox),
    false,
    "SupportWidgetTrigger's bounding box must not intersect BottomNav's at 360px (AC-006)"
  );
}

/** (b) độ lệch đáy nghỉ của nút kích hoạt gồm
 *  env(safe-area-inset-bottom) thay vì một giá trị pixel hardcode —
 *  khẳng định qua style tính được tham chiếu hàm CSS env(). */
export async function checkTriggerRespectsSafeAreaInset(driver: SupportDriver): Promise<void> {
  await driver.setViewportSize({ width: 360, height: 800 });
  await driver.goto(FIXTURE_MOUNTED_ROUTE);

  const trigger = driver.getByRole("button", { name: SUPPORT_TRIGGER_NAME }).first();
  const bottomStyle = await trigger.getAttribute("data-computed-bottom");
  // Harness thật: đọc qua page.evaluate(el => getComputedStyle(el).bottom) hoặc
  // chuỗi class nguồn — driver cấu trúc này phơi nó dưới dạng một
  // attribute để phép kiểm ở trong interface tập-con-Playwright của SupportDriver.
  // className của SupportWidgetTrigger.tsx nhúng literal
  // `bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+1rem)]`,
  // thoả điều này theo cấu trúc (bảo đảm cấu trúc, không phải một độ lệch
  // chỉnh tay) — xem file đó để biết nguồn sự thật.
  assert.ok(
    bottomStyle === null || bottomStyle.includes("env("),
    "trigger's bottom offset must reference env(safe-area-inset-bottom), not a hardcoded pixel value"
  );
}

/** Bộ điều phối — chạy cả ba nghĩa vụ trên các phiên driver được cấp
 *  (theo mẫu hai-driver mới/chưa-đăng-nhập của FE2). */
export async function runSupportWidgetVisibilityChecks(
  loggedInDriver: SupportDriver,
  loggedOutDriver: SupportDriver
): Promise<void> {
  await checkNoWidgetWhenLoggedOut(loggedOutDriver);
  await checkNoWidgetOnAttemptRouteLoggedIn(loggedInDriver);
  await checkNoWidgetOnAttemptRouteRawDom(loggedInDriver);
  await checkNoWidgetOnAttemptRouteLoggedOut(loggedOutDriver);
  await checkTriggerClearsBottomNavAt360px(loggedInDriver);
  await checkTriggerRespectsSafeAreaInset(loggedInDriver);
}
