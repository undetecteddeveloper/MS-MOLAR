// Vân tay schema.sql + CỔNG THẬT cho TD-005.
//
// Hai nhóm test, hai mục đích khác nhau:
//
//   1. "computeSchemaFingerprint" — kiểm chính hàm băm trên các mẩu SQL dựng
//      sẵn. Nếu nó nhạy sai chỗ (đổi comment → đổi vân tay) hoặc điếc sai chỗ
//      (đổi `on delete` → vân tay giữ nguyên), cổng ở nhóm 2 sẽ xanh một cách
//      vô nghĩa.
//   2. "schema.sql" — đọc FILE THẬT và bắt buộc ba nơi phải khớp nhau: hằng số
//      TypeScript, giá trị schema.sql tự khai ở §17, và giá trị tính lại từ nội
//      dung. Đây là cổng mà TD-005 cần: nó chạy trong `npm test` nên nổ ngay ở
//      PR — không cần DB, không cần credential, không cần ai nhớ chạy gì.
//
// Sửa schema.sql xong test này FAIL kèm giá trị mới phải dán vào. Đó là hành vi
// ĐÚNG, không phải test dễ vỡ: vân tay đổi nghĩa là mọi DB đang chạy bản cũ.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SCHEMA_FINGERPRINT,
  computeSchemaFingerprint,
  parseDeclaredFingerprint,
} from "../schemaFingerprint";

const SCHEMA_PATH = resolve(__dirname, "../../../supabase/schema.sql");
const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

describe("computeSchemaFingerprint", () => {
  it("ổn định giữa hai lần gọi trên cùng nội dung", () => {
    const sql = "create table t (id int);";
    expect(computeSchemaFingerprint(sql)).toBe(computeSchemaFingerprint(sql));
  });

  it("KHÔNG đổi khi chỉ sửa comment hoặc xuống dòng", () => {
    // Đánh đổi có chủ đích: file này viết rất nhiều comment giải thích. Nếu mỗi
    // dòng chữ thêm vào lại đòi paste lại schema.sql lên 2 DB thì cổng sẽ bị
    // tắt đi vì nhiễu, và nợ quay lại y như cũ.
    const before = `-- ghi chú cũ\ncreate table t (id int);`;
    const after = `-- ghi chú MỚI, dài hơn nhiều\n\ncreate  table   t (id int);   -- thêm cuối dòng`;
    expect(computeSchemaFingerprint(after)).toBe(computeSchemaFingerprint(before));
  });

  it("ĐỔI khi sửa SQL thật — kể cả chỉ một chữ trong `on delete`", () => {
    // Chính là hình dạng của bug xoá đề 2026-08-04.
    const cascade = `alter table a add constraint f foreign key (b) references c (id) on delete cascade;`;
    const noAction = `alter table a add constraint f foreign key (b) references c (id) on delete no action;`;
    expect(computeSchemaFingerprint(noAction)).not.toBe(computeSchemaFingerprint(cascade));
  });

  it("ĐỔI khi sửa thân hàm $$...$$", () => {
    // Thân hàm là nơi §10b/§11b đặt gần hết logic bảo mật; băm mà bỏ qua nó thì
    // một bản vá SECURITY DEFINER sẽ không làm đổi vân tay.
    const v1 = `create function f() returns int language sql as $$ select 1 $$;`;
    const v2 = `create function f() returns int language sql as $$ select 2 $$;`;
    expect(computeSchemaFingerprint(v2)).not.toBe(computeSchemaFingerprint(v1));
  });

  it("KHÔNG tính khối @schema-fingerprint vào vân tay", () => {
    // Nếu tính, băm sẽ chứa chính nó và không bao giờ hội tụ.
    const withA = `create table t (id int);\n-- @schema-fingerprint-begin\ninsert into public.schema_version (id, fingerprint) values (1, 'aaaaaaaaaaaa');\n-- @schema-fingerprint-end`;
    const withB = withA.replace("aaaaaaaaaaaa", "bbbbbbbbbbbb");
    expect(computeSchemaFingerprint(withB)).toBe(computeSchemaFingerprint(withA));
  });

  it("không nhầm `--` nằm TRONG chuỗi là comment", () => {
    const inString = `insert into t (s) values ('a--b');`;
    const truncated = `insert into t (s) values ('a`;
    expect(computeSchemaFingerprint(inString)).not.toBe(computeSchemaFingerprint(truncated));
  });
});

describe("parseDeclaredFingerprint", () => {
  it("đọc được giá trị §17 khai", () => {
    const sql = `insert into public.schema_version (id, fingerprint)\nvalues (1, 'deadbeef1234')\non conflict (id) do update set fingerprint = excluded.fingerprint;`;
    expect(parseDeclaredFingerprint(sql)).toBe("deadbeef1234");
  });

  it("null khi file không có §17", () => {
    expect(parseDeclaredFingerprint("create table t (id int);")).toBeNull();
  });
});

describe("schema.sql", () => {
  it("§17 tồn tại và khai một vân tay", () => {
    // Mất §17 = mất luôn khả năng biết DB đang ở bản nào — quay về đúng TD-005.
    expect(parseDeclaredFingerprint(schemaSql)).not.toBeNull();
  });

  it("hằng số TS, giá trị §17 khai, và giá trị tính lại — cả ba khớp nhau", () => {
    const computed = computeSchemaFingerprint(schemaSql);
    const declared = parseDeclaredFingerprint(schemaSql);

    // Thông điệp dài có chủ đích: người làm FAIL này thường KHÔNG phải người đã
    // dựng cơ chế, và họ cần biết chính xác phải sửa gì chứ không phải đi đọc
    // lại hai file.
    const howToFix =
      `\n\nschema.sql đã đổi nội dung SQL. Vân tay mới: ${computed}\n` +
      `  1. lib/schema/schemaFingerprint.ts → SCHEMA_FINGERPRINT = "${computed}"\n` +
      `  2. supabase/schema.sql §17 → values (1, '${computed}')\n` +
      `  3. paste lại schema.sql lên MỌI môi trường (dev + prod), rồi\n` +
      `     npm run verify:schema\n` +
      `Bỏ qua bước 3 = đúng lỗi TD-005: git có bản vá mà DB thì không.`;

    expect(computed, howToFix).toBe(declared);
    expect(SCHEMA_FINGERPRINT, howToFix).toBe(computed);
  });
});
