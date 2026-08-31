// CỔNG CHỐNG TRÔI giữa `schema.sql` và `supabase/migrations/` (TECH-DEBT TD-005).
//
// QUYẾT ĐỊNH ĐANG ĐƯỢC CƯỠNG CHẾ Ở ĐÂY (engineer chốt 2026-08-31): `schema.sql`
// giữ vai CANONICAL — nó là thứ người viết, và là nơi duy nhất giải thích vì
// sao schema có hình dạng như thế. `supabase/migrations/` chỉ là CƠ CHẾ ÁP: nó
// trả lời "database này đã chạy tới đâu", việc mà một file idempotent không trả
// lời được.
//
// HAI NGUỒN CHÂN LÝ LÀ MỘT CÁI BẪY, và mô hình trên chỉ an toàn khi có một cổng
// giữ chúng nói cùng một chuyện. Không có cổng thì đây đúng là hình dạng tệ
// nhất của TD-005: hai file cùng khai về schema, trôi khỏi nhau trong im lặng,
// và cái sai chỉ lộ ra ở lần deploy tiếp theo.
//
// ⚠ CÁI CỔNG NÀY KHÔNG LÀM ĐƯỢC, nói trước để không ai tin quá lời: nó KHÔNG
// chứng minh "baseline + mọi migration = schema.sql" theo nghĩa ngữ nghĩa SQL.
// Muốn thế phải dựng một shadow database rồi so hai bên (`supabase db diff`), mà
// việc đó cần Docker — máy này không có. Nó chứng minh hai điều YẾU HƠN nhưng
// kiểm được, và hai điều đó chặn đúng hai cách quên có thật:
//
//   1. Sửa `schema.sql` mà QUÊN viết migration → vân tay đổi, file migration
//      mới nhất vẫn mang vân tay cũ → ĐỎ.
//   2. Viết migration mà QUÊN cập nhật `schema.sql` → câu lệnh trong migration
//      không tìm thấy trong schema.sql → ĐỎ.
//
// Quy ước tên file mang toàn bộ sức mạnh của điều (1):
//     <timestamp>_<mô-tả>_<vân-tay-schema.sql-SAU-migration-này>.sql

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { computeSchemaFingerprint } from "../schemaFingerprint";
import { splitSqlStatements } from "../splitStatements";

const SCHEMA_PATH = resolve(__dirname, "../../../supabase/schema.sql");
const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");

const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

/** Vân tay TÍNH LẠI TỪ NỘI DUNG, không phải hằng số TypeScript.
 *
 *  Khác biệt này do một lượt mutation test phát hiện, và nó không nhỏ. Nếu ca
 *  dưới so với `SCHEMA_FINGERPRINT` thì nó chỉ đỏ SAU KHI ai đó đã cập nhật
 *  hằng số ấy — tức nó dựa vào việc một cổng KHÁC đã được tuân thủ trước, và
 *  một lượt sửa schema.sql bỏ qua cả hai cổng vẫn lọt. Đo thật: tiêm một câu
 *  `select 1;` vào schema.sql thì bản cũ của ca này vẫn XANH.
 *
 *  Tính lại từ nội dung thì ca này tự đứng được: đổi một chữ trong SQL là nó đỏ
 *  ngay, không cần ai làm gì trước cả. `SCHEMA_FINGERPRINT` vẫn được kiểm —
 *  nhưng ở `schemaFingerprint.test.ts`, nơi đó mới là việc của nó. */
const currentFingerprint = computeSchemaFingerprint(schemaSql);

/** Tên file migration, đã sort — thứ tự tên CHÍNH LÀ thứ tự áp của Supabase CLI. */
function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Vân tay khai trong tên file, hoặc null nếu tên không theo quy ước. */
function fingerprintOf(fileName: string): string | null {
  return /_([0-9a-f]{12})\.sql$/.exec(fileName)?.[1] ?? null;
}

/** Chuẩn hoá để so khớp câu lệnh giữa hai file: bỏ comment, gộp khoảng trắng.
 *  Cùng phép chuẩn hoá mà vân tay dùng, nên hai cổng không thể bất đồng về
 *  việc "hai câu lệnh này có giống nhau không". */
function normalize(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("migrations ↔ schema.sql (TD-005)", () => {
  it("có ít nhất một migration, và mọi file đều theo quy ước tên", () => {
    // Danh sách RỖNG làm mọi ca dưới đây thành chân lý rỗng — cổng biến mất mà
    // không ai thấy. Đây là ca chặn điều đó.
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(
        fingerprintOf(file),
        `\`${file}\` không mang vân tay ở cuối tên. Quy ước:\n` +
          "  <timestamp>_<mô-tả>_<vân-tay-schema.sql-sau-migration-này>.sql\n" +
          "Vân tay trong tên là thứ DUY NHẤT nối một file migration với trạng thái\n" +
          "schema.sql mà nó tạo ra — thiếu nó thì cổng dưới đây không đo được gì."
      ).not.toBeNull();
    }
  });

  it("BASELINE khai đúng vân tay của chính nội dung nó", () => {
    // Baseline là ảnh chụp schema.sql tại một thời điểm. Nó KHÔNG đổi khi
    // schema.sql đổi — nên phép kiểm phải là "nội dung tự khớp với tên", không
    // phải "khớp với schema.sql hôm nay". Ca này đi đỏ nếu ai sửa baseline, tức
    // là sửa lại quá khứ.
    const baseline = migrationFiles()[0];
    const declared = fingerprintOf(baseline);
    const content = readFileSync(resolve(MIGRATIONS_DIR, baseline), "utf8");
    expect(
      computeSchemaFingerprint(content),
      `Baseline \`${baseline}\` đã bị sửa nội dung. Baseline mô tả một trạng thái ĐÃ XẢY RA\n` +
        "và hai database đã được đánh dấu là áp đúng bản đó — sửa nó là nói dối về quá khứ.\n" +
        "Thay đổi schema phải là một FILE MIGRATION MỚI."
    ).toBe(declared);
  });

  it("migration MỚI NHẤT mang đúng vân tay của schema.sql hiện tại", () => {
    // Đây là ca chặn "sửa schema.sql mà quên viết migration". Vân tay của
    // schema.sql đổi ngay khi nội dung SQL đổi (schemaFingerprint.test.ts đã
    // ghim điều đó), nên nếu không có file migration mới mang vân tay ấy thì
    // git đang chứa một thay đổi schema không có đường nào áp lên database.
    const files = migrationFiles();
    const latest = files[files.length - 1];
    expect(
      fingerprintOf(latest),
      `\nSCHEMA ĐÃ ĐỔI MÀ KHÔNG CÓ MIGRATION.\n\n` +
        `schema.sql đang ở vân tay ${currentFingerprint}, nhưng file migration mới nhất\n` +
        `(\`${latest}\`) mang vân tay ${fingerprintOf(latest)}.\n\n` +
        "Thêm một file vào supabase/migrations/ chứa ĐÚNG PHẦN THAY ĐỔI (không phải cả\n" +
        "schema.sql), đặt tên kết thúc bằng vân tay mới:\n" +
        `  supabase/migrations/<timestamp>_<mô-tả>_${currentFingerprint}.sql\n\n` +
        "Rồi `npx supabase db push` để áp. Bỏ qua bước này = đúng lỗi TD-005:\n" +
        "git có bản vá mà database thì không."
    ).toBe(currentFingerprint);
  });

  it("mọi câu lệnh trong migration SAU baseline đều có mặt trong schema.sql", () => {
    // Ca chặn chiều ngược lại: viết migration mà quên cập nhật schema.sql. Khi
    // ấy database sẽ đi trước file canonical, và lần sau ai đó đọc schema.sql
    // để hiểu hệ thống sẽ đọc một bản đã cũ.
    //
    // So theo CÂU LỆNH ĐÃ CHUẨN HOÁ chứ không so chuỗi thô: schema.sql xuống
    // dòng và chú thích khác hẳn một file migration gọn, và một phép so thô sẽ
    // đỏ vì khoảng trắng — cổng nào đỏ vì khoảng trắng thì cũng sẽ bị tắt đi.
    const haystack = splitSqlStatements(schemaSql).map((s) => normalize(s.text));
    const haystackSet = new Set(haystack);

    for (const file of migrationFiles().slice(1)) {
      const content = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      for (const statement of splitSqlStatements(content)) {
        const needle = normalize(statement.text);
        expect(
          haystackSet.has(needle),
          `\nMIGRATION ĐI TRƯỚC schema.sql.\n\n` +
            `\`${file}\` (dòng ${statement.line}) có một câu lệnh không tìm thấy trong schema.sql:\n\n` +
            `  ${needle.slice(0, 200)}${needle.length > 200 ? "..." : ""}\n\n` +
            "schema.sql là nguồn canonical — mọi thứ áp lên database phải có mặt ở đó.\n" +
            "Thêm câu lệnh này vào schema.sql (đúng §phù hợp, kèm lý do), rồi cập nhật\n" +
            "vân tay theo hướng dẫn của schemaFingerprint.test.ts."
        ).toBe(true);
      }
    }
  });
});
