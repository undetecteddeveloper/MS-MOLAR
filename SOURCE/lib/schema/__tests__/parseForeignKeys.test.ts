// Parser khoá ngoại của schema.sql + CỔNG THẬT cho TD-011.
//
// Hai nhóm test, hai mục đích khác nhau:
//
//   1. "parseForeignKeys" — kiểm chính parser trên các mẩu SQL dựng sẵn. Nếu
//      parser mù một dạng cú pháp, cổng ở nhóm 2 sẽ xanh một cách vô nghĩa.
//   2. "schema.sql" — đọc FILE THẬT và bắt buộc mọi khoá ngoại phải khai
//      `on delete`. Đây chính là cổng mà bug 2026-08-04 cần mà không có: nó
//      chạy trong `npm test` nên nổ ngay ở PR, không cần DB, không cần
//      credential, không cần ai nhớ chạy gì.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fkKey, parseForeignKeys, resolveForeignKeys } from "../parseForeignKeys";

const SCHEMA_PATH = resolve(__dirname, "../../../supabase/schema.sql");
const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

describe("parseForeignKeys", () => {
  it("ràng buộc mức cột trong create table, có on delete", () => {
    const fks = parseForeignKeys(`
      create table if not exists public.exam_attempts (
        id       uuid primary key default gen_random_uuid(),
        user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
        exam_id  text not null references public.exams (id) on delete cascade
      );
    `);
    expect(fks).toEqual([
      {
        childTable: "public.exam_attempts",
        childColumns: ["user_id"],
        parentTable: "auth.users",
        parentColumns: ["id"],
        onDelete: "cascade",
        constraintName: null,
      },
      {
        childTable: "public.exam_attempts",
        childColumns: ["exam_id"],
        parentTable: "public.exams",
        parentColumns: ["id"],
        onDelete: "cascade",
        constraintName: null,
      },
    ]);
  });

  it("THIẾU on delete → onDelete null (không im lặng coi là 'no action')", () => {
    // Đây đúng là văn bản đã gây ra bug: hợp lệ với Postgres, mặc định NO ACTION,
    // và không một cổng nào trước 2026-08-04 phân biệt được nó với chủ đích.
    const [fk] = parseForeignKeys(`
      create table public.exam_attempts (
        exam_id text not null references public.exams (id)
      );
    `);
    expect(fk.onDelete).toBeNull();
  });

  it("alter table add constraint ... foreign key (dạng §15/§16 dùng để vá)", () => {
    const [fk] = parseForeignKeys(`
      alter table public.attempt_answers
        add constraint attempt_answers_question_id_fkey
        foreign key (question_id) references public.questions (id) on delete cascade;
    `);
    expect(fk).toMatchObject({
      childTable: "public.attempt_answers",
      childColumns: ["question_id"],
      parentTable: "public.questions",
      onDelete: "cascade",
      constraintName: "attempt_answers_question_id_fkey",
    });
  });

  it("alter table add column ... references (dạng §1 thêm author_id)", () => {
    const [fk] = parseForeignKeys(
      `alter table public.exams add column if not exists author_id uuid references auth.users(id) on delete no action;`
    );
    expect(fk).toMatchObject({
      childTable: "public.exams",
      childColumns: ["author_id"],
      parentTable: "auth.users",
      onDelete: "no action",
    });
  });

  it("`no action` viết cách kiểu gì cũng chuẩn hoá về một chuỗi", () => {
    const [fk] = parseForeignKeys(
      `alter table public.t add constraint c foreign key (a) references public.p (id) ON   DELETE   NO    ACTION;`
    );
    expect(fk.onDelete).toBe("no action");
  });

  it("foreign key nhiều cột ở mức bảng", () => {
    const [fk] = parseForeignKeys(`
      create table public.child (
        a int, b int,
        foreign key (a, b) references public.parent (x, y) on delete set null
      );
    `);
    expect(fk.childColumns).toEqual(["a", "b"]);
    expect(fk.parentColumns).toEqual(["x", "y"]);
    expect(fk.onDelete).toBe("set null");
  });

  it("thiếu schema → mặc định public, đúng như Postgres hiểu", () => {
    const [fk] = parseForeignKeys(
      `create table exams_copy ( exam_id text references exams (id) on delete cascade );`
    );
    expect(fk.childTable).toBe("public.exams_copy");
    expect(fk.parentTable).toBe("public.exams");
  });

  it("KHÔNG nhận nhầm check constraint có dấu phẩy lồng trong ngoặc", () => {
    const fks = parseForeignKeys(`
      create table public.exam_moderation_log (
        id      uuid primary key,
        action  text not null check (action in ('remove','restore')),
        exam_id text not null references public.exams(id) on delete cascade
      );
    `);
    expect(fks).toHaveLength(1);
    expect(fks[0].childColumns).toEqual(["exam_id"]);
  });

  it("bỏ qua chữ `references` nằm trong comment và trong thân hàm $$", () => {
    const fks = parseForeignKeys(`
      -- exam_id references public.exams (id)  <- chỉ là văn xuôi
      create function public.f() returns void language plpgsql as $$
      begin
        -- references public.exams (id);
        perform 1;
      end;
      $$;
      create table public.real ( exam_id text references public.exams (id) on delete cascade );
    `);
    expect(fks).toHaveLength(1);
    expect(fks[0].childTable).toBe("public.real");
  });
});

describe("resolveForeignKeys", () => {
  it("khai sau đè khai trước — đúng cơ chế §15 dùng để vá bug xoá đề", () => {
    // Nếu lấy bản ĐẦU thì đọc ra chính cái schema đã hỏng, và cổng sẽ báo xanh
    // trên một file thực ra đã được vá.
    const resolved = resolveForeignKeys(`
      create table public.exam_attempts (
        exam_id text not null references public.exams (id)
      );
      alter table public.exam_attempts
        add constraint exam_attempts_exam_id_fkey
        foreign key (exam_id) references public.exams (id) on delete cascade;
    `);
    expect(resolved.size).toBe(1);
    expect(resolved.get("public.exam_attempts(exam_id)")?.onDelete).toBe("cascade");
  });

  it("hai khoá ngoại khác cột trên cùng bảng là hai mục riêng", () => {
    const resolved = resolveForeignKeys(`
      create table public.exam_results (
        attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
        user_id    uuid not null references auth.users (id) on delete cascade
      );
    `);
    expect([...resolved.keys()].sort()).toEqual([
      "public.exam_results(attempt_id)",
      "public.exam_results(user_id)",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Cổng thật — chạy trên schema.sql của repo.
// ---------------------------------------------------------------------------
describe("schema.sql", () => {
  const resolved = resolveForeignKeys(schemaSql);

  it("parse ra được một tập khoá ngoại khác rỗng (parser chưa chết âm thầm)", () => {
    // Nếu ai đó đổi cách viết schema.sql tới mức parser mù hẳn, mọi assert dưới
    // đây sẽ xanh trên tập rỗng. Chốt chặn đó nằm ở đây.
    expect(resolved.size).toBeGreaterThanOrEqual(10);
  });

  it("MỌI khoá ngoại đều khai on delete rõ ràng (TD-011)", () => {
    const implicit = [...resolved.values()]
      .filter((fk) => fk.onDelete === null)
      .map((fk) => `${fk.childTable}(${fk.childColumns.join(",")}) -> ${fk.parentTable}`);

    expect(
      implicit,
      `Khoá ngoại thiếu \`on delete\` → Postgres mặc định NO ACTION, nghĩa là xoá\n` +
        `dòng cha sẽ bị chặn bằng 23503 ở production và KHÔNG cổng nào khác bắt được.\n` +
        `Đúng loại lỗi đã làm tác giả không xoá được đề (2026-08-04).\n` +
        `Viết rõ hành vi mong muốn, kể cả khi nó đúng bằng mặc định:\n` +
        `  ... references <bảng> (<cột>) on delete cascade | set null | no action\n` +
        `Chi tiết: schema.sql §16, docs/TECH-DEBT.md TD-011.\n` +
        `Đang thiếu:`
    ).toEqual([]);
  });

  it("hai khoá ngoại của bug 2026-08-04 vẫn là cascade (hồi quy)", () => {
    expect(resolved.get("public.exam_attempts(exam_id)")?.onDelete).toBe("cascade");
    expect(resolved.get("public.attempt_answers(question_id)")?.onDelete).toBe("cascade");
  });

  it("mọi thứ phái sinh từ một đề đều đi theo đề khi đề bị xoá", () => {
    // deleteExam xoá theo chuỗi; một mắt xích không cascade là một lần 23503.
    for (const key of [
      "public.exam_attempts(exam_id)",
      "public.exam_reports(exam_id)",
      "public.exam_difficulty_ratings(exam_id)",
      "public.exam_moderation_log(exam_id)",
      "public.exam_results(attempt_id)",
      "public.attempt_answers(attempt_id)",
      "public.attempt_answers(question_id)",
    ]) {
      expect(resolved.get(key)?.onDelete, `${key} phải cascade`).toBe("cascade");
    }
  });

  it("nhật ký kiểm toán và quyền tác giả KHÔNG cascade theo tài khoản", () => {
    // Xoá tài khoản mà cuốn theo đề công khai + nhật ký gỡ bài là mất dữ liệu
    // của người khác. Cả hai phải `set null` (TD-012, đổi 2026-08-07 từ
    // `no action`): đề sống sót nhờ snapshot `author_display_name` (ADR-0003),
    // nhật ký giữ nguyên DÒNG và chỉ mất danh tính actor.
    //
    // Test này CỐ Ý ghim giá trị chính xác chứ không chỉ "khác cascade": hai
    // giá trị sai theo hai kiểu khác nhau. `cascade` là mất dữ liệu người khác;
    // `no action` là một lần 23503 cho ngày làm tính năng xoá tài khoản.
    expect(resolved.get("public.exams(author_id)")?.onDelete).toBe("set null");
    expect(resolved.get("public.exam_moderation_log(actor_id)")?.onDelete).toBe("set null");
  });

  it("fkKey chuẩn hoá giống hệt cách verify-schema.ts khoá dữ liệu từ catalog", () => {
    expect(fkKey("exam_attempts", ["EXAM_ID"])).toBe("public.exam_attempts(exam_id)");
    expect(fkKey("public.exam_attempts", ["exam_id"])).toBe("public.exam_attempts(exam_id)");
  });
});

// ---------------------------------------------------------------------------
// payment_orders — ALLOWLIST cột. Nửa CẤU TRÚC của P-1 (backend DD § Sensitivity).
//
// P-1: KHÔNG trường nào của `transactions[]` (payOS) được lưu xuống cột nào.
// Dạng kiểm DUY NHẤT bắt được một cột mà chính người viết assert chưa từng nghĩ
// tới là ALLOWLIST: liệt kê đúng mười một cột đã thiết kế và ĐỎ với cột thứ mười
// hai, bất kể nó tên gì. Blocklist theo tên trường payOS thì mù đúng những
// trường mà bản v1.3 của DD đã bỏ sót (`counterAccountBankName`,
// `virtualAccountName`) — tức mù đúng chỗ nguy hiểm.
//
// Đây là cổng VĂN BẢN (gate A): nó chứng minh file trong git đúng hình dạng,
// KHÔNG chứng minh gì về database nào. Nội dung ở DB là việc của gate B.
// ---------------------------------------------------------------------------

/**
 * Mười một cột backend DD (§ Schema, `payment_orders`) khai, đúng thứ tự file.
 *
 * Chép tay CỐ Ý — cùng lý do `telemetry.test.ts:49` chép tay CHECK constraint:
 * sinh danh sách này từ chính schema.sql (hay import từ `lib/billing/types.ts`)
 * biến allowlist thành phép so một nguồn với chính nó, và một cột thêm vào sẽ
 * đi qua mà không ai thấy.
 */
const PAYMENT_ORDERS_COLUMNS = [
  "order_code",
  "user_id",
  "amount",
  "status",
  "created_at",
  "pending_until",
  "settled_at",
  "qr_payload",
  "account_number",
  "account_name",
  "memo",
];

/** Mở đầu `create table … public.payment_orders (` — dùng để định vị thân bảng. */
const PAYMENT_ORDERS_HEAD_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.payment_orders\s*\(/i;

/** Mục ở MỨC BẢNG trong thân `create table` — không phải khai báo cột. */
const TABLE_LEVEL_ITEM_RE =
  /^(constraint|primary\s+key|foreign\s+key|unique|check|exclude|like)\b/i;

/**
 * Tên các cột khai trong khối `create table` mà `head` định vị, theo thứ tự
 * xuất hiện.
 *
 * Bản sao CỤC BỘ của cách tách mà `parseForeignKeys.ts` dùng: hai helper ở đó
 * (`balancedBody`, `splitTopLevel`) không export, và file ấy nằm ngoài phạm vi
 * thay đổi này nên không được sửa chỉ để export. Là helper test, ngắn, không
 * dùng lại ở đâu khác.
 */
function parseColumnNames(sql: string, head: RegExp): string[] {
  const source = stripSqlLineComments(sql);
  const m = head.exec(source);
  if (!m) return [];
  const body = balancedBody(source, m.index + m[0].length - 1);
  if (body === null) return [];
  return splitTopLevel(body)
    .filter((item) => !TABLE_LEVEL_ITEM_RE.test(item))
    .map((item) => /^"?(\w+)"?/.exec(item)?.[1] ?? "")
    .filter(Boolean)
    .map((name) => name.toLowerCase());
}

/** Nội dung trong cặp ngoặc mở tại `open`, cân bằng độ sâu. */
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

/** Tách theo dấu phẩy ở ĐỘ SÂU 0 — `check (status in ('a','b'))` không bị cắt đôi. */
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

/**
 * Bỏ comment `--` cuối dòng, KHÔNG bỏ `--` nằm trong chuỗi (đếm nháy đơn).
 *
 * Bắt buộc phải chạy TRƯỚC khi đếm ngoặc/phẩy: khối payment_orders có comment
 * mang cả dấu phẩy lẫn ngoặc lẻ, đọc nguyên văn sẽ cắt nhầm danh sách cột.
 */
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

describe("schema.sql — payment_orders (allowlist cột, P-1)", () => {
  it("tập cột đúng bằng MƯỜI MỘT cột đã thiết kế, đúng thứ tự", () => {
    expect(
      parseColumnNames(schemaSql, PAYMENT_ORDERS_HEAD_RE),
      `Tập cột của public.payment_orders lệch khỏi thiết kế.\n` +
        `Đây là ALLOWLIST, không phải blocklist: một cột THÊM cũng đỏ, và đó là\n` +
        `chủ đích — P-1 (backend DD § Sensitivity) cấm lưu BẤT KỲ trường nào của\n` +
        `payOS \`transactions[]\`, kể cả trường mà người viết assert này chưa từng\n` +
        `nghe tên. Thêm cột thật sự cần thiết thì sửa danh sách ở đây TRONG CÙNG\n` +
        `commit, sau khi đã rà lại P-1.\nThực tế đọc được:`
    ).toEqual(PAYMENT_ORDERS_COLUMNS);
  });

  it("một cột thứ MƯỜI HAI làm ca trên đỏ — dù nó tên gì", () => {
    // Ca này là BẰNG CHỨNG ĐỎ của ca trên, chạy mọi lần: một allowlist không
    // đỏ nổi với cột lạ thì nó không chứng minh gì cả. Bản vá chỉ nằm trong bộ
    // nhớ — không có mutant nào chạm tới file trên đĩa.
    const perturbed = schemaSql.replace(
      "  settled_at    timestamptz,",
      "  settled_at    timestamptz,\n  counter_account_name text,"
    );
    expect(
      perturbed,
      "Mẫu chèn không còn khớp schema.sql → perturbation thành no-op, và ca này chứng minh SỐ KHÔNG."
    ).not.toBe(schemaSql);

    const columns = parseColumnNames(perturbed, PAYMENT_ORDERS_HEAD_RE);
    expect(columns).toHaveLength(PAYMENT_ORDERS_COLUMNS.length + 1);
    expect(columns).toContain("counter_account_name");
    expect(columns).not.toEqual(PAYMENT_ORDERS_COLUMNS);
  });
});
