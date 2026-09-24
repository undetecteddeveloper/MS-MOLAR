// Community Solutions — làn SERVICE (Postgres dev THẬT, không mock). Backend
// Design Doc v1.9 § Integration Verification Points, test task 05 (migration
// task 03), overview R4: `describe.skipIf(!HAS_LIVE_DB)`, cùng tiền lệ
// `exam-search.service.e2e.test.ts`'s `search_normalize` twin test.
//
// Tiền đề (giống mọi file trong làn này): `npm run verify:schema` phải XANH
// TRÊN DEV trước khi chạy `npm run test:localdb`. Chạy: `npm run test:localdb`
// (từ SOURCE/), với `--exclude` cho skeleton `community-solutions.service.e2e.test.ts`
// (R1, còn comment-only tới task 47).
//
// CHỈ MỘT case ở đây: `count_words()` (SQL, schema.sql) so với `countWords()`
// (TS, lib/solutions/countWords.ts) phải cho CÙNG kết quả trên mọi input
// AC-023 exercise — bộ đếm ở NoteEditor và luật 15-từ ở server đọc từ một công
// thức, không phải hai regex viết tay lệch nhau. File này KHÔNG phải một hành
// trình service-integration-e2e mới — ngân sách SE giữ nguyên SE1/SE2 ở task
// 47 (task file § Implementation Content).
//
// Các case "Publish refusal DETAIL" / "Save refusal token" / "Writer payload
// key set" sống ở `supabase/test-rls.ts` (Design Doc cho phép sống ở MỘT
// trong hai nơi, miễn là chạy — task file § Implementation Content).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countWords } from "@/lib/solutions/countWords";
import { adminClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CS_WORDGATE_PREFIX = "cs-wordgate-svc-";
const PASSWORD = "cs-wordgate-password-123";

// Chuỗi thử — bám ĐÚNG các ca AC-023 nêu tên (PRD dòng AC-023): ví dụ "Chọn A
// vì A đúng" (5 từ) không đạt; 14 từ + một công thức viết liền không khoảng
// trắng bên trong tính là từ thứ 15 và đạt; xuống dòng và tab tách từ như dấu
// cách; cùng chuỗi phải ra cùng kết quả. CHỈ dùng khoảng trắng ASCII (dấu
// cách/tab/xuống dòng) — đây là ranh giới AC-023 thật sự đòi, KHÔNG mở rộng
// sang khoảng trắng Unicode kiểu NBSP/em-space: `btrim`/`\s` phía Postgres và
// `.trim()`/`\s` phía JS không cùng bảng ký tự cho các lớp đó, nên một chuỗi
// CHỈ gồm ký tự trắng phi-ASCII (không có dấu cách thường nào) sẽ lệch kết quả
// giữa hai bên — một khác biệt CÓ THẬT nhưng NẰM NGOÀI 5 ca AC-023 nêu tên,
// nên không đưa vào bộ thử bắt buộc này (xem báo cáo task 05 — ghi nhận riêng,
// không phải divergence trong phạm vi task này).
const CASES = [
  "",
  "   ",
  "Chọn A vì A đúng",
  `${Array.from({ length: 14 }, (_, i) => `tu${i + 1}`).join(" ")} $\\Delta=b^2-4ac$`,
  "một\thai",
  "một\nhai",
  "một hai ba",
  "  cách   nhau   nhiều   khoảng   trắng  ",
  Array.from({ length: 14 }, (_, i) => `tu${i + 1}`).join(" "),
  Array.from({ length: 15 }, (_, i) => `tu${i + 1}`).join(" "),
  Array.from({ length: 20 }, (_, i) => `tu${i + 1}`).join("\n"),
  "Đề Toán học kỳ I — câu 1: giải phương trình x² + 2x + 1 = 0.",
];

describe.skipIf(!HAS_LIVE_DB)("count_words (SQL) vs countWords (TS) — twin agreement (AC-023)", () => {
  const admin = adminClient();
  let studentClient: SupabaseClient | undefined;
  let studentEmail: string | undefined;

  beforeAll(async () => {
    studentEmail = `${CS_WORDGATE_PREFIX}${Date.now()}@example.com`;
    const created = await admin.auth.admin.createUser({
      email: studentEmail,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.error) throw created.error;

    studentClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInErr } = await studentClient.auth.signInWithPassword({
      email: studentEmail,
      password: PASSWORD,
    });
    if (signInErr) throw signInErr;
  }, 60_000);

  afterAll(async () => {
    await studentClient?.auth.signOut();
    if (studentEmail) {
      const list = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = list.data?.users.find((u) => u.email === studentEmail);
      if (user) await admin.auth.admin.deleteUser(user.id);
    }
  }, 60_000);

  it("count_words(x) (SQL) và countWords(x) (TS) đồng ý trên mọi input AC-023", async () => {
    for (const sample of CASES) {
      const { data, error } = await studentClient!.rpc("count_words", { p_text: sample });
      expect(error).toBeNull();
      expect(data).toBe(countWords(sample));
    }
  });
});
