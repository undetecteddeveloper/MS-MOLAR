// UGC Exam Upload v2.2 — danh mục môn học chuẩn hoá (Design Doc §v2.2, O-9).
// THUẦN, client-safe: S-01/S-03 render <select> từ SUBJECTS; normalizeMeta map
// tên môn AI đọc được ("Môn: Toán") về giá trị canonical. Canonical giữ tiếng
// Anh khớp dữ liệu seed sẵn có ("Math"/"Physics"/"Chemistry") để facet catalog
// không bị phân mảnh. Không map được → null (tác giả chọn tay ở review) —
// KHÔNG BAO GIỜ đoán.

export const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Literature",
  "English",
  "History",
  "Geography",
  "Informatics",
  "Civic Education",
] as const;

export type Subject = (typeof SUBJECTS)[number];

/** Nhãn hiển thị tiếng Việt cho <select> (value vẫn là canonical). */
export const SUBJECT_LABELS: Record<Subject, string> = {
  Math: "Toán",
  Physics: "Vật lý",
  Chemistry: "Hóa học",
  Biology: "Sinh học",
  Literature: "Ngữ văn",
  English: "Tiếng Anh",
  History: "Lịch sử",
  Geography: "Địa lý",
  Informatics: "Tin học",
  "Civic Education": "GDCD",
};

/** Bỏ dấu tiếng Việt + lowercase để so khớp alias không phụ thuộc chính tả. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

// Alias đã fold (không dấu) → canonical. Gồm tên in trên đề ("Môn: Vật lí"),
// viết tắt thông dụng, và chính tên canonical/nhãn Việt.
const ALIASES: Record<string, Subject> = {
  // Math
  math: "Math",
  mathematics: "Math",
  toan: "Math",
  "toan hoc": "Math",
  // Physics
  physics: "Physics",
  "vat ly": "Physics",
  "vat li": "Physics",
  ly: "Physics",
  li: "Physics",
  // Chemistry
  chemistry: "Chemistry",
  "hoa hoc": "Chemistry",
  hoa: "Chemistry",
  // Biology
  biology: "Biology",
  "sinh hoc": "Biology",
  sinh: "Biology",
  // Literature
  literature: "Literature",
  "ngu van": "Literature",
  van: "Literature",
  "van hoc": "Literature",
  // English
  english: "English",
  "tieng anh": "English",
  anh: "English",
  "anh van": "English",
  "ngoai ngu": "English",
  // History
  history: "History",
  "lich su": "History",
  su: "History",
  // Geography
  geography: "Geography",
  "dia ly": "Geography",
  "dia li": "Geography",
  dia: "Geography",
  // Informatics
  informatics: "Informatics",
  "tin hoc": "Informatics",
  tin: "Informatics",
  "cong nghe thong tin": "Informatics",
  // Civic Education
  gdcd: "Civic Education",
  "giao duc cong dan": "Civic Education",
  "civic education": "Civic Education",
};

/** Tên môn (in trên đề hoặc user nhập) → canonical; không khớp → null. */
export function normalizeSubject(raw: string | null | undefined): Subject | null {
  if (!raw) return null;
  // "Môn: Toán", "Môn thi: Vật lí" — bóc tiền tố nếu model trả nguyên dòng.
  const stripped = raw.replace(/^\s*m[ôo]n(\s+(thi|h[ọo]c))?\s*[:.]?\s*/i, "");
  return ALIASES[fold(stripped)] ?? null;
}

/** Type guard cho giá trị đã canonical (validate patch subject từ client). */
export function isSubject(v: string): v is Subject {
  return (SUBJECTS as readonly string[]).includes(v);
}

/** Nhãn tiếng Việt cho một giá trị môn ĐỌC TỪ DB (`exams.subject`), nơi kiểu
 *  chỉ là `string`: giá trị canonical → nhãn, giá trị ngoài danh mục (dữ liệu
 *  cũ, seed lạ) → trả nguyên chứ không rỗng — một chip không tên còn tệ hơn một
 *  chip tên tiếng Anh. */
export function subjectLabel(raw: string): string {
  return isSubject(raw) ? SUBJECT_LABELS[raw] : raw;
}
