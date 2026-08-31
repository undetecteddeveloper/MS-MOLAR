// KẾ HOẠCH APPLY cho `supabase/schema.sql` (TECH-DEBT TD-005).
//
//   npm run schema:plan                  # danh sách có SỐ + vân tay đích
//   npm run schema:plan -- --emit out/   # ghi mỗi câu lệnh thành một file rời
//
// VÌ SAO CÓ, nói bằng chuyện đã xảy ra chứ không bằng nguyên tắc: ngày
// 2026-08-31, một lượt apply gửi `revoke ...; grant ...;` như MỘT chuỗi. Công
// cụ chạy vế `revoke`, bỏ vế `grant`, rồi trả về `successful: true` kèm
// `"command": "REVOKE"`. Cùng phiên đó, `drop policy ...; create policy ...;`
// trả về `"command": "DROP POLICY"`. Cả hai lượt TRÔNG NHƯ đã xong. Một trong
// hai thật sự chưa xong, và thứ phát hiện ra nó là một truy vấn đọc lại
// catalog — không phải thông báo của công cụ.
//
// Quy tắc rút ra là một quy tắc về ĐƠN VỊ, không phải về sự cẩn thận: apply
// TỪNG CÂU LỆNH MỘT. Không có câu nào để nuốt thì không có gì bị nuốt. Script
// này in ra đúng danh sách ấy, có đánh số, để một lượt apply có thứ để tick —
// đúng thứ TD-005 nói là đang thiếu ("không có gì ngăn lượt apply tay TIẾP
// THEO quên một nhóm").
//
// ⚠ NÓ KHÔNG APPLY GÌ CẢ và không kết nối tới database nào: nó đọc một file
// trong git rồi in ra. Trả nợ TRỌN VẸN TD-005 vẫn là Supabase CLI migrations,
// và việc đó vẫn cần DB password của cả hai project — một credential chỉ
// engineer cấp được. Cho tới lúc đó, apply vẫn là thao tác tay; cái đổi được ở
// đây là thao tác tay ấy có một CON SỐ để đối chiếu.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  computeSchemaFingerprint,
  parseDeclaredFingerprint,
} from "@/lib/schema/schemaFingerprint";
import { describeStatement, splitSqlStatements } from "@/lib/schema/splitStatements";

const schemaPath = path.resolve(process.cwd(), "supabase/schema.sql");
const sql = readFileSync(schemaPath, "utf8");

const statements = splitSqlStatements(sql);
const declared = parseDeclaredFingerprint(sql);
const computed = computeSchemaFingerprint(sql);

const emitAt = process.argv.indexOf("--emit");
const emitDir = emitAt === -1 ? null : process.argv[emitAt + 1];

console.log(`schema.sql: ${statements.length} câu lệnh\n`);
statements.forEach((statement, index) => {
  const n = String(index + 1).padStart(3, " ");
  console.log(`${n}. (dòng ${statement.line}) ${describeStatement(statement)}`);
});

console.log(`\nVÂN TAY ĐÍCH: ${computed}`);

if (declared !== computed) {
  // Cùng lời khẳng định `schemaFingerprint.test.ts` đã ghim; lặp lại ở đây vì
  // người đọc script này đang chuẩn bị apply, và apply một file tự khai sai bản
  // của chính nó là cách nhanh nhất để `schema_version` nói dối về sau.
  console.error(
    `\n❌ schema.sql tự khai '${declared ?? "(không có)"}' nhưng nội dung băm ra '${computed}'.\n` +
      "   ĐỪNG apply cho tới khi hai giá trị khớp — xem lib/schema/schemaFingerprint.ts."
  );
  process.exit(1);
}

console.log(
  "\nÁP THEO ĐÚNG THỨ TỰ TRÊN, MỖI LƯỢT MỘT CÂU LỆNH.\n" +
    `Xong thì \`select fingerprint from public.schema_version\` phải trả '${computed}'\n` +
    "trên MỌI môi trường (dev + prod), đọc bằng TRUY VẤN THẬT — không tin thông báo apply."
);

if (emitDir !== undefined && emitDir !== null) {
  const dir = path.resolve(process.cwd(), emitDir);
  mkdirSync(dir, { recursive: true });
  statements.forEach((statement, index) => {
    writeFileSync(
      path.join(dir, `${String(index + 1).padStart(3, "0")}.sql`),
      `${statement.text};\n`,
      "utf8"
    );
  });
  console.log(`\nĐã ghi ${statements.length} file vào ${dir}`);
}
