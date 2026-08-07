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
    // của người khác. `no action` ở đây là chủ đích, và §16b ghi rõ hệ quả.
    expect(resolved.get("public.exams(author_id)")?.onDelete).toBe("no action");
    expect(resolved.get("public.exam_moderation_log(actor_id)")?.onDelete).toBe("no action");
  });

  it("fkKey chuẩn hoá giống hệt cách verify-schema.ts khoá dữ liệu từ catalog", () => {
    expect(fkKey("exam_attempts", ["EXAM_ID"])).toBe("public.exam_attempts(exam_id)");
    expect(fkKey("public.exam_attempts", ["exam_id"])).toBe("public.exam_attempts(exam_id)");
  });
});
