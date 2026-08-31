// Bộ cắt câu lệnh của `schema.sql` (TECH-DEBT TD-005).
//
// HAI NHÓM, hai mục đích:
//   1. Các mẩu SQL dựng sẵn — kiểm từng ngữ cảnh mà một dấu `;` KHÔNG được kết
//      thúc câu lệnh. Cắt sai ở đây không tạo ra lỗi ồn ào: nó tạo ra một lượt
//      apply gửi đi một hàm CỤT, và Postgres sẽ từ chối nó với một thông báo
//      chẳng liên quan gì tới nguyên nhân.
//   2. FILE THẬT — bộ cắt phải sống sót qua `supabase/schema.sql` nguyên bản,
//      và những bất biến ở dưới là thứ phân biệt "chạy xong" với "chạy đúng".
//      Không có nhóm 2 thì nhóm 1 xanh trên một ngôn ngữ SQL tưởng tượng.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { describeStatement, splitSqlStatements } from "../splitStatements";

const SCHEMA_PATH = resolve(__dirname, "../../../supabase/schema.sql");
const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

const texts = (sql: string) => splitSqlStatements(sql).map((s) => s.text);

describe("splitSqlStatements — các ngữ cảnh mà `;` không cắt", () => {
  it("cắt hai câu lệnh phẳng", () => {
    expect(texts("select 1; select 2;")).toEqual(["select 1", "select 2"]);
  });

  it("KHÔNG cắt bên trong `$$ ... $$`", () => {
    // Ca đắt nhất của file thật: mọi hàm plpgsql chứa nhiều `;` trong thân.
    const sql = "create function f() returns void language plpgsql as $$ begin a; b; end; $$; select 1;";
    expect(texts(sql)).toEqual([
      "create function f() returns void language plpgsql as $$ begin a; b; end; $$",
      "select 1",
    ]);
  });

  it("dollar-quote CÓ NHÃN chỉ đóng ở nhãn KHỚP", () => {
    // `$a$ ... $b$ ... $a$` là SQL hợp lệ: `$b$` bên trong chỉ là văn bản. So
    // theo "hai ký tự đô la" sẽ đóng nhầm ở giữa và cắt câu lệnh làm đôi.
    const sql = "do $outer$ select $inner$ x; y $inner$; $outer$; select 2;";
    expect(texts(sql)).toEqual(["do $outer$ select $inner$ x; y $inner$; $outer$", "select 2"]);
  });

  it("KHÔNG cắt bên trong chuỗi, và `''` là dấu nháy escape", () => {
    const sql = "insert into t values ('a;b'); insert into t values ('it''s; fine'); select 1;";
    expect(texts(sql)).toEqual([
      "insert into t values ('a;b')",
      "insert into t values ('it''s; fine')",
      "select 1",
    ]);
  });

  it("KHÔNG cắt bên trong định danh có nháy kép", () => {
    // Tên policy của repo này đều mang nháy kép.
    expect(texts('drop policy if exists "a;b" on t; select 1;')).toEqual([
      'drop policy if exists "a;b" on t',
      "select 1",
    ]);
  });

  it("KHÔNG cắt bên trong comment `--` hay `/* */`", () => {
    const sql = "select 1 -- ghi chú; có dấu chấm phẩy\n; /* khối; cũng có */ select 2;";
    expect(texts(sql)).toEqual([
      "select 1 -- ghi chú; có dấu chấm phẩy",
      "/* khối; cũng có */ select 2",
    ]);
  });

  it("đoạn CHỈ CÓ comment không phải một câu lệnh", () => {
    // Đếm chúng vào N làm con số đối chiếu dư ra — hướng sai khó phát hiện
    // nhất, vì một lượt apply "thiếu vài câu so với kế hoạch" trông như bình
    // thường.
    expect(texts("-- chỉ là ghi chú\n\n/* và một khối nữa */\n\nselect 1;")).toEqual([
      "-- chỉ là ghi chú\n\n/* và một khối nữa */\n\nselect 1",
    ]);
    expect(texts("-- không có SQL nào ở đây\n")).toEqual([]);
  });

  it("câu lệnh cuối KHÔNG có `;` vẫn được trả về", () => {
    expect(texts("select 1;\nselect 2")).toEqual(["select 1", "select 2"]);
  });

  it("chuỗi rỗng ra danh sách rỗng, không ném", () => {
    expect(splitSqlStatements("")).toEqual([]);
  });
});

describe("splitSqlStatements — trên chính supabase/schema.sql", () => {
  const statements = splitSqlStatements(schemaSql);

  it("cắt ra một số lượng câu lệnh HỢP LÝ, không phải 1 và không phải hàng nghìn", () => {
    // Biên rộng có chủ đích: đây không phải chỗ ghim con số chính xác (nó đổi
    // mỗi lần schema đổi, và vân tay đã lo việc đó). Nó chỉ chặn hai chế độ
    // hỏng câm: bộ cắt trả về nguyên file làm MỘT câu (dollar-quote nuốt hết),
    // hoặc nổ vụn ra vì `;` trong thân hàm bị tính.
    expect(statements.length).toBeGreaterThan(100);
    expect(statements.length).toBeLessThan(1_000);
  });

  it("KHÔNG câu lệnh nào có số lẻ dấu `$$` — dấu hiệu của một thân hàm bị cắt đôi", () => {
    for (const statement of statements) {
      const opens = statement.text.match(/\$\$/g)?.length ?? 0;
      expect(
        opens % 2,
        `Câu lệnh ở dòng ${statement.line} có ${opens} dấu $$ — thân hàm bị cắt đôi`
      ).toBe(0);
    }
  });

  it("mỗi câu lệnh có SQL thật, không câu nào chỉ là comment", () => {
    for (const statement of statements) {
      expect(describeStatement(statement).length).toBeGreaterThan(0);
    }
  });

  it("nối lại đúng thứ tự thì giữ nguyên MỌI câu lệnh của file gốc", () => {
    // Bất biến ĐẾM VÀO = ĐẾM RA cho SQL: mọi từ khoá mở đầu câu lệnh trong file
    // phải xuất hiện đúng số lần ấy trong danh sách cắt ra. Một câu lệnh rơi
    // mất giữa chừng là chính chế độ hỏng TD-005 mô tả, và nó sẽ không lộ ra ở
    // bất kỳ ca nào ở trên.
    const joined = statements.map((s) => s.text).join("\n;\n");
    for (const keyword of [
      "create policy",
      "drop policy if exists",
      "create table if not exists",
      "grant execute on function",
      "alter table",
    ]) {
      const re = new RegExp(keyword, "gi");
      expect(joined.match(re)?.length ?? 0, keyword).toBe(schemaSql.match(re)?.length ?? 0);
    }
  });

  it("câu lệnh CUỐI CÙNG là lượt ghi vân tay của §17", () => {
    // §17 tự khai điều này bằng chữ ("PHẢI là câu lệnh CUỐI CÙNG của file"), và
    // nó là một tính chất AN TOÀN: paste đứt giữa chừng thì vân tay không được
    // ghi, nên DB thà không biết mình là bản nào còn hơn khai nhận một bản nó
    // chưa chạy hết. Một khối mới chèn nhầm xuống dưới sẽ hỏng ở đây.
    expect(statements[statements.length - 1].text).toContain("insert into public.schema_version");
  });
});
