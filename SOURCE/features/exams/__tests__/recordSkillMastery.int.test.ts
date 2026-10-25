// recordSkillMastery() đầu-cuối qua submitExam() [service-integration-e2e]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// ADR: docs/adr/ADR-0011-mastery-write-trust-boundary.md (Accepted)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-009/010/011)
//
// GHI CHÚ ÁNH XẠ LÀN (thích nghi theo quy ước dự án — đọc trước khi cài đặt):
//   repo này không có harness E2E Playwright/trình duyệt tự động trong CI (Playwright
//   MCP chỉ là kiểm chứng THỦ CÔNG do agent điều khiển, theo PROJECT_OVERVIEW.md §6 và
//   bảng Quality Assurance Mechanisms của cả hai Design Doc đồng hành). Theo chỉ dẫn
//   tường minh của tác vụ sinh này, làn "service-integration-e2e" của tính năng này
//   (kiểm chứng toàn hệ thống trên hành vi liên dịch vụ thật — ở đây là
//   một lượt ghi Postgres thật với ngữ nghĩa GROUP BY/FILTER/JOIN/ON CONFLICT mà một mock
//   không chứng minh được, không phải hành trình trình duyệt) ánh xạ vào quy ước
//   riêng đã thiết lập của dự án: một file *.int.test.ts chạy trên một instance
//   Supabase dev THẬT, thay vì quy ước client-Supabase-mock mà
//   CHÍNH hậu tố ".int.test.ts" đó thường biểu thị ở nơi khác trong repo này.
//   ĐỪNG dùng getResult.int.test.ts / rating.int.test.ts / submitExam.int.test.ts
//   / tutorActions.int.test.ts / getSkillRecommendation.int.test.ts làm tiền lệ mock cho file này —
//   cả năm file đó đều mock createClient() của @/lib/supabase/server. Tiêu chí đủ điều kiện
//   của file này là của chính skill: "dữ liệu bền vững qua một lượt ghi DB thật" — đúng
//   phát biểu Mock Boundary Decisions của backend DD rằng logic "GROUP BY/FILTER/
//   ON CONFLICT của record_skill_mastery(), và phép join FK với questions.skill_node_id... không thể
//   mock có ý nghĩa; cần một instance Postgres thật."
// ROI (biện minh cho suất service-integration-e2e được chọn này): 81
//   (BV:9 x Freq:8 + Legal:0 + Defect:9) — vượt ngưỡng >50 với biên lớn;
//   cũng là mục biggest_risks #1 trong Design Summary của chính backend DD
//   ("Một lượt ghi mastery giả mạo mở lại đúng lỗ hổng mà ADR-0010 đã đóng cho
//   điểm số, nếu ranh giới tin cậy sai dù chỉ một chút").
// Suất service-integration-e2e thứ hai: cố ý để trống — không ứng viên nào khác trong tính năng này
//   cần kiểm chứng Postgres thật/liên dịch vụ ở mức ROI này; các ca cô lập
//   RLS mức bảng (user_skill_mastery, telemetry_log) là một sản phẩm bàn giao chạy thủ công
//   riêng, được theo dõi trong SOURCE/supabase/test-rls.ts (xem báo cáo của lượt sinh này),
//   không gộp vào ngân sách của file này.
//
// Cách tiếp cận dữ liệu test (backend DD § Data Layer Testing Strategy): gieo một fixture
//  exam/questions/skill_nodes tối thiểu trực tiếp qua client service-role, rồi
//   nộp qua đường Server Action submitExam() THẬT (không phải lời gọi RPC trực tiếp
//   — chứng minh điểm tích hợp BÊN TRONG submitExam(), không chỉ
//   record_skill_mastery() đứng riêng), rồi đọc lại user_skill_mastery qua
//   một client Postgres thật. Cần một instance Supabase dev thật + .env.local —
//   same precondition class as SOURCE/supabase/test-rls.ts's own header ("Tiền
//   đề: schema.sql (bản có UGC v2.0 + Engine 1 §9b/§18/§19) + seed đã chạy").
//   Quy ước tiền tố id fixture: dùng lại mẫu tiền tố cô lập kiểu "rls-" sẵn có của repo này
//   (ví dụ tiền tố "mastery-int-") để setup/cleanup lũy đẳng,
//   theo quy ước tiền tố fixture của chính test-rls.ts.
//
// ---------------------------------------------------------------------------
// GHI CHÚ CÀI ĐẶT (backend-task-10, lượt chuyển skeleton thành test thật)
//
// CÁI GÌ BỊ MOCK, VÀ VÌ SAO KHÔNG LÀM YẾU BẰNG CHỨNG: đúng một thứ —
//   createClient() của @/lib/supabase/server, vốn chỉ tồn tại để dựng một client
//   từ COOKIE của request qua next/headers (không có ngoài một request
//   Next). Nó được thay bằng một client @supabase/supabase-js THẬT giữ một
//   phiên học sinh THẬT (anon key + signInWithPassword), tức cùng JWT và
//   cùng danh tính bị ràng buộc RLS mà production dùng. Không gì của Postgres
//   bị mock: RLS, claim_attempt_answer_key(), record_exam_result(),
//   record_skill_mastery() và bảng user_skill_mastery đều là hàng thật.
//   "server-only" được stub vì cùng lý do bốn file anh em
//   stub nó (nó ném lỗi ngoài bundle server Next).
//
// VÌ SAO NÓ BỎ QUA THAY VÌ HỎNG KHI THIẾU .env.local: .github/workflows/ci.yml
//   chạy `npm test` KHÔNG có thông tin đăng nhập Supabase, và Work Plan nêu
//   file này "cần dev DB sống và được chạy tường minh như một phần của Task 10, không
//   phải cổng staged chung". Hỏng cứng ở đó sẽ biến một ngoại lệ đã tài liệu hoá
//   thành cổng merge hỏng. Việc bỏ qua có tiếng (console.warn) và hẹp:
//   nó chỉ kích hoạt khi cả ba khoá thật sự vắng mặt.
//
// RATE LIMIT: submitExam() được chặn ở 30/giờ cho mỗi người dùng (rateLimit.ts) và
//   bộ đếm có thẩm quyền nằm ở Upstash, nên sống qua các lần chạy. File này
//   tiêu đúng MỘT lượt nộp mỗi lần chạy; một phiên mutation-testing dài
//   trên cùng tài khoản fixture vẫn có thể làm cạn nó, khi đó submitExam() ném
//   "Too many submissions" — một lỗi to, tự giải thích, không phải thầm lặng.
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

// actions.ts import "server-only" (ném lỗi ngoài bundle server Next/react-server)
// → stub, cùng mẫu với bốn file *.int.test.ts anh em.
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
    // Test 1 — AC-009/AC-010: các hàng user_skill_mastery khớp số học với tính đúng
    // sai từng câu của lượt làm; câu chưa gắn thẻ/chưa chấm không đóng góp
    // gì và không gây lỗi
    // =========================================================================
    // AC-009: "Khi một học sinh nộp đề Toán có các câu đã gắn thẻ kỹ năng,
    //   hệ thống phải cập nhật user_skill_mastery cho từng node kỹ năng bị chạm
    //   tới từ tính đúng sai từng câu của lượt làm đó."
    // AC-010: "Cho một đề đã nộp có các câu với skill_node_id NULL,
    //   khi mastery được cập nhật, thì các câu đó không đóng góp gì và không gây
    //   lỗi."
    // ROI: 81 (xem đầu file)
    // @category: core-functionality
    // @lane: service-integration-e2e
    // @dependency: toàn hệ thống (submitExam() thật -> record_exam_result() thật +
    //   hàm SQL record_skill_mastery() thật -> bảng Postgres thật
    //   user_skill_mastery)
    // @complexity: high
    // @real-dependency: hàm SQL record_skill_mastery() của schema.sql §18, bảng
    //   user_skill_mastery, cột questions.skill_node_id, và điểm tích hợp thật của
    //   submitExam() (lời gọi bước 7 tới recordSkillMastery() sau lượt ghi điểm
    //   sẵn có) — không cái nào được mock; theo "Mock Limitations for Data Layer" của
    //   testing-principles, tính đúng của GROUP BY/FILTER/JOIN/ON CONFLICT
    //   không chứng minh được bằng mock.
    // Kiểu hỏng chính: WHERE/JOIN của hàm SQL lặng lẽ bỏ hoặc đếm đôi một hàng
    //   — ví dụ mặc định `coalesce((pq->>'scored')::boolean, true)` bị
    //   đảo, loại nhầm các hàng chưa xác định scored mà đáng ra phải
    //   tính là đã chấm; HOẶC câu có skill_node_id NULL không bị INNER JOIN lọc ra
    //   và sinh một hàng mastery thừa cho một kỹ năng không tồn tại;
    //   HOẶC phép cộng dồn `on conflict ... do update` CỘNG thay vì cộng dồn đúng
    //   total_count ở lần chạy lại, đếm đôi lặng lẽ khi thử lại bất kỳ
    //   hay gọi trùng submitExam().
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
    // Test 2 — AC-011: ranh giới tin cậy — JWT của chính học sinh không gọi được
    // record_skill_mastery() trực tiếp (theo cơ chế ADR-0010 cho lượt ghi điểm)
    // =========================================================================
    // AC-011: "Cho đường ghi mastery, nó phải tôn trọng cùng ranh giới
    //   tin cậy như ghi điểm — được giải quyết bởi ADR-0011."
    // ROI: 81 (xem đầu file — đây CHÍNH LÀ rủi ro được nêu hàng đầu của Design Summary)
    // @category: core-functionality
    // @lane: service-integration-e2e
    // @dependency: toàn hệ thống (cưỡng chế GRANT/REVOKE mức hàm của Postgres thật
    //   — không thể mô phỏng bằng mock)
    // @complexity: medium
    // @real-dependency: câu lệnh `revoke all on function
    //   public.record_skill_mastery(uuid, jsonb) from public, anon, authenticated`
    //   (§18) — một phép kiểm quyền Postgres thật.
    // Kiểu hỏng chính: câu revoke bị thiếu, gõ sai (sai chữ ký/overload của hàm
    //   — cái bẫy default-privileges của Supabase mà dự án này đã dính một lần,
    //   theo ghi chú sự cố ở schema.sql:732-739), hoặc áp lên một DB cũ vì quy trình vân tay §17
    //   không được làm theo sau một lần áp tay — lặng lẽ để lượt ghi mastery
    //   gọi được bằng JWT của bất kỳ học sinh đã xác thực nào, mở lại đúng lỗ hổng
    //   mà ADR-0010 đã đóng cho điểm số.
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
