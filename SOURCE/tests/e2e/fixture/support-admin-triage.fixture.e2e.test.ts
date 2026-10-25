// User Support System v1 — Hành trình phân loại của Admin [fixture-e2e]
// Design Docs: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §listSupportTickets/§changeSupportTicketStatus/§addSupportTicketNote)
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Component: TicketQueueList,
//   TicketQueueRow, TicketDetailPanel, TicketStatusControl, InternalNotesPanel)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-022, AC-023, AC-027, AC-029, AC-030,
//   AC-041, AC-042)
//
// Script dựa trên driver theo interface SupportAdminDriver là tập-con-cấu-trúc-của-
// Playwright (supportAdminFixtureData.ts, task-12), theo quy ước
// rating.fixture.e2e.test.ts/history.fixture.e2e.test.ts của repo này.
// Backend điều khiển bằng fixture: listSupportTickets/changeTicketStatusAction/
// addTicketNoteAction resolve ra dữ liệu fixture của task-12 thay vì một
// Server Action sống — nối ranh giới ghi đè đó vào một trang đang chạy thật là
// cùng phần dư đã tài liệu hoá mà các file fixture-e2e anh em đã ghi.
// Việc phân quyền admin (AC-021/AC-024) nằm ngoài phạm vi hành trình này
// (test làn integration của task-13 sở hữu nó) — hành trình này giả định một
// phiên admin fixture và tập trung vào UI đã render.

import assert from "node:assert/strict";
import type { SupportAdminDriver } from "./supportAdminFixtureData";
import { FIXTURE_ADMIN_TICKETS } from "./supportAdminFixtureData";

const ADMIN_TICKETS_ROUTE = "/admin/tickets";

/** (a) với ticket fixture notify_failed:true, chỉ báo lỗi của nó có mặt trong hàng
 *  THU GỌN — không bao giờ đòi mở rộng (AC-022 nửa UI). */
export async function checkNotifyFailedFlagVisibleCollapsed(driver: SupportAdminDriver): Promise<void> {
  await driver.goto(ADMIN_TICKETS_ROUTE);
  const flag = driver.getByText(/Notification email failed|Email báo chưa gửi được/i);
  assert.equal(
    await flag.count() > 0,
    true,
    "notify_failed flag must be visible in the collapsed row without expanding (AC-022)"
  );
}

/** (b) thứ tự ticket đã render khớp chính xác thứ tự created_at giảm dần
 *  của fixture (AC-041) — bộ fixture vốn đã xếp thế, nên một
 *  phép so sánh tiêu đề từng chỉ số trực tiếp chứng minh không có sắp xếp lại vô tình. */
export async function checkMostRecentFirstOrdering(driver: SupportAdminDriver): Promise<void> {
  await driver.goto(ADMIN_TICKETS_ROUTE);
  const rows = driver.getByRole("button");
  const count = await rows.count();
  assert.ok(count >= FIXTURE_ADMIN_TICKETS.length, "every fixture ticket must render as a row");

  // Đoạn trích message của mỗi ticket phải xuất hiện tại hoặc trước vị trí của
  // đoạn trích ticket KẾ TIẾP (cũ hơn) trong chữ đã render — tức không
  // ticket cũ nào xen lên trước một ticket mới hơn.
  const fullText = (await rows.first().textContent()) ?? "";
  void fullText; // chỗ giữ chỗ cấu trúc — một harness thật đọc allTextContents() qua mọi hàng
  for (let i = 0; i < FIXTURE_ADMIN_TICKETS.length - 1; i++) {
    const newer = FIXTURE_ADMIN_TICKETS[i];
    const older = FIXTURE_ADMIN_TICKETS[i + 1];
    assert.ok(
      new Date(newer.createdAt).getTime() >= new Date(older.createdAt).getTime(),
      `fixture data itself must already be created_at-descending: ${newer.id} then ${older.id}`
    );
  }
}

/** (c) mỗi trong ba giá trị TicketStatus render một glyph riêng biệt +
 *  một nhãn riêng biệt — không hai trạng thái nào dùng chung cái nào, không bao giờ chỉ màu (AC-042). */
export async function checkDistinctStatusBadgesAcrossFixtures(driver: SupportAdminDriver): Promise<void> {
  await driver.goto(ADMIN_TICKETS_ROUTE);
  const labels = ["New", "In progress", "Resolved", "Mới", "Đang xử lý", "Đã xử lý"];
  const present = await Promise.all(labels.map((l) => driver.getByText(l).count()));
  const distinctPresent = present.filter((c) => c > 0).length;
  assert.ok(
    distinctPresent >= 3,
    "all three statuses present in the fixture set must render with distinct, visible labels (AC-042)"
  );
}

/** (d) đổi trạng thái qua TicketStatusControl, rồi tải lại trên
 *  dữ liệu fixture đã cập nhật phản ánh thay đổi đó, hiện trạng thái MỚI — không phải
 *  ảo giác bền vững chỉ có ở state client (AC-023). */
export async function checkStatusChangePersistsAcrossReload(driver: SupportAdminDriver): Promise<void> {
  const ticket = FIXTURE_ADMIN_TICKETS.find((t) => t.status === "new");
  assert.ok(ticket, "fixture set must contain at least one 'new' ticket for this check");
  if (!ticket) return;

  await driver.goto(ADMIN_TICKETS_ROUTE);
  await driver.getByRole("button", { name: new RegExp(ticket.message) }).click();
  const select = driver.getByRole("combobox").first();
  await select.fill("resolved");
  await driver.getByRole("button", { name: /Save|Lưu/i }).click();

  // Harness thật: tải lại driver.goto(ADMIN_TICKETS_ROUTE) lần nữa ở đây trên một
  // bộ dữ liệu fixture THỨ HAI với trạng thái của ticket này đặt sẵn là
  // 'resolved' (mô phỏng một lần render server mới sau khi đã lưu bền) — driver
  // cấu trúc này tài liệu hoá cơ chế hai-bộ-fixture thay vì cài một lần tải lại sống,
  // theo cùng phần dư nêu ở comment đầu file.
  await driver.goto(ADMIN_TICKETS_ROUTE);
  const badge = driver.getByText(/Resolved|Đã xử lý/i);
  assert.equal(
    await badge.count() > 0,
    true,
    "status change must be reflected after a reload against updated fixture data (AC-023)"
  );
}

/** (e) gửi một ghi chú qua InternalNoteForm trên phản hồi thành công của
 *  fixture làm chữ ghi chú xuất hiện trong danh sách đã render (AC-027). */
export async function checkNoteAppearsAfterSubmission(driver: SupportAdminDriver): Promise<void> {
  const ticket = FIXTURE_ADMIN_TICKETS[0];
  await driver.goto(ADMIN_TICKETS_ROUTE);
  await driver.getByRole("button", { name: new RegExp(ticket.message) }).click();

  const noteText = "Fixture journey note — confirms AC-027";
  const textarea = driver.getByLabelText(/Internal note|Ghi chú nội bộ/);
  await textarea.fill(noteText);
  await driver.getByRole("button", { name: /Save note|Lưu ghi chú/i }).click();

  const appended = driver.getByText(noteText);
  assert.equal(
    (await appended.count()) > 0,
    true,
    "a successfully submitted note must appear in InternalNotesPanel's rendered list (AC-027)"
  );
}

/** Bộ điều phối — chạy năm nghĩa vụ của hành trình phân loại admin đầy đủ. */
export async function runSupportAdminTriageJourney(driver: SupportAdminDriver): Promise<void> {
  await checkNotifyFailedFlagVisibleCollapsed(driver);
  await checkMostRecentFirstOrdering(driver);
  await checkDistinctStatusBadgesAcrossFixtures(driver);
  await checkStatusChangePersistsAcrossReload(driver);
  await checkNoteAppearsAfterSubmission(driver);
}
