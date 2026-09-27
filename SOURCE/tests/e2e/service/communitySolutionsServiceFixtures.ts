// Fixture cho SE1/SE2 cua lane service-integration-e2e "Bai giai cong dong"
// (task 47, P5-T8) — cung khuon `essayGradeWriteFixtures.ts`.
//
// KHONG MOCK GI CA. Moi RPC DUOI TEST chay tren phien `authenticated` THAT cua
// tung nguoi (A, nguoi chua nop N, B, Admin). Client service key o day CHI lam
// hai viec: dung/don fixture, va DOC LAI truc tiep cac bang de doi chung doc lap
// voi RPC dang test. TD-029: file nay KHONG import `@/lib/supabase/service-role`.
//
// VE SINH FIXTURE: mot tien to rieng (`cs47svc-`) cham toi email tai khoan, id
// de va id cau hoi; `cleanUp` chay truoc VA sau (idempotent) va an toan khi
// setup dung giua chung.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

export { adminClient, HAS_LIVE_DB };

export const CS_SVC_PREFIX = "cs47svc-";
const PASSWORD = "cs47svc-password-123";

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

export interface Account {
  id: string;
  email: string;
  client: SupabaseClient;
}

/** Sinh dung `n` tu (dem bang khoang trang, khop `count_words`). `seed` lam cho
 *  hai ghi chu cung do dai van khac noi dung, de phep so "than ghi chu khong
 *  doi" khong the dung vi hai than trung nhau. */
export function words(n: number, seed = "tu"): string {
  return Array.from({ length: n }, (_, i) => `${seed}${i + 1}`).join(" ");
}

export function emailOf(slot: string): string {
  return `${CS_SVC_PREFIX}${slot}@example.com`;
}

/** Tao user da xac nhan va dang nhap bang anon key — phien `authenticated` that. */
export async function createAccount(admin: SupabaseClient, slot: string): Promise<Account> {
  const email = emailOf(slot);
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) throw created.error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, email, client };
}

/** Phien `authenticated` THAT cua admin da seed trong `admin_users` — cung cach
 *  `signInAsSeededAdmin` cua `supabase/test-rls.ts`: service key chi sinh mot
 *  token magic-link, mot anon client MOI tu doi token do lay JWT cua dung user
 *  admin. Khong co id nao da seed thi dung: thieu seed out-of-band cua task 03,
 *  khong phai loi code. */
export async function signInAsSeededAdmin(admin: SupabaseClient): Promise<{ id: string; client: SupabaseClient }> {
  const configuredIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seeded = await admin.from("admin_users").select("user_id").in("user_id", configuredIds);
  if (seeded.error) throw seeded.error;
  const id = (seeded.data?.[0] as { user_id: string } | undefined)?.user_id;
  if (!id) {
    throw new Error("admin_users khong chua id nao cua ADMIN_USER_IDS — chay lai seed out-of-band cua task 03, KHONG sua test");
  }
  const user = await admin.auth.admin.getUserById(id);
  if (user.error) throw user.error;
  const email = user.data.user.email;
  if (!email) throw new Error("User admin da seed khong co email — khong dang nhap bang magic link duoc");
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw verified.error;
  return { id, client };
}

/** Mot de published, `questionCount` cau trac nghiem, tac gia `authorId`. */
export async function createExam(
  admin: SupabaseClient,
  slot: string,
  authorId: string,
  questionCount: number,
): Promise<{ examId: string; questionIds: string[] }> {
  const examId = `${CS_SVC_PREFIX}${slot}-exam`;
  const questionIds = Array.from({ length: questionCount }, (_, i) => `${examId}-q${i + 1}`);
  const questions = await admin.from("questions").insert(
    questionIds.map((id, i) => ({
      id,
      content: `[CS47] Cau ${i + 1}`,
      choices: MCQ_CHOICES,
      correct_answer: "A",
      subject: "Toán",
      grade: 10,
      topic: "Toán",
    })),
  );
  if (questions.error) throw questions.error;
  const exam = await admin.from("exams").insert({
    id: examId,
    title: `[CS47] ${slot}`,
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "CS47 Author",
    question_ids: questionIds,
    status: "published",
  });
  if (exam.error) throw exam.error;
  return { examId, questionIds };
}

/** Mot luot lam DA NOP, tra ve id. */
export async function submittedAttempt(admin: SupabaseClient, userId: string, examId: string): Promise<string> {
  const res = await admin
    .from("exam_attempts")
    .insert({
      user_id: userId,
      exam_id: examId,
      status: "submitted",
      started_at: new Date(Date.now() - 60_000).toISOString(),
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data.id as string;
}

/** Ket qua cham THAT cho luot lam — de `score`/`per_question` co gia tri that
 *  khac null, nen mot cot bi che ve null moi co nghia la "da che". */
export async function insertResult(
  admin: SupabaseClient,
  fixture: { attemptId: string; userId: string; questionIds: string[]; totalScore: number },
): Promise<void> {
  const res = await admin.from("exam_results").insert({
    attempt_id: fixture.attemptId,
    user_id: fixture.userId,
    total_score: fixture.totalScore,
    correct: fixture.questionIds.length,
    total: fixture.questionIds.length,
    topic_breakdown: [],
    per_question: fixture.questionIds.map((questionId) => ({ questionId, selected: "A", isCorrect: true })),
  });
  if (res.error) throw res.error;
}

/** Ghi ten hien thi + duong dan avatar THAT cho mot user — gia tri ma cot bi che
 *  phai giau di, va gia tri ma hang doi admin phai lo ra. */
export async function setProfile(
  admin: SupabaseClient,
  userId: string,
  profile: { displayName: string; avatarPath: string },
): Promise<void> {
  // `.single()`: an update matching zero rows must fail here, otherwise the
  // masked columns would be null for lack of a value and prove nothing.
  const res = await admin
    .from("user_profiles")
    .update({ display_name: profile.displayName, avatar_url: profile.avatarPath })
    .eq("id", userId)
    .select("id")
    .single();
  if (res.error) throw res.error;
}

export interface SolutionSnapshot {
  status: string | null;
  isPinned: boolean | null;
  notes: Record<string, string>;
}

/** Doc lai TRUC TIEP hai bang (doc lap voi RPC dang test): trang thai bai giai
 *  va than MOI ghi chu, theo `(exam_id, author_id)`. Khong co dong thi `status`
 *  la null va `notes` rong. */
export async function readSolution(admin: SupabaseClient, examId: string, authorId: string): Promise<SolutionSnapshot> {
  const solution = await admin
    .from("community_solutions")
    .select("id, status, is_pinned")
    .eq("exam_id", examId)
    .eq("author_id", authorId)
    .maybeSingle();
  if (solution.error) throw solution.error;
  if (!solution.data) return { status: null, isPinned: null, notes: {} };
  const notes = await admin
    .from("community_solution_notes")
    .select("question_id, body")
    .eq("solution_id", solution.data.id);
  if (notes.error) throw notes.error;
  return {
    status: solution.data.status as string,
    isPinned: solution.data.is_pinned as boolean,
    notes: Object.fromEntries((notes.data as { question_id: string; body: string }[]).map((n) => [n.question_id, n.body])),
  };
}

/** So dong `community_solutions` cua mot cap `(exam_id, author_id)`. */
export async function countSolutions(admin: SupabaseClient, examId: string, authorId: string): Promise<number> {
  const res = await admin
    .from("community_solutions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .eq("author_id", authorId);
  if (res.error) throw res.error;
  return res.count ?? -1;
}

/** Idempotent: xoa bai giai (ghi chu/binh luan/bao cao cascade theo no), luot
 *  lam (ket qua cascade theo luot), de, cau hoi cua MOT nhom `examSlot`, roi xoa
 *  user theo email. Luot lam cua admin tren de fixture cung di theo `exam_id`,
 *  nen tai khoan admin that khong bi dung toi ngoai dong do. */
export async function cleanUp(admin: SupabaseClient, group: { examSlot: string; accountSlots: string[] }): Promise<void> {
  const like = `${CS_SVC_PREFIX}${group.examSlot}-%`;
  const slots = group.accountSlots;
  for (const [table, column] of [
    ["community_solutions", "exam_id"],
    ["exam_attempts", "exam_id"],
    ["exams", "id"],
    ["questions", "id"],
  ] as const) {
    const res = await admin.from(table).delete().like(column, like);
    if (res.error) throw res.error;
  }
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  const emails = new Set(slots.map(emailOf));
  for (const user of list.data.users) {
    if (!user.email || !emails.has(user.email)) continue;
    const removed = await admin.auth.admin.deleteUser(user.id);
    if (removed.error) throw removed.error;
  }
}
