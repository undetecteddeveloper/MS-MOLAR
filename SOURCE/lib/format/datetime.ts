// Bộ định dạng ngày/giờ DÙNG CHUNG cho cả server component lẫn client
// component (UI Spec UI-D12, đóng TBD-03).
//
// Hai thứ được GHIM, và cả hai đều là điều kiện để một hàm phục vụ được cả hai
// phía của ranh giới RSC:
//
//   1. `timeZone: "Asia/Ho_Chi_Minh"`. Không ghim thì cùng một instant ra hai
//      NGÀY LỊCH khác nhau tuỳ chỗ render: Vercel chạy UTC, nên 00:30 ICT hiện
//      thành ngày hôm trước. Sản phẩm phục vụ học sinh Việt Nam, một múi giờ
//      cố định là mô hình đúng của hôm nay.
//   2. Locale ghim `vi-VN`, không để `Intl` tự suy: locale ngầm định phân giải
//      theo ngôn ngữ của MÁY CHỦ, và server với browser sẽ in ra hai chuỗi
//      khác nhau → lệch hydration. (Trước 2026-09-04 locale là tham số vì site
//      có hai ngôn ngữ; nay chỉ còn tiếng Việt.)
//
// Ghim đủ hai thứ ⇒ server và browser in ra CÙNG MỘT chuỗi byte.
//
// Hợp đồng lỗi chép nguyên của `lib/history/format.ts`: null/rỗng/không phân
// tích được → "—", và KHÔNG BAO GIỜ ném.

const EM_DASH = "—";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const LOCALE_TAG = "vi-VN";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

// `hourCycle: "h23"` chứ không phải `hour12: false`: ở một số bản ICU, tắt
// hour12 cho ra "24:00" tại nửa đêm thay vì "00:00".
const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

function parse(iso: string | null): Date | null {
  if (iso === null || iso === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "DD/MM/YYYY" theo giờ Việt Nam; "—" cho null/rỗng/không đọc được; không ném. */
export function formatDate(iso: string | null): string {
  const d = parse(iso);
  if (d === null) return EM_DASH;
  return new Intl.DateTimeFormat(LOCALE_TAG, DATE_OPTIONS).format(d);
}

/** "DD/MM/YYYY HH:mm" theo giờ Việt Nam; "—" cho null/rỗng/không đọc được; không ném. */
export function formatDateTime(iso: string | null): string {
  const d = parse(iso);
  if (d === null) return EM_DASH;
  // Ngày và giờ đi qua HAI formatter rồi nối bằng một dấu cách, thay vì một
  // formatter gộp: bản gộp chèn dấu phân cách theo từng bản ICU (", " ở nhiều
  // bản), tức chuỗi in ra đổi theo phiên bản runtime.
  const date = new Intl.DateTimeFormat(LOCALE_TAG, DATE_OPTIONS).format(d);
  const time = new Intl.DateTimeFormat(LOCALE_TAG, TIME_OPTIONS).format(d);
  return `${date} ${time}`;
}
