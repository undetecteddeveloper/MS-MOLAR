// Bộ định dạng ngày/giờ DÙNG CHUNG cho cả server component lẫn client
// component (UI Spec UI-D12, đóng TBD-03).
//
// Hai thứ được GHIM, và cả hai đều là điều kiện để một hàm phục vụ được cả hai
// phía của ranh giới RSC:
//
//   1. `timeZone: "Asia/Ho_Chi_Minh"`. Không ghim thì cùng một instant ra hai
//      NGÀY LỊCH khác nhau tuỳ chỗ render: Vercel chạy UTC, nên 00:30 ICT hiện
//      thành ngày hôm trước. Sản phẩm bán bằng VNĐ qua VietQR cho học sinh
//      Việt Nam, một múi giờ cố định là mô hình đúng của hôm nay. Tiêu chí
//      khai tử: thị trường ngoài VN đầu tiên, hoặc múi giờ do người dùng chọn
//      — chữ ký hàm đã chừa sẵn chỗ cho một giá trị theo từng người.
//   2. Ngôn ngữ TRUYỀN VÀO, không để `Intl` tự suy. Locale ngầm định phân giải
//      theo ngôn ngữ của MÁY CHỦ chứ không theo cookie của người dùng — đúng
//      thứ mà cả lớp i18n của repo này sinh ra để tránh.
//
// Ghim đủ hai thứ ⇒ server và browser in ra CÙNG MỘT chuỗi byte, nên một client
// component tự format được mà không lệch hydration.
//
// KHÔNG dùng lại `lib/history/format.ts:19` hay `ExamRow.tsx:68`: cả hai dựng
// chuỗi bằng `getDate()/getHours()`, tức đọc múi giờ của RUNTIME. Việc thay
// bốn chỗ gọi cũ sang module này là TBD-08, cố ý KHÔNG gộp vào thay đổi thanh
// toán — đổi thứ một màn hình đang chạy in ra là thay đổi nhìn thấy được mà
// không có AC nào đứng sau.
//
// Hợp đồng lỗi chép nguyên của `lib/history/format.ts`: null/rỗng/không phân
// tích được → "—", và KHÔNG BAO GIỜ ném. Đẻ thêm quy ước thất bại thứ hai chỉ
// làm chỗ gọi phải nhớ hai thứ.

import type { Locale } from "@/lib/i18n/locales";

const EM_DASH = "—";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Mã BCP-47 dùng cho từng ngôn ngữ của giao diện. `en` ánh xạ sang `en-GB` chứ
 * không phải `en-US`: người đọc màn hình này ở Việt Nam, và `en-US` in ra
 * MM/DD/YYYY — một ngày 08/09 sẽ bị đọc thành hai ngày khác nhau tuỳ người.
 */
const LOCALE_TAG: Record<Locale, string> = {
  en: "en-GB",
  vi: "vi-VN",
};

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
export function formatDate(iso: string | null, locale: Locale): string {
  const d = parse(iso);
  if (d === null) return EM_DASH;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], DATE_OPTIONS).format(d);
}

/** "DD/MM/YYYY HH:mm" theo giờ Việt Nam; "—" cho null/rỗng/không đọc được; không ném. */
export function formatDateTime(iso: string | null, locale: Locale): string {
  const d = parse(iso);
  if (d === null) return EM_DASH;
  // Ngày và giờ đi qua HAI formatter rồi nối bằng một dấu cách, thay vì một
  // formatter gộp: bản gộp chèn dấu phân cách theo từng bản ICU (", " ở nhiều
  // bản), tức chuỗi in ra đổi theo phiên bản runtime — đúng thứ việc ghim
  // locale và múi giờ đang cố loại bỏ.
  const tag = LOCALE_TAG[locale];
  const date = new Intl.DateTimeFormat(tag, DATE_OPTIONS).format(d);
  const time = new Intl.DateTimeFormat(tag, TIME_OPTIONS).format(d);
  return `${date} ${time}`;
}
