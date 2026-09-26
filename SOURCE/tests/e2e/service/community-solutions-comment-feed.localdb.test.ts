// Community Solutions — comment feed: feed columns, feed unread cursor,
// ordering stability, AC-091 exclusion proof on real seeded data, AC-048/
// AC-047 (feed part). Test task 27 (migration task 25, backend DD v1.9 §
// Integration Verification Points "Feed columns" / "Feed unread cursor" /
// "AC-048 note condition" / "AC-047 current question"). Làn SERVICE (Postgres
// dev THẬT, không mock) — `describe.skipIf(!HAS_LIVE_DB)`, cùng tiền lệ
// `community-solutions-list-order.localdb.test.ts` (task 16) và
// `exam-search.service.e2e.test.ts`.
//
// Các case còn lại của task 27 (post_/delete_community_comment RPC groups kèm
// table-closure + case (i) AC-048, M5 nửa bình luận + S4, cổng AC-004/AC-002,
// case ghi cursor, hồi quy tên) sống ở `supabase/test-rls.ts` (Design Doc cho
// phép sống ở MỘT trong hai nơi, miễn là chạy — task file § Implementation
// Content). SN-1: case avatar của S4 (`community_avatar_owner_visible`) chạy
// ở task 40, không có ở đây hay ở `test-rls.ts`.
//
// Chạy: `npm run test:localdb` (từ SOURCE/), với `--exclude` cho skeleton
// `community-solutions.service.e2e.test.ts` (R1, còn comment-only tới task 47
// — decomposer resolution R1, task file § Quality Assurance Mechanisms).
// Tiền đề: `npm run verify:schema` XANH TRÊN DEV trước khi chạy.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";
import { countUnreadComments, type UnreadCommentRow } from "@/lib/solutions/unreadComments";

const PASSWORD = "cs27feed-password-123";

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

/** Sinh đúng `n` từ (đếm bằng khoảng trắng, khớp `count_words`/`countWords`) —
 *  cùng công thức `csWords` của `supabase/test-rls.ts`. */
function csWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `tu${i + 1}`).join(" ");
}

interface Student {
  id: string;
  client: SupabaseClient;
  /** `handle_new_user()` (schema.sql): không truyền `raw_user_meta_data` →
   *  display_name mặc định là phần trước "@" của email — chính là
   *  `${prefix}${slot}` bên dưới, nên giá trị này xác định trước, không cần
   *  đọc lại DB. */
  displayName: string;
}

async function createStudent(admin: SupabaseClient, prefix: string, slot: string): Promise<Student> {
  const email = `${prefix}${slot}@example.com`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) throw created.error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, client, displayName: `${prefix}${slot}` };
}

async function submittedAttempt(admin: SupabaseClient, userId: string, examId: string): Promise<string> {
  const res = await admin
    .from("exam_attempts")
    .insert({ user_id: userId, exam_id: examId, status: "submitted", submitted_at: new Date().toISOString() })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data.id as string;
}

/** Idempotent: xoá theo email — an toàn để gọi cả khi setup thất bại giữa
 *  chừng, cùng quy ước `tearDownByEmail` của `essayGradeWriteFixtures.ts`. */
async function cleanupByEmails(admin: SupabaseClient, emails: string[]): Promise<void> {
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of emails) {
    const user = list.data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}

/** Hình dạng thô của `community_my_comment_feed` — 10 cột đúng backend DD v1.9
 *  § Data Contracts, không có cột nào mang id/avatar người bình luận. */
type RawFeedRow = {
  comment_id: string;
  solution_id: string;
  exam_id: string;
  exam_title: string;
  question_number: number | null;
  comment_body: string;
  comment_created_at: string;
  author_display_name: string | null;
  is_unread: boolean;
  exam_visible: boolean;
};

const FEED_ROW_KEYS = [
  "author_display_name",
  "comment_body",
  "comment_created_at",
  "comment_id",
  "exam_id",
  "exam_title",
  "exam_visible",
  "is_unread",
  "question_number",
  "solution_id",
].sort();

/** Map hàng thô sang hình dạng `countUnreadComments` (task 26) cần — không
 *  lặp lại công thức `isUnread && examVisible` ở đây (Reference Contract Value #23). */
function toUnreadRow(row: RawFeedRow): UnreadCommentRow {
  return { solutionId: row.solution_id, isUnread: row.is_unread, examVisible: row.exam_visible };
}

async function readFeed(client: SupabaseClient): Promise<RawFeedRow[]> {
  const res = await client.rpc("community_my_comment_feed", { p_page: 1, p_page_size: 20 });
  if (res.error) throw res.error;
  return (res.data ?? []) as RawFeedRow[];
}

describe.skipIf(!HAS_LIVE_DB)("community_my_comment_feed — feed columns (task 27; migration 25)", () => {
  const admin = adminClient();
  const PREFIX = "cs27feedcol-";
  const EXAM_ID = `${PREFIX}exam`;
  const QA = `${EXAM_ID}-qa`;
  const QB = `${EXAM_ID}-qb`;
  const TARGET = `${EXAM_ID}-target`;
  const EXAM_TITLE = "[CS27-feedcol] đề";
  const emails = ["writer", "reader"].map((s) => `${PREFIX}${s}@example.com`);
  let writer!: Student;
  let reader!: Student;
  let solutionId!: string;

  async function cleanup() {
    await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
    await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
    await admin.from("exams").delete().eq("id", EXAM_ID);
    await admin.from("questions").delete().in("id", [QA, QB, TARGET]);
    await cleanupByEmails(admin, emails);
  }

  beforeAll(async () => {
    await cleanup();
    writer = await createStudent(admin, PREFIX, "writer");
    reader = await createStudent(admin, PREFIX, "reader");

    const q = await admin.from("questions").insert(
      [QA, QB, TARGET].map((id, i) => ({
        id,
        content: `[CS27-feedcol] câu ${i + 1}`,
        choices: MCQ_CHOICES,
        correct_answer: "A",
        subject: "Toán",
        grade: 10,
        topic: "Toán",
      })),
    );
    if (q.error) throw q.error;
    const exam = await admin.from("exams").insert({
      id: EXAM_ID,
      title: EXAM_TITLE,
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: writer.id,
      author_display_name: "Writer",
      question_ids: [QA, QB, TARGET],
      status: "published",
    });
    if (exam.error) throw exam.error;
    await submittedAttempt(admin, writer.id, EXAM_ID);
    await submittedAttempt(admin, reader.id, EXAM_ID);

    const solution = await admin
      .from("community_solutions")
      .insert({ exam_id: EXAM_ID, author_id: writer.id, status: "published" })
      .select("id")
      .single();
    if (solution.error) throw solution.error;
    solutionId = solution.data!.id as string;

    const note = await admin
      .from("community_solution_notes")
      .insert({ solution_id: solutionId, question_id: TARGET, body: csWords(15) });
    if (note.error) throw note.error;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  }, 60_000);

  it("cột feed đúng: solution_id/exam_id/exam_title/question_number=3/comment_body/comment_created_at/author_display_name (null khi ẩn danh); không cột nào mang id/avatar người bình luận; đổi question_ids trả lại question_number mới", async () => {
    const named = await reader.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: TARGET,
      p_body: "[CS27-feedcol] bình luận không ẩn danh",
      p_is_anonymous: false,
    });
    if (named.error) throw named.error;
    const [namedRpcRow] = named.data as Array<{ comment_id: string; comment_created_at: string }>;

    const anon = await reader.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: TARGET,
      p_body: "[CS27-feedcol] bình luận ẩn danh",
      p_is_anonymous: true,
    });
    if (anon.error) throw anon.error;
    const [anonRpcRow] = anon.data as Array<{ comment_id: string }>;

    const rows = await readFeed(writer.client);
    const namedRow = rows.find((r) => r.comment_id === namedRpcRow.comment_id)!;
    const anonRow = rows.find((r) => r.comment_id === anonRpcRow.comment_id)!;

    expect(namedRow.solution_id).toBe(solutionId);
    expect(namedRow.exam_id).toBe(EXAM_ID);
    expect(namedRow.exam_title).toBe(EXAM_TITLE);
    expect(namedRow.question_number).toBe(3);
    expect(namedRow.comment_body).toBe("[CS27-feedcol] bình luận không ẩn danh");
    expect(namedRow.comment_created_at).toBe(namedRpcRow.comment_created_at);
    expect(namedRow.author_display_name).toBe(reader.displayName);
    expect(anonRow.author_display_name).toBeNull();
    expect(Object.keys(namedRow).sort()).toEqual(FEED_ROW_KEYS);
    expect(Object.keys(anonRow).sort()).toEqual(FEED_ROW_KEYS);

    const reorder = await admin.from("exams").update({ question_ids: [TARGET, QA, QB] }).eq("id", EXAM_ID);
    if (reorder.error) throw reorder.error;
    const rowsAfterReorder = await readFeed(writer.client);
    const namedRowAfterReorder = rowsAfterReorder.find((r) => r.comment_id === namedRpcRow.comment_id)!;
    expect(namedRowAfterReorder.question_number).toBe(1);
  });
});

describe.skipIf(!HAS_LIVE_DB)("community_my_comment_feed — feed unread cursor (task 27; migration 25)", () => {
  const admin = adminClient();
  const PREFIX = "cs27cursor-";
  const EXAM_ID = `${PREFIX}exam`;
  const Q1 = `${EXAM_ID}-q1`;
  const emails = ["writer", "reader1", "reader2"].map((s) => `${PREFIX}${s}@example.com`);
  let writer!: Student;
  let reader1!: Student;
  let reader2!: Student;
  let solutionId!: string;

  async function cleanup() {
    await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
    await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
    await admin.from("exams").delete().eq("id", EXAM_ID);
    await admin.from("questions").delete().eq("id", Q1);
    await cleanupByEmails(admin, emails);
  }

  beforeAll(async () => {
    await cleanup();
    writer = await createStudent(admin, PREFIX, "writer");
    reader1 = await createStudent(admin, PREFIX, "reader1");
    reader2 = await createStudent(admin, PREFIX, "reader2");

    const q = await admin.from("questions").insert({
      id: Q1,
      content: "[CS27-cursor] câu 1",
      choices: MCQ_CHOICES,
      correct_answer: "A",
      subject: "Toán",
      grade: 10,
      topic: "Toán",
    });
    if (q.error) throw q.error;
    const exam = await admin.from("exams").insert({
      id: EXAM_ID,
      title: "[CS27-cursor] đề",
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: writer.id,
      author_display_name: "Writer",
      question_ids: [Q1],
      status: "published",
    });
    if (exam.error) throw exam.error;
    await submittedAttempt(admin, writer.id, EXAM_ID);
    await submittedAttempt(admin, reader1.id, EXAM_ID);
    await submittedAttempt(admin, reader2.id, EXAM_ID);

    const solution = await admin
      .from("community_solutions")
      .insert({ exam_id: EXAM_ID, author_id: writer.id, status: "published" })
      .select("id")
      .single();
    if (solution.error) throw solution.error;
    solutionId = solution.data!.id as string;

    const note = await admin
      .from("community_solution_notes")
      .insert({ solution_id: solutionId, question_id: Q1, body: csWords(15) });
    if (note.error) throw note.error;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  }, 60_000);

  it("is_unread/exam_visible/new-count qua markCommentsRead, bình luận mới, và đề chuyển draft rồi published lại (AC-091, AC-093, AC-098, S8)", async () => {
    const c1 = await reader1.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: Q1,
      p_body: "[CS27-cursor] bình luận 1",
      p_is_anonymous: false,
    });
    if (c1.error) throw c1.error;
    const c1Id = (c1.data as Array<{ comment_id: string }>)[0].comment_id;
    const c2 = await reader2.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: Q1,
      p_body: "[CS27-cursor] bình luận 2",
      p_is_anonymous: false,
    });
    if (c2.error) throw c2.error;
    const c2Id = (c2.data as Array<{ comment_id: string }>)[0].comment_id;

    const rowsAfterTwo = await readFeed(writer.client);
    expect(rowsAfterTwo.find((r) => r.comment_id === c1Id)?.is_unread).toBe(true);
    expect(rowsAfterTwo.find((r) => r.comment_id === c1Id)?.exam_visible).toBe(true);
    expect(rowsAfterTwo.find((r) => r.comment_id === c2Id)?.is_unread).toBe(true);
    expect(rowsAfterTwo.find((r) => r.comment_id === c2Id)?.exam_visible).toBe(true);
    expect(countUnreadComments(rowsAfterTwo.map(toUnreadRow))).toBe(2);

    // markCommentsRead() (task 26, features/solutions/actions.ts): một update
    // thường trên chính hàng user_profiles của người gọi, dưới
    // profiles_update_own không đổi — không qua RPC nào.
    //
    // Cursor PHẢI lấy từ một giá trị timestamp do chính server Postgres sinh
    // ra (đọc lại created_at của C2 vừa ghi), KHÔNG dùng `new Date()` phía
    // client: đồng hồ máy chạy test và đồng hồ server DB lệch nhau (quan sát
    // thực tế ~500ms-1s trong môi trường này), nên nếu client-side "now" bị
    // ghi sớm hơn created_at (server-side "now") của C1/C2 dù thứ tự wall-clock
    // đúng, is_unread vẫn sai là true sau khi đánh dấu đã đọc. Đọc lại
    // created_at của C2 loại bỏ hoàn toàn phụ thuộc vào đồng bộ đồng hồ.
    const c2Row = await admin
      .from("community_solution_comments")
      .select("created_at")
      .eq("id", c2Id)
      .single();
    if (c2Row.error) throw c2Row.error;
    const serverCursor = c2Row.data!.created_at as string;

    const markRead = await writer.client
      .from("user_profiles")
      .update({ community_comments_last_read_at: serverCursor })
      .eq("id", writer.id);
    if (markRead.error) throw markRead.error;

    const rowsAfterRead = await readFeed(writer.client);
    expect(rowsAfterRead.find((r) => r.comment_id === c1Id)?.is_unread).toBe(false);
    expect(rowsAfterRead.find((r) => r.comment_id === c2Id)?.is_unread).toBe(false);
    expect(countUnreadComments(rowsAfterRead.map(toUnreadRow))).toBe(0);

    const c3 = await reader1.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: Q1,
      p_body: "[CS27-cursor] bình luận 3",
      p_is_anonymous: false,
    });
    if (c3.error) throw c3.error;
    const c3Id = (c3.data as Array<{ comment_id: string }>)[0].comment_id;

    const rowsAfterThird = await readFeed(writer.client);
    expect(rowsAfterThird.find((r) => r.comment_id === c3Id)?.is_unread).toBe(true);
    expect(countUnreadComments(rowsAfterThird.map(toUnreadRow))).toBe(1);

    const examToDraft = await admin.from("exams").update({ status: "draft" }).eq("id", EXAM_ID);
    if (examToDraft.error) throw examToDraft.error;
    const rowsWhileDraft = await readFeed(writer.client);
    expect(rowsWhileDraft.map((r) => r.comment_id).sort()).toEqual([c1Id, c2Id, c3Id].sort());
    for (const row of rowsWhileDraft) expect(row.exam_visible).toBe(false);
    expect(countUnreadComments(rowsWhileDraft.map(toUnreadRow))).toBe(0);
    // is_unread tự nó KHÔNG đổi theo độ hiện của đề (hàng chưa đọc vẫn là một
    // tiền tố liên tục của feed mới-nhất-trước) — chỉ C3 còn "chưa đọc".
    expect(rowsWhileDraft.find((r) => r.comment_id === c3Id)?.is_unread).toBe(true);
    expect(rowsWhileDraft.find((r) => r.comment_id === c1Id)?.is_unread).toBe(false);
    expect(rowsWhileDraft.find((r) => r.comment_id === c2Id)?.is_unread).toBe(false);

    const examRestore = await admin.from("exams").update({ status: "published" }).eq("id", EXAM_ID);
    if (examRestore.error) throw examRestore.error;
    const rowsAfterRestore = await readFeed(writer.client);
    expect(countUnreadComments(rowsAfterRestore.map(toUnreadRow))).toBe(1);
    expect(rowsAfterRestore.find((r) => r.comment_id === c3Id)?.is_unread).toBe(true);
  });
});

describe.skipIf(!HAS_LIVE_DB)(
  "community_my_comment_feed — ordering newest-first is stable (task 27; migration 25)",
  () => {
    const admin = adminClient();
    const PREFIX = "cs27order-";
    const EXAM_ID = `${PREFIX}exam`;
    const Q1 = `${EXAM_ID}-q1`;
    const emails = ["writer", "reader"].map((s) => `${PREFIX}${s}@example.com`);
    let writer!: Student;
    let reader!: Student;
    let solutionId!: string;
    const commentIds: string[] = [];

    async function cleanup() {
      await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
      await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
      await admin.from("exams").delete().eq("id", EXAM_ID);
      await admin.from("questions").delete().eq("id", Q1);
      await cleanupByEmails(admin, emails);
    }

    beforeAll(async () => {
      await cleanup();
      writer = await createStudent(admin, PREFIX, "writer");
      reader = await createStudent(admin, PREFIX, "reader");

      const q = await admin.from("questions").insert({
        id: Q1,
        content: "[CS27-order] câu 1",
        choices: MCQ_CHOICES,
        correct_answer: "A",
        subject: "Toán",
        grade: 10,
        topic: "Toán",
      });
      if (q.error) throw q.error;
      const exam = await admin.from("exams").insert({
        id: EXAM_ID,
        title: "[CS27-order] đề",
        duration_minutes: 45,
        subject: "Toán",
        grade: 10,
        author_id: writer.id,
        author_display_name: "Writer",
        question_ids: [Q1],
        status: "published",
      });
      if (exam.error) throw exam.error;
      await submittedAttempt(admin, writer.id, EXAM_ID);
      await submittedAttempt(admin, reader.id, EXAM_ID);

      const solution = await admin
        .from("community_solutions")
        .insert({ exam_id: EXAM_ID, author_id: writer.id, status: "published" })
        .select("id")
        .single();
      if (solution.error) throw solution.error;
      solutionId = solution.data!.id as string;

      const note = await admin
        .from("community_solution_notes")
        .insert({ solution_id: solutionId, question_id: Q1, body: csWords(15) });
      if (note.error) throw note.error;

      for (let i = 0; i < 3; i += 1) {
        const c = await reader.client.rpc("post_community_comment", {
          p_solution_id: solutionId,
          p_question_id: Q1,
          p_body: `[CS27-order] bình luận ${i + 1}`,
          p_is_anonymous: false,
        });
        if (c.error) throw c.error;
        commentIds.push((c.data as Array<{ comment_id: string }>)[0].comment_id);
      }
      // Ép mốc thời gian tách bạch — ba lệnh RPC chạy liên tiếp có thể trùng
      // độ phân giải thời gian; đây là chiều NGƯỢC với `forceTie` của task
      // 16's list-order test (ở đó cần HOÀ, ở đây cần TÁCH để order by có ý
      // nghĩa xác định).
      for (const [i, id] of commentIds.entries()) {
        const forced = await admin
          .from("community_solution_comments")
          .update({ created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() })
          .eq("id", id);
        if (forced.error) throw forced.error;
      }
    }, 60_000);

    afterAll(async () => {
      await cleanup();
    }, 60_000);

    it("hai lượt đọc liên tiếp trả cùng thứ tự comment_id, mới nhất trước", async () => {
      const expectedOrder = [...commentIds].reverse(); // created_at desc — mới nhất (chèn sau cùng) trước.
      const read1 = await readFeed(writer.client);
      const read2 = await readFeed(writer.client);
      expect(read1.map((r) => r.comment_id)).toEqual(expectedOrder);
      expect(read2.map((r) => r.comment_id)).toEqual(read1.map((r) => r.comment_id));
    });
  },
);

describe.skipIf(!HAS_LIVE_DB)(
  "community_my_comment_feed — AC-091 exclusion proof on real data (task 27; migration 25; overview R6)",
  () => {
    const admin = adminClient();
    const PREFIX = "cs27excl-";
    const EXAM_MAIN = `${PREFIX}exam-main`;
    const EXAM_DRAFT_SOL = `${PREFIX}exam-draft-sol`;
    const EXAM_HIDDEN = `${PREFIX}exam-hidden`;
    const Q_MAIN = `${EXAM_MAIN}-q1`;
    const Q_DRAFT = `${EXAM_DRAFT_SOL}-q1`;
    const Q_HIDDEN = `${EXAM_HIDDEN}-q1`;
    const emails = ["writer", "commenter"].map((s) => `${PREFIX}${s}@example.com`);
    let writer!: Student;
    let commenter!: Student;
    let solMain!: string;
    let solDraft!: string;
    let solHidden!: string;

    async function cleanup() {
      const examIds = [EXAM_MAIN, EXAM_DRAFT_SOL, EXAM_HIDDEN];
      await admin.from("community_solutions").delete().in("exam_id", examIds);
      await admin.from("exam_attempts").delete().in("exam_id", examIds);
      await admin.from("exams").delete().in("id", examIds);
      await admin.from("questions").delete().in("id", [Q_MAIN, Q_DRAFT, Q_HIDDEN]);
      await cleanupByEmails(admin, emails);
    }

    beforeAll(async () => {
      await cleanup();
      writer = await createStudent(admin, PREFIX, "writer");
      commenter = await createStudent(admin, PREFIX, "commenter");

      const q = await admin.from("questions").insert(
        [Q_MAIN, Q_DRAFT, Q_HIDDEN].map((id, i) => ({
          id,
          content: `[CS27-excl] câu ${i + 1}`,
          choices: MCQ_CHOICES,
          correct_answer: "A",
          subject: "Toán",
          grade: 10,
          topic: "Toán",
        })),
      );
      if (q.error) throw q.error;

      const exams = await admin.from("exams").insert([
        {
          id: EXAM_MAIN,
          title: "[CS27-excl] đề chính",
          duration_minutes: 45,
          subject: "Toán",
          grade: 10,
          author_id: writer.id,
          author_display_name: "Writer",
          question_ids: [Q_MAIN],
          status: "published",
        },
        {
          id: EXAM_DRAFT_SOL,
          title: "[CS27-excl] đề khác — bài giải nháp (S7)",
          duration_minutes: 45,
          subject: "Toán",
          grade: 10,
          author_id: writer.id,
          author_display_name: "Writer",
          question_ids: [Q_DRAFT],
          status: "published",
        },
        {
          id: EXAM_HIDDEN,
          title: "[CS27-excl] đề sẽ vô hình (S8)",
          duration_minutes: 45,
          subject: "Toán",
          grade: 10,
          author_id: writer.id,
          author_display_name: "Writer",
          question_ids: [Q_HIDDEN],
          status: "published",
        },
      ]);
      if (exams.error) throw exams.error;

      await submittedAttempt(admin, writer.id, EXAM_MAIN);
      await submittedAttempt(admin, writer.id, EXAM_DRAFT_SOL);
      await submittedAttempt(admin, writer.id, EXAM_HIDDEN);
      await submittedAttempt(admin, commenter.id, EXAM_MAIN);
      await submittedAttempt(admin, commenter.id, EXAM_HIDDEN);

      const solutions = await admin
        .from("community_solutions")
        .insert([
          { exam_id: EXAM_MAIN, author_id: writer.id, status: "published" },
          { exam_id: EXAM_DRAFT_SOL, author_id: writer.id, status: "draft" },
          { exam_id: EXAM_HIDDEN, author_id: writer.id, status: "published" },
        ])
        .select("id, exam_id");
      if (solutions.error) throw solutions.error;
      const rows = solutions.data as Array<{ id: string; exam_id: string }>;
      solMain = rows.find((r) => r.exam_id === EXAM_MAIN)!.id;
      solDraft = rows.find((r) => r.exam_id === EXAM_DRAFT_SOL)!.id;
      solHidden = rows.find((r) => r.exam_id === EXAM_HIDDEN)!.id;

      const notes = await admin.from("community_solution_notes").insert([
        { solution_id: solMain, question_id: Q_MAIN, body: csWords(15) },
        { solution_id: solDraft, question_id: Q_DRAFT, body: csWords(15) },
        { solution_id: solHidden, question_id: Q_HIDDEN, body: csWords(15) },
      ]);
      if (notes.error) throw notes.error;
    }, 60_000);

    afterAll(async () => {
      await cleanup();
    }, 60_000);

    it("(a) bình luận của chính viewer, (b) bị admin ẩn (S19), (c) trên bài giải nháp của đề khác (S7) — bị loại khỏi feed; (d) trên đề vô hình (S8) — có mặt nhưng exam_visible=false; (e) bình thường — có mặt exam_visible=true; countUnreadComments = 1 khi cursor null", async () => {
      // (a) bình luận của CHÍNH viewer (writer) trên bài giải của chính họ.
      const ownComment = await writer.client.rpc("post_community_comment", {
        p_solution_id: solMain,
        p_question_id: Q_MAIN,
        p_body: "[CS27-excl] (a) bình luận của chính viewer",
        p_is_anonymous: false,
      });
      if (ownComment.error) throw ownComment.error;
      const ownCommentId = (ownComment.data as Array<{ comment_id: string }>)[0].comment_id;

      // (b) bình luận của commenter, sau đó admin ẩn (S19) — cùng tiền lệ SN-1
      // (task 05/16): admin_moderate_community_comment chưa tồn tại tới
      // migration 32, harness setup client tự đặt status='hidden'.
      const hiddenComment = await commenter.client.rpc("post_community_comment", {
        p_solution_id: solMain,
        p_question_id: Q_MAIN,
        p_body: "[CS27-excl] (b) sẽ bị admin ẩn",
        p_is_anonymous: false,
      });
      if (hiddenComment.error) throw hiddenComment.error;
      const hiddenCommentId = (hiddenComment.data as Array<{ comment_id: string }>)[0].comment_id;
      const hideIt = await admin
        .from("community_solution_comments")
        .update({ status: "hidden" })
        .eq("id", hiddenCommentId);
      if (hideIt.error) throw hideIt.error;

      // (c) bình luận của commenter trên bài giải NHÁP của writer, đề KHÁC
      // (S7) — post_community_comment từ chối bài giải nháp theo thiết kế
      // (cs.status='published' trong eligibility), nên hàng này được harness
      // setup client chèn thẳng (cùng tiền lệ task 16).
      const draftComment = await admin
        .from("community_solution_comments")
        .insert({
          solution_id: solDraft,
          question_id: Q_DRAFT,
          author_id: commenter.id,
          body: "[CS27-excl] (c) trên bài giải nháp của đề khác",
        })
        .select("id")
        .single();
      if (draftComment.error) throw draftComment.error;
      const draftCommentId = draftComment.data!.id as string;

      // (d) bình luận HIỆN của commenter trên đề mà harness sẽ làm vô hình (S8).
      const hiddenExamComment = await commenter.client.rpc("post_community_comment", {
        p_solution_id: solHidden,
        p_question_id: Q_HIDDEN,
        p_body: "[CS27-excl] (d) trên đề sẽ vô hình",
        p_is_anonymous: false,
      });
      if (hiddenExamComment.error) throw hiddenExamComment.error;
      const hiddenExamCommentId = (hiddenExamComment.data as Array<{ comment_id: string }>)[0].comment_id;
      const makeExamNotVisible = await admin.from("exams").update({ status: "draft" }).eq("id", EXAM_HIDDEN);
      if (makeExamNotVisible.error) throw makeExamNotVisible.error;

      // (e) bình luận bình thường của commenter, mọi thứ hiển thị.
      const normalComment = await commenter.client.rpc("post_community_comment", {
        p_solution_id: solMain,
        p_question_id: Q_MAIN,
        p_body: "[CS27-excl] (e) bình thường",
        p_is_anonymous: false,
      });
      if (normalComment.error) throw normalComment.error;
      const normalCommentId = (normalComment.data as Array<{ comment_id: string }>)[0].comment_id;

      const rows = await readFeed(writer.client);
      const rowIds = rows.map((r) => r.comment_id);
      expect(rowIds).not.toContain(ownCommentId);
      expect(rowIds).not.toContain(hiddenCommentId);
      expect(rowIds).not.toContain(draftCommentId);
      expect(rowIds.sort()).toEqual([hiddenExamCommentId, normalCommentId].sort());

      expect(rows.find((r) => r.comment_id === hiddenExamCommentId)?.exam_visible).toBe(false);
      expect(rows.find((r) => r.comment_id === normalCommentId)?.exam_visible).toBe(true);

      expect(countUnreadComments(rows.map(toUnreadRow))).toBe(1);

      const cursor = await admin
        .from("user_profiles")
        .select("community_comments_last_read_at")
        .eq("id", writer.id)
        .single();
      expect(cursor.data?.community_comments_last_read_at).toBeNull();
    });
  },
);

describe.skipIf(!HAS_LIVE_DB)(
  "community_my_comment_feed — AC-048 / AC-047 feed part (task 27; migration 25)",
  () => {
    const admin = adminClient();
    const PREFIX = "cs27ac048-";
    const EXAM_ID = `${PREFIX}exam`;
    const Q_NOTE = `${EXAM_ID}-qnote`;
    const Q_REMOVE = `${EXAM_ID}-qremove`;
    const emails = ["writer", "reader"].map((s) => `${PREFIX}${s}@example.com`);
    let writer!: Student;
    let reader!: Student;
    let solutionId!: string;
    let commentNoteId!: string;
    let commentRemoveId!: string;

    async function cleanup() {
      await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
      await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
      await admin.from("exams").delete().eq("id", EXAM_ID);
      await admin.from("questions").delete().in("id", [Q_NOTE, Q_REMOVE]);
      await cleanupByEmails(admin, emails);
    }

    beforeAll(async () => {
      await cleanup();
      writer = await createStudent(admin, PREFIX, "writer");
      reader = await createStudent(admin, PREFIX, "reader");

      const q = await admin.from("questions").insert(
        [Q_NOTE, Q_REMOVE].map((id, i) => ({
          id,
          content: `[CS27-ac048] câu ${i + 1}`,
          choices: MCQ_CHOICES,
          correct_answer: "A",
          subject: "Toán",
          grade: 10,
          topic: "Toán",
        })),
      );
      if (q.error) throw q.error;
      const exam = await admin.from("exams").insert({
        id: EXAM_ID,
        title: "[CS27-ac048] đề",
        duration_minutes: 45,
        subject: "Toán",
        grade: 10,
        author_id: writer.id,
        author_display_name: "Writer",
        question_ids: [Q_NOTE, Q_REMOVE],
        status: "published",
      });
      if (exam.error) throw exam.error;
      await submittedAttempt(admin, writer.id, EXAM_ID);
      await submittedAttempt(admin, reader.id, EXAM_ID);

      const solution = await admin
        .from("community_solutions")
        .insert({ exam_id: EXAM_ID, author_id: writer.id, status: "published" })
        .select("id")
        .single();
      if (solution.error) throw solution.error;
      solutionId = solution.data!.id as string;

      const notes = await admin.from("community_solution_notes").insert([
        { solution_id: solutionId, question_id: Q_NOTE, body: csWords(15) },
        { solution_id: solutionId, question_id: Q_REMOVE, body: csWords(15) },
      ]);
      if (notes.error) throw notes.error;

      const commentNote = await reader.client.rpc("post_community_comment", {
        p_solution_id: solutionId,
        p_question_id: Q_NOTE,
        p_body: "[CS27-ac048] bình luận dưới ghi chú sẽ bị rút ngắn",
        p_is_anonymous: false,
      });
      if (commentNote.error) throw commentNote.error;
      commentNoteId = (commentNote.data as Array<{ comment_id: string }>)[0].comment_id;

      const commentRemove = await reader.client.rpc("post_community_comment", {
        p_solution_id: solutionId,
        p_question_id: Q_REMOVE,
        p_body: "[CS27-ac048] bình luận dưới câu sẽ bị gỡ khỏi question_ids",
        p_is_anonymous: false,
      });
      if (commentRemove.error) throw commentRemove.error;
      commentRemoveId = (commentRemove.data as Array<{ comment_id: string }>)[0].comment_id;
    }, 60_000);

    afterAll(async () => {
      await cleanup();
    }, 60_000);

    it("AC-048: ghi chú rút xuống 14 từ rồi xoá hẳn làm rơi bình luận khỏi feed; khôi phục 15 từ trả lại đúng hàng", async () => {
      const baseline = await readFeed(writer.client);
      expect(baseline.map((r) => r.comment_id)).toContain(commentNoteId);

      const shorten = await admin
        .from("community_solution_notes")
        .update({ body: csWords(14) })
        .eq("solution_id", solutionId)
        .eq("question_id", Q_NOTE);
      if (shorten.error) throw shorten.error;
      const afterShorten = await readFeed(writer.client);
      expect(afterShorten.map((r) => r.comment_id)).not.toContain(commentNoteId);

      const deleteNote = await admin
        .from("community_solution_notes")
        .delete()
        .eq("solution_id", solutionId)
        .eq("question_id", Q_NOTE);
      if (deleteNote.error) throw deleteNote.error;
      const afterDelete = await readFeed(writer.client);
      expect(afterDelete.map((r) => r.comment_id)).not.toContain(commentNoteId);

      const restore = await admin
        .from("community_solution_notes")
        .insert({ solution_id: solutionId, question_id: Q_NOTE, body: csWords(15) });
      if (restore.error) throw restore.error;
      const afterRestore = await readFeed(writer.client);
      expect(afterRestore.map((r) => r.comment_id)).toContain(commentNoteId);
    });

    it("AC-047: gỡ id của câu khỏi exams.question_ids làm rơi bình luận của câu đó khỏi feed; khôi phục id trả lại đúng hàng", async () => {
      const baseline = await readFeed(writer.client);
      expect(baseline.map((r) => r.comment_id)).toContain(commentRemoveId);

      const removeId = await admin.from("exams").update({ question_ids: [Q_NOTE] }).eq("id", EXAM_ID);
      if (removeId.error) throw removeId.error;
      const afterRemove = await readFeed(writer.client);
      expect(afterRemove.map((r) => r.comment_id)).not.toContain(commentRemoveId);

      const restoreId = await admin.from("exams").update({ question_ids: [Q_NOTE, Q_REMOVE] }).eq("id", EXAM_ID);
      if (restoreId.error) throw restoreId.error;
      const afterRestore = await readFeed(writer.client);
      expect(afterRestore.map((r) => r.comment_id)).toContain(commentRemoveId);
    });
  },
);
