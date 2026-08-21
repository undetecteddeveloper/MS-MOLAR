// verify-leave-guard — kiểm màn LÀM BÀI bằng CỬ CHẠM THẬT của trình duyệt.
//
// ⚠ VÌ SAO PHẢI CÓ SCRIPT NÀY, CHỨ KHÔNG PHẢI THÊM MỘT UNIT TEST ⚠
//
// Lỗi "lớp phủ LOADING đè lên hộp thoại xác nhận rời trang" đã thoát lưới HAI
// LẦN, và cả hai lần đều vì cùng một lý do: nó KHÔNG tái hiện được bằng
// `element.click()` — mà đó lại đúng là thứ jsdom (vitest) và mọi lượt kiểm
// bằng `page.evaluate(() => el.click())` sử dụng.
//
//   - Sự kiện do TRÌNH DUYỆT phát: sau MỖI listener, stack JS rỗng ⇒ có một
//     microtask checkpoint ngay tại đó. Đo được:
//         ["microtask saw marked=false", "guard marked"]
//   - Sự kiện do SCRIPT phát: dispatch nằm trong một lượt gọi JS, stack chưa
//     rỗng ⇒ không checkpoint giữa chừng. Đo được:
//         ["guard marked", "microtask saw marked=true"]
//
// Nghĩa là một bản sửa dựa vào thứ tự/thời điểm giữa hai listener có thể xanh
// hết ở test mà vẫn hỏng với người dùng thật. Bản sửa hiện tại KHÔNG dựa vào
// thứ tự nữa (CHỐT ĐIỀU HƯỚNG, xem lib/nav/pageNavigation.ts) — script này là
// thứ chứng minh điều đó trên trình duyệt thật.
//
// Cách chạy (cần một server đang phục vụ BẢN BUILD, không phải `next dev`):
//     npm run build && npm run start          # cửa sổ 1
//     node scripts/verify-leave-guard.mjs http://localhost:3000
// Trỏ vào prod cũng được: node scripts/verify-leave-guard.mjs https://ms-molar.vercel.app
//
// Tài khoản test + mật khẩu dùng lại đúng bộ của scripts/perf-layers.ts (tài
// khoản RLS dùng một lần, không phải tài khoản thật của ai).

import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = "smithnguyen247+rlstesta@gmail.com";
const PASSWORD = "rls-test-password-123";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

console.log(`→ ${BASE}`);
await page.goto(`${BASE}/?auth=signin`, { waitUntil: "domcontentloaded" });
await page.fill("input[placeholder='Email']", EMAIL);
await page.fill("input[placeholder='Password']", PASSWORD);
await page.click("form button[type='submit']");
await page.waitForURL("**/exams", { timeout: 60_000 });

const href = await page.locator('a[href^="/exams/"]').first().getAttribute("href");
await page.goto(BASE + href, { waitUntil: "domcontentloaded" });
await page.click("button:has-text('Start')");
await page.waitForURL("**/attempt/**", { timeout: 60_000 });

// Chờ HYDRATE XONG. Trước hydrate, <a> chỉ là thẻ neo thuần: chạm vào là điều
// hướng cứng thật sự và useLeaveGuard chưa tồn tại để chặn. Chạy quá sớm thì
// script BÁO FAIL (không phải báo pass nhầm), nên chờ rộng tay là đủ.
await page.waitForLoadState("networkidle");
await page.waitForTimeout(6_000);

const probe = () =>
  page.evaluate(() => {
    const ov = document.querySelector(".route-loading");
    return {
      dialog: !!document.querySelector('[role="dialog"]'),
      pending: ov ? ov.getAttribute("data-pending") : "absent",
    };
  });

// 1. Chạm nút quay về → hộp thoại hiện, lớp phủ PHẢI im.
await page.locator('a[aria-label="Back to the exam list"]').click();
await page.waitForTimeout(500);
check("chạm nút quay về → hộp thoại hiện, KHÔNG có lớp phủ", await probe(), {
  dialog: true,
  pending: "false",
});

// 2. Vẫn phải im sau đó — không có hẹn giờ nào bị bỏ lại để bật lên muộn.
await page.waitForTimeout(2_500);
check("2.5s sau vẫn im", await probe(), { dialog: true, pending: "false" });

// 3. Bấm "Rời trang" — ĐÂY mới là lúc lớp phủ được chạy.
await page.getByRole("button", { name: /leave|rời/i }).click();
await page.waitForTimeout(250);
check("bấm Leave → lớp phủ chạy", { pending: (await probe()).pending }, { pending: "true" });

// 4. Tới nơi thì lớp phủ tự tắt.
await page.waitForURL("**/exams", { timeout: 60_000 });
await page.waitForTimeout(1_200);
check("tới /exams → lớp phủ tắt", { pending: (await probe()).pending }, { pending: "false" });

// 5. Ngoài màn làm bài, lớp phủ chạy bình thường — tức CHỐT ĐÃ NHẢ.
//    KHÔNG đo bằng "chờ 150ms rồi nhìn": route mới có thể commit xong trong
//    ngần đó trên máy local, lúc đó pending đã tự tắt và ta kết luận nhầm là
//    chốt còn kẹt. Đặt MutationObserver TRƯỚC khi bấm để bắt cả lần bật rồi
//    tắt ngay.
await page.evaluate(() => {
  window.__seenPending = false;
  const ov = document.querySelector(".route-loading");
  new MutationObserver(() => {
    if (ov.getAttribute("data-pending") === "true") window.__seenPending = true;
  }).observe(ov, { attributes: true, attributeFilter: ["data-pending"] });
});
// `:visible` — ở 390px dãy tag ngang của SiteHeader bị ẩn, chỉ ô ở BottomNav
// mới bấm được; lấy nhầm cái ẩn thì Playwright chờ mãi rồi timeout.
await page.locator('a[href="/history"]:visible').first().click();
await page.waitForTimeout(400);
const seen = await page.evaluate(() => window.__seenPending ?? false).catch(() => "navigated-away");
check("route thường → chốt đã nhả, lớp phủ vẫn chạy", { seen }, { seen: true });

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
