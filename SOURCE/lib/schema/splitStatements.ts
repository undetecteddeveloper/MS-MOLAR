// Tách `supabase/schema.sql` thành từng CÂU LỆNH rời (TECH-DEBT TD-005).
//
// VÌ SAO TỒN TẠI, và nó KHÔNG phải một migration tool.
//
// TD-005 ghi phần chưa trả bằng đúng một câu: "không có gì ngăn lượt apply tay
// TIẾP THEO quên một nhóm". Ngày 2026-08-31 chế độ hỏng ấy được quan sát TRỰC
// TIẾP, hai lần trong một phiên, và nó tệ hơn "quên": công cụ apply nhận một
// chuỗi nhiều câu lệnh, CHẠY câu đầu, rồi báo `successful: true` kèm tên của
// đúng câu đầu ấy (`"command": "REVOKE"`, `"command": "DROP POLICY"`). Đọc trần
// trụi thì lượt apply trông như đã xong. Nó chưa xong.
//
// Hệ quả cụ thể lần đó: `revoke ...; grant ...;` chỉ chạy vế `revoke`, nên một
// policy vừa được tạo ra đã gọi tới một hàm mà `authenticated` không có quyền
// chạy. Không có gì đỏ ở đâu cả — đúng hình dạng nợ mà TD-005 mô tả từ đầu.
//
// CÁCH CHỮA KHÔNG PHẢI "CẨN THẬN HƠN": nếu apply theo từng câu lệnh RỜI thì
// không có câu nào để nuốt. Module này làm đúng một việc — cắt file thành đơn
// vị apply — và `scripts/schema-plan.ts` in chúng ra thành một danh sách có
// SỐ để đối chiếu. Một lượt apply đúng là một lượt chạy đủ N câu; N là con số
// hàm này trả về, không phải một cảm giác.
//
// Nó KHÔNG có thứ tự áp giữa các phiên bản, KHÔNG rollback, KHÔNG biết đi từ
// bản A sang bản B. Trả nợ trọn vẹn TD-005 vẫn là Supabase CLI migrations, và
// việc đó vẫn cần DB password của cả hai project — một credential chỉ engineer
// cấp được.

/** Một câu lệnh SQL rời, kèm chỗ nó nằm trong file gốc. */
export interface SqlStatement {
  /** Nguyên văn câu lệnh, đã cắt khoảng trắng hai đầu, KHÔNG kèm dấu `;`. */
  text: string;
  /** Dòng bắt đầu trong file gốc, 1-based — để một lượt apply hỏng chỉ ra được
   *  chỗ phải mở ra xem, thay vì chỉ ra số thứ tự của một câu lệnh vô danh.
   *
   *  Đây là dòng đầu tiên của ĐOẠN VĂN BẢN thuộc câu lệnh, tức thường là dòng
   *  mở đầu khối comment giới thiệu nó, KHÔNG phải dòng của từ khoá SQL. Chọn
   *  thế có chủ đích: người mở file ra xem cần đọc lời giải thích trước, và
   *  `schema.sql` để lời giải thích ngay trên câu lệnh nó nói về. */
  line: number;
}

/**
 * Cắt một file SQL thành các câu lệnh, theo dấu `;` ở NGOÀI mọi ngữ cảnh trích
 * dẫn.
 *
 * Bốn ngữ cảnh mà một dấu `;` KHÔNG kết thúc câu lệnh, và mỗi cái đã thật sự có
 * mặt trong `schema.sql`:
 *   1. `$$ ... $$` — thân hàm plpgsql/sql. Đây là ca đắt nhất: mọi hàm trong
 *      §10–§12 và ADR-0018 đều chứa nhiều dấu `;` bên trong. Cắt sai ở đây là
 *      apply ra một hàm cụt.
 *   2. `'...'` — chuỗi. `''` bên trong là một dấu nháy escape, không phải kết
 *      thúc chuỗi.
 *   3. `"..."` — định danh có dấu nháy kép (tên policy: `"exams_select_visible"`).
 *   4. `-- ...` tới hết dòng, và `/* ... *\/` — comment. File này viết rất nhiều
 *      comment, và trong đó CÓ dấu `;`.
 *
 * Dollar-quote được so theo NHÃN đầy đủ (`$$`, `$body$`, `$fn$`): một khối
 * `$a$ ... $b$ ... $a$` chỉ đóng ở nhãn khớp, và so bằng "hai ký tự đô la" sẽ
 * đóng nhầm ở nhãn giữa.
 *
 * Câu lệnh RỖNG (chỉ comment, hoặc chỉ khoảng trắng) bị BỎ, không trả về: chúng
 * không phải đơn vị apply, và đếm chúng vào N sẽ làm con số đối chiếu sai lệch
 * theo hướng khó phát hiện nhất — dư ra.
 */
export function splitSqlStatements(sql: string): SqlStatement[] {
  const out: SqlStatement[] = [];
  let buffer = "";
  let bufferStartLine = 1;
  let line = 1;
  let i = 0;

  // Ngữ cảnh hiện tại. Chỉ MỘT trong số này được bật tại một thời điểm — SQL
  // không lồng chuỗi vào comment hay ngược lại theo cách cần một ngăn xếp.
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;
  let inDouble = false;
  let dollarTag: string | null = null;

  const push = () => {
    const text = stripSqlNoise(buffer);
    if (text.length > 0) out.push({ text: buffer.trim(), line: bufferStartLine });
    buffer = "";
  };

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "\n") line += 1;
    // Dòng đầu tiên có nội dung thật của câu lệnh kế tiếp — không tính khoảng
    // trắng dẫn, nếu không thì mọi câu lệnh đều báo dòng của dấu `;` trước nó.
    if (buffer.trim().length === 0 && !/\s/.test(ch)) bufferStartLine = line;

    if (inLineComment) {
      buffer += ch;
      if (ch === "\n") inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      buffer += ch;
      if (ch === "*" && next === "/") {
        buffer += next;
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (dollarTag !== null) {
      if (sql.startsWith(dollarTag, i)) {
        buffer += dollarTag;
        line += countNewlines(dollarTag);
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buffer += ch;
      i += 1;
      continue;
    }
    if (inSingle) {
      buffer += ch;
      if (ch === "'") {
        // `''` là một dấu nháy escape: nuốt cả hai và ở lại trong chuỗi.
        if (next === "'") {
          buffer += next;
          i += 2;
          continue;
        }
        inSingle = false;
      }
      i += 1;
      continue;
    }
    if (inDouble) {
      buffer += ch;
      if (ch === '"') {
        if (next === '"') {
          buffer += next;
          i += 2;
          continue;
        }
        inDouble = false;
      }
      i += 1;
      continue;
    }

    // --- ngoài mọi ngữ cảnh ---
    if (ch === "-" && next === "-") {
      inLineComment = true;
      buffer += "--";
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      buffer += "/*";
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buffer += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buffer += ch;
      i += 1;
      continue;
    }
    const tag = dollarTagAt(sql, i);
    if (tag !== null) {
      dollarTag = tag;
      buffer += tag;
      i += tag.length;
      continue;
    }
    if (ch === ";") {
      push();
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  // Đuôi file không có `;` vẫn là một câu lệnh — bỏ nó đi là cắt mất chính khối
  // ghi vân tay ở cuối §17 nếu ai đó lỡ xoá dấu chấm phẩy cuối cùng.
  push();
  return out;
}

/** Nhãn dollar-quote bắt đầu tại `i` (`$$`, `$body$`), hoặc null. */
function dollarTagAt(sql: string, i: number): string | null {
  if (sql[i] !== "$") return null;
  const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
  return match ? match[0] : null;
}

function countNewlines(text: string): number {
  let n = 0;
  for (const ch of text) if (ch === "\n") n += 1;
  return n;
}

/** Bỏ comment và khoảng trắng để trả lời đúng một câu: đoạn này có SQL thật
 *  nào không. Không dùng cho việc gì khác — nó không giữ được ngữ nghĩa. */
function stripSqlNoise(chunk: string): string {
  return chunk
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim();
}

/**
 * Nhãn ngắn cho một câu lệnh: động từ + đối tượng, đủ để đọc một danh sách 200
 * dòng mà vẫn biết mình đang ở đâu.
 *
 * Cắt từ phần ĐÃ BỎ COMMENT: `schema.sql` mở đầu gần như mọi câu lệnh bằng một
 * khối giải thích dài, nên lấy nguyên văn 60 ký tự đầu sẽ ra một danh sách toàn
 * gạch ngang.
 */
export function describeStatement(statement: SqlStatement): string {
  const bare = stripSqlNoise(statement.text).replace(/\s+/g, " ");
  return bare.length <= 72 ? bare : `${bare.slice(0, 69)}...`;
}
