// Thời gian tương đối DÙNG CHUNG ("Cập nhật 3 ngày trước") cho danh sách bài
// giải, màn xem bài giải và tab Bình luận của hồ sơ (UI Spec § Bản đồ dùng lại:
// một hàm cho cả ba bề mặt, không để mỗi nơi tự viết một kiểu).
//
// Thang: dưới 1 phút "Vừa xong" → phút → giờ (dưới 24 giờ trôi qua) → "Hôm
// qua" → "n ngày trước" (tới 30) → quá 30 ngày thì về `formatDate`.
//
// Từ "Hôm qua" trở đi đếm NGÀY LỊCH theo giờ Việt Nam, không đếm 24 giờ trôi
// qua: 23:00 hôm kia nhìn lúc 01:00 sáng nay là 26 giờ, nhưng người đọc gọi nó
// là "2 ngày trước", không phải "Hôm qua". Múi giờ ghim cùng lý do với
// datetime.ts — Vercel chạy UTC, không ghim thì server và trình duyệt ra hai
// ngày lịch khác nhau.
//
// `now` là tham số để server component truyền một mốc cố định xuống client:
// hai lần gọi với `new Date()` khác nhau ở server và lúc hydrate sẽ in ra hai
// chuỗi khác nhau. Hợp đồng lỗi giống formatDate: null/rỗng/không đọc được →
// "—", không bao giờ ném.

import { t } from "@/lib/copy";
import { formatDate } from "@/lib/format/datetime";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_RELATIVE_DAYS = 30;

const CALENDAR_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Số thứ tự ngày lịch (theo giờ Việt Nam) của một instant — hiệu hai số này là
 *  số nửa đêm đã qua giữa hai mốc. */
function calendarDayIndex(instant: Date): number {
  const parts = CALENDAR_DAY.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Math.round(Date.UTC(read("year"), read("month") - 1, read("day")) / DAY_MS);
}

export function relativeTime(iso: string | null, now: Date = new Date()): string {
  const then = iso ? new Date(iso) : null;
  if (then === null || Number.isNaN(then.getTime())) return formatDate(iso);

  // Mốc ở tương lai chỉ có thể là đồng hồ máy lệch — "Vừa xong", không số âm.
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE_MS) return t("time.justNow");
  if (elapsed < HOUR_MS) return t("time.minutesAgo", { count: Math.floor(elapsed / MINUTE_MS) });
  if (elapsed < DAY_MS) return t("time.hoursAgo", { count: Math.floor(elapsed / HOUR_MS) });

  const days = calendarDayIndex(now) - calendarDayIndex(then);
  if (days <= 1) return t("time.yesterday");
  if (days <= MAX_RELATIVE_DAYS) return t("time.daysAgo", { count: days });
  return formatDate(iso);
}
