// Fixture cho lane service-e2e cua hai ham ghi band (ADR-0018 D1) — Task H8.
//
// KHONG MOCK GI CA. Do la toan bo ly do lane nay ton tai: ba tinh chat duoi day
// khong the chung minh bang mot client bi mock, vi ca ba deu la hanh vi cua
// POSTGRES chu khong phai cua ma TypeScript goi no —
//   1. thu tu mang jsonb sau mot lan ghi lai mot phan tu,
//   2. vi tu `<> 'graded'` khop ZERO dong (ghi-lan-dau-thang),
//   3. cac GRANT that (`anon`/`authenticated` bi 42501, `service_role` di toi
//      than ham).
//
// VE SINH FIXTURE theo `supabase/test-rls.ts` Part 7 va
// `recordSkillMastery.int.test.ts`: mot tien to id RIENG cho lane nay, setup va
// teardown IDEMPOTENT, va moi ca tu tao roi tu xoa user + exam + attempt +
// exam_results cua chinh no.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Vitest khong nap `.env.local`; file tien le nap bang tay va o day cung vay.
 *  KHONG BAO GIO ghi de mot bien da co san trong moi truong. */
function loadEnvLocal(): void {
  const path = fileURLToPath(new URL("../../../.env.local", import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Cong cho `describe.skipIf(!HAS_LIVE_DB)`, doc luc import vi quyet dinh skip
 *  duoc lay luc COLLECT. No noi rang ba bien moi truong co mat va KHONG NOI GI
 *  HON — dac biet no KHONG noi rang DDL cua H5/H7 da duoc ap len database. Neu
 *  file nay do voi `PGRST202`, hay SUA DATABASE, dung sua test. */
export const HAS_LIVE_DB = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

/** Tien to cach ly cua lane nay. No cham toi email tai khoan, `exams.title` va
 *  id cua cau hoi — du de mot lenh xoa theo khoi khong bao gio voi toi mot dong
 *  that. */
export const EG_PREFIX = "eg-svc-";

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL as string, ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface EssayFixture {
  userId: string;
  email: string;
  examId: string;
  /** UUID — `exam_attempts.id` la `uuid`, khong phai `text`. Sinh o setUp va
   *  tra ve, vi teardown xoa theo USER (cascade) chu khong theo id nay. */
  attemptId: string;
  questionIds: string[];
  /** Client mang JWT THAT cua hoc sinh vua tao — dung cho cac probe grant. */
  studentClient: SupabaseClient;
}

const PASSWORD = "eg-svc-password-123";

/** Mot phan tu `per_question` mang du nam khoa vong doi, dung hinh dang
 *  `computeScore()` phat ra (W1). */
function essayEntry(questionId: string) {
  return {
    questionId,
    selected: "bai lam cua hoc sinh",
    isCorrect: false,
    scored: false,
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 0,
  };
}

/**
 * Dung mot lat thi DA NOP voi `n` cau tu luan, tat ca o `pending`.
 *
 * `slot` lam cho moi ca so huu mot khong gian id rieng, nen hai ca chay song
 * song hay chay xao tron thu tu deu khong dam vao nhau.
 */
export async function setUp(admin: SupabaseClient, slot: string, essayCount = 3): Promise<EssayFixture> {
  const email = `${EG_PREFIX}${slot}@example.com`;

  // Idempotent: don rac cua mot lan chay truoc bi ngat giua chung.
  await tearDownByEmail(admin, email);

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr) throw userErr;
  const userId = created.user.id;

  const questionIds = Array.from({ length: essayCount }, (_, i) => `${EG_PREFIX}${slot}-q${i + 1}`);

  const { error: qErr } = await admin.from("questions").insert(
    questionIds.map((id) => ({
      id,
      content: `Cau tu luan ${id}`,
      choices: [],
      // `correct_answer` la NOT NULL kem CHECK in ('A'..'D') — mot cau tu luan
      // khong dung toi no, nhung schema van doi mot gia tri hop le. Ghi ra de
      // nguoi sau khong tuong day la mot dap an co y nghia.
      correct_answer: "A",
      subject: "Toán",
      grade: 9,
      topic: "Đại số",
      question_type: "essay",
      essay_answer: "Dap an mau",
    }))
  );
  if (qErr) throw qErr;

  const examId = `${EG_PREFIX}${slot}-exam`;
  const { error: examErr } = await admin.from("exams").insert({
    id: examId,
    title: `${EG_PREFIX}${slot} exam`,
    subject: "Toán",
    grade: 9,
    question_ids: questionIds,
    duration_minutes: 30,
  });
  if (examErr) throw examErr;

  // `exam_attempts.id` la `uuid` — de DB tu sinh roi doc lai, thay vi go mot
  // chuoi co tien to (no se bi tu choi o tang kieu).
  const { data: attempt, error: attemptErr } = await admin
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
  if (attemptErr) throw attemptErr;
  const attemptId = attempt.id as string;

  const { error: resultErr } = await admin.from("exam_results").insert({
    attempt_id: attemptId,
    user_id: userId,
    total_score: 0,
    correct: 0,
    total: 0,
    topic_breakdown: [],
    per_question: questionIds.map(essayEntry),
  });
  if (resultErr) throw resultErr;

  const studentClient = anonClient();
  const { error: signInErr } = await studentClient.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;

  return { userId, email, examId, attemptId, questionIds, studentClient };
}

/** Xoa theo email — IDEMPOTENT, va an toan de goi ca khi setup that bai giua
 *  chung.
 *
 *  Thu tu quan trong: xoa USER truoc, vi `exam_attempts.user_id` va
 *  `exam_results.user_id` deu `on delete cascade` — mot lenh xoa user keo theo
 *  ca hai. Roi moi xoa de va cau hoi, von khong tro toi user. */
export async function tearDownByEmail(admin: SupabaseClient, email: string): Promise<void> {
  const slot = email.slice(EG_PREFIX.length).replace("@example.com", "");

  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);

  await admin.from("exams").delete().eq("id", `${EG_PREFIX}${slot}-exam`);
  await admin.from("questions").delete().like("id", `${EG_PREFIX}${slot}-q%`);
}

export async function tearDown(admin: SupabaseClient, fixture: EssayFixture | undefined): Promise<void> {
  if (!fixture) return;
  await fixture.studentClient.auth.signOut();
  await tearDownByEmail(admin, fixture.email);
}

/** Doc lai mang `per_question` NGUYEN VAN — khong qua bat ky phep suy nao. */
export async function readPerQuestion(
  admin: SupabaseClient,
  attemptId: string
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await admin
    .from("exam_results")
    .select("per_question")
    .eq("attempt_id", attemptId)
    .single();
  if (error) throw error;
  return data.per_question as Array<Record<string, unknown>>;
}
