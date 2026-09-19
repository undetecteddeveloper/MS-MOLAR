// Kho đề theo kệ — exam_hot_counts() (ADR-0021 D1) — fixture cho làn service
// (Postgres dev THẬT).
//
// Design Doc: docs/design/exam-shelves-backend-design.md (§ The SQL objects
//   :210-296, § Test Boundaries and Placement :609-633, row :620).
// ADR:        docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//   (D1 hình dạng aggregate, D5/D6 cột `source`/CHECK, "Implementation Guidance").
//
// Cùng khuôn với `examSearchFixtures.ts`: nạp `.env.local` bằng tay qua
// `essayGradeWriteFixtures.ts` (không nạp lại ở đây), client service_role để
// gieo/dọn, tiền tố `hc-svc-` cách ly mọi thứ lane này chạm tới (email, id đề)
// để một lệnh dọn theo tiền tố không bao giờ với tới dữ liệu thật.
//
// KHÁC `examSearchFixtures.ts` ở một điểm: `exam_hot_counts()` là hàm xuyên
// user (`security definer`), nên phép thử cần HAI tài khoản thật — A luôn là
// người GỌI RPC (không bao giờ bị ban, để mọi lời gọi sau đó vẫn hoạt động),
// B đóng vai người nộp bài lẫn vai tác giả bị ban/gỡ ban (đề `bannedAuthor`)
// — không mượn A cho vai tác giả, vì ban chính người đang gọi RPC sẽ làm hỏng
// mọi lời gọi kế tiếp trong cùng lượt chạy.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

export { adminClient, anonClient, HAS_LIVE_DB };

export const HC_PREFIX = "hc-svc-";
const PASSWORD = "hc-svc-password-123";

/** Mốc chẵn giờ (UTC) xa trong quá khứ — không phụ thuộc đồng hồ máy chạy
 *  test. `RAW_SINCE_RECENT` LỆCH 37 phút so với mốc này: nếu server không tự
 *  `date_trunc('hour', …)` mà dùng thẳng đối số thô, biên sẽ rơi sai chỗ và
 *  ca test biên giờ (obligation d) bắt được ngay — seed theo mốc THÔ mà không
 *  chứng minh được gì, đúng cảnh báo trong Design Doc row :620. */
const HOUR_ANCHOR_MS = Date.parse("2000-01-01T00:00:00.000Z");
const RAW_SINCE_RECENT = new Date(HOUR_ANCHOR_MS + 37 * 60_000).toISOString();
const BEFORE_HOUR_BOUNDARY = new Date(HOUR_ANCHOR_MS - 1_000).toISOString();
const AFTER_HOUR_BOUNDARY = new Date(HOUR_ANCHOR_MS + 1_000).toISOString();
/** Mốc `wide` rất xa trong quá khứ — cả hai attempt biên giờ đều nằm trong
 *  cửa sổ wide bất kể `date_trunc`, để obligation (d) chỉ còn `recent_count`
 *  làm biến phân biệt. */
const SINCE_WIDE_FLOOR = "1970-01-01T00:00:00.000Z";

export interface HotCountsUser {
  userId: string;
  email: string;
  /** Client mang JWT THẬT của user vừa tạo. */
  client: SupabaseClient;
}

export interface HotCountsFixture {
  /** Luôn là người GỌI `exam_hot_counts` trong mọi ca — không bao giờ bị ban. */
  userA: HotCountsUser;
  /** Nộp bài trên `published`/`unpublished`; đứng tên tác giả đề `bannedAuthor`. */
  userB: HotCountsUser;
  examIds: {
    /** published — B nộp bài SUBMITTED (HS-b cross-user + HS-c leak proof);
     *  A nộp thêm một attempt `in_progress` trên CHÍNH đề này để chứng minh nó
     *  không cộng vào count nào (obligation c, vế 1). */
    published: string;
    /** status khác 'published' ('draft') — B nộp bài SUBMITTED nhưng đề vẫn
     *  phải VẮNG MẶT hoàn toàn khỏi kết quả (obligation c, vế 2). */
    unpublished: string;
    /** published, `author_id = userB` — A nộp bài SUBMITTED. Test tự ban/gỡ
     *  ban `userB` bằng `admin.auth.admin.updateUserById` để chứng minh loại
     *  trừ rồi tái xuất hiện (obligation c, vế 3; mirror HS-f). */
    bannedAuthor: string;
    /** published, KHÔNG đề nào khác chạm tới — hai attempt kẹp đúng biên giờ
     *  chẵn, tách riêng để không lẫn với B's "bây giờ" attempt trên `published`
     *  (obligation d). */
    hourBoundary: string;
  };
  /** Đối số cho ca biên giờ chẵn (obligation d) — xem hằng số phía trên. */
  hourBoundaryArgs: {
    sinceRecent: string;
    sinceWide: string;
  };
}

function emailFor(slot: string, user: "a" | "b"): string {
  return `${HC_PREFIX}${slot}-${user}@example.com`;
}

/** Gieo fixture cho một `slot`: hai user thật (A, B), bốn đề (published,
 *  unpublished, bannedAuthor, hourBoundary) và các `exam_attempts` đúng hình
 *  dạng sáu nghĩa vụ chứng minh (obligation a-f) của
 *  `exam-hot-counts.service.e2e.test.ts` cần. */
export async function setUp(admin: SupabaseClient, slot: string): Promise<HotCountsFixture> {
  await tearDownBySlot(admin, slot);

  const emailA = emailFor(slot, "a");
  const emailB = emailFor(slot, "b");

  const { data: createdA, error: userAErr } = await admin.auth.admin.createUser({
    email: emailA,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userAErr) throw userAErr;
  const userAId = createdA.user.id;

  const { data: createdB, error: userBErr } = await admin.auth.admin.createUser({
    email: emailB,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userBErr) throw userBErr;
  const userBId = createdB.user.id;

  const examIds = {
    published: `${HC_PREFIX}${slot}-published`,
    unpublished: `${HC_PREFIX}${slot}-unpublished`,
    bannedAuthor: `${HC_PREFIX}${slot}-banned-author`,
    hourBoundary: `${HC_PREFIX}${slot}-hour-boundary`,
  };

  const baseExam = { question_ids: [] as string[], duration_minutes: 30, subject: "Toán", grade: 10 };
  const { error: examErr } = await admin.from("exams").insert([
    { ...baseExam, id: examIds.published, title: `${HC_PREFIX}${slot} published`, status: "published" },
    { ...baseExam, id: examIds.unpublished, title: `${HC_PREFIX}${slot} unpublished`, status: "draft" },
    {
      ...baseExam,
      id: examIds.bannedAuthor,
      title: `${HC_PREFIX}${slot} banned author`,
      status: "published",
      author_id: userBId,
    },
    { ...baseExam, id: examIds.hourBoundary, title: `${HC_PREFIX}${slot} hour boundary`, status: "published" },
  ]);
  if (examErr) throw examErr;

  const { error: attemptErr } = await admin.from("exam_attempts").insert([
    // HS-b/HS-c: chỉ B nộp bài trên đề published.
    { user_id: userBId, exam_id: examIds.published, status: "submitted", submitted_at: new Date().toISOString() },
    // obligation c (vế 1): A đang làm dở CÙNG đề — không được cộng vào count nào.
    { user_id: userAId, exam_id: examIds.published, status: "in_progress" },
    // obligation c (vế 2): đề chưa published dù có submitted attempt vẫn phải vắng mặt.
    { user_id: userBId, exam_id: examIds.unpublished, status: "submitted", submitted_at: new Date().toISOString() },
    // obligation c (vế 3): đề của tác giả SẼ bị ban trong lúc test — A nộp bài để có gì mà đếm.
    {
      user_id: userAId,
      exam_id: examIds.bannedAuthor,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    },
    // obligation d: kẹp đúng biên `date_trunc('hour', p_since_recent)` — 1s trước bị loại, 1s sau được tính.
    {
      user_id: userBId,
      exam_id: examIds.hourBoundary,
      status: "submitted",
      submitted_at: BEFORE_HOUR_BOUNDARY,
    },
    {
      user_id: userAId,
      exam_id: examIds.hourBoundary,
      status: "submitted",
      submitted_at: AFTER_HOUR_BOUNDARY,
    },
  ]);
  if (attemptErr) throw attemptErr;

  const clientA = anonClient();
  const { error: signInAErr } = await clientA.auth.signInWithPassword({ email: emailA, password: PASSWORD });
  if (signInAErr) throw signInAErr;

  const clientB = anonClient();
  const { error: signInBErr } = await clientB.auth.signInWithPassword({ email: emailB, password: PASSWORD });
  if (signInBErr) throw signInBErr;

  return {
    userA: { userId: userAId, email: emailA, client: clientA },
    userB: { userId: userBId, email: emailB, client: clientB },
    examIds,
    hourBoundaryArgs: { sinceRecent: RAW_SINCE_RECENT, sinceWide: SINCE_WIDE_FLOOR },
  };
}

/** Dọn theo slot — IDEMPOTENT, gọi được cả khi setup gãy giữa chừng.
 *
 *  Gỡ ban `userB` TRƯỚC khi xoá, vô điều kiện: nếu lượt chạy trước chết giữa
 *  chừng ngay sau khi ban (obligation c, vế 3) mà chưa kịp gỡ, lượt sau phải
 *  tự sửa lại trạng thái trước khi xoá — cùng lý do `test-rls.ts` Phần 10 gỡ
 *  ban vô điều kiện ở `cleanupHotCountsFixtures`. */
export async function tearDownBySlot(admin: SupabaseClient, slot: string): Promise<void> {
  const emailA = emailFor(slot, "a");
  const emailB = emailFor(slot, "b");
  const examIdPrefix = `${HC_PREFIX}${slot}-`;

  const { data } = await admin.auth.admin.listUsers();
  const userA = data?.users.find((u) => u.email === emailA);
  const userB = data?.users.find((u) => u.email === emailB);

  if (userB) await admin.auth.admin.updateUserById(userB.id, { ban_duration: "none" });

  await admin.from("exam_attempts").delete().like("exam_id", `${examIdPrefix}%`);
  await admin.from("exams").delete().like("id", `${examIdPrefix}%`);

  if (userA) await admin.auth.admin.deleteUser(userA.id);
  if (userB) await admin.auth.admin.deleteUser(userB.id);
}

export async function tearDown(
  admin: SupabaseClient,
  fixture: HotCountsFixture | undefined,
  slot: string
): Promise<void> {
  if (fixture) {
    await fixture.userA.client.auth.signOut();
    await fixture.userB.client.auth.signOut();
  }
  await tearDownBySlot(admin, slot);
}

/** Client service_role thứ hai, tách khỏi `adminClient()` của fixture láng
 *  giềng chỉ để file test này không phụ thuộc chi tiết export của nó — cùng lý
 *  do `examSearchFixtures.ts:81-89` tách `serviceClient()` riêng. Dùng cho
 *  probe biên quyền (obligation f: `service_role` phải nhận được mảng). */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
