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
//
// Vì (1) lấy từ DB chứ không hard-code, THÊM CỘT MỚI vào questions mà quên phân
// loại sẽ làm script FAIL kèm hướng dẫn — thay vì lặng lẽ trở thành trang trắng
// 42501 ở production vài tuần sau (TD-001).
//
// Script CHỈ ĐỌC: không insert/update/delete, không DDL. RPC được probe bằng id
// không tồn tại nên không khoá attempt của ai.
//
// Cách chạy:  cd SOURCE && npx tsx supabase/verify-schema.ts
// Chạy khi:   sau mỗi lần apply schema.sql, và trước khi deploy code đụng §10.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
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

  console.log(
    failures === 0
      ? "\n✅ Schema verify: DB khớp schema.sql §10 + §11 + §12."
      : `\n❌ Schema verify: ${failures} check FAIL — DB và schema.sql đang lệch nhau.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Schema verify lỗi:", err.message ?? err);
  process.exit(1);
});
