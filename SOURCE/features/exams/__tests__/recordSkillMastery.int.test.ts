// recordSkillMastery() end-to-end via submitExam() [service-integration-e2e]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// ADR: docs/adr/ADR-0011-mastery-write-trust-boundary.md (Accepted)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-009/010/011)
//
// LANE MAPPING NOTE (project-convention adaptation — read before implementing):
//   this repo has no automated Playwright/browser E2E harness in CI (Playwright
//   MCP is agent-driven MANUAL verification only, per PROJECT_OVERVIEW.md §6 and
//   both companion Design Docs' own Quality Assurance Mechanisms tables). Per this
//   generation task's explicit instruction, this feature's "service-integration-e2e"
//   lane (full-system verification against real cross-service behavior — here, a
//   real Postgres write with GROUP BY/FILTER/JOIN/ON CONFLICT semantics a mock
//   cannot prove, not a browser journey) maps onto this project's own established
//   convention: an *.int.test.ts file that runs against a REAL dev Supabase
//   instance, rather than the mocked-Supabase-client-boundary convention that the
//   SAME ".int.test.ts" filename suffix ordinarily denotes elsewhere in this repo.
//   DO NOT use getResult.int.test.ts / rating.int.test.ts / submitExam.int.test.ts
//   / tutorActions.int.test.ts / getSkillRecommendation.int.test.ts as this file's
//   mocking precedent — all five of those mock @/lib/supabase/server's
//   createClient(). This file's qualifying criterion is the skill's own: "data
//   persists across a real DB write" — the exact backend DD Mock Boundary
//   Decisions statement that record_skill_mastery()'s "GROUP BY/FILTER/
//   ON CONFLICT logic, and the FK join against questions.skill_node_id... cannot
//   be meaningfully mocked; requires a real Postgres instance."
// ROI (justifying this selected service-integration-e2e slot): 81
//   (BV:9 x Freq:8 + Legal:0 + Defect:9) — clears the >50 threshold by a wide
//   margin; also the backend DD's Design Summary's own biggest_risks #1 item
//   ("A forged mastery write re-opens exactly the hole ADR-0010 closed for
//   scores, if the trust boundary is even slightly wrong").
// Second service-integration-e2e slot: intentionally left unfilled — no other
//   candidate in this feature requires real-Postgres/cross-service verification
//   at this ROI tier; the RLS table-level isolation cases (user_skill_mastery,
//   telemetry_log) are a separate, manually-run deliverable tracked in
//   SOURCE/supabase/test-rls.ts (see this generation run's report), not folded
//   into this file's budget.
//
// Test data approach (backend DD § Data Layer Testing Strategy): seeds a minimal
//   exam/questions/skill_nodes fixture directly via a service-role client, then
//   submits through the REAL submitExam() Server Action path (not a direct RPC
//   call — proves the integration point INSIDE submitExam(), not merely
//   record_skill_mastery() in isolation), then reads back user_skill_mastery via
//   a real Postgres client. Requires a real dev Supabase instance + .env.local —
//   same precondition class as SOURCE/supabase/test-rls.ts's own header ("Tiền
//   đề: schema.sql (bản có UGC v2.0 + Engine 1 §9b/§18/§19) + seed đã chạy").
//   Fixture id prefix convention: reuse this repo's existing "rls-"-style
//   isolated-prefix pattern (e.g. "mastery-int-" prefix) for idempotent
//   setup/cleanup, mirroring test-rls.ts's own fixture-prefix convention.
//
// ---------------------------------------------------------------------------
// IMPLEMENTATION NOTES (backend-task-10, the run that converted the skeleton)
//
// WHAT IS MOCKED, AND WHY IT DOES NOT WEAKEN THE PROOF: exactly one thing —
//   @/lib/supabase/server's createClient(), which exists only to build a client
//   from the request COOKIES via next/headers (unavailable outside a Next
//   request). It is replaced by a REAL @supabase/supabase-js client holding a
//   REAL student session (anon key + signInWithPassword), i.e. the same JWT and
//   the same RLS-bound identity production uses. Nothing about Postgres is
//   mocked: RLS, claim_attempt_answer_key(), record_exam_result(),
//   record_skill_mastery() and the user_skill_mastery table are all the real
//   ones. "server-only" is stubbed for the same reason the four sibling files
//   stub it (it throws outside a Next server bundle).
//
// WHY IT SKIPS INSTEAD OF FAILING WITHOUT .env.local: .github/workflows/ci.yml
//   runs `npm test` with NO Supabase credentials, and the Work Plan states this
//   file "requires the live dev DB and is run explicitly as part of Task 10, not
//   the generic staged gate". Hard-failing there would turn a documented
//   exclusion into a broken merge gate. The skip is loud (console.warn) and
//   narrow: it triggers only when all three keys are genuinely absent.
//
// RATE LIMIT: submitExam() is guarded at 30/hour per user (rateLimit.ts) and the
//   authoritative counter lives in Upstash, so it survives across runs. This file
//   spends exactly ONE submission per run; a long mutation-testing session on the
//   same fixture account can still exhaust it, in which case submitExam() throws
//   "Too many submissions" — a loud, self-explanatory failure, not a silent one.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Nạp .env.local vào process.env — vitest không tự nạp, và service-role.ts đọc
 *  env LÚC GỌI nên nạp ở đây là đủ. Mirror test-rls.ts's loadEnv(), THÊM một
 *  việc: bóc cặp nháy bao ngoài. Next.js tự bóc khi nó nạp .env.local, nên vài
 *  giá trị trong file (KV_REST_API_URL...) được ghi có nháy và vẫn chạy đúng ở
 *  production; giữ nguyên nháy ở đây sẽ dựng Upstash client bằng một URL sai và
 *  làm guard() của submitExam() ném lỗi vì lý do không liên quan gì tới test.
 *  Không ghi đè biến đã có sẵn trong môi trường. */
function loadEnvLocal(): void {
  const path = resolve(__dirname, "../../../.env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HAS_LIVE_DB = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

if (!HAS_LIVE_DB) {
  console.warn(
    "! recordSkillMastery.int.test.ts BỎ QUA: thiếu NEXT_PUBLIC_SUPABASE_URL / " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. File này CHỈ có " +
      "giá trị khi chạy với dev Supabase thật (xem header)."
  );
}

// actions.ts imports "server-only" (throws outside a Next server/react-server
// bundle) → stub, same pattern as the four sibling *.int.test.ts files.
vi.mock("server-only", () => ({}));

// Chỉ thay ĐƯỜNG LẤY SESSION (next/headers cookies), không thay Postgres: giá
// trị gán vào holder dưới đây là một client Supabase THẬT đã đăng nhập bằng
// mật khẩu của tài khoản fixture.
const { studentClientHolder } = vi.hoisted(() => ({
  studentClientHolder: { current: null as SupabaseClient | null },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!studentClientHolder.current) throw new Error("student client chưa sẵn sàng");
    return studentClientHolder.current;
  },
}));

const { submitExam } = await import("@/features/exams/actions");

// --- Fixture (prefix "mastery-int-", theo đúng quy ước prefix của test-rls.ts) ---
const PREFIX = "mastery-int-";
const STUDENT_EMAIL = "smithnguyen247+masteryint@gmail.com";
const STUDENT_PASSWORD = "mastery-int-password-123";
const EXAM_ID = `${PREFIX}exam`;
const SKILL_A = `${PREFIX}sn-fixture-a`;
const SKILL_B = `${PREFIX}sn-fixture-b`;
const FIXTURE_SKILL_IDS = [SKILL_A, SKILL_B];
const Q_A_CORRECT = `${PREFIX}q1-a-correct`;
const Q_A_WRONG = `${PREFIX}q2-a-wrong`;
const Q_B_CORRECT = `${PREFIX}q3-b-correct`;
const Q_UNTAGGED = `${PREFIX}q4-untagged-wrong`;
const FIXTURE_QUESTION_IDS = [Q_A_CORRECT, Q_A_WRONG, Q_B_CORRECT, Q_UNTAGGED];

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

/** Đáp án học sinh nộp — hằng số của fixture, xem bảng kỳ vọng ngay dưới. */
const SUBMITTED_ANSWERS: Record<string, string> = {
  [Q_A_CORRECT]: "A", // đúng
  [Q_A_WRONG]: "C", // sai (đáp án đúng là B)
  [Q_B_CORRECT]: "A", // đúng
  [Q_UNTAGGED]: "B", // sai (đáp án đúng là A) — câu KHÔNG gắn skill
};

// Kỳ vọng TỰ TÍNH từ fixture ở trên (testing-principles "Literal Expected
// Values") — KHÔNG suy ra từ hàm SQL đang được kiểm chứng:
//   SKILL_A: q1 đúng + q2 sai            -> correct 1 / total 2, có last_wrong_at
//   SKILL_B: q3 đúng                     -> correct 1 / total 1, last_wrong_at null
//   q4 (skill_node_id NULL, trả lời sai) -> KHÔNG sinh dòng nào
const EXPECTED_SKILL_A = { correct_count: 1, total_count: 2 };
const EXPECTED_SKILL_B = { correct_count: 1, total_count: 1 };
const EXPECTED_MASTERY_ROW_COUNT = 2;

interface MasteryRow {
  skill_node_id: string;
  correct_count: number;
  total_count: number;
  last_wrong_at: string | null;
}

let admin: SupabaseClient;
let studentId: string;
let attemptId: string;
/** Kết quả của lời gọi submitExam() thật trong beforeAll — Test 1 nghĩa vụ (d). */
const submitOutcome: { redirectedTo: string | null; thrown: unknown } = {
  redirectedTo: null,
  thrown: null,
};

/** Tạo (hoặc cập nhật) user đã confirm qua Admin API — mirror test-rls.ts. */
async function ensureStudent(): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: STUDENT_EMAIL,
    password: STUDENT_PASSWORD,
    email_confirm: true,
  });
  if (!created.error) return created.data.user.id;

  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((u) => u.email === STUDENT_EMAIL);
  if (!existing) throw created.error;
  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: STUDENT_PASSWORD,
    email_confirm: true,
  });
  if (updated.error) throw updated.error;
  return existing.id;
}

/** Dọn fixture — chạy TRƯỚC và SAU để idempotent (quy ước test-rls.ts).
 *  Thứ tự bắt buộc: attempt trước exam (FK exam_attempts.exam_id), question
 *  trước skill node (questions.skill_node_id là `on delete set null`, xoá node
 *  trước sẽ để lại câu hỏi mất tag mà bộ lọc dưới đây không còn tìm ra). */
async function cleanupFixtures(): Promise<void> {
  await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
  await admin.from("user_skill_mastery").delete().in("skill_node_id", FIXTURE_SKILL_IDS);
  await admin.from("exams").delete().eq("id", EXAM_ID);
  await admin.from("questions").delete().in("id", FIXTURE_QUESTION_IDS);
  await admin.from("skill_nodes").delete().in("id", FIXTURE_SKILL_IDS);
}

/** Seed qua service_role (bypass RLS): 2 skill node + 4 câu (3 có tag, 1 NULL) +
 *  1 đề published + 1 attempt 'in_progress' của học sinh fixture. */
async function setupFixtures(): Promise<void> {
  const nodes = await admin.from("skill_nodes").insert([
    { id: SKILL_A, label_vi: "[mastery-int] Kỹ năng A" },
    { id: SKILL_B, label_vi: "[mastery-int] Kỹ năng B" },
  ]);
  if (nodes.error) throw nodes.error;

  const baseQuestion = {
    choices: MCQ_CHOICES,
    subject: "Toán",
    grade: 10,
    topic: "Fixture mastery",
    question_type: "mcq",
  };
  const questions = await admin.from("questions").insert([
    { ...baseQuestion, id: Q_A_CORRECT, content: "[mastery-int] A1", correct_answer: "A", skill_node_id: SKILL_A },
    { ...baseQuestion, id: Q_A_WRONG, content: "[mastery-int] A2", correct_answer: "B", skill_node_id: SKILL_A },
    { ...baseQuestion, id: Q_B_CORRECT, content: "[mastery-int] B1", correct_answer: "A", skill_node_id: SKILL_B },
    { ...baseQuestion, id: Q_UNTAGGED, content: "[mastery-int] chưa gắn kỹ năng", correct_answer: "A", skill_node_id: null },
  ]);
  if (questions.error) throw questions.error;

  // published: exam_answer_key() (§10a nhánh 2) chỉ trả đáp án cho người đã có
  // attempt 'submitted' trên đề ĐÃ published — đúng đường production.
  const exam = await admin.from("exams").insert({
    id: EXAM_ID,
    title: "[mastery-int] Đề fixture ghi mastery",
    question_ids: FIXTURE_QUESTION_IDS,
    duration_minutes: 15,
    subject: "Toán",
    grade: 10,
    status: "published",
  });
  if (exam.error) throw exam.error;

  const attempt = await admin
    .from("exam_attempts")
    .insert({ exam_id: EXAM_ID, user_id: studentId, status: "in_progress" })
    .select("id")
    .single();
  if (attempt.error) throw attempt.error;
  attemptId = attempt.data.id as string;
}

/** submitExam() kết thúc bằng redirect() của next/navigation — một throw
 *  NEXT_REDIRECT có chủ đích (thật, không mock). Bắt đúng nó, ghi lại đích đến;
 *  mọi throw khác giữ nguyên để Test 1 nghĩa vụ (d) thấy được. */
async function callSubmitExam(): Promise<void> {
  try {
    await submitExam(attemptId, SUBMITTED_ANSWERS);
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      submitOutcome.redirectedTo = digest;
      return;
    }
    submitOutcome.thrown = err;
  }
}

async function readMasteryRows(): Promise<MasteryRow[]> {
  const { data, error } = await admin
    .from("user_skill_mastery")
    .select("skill_node_id, correct_count, total_count, last_wrong_at")
    .eq("user_id", studentId)
    .order("skill_node_id");
  if (error) throw error;
  return (data ?? []) as MasteryRow[];
}

describe.skipIf(!HAS_LIVE_DB)(
  "record_skill_mastery() qua submitExam() thật trên dev Postgres (AC-009/010/011)",
  () => {
    beforeAll(async () => {
      admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      studentId = await ensureStudent();
      await cleanupFixtures();
      await setupFixtures();

      const student = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await student.auth.signInWithPassword({
        email: STUDENT_EMAIL,
        password: STUDENT_PASSWORD,
      });
      if (signIn.error) throw signIn.error;
      studentClientHolder.current = student;

      // MỘT lời gọi submitExam() thật cho cả file: cả hai test đọc trạng thái nó
      // để lại, không test nào phụ thuộc vào việc test kia đã chạy hay chưa.
      await callSubmitExam();
    }, 60_000);

    afterAll(async () => {
      if (admin) await cleanupFixtures();
    }, 60_000);

    // =========================================================================
    // Test 1 — AC-009/AC-010: user_skill_mastery rows arithmetically match the
    // attempt's per-question correctness; untagged/unscored questions contribute
    // nothing and cause no error
    // =========================================================================
    // AC-009: "When a student submits a Math exam containing skill-tagged
    //   questions, the system shall update user_skill_mastery for each touched
    //   skill node from that attempt's per-question correctness."
    // AC-010: "Given a submitted exam contains questions with a NULL skill_node_id,
    //   when mastery is updated, then those questions contribute nothing and cause
    //   no error."
    // ROI: 81 (see header)
    // @category: core-functionality
    // @lane: service-integration-e2e
    // @dependency: full-system (real submitExam() -> real record_exam_result() +
    //   real record_skill_mastery() SQL function -> real Postgres
    //   user_skill_mastery table)
    // @complexity: high
    // @real-dependency: schema.sql §18's record_skill_mastery() SQL function, the
    //   user_skill_mastery table, questions.skill_node_id column, and submitExam()'s
    //   real integration point (its step-7 call to recordSkillMastery() after the
    //   existing score write) — none of these may be mocked; per testing-principles'
    //   "Mock Limitations for Data Layer," GROUP BY/FILTER/JOIN/ON CONFLICT
    //   correctness cannot be proven by a mock.
    // Primary failure mode: the SQL function's WHERE/JOIN silently drops or
    //   double-counts a row — e.g. the `coalesce((pq->>'scored')::boolean, true)`
    //   default is inverted, wrongly excluding undefined-scored rows that should
    //   count as scored; OR the NULL-skill_node_id question is not filtered out by
    //   the INNER JOIN and produces a spurious mastery row for a non-existent skill;
    //   OR the `on conflict ... do update` accumulation ADDS instead of correctly
    //   accumulating total_count on a re-run, silently double-counting on any retry
    //   or duplicate submitExam() invocation.
    it("nghĩa vụ (a)-(d): sau một lời gọi submitExam() thật, mastery khớp đúng số học của fixture, câu không gắn kỹ năng không sinh dòng nào, và chính submitExam() vẫn redirect thành công", async () => {
      // (d) trước: nếu submitExam() ném lỗi thật thì mọi assertion dưới đây vô
      // nghĩa, và AC-010 nửa "causes no error" chính là điều này.
      expect(submitOutcome.thrown).toBeNull();
      expect(submitOutcome.redirectedTo).toContain(
        `/exams/${EXAM_ID}/attempt/${attemptId}/result`
      );

      // Điểm đã ghi (positive control): mastery là bước SAU bước ghi điểm, nên
      // "0 dòng mastery" mà không có control này có thể là do bài chưa được chấm.
      const results = await admin
        .from("exam_results")
        .select("correct, total")
        .eq("attempt_id", attemptId);
      expect(results.error).toBeNull();
      expect(results.data).toHaveLength(1);
      // 2 đúng / 4 câu chấm được — tự tính từ SUBMITTED_ANSWERS ở trên.
      expect(results.data?.[0]).toMatchObject({ correct: 2, total: 4 });

      const rows = await readMasteryRows();

      // (c) ĐÚNG 2 dòng: câu q4 (skill_node_id NULL) KHÔNG đóng góp gì. Đọc theo
      // user_id chứ không lọc theo 2 node fixture — một dòng "lạc" do JOIN sai
      // vẫn phải lộ ra.
      expect(rows).toHaveLength(EXPECTED_MASTERY_ROW_COUNT);
      expect(rows.map((r) => r.skill_node_id)).toEqual([SKILL_A, SKILL_B]);

      // (a) + (b) số học khớp fixture.
      const rowA = rows.find((r) => r.skill_node_id === SKILL_A);
      const rowB = rows.find((r) => r.skill_node_id === SKILL_B);
      expect(rowA).toMatchObject(EXPECTED_SKILL_A);
      expect(rowB).toMatchObject(EXPECTED_SKILL_B);

      // last_wrong_at: A có một câu sai -> phải được đóng dấu; B toàn đúng ->
      // phải còn null. Cùng một `filter (where not isCorrect)` với 2 kết cục
      // khác nhau, nên một dấu đóng vô điều kiện sẽ lộ ra ở đây.
      expect(rowA?.last_wrong_at).not.toBeNull();
      expect(rowB?.last_wrong_at).toBeNull();
    });

    // =========================================================================
    // Test 2 — AC-011: trust boundary — a student's own JWT cannot call
    // record_skill_mastery() directly (mirrors ADR-0010's mechanism for score writes)
    // =========================================================================
    // AC-011: "Given the mastery write path, it shall respect the same trust
    //   boundary as score writing — resolved by ADR-0011."
    // ROI: 81 (see header — this IS the Design Summary's own top-named risk)
    // @category: core-functionality
    // @lane: service-integration-e2e
    // @dependency: full-system (real Postgres function-level GRANT/REVOKE
    //   enforcement — cannot be simulated by a mock)
    // @complexity: medium
    // @real-dependency: the `revoke all on function
    //   public.record_skill_mastery(uuid, jsonb) from public, anon, authenticated`
    //   statement (§18) — a real Postgres privilege check.
    // Primary failure mode: the revoke statement is missing, mistyped (wrong
    //   function signature/overload — Supabase's default-privileges pitfall this
    //   project has already been bitten by once, per schema.sql:732-739's incident
    //   note), or landed against a stale DB because the §17 fingerprint procedure
    //   wasn't followed after a manual apply — silently leaving the mastery write
    //   callable by any authenticated student's own JWT, reopening exactly the hole
    //   ADR-0010 closed for scores.
    it("JWT học sinh gọi thẳng record_skill_mastery() bị chặn ở tầng QUYỀN, và không có dòng mastery nào đổi", async () => {
      const before = await readMasteryRows();

      // Tham số CỐ Ý hợp lệ: đúng attempt vừa nộp của chính mình + một câu có
      // gắn kỹ năng. Nếu EXECUTE bị hở thì lời gọi này KHÔNG lỗi và sẽ cộng thêm
      // vào counter — tức là "chặn được" mới là điều duy nhất giữ nó im lặng.
      const denied = await studentClientHolder.current!.rpc("record_skill_mastery", {
        p_attempt_id: attemptId,
        p_per_question: [{ questionId: Q_A_CORRECT, isCorrect: true, scored: true }],
      });

      // KHÔNG assert trần `error !== null` — đó là false green: một lỗi từ THÂN
      // hàm (check_violation) chứng minh ngược lại, rằng học sinh GỌI ĐƯỢC. Phân
      // biệt đúng lớp lỗi quyền, y hệt case MM-b trong supabase/test-rls.ts.
      expect(denied.error).not.toBeNull();
      expect(
        denied.error!.code === "42501" ||
          denied.error!.code === "PGRST202" ||
          /permission denied|could not find the function/i.test(denied.error!.message)
      ).toBe(true);

      // Negative proof: không dòng nào được ghi/đổi.
      expect(await readMasteryRows()).toEqual(before);
    });
  }
);
