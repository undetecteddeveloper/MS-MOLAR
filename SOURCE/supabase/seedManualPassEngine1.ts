// Seed dữ liệu cho các lượt kiểm thủ công của Engine 1 (Work Plan Phase 5,
// Task 16). Dựng 5 tài khoản fixture + 4 đề fixture trên dev, mỗi tài khoản
// đại diện đúng MỘT trạng thái mà Task 17/18 cần nhìn thấy trên trình duyệt.
//
// Cách chạy (trong SOURCE/):
//   npx tsx supabase/seedManualPassEngine1.ts            # dựng (idempotent)
//   npx tsx supabase/seedManualPassEngine1.ts --cleanup  # xoá sạch fixture
//
// ĐƯỜNG GHI DỮ LIỆU — đọc trước khi sửa:
//   Script này KHÔNG gọi submitExam() được: Server Action đó `import
//   "server-only"` (qua lib/supabase/service-role.ts) nên nó ném ngay khi
//   chạy ngoài bundle react-server của Next. Thay vì chép lại logic, script
//   lặp lại ĐÚNG chuỗi bước 3→7 của submitExam() bằng chính các RPC thật:
//     3. claim_attempt_answer_key()  — JWT học sinh, đóng attempt + trả đáp án
//     4. upsert attempt_answers      — JWT học sinh
//     5. computeScore()              — IMPORT hàm thật, không chép công thức
//     6. record_exam_result()        — service_role (§11b tự suy user_id)
//     7. record_skill_mastery()      — service_role (§18, ADR-0011)
//   Thứ duy nhất bị bỏ là vỏ Server Action: guard() rate limit + redirect().
//   Cả hai đều không sinh dữ liệu, nên dữ liệu tạo ra ở đây giống hệt dữ liệu
//   một lượt nộp thật — và Task 17/18 sau đó vẫn đi qua đường thật trên trình
//   duyệt, nên vỏ đó cũng được kiểm ở đó chứ không bị bỏ sót.
//
// KỊCH BẢN (khớp Task 16 a/b/c của work plan):
//   a  tutor   — 1 tài khoản nộp CÙNG một đề 2 lần, sai cùng 2 câu cả hai lần
//                => hasBeenWrongTwice = true => ExplainStepAffordance hiện ra
//   b  cold    — tài khoản mới tinh, 0 lượt nộp => dashboard cold-start
//   c1 prereq  — sai câu 'nguyen-ham' => reasonCode 'prerequisite-gate'
//   c2 lowest  — đúng câu 'ham-so-bac-hai' => reasonCode 'lowest-mastery'
//   c3 recent  — sai câu 'he-thuc-luong-tam-giac' => reasonCode 'recently-wrong'
//
//   Vì sao ba kịch bản c chỉ cần 1 câu hỏi mỗi cái: recommendNextSkill() xét
//   TOÀN BỘ 20 node, node không có dòng mastery mặc định ratio 0. Nên trạng
//   thái của đúng một node là đủ để lái nhánh reasonCode — xem bảng suy luận
//   trong EXPECTED_REASON_CODE bên dưới. Ba tài khoản riêng thay vì một tài
//   khoản đổi trạng thái ba lần: kiểm thủ công phải mở được cả ba cùng lúc.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { computeScore } from "../lib/scoring/computeScore";
import { recommendNextSkill, type RouteReasonCode } from "../lib/adaptive/route";
import { MASTERY_CLEARED_THRESHOLD } from "../lib/adaptive/constants";
import type { Question } from "../types/question";

// --- Nạp env từ .env.local (tsx không tự load như Next.js) -----------------
// Bóc cặp nháy bao ngoài: vài giá trị trong file được ghi có nháy và Next tự
// bóc khi nó nạp, giữ nguyên ở đây sẽ dựng client bằng URL sai.
function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
  }
  return env;
}

// --- Hằng số fixture -------------------------------------------------------

const PREFIX = "e1mp-";
const PASSWORD = "rls-test-password-123"; // mật khẩu chung của các tài khoản test

/** Câu hỏi THẬT đã gắn thẻ kỹ năng trên dev — chọn toàn mcq để chắc chắn
 *  `scored: true` và để ExplainStepAffordance có nhánh mount (mcq/short_answer). */
const Q_HAM_SO_BAC_HAI = "q-t10-3"; // đáp án đúng: A
const Q_CUC_TRI = "ugc-20c3b8f7-c24e-473b-afb0-01250aa11c36-p1q1"; // đúng: C
const Q_HE_THUC_LUONG = "ugc-20c3b8f7-c24e-473b-afb0-01250aa11c36-p1q2"; // đúng: A
const Q_NGUYEN_HAM = "ugc-e3048c6e-cea7-46ed-abd5-0fa07a92f0c8-p1q4"; // đúng: A

interface Scenario {
  key: string;
  email: string;
  examId: string;
  examTitle: string;
  questionIds: string[];
  /** Đáp án nộp. Lặp lại `submissions` lần, mỗi lần một attempt riêng. */
  answers: Record<string, string>;
  submissions: number;
  /** null = không kiểm (kịch bản tutor không nhắm tới reasonCode nào cả). */
  expectedReasonCode: RouteReasonCode | null;
  note: string;
}

/** Suy luận reasonCode kỳ vọng — TỰ TÍNH từ DAG ở lib/adaptive/skillTaxonomy.ts,
 *  KHÔNG lấy ra từ hàm đang được kiểm chứng (testing-principles):
 *
 *  c1 prereq: mastery {nguyen-ham 0/1, lastWrong≠null}. nguyen-ham là node duy
 *     nhất có ratio 0 KÈM lastWrongAt nên nó đứng đầu sortKey. Chưa cleared
 *     (tiên quyết tinh-don-dieu-cuc-tri = 0) → đi xuống tinh-don-dieu-cuc-tri
 *     (tiên quyết ham-so-bac-hai = 0) → đi xuống ham-so-bac-hai (không tiên
 *     quyết → cleared). substituted = true ⇒ 'prerequisite-gate'.
 *  c2 lowest: mastery {ham-so-bac-hai 1/1}. Mọi node còn lại ratio 0 +
 *     lastWrongAt null ⇒ thắng theo id ASC = 'bpt-bac-hai-mot-an', tiên quyết
 *     duy nhất của nó là ham-so-bac-hai = 1.0 ≥ 0.7 ⇒ cleared, không thay thế,
 *     lastWrongAt null nên không phải recency ⇒ 'lowest-mastery'.
 *  c3 recent: mastery {he-thuc-luong-tam-giac 0/1, lastWrong≠null}. Ratio 0 +
 *     lastWrongAt ≠ null ⇒ đứng trước nhóm ratio-0/null. Không có tiên quyết ⇒
 *     cleared, substituted = false; có node khác cùng ratio 0 với lastWrongAt
 *     khác (null) ⇒ tieBrokenByRecency ⇒ 'recently-wrong'.
 */
const SCENARIOS: Scenario[] = [
  {
    key: "tutor",
    email: "smithnguyen247+e1tutor@gmail.com",
    examId: `${PREFIX}exam-tutor`,
    examTitle: "[e1-manual-pass] Đề kiểm gia sư (sai 2 lần)",
    questionIds: [Q_HAM_SO_BAC_HAI, Q_CUC_TRI, Q_HE_THUC_LUONG],
    // Sai Q_HAM_SO_BAC_HAI (đúng A) và Q_CUC_TRI (đúng C) ở CẢ HAI lần nộp →
    // hai câu này thoả ngưỡng "sai trên ≥2 attempt khác nhau". Q_HE_THUC_LUONG
    // đúng cả hai lần → chứng minh affordance KHÔNG mọc ở câu làm đúng.
    answers: { [Q_HAM_SO_BAC_HAI]: "B", [Q_CUC_TRI]: "A", [Q_HE_THUC_LUONG]: "A" },
    submissions: 2,
    expectedReasonCode: null,
    note: "Task 16(a) — 2 câu hasBeenWrongTwice, 1 câu đúng làm đối chứng",
  },
  {
    key: "cold",
    email: "smithnguyen247+e1cold@gmail.com",
    examId: "",
    examTitle: "",
    questionIds: [],
    answers: {},
    submissions: 0,
    expectedReasonCode: null,
    note: "Task 16(b) — tài khoản chưa nộp bài lần nào, dashboard cold-start",
  },
  {
    key: "prereq",
    email: "smithnguyen247+e1prereq@gmail.com",
    examId: `${PREFIX}exam-prereq`,
    examTitle: "[e1-manual-pass] Đề nguyên hàm (sai)",
    questionIds: [Q_NGUYEN_HAM],
    answers: { [Q_NGUYEN_HAM]: "B" }, // đúng là A
    submissions: 1,
    expectedReasonCode: "prerequisite-gate",
    note: "Task 16(c) — kỳ vọng gợi ý lùi về 'Hàm số bậc hai'",
  },
  {
    key: "lowest",
    email: "smithnguyen247+e1lowest@gmail.com",
    examId: `${PREFIX}exam-lowest`,
    examTitle: "[e1-manual-pass] Đề hàm số bậc hai (đúng)",
    questionIds: [Q_HAM_SO_BAC_HAI],
    answers: { [Q_HAM_SO_BAC_HAI]: "A" }, // đúng
    submissions: 1,
    expectedReasonCode: "lowest-mastery",
    note: "Task 16(c) — kỳ vọng gợi ý 'Bất phương trình bậc hai một ẩn'",
  },
  {
    key: "recent",
    email: "smithnguyen247+e1recent@gmail.com",
    examId: `${PREFIX}exam-recent`,
    examTitle: "[e1-manual-pass] Đề hệ thức lượng (sai)",
    questionIds: [Q_HE_THUC_LUONG],
    answers: { [Q_HE_THUC_LUONG]: "B" }, // đúng là A
    submissions: 1,
    expectedReasonCode: "recently-wrong",
    note: "Task 16(c) — kỳ vọng gợi ý 'Hệ thức lượng trong tam giác'",
  },
];

const FIXTURE_EXAM_IDS = SCENARIOS.map((s) => s.examId).filter(Boolean);

// --- Hạ tầng ---------------------------------------------------------------

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY trong .env.local"
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Tạo (hoặc reset mật khẩu) user đã confirm — mirror test-rls.ts / int test. */
async function ensureUser(email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (!created.error) return created.data.user.id;

  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((u) => u.email === email);
  if (!existing) throw created.error;
  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (updated.error) throw updated.error;
  return existing.id;
}

/** Xoá mọi thứ script này từng tạo, trừ chính các tài khoản (giữ để đăng nhập
 *  lại bằng cùng email/mật khẩu ở lần chạy sau). Thứ tự: attempt → exam, và
 *  mastery/telemetry theo user_id. */
async function cleanup(userIds: string[]): Promise<void> {
  if (FIXTURE_EXAM_IDS.length > 0) {
    const del = await admin.from("exam_attempts").delete().in("exam_id", FIXTURE_EXAM_IDS);
    if (del.error) throw del.error;
    const delExam = await admin.from("exams").delete().in("id", FIXTURE_EXAM_IDS);
    if (delExam.error) throw delExam.error;
  }
  if (userIds.length > 0) {
    const delMastery = await admin.from("user_skill_mastery").delete().in("user_id", userIds);
    if (delMastery.error) throw delMastery.error;
    const delTel = await admin.from("telemetry_log").delete().in("user_id", userIds);
    if (delTel.error) throw delTel.error;
    // Lượt nộp trên đề KHÁC (nếu ai đó đã dùng tay các tài khoản này) — phải
    // xoá nốt, không thì computeWrongTwiceQuestionIds() và mastery đếm lẫn.
    const delOther = await admin.from("exam_attempts").delete().in("user_id", userIds);
    if (delOther.error) throw delOther.error;
  }
}

/** Đề fixture trỏ tới các câu hỏi THẬT đã gắn thẻ. published vì exam_answer_key()
 *  (§10a nhánh 2) chỉ trả đáp án cho đề đã published — đúng đường production. */
async function ensureExam(s: Scenario): Promise<void> {
  const { error } = await admin.from("exams").insert({
    id: s.examId,
    title: s.examTitle,
    question_ids: s.questionIds,
    duration_minutes: 15,
    subject: "Math",
    grade: 12,
    status: "published",
  });
  if (error) throw error;
}

/** Lặp lại bước 3→7 của submitExam() — xem khối chú thích đầu file. */
async function submitOnce(
  student: SupabaseClient,
  userId: string,
  s: Scenario
): Promise<{ attemptId: string; score: number }> {
  const attempt = await student
    .from("exam_attempts")
    .insert({ exam_id: s.examId, user_id: userId, status: "in_progress" })
    .select("id")
    .single();
  if (attempt.error) throw attempt.error;
  const attemptId = attempt.data.id as string;

  const claim = await student.rpc("claim_attempt_answer_key", { p_attempt_id: attemptId });
  if (claim.error) throw claim.error;
  const rows = (claim.data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) throw new Error(`claim_attempt_answer_key trả 0 dòng cho ${attemptId}`);

  const byId = new Map<string, Question>(
    rows.map((r) => [
      r.id as string,
      {
        id: r.id as string,
        content: r.content as string,
        choices: r.choices as Question["choices"],
        correctAnswer: r.correct_answer as Question["correctAnswer"],
        subject: r.subject as string,
        grade: r.grade as number,
        topic: r.topic as string,
        questionType: (r.question_type as Question["questionType"]) ?? "mcq",
        subAnswers: (r.sub_answers as Question["subAnswers"]) ?? undefined,
        essayAnswer: (r.essay_answer as string | null) ?? undefined,
      } satisfies Question,
    ])
  );
  const questions = s.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined);

  const ans = await student.from("attempt_answers").upsert(
    questions.map((q) => ({
      attempt_id: attemptId,
      question_id: q.id,
      answer: s.answers[q.id]?.slice(0, 500) ?? null,
    })),
    { onConflict: "attempt_id,question_id" }
  );
  if (ans.error) throw ans.error;

  const score = computeScore(questions, s.answers);

  const res = await admin.rpc("record_exam_result", {
    p_attempt_id: attemptId,
    p_total_score: score.totalScore,
    p_correct: score.correct,
    p_total: score.total,
    p_per_question: score.perQuestion,
    p_topic_breakdown: score.topicBreakdown,
  });
  if (res.error) throw res.error;

  const mastery = await admin.rpc("record_skill_mastery", {
    p_attempt_id: attemptId,
    p_per_question: score.perQuestion,
  });
  if (mastery.error) throw mastery.error;

  return { attemptId, score: score.totalScore };
}

/** Hậu kiểm: đọc lại DAG + mastery THẬT từ DB và chạy recommendNextSkill() để
 *  xác nhận kịch bản thật sự sinh ra reasonCode đã ghi trong bảng suy luận. Nếu
 *  lệch, seed coi như hỏng — Task 18 sẽ đi kiểm một thứ không tồn tại. */
async function verifyRecommendation(userId: string, expected: RouteReasonCode): Promise<string> {
  const [nodesRes, edgesRes, masteryRes] = await Promise.all([
    admin.from("skill_nodes").select("id, label_vi"),
    admin.from("skill_prerequisites").select("skill_node_id, prerequisite_node_id"),
    admin
      .from("user_skill_mastery")
      .select("skill_node_id, correct_count, total_count, last_wrong_at")
      .eq("user_id", userId),
  ]);
  if (nodesRes.error) throw nodesRes.error;
  if (edgesRes.error) throw edgesRes.error;
  if (masteryRes.error) throw masteryRes.error;

  const result = recommendNextSkill({
    nodes: (nodesRes.data ?? []).map((n) => ({ id: n.id as string, labelVi: n.label_vi as string })),
    edges: (edgesRes.data ?? []).map((e) => ({
      skillNodeId: e.skill_node_id as string,
      prerequisiteNodeId: e.prerequisite_node_id as string,
    })),
    mastery: (masteryRes.data ?? []).map((m) => ({
      skillNodeId: m.skill_node_id as string,
      correctCount: m.correct_count as number,
      totalCount: m.total_count as number,
      lastWrongAt: (m.last_wrong_at as string | null) ?? null,
    })),
    threshold: MASTERY_CLEARED_THRESHOLD,
  });

  if (!result) throw new Error(`Kỳ vọng reasonCode '${expected}' nhưng nhận null (cold start)`);
  if (result.reasonCode !== expected) {
    throw new Error(
      `reasonCode lệch: kỳ vọng '${expected}', nhận '${result.reasonCode}' (node ${result.nodeId})`
    );
  }
  return `${result.labelVi} [${result.reasonCode}]`;
}

async function main(): Promise<void> {
  const cleanupOnly = process.argv.includes("--cleanup");

  console.log(`Supabase: ${SUPABASE_URL}`);
  const userIds = new Map<string, string>();
  for (const s of SCENARIOS) userIds.set(s.key, await ensureUser(s.email));

  await cleanup([...userIds.values()]);
  if (cleanupOnly) {
    console.log("✓ Đã xoá sạch fixture (tài khoản giữ nguyên).");
    return;
  }

  for (const s of SCENARIOS) {
    const userId = userIds.get(s.key)!;
    if (s.submissions === 0) {
      console.log(`\n[${s.key}] ${s.email}\n  ${s.note}\n  → 0 lượt nộp (cold start)`);
      continue;
    }

    await ensureExam(s);
    const student = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signIn = await student.auth.signInWithPassword({ email: s.email, password: PASSWORD });
    if (signIn.error) throw signIn.error;

    console.log(`\n[${s.key}] ${s.email}\n  ${s.note}`);
    for (let i = 0; i < s.submissions; i += 1) {
      const { attemptId, score } = await submitOnce(student, userId, s);
      console.log(`  → lượt ${i + 1}/${s.submissions}: ${score.toFixed(2)}/10  attempt ${attemptId}`);
      console.log(`     /exams/${s.examId}/attempt/${attemptId}/result/detail`);
    }

    if (s.expectedReasonCode) {
      const label = await verifyRecommendation(userId, s.expectedReasonCode);
      console.log(`  ✓ gợi ý dashboard: ${label}`);
    }
  }

  console.log(`\n✓ Xong. Mật khẩu chung: ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
