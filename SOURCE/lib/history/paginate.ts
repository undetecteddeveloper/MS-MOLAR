// Phân trang cho /history (theme "Sân trường", 2026-09-07).
//
// Bản trước (D3 của history-frontend-design v1.3) không phân trang mà nhốt cả
// danh sách vào một khung cuộn riêng cao 30rem — một vùng cuộn lồng trong
// trang cuộn, và trên điện thoại là hai thanh cuộn tranh nhau một ngón tay.
// Lý do D3 nêu ("trang còn nội dung khác bên dưới") không còn đúng: dưới danh
// sách không có gì nữa. Nên danh sách trải tự nhiên và cắt trang bằng `?page=`,
// cùng cơ chế với Kho đề (TD-026): mỗi trang là một URL chia sẻ/quay lại được.
//
// Cắt ở TRÌNH BÀY, không ở DB: `listMyHistory()` vốn đọc trọn lịch sử của một
// người trong biên `LIST_ROW_CEILING` và lọc trong bộ nhớ (lib/history/
// filterEntries.ts), nên phân trang chỉ là lát cắt cuối của cùng mảng đó —
// không thêm round-trip, không đổi luồng dữ liệu.

import { paginate } from "@/lib/pagination/paginate";

/** 20 dòng/trang: mỗi dòng ~96px ở 360px nên một trang ≈ 5 màn hình cuộn —
 *  đủ để lướt mà không dài tới mức phải tìm nút "Sau" ở đâu. */
export const HISTORY_PAGE_SIZE = 20;

export function paginateHistory<T>(
  ordered: T[],
  page: number
): { entries: T[]; page: number; pageCount: number; total: number } {
  const { items, ...rest } = paginate(ordered, page, HISTORY_PAGE_SIZE);
  return { entries: items, ...rest };
}
