import "server-only";

// MỘT lời khai của "hôm nay là ngày nào theo múi giờ nhà cung cấp reset hạn
// mức", dùng chung bởi bộ đếm ngân sách Gemini (lib/billing/quota.ts) và bộ
// đếm ngân sách Groq (lib/essay/budget.ts). Lý do nó là MỘT chỗ chứ không hai
// đã được viết sẵn ở quota.ts:9-18 cho cặp đọc/ghi: hai lần suy ra độc lập
// lệch nhau ở một phép làm tròn hay một bản nâng ICU sẽ chia đôi một bộ đếm
// mà KHÔNG có gì đỏ ở đâu cả. Cặp thứ hai (hai provider) có đúng chế độ hỏng
// ấy, nên nó dùng đúng lời khai ấy.
//
// PHẠM VI: file này chỉ biết về NGÀY và TTL. Nó không biết trần chi là bao
// nhiêu, biến môi trường nào chứa trần đó, hay gói nào được bao nhiêu phần —
// những thứ ấy khác nhau giữa hai provider và ở lại phía consumer.

/** Ngày lịch của ngân sách, theo múi giờ nhà cung cấp reset hạn mức (D6/R7). */
const BUDGET_TIME_ZONE = "America/Los_Angeles";

/** Ngày lịch Pacific dạng `YYYY-MM-DD`.
 *
 *  Ghép từ `formatToParts` chứ không nhờ một locale in hộ: cùng một locale có
 *  thể đổi cách in giữa hai bản ICU, và một khoá đếm đổi hình dạng theo phiên
 *  bản Node là một ngân sách bị chia đôi giữa hai runtime. Cũng không dùng
 *  `toISOString().slice(0, 10)`: đó là ngày UTC, và tại 05:30Z ngày Pacific đã
 *  là ngày HÔM TRƯỚC. */
const PACIFIC_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: BUDGET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Khoá ngân sách sống 26 giờ: dài hơn một ngày Pacific (24h, hoặc 23/25 vào
 *  hai ngày đổi giờ) đủ để không khoá nào bị xoá khi ngày còn đang chạy, và
 *  ngắn đủ để khoá hôm qua không sống sang ngày kia. */
export const BUDGET_TTL_SECONDS = 26 * 60 * 60;

/** Ngày lịch Pacific dạng `YYYY-MM-DD`.
 *
 *  HÀM NÀY TRẢ VỀ NGÀY, KHÔNG TRẢ VỀ KHOÁ — và đó là một lựa chọn có lý do,
 *  ghi lại ở đây vì bản đầu của § MSA-3 viết là `pacificDayKey(prefix, now)`.
 *
 *  Hai lý do, cả hai đều đo được chứ không phải thẩm mỹ:
 *
 *  1. CỔNG CANH Ở `quota.test.ts:868` QUÉT VĂN BẢN NGUỒN. Nó đòi toàn repo
 *     có ĐÚNG MỘT chỗ dựng mẫu khoá `ai:budget:`, bằng regex
 *     `/["'`]ai:budget:/` — một dấu nháy NGAY TRƯỚC `ai:budget:`. Nếu ta
 *     truyền `"ai:budget"` vào một hàm dựng khoá thì literal trong nguồn là
 *     `"ai:budget"` — dấu nháy ĐÓNG nằm đúng chỗ cổng canh cần dấu hai chấm,
 *     nên nó khớp KHÔNG file nào. Cổng không chỉ đỏ: nó THÔI CANH, ngay
 *     trong lượt commit có mục đích làm nó mạnh hơn.
 *
 *  2. `pacificDayKey(prefix, now)` dựng một cái bẫy IM LẶNG cho consumer thứ
 *     hai. Prefix phải KHÔNG kèm dấu hai chấm cuối, nhưng không gì cưỡng chế
 *     được điều đó: `pacificDayKey("groq:budget:", now)` cho ra
 *     `groq:budget::2026-02-28`, và bỏ dấu hai chấm thì lại đúng. Một hợp đồng
 *     mà dùng sai không có gì đỏ chính là chế độ hỏng mà § MSA-3 tồn tại để
 *     chặn.
 *
 *  Đổi lại, MẪU KHOÁ của mỗi provider được viết NGUYÊN VẸN trong file sở
 *  hữu nó (`ai:budget:${...}` ở quota.ts, `groq:budget:${...}` ở
 *  lib/essay/budget.ts). Phần dễ sai — suy ra NGÀY theo múi giờ — vẫn chỉ có
 *  MỘT lời khai, đúng điều § MSA-3 muốn; phần còn lại chỉ là ghép chuỗi.
 *
 *  @param now đồng hồ được TIÊM vào, không đọc `Date.now()` bên trong: khoá
 *    của một lượt ghi phải là khoá của thời điểm lượt ghi ấy được quyết định,
 *    không phải thời điểm hàm này tình cờ chạy. */
export function pacificDay(now: Date): string {
  const parts = PACIFIC_DAY.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
