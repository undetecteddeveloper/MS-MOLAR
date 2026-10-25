// filterHistoryEntries — vị từ thuần áp các tiêu chí đã chọn của HistoryFilters
// lên MyHistoryEntry[] đã lấy về sẵn (front-adjust). Tách riêng khỏi
// queries.ts: lọc mảng lịch sử có giới hạn của chính người dùng ngay trong
// bộ nhớ tránh phải thêm 4 nhánh điều kiện WHERE vào 3 lượt gọi Supabase
// tuần tự của listMyHistory() mà không được lợi gì đáng kể — RLS đã giới hạn
// lượt đọc theo auth.uid(), nên lượt lấy không lọc
// vốn nhỏ theo từng người dùng.
import type { MyHistoryEntry } from "@/features/history/queries";

export interface HistoryEntryFilters {
  subject?: string;
  examId?: string;
  scoreMin?: number;
  scoreMax?: number;
  /** Ngày ISO (YYYY-MM-DD), cận dưới gồm cả mốc, áp lên phần ngày của submittedAt. */
  dateFrom?: string;
  /** Ngày ISO (YYYY-MM-DD), cận trên gồm cả mốc, áp lên phần ngày của submittedAt. */
  dateTo?: string;
}

export function filterHistoryEntries(
  entries: MyHistoryEntry[],
  filters: HistoryEntryFilters
): MyHistoryEntry[] {
  return entries.filter((entry) => {
    if (filters.subject !== undefined && entry.subject !== filters.subject) return false;
    if (filters.examId !== undefined && entry.examId !== filters.examId) return false;
    if (filters.scoreMin !== undefined && entry.totalScore < filters.scoreMin) return false;
    if (filters.scoreMax !== undefined && entry.totalScore > filters.scoreMax) return false;

    // Mốc thời gian ISO 8601 sắp xếp/so sánh đúng khi coi như chuỗi thường; cắt lấy
    // phần ngày là đủ cho cận theo ngày gồm cả mốc.
    const submittedDate = entry.submittedAt.slice(0, 10);
    if (filters.dateFrom !== undefined && submittedDate < filters.dateFrom) return false;
    if (filters.dateTo !== undefined && submittedDate > filters.dateTo) return false;

    return true;
  });
}
