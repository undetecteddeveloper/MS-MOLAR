// Shared pure formatters for History/PDF surfaces (Work Plan Phase 2 Task 2.2).
// Single source of truth — see docs/design/history-frontend-design.md § Data
// Contracts (lib/history/format.ts) and § Minimal Surface Alternatives Element 2.
// Consumed identically by generateAttemptPdf.ts (Task 09), result/page.tsx's
// ScoreCard usage (Task 12), and HistoryRow (Task 13) — no per-caller reformatting.

const EM_DASH = "—";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "DD/MM/YYYY"; never throws; "—" for null or an unparseable date. */
export function formatSubmittedDate(submittedAt: string | null): string {
  if (submittedAt === null) return EM_DASH;
  const d = parseDate(submittedAt);
  if (d === null) return EM_DASH;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * "Hh Mm" (>=60min), "Mm Ss" (>=60s, <60min), "Ss" (<60s), per UI Spec HistoryRow
 * format spec. Never throws; "—" when submittedAt is null, either timestamp is
 * unparseable, or the computed diff is negative.
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

/** Lowercase, non-alphanumeric runs collapsed to single hyphens, <=60 chars, no leading/trailing hyphen. */
function slugify(title: string): string {
  const collapsed = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (collapsed === "") return "exam";

  const truncated = collapsed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");
  return truncated === "" ? "exam" : truncated;
}

/**
 * "{slug}_{YYYYMMDD}.pdf" per UI Spec D2. Empty/whitespace (or purely
 * non-alphanumeric) title falls back to slug "exam"; null/unparseable
 * submittedAt falls back to the current date (this doc's own defensive
 * fallback for the narrow ExamResult race window — D2 does not define it).
 * Never throws (pure string transform).
 */
export function buildPdfFilename(examTitle: string, submittedAt: string | null): string {
  const slug = slugify(examTitle);
  const dateSource = submittedAt === null ? null : parseDate(submittedAt);
  const d = dateSource ?? new Date();
  const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  return `${slug}_${stamp}.pdf`;
}
