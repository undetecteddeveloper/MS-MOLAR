// Tìm đề theo tên (ADR-0020) — fixture cho làn service (Postgres dev THẬT).
//
// Cùng khuôn với essayGradeWriteFixtures.ts: nạp `.env.local` bằng tay, client
// service_role để gieo/dọn, một tài khoản học sinh THẬT (JWT thật) cho các
// probe quyền. Tiền tố `es-svc-` cách ly mọi thứ lane này chạm tới (email, id
// đề, tiêu đề) để một lệnh dọn theo tiền tố không bao giờ với tới dữ liệu thật.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

export { adminClient, anonClient, HAS_LIVE_DB };

export const ES_PREFIX = "es-svc-";
const PASSWORD = "es-svc-password-123";

export interface SearchFixture {
  userId: string;
  email: string;
  /** Đề published có dấu — mục tiêu của các ca khớp. */
  publishedIds: { toan: string; hoa: string };
  /** Đề nháp cùng chữ "Toán" — KHÔNG được xuất hiện trong gợi ý. */
  draftId: string;
  /** Client mang JWT THẬT của học sinh vừa tạo. */
  studentClient: SupabaseClient;
}

/** Ba đề gieo cho một `slot`: hai published, một draft. Tiêu đề có dấu, hoa
 *  thường lẫn lộn, dấu gạch và ngoặc — đúng thứ ô tìm phải bỏ qua được. */
export function seededTitles(slot: string) {
  return {
    toan: `${ES_PREFIX}${slot} Đề luyện Toán 10 — Nguyên hàm (giữa kì)`,
    hoa: `${ES_PREFIX}${slot} KIỂM TRA Hóa Học 11: Bảng tuần hoàn`,
    draft: `${ES_PREFIX}${slot} Đề nháp Toán 12 chưa duyệt`,
  };
}

export async function setUp(admin: SupabaseClient, slot: string): Promise<SearchFixture> {
  const email = `${ES_PREFIX}${slot}@example.com`;
  await tearDownBySlot(admin, slot);

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr) throw userErr;
  const userId = created.user.id;

  const titles = seededTitles(slot);
  const publishedIds = { toan: `${ES_PREFIX}${slot}-toan`, hoa: `${ES_PREFIX}${slot}-hoa` };
  const draftId = `${ES_PREFIX}${slot}-draft`;
  const base = { question_ids: [] as string[], duration_minutes: 15, grade: 10 };
  const { error: examErr } = await admin.from("exams").insert([
    { id: publishedIds.toan, title: titles.toan, subject: "Math", status: "published", ...base },
    { id: publishedIds.hoa, title: titles.hoa, subject: "Chemistry", status: "published", ...base, grade: 11 },
    { id: draftId, title: titles.draft, subject: "Math", status: "draft", ...base, grade: 12 },
  ]);
  if (examErr) throw examErr;

  const studentClient = anonClient();
  const { error: signInErr } = await studentClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;

  return { userId, email, publishedIds, draftId, studentClient };
}

/** Dọn theo slot — IDEMPOTENT, gọi được cả khi setup gãy giữa chừng. */
export async function tearDownBySlot(admin: SupabaseClient, slot: string): Promise<void> {
  const email = `${ES_PREFIX}${slot}@example.com`;
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
  await admin.from("exams").delete().like("id", `${ES_PREFIX}${slot}-%`);
}

export async function tearDown(admin: SupabaseClient, fixture: SearchFixture | undefined, slot: string) {
  if (fixture) await fixture.studentClient.auth.signOut();
  await tearDownBySlot(admin, slot);
}

/** Client service_role thứ hai, tách khỏi `adminClient()` của fixture kia chỉ
 *  để file test này không phụ thuộc chi tiết export của fixture láng giềng. */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
