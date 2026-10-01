// Community Solutions — trả lời gắn với bình luận (một cấp, hướng C).
// docs/design/community-solutions-comment-replies.md, AC-R2…R7. Làn SERVICE
// (Postgres dev THẬT, không mock) — `describe.skipIf(!HAS_LIVE_DB)`, cùng khuôn
// `community-solutions-comment-feed.localdb.test.ts`. Phần admin (ẩn/xoá hẳn qua
// admin_moderate_community_comment) cần phiên admin nên không chạy ở đây; ở đây
// trạng thái 'hidden' được đặt bằng service role (SN-1) để chứng minh phía ĐỌC.
//
// Chạy: `npm run test:localdb`. Tiền đề: migration 90dadbd4e453 đã áp lên dev.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

const PASSWORD = "cs-replies-password-123";
const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

function csWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `tu${i + 1}`).join(" ");
}

interface Student {
  id: string;
  client: SupabaseClient;
  displayName: string;
}

async function createStudent(
  admin: SupabaseClient,
  prefix: string,
  slot: string
): Promise<Student> {
  const email = `${prefix}${slot}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, client, displayName: `${prefix}${slot}` };
}

async function cleanupByEmails(admin: SupabaseClient, emails: string[]): Promise<void> {
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of emails) {
    const user = list.data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}

interface PostedRow {
  comment_id: string;
  comment_created_at: string;
  comment_parent_id: string | null;
  comment_reply_to_id: string | null;
}

interface DetailComment {
  id: string;
  author_id: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  is_solution_author: boolean;
  is_mine: boolean;
  body: string | null;
  is_hidden_by_admin: boolean;
  hidden_reason: string | null;
  i_reported: boolean;
  parent_id: string | null;
  reply_to_id: string | null;
  placeholder: "deleted" | "hidden" | null;
}

describe.skipIf(!HAS_LIVE_DB)("trả lời bình luận một cấp — SQL thật (AC-R2…R7)", () => {
  const admin = adminClient();
  const PREFIX = "csreply-";
  const EXAM_ID = `${PREFIX}exam`;
  const QA = `${EXAM_ID}-qa`;
  const TARGET = `${EXAM_ID}-target`;
  const emails = ["writer", "a", "b"].map((s) => `${PREFIX}${s}@example.com`);
  let writer!: Student;
  let a!: Student;
  let b!: Student;
  let solutionId!: string;

  async function cleanup() {
    await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
    await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
    await admin.from("exams").delete().eq("id", EXAM_ID);
    await admin.from("questions").delete().in("id", [QA, TARGET]);
    await cleanupByEmails(admin, emails);
  }

  async function post(
    who: Student,
    body: string,
    opts: { anonymous?: boolean; replyTo?: string; question?: string } = {}
  ) {
    const res = await who.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: opts.question ?? TARGET,
      p_body: body,
      p_is_anonymous: opts.anonymous ?? false,
      ...(opts.replyTo !== undefined ? { p_reply_to_id: opts.replyTo } : {}),
    });
    return res;
  }

  async function postOk(...args: Parameters<typeof post>): Promise<PostedRow> {
    const res = await post(...args);
    if (res.error) throw res.error;
    return (res.data as PostedRow[])[0];
  }

  async function detailComments(
    who: Student
  ): Promise<{ count: number | null; comments: DetailComment[] }> {
    const res = await who.client.rpc("community_solution_detail", { p_solution_id: solutionId });
    if (res.error) throw res.error;
    const row = (
      res.data as Array<{
        questions: Array<{
          question_id: string;
          comment_count: number | null;
          comments: DetailComment[];
        }>;
      }>
    )[0];
    const q = row.questions.find((x) => x.question_id === TARGET)!;
    return { count: q.comment_count, comments: q.comments };
  }

  async function feed(who: Student) {
    const res = await who.client.rpc("community_my_comment_feed", { p_page: 1, p_page_size: 20 });
    if (res.error) throw res.error;
    return res.data as Array<{
      comment_id: string;
      author_display_name: string | null;
      is_reply_to_me: boolean;
      reply_to_body: string | null;
      thread_root_id: string;
    }>;
  }

  beforeAll(async () => {
    await cleanup();
    writer = await createStudent(admin, PREFIX, "writer");
    a = await createStudent(admin, PREFIX, "a");
    b = await createStudent(admin, PREFIX, "b");

    const q = await admin.from("questions").insert(
      [QA, TARGET].map((id, i) => ({
        id,
        content: `[CSREPLY] câu ${i + 1}`,
        choices: MCQ_CHOICES,
        correct_answer: "A",
        subject: "Toán",
        grade: 10,
        topic: "Toán",
      }))
    );
    if (q.error) throw q.error;
    const exam = await admin.from("exams").insert({
      id: EXAM_ID,
      title: "[CSREPLY] đề",
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: writer.id,
      author_display_name: "Writer",
      question_ids: [QA, TARGET],
      status: "published",
    });
    if (exam.error) throw exam.error;
    for (const u of [writer, a, b]) {
      const att = await admin.from("exam_attempts").insert({
        user_id: u.id,
        exam_id: EXAM_ID,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      if (att.error) throw att.error;
    }
    const solution = await admin
      .from("community_solutions")
      .insert({ exam_id: EXAM_ID, author_id: writer.id, status: "published" })
      .select("id")
      .single();
    if (solution.error) throw solution.error;
    solutionId = solution.data!.id as string;
    for (const qid of [QA, TARGET]) {
      const note = await admin
        .from("community_solution_notes")
        .insert({ solution_id: solutionId, question_id: qid, body: csWords(15) });
      if (note.error) throw note.error;
    }
  }, 90_000);

  afterAll(async () => {
    await cleanup();
  }, 90_000);

  it("AC-R2/R3: trả lời gốc → parent=gốc; trả lời một câu trả lời → vẫn parent=gốc, reply_to=câu đó; đích sai câu / không visible bị từ chối 42501", async () => {
    const root = await postOk(a, "[CSREPLY] gốc 1");
    const r1 = await postOk(b, "@a trả lời gốc", { replyTo: root.comment_id });
    expect(r1.comment_parent_id).toBe(root.comment_id);
    expect(r1.comment_reply_to_id).toBe(root.comment_id);

    const r2 = await postOk(writer, "@b trả lời câu trả lời", { replyTo: r1.comment_id });
    expect(r2.comment_parent_id).toBe(root.comment_id);
    expect(r2.comment_reply_to_id).toBe(r1.comment_id);

    const wrongQuestion = await post(b, "sai câu", { replyTo: root.comment_id, question: QA });
    expect(wrongQuestion.error?.code).toBe("42501");

    const hide = await admin
      .from("community_solution_comments")
      .update({ status: "hidden" })
      .eq("id", r2.comment_id);
    if (hide.error) throw hide.error;
    const toHidden = await post(b, "đích đang ẩn", { replyTo: r2.comment_id });
    expect(toHidden.error?.code).toBe("42501");
    await admin
      .from("community_solution_comments")
      .update({ status: "visible" })
      .eq("id", r2.comment_id);

    const missing = await post(b, "đích không tồn tại", {
      replyTo: "00000000-0000-0000-0000-000000000000",
    });
    expect(missing.error?.code).toBe("42501");
  }, 60_000);

  it("AC-R1/R4/R6: comment_count đếm cả trả lời; xoá gốc còn trả lời → dòng mờ không danh tính/nội dung, trả lời còn, count giảm đúng 1; xoá gốc không có trả lời → hàng biến mất", async () => {
    const root = await postOk(a, "[CSREPLY] gốc 2 sẽ bị xoá");
    const reply = await postOk(b, "trả lời giữ lại", { replyTo: root.comment_id });
    const solo = await postOk(a, "[CSREPLY] gốc 3 không ai trả lời");

    const before = await detailComments(b);
    const countBefore = before.count!;

    const del = await a.client.rpc("delete_community_comment", { p_comment_id: root.comment_id });
    expect(del.error).toBeNull();

    const after = await detailComments(b);
    expect(after.count).toBe(countBefore - 1);
    const tomb = after.comments.find((c) => c.id === root.comment_id)!;
    expect(tomb.placeholder).toBe("deleted");
    expect(tomb.body).toBeNull();
    expect(tomb.author_id).toBeNull();
    expect(tomb.author_display_name).toBeNull();
    expect(tomb.author_avatar_path).toBeNull();
    expect(tomb.is_mine).toBe(false);
    expect(tomb.i_reported).toBe(false);
    expect(JSON.stringify(tomb)).not.toContain("gốc 2 sẽ bị xoá");
    expect(
      after.comments.some((c) => c.id === reply.comment_id && c.parent_id === root.comment_id)
    ).toBe(true);

    // Người xoá không còn thấy nội dung của chính mình trên dòng mờ.
    const mineAfter = await detailComments(a);
    expect(mineAfter.comments.find((c) => c.id === root.comment_id)?.placeholder).toBe("deleted");

    // Gốc đã xoá không xoá lại được và không trả lời vào được.
    const again = await a.client.rpc("delete_community_comment", { p_comment_id: root.comment_id });
    expect(again.error?.code).toBe("42501");
    const toTomb = await post(b, "trả lời vào dòng mờ", { replyTo: root.comment_id });
    expect(toTomb.error?.code).toBe("42501");

    const delSolo = await a.client.rpc("delete_community_comment", {
      p_comment_id: solo.comment_id,
    });
    expect(delSolo.error).toBeNull();
    const afterSolo = await detailComments(b);
    expect(afterSolo.comments.some((c) => c.id === solo.comment_id)).toBe(false);

    // Hết trả lời visible → dòng mờ biến khỏi detail.
    const delReply = await b.client.rpc("delete_community_comment", {
      p_comment_id: reply.comment_id,
    });
    expect(delReply.error).toBeNull();
    const last = await detailComments(b);
    expect(last.comments.some((c) => c.id === root.comment_id)).toBe(false);
  }, 90_000);

  it("AC-R5 (phía đọc): gốc bị ẩn còn trả lời → người khác thấy dòng mờ 'hidden' không lý do/danh tính; chính chủ thấy bản mờ có lý do như cũ; khôi phục → hiện lại", async () => {
    const root = await postOk(a, "[CSREPLY] gốc 4 sẽ bị ẩn");
    await postOk(b, "trả lời dưới gốc bị ẩn", { replyTo: root.comment_id });
    const hide = await admin
      .from("community_solution_comments")
      .update({ status: "hidden" })
      .eq("id", root.comment_id);
    if (hide.error) throw hide.error;

    const others = await detailComments(b);
    const tomb = others.comments.find((c) => c.id === root.comment_id)!;
    expect(tomb.placeholder).toBe("hidden");
    expect(tomb.body).toBeNull();
    expect(tomb.author_display_name).toBeNull();
    expect(tomb.is_hidden_by_admin).toBe(false);
    expect(tomb.hidden_reason).toBeNull();

    const owner = await detailComments(a);
    const own = owner.comments.find((c) => c.id === root.comment_id)!;
    expect(own.placeholder).toBeNull();
    expect(own.is_hidden_by_admin).toBe(true);
    expect(own.body).toBe("[CSREPLY] gốc 4 sẽ bị ẩn");

    await admin
      .from("community_solution_comments")
      .update({ status: "visible" })
      .eq("id", root.comment_id);
    const restored = (await detailComments(b)).comments.find((c) => c.id === root.comment_id)!;
    expect(restored.placeholder).toBeNull();
    expect(restored.body).toBe("[CSREPLY] gốc 4 sẽ bị ẩn");
  }, 60_000);

  it("AC-R7: người KHÔNG phải người viết nhận hàng 'trả lời bạn' (is_reply_to_me, reply_to_body, thread_root_id); người viết vẫn nhận hàng như cũ; người viết ẩn danh trả lời → tên null (S4)", async () => {
    const root = await postOk(a, "[CSREPLY] câu hỏi của A");
    const byB = await postOk(b, "B trả lời A", { replyTo: root.comment_id });

    const aFeed = await feed(a);
    const toA = aFeed.find((r) => r.comment_id === byB.comment_id)!;
    expect(toA.is_reply_to_me).toBe(true);
    expect(toA.reply_to_body).toBe("[CSREPLY] câu hỏi của A");
    expect(toA.thread_root_id).toBe(root.comment_id);
    expect(toA.author_display_name).toBe(b.displayName);

    const wFeed = await feed(writer);
    const forWriter = wFeed.find((r) => r.comment_id === byB.comment_id)!;
    expect(forWriter.is_reply_to_me).toBe(false);
    expect(forWriter.reply_to_body).toBeNull();
    expect(forWriter.thread_root_id).toBe(root.comment_id);

    // Bình luận của chính A không bao giờ vào feed của A; người không liên quan (B) không nhận hàng "trả lời tôi".
    expect(aFeed.some((r) => r.comment_id === root.comment_id)).toBe(false);
    expect(
      (await feed(b)).some((r) => r.thread_root_id === root.comment_id && r.is_reply_to_me)
    ).toBe(false);

    // S4: người viết bài ẩn danh (show_profile=false) trả lời A → A thấy tên null, dù bình luận không ẩn danh.
    const off = await admin
      .from("community_solutions")
      .update({ show_profile: false })
      .eq("id", solutionId);
    if (off.error) throw off.error;
    const byWriter = await postOk(writer, "Người viết trả lời A", { replyTo: root.comment_id });
    const aFeed2 = await feed(a);
    expect(
      aFeed2.find((r) => r.comment_id === byWriter.comment_id)!.author_display_name
    ).toBeNull();
    await admin.from("community_solutions").update({ show_profile: true }).eq("id", solutionId);

    // Xoá bình luận được trả lời → hàng "trả lời bạn" biến khỏi feed của A (không còn gì để quote).
    const del = await a.client.rpc("delete_community_comment", { p_comment_id: root.comment_id });
    expect(del.error).toBeNull();
    expect((await feed(a)).some((r) => r.comment_id === byB.comment_id)).toBe(false);
  }, 90_000);
});
