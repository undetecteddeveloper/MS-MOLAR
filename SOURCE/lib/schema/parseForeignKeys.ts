// Đọc mọi khoá ngoại KHAI TRONG schema.sql (TECH-DEBT TD-011, 2026-08-04).
//
// Bối cảnh: bug xoá đề ngày 2026-08-04 là hai khoá ngoại thiếu `on delete`.
// Nó lọt qua tsc, vitest và `verify:schema` vì không cổng nào nhìn được vào
// hành vi xoá của khoá ngoại. `verify-schema.ts` đóng khoảng đó ở phía DB
// (so với `public.schema_foreign_keys()` §16a) — nhưng lượt đó cần credential
// thật và phải nhớ chạy tay.
//
// Module này đóng khoảng đó ở phía VĂN BẢN: parse schema.sql, không cần DB,
// nên `npm test` (và CI) bắt được ngay lúc mở PR — trước khi SQL kịp chạy ở
// đâu. Đó là chỗ RẺ NHẤT để bắt loại lỗi này. Kiểm tra DB vẫn cần, vì file
// đúng không có nghĩa là DB đã được apply, nhưng nó là lưới thứ hai chứ không
// còn là lưới duy nhất.
//
// Parser CỐ Ý ngây thơ — nó chỉ hiểu đúng tập cú pháp mà schema.sql thật sự
// dùng, không phải SQL nói chung. Điều làm nó an toàn không phải độ thông minh
// mà là `verify-schema.ts` đối chiếu HAI CHIỀU với catalog thật: một khoá ngoại
// parser bỏ sót sẽ hiện ra ở DB mà không có trong danh sách khai → FAIL. Nghĩa
// là lỗ hổng của parser biến thành báo động, không thành im lặng.

export type OnDeleteAction =
  | "no action"
  | "restrict"
  | "cascade"
  | "set null"
  | "set default";

export interface DeclaredForeignKey {
  /** Luôn đủ schema: "public.exams", "auth.users". */
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
  /** `null` = schema.sql KHÔNG khai `on delete`. Chính là hình dạng của bug. */
  onDelete: OnDeleteAction | null;
  /** Tên constraint nếu được đặt tay (`add constraint X foreign key ...`). */
  constraintName: string | null;
}

const ACTION = "(cascade|restrict|no\\s+action|set\\s+null|set\\s+default)";
const ON_DELETE_RE = new RegExp(`\\bon\\s+delete\\s+${ACTION}`, "i");
const REFERENCES_RE = /\breferences\s+([\w."]+)\s*\(([^)]*)\)([\s\S]*)$/i;

/** Khoá định danh một khoá ngoại: bảng con + đúng bộ cột con. */
export function fkKey(childTable: string, childColumns: string[]): string {
  return `${qualify(childTable)}(${childColumns.map((c) => c.toLowerCase()).join(",")})`;
}

/**
 * Mọi khoá ngoại khai trong schema.sql, theo thứ tự xuất hiện.
 *
 * KHÔNG gộp trùng: một khoá ngoại có thể được khai nhiều lần (create table lúc
 * dựng, rồi `alter table ... add constraint` ở mục vá về sau — đúng chuyện §15
 * làm). Việc chọn bản nào có hiệu lực là của `resolveForeignKeys`.
 */
export function parseForeignKeys(sql: string): DeclaredForeignKey[] {
  const found: DeclaredForeignKey[] = [];

  for (const stmt of statements(sql)) {
    const createTable = /^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(/i.exec(stmt);
    if (createTable) {
      const body = balancedBody(stmt, createTable[0].length - 1);
      if (body === null) continue;
      for (const item of splitTopLevel(body)) {
        const fk = fromColumnItem(createTable[1], item);
        if (fk) found.push(fk);
      }
      continue;
    }

    const alterTable = /^alter\s+table\s+(?:only\s+)?([\w."]+)\s+([\s\S]*)$/i.exec(stmt);
    if (alterTable) {
      const fk = fromAlterItem(alterTable[1], alterTable[2]);
      if (fk) found.push(fk);
    }
  }

  return found;
}

/**
 * Bản CÓ HIỆU LỰC của mỗi khoá ngoại: khai sau đè khai trước, vì SQL chạy tuần
 * tự từ đầu file xuống. §15 sửa `on delete` của hai khoá dựng ở §L2 đúng bằng
 * cách này — lấy bản đầu tiên sẽ đọc ra chính cái schema đã hỏng.
 */
export function resolveForeignKeys(sql: string): Map<string, DeclaredForeignKey> {
  const resolved = new Map<string, DeclaredForeignKey>();
  for (const fk of parseForeignKeys(sql)) {
    resolved.set(fkKey(fk.childTable, fk.childColumns), fk);
  }
  return resolved;
}

// --- nội bộ ----------------------------------------------------------------

/** Câu lệnh đã bỏ comment và bỏ thân hàm, gộp khoảng trắng. */
function statements(sql: string): string[] {
  const withoutBodies = sql.replace(/\$\$[\s\S]*?\$\$/g, " ");
  const withoutComments = withoutBodies.replace(/--[^\n]*/g, " ");
  return withoutComments
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Nội dung trong cặp ngoặc bắt đầu tại `open`, cân bằng độ sâu. */
function balancedBody(s: string, open: number): string | null {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return s.slice(open + 1, i);
    }
  }
  return null;
}

/** Tách theo dấu phẩy ở ĐỘ SÂU 0 — `check (x in ('a','b'))` không bị cắt đôi. */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Một dòng trong thân `create table`. */
function fromColumnItem(childTable: string, item: string): DeclaredForeignKey | null {
  const tableLevel = /^foreign\s+key\s*\(([^)]*)\)([\s\S]*)$/i.exec(item);
  if (tableLevel) return fromReferences(childTable, splitNames(tableLevel[1]), tableLevel[2], null);

  if (!/\breferences\b/i.test(item)) return null;
  // Ràng buộc mức cột: cột con là định danh đầu dòng (`exam_id text not null
  // references ...`).
  const column = /^([\w"]+)/.exec(item);
  if (!column) return null;
  return fromReferences(childTable, [column[1]], item, null);
}

/** Phần sau `alter table <t>` — chỉ hai dạng sinh ra khoá ngoại. */
function fromAlterItem(childTable: string, rest: string): DeclaredForeignKey | null {
  const named =
    /^add\s+constraint\s+([\w"]+)\s+foreign\s+key\s*\(([^)]*)\)([\s\S]*)$/i.exec(rest);
  if (named)
    return fromReferences(childTable, splitNames(named[2]), named[3], unquote(named[1]));

  const addColumn = /^add\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)\s+([\s\S]*)$/i.exec(rest);
  if (addColumn && /\breferences\b/i.test(addColumn[2]))
    return fromReferences(childTable, [addColumn[1]], addColumn[2], null);

  return null;
}

function fromReferences(
  childTable: string,
  childColumns: string[],
  tail: string,
  constraintName: string | null
): DeclaredForeignKey | null {
  const m = REFERENCES_RE.exec(tail);
  if (!m) return null;
  const onDelete = ON_DELETE_RE.exec(m[3]);
  return {
    childTable: qualify(childTable),
    childColumns: childColumns.map(unquote),
    parentTable: qualify(m[1]),
    parentColumns: splitNames(m[2]).map(unquote),
    onDelete: onDelete ? (normalizeAction(onDelete[1]) as OnDeleteAction) : null,
    constraintName,
  };
}

function splitNames(list: string): string[] {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function unquote(name: string): string {
  return name.replace(/^"|"$/g, "").toLowerCase();
}

/** Thiếu schema thì là `public` — đúng như Postgres hiểu với search_path mặc định. */
function qualify(name: string): string {
  const clean = unquote(name.trim());
  return clean.includes(".") ? clean : `public.${clean}`;
}

/** `no  action` / `NO ACTION` → `no action`, để so bằng `===` với catalog. */
export function normalizeAction(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
