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
import { TELEMETRY_ERROR_CODES } from "../../tutor/telemetry";

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

// ---------------------------------------------------------------------------
// telemetry_log.error_code — HAI danh sách literal trong cùng một file (AC-045/046)
//
// Từ R13, `error_code in ( … )` xuất hiện HAI lần trong schema.sql, và bắt buộc
// cả hai:
//   (1) CHECK inline trong `create table … telemetry_log` — để một lần provision
//       MỚI là đúng;
//   (2) cặp `drop constraint` / `add constraint telemetry_log_error_code_check`
//       — để một DB ĐÃ provision (dev, prod) là đúng; ở đó `create table if not
//       exists` là no-op nên (1) một mình không chạm tới được.
//
// Hỏng đúng kiểu mà cổng này sinh ra để chặn: nới MỘT trong hai rồi tưởng xong,
// và chỉ một trong hai database rốt cuộc đúng — đúng hình dạng TD-005.
// ---------------------------------------------------------------------------

/**
 * Sáu literal mà CHECK constraint phải mang sau R13, đúng thứ tự.
 *
 * Chép tay CỐ Ý, cùng lý do `telemetry.test.ts:49` chép tay: đọc kỳ vọng ra từ
 * chính schema.sql (hoặc so hai chỗ SQL với nhau) chỉ chứng minh hai bản sao
 * giống nhau, kể cả khi cả hai cùng sai.
 */
const SCHEMA_TELEMETRY_ERROR_CODES = [
  "gemini_unavailable",
  "rate_limited",
  "server",
  "not_eligible",
  "user_quota_exhausted",
  "project_budget_exhausted",
];

/** Hai literal mà R13 thêm — phía SQL đã có, phía code CHƯA (plan Task 5.5). */
const CODES_PENDING_ON_TS_SIDE = ["user_quota_exhausted", "project_budget_exhausted"];

const ERROR_CODE_IN_RE = /error_code\s+in\s*\(([^)]*)\)/gi;
const SQL_LITERAL_RE = /'([^']*)'/g;

/** Câu lệnh chứa một danh sách literal — hai loại, hai mục đích khác nhau. */
type ErrorCodeSite = {
  construct: "create table" | "add constraint" | "unknown";
  codes: string[];
};

/**
 * MỌI occurrence `error_code in ( … )` trong file, kèm loại câu lệnh chứa nó.
 *
 * Ghi lại `construct` chứ không chỉ đếm: hai bản sao của cùng MỘT dạng câu lệnh
 * vẫn đủ "hai occurrence", trong khi chuyện phải đúng là một inline + một
 * `add constraint`. Đếm suông sẽ xanh trên đúng cái nó phải bắt.
 */
function parseErrorCodeSites(sql: string): ErrorCodeSite[] {
  const sites: ErrorCodeSite[] = [];
  for (const stmt of stripSqlLineComments(sql).split(";")) {
    for (const list of stmt.matchAll(ERROR_CODE_IN_RE)) {
      sites.push({
        construct: classifyConstruct(stmt),
        codes: [...list[1].matchAll(SQL_LITERAL_RE)].map((m) => m[1]),
      });
    }
  }
  return sites;
}

function classifyConstruct(stmt: string): ErrorCodeSite["construct"] {
  if (/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.telemetry_log\b/i.test(stmt))
    return "create table";
  if (
    /alter\s+table\s+public\.telemetry_log\s+add\s+constraint\s+telemetry_log_error_code_check\b/i.test(
      stmt
    )
  )
    return "add constraint";
  return "unknown";
}

/** Bỏ comment `--` cuối dòng, KHÔNG bỏ `--` trong chuỗi (đếm nháy đơn). Cả hai
 *  danh sách literal đều có comment xen giữa các literal. */
function stripSqlLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      let quotes = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "'") quotes++;
        else if (line[i] === "-" && line[i + 1] === "-" && quotes % 2 === 0) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

describe("schema.sql — hai danh sách error_code phải khớp nhau (AC-045)", () => {
  it("đúng HAI occurrence, đúng hai loại câu lệnh, mỗi bên đúng sáu literal", () => {
    // Một assert duy nhất khoá cả ba việc: SỐ LƯỢNG (hai, không phải một —
    // "tìm thấy một rồi pass" chính là chế độ hỏng chính của ca này), CHỖ ĐẶT
    // (inline + add constraint), và NỘI DUNG (sáu literal, đúng thứ tự).
    expect(
      parseErrorCodeSites(schemaSql),
      `Hai danh sách literal của telemetry_log.error_code không còn khớp thiết kế.\n` +
        `Nới một chỗ mà quên chỗ kia = một database đúng, một database sai, và mọi\n` +
        `cổng khác vẫn xanh (TD-005). Sửa CẢ HAI trong cùng commit:\n` +
        `  1. CHECK inline trong create table … public.telemetry_log\n` +
        `  2. add constraint telemetry_log_error_code_check\n` +
        `Đọc được:`
    ).toEqual([
      { construct: "create table", codes: SCHEMA_TELEMETRY_ERROR_CODES },
      { construct: "add constraint", codes: SCHEMA_TELEMETRY_ERROR_CODES },
    ]);
  });

  it("thiếu MỘT literal ở MỘT trong hai chỗ là đủ để ca trên đỏ", () => {
    // BẰNG CHỨNG ĐỎ, chạy mọi lần: đây đúng là chế độ hỏng mà ca trên tồn tại
    // để chặn — inline được nới, cặp drop/add thì không. Bản vá chỉ nằm trong
    // bộ nhớ; không mutant nào chạm tới file trên đĩa.
    const dropped = "'project_budget_exhausted'";
    const cut = schemaSql.lastIndexOf(dropped);
    expect(cut, `Không tìm thấy ${dropped} ở danh sách thứ hai`).toBeGreaterThan(0);

    const perturbed = schemaSql.slice(0, cut) + schemaSql.slice(cut + dropped.length);
    const sites = parseErrorCodeSites(perturbed);

    expect(sites[0].codes).toEqual(SCHEMA_TELEMETRY_ERROR_CODES);
    expect(sites[1].codes).toEqual(SCHEMA_TELEMETRY_ERROR_CODES.slice(0, 5));
    expect(sites[1].codes).not.toEqual(sites[0].codes);
  });

  it("BẪY cho plan Task 5.5: TELEMETRY_ERROR_CODES còn thiếu ĐÚNG hai mã R13", () => {
    // Vì sao không phải assert cuối cùng (`mỗi site === TELEMETRY_ERROR_CODES`,
    // backend DD § R13): hôm nay nó KHÔNG xanh nổi, và đó là thứ tự ĐÚNG — nới
    // CHECK trước, code phát mã sau (plan Task 5.5 sở hữu telemetry.ts, task
    // này không được chạm vào). Làm nhẹ assert thành `toContain` thì trả về một
    // cổng xanh không phân biệt được gì.
    //
    // Nên ca này ghim ĐỘ LỆCH, chính xác tới từng mã. Nó đỏ theo CẢ HAI chiều:
    // phía SQL đổi (đã có ca trên), và phía code nới ra — kể cả nới đúng. Cái
    // đỏ ở Task 5.5 là TÍN HIỆU, không phải hỏng: thông điệp dưới đây nói rõ
    // phải thay bằng gì.
    const sqlCodes = parseErrorCodeSites(schemaSql)[0].codes;
    const tsCodes = [...TELEMETRY_ERROR_CODES] as string[];

    expect(
      tsCodes.filter((code) => !sqlCodes.includes(code)),
      `TELEMETRY_ERROR_CODES mang mã mà CHECK constraint KHÔNG nhận → mọi lượt\n` +
        `ghi telemetry với mã đó bị Postgres từ chối (23514). Chiều lệch này\n` +
        `không bao giờ chấp nhận được: sửa schema.sql trước.\nThừa ở phía code:`
    ).toEqual([]);

    expect(
      sqlCodes.filter((code) => !tsCodes.includes(code)),
      `\n\nPhía code đã bắt kịp phía SQL (hoặc lệch theo kiểu khác).\n` +
        `Nếu đây là plan Task 5.5 (telemetry.ts:35 vừa nhận hai mã R13): XOÁ ca\n` +
        `này và thay bằng assert cuối cùng mà backend DD § R13 yêu cầu —\n` +
        `  expect(parseErrorCodeSites(schemaSql)).toEqual([\n` +
        `    { construct: "create table", codes: [...TELEMETRY_ERROR_CODES] },\n` +
        `    { construct: "add constraint", codes: [...TELEMETRY_ERROR_CODES] },\n` +
        `  ]);\n` +
        `Ca này là BẪY giữ chỗ cho đúng thời điểm đó, không phải hợp đồng vĩnh viễn.\n` +
        `Đang lệch:`
    ).toEqual(CODES_PENDING_ON_TS_SIDE);
  });
});
