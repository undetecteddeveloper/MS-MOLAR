// Verify schema drift (Security review 2026-08-03, TECH-DEBT TD-001/TD-005).
//
// schema.sql được paste tay vào Supabase SQL Editor — không có migration tool,
// nên KHÔNG có gì bảo đảm DB đang chạy khớp với schema.sql trong git. Script này
// đóng đúng khoảng hở đó cho phần NHẠY CẢM NHẤT: khoá đáp án (§10).
//
// Nó KHÔNG đọc DDL từ DB (Supabase không cho client chạy SQL tuỳ ý). Nó so
// schema.sql — nguồn chân lý duy nhất — với HÀNH VI THẬT của DB, quan sát bằng
// đúng những credential mà production dùng:
//
//   1. Cột thật của public.questions   <- OpenAPI spec (service_role thấy đủ 12 cột)
//   2. Cột được phép đọc               <- parse `grant select (...)` trong schema.sql
//   3. Cột đáp án được phép đi ra      <- parse `returns table (...)` của exam_answer_key
//   4. Mỗi cột được probe bằng một user THẬT (anon key + đăng nhập): cột an toàn
//      phải đọc được, cột đáp án phải trả 42501.
//   5. Hai RPC phải tồn tại và authenticated phải gọi được.
//   6. `on delete` của MỌI khoá ngoại  <- catalog thật, qua RPC §16a (TD-011)
//   7. DB đang chạy BẢN NÀO của schema.sql <- vân tay §17 (TD-005)
//   8. Mọi `subject` nằm trong SUBJECTS    <- dữ liệu, không phải cấu trúc (TD-016)
//   9. Client KHÔNG ghi được vào tiền      <- payment_orders / subscriptions /
//      record_payment_settlement, mỗi đối tượng một lệnh bị TỪ CHỐI (ADR-0013/
//      ADR-0014, AC-033). Trước mục này, ba đối tượng đó không được cổng nào
//      quan sát ngoài vân tay (7) — mà vân tay chỉ nói file khớp file.
//
// (1)–(6) soi từng mảnh cụ thể, và chỉ bắt được đúng những thứ đã từng hỏng.
// (7) soi phần còn lại: gộp toàn bộ file thành một vân tay, nên một bản vá nằm
// trong git mà chưa chạy trên DB sẽ lộ ra dù nó chạm vào chỗ nào. Đó chính là
// chuyện đã xảy ra 2026-08-04 → 08-07: bản vá cascade áp lên prod, quên dev, và
// (1)–(6) trên dev vẫn xanh vì chúng không biết phải hỏi về mảnh đó.
//
// (6) là ngoại lệ có chủ đích với "không đọc DDL từ DB": nó KHÔNG suy từ hành vi
// mà đọc thẳng pg_constraint qua một hàm chỉ-đọc chỉ service_role gọi được. Đây
// là khoảng hở đã để lọt bug xoá đề 2026-08-04 — thiếu `on delete cascade` là
// loại lệch mà mọi cổng khác (tsc, vitest, các mục 1–5) đều mù.
//
// Vì (1) lấy từ DB chứ không hard-code, THÊM CỘT MỚI vào questions mà quên phân
// loại sẽ làm script FAIL kèm hướng dẫn — thay vì lặng lẽ trở thành trang trắng
// 42501 ở production vài tuần sau (TD-001).
//
// Script KHÔNG ĐỂ LẠI DỮ LIỆU, kể cả khi FAIL — và đó là một mệnh đề mạnh hơn
// "chỉ đọc", vì nó không còn đúng theo nghĩa đen: (5) tạo một đề nháp fixture
// rồi tự dọn trong `finally`, và (9) PHÁT ra ba lệnh ghi mà mọi lệnh đều PHẢI
// bị từ chối ở tầng quyền, kèm hậu kiểm bằng service_role rằng không dòng nào
// lọt vào. Nhánh PASS sạch vì không có gì được ghi; nhánh FAIL sạch vì dòng lọt
// vào bị XOÁ theo marker của chính probe NGAY TRƯỚC khi lời khẳng định được
// báo — nếu không, đúng lượt chạy phát hiện DB hỏng lại là lượt để lại một đơn
// hàng thật và một entitlement sống. Không có DDL ở bất kỳ đâu, và mọi RPC được
// probe bằng id không tồn tại nên không khoá attempt của ai, không settle đơn
// của ai.
//
// NGOẠI LỆ DUY NHẤT, và là lý do lane này CHƯA được chĩa vào production:
// `signInProbeUser()` tạo-hoặc-đặt-lại-password tài khoản probe, nên tài khoản
// đó TỒN TẠI LẠI sau khi script chạy xong. Xem cảnh báo ở đầu mục 9.
//
// Cách chạy:  cd SOURCE && npx tsx supabase/verify-schema.ts
// Chạy khi:   sau mỗi lần apply schema.sql, và trước khi deploy code đụng §10.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fkKey, resolveForeignKeys } from "../lib/schema/parseForeignKeys";
import { SUBJECTS, normalizeSubject } from "../lib/ugc/subjects";
import {
  SCHEMA_FINGERPRINT,
  computeSchemaFingerprint,
  parseDeclaredFingerprint,
} from "../lib/schema/schemaFingerprint";

/** Một dòng của `public.schema_foreign_keys()` (§16a). */
interface DbForeignKey {
  constraint_name: string;
  child_schema: string;
  child_table: string;
  child_columns: string[];
  parent_schema: string;
  parent_table: string;
  parent_columns: string[];
  on_delete: string;
  on_update: string;
}

/**
 * Đọc env từ `.env.local`, hoặc từ file khác nếu đặt `SCHEMA_ENV_FILE`.
 *
 * Có cái override này vì script cần chạy được với TỪNG môi trường: dự án có 2
 * Supabase project (dev + prod) và TD-005 sinh ra chính từ việc một bản vá chỉ
 * được áp lên một trong hai. Trước đây kiểm prod phải đổi tên file `.env.local`
 * qua lại bằng tay — một thao tác vừa dễ quên bước đổi ngược, vừa để lại cây
 * làm việc trỏ nhầm DB nếu lệnh giữa chừng hỏng. Nay:
 *
 *   SCHEMA_ENV_FILE=.env.local.prod-backup npm run verify:schema
 */
function loadEnv(): Record<string, string> {
  const file = process.env.SCHEMA_ENV_FILE?.trim() || ".env.local";
  const raw = readFileSync(resolve(__dirname, "..", file), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    // Bóc nháy bao ngoài: `vercel env pull` ghi giá trị dạng "..." trong khi
    // các biến gõ tay thì không, nên một file .env.local có thể trộn cả hai.
    // Parser của Next tự bóc; parser tối giản ở đây thì không, và hệ quả là một
    // URL kèm nháy đi thẳng vào client rồi hỏng ở chỗ chẳng nhắc gì tới env.
    env[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

// Tài khoản probe — dùng chung với test-rls.ts (cùng cặp email/password), tạo
// qua Admin API nếu chưa có. Chỉ cần MỘT JWT `authenticated` bất kỳ: lỗi phân
// quyền cột được Postgres ném lúc PLAN query, trước khi RLS lọc dòng, nên script
// không cần fixture dữ liệu nào.
const PROBE_EMAIL = "smithnguyen247+rlstesta@gmail.com";
const PROBE_PASSWORD = "rls-test-password-123";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.error(`  ✗ ${msg}`);
    failures += 1;
  }
}

/** Lỗi trả về có thuộc hạng QUYỀN hay không — bản chép NGUYÊN VẸN vị từ ở
 *  `supabase/test-rls.ts` (§ `isAuthorizationDenial`). Chép chứ không import vì
 *  test-rls.ts là một script chạy thẳng, không export gì; đổi một bên mà quên
 *  bên kia là làm hai cổng nói hai chuyện khác nhau về cùng một DDL.
 *
 *  ĐÂY LÀ CHỖ MỤC 9 SỐNG HOẶC CHẾT, cùng bài học đã viết ở mục 4: một lệnh ghi
 *  bị từ chối vì thiếu cột NOT NULL (23502), sai khoá ngoại (23503), trùng khoá
 *  (23505) hay sai kiểu (22P02) cũng "thất bại", và một khẳng định `error !== null`
 *  sẽ XANH trong khi `revoke` đã bị gỡ mất. Chỉ 42501 (permission denied cho
 *  bảng, do `revoke`) và thông báo vi phạm row-level security (do KHÔNG có
 *  policy ghi) mới là "bị TỪ CHỐI CẤP QUYỀN"; mọi mã ràng buộc đều bị loại. */
function isAuthorizationDenial(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42501" ||
    /permission denied|violates row-level security policy/i.test(error.message ?? "")
  );
}

/**
 * Mô tả kết quả QUÉT RÁC của một probe mục 9, để ghép vào thông điệp FAIL.
 *
 * `null` = hậu kiểm thấy sạch nên không có gì để xoá. Ngược lại là kết quả của
 * lệnh `delete` theo marker: người đọc log cần biết NGAY dòng lọt vào đã biến
 * mất hay vẫn còn, vì nếu vẫn còn thì đó là một entitlement/đơn hàng thật đang
 * nằm trong DB dưới tên tài khoản probe.
 */
function describeSweep(sweep: { error: { code?: string; message?: string } | null } | null): string {
  if (sweep === null) return "không có gì để quét";
  return sweep.error
    ? `QUÉT HỎNG (${sweep.error.code ?? sweep.error.message ?? "?"}) — RÁC CÒN NGUYÊN, phải xoá tay`
    : "đã quét sạch bằng service_role";
}

// --- Parse schema.sql (nguồn chân lý) --------------------------------------

/** Cột được cấp lại sau REVOKE, từ `grant select (...) on public.questions`. */
function parseGrantedColumns(sql: string): string[] {
  const m = /grant\s+select\s*\(([\s\S]*?)\)\s*on\s+public\.questions/i.exec(sql);
  if (!m) throw new Error("schema.sql: không tìm thấy `grant select (...) on public.questions` (§10c)");
  return m[1]
    .split(",")
    .map((c) => c.replace(/--.*$/gm, "").trim())
    .filter(Boolean);
}

/** Cột mà exam_answer_key() trả ra, từ `returns table (...)` của chính nó. */
function parseAnswerKeyColumns(sql: string): string[] {
  const m = /create\s+function\s+public\.exam_answer_key[\s\S]*?returns\s+table\s*\(([\s\S]*?)\)\s*language/i.exec(
    sql
  );
  if (!m) throw new Error("schema.sql: không tìm thấy `create function public.exam_answer_key ... returns table (...)` (§10a)");
  return m[1]
    .split(",")
    .map((c) => c.replace(/--.*$/gm, "").trim().split(/\s+/)[0])
    .filter(Boolean);
}

// --- Đọc cột thật của DB ---------------------------------------------------

/** Cột thật của public.questions, qua OpenAPI spec (endpoint này chỉ nhận
 *  service_role, và service_role thấy đủ mọi cột bất kể GRANT). */
async function fetchActualColumns(url: string, serviceKey: string): Promise<string[]> {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error(`OpenAPI spec: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const spec = (await res.json()) as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
  };
  const props = spec.definitions?.questions?.properties;
  if (!props) throw new Error("OpenAPI spec: không thấy bảng `questions`");
  return Object.keys(props);
}

/** Client đã đăng nhập bằng ANON key — đúng vai mà browser/Server Action dùng. */
async function signInProbeUser(
  url: string,
  anon: string,
  service: string
): Promise<SupabaseClient> {
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const created = await admin.auth.admin.createUser({
    email: PROBE_EMAIL,
    password: PROBE_PASSWORD,
    email_confirm: true,
  });
  if (created.error) {
    // Đã tồn tại (trường hợp thường gặp — test-rls.ts tạo trước) → đảm bảo
    // password/confirm còn đúng để đăng nhập được.
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (list.error) throw list.error;
    const existing = list.data.users.find((u) => u.email === PROBE_EMAIL);
    if (!existing) throw created.error;
    const upd = await admin.auth.admin.updateUserById(existing.id, {
      password: PROBE_PASSWORD,
      email_confirm: true,
    });
    if (upd.error) throw upd.error;
  }
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: PROBE_EMAIL,
    password: PROBE_PASSWORD,
  });
  if (error) throw error;
  return client;
}

// --- Main ------------------------------------------------------------------

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service)
    throw new Error("Thiếu URL / ANON_KEY / SERVICE_ROLE_KEY trong .env.local");

  const schemaSql = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  const granted = parseGrantedColumns(schemaSql);
  const answerKeyOut = parseAnswerKeyColumns(schemaSql);
  const actual = await fetchActualColumns(url, service);
  const probe = await signInProbeUser(url, anon, service);

  console.log(`\nschema.sql: ${granted.length} cột an toàn, exam_answer_key trả ${answerKeyOut.length} cột`);
  console.log(`DB thật:    public.questions có ${actual.length} cột\n`);

  // ==========================================================================
  // 1. Phân loại cột — không cột nào được rơi ra ngoài (TD-001)
  // ==========================================================================
  console.log("Phân loại cột (schema.sql vs DB thật):");

  const sensitive = actual.filter((c) => !granted.includes(c));

  // Cột vừa không được cấp SELECT, vừa không đi qua exam_answer_key = KHÔNG
  // đường nào đọc được. Gần như chắc chắn là cột mới bị quên phân loại.
  const orphans = sensitive.filter((c) => !answerKeyOut.includes(c));
  assert(
    orphans.length === 0,
    orphans.length === 0
      ? "Mọi cột của questions đều có đường đọc (được GRANT, hoặc đi qua exam_answer_key)"
      : `Cột KHÔNG có đường đọc nào: ${orphans.join(", ")} — thêm vào \`grant select (...)\` §10c nếu an toàn, hoặc vào \`returns table\` của exam_answer_key §10a nếu là đáp án`
  );

  // Cột khai trong schema.sql nhưng DB không có (đổi tên / gõ sai).
  const phantom = granted.filter((c) => !actual.includes(c));
  assert(
    phantom.length === 0,
    phantom.length === 0
      ? "Mọi cột trong GRANT của schema.sql đều tồn tại thật trên bảng"
      : `GRANT nhắc tới cột không tồn tại: ${phantom.join(", ")}`
  );

  console.log(`     an toàn : ${granted.join(", ")}`);
  console.log(`     đáp án  : ${sensitive.join(", ") || "(không có — REVOKE chưa được apply?)"}`);

  // ==========================================================================
  // 2. Hành vi thật của DB có khớp với phân loại đó không
  // ==========================================================================
  console.log("\nProbe quyền cột bằng JWT `authenticated` thật:");

  const denied: string[] = [];
  const readable: string[] = [];
  for (const col of actual) {
    const { error } = await probe.from("questions").select(col).limit(1);
    (error ? denied : readable).push(col);
  }

  const leaked = sensitive.filter((c) => readable.includes(c));
  assert(
    leaked.length === 0,
    leaked.length === 0
      ? `Cột đáp án KHÔNG đọc được qua REST (${sensitive.join(", ")}) — Critical #1 đang đóng`
      : `LỖ HỔNG MỞ: học sinh đọc được ${leaked.join(", ")} qua REST — schema.sql §10c chưa được apply?`
  );

  const brokenSafe = granted.filter((c) => denied.includes(c));
  assert(
    brokenSafe.length === 0,
    brokenSafe.length === 0
      ? "Cột an toàn vẫn đọc được bình thường (REVOKE không khoá nhầm)"
      : `Cột đáng lẽ đọc được nhưng bị chặn: ${brokenSafe.join(", ")} — app sẽ lỗi 42501`
  );

  // ==========================================================================
  // 3. Hai hàm SECURITY DEFINER đã có mặt và gọi được (TD-005)
  // ==========================================================================
  console.log("\nProbe RPC (id không tồn tại — không đụng dữ liệu ai):");

  const ak = await probe.rpc("exam_answer_key", { p_exam_id: "__verify_schema_no_such_exam__" });
  assert(
    !ak.error && Array.isArray(ak.data),
    ak.error
      ? `exam_answer_key không gọi được: ${ak.error.code ?? ""} ${ak.error.message} — apply schema.sql §10a`
      : "exam_answer_key tồn tại và authenticated gọi được"
  );

  const ck = await probe.rpc("claim_attempt_answer_key", {
    p_attempt_id: "00000000-0000-0000-0000-000000000000",
  });
  assert(
    !ck.error && Array.isArray(ck.data),
    ck.error
      ? `claim_attempt_answer_key không gọi được: ${ck.error.code ?? ""} ${ck.error.message} — apply schema.sql §10b`
      : "claim_attempt_answer_key tồn tại và authenticated gọi được"
  );

  // ==========================================================================
  // 4. §11 — client không ghi được điểm (Critical #2)
  // ==========================================================================
  console.log("\nProbe quyền ghi exam_results (attempt_id không tồn tại — không ghi được gì):");

  const NO_SUCH_ATTEMPT = "00000000-0000-0000-0000-000000000000";

  // Mã lỗi là thứ phải soi, không phải "có lỗi hay không": attempt_id giả sẽ
  // làm insert hỏng vì FK (23503) NGAY CẢ KHI quyền INSERT vẫn còn. Chỉ 42501
  // (permission denied) mới chứng minh client đã mất quyền ghi.
  const ins = await probe.from("exam_results").insert({
    attempt_id: NO_SUCH_ATTEMPT,
    total_score: 10,
    correct: 40,
    total: 40,
    per_question: [],
    topic_breakdown: [],
  });
  assert(
    ins.error?.code === "42501",
    ins.error?.code === "42501"
      ? "authenticated KHÔNG còn quyền INSERT exam_results (42501) — Critical #2 đang đóng"
      : `authenticated VẪN ghi được exam_results (lỗi nhận được: ${ins.error?.code ?? "không có lỗi"}${ins.error?.code === "23503" ? " = chỉ vướng khoá ngoại, quyền INSERT vẫn còn" : ""}) — apply schema.sql §11a`
  );

  // Lại là chuyện MÃ LỖI. attempt_id giả làm hàm raise check_violation (23514)
  // NGAY CẢ KHI EXECUTE vẫn còn — nên "có lỗi" không chứng minh được gì. Chỉ
  // 42501 mới nghĩa là bị chặn ngay ở cửa hàm.
  // (Bản đầu của check này nhận mọi mã != PGRST202 và đã bỏ lọt đúng lỗi đó:
  //  Supabase default privileges cấp sẵn EXECUTE cho anon/authenticated, mà
  //  `revoke from public` không gỡ được — xem §10b.)
  const rer = await probe.rpc("record_exam_result", {
    p_attempt_id: NO_SUCH_ATTEMPT,
    p_total_score: 10,
    p_correct: 40,
    p_total: 40,
    p_per_question: [],
    p_topic_breakdown: [],
  });
  assert(
    rer.error?.code === "42501",
    rer.error?.code === "42501"
      ? "record_exam_result KHÔNG gọi được bằng JWT học sinh (42501) — EXECUTE chỉ service_role"
      : rer.error?.code === "PGRST202"
        ? "record_exam_result chưa tồn tại — apply schema.sql §11b"
        : `authenticated VẪN gọi được record_exam_result (chạy tới thân hàm, mã ${rer.error?.code ?? "không có lỗi"}) — thiếu \`revoke ... from anon, authenticated\` ở §11b`
  );

  // change_support_ticket_status — cùng lớp EXECUTE-chỉ-service_role như
  // record_exam_result ở trên (User Support System v1, Design Doc § Schema
  // & DB Enforcement §4). id giả nên không đụng ticket của ai.
  const csts = await probe.rpc("change_support_ticket_status", {
    p_ticket_id: "00000000-0000-0000-0000-000000000000",
    p_status: "in_progress",
  });
  assert(
    csts.error?.code === "42501",
    csts.error?.code === "42501"
      ? "change_support_ticket_status KHÔNG gọi được bằng JWT học sinh (42501) — EXECUTE chỉ service_role"
      : csts.error?.code === "PGRST202"
        ? "change_support_ticket_status chưa tồn tại — apply schema.sql (Schema & DB Enforcement §4)"
        : `authenticated VẪN gọi được change_support_ticket_status (chạy tới thân hàm, mã ${csts.error?.code ?? "không có lỗi"}) — thiếu \`revoke ... from anon, authenticated\``
  );

  // §10 — hai hàm đáp án chỉ dành cho user đã đăng nhập. anon gọi được thì hiện
  // KHÔNG lộ gì (auth.uid() null → 0 dòng), nhưng đó là may chứ không phải thiết
  // kế: bề mặt tấn công thừa, và mọi thay đổi tương lai trong 2 hàm đó sẽ mặc
  // định phơi ra cho người chưa đăng nhập.
  console.log("\nProbe EXECUTE bằng anon key (chưa đăng nhập):");
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const [fn, args] of [
    ["exam_answer_key", { p_exam_id: "__verify_schema_no_such_exam__" }],
    ["claim_attempt_answer_key", { p_attempt_id: NO_SUCH_ATTEMPT }],
  ] as const) {
    const r = await anonClient.rpc(fn, args);
    assert(
      r.error?.code === "42501",
      r.error?.code === "42501"
        ? `anon KHÔNG gọi được ${fn} (42501)`
        : `anon VẪN gọi được ${fn} (mã ${r.error?.code ?? "không có lỗi"}) — thiếu \`revoke ... from anon\` ở §10b`
    );
  }

  // ==========================================================================
  // 5. §12 — view exams_with_difficulty không được vượt mặt RLS (Medium #4)
  // ==========================================================================
  console.log("\nProbe view exams_with_difficulty (fixture draft tạm, tự dọn):");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const PROBE_EXAM = "__verify_schema_draft_probe__";
  // Đề nháp KHÔNG tác giả: không user nào khớp nhánh author của
  // exams_select_visible, nên cả anon lẫn user thường đều phải thấy 0 dòng.
  await admin.from("exams").delete().eq("id", PROBE_EXAM);
  const seeded = await admin.from("exams").insert({
    id: PROBE_EXAM,
    title: "[verify-schema] draft probe",
    question_ids: [],
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    status: "draft",
  });
  if (seeded.error) throw new Error(`không tạo được fixture probe: ${seeded.error.message}`);

  try {
    const anonView = await anonClient
      .from("exams_with_difficulty")
      .select("id")
      .eq("id", PROBE_EXAM);
    const userView = await probe
      .from("exams_with_difficulty")
      .select("id")
      .eq("id", PROBE_EXAM);
    assert(
      (anonView.data?.length ?? 0) === 0 && (userView.data?.length ?? 0) === 0,
      (anonView.data?.length ?? 0) === 0 && (userView.data?.length ?? 0) === 0
        ? "Đề chưa published KHÔNG lộ qua view (RLS áp dụng — security_invoker đang bật)"
        : `Đề chưa published VẪN lộ qua view (anon: ${anonView.data?.length ?? 0} dòng, user: ${userView.data?.length ?? 0} dòng) — apply schema.sql §12b`
    );

    // Aggregate phải còn TOÀN CỤC. Bật security_invoker mà quên tách aggregate
    // ra hàm definer thì rating_count tụt về "chỉ rating của chính người xem" —
    // hỏng im lặng, không lỗi, chỉ sai số. So với service_role (thấy tất cả).
    const truth = await admin.from("exam_difficulty_ratings").select("exam_id");
    const counts = new Map<string, number>();
    for (const r of (truth.data ?? []) as { exam_id: string }[]) {
      counts.set(r.exam_id, (counts.get(r.exam_id) ?? 0) + 1);
    }
    const [ratedExam, expectedCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (ratedExam) {
      const seen = await probe
        .from("exams_with_difficulty")
        .select("rating_count")
        .eq("id", ratedExam)
        .maybeSingle();
      const got = (seen.data as { rating_count: number } | null)?.rating_count;
      assert(
        got === expectedCount,
        got === expectedCount
          ? `rating_count vẫn là aggregate TOÀN CỤC (${got} rating trên đề ${ratedExam})`
          : `rating_count sai: view trả ${got}, thực tế ${expectedCount} — aggregate đang bị RLS cắt (thiếu §12a) hoặc view chưa đúng`
      );
    }
  } finally {
    await admin.from("exams").delete().eq("id", PROBE_EXAM);
  }

  // ==========================================================================
  // 6. §15/§16 — hành vi `on delete` của MỌI khoá ngoại (TD-011)
  //
  // Đây là khoảng hở đã để lọt bug xoá đề 2026-08-04. Trước đây script không
  // thể chạm tới `on delete`: PostgREST không phơi information_schema, OpenAPI
  // spec chỉ nói CÓ khoá ngoại chứ không nói hành vi xoá, và cách duy nhất suy
  // ra từ hành vi là thật sự xoá một dòng cha — vi phạm nguyên tắc chỉ-đọc làm
  // script an toàn trên production. §16a mở một đường đọc catalog trực tiếp,
  // nên nay so được THẲNG với schema.sql thay vì suy đoán.
  //
  // Đối chiếu HAI CHIỀU là chỗ quan trọng: chiều "DB có mà schema.sql không
  // khai" vừa bắt được DB trôi khỏi file, vừa bắt được chính parser bị mù một
  // dạng cú pháp — lỗ hổng của công cụ biến thành báo động thay vì im lặng.
  // ==========================================================================
  console.log("\nĐối chiếu `on delete` của mọi khoá ngoại (schema.sql vs catalog thật):");

  const fkRes = await admin.rpc("schema_foreign_keys");
  if (fkRes.error) {
    assert(
      false,
      fkRes.error.code === "PGRST202"
        ? "schema_foreign_keys() chưa tồn tại — apply schema.sql §16a (không có nó thì `on delete` KHÔNG được kiểm bởi bất cứ cổng nào chạm tới DB)"
        : `schema_foreign_keys() không gọi được: ${fkRes.error.code ?? ""} ${fkRes.error.message}`
    );
  } else {
    const declared = resolveForeignKeys(schemaSql);
    const live = new Map<string, DbForeignKey>();
    for (const row of (fkRes.data ?? []) as DbForeignKey[]) {
      live.set(fkKey(`${row.child_schema}.${row.child_table}`, row.child_columns), row);
    }

    console.log(`     schema.sql khai ${declared.size} khoá ngoại, DB đang có ${live.size}`);

    // Khai trong file nhưng DB chưa có = file đã sửa, DB chưa apply. Chính xác
    // kiểu lệch mà TD-005 nói tới, chỉ khác là nay nhìn thấy được.
    const notApplied = [...declared.keys()].filter((k) => !live.has(k));
    assert(
      notApplied.length === 0,
      notApplied.length === 0
        ? "Mọi khoá ngoại khai trong schema.sql đều tồn tại thật trên DB"
        : `Khoá ngoại có trong schema.sql nhưng KHÔNG có trên DB: ${notApplied.join(", ")} — schema.sql chưa được apply`
    );

    const undeclared = [...live.keys()].filter((k) => !declared.has(k));
    assert(
      undeclared.length === 0,
      undeclared.length === 0
        ? "Mọi khoá ngoại trên DB đều có trong schema.sql (không có cái nào tạo tay ngoài file)"
        : `DB có khoá ngoại KHÔNG khai trong schema.sql: ${undeclared.join(", ")} — hoặc ai đó tạo tay trên dashboard, hoặc parser bỏ sót một dạng cú pháp (lib/schema/parseForeignKeys.ts)`
    );

    // Trái tim của TD-011: so từng hành vi xoá một.
    const mismatched: string[] = [];
    const implicit: string[] = [];
    for (const [key, fk] of declared) {
      const row = live.get(key);
      if (!row) continue; // đã báo ở notApplied
      if (fk.onDelete === null) {
        implicit.push(`${key} (DB đang: ${row.on_delete})`);
        continue;
      }
      if (fk.onDelete !== row.on_delete) {
        mismatched.push(`${key}: schema.sql nói \`${fk.onDelete}\`, DB đang \`${row.on_delete}\``);
      }
    }

    assert(
      implicit.length === 0,
      implicit.length === 0
        ? "Không khoá ngoại nào bỏ trống `on delete` trong schema.sql"
        : `schema.sql bỏ trống \`on delete\` ở: ${implicit.join("; ")} — viết rõ hành vi mong muốn (§16)`
    );

    assert(
      mismatched.length === 0,
      mismatched.length === 0
        ? `\`on delete\` của cả ${declared.size} khoá ngoại khớp schema.sql — TD-011 đang đóng`
        : `LỆCH \`on delete\`: ${mismatched.join(" | ")} — apply lại schema.sql (§15/§16). Lệch kiểu này KHÔNG lộ ra ở tsc/vitest, chỉ lộ khi có người dùng thật đi vào đường xoá`
    );

    // Chuỗi xoá đề: mắt xích nào không cascade là một lần 23503 cho tác giả.
    // Kiểm trên DB THẬT chứ không chỉ trên file — file đúng mà DB chưa apply
    // thì bug vẫn sống, đó đúng là chuyện đã xảy ra ngày 2026-08-04.
    const deleteChain = [
      "public.exam_attempts(exam_id)",
      "public.attempt_answers(attempt_id)",
      "public.attempt_answers(question_id)",
      "public.exam_results(attempt_id)",
      "public.exam_reports(exam_id)",
      "public.exam_difficulty_ratings(exam_id)",
      "public.exam_moderation_log(exam_id)",
      "public.support_ticket_notes(ticket_id)",
    ];
    const broken = deleteChain.filter((k) => live.get(k)?.on_delete !== "cascade");
    assert(
      broken.length === 0,
      broken.length === 0
        ? "Chuỗi xoá đề thông suốt trên DB thật: mọi bảng phái sinh đều cascade"
        : `Xoá đề SẼ HỎNG (23503) ở: ${broken.map((k) => `${k} = ${live.get(k)?.on_delete ?? "không tồn tại"}`).join(", ")} — đúng bug 2026-08-04`
    );
  }

  // ==========================================================================
  // 7. §17 — DB đang chạy bản schema.sql nào (TD-005)
  //
  // Sáu check ở trên đều soi MỘT mảnh cụ thể: quyền cột, RPC, `on delete`...
  // Chúng bắt được đúng những thứ đã từng hỏng, và không bắt được thứ chưa
  // từng. Check này soi mảnh còn lại: TOÀN BỘ file, gộp thành một vân tay.
  //
  // Vì sao cần, dù đã có 6 check kia: 2026-08-04 → 2026-08-07 bản vá cascade
  // được áp lên prod nhưng QUÊN dev. Lệch đó chỉ lộ ra vì tình cờ có người soi
  // hai DB cạnh nhau. Vân tay làm nó lộ ra ngay lượt verify đầu tiên.
  // ==========================================================================
  console.log("\nPhiên bản schema (§17, TD-005):");

  const declaredFp = parseDeclaredFingerprint(schemaSql);
  const computedFp = computeSchemaFingerprint(schemaSql);

  // Ba bên phải khớp: file tự khai, tính lại từ nội dung, và hằng số TS mà
  // server dùng lúc khởi động. Lệch ở đây là lỗi của REPO, chưa dính gì tới DB
  // — nói tách bạch để người đọc không đi paste SQL một cách vô ích.
  assert(
    declaredFp === computedFp && SCHEMA_FINGERPRINT === computedFp,
    declaredFp === computedFp && SCHEMA_FINGERPRINT === computedFp
      ? `schema.sql tự khai đúng vân tay của chính nó (${computedFp})`
      : `REPO lệch, chưa cần đụng DB — schema.sql khai \`${declaredFp}\`, hằng số TS là \`${SCHEMA_FINGERPRINT}\`, nội dung thật là \`${computedFp}\`. Sửa cả hai về ${computedFp} (chi tiết: npx vitest run lib/schema)`
  );

  const versionRes = await admin
    .from("schema_version")
    .select("fingerprint, applied_at")
    .eq("id", 1)
    .maybeSingle();

  if (versionRes.error) {
    // Bảng chưa tồn tại = §17 chưa hề chạy ở đây, tức DB ở một bản trước
    // 2026-08-07. Nói thẳng thế thay vì in mã lỗi PostgREST.
    const missing = versionRes.error.code === "42P01" || versionRes.error.code === "PGRST205";
    assert(
      false,
      missing
        ? "public.schema_version chưa tồn tại — DB đang ở bản TRƯỚC §17 (2026-08-07). Paste lại toàn bộ schema.sql."
        : `Không đọc được schema_version: ${versionRes.error.code ?? ""} ${versionRes.error.message}`
    );
  } else {
    const dbFp = versionRes.data?.fingerprint ?? null;
    assert(
      dbFp === computedFp,
      dbFp === computedFp
        ? `DB đang chạy đúng bản schema.sql trong git (${computedFp}, apply lúc ${versionRes.data?.applied_at})`
        : dbFp === null
          ? "schema_version RỖNG — lần paste schema.sql gần nhất đứt trước câu lệnh cuối. Paste lại toàn bộ file."
          : `DB đang ở bản \`${dbFp}\`, git đang ở \`${computedFp}\` — có bản vá trong git CHƯA chạy trên DB này. Đây đúng là hình dạng TD-005; paste lại toàn bộ schema.sql vào SQL Editor của môi trường này.`
    );
  }

  // ==========================================================================
  // 8. subject phải nằm trong SUBJECTS (TD-016)
  //
  // Khác mọi check trên: đây là DỮ LIỆU, không phải cấu trúc. Nó ở đây vì hình
  // dạng hỏng giống hệt TD-001/TD-005 — không mã lỗi, không log, chỉ THIẾU.
  // `subject` là text tự do (không enum, không FK), nên một giá trị lạ vẫn ghi
  // được và mọi filter/thống kê theo môn chỉ lặng lẽ bỏ sót nó.
  //
  // Đường ghi đã bịt ở validateExamMeta (2026-08-14), nhưng bịt code KHÔNG dọn
  // dữ liệu đã nằm sẵn trong DB, và không có gì bảo đảm đường ghi thứ N+1 sau
  // này cũng nhớ canonical hoá. Check này hỏi thẳng DB thay vì tin vào code.
  // ==========================================================================
  console.log("\nGiá trị subject (TD-016):");

  for (const table of ["questions", "exams"] as const) {
    const res = await admin.from(table).select("id, subject");
    if (res.error) {
      assert(false, `Không đọc được ${table}.subject: ${res.error.message}`);
      continue;
    }
    const canonical = new Set<string>(SUBJECTS);
    const bad = (res.data ?? []).filter((r) => !canonical.has(r.subject as string));
    const shown = bad
      .slice(0, 5)
      .map((r) => `${r.id}=${JSON.stringify(r.subject)}→${normalizeSubject(r.subject as string) ?? "KHÔNG MAP ĐƯỢC"}`)
      .join(", ");
    assert(
      bad.length === 0,
      bad.length === 0
        ? `${table}.subject: cả ${res.data?.length ?? 0} dòng đều canonical`
        : `${table}.subject có ${bad.length} dòng NGOÀI SUBJECTS — mọi filter/thống kê theo môn đang bỏ sót chúng: ${shown}${bad.length > 5 ? ", …" : ""}. Vá: supabase/one-off/2026-08-14-td016-canonical-subject.sql`
    );
  }

  // ==========================================================================
  // 9. SUBSCRIPTION — client KHÔNG ghi được vào tiền (ADR-0013/ADR-0014,
  //    PRD AC-033, khối SUBSCRIPTION của schema.sql)
  //
  // VÌ SAO MỤC NÀY TỒN TẠI: trước nó, `verify:schema` không nhắc tới
  // `payment_orders`, `subscriptions` hay `record_payment_settlement` một lần
  // nào — grep trả về rỗng. Thứ DUY NHẤT quan sát được ba đối tượng đó là vân
  // tay toàn file ở mục 7, mà một vân tay khớp KHÔNG nói gì về nội dung: nó chỉ
  // nói file trong git và file đã paste là một. Nếu ai đó `grant insert` tay
  // trên dashboard sau lượt paste, vân tay vẫn khớp từng byte. Vậy mà "gate B
  // xanh trên prod" lại là tiêu chí ra hàng CỦA CHÍNH khối này (plan Task 5.8).
  //
  // Ba lệnh dưới đây là BA ĐỐI TƯỢNG DDL, mỗi đối tượng một lệnh — cùng cách
  // chia mà `test-rls.ts` Phần 9 dùng (PO-* / SB-* / PS-*).
  //
  // ⚠ KHÔNG CHĨA LANE NÀY VÀO PRODUCTION, chừng nào nhánh tạo-hoặc-đặt-lại
  // password trong `signInProbeUser()` chưa được chặn. Lý do rất cụ thể:
  // `PROBE_EMAIL`/`PROBE_PASSWORD` là hằng nằm trong source ĐÃ COMMIT, và
  // `signInProbeUser()` không chỉ đăng nhập — nó TẠO tài khoản đó (hoặc đặt lại
  // password và `email_confirm` nếu đã có). Chạy trên prod nghĩa là tự tay cấp
  // cho auth tenant production một tài khoản ĐÃ XÁC THỰC với password ai đọc
  // repo cũng biết, và tài khoản đó ở lại sau khi script thoát. Việc "cả ba
  // lệnh đều bị từ chối" nói lên chất lượng của DDL, KHÔNG phải giấy phép chạy
  // trên prod — hai chuyện đó độc lập, và đây là chuyện chưa được quyết
  // (plan Task 5.8 / register: gate B trên prod bị chặn bởi đúng quyết định
  // này). Cho tới lúc đó: chỉ DEV.
  //
  // KHÔNG lệnh nào được phép GHI: cả ba phải bị từ chối ở tầng quyền. Hai payload đầu dùng
  // giá trị mốc riêng của verify-schema (khác hẳn bộ của test-rls.ts) và mỗi
  // lệnh có HẬU KIỂM bằng service_role theo một VỊ TỪ KHÁC vị từ đã dùng để
  // ghi — hỏi theo `memo` / `period_anchor_at` chứ không theo `order_code` /
  // `user_id` — vì một lệnh bị RLS chặn có thể trả "thành công rỗng", nên mã
  // lỗi một mình chưa bao giờ đủ. Lệnh thứ ba là RPC với một mã đơn KHÔNG TỒN
  // TẠI: `update … where order_code = … and status = 'pending'` khớp 0 dòng,
  // hàm rơi vào nhánh `if not found then return null` và dừng TRƯỚC lệnh insert
  // vào subscriptions — nên kể cả khi EXECUTE bị hở, nó vẫn là no-op.
  //
  // Payload thì ĐẦY ĐỦ và HỢP LỆ về mọi ràng buộc (đủ cột NOT NULL, `amount > 0`,
  // `status` trong CHECK, `user_id` là FK CÓ THẬT của chính phiên probe), và
  // khẳng định đi qua `isAuthorizationDenial()` chứ không qua `error !== null`.
  // Hai điều đó cùng nhau loại giả thuyết "bị từ chối vì DỮ LIỆU": 42501 được
  // Postgres ném lúc kiểm quyền, TRƯỚC khi ràng buộc nào được đánh giá.
  // ==========================================================================
  console.log("\nProbe quyền ghi khối SUBSCRIPTION (ADR-0013/0014 — mọi lệnh phải bị TỪ CHỐI):");

  const probeUserId = (await probe.auth.getUser()).data.user?.id ?? null;
  assert(
    probeUserId !== null,
    probeUserId !== null
      ? "Phiên probe có user_id thật — payload dưới đây trỏ vào một khoá ngoại CÓ THẬT"
      : "Không đọc được user_id của phiên probe — ba check dưới KHÔNG loại được giả thuyết 'bị chặn vì khoá ngoại'"
  );

  // Bộ giá trị mốc RIÊNG của verify-schema, cố ý khác dải của test-rls.ts
  // (9_900_000_000_00x) để hai script không bao giờ hậu kiểm trúng rác của nhau.
  const SUB_PROBE_ORDER = 9_800_000_000_001;
  const SUB_PROBE_MEMO = "[verify-schema] probe memo — khong phai don that";
  const SUB_PROBE_PENDING_UNTIL = "2099-04-05T06:07:08.000Z";
  const SUB_PROBE_EXPIRES = "2099-05-06T07:08:09.000Z";
  const SUB_PROBE_ANCHOR = "2099-06-07T08:09:10.000Z";

  const poIns = await probe.from("payment_orders").insert({
    order_code: SUB_PROBE_ORDER,
    user_id: probeUserId,
    amount: 199_000,
    status: "pending",
    pending_until: SUB_PROBE_PENDING_UNTIL,
    // payOS `qrCode` là PAYLOAD VietQR/EMVCo, không phải URL (UI-D14).
    qr_payload: "[verify-schema] 00020101021138540010A00000072701",
    account_number: "0000000000",
    account_name: "[VERIFY-SCHEMA] TAI KHOAN PROBE",
    memo: SUB_PROBE_MEMO,
  });
  const poResidue = await admin
    .from("payment_orders")
    .select("order_code")
    .eq("memo", SUB_PROBE_MEMO);
  const poClean = !poResidue.error && (poResidue.data?.length ?? 0) === 0;
  // QUÉT TRƯỚC KHI BÁO. Nhánh FAIL là nhánh duy nhất có rác, và đúng ở nhánh đó
  // "script không để lại gì" mới đáng giá: dòng lọt vào là một ĐƠN HÀNG THẬT
  // mang mốc của probe, sinh ra bởi một lượt CHẨN ĐOÁN trên DB đang hỏng. Xoá
  // theo ĐÚNG marker đã hậu kiểm (`memo`), bằng chính admin client — cùng cách
  // `test-rls.ts` dọn `SUB_ORDER_FORGED` ngay sau positive control. Quét cả khi
  // hậu kiểm LỖI: lúc đó không ai biết có dòng nào lọt hay không, và một lệnh
  // delete theo marker là vô hại nếu thật ra không có gì.
  const poSweep = poClean
    ? null
    : await admin.from("payment_orders").delete().eq("memo", SUB_PROBE_MEMO);
  assert(
    isAuthorizationDenial(poIns.error) && poClean,
    isAuthorizationDenial(poIns.error) && poClean
      ? "authenticated KHÔNG tự INSERT được payment_orders (42501) và không dòng nào lọt vào — AC-033 đang đóng"
      : `authenticated GHI ĐƯỢC hoặc bị chặn SAI LÝ DO trên payment_orders (mong đợi 42501, nhận: ${poIns.error?.code ?? "KHÔNG CÓ LỖI"}${poIns.error && !isAuthorizationDenial(poIns.error) ? ` = ràng buộc dữ liệu, KHÔNG phải quyền — \`revoke insert\` có thể đã bị gỡ` : ""}; số dòng lọt vào: ${poResidue.error ? `hậu kiểm lỗi ${poResidue.error.code}` : (poResidue.data?.length ?? "?")}; rác: ${describeSweep(poSweep)}) — apply lại khối SUBSCRIPTION của schema.sql`
  );

  const sbIns = await probe.from("subscriptions").insert({
    user_id: probeUserId,
    expires_at: SUB_PROBE_EXPIRES,
    period_anchor_at: SUB_PROBE_ANCHOR,
  });
  const sbResidue = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("period_anchor_at", SUB_PROBE_ANCHOR);
  const sbClean = !sbResidue.error && (sbResidue.data?.length ?? 0) === 0;
  // Quét trước khi báo — ở bảng này còn gấp. Dòng lọt vào KHÔNG phải rác vô
  // hại: nó là một ENTITLEMENT SỐNG (`expires_at` = 2099) gắn vào chính tài
  // khoản probe, mà email/password của tài khoản đó là hằng nằm trong source đã
  // commit. Để nó lại nghĩa là một lượt chẩn đoán vừa CẤP Premium-tới-2099 cho
  // một tài khoản ai đọc repo cũng đăng nhập được. Marker là `period_anchor_at`
  // — đúng vị từ hậu kiểm, khác vị từ đã dùng để ghi.
  const sbSweep = sbClean
    ? null
    : await admin.from("subscriptions").delete().eq("period_anchor_at", SUB_PROBE_ANCHOR);
  assert(
    isAuthorizationDenial(sbIns.error) && sbClean,
    isAuthorizationDenial(sbIns.error) && sbClean
      ? "authenticated KHÔNG tự INSERT được subscriptions (42501) và không dòng nào lọt vào — không ai tự cấp được entitlement"
      : `authenticated GHI ĐƯỢC hoặc bị chặn SAI LÝ DO trên subscriptions (mong đợi 42501, nhận: ${sbIns.error?.code ?? "KHÔNG CÓ LỖI"}${sbIns.error && !isAuthorizationDenial(sbIns.error) ? ` = ràng buộc dữ liệu, KHÔNG phải quyền — \`revoke insert\` có thể đã bị gỡ` : ""}; số dòng lọt vào: ${sbResidue.error ? `hậu kiểm lỗi ${sbResidue.error.code}` : (sbResidue.data?.length ?? "?")}; rác: ${describeSweep(sbSweep)}) — apply lại khối SUBSCRIPTION của schema.sql`
  );

  // Cùng lớp EXECUTE-chỉ-service_role như record_exam_result ở mục 4, và xử lý
  // PGRST202 y hệt: ở đây "không thấy hàm" là một lệch SCHEMA có thật, nên nó
  // được báo bằng câu riêng thay vì được tính là đã-chặn-được.
  const psRpc = await probe.rpc("record_payment_settlement", {
    p_order_code: SUB_PROBE_ORDER,
    p_period_days: 30,
  });
  assert(
    psRpc.error?.code === "42501",
    psRpc.error?.code === "42501"
      ? "record_payment_settlement KHÔNG gọi được bằng JWT học sinh (42501) — EXECUTE chỉ service_role"
      : psRpc.error?.code === "PGRST202"
        ? "record_payment_settlement chưa tồn tại (PGRST202) — apply khối SUBSCRIPTION của schema.sql; đường DUY NHẤT gia hạn entitlement đang KHÔNG có mặt trên DB này"
        : `authenticated VẪN gọi được record_payment_settlement (chạy tới thân hàm, mã ${psRpc.error?.code ?? "không có lỗi"}) — thiếu \`revoke all on function … from public, anon, authenticated\``
  );

  console.log(
    failures === 0
      ? "\n✅ Schema verify: DB khớp schema.sql §10 + §11 + §12 + khoá ngoại (§15/§16) + phiên bản (§17) + subject canonical (TD-016) + khối SUBSCRIPTION chỉ-đọc (ADR-0013/0014)."
      : `\n❌ Schema verify: ${failures} check FAIL — DB và schema.sql đang lệch nhau.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Schema verify lỗi:", err.message ?? err);
  process.exit(1);
});
