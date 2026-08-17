// Phiên bản của `supabase/schema.sql`, và cách biết một DB đang ở phiên bản nào
// (TECH-DEBT TD-005, 2026-08-07).
//
// Vấn đề TD-005 mô tả: schema.sql được paste TAY vào Supabase SQL Editor. Không
// có bản ghi "môi trường nào đang ở phiên bản nào", nên code và DB lệch nhau mà
// KHÔNG có gì báo. Chuyện này đã xảy ra thật ít nhất hai lần:
//   - bản vá §10: code đã chuyển sang RPC trong khi DB còn chưa có hàm;
//   - 2026-08-04 → 2026-08-07: bản vá cascade của bug xoá đề được áp lên prod
//     nhưng KHÔNG áp lên dev, nên Preview deploy vẫn chết 23503 suốt 3 ngày mà
//     mọi cổng đều xanh.
//
// Cách đóng: schema.sql tự ghi DẤU VÂN TAY của chính nó vào bảng
// `public.schema_version` ở câu lệnh CUỐI CÙNG của file (§17). Từ đó:
//   - `verify:schema` so vân tay trên DB với vân tay của file → biết ngay DB
//     đang chạy bản nào, không phải đoán từ hành vi;
//   - `instrumentation.ts` so lúc server khởi động → một deploy chạy trên DB
//     chưa apply sẽ kêu ở dòng log đầu tiên, không đợi tới lúc có người dùng;
//   - test trong file này FAIL nếu ai sửa schema.sql mà không cập nhật vân tay
//     → cổng RẺ NHẤT, chạy trong CI, không cần credential nào.
//
// ⚠ Đây KHÔNG phải migration tool. Nó không có thứ tự áp, không rollback, không
// biết đi từ bản A sang bản B — nó chỉ trả lời được đúng một câu: "DB này có
// đang chạy đúng file schema.sql trong git không?". Trả nợ trọn vẹn vẫn là
// Supabase CLI migrations. Xem TECH-DEBT TD-005.
//
// Vì sao là VÂN TAY nội dung chứ không phải số phiên bản người tự tăng: số tự
// tăng vẫn quên được, và quên chính là hình dạng của bug này. Vân tay không
// quên được — nó đổi ngay khi nội dung đổi.

import { createHash } from "node:crypto";

/**
 * Vân tay của `supabase/schema.sql` hiện tại.
 *
 * Là HẰNG SỐ chép tay, cố ý: `instrumentation.ts` chạy trên Vercel, nơi
 * `supabase/schema.sql` không nằm trong bundle — đọc file lúc chạy sẽ hỏng ở
 * đúng môi trường cần nó nhất. Đổi lại, hằng số này có thể trôi khỏi file, nên
 * `__tests__/schemaFingerprint.test.ts` đối chiếu ba bên (hằng số ↔ giá trị khai
 * trong schema.sql ↔ giá trị tính lại từ nội dung) và FAIL nếu lệch bất kỳ đâu.
 */
export const SCHEMA_FINGERPRINT = "d714c313fe1d";

/** Đánh dấu khối KHÔNG tính vào vân tay — chính là khối chứa vân tay (§17). */
const EXCLUDED_BLOCK_RE =
  /--\s*@schema-fingerprint-begin[\s\S]*?--\s*@schema-fingerprint-end/g;

/** Câu lệnh §17 ghi vân tay xuống DB. */
const DECLARED_RE =
  /insert\s+into\s+public\.schema_version[\s\S]*?values\s*\(\s*1\s*,\s*'([0-9a-f]+)'\s*\)/i;

/**
 * Vân tay tính từ nội dung THỰC THI của schema.sql.
 *
 * Chuẩn hoá trước khi băm — bỏ comment, gộp khoảng trắng — nên sửa comment hay
 * xuống dòng KHÔNG làm đổi vân tay. Đây là đánh đổi có chủ đích: nếu băm nguyên
 * văn thì mỗi lần viết thêm một dòng giải thích (file này viết rất nhiều) lại
 * đòi paste lại schema.sql lên 2 DB — nhiễu tới mức người ta sẽ tắt cổng đi.
 * Ngược lại, MỌI thay đổi chạm tới SQL thật (kể cả thân hàm `$$...$$`, kể cả
 * đổi một chữ trong `on delete`) đều đổi vân tay.
 */
export function computeSchemaFingerprint(sql: string): string {
  const executable = normalizeSql(sql.replace(EXCLUDED_BLOCK_RE, ""));
  return createHash("sha256").update(executable, "utf8").digest("hex").slice(0, 12);
}

/** Vân tay mà schema.sql tự KHAI ở §17; `null` nếu file không có §17. */
export function parseDeclaredFingerprint(sql: string): string | null {
  return DECLARED_RE.exec(sql)?.[1] ?? null;
}

// --- nội bộ ----------------------------------------------------------------

/** Bỏ comment `--`, gộp mọi khoảng trắng về một dấu cách, cắt hai đầu. */
function normalizeSql(sql: string): string {
  return sql
    .split("\n")
    .map(stripLineComment)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cắt comment `--` cuối dòng, nhưng KHÔNG cắt dấu `--` nằm trong chuỗi.
 *
 * Đếm nháy đơn: `--` chỉ mở comment khi số nháy đứng trước nó là CHẴN. Không
 * xử lý chuỗi trải nhiều dòng vì schema.sql không có (thân hàm dùng `$$`, và
 * `$$` không phải nháy đơn nên không ảnh hưởng phép đếm).
 */
function stripLineComment(line: string): string {
  let quotes = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "'") quotes++;
    else if (line[i] === "-" && line[i + 1] === "-" && quotes % 2 === 0) {
      return line.slice(0, i);
    }
  }
  return line;
}
