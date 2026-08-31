// Cổng TĨNH cho §18 — "tác giả bị ban thì đề của họ rời khỏi catalog" (TD-032).
//
// VÌ SAO CẦN MỘT CỔNG RIÊNG, khi đã có vân tay schema. Vân tay chỉ trả lời được
// một câu: "DB có chạy đúng FILE trong git không". Nó im lặng tuyệt đối về việc
// file ấy còn NÓI ĐÚNG THỨ nó phải nói hay không. §4 và §18 định nghĩa CÙNG một
// policy `exams_select_visible`, và §18 chỉ đúng nhờ nó chạy SAU §4 trong cùng
// một file. Ai chèn một khối mới định nghĩa lại policy đó ở phía dưới — hoặc
// đơn giản là kéo §4 xuống — sẽ gỡ mất vế chặn mà KHÔNG có gì đỏ: vân tay đổi
// (nên nó vẫn đòi paste lại), test kia vẫn xanh, và catalog lặng lẽ hiện lại đề
// của tài khoản bị ban.
//
// Nên cổng này khẳng định thứ vân tay không khẳng định được: LƯỢT ĐỊNH NGHĨA
// CUỐI CÙNG của hai policy đọc có mang vế chặn hay không. Đọc file, không cần
// DB, không cần credential — cùng lớp với `schemaFingerprint.test.ts`.
//
// Cái nó KHÔNG kiểm, nói thẳng để không ai đọc nhầm: file trong git có gì không
// chứng minh được DB có gì. Phần đó là việc của vân tay §17 + `verify:schema`.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCHEMA_PATH = resolve(__dirname, "../../../supabase/schema.sql");
const schemaSql = readFileSync(SCHEMA_PATH, "utf8");

/**
 * Thân `using (...)` của lượt `create policy <name> on <table> for select` CUỐI
 * CÙNG trong file.
 *
 * CUỐI CÙNG, không phải đầu tiên: Postgres chạy file từ trên xuống và mỗi lượt
 * `drop policy if exists` + `create policy` ghi đè lượt trước, nên chỉ lượt cuối
 * mới là policy thật sự sống trên DB. Một phép kiểm "có xuất hiện chuỗi X đâu đó
 * trong file" sẽ xanh cả khi X nằm ở một khối đã bị khối sau ghi đè — đúng kiểu
 * dương tính giả mà cổng này sinh ra để chặn.
 */
function lastSelectPolicyBody(policyName: string, table: string): string {
  const re = new RegExp(
    `create policy "${policyName}" on public\\.${table}\\s+for select[\\s\\S]*?using \\(([\\s\\S]*?)\\n  \\);`,
    "g"
  );
  const bodies = [...schemaSql.matchAll(re)].map((m) => m[1]);
  if (bodies.length === 0) {
    throw new Error(
      `Không tìm thấy lượt \`create policy "${policyName}" on public.${table} for select\` nào trong schema.sql — ` +
        "hoặc policy đã bị xoá, hoặc hình dạng câu lệnh đã đổi và chính cổng này đang mù."
    );
  }
  return bodies[bodies.length - 1].replace(/\s+/g, " ").trim();
}

describe("§18 — đề của tác giả bị ban không còn trong catalog", () => {
  it("vị từ `is_author_banned` tồn tại, là SECURITY DEFINER, và tôn trọng ban CÓ HẠN", () => {
    const fn = /create or replace function public\.is_author_banned\(p_author_id uuid\)[\s\S]*?\$\$;/.exec(
      schemaSql
    )?.[0];
    if (!fn) throw new Error("schema.sql không còn định nghĩa public.is_author_banned(uuid)");

    // DEFINER là điều kiện để hàm chạy được từ trong một RLS policy:
    // `authenticated` không có quyền đọc `auth.users`.
    expect(fn).toContain("security definer");
    // `search_path` cố định — hàm definer không có nó là một đường leo thang
    // quyền kinh điển, và schema này đã đặt cùng quy ước ở mọi hàm definer khác.
    expect(fn).toContain("set search_path = public, auth, pg_temp");
    // BAN CÓ HẠN: `is not null` một mình sẽ giữ đề bị ẩn vĩnh viễn sau khi lệnh
    // ban đã hết hạn — một kiểu hỏng không ai đi tìm, vì nó trông y hệt "chưa
    // được gỡ ban".
    expect(fn).toContain("u.banned_until > now()");
  });

  it("`exams_select_visible` — lượt định nghĩa CUỐI CÙNG mang vế chặn", () => {
    const body = lastSelectPolicyBody("exams_select_visible", "exams");
    expect(body).toBe(
      "(status = 'published' and not public.is_author_banned(author_id)) or author_id = auth.uid()"
    );
  });

  it("`questions_select_visible` đi theo `exams` — không thì nội dung câu hỏi vẫn đọc được", () => {
    // Đề biến mất mà câu hỏi thì không là đúng hình dạng lỗ hổng §10 đã phải vá
    // một lần: RLS lọc ở một bảng, và đường đọc thật đi vòng qua bảng bên cạnh.
    const body = lastSelectPolicyBody("questions_select_visible", "questions");
    expect(body).toContain("not public.is_author_banned(e.author_id)");
    expect(body).toContain("e.author_id = auth.uid()");
  });

  it("GRANT EXECUTE có cho `authenticated` — thiếu nó thì policy chết, không phải kín hơn", () => {
    // Biểu thức RLS chạy dưới quyền NGƯỜI GỌI. Không có EXECUTE thì mọi lượt
    // đọc `exams` của người dùng thật trả về lỗi 42501 chứ không phải trả về ít
    // dòng hơn — tức catalog trắng xoá cho tất cả mọi người.
    expect(schemaSql).toMatch(
      /grant execute on function public\.is_author_banned\(uuid\) to [^;]*authenticated/
    );
  });
});
