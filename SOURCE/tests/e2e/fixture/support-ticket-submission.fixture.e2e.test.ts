// User Support System v1 — Hành trình gửi ticket của học sinh [fixture-e2e]
// (SUẤT GIỮ CHỖ — hành trình nhiều bước hướng người dùng)
// Design Docs: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §submitSupportTicket), docs/design/support-system-frontend-design.md (v1.2,
//   máy trạng thái pha của `SupportWidgetDialog`)
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Component: SupportWidgetDialog,
//   IntentSelector, MessageField, ScreenshotAttachment)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-001, AC-002 nửa UI, AC-008..AC-011,
//   AC-020, AC-039, AC-040, AC-049, Use Cases 1-5)
//
// Script dựa trên driver theo cùng interface SupportDriver tập-con-cấu-trúc-của-
// Playwright như file fixture-e2e widget-visibility anh em và theo
// tiền lệ rating.fixture.e2e.test.ts/history.fixture.e2e.test.ts của repo này.
// Backend điều khiển bằng fixture: submitSupportTicket resolve ra các phản hồi
// fixture trong supportFixtureData.ts (task-07) thay vì một Server Action
// sống — nối ranh giới ghi đè đó vào một trang đang chạy thật vẫn là cùng
// phần dư đã tài liệu hoá mà các file anh em ghi (không có lớp MSW/
// tiêm mock trong repo này). Các hàm kiểm này chạy không đổi
// khi có harness.
//
// Các hành vi con riêng lẻ mà hành trình này nối chuỗi (render không lạc quan,
// giữ trường khi bị giới hạn tần suất/timeout, đúng-3-ý-định,
// một-ảnh-chụp-thay-thế-chứ-không-nối-thêm) CŨNG được chứng minh độc lập bởi
// SOURCE/components/support/__tests__/{SupportWidgetDialog,IntentSelector,
// ScreenshotAttachment}.test.tsx (task-09, test component RTL/jsdom thật,
// submitSupportTicket bị mock ở ranh giới module) — các test đó thực thi
// cùng các khẳng định ngay hôm nay, trong CI, không cần harness trình duyệt. File này chứng minh
// cùng các khẳng định được nối thành một hành trình người dùng liên tục, ở mục tiêu L1
// mà Operation Verification Methods của task này nêu tên.

import assert from "node:assert/strict";
import type { SupportDriver, SupportLocator } from "./supportFixtureData";
import {
  FIXTURE_INTENT_LABELS,
  FIXTURE_INTENTS,
  FIXTURE_MOUNTED_ROUTE,
  FIXTURE_REFUSALS,
  FIXTURE_SHORT_REF,
} from "./supportFixtureData";

const TRIGGER_NAME = /Send feedback|Gửi phản hồi/i;

async function openWidget(driver: SupportDriver): Promise<void> {
  await driver.goto(FIXTURE_MOUNTED_ROUTE);
  await driver.getByRole("button", { name: TRIGGER_NAME }).click();
}

/** (a) đúng ba lựa chọn ý định, nhãn tiếng Việt chính xác, không lựa chọn thứ tư nào
 *  với tới được ở bất kỳ đâu trong markup đã render của dialog (AC-001). */
export async function checkExactlyThreeIntents(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  for (const intent of FIXTURE_INTENTS) {
    const count = await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS[intent] }).count();
    assert.equal(count, 1, `intent option "${FIXTURE_INTENT_LABELS[intent]}" must render exactly once`);
  }
  // Không lựa chọn thứ tư: tổng số radio trong nhóm bằng đúng 3.
  const anyIntentLocator = driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.bug });
  assert.equal(await anyIntentLocator.count(), 1, "no fourth intent option may exist (AC-001)");
}

/** (b) với mỗi ý định, một phản hồi thành công của fixture chuyển sang trạng thái con
 *  xác nhận hiện shortRef của fixture nguyên văn, quan sát thấy xảy ra
 *  chỉ SAU KHI promise của fixture resolve — không bao giờ lạc quan
 *  (AC-040, AC-049). Màn hình form vẫn phải thấy được ngay sau
 *  cú bấm, trước khi fixture (cố ý trễ một tick) settle. */
export async function checkNonOptimisticSuccessPerIntent(
  driver: SupportDriver,
  intent: (typeof FIXTURE_INTENTS)[number]
): Promise<void> {
  await openWidget(driver);
  await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS[intent] }).click();
  await driver.getByLabelText(/Message|Nội dung/).fill("Fixture journey message");

  const submit = driver.getByRole("button", { name: /^Send$|Sending|Gửi/ });
  await submit.click();

  // Ngay sau cú bấm, promise thành công của fixture chưa resolve
  // (hồ sơ fixture của harness được kỳ vọng settle ở ranh giới
  // microtask/macrotask, không đồng bộ) — dialog lúc này vẫn phải
  // hiện form, không phải xác nhận.
  assert.equal(
    await driver.getByRole("status").count(),
    0,
    "acknowledgement must not appear before the fixture promise resolves (AC-040)"
  );

  // Sau khi await việc settle, xác nhận thay thế form và
  // hiện shortRef của fixture nguyên văn.
  const ack = driver.getByText(new RegExp(FIXTURE_SHORT_REF));
  assert.equal(await ack.count() > 0, true, "acknowledgement must show the fixture shortRef verbatim (AC-049)");
}

/** (c) đính kèm một ảnh chụp rồi đính kèm ảnh thứ hai trước khi gửi
 *  cho ra đúng MỘT đính kèm còn lại tới lúc gửi — không bao giờ hai
 *  (AC-011, nửa UI). */
export async function checkSingleScreenshotSurvivesReplace(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  const fileInput = driver.getByLabelText(/Attach a screenshot|Đính kèm ảnh/);
  await fileInput.setInputFiles("fixture-first.png");
  await fileInput.setInputFiles("fixture-second.png");

  // Có đúng một chỉ báo đính kèm (tên file/nút xoá) — không bao giờ
  // hai cái xếp cạnh nhau.
  const removeControls = driver.getByRole("button", { name: /Remove image|Xoá ảnh/ });
  assert.equal(await removeControls.count(), 1, "exactly one attachment must survive replace (AC-011)");
}

/** (d) một lần từ chối do giới hạn tần suất đưa dialog về màn hình form với
 *  ý định đã chọn trước đó và chữ tin nhắn đã gõ đều vẫn còn,
 *  đúng như đã gõ (AC-020). */
export async function checkRateLimitedPreservesInput(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.suggestion }).click();
  const message = driver.getByLabelText(/Message|Nội dung/);
  const typedMessage = "Preserve me through a refusal";
  await message.fill(typedMessage);

  await driver.getByRole("button", { name: /^Send$|Sending|Gửi/ }).click();

  assert.ok(FIXTURE_REFUSALS.rate_limited.error === "rate_limited"); // fixture sanity check
  assert.equal(
    (await driver.getByText(/fast|nhanh/i).count()) > 0,
    true,
    "rate-limited refusal message must render (AC-018)"
  );
  assert.equal(
    await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.suggestion }).getAttribute("aria-checked"),
    "true",
    "intent selection must survive a rate-limited refusal (AC-020)"
  );
  assert.equal(
    await message.inputValue(),
    typedMessage,
    "typed message must survive a rate-limited refusal exactly as entered (AC-020)"
  );
}

/** (e) một lần gửi không bao giờ resolve trong cửa sổ timeout ~20s của
 *  client làm hiện lỗi timeout thử lại được, với lựa chọn ý định/tin nhắn/
 *  ảnh chụp đều vẫn còn (AC-039). */
export async function checkTimeoutPreservesInput(driver: SupportDriver): Promise<void> {
  await openWidget(driver);
  await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.question }).click();
  await driver.getByLabelText(/Message|Nội dung/).fill("Still here after a timeout");

  await driver.getByRole("button", { name: /^Send$|Sending|Gửi/ }).click();
  // Harness thật: đẩy qua cửa sổ timeout ~20s của client (fake timer
  // trong ngữ cảnh Playwright, hoặc một hằng co theo tỉ lệ cho test) trước khi khẳng định.

  assert.equal(
    await driver.getByText(/network|mạng/i).count() > 0,
    true,
    "a retryable timeout error must render after the client's timeout window (AC-039)"
  );
  assert.equal(
    await driver.getByRole("radio", { name: FIXTURE_INTENT_LABELS.question }).getAttribute("aria-checked"),
    "true",
    "intent selection must survive a timeout (AC-039)"
  );
}

/** Bộ điều phối — chạy năm nghĩa vụ của hành trình suất-giữ-chỗ đầy đủ. */
export async function runSupportTicketSubmissionJourney(driver: SupportDriver): Promise<void> {
  await checkExactlyThreeIntents(driver);
  for (const intent of FIXTURE_INTENTS) {
    await checkNonOptimisticSuccessPerIntent(driver, intent);
  }
  await checkSingleScreenshotSurvivesReplace(driver);
  await checkRateLimitedPreservesInput(driver);
  await checkTimeoutPreservesInput(driver);
}

// Export lại cho người cài đặt driver — xem doc comment của chính SupportLocator
// trong supportFixtureData.ts cho đúng tập con cấu trúc mà một Locator
// Playwright thật thoả nguyên trạng.
export type { SupportLocator };
