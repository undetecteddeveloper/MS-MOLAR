// Các bộ định dạng thuần dùng chung cho màn History/PDF (Work Plan Phase 2 Task 2.2).
// Nguồn sự thật duy nhất — xem docs/design/history-frontend-design.md § Data
// Contracts (lib/history/format.ts) và § Minimal Surface Alternatives Element 2.
// Được generateAttemptPdf.ts (Task 09), phần dùng ScoreCard của result/page.tsx
// (Task 12) và HistoryRow (Task 13) dùng giống hệt nhau — không định dạng lại theo từng nơi gọi.

import { normalizeSearch } from "@/lib/search/normalize";

const EM_DASH = "—";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "DD/MM/YYYY"; không bao giờ ném lỗi; "—" khi null hoặc ngày không phân tích được. */
export function formatSubmittedDate(submittedAt: string | null): string {
  if (submittedAt === null) return EM_DASH;
  const d = parseDate(submittedAt);
  if (d === null) return EM_DASH;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "HH:mm" (24h, giờ địa phương); không bao giờ ném lỗi; "—" khi null hoặc ngày không phân tích được. */
export function formatSubmittedTime(submittedAt: string | null): string {
  if (submittedAt === null) return EM_DASH;
  const d = parseDate(submittedAt);
  if (d === null) return EM_DASH;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * "Hh Mm" (>=60 phút), "Mm Ss" (>=60 giây, <60 phút), "Ss" (<60 giây), theo đặc tả định dạng
 * HistoryRow của UI Spec. Không bao giờ ném lỗi; "—" khi submittedAt là null, một trong hai mốc thời gian
 * không phân tích được, hoặc hiệu số tính ra là số âm.
 */
export function formatCompletionTime(startedAt: string, submittedAt: string | null): string {
  if (submittedAt === null) return EM_DASH;
  const start = parseDate(startedAt);
  const end = parseDate(submittedAt);
  if (start === null || end === null) return EM_DASH;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return EM_DASH;

  const totalSeconds = Math.floor(diffMs / 1000);
  if (totalSeconds >= 3600) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }
  return `${totalSeconds}s`;
}

/**
 * Số giây quá giờ → nhãn người đọc được ("2m 5s", "1h 3m", "12s").
 * Dùng cho nhãn "Submitted after time" trên trang Result (Security review #6).
 * Cùng bậc thang đơn vị với formatCompletionTime để hai nhãn cạnh nhau không
 * lệch phong cách. `<= 0` → "" (caller chỉ render khi > 0).
 */
export function formatOvertime(overtimeSeconds: number): string {
  if (!Number.isFinite(overtimeSeconds) || overtimeSeconds <= 0) return "";
  const total = Math.floor(overtimeSeconds);
  if (total >= 3600) {
    return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  }
  if (total >= 60) {
    return `${Math.floor(total / 60)}m ${total % 60}s`;
  }
  return `${total}s`;
}

const MAX_SLUG_LENGTH = 60;

/** Lowercase, bỏ dấu tiếng Việt, mọi run ký tự lạ gom thành MỘT gạch nối, ≤60
 *  ký tự, không gạch nối ở hai đầu.
 *
 *  Bỏ dấu TRƯỚC khi gom (2026-09-13, engineer test trên điện thoại thật): bản
 *  cũ coi mọi chữ có dấu là "không phải [a-z0-9]", nên "Kiểm tra cuối học kỳ
 *  II" ra tệp `ki-m-tra-cu-i-h-c-k-ii.pdf`. Dùng chính bộ chuẩn hoá của tìm đề
 *  (`normalizeSearch`: NFD, bỏ dấu kết hợp, đ→d, còn lại [a-z0-9 ] đã gộp và
 *  cắt hai đầu) rồi đổi khoảng trắng thành gạch nối — không viết một bản bỏ
 *  dấu thứ hai để lệch với bản kia. */
function slugify(title: string): string {
  const collapsed = normalizeSearch(title).replace(/ /g, "-");
  if (collapsed === "") return "exam";

  const truncated = collapsed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
  return truncated === "" ? "exam" : truncated;
}

/**
 * "{slug}_{YYYYMMDD}.pdf" theo UI Spec D2. Tiêu đề rỗng/toàn khoảng trắng (hoặc hoàn toàn
 * không có chữ-số) thì lùi về slug "exam"; submittedAt null/không phân tích được
 * thì lùi về ngày hiện tại (phương án dự phòng riêng của tài liệu này cho
 * cửa sổ race hẹp của ExamResult — D2 không định nghĩa nó).
 * Không bao giờ ném lỗi (phép biến đổi chuỗi thuần).
 */
export function buildPdfFilename(examTitle: string, submittedAt: string | null): string {
  const slug = slugify(examTitle);
  const dateSource = submittedAt === null ? null : parseDate(submittedAt);
  const d = dateSource ?? new Date();
  const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  return `${slug}_${stamp}.pdf`;
}
