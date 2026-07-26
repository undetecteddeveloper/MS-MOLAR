// Rating System [service-integration-e2e] Test Skeleton
// Design Doc: docs/design/rating-system-backend-design.md (Test Boundaries — RLS suite
//   R-p..R-u; Phase-0 Verification Spike S1-S4)
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026, Quantitative Metrics 1,2,4,5,6,7)
// Generated: 2026-07-24 | Budget Used: integration 3/3, fixture-e2e 2/3, service-integration-e2e 2/2
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// executable assertions yet. The backend Design Doc already specifies the exact case
// table for these behaviors (R-p..R-u) as an extension of the existing
// SOURCE/supabase/test-rls.ts harness (assert-based script run via
// `cd SOURCE && npx tsx supabase/test-rls.ts`, real local Supabase, service-role setup
// + signed-in anon clients per user — see ensureUser/signInAs in that file). The
// PREFERRED implementation is to append these cases directly into test-rls.ts
// following its existing pattern (mirroring R-i/R-j/R-k at :429-473), so there is a
// single source of RLS truth. This file originally recorded two
// service-integration-e2e-lane candidates selected by ROI for traceability; Test SE1
// (R-p..R-t eligibility gate + upsert) has been ported into test-rls.ts (R-p..R-u, the
// select-own confinement obligation added there as (f)) and removed from here to avoid
// double-asserting the same behavior. Test SE2 remains reserved below for a future task.

// =============================================================================
// Test SE2 [additional slot, ROI > 50] — IMPLEMENTED (Task 9 backend)
//   Community-difficulty aggregate: threshold, bucket, Hardest order, Level filter
//   against the real exams_with_difficulty view (or its RPC fallback)
// =============================================================================
// AC-014, AC-015, AC-016, AC-018 (bucket + mean vs null-below-3; boundary buckets)
// AC-019, AC-020 (Hardest: rated exams ordered avg_overall desc, below-threshold
//   sunk last, deterministic created_at/id tie-break)
// AC-021 (Level filter excludes below-threshold and other-bucket rows)
// AC-022, AC-023 (PRD metrics 5, 6, 7): no denormalized exams write, no trigger,
//   existing below-threshold exams unaffected
// Mirrors backend Design Doc Phase-0 Verification Spike checks S1-S4, turned into a
// persistent regression test (the spike itself is a one-time blocking gate; this test
// keeps proving the same capability on every run once the mechanism is adopted).
// ROI: 72 (BV:9 x Freq:7 + Legal:0 + Defect:9) — above the service-integration-e2e
//   ROI > 50 threshold: this is real Postgres NULL/order/range semantics that a
//   mocked query builder (integration Test 2) cannot prove.
//
// Run: cd SOURCE && npx tsx supabase/__tests__/rating.rls.service.e2e.test.ts
// (real local Supabase — same .env.local + service_role/anon pattern as
// supabase/test-rls.ts. NOT collected by `npm test` — vitest.config.ts only includes
// lib/**, components/**, app/**, matching this project's existing convention of
// running RLS/e2e harnesses as standalone tsx scripts, not vitest suites.)
//
// Setup uses the service_role client to write exam_difficulty_ratings rows directly
// (bypassing RLS) — the insert/update-own RLS write path (eligibility gate) is already
// proven by test-rls.ts R-p..R-u; this file's scope is the READ side: the view's
// aggregate/threshold/order/filter correctness, which mocks cannot prove (Mock Boundary
// Decisions table, backend DD).
//
// "No trigger fires" (proof (d)) is corroborated two ways: (1) static source
// inspection — grepping schema.sql for `trigger` finds exactly one trigger
// (`on_auth_user_created` on `auth.users`, unrelated to exams/exam_difficulty_ratings);
// (2) the dynamic check below that the `exams` base-table row is byte-identical
// before/after the 3rd-rating insert. PostgREST only exposes the `public` schema, so a
// live `pg_trigger` catalog query is not reachable from this client — the static
// grep is the available substitute (recorded in Investigation Notes).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bucket, communityDifficultyFrom } from "../../lib/rating";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../../.env.local"), "utf8");
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

const PASSWORD = "rls-test-password-123";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.error(`  ✗ ${msg}`);
    failures += 1;
  }
}

function approxEqual(actual: number, expected: number, epsilon = 1e-6): boolean {
  return Math.abs(actual - expected) < epsilon;
}

/** Tạo (hoặc cập nhật) user đã confirm qua Admin API — không gửi email (mirrors test-rls.ts). */
async function ensureUser(admin: SupabaseClient, email: string): Promise<string> {
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
  const upd = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (upd.error) throw upd.error;
  return existing.id;
}

async function signInAs(url: string, anon: string, email: string): Promise<SupabaseClient> {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

// --- Fixture ids (prefixed for idempotent setup/cleanup, mirrors test-rls.ts) -----

const ZERO_ID = "se2-null-a"; // 0 ratings — below threshold
const ONE_ID = "se2-null-b"; // 1 rating — below threshold; same created_at as ZERO_ID
//   (tie-break-by-id proof among below-threshold rows, AC-019/020)
const FLIP_ID = "se2-flip"; // 2 ratings initially -> 3rd rating inserted mid-test (AC-022)
const MEAN_1_0_ID = "se2-mean-01"; // avg 1.0 — Easy, minimum boundary
const MEAN_3_9_ID = "se2-mean-02"; // avg 3.9 — Easy, just below the Medium boundary
const MEAN_4_0_ID = "se2-mean-03"; // avg 4.0 — Medium, minimum boundary
const MEAN_6_9_ID = "se2-mean-04"; // avg 6.9 — Medium, just below the Hard boundary
const MEAN_7_0_ID = "se2-mean-05"; // avg 7.0 — Hard, minimum boundary
const MEAN_10_0_ID = "se2-mean-06"; // avg 10.0 — Hard, maximum boundary
const TIE_A_ID = "se2-tie-a"; // avg 5.0 — tied with TIE_B_ID, same created_at
const TIE_B_ID = "se2-tie-b"; //   (tie-break-by-id proof among tied-mean rows)

const ALL_FIXTURE_IDS = [
  ZERO_ID,
  ONE_ID,
  FLIP_ID,
  MEAN_1_0_ID,
  MEAN_3_9_ID,
  MEAN_4_0_ID,
  MEAN_6_9_ID,
  MEAN_7_0_ID,
  MEAN_10_0_ID,
  TIE_A_ID,
  TIE_B_ID,
];

// Expected Hardest-sort order (avg_overall desc, nulls-last, created_at/id tie-break) —
// computed independently of the implementation, per testing-principles "literal
// expected values" (AC-019/020).
const EXPECTED_HARDEST_ORDER = [
  MEAN_10_0_ID,
  MEAN_7_0_ID,
  MEAN_6_9_ID,
  TIE_A_ID,
  TIE_B_ID,
  MEAN_4_0_ID,
  MEAN_3_9_ID,
  MEAN_1_0_ID,
  ZERO_ID,
  ONE_ID,
  FLIP_ID,
];

const T_NULL_TIE = "2026-01-01T00:00:00.000Z";
const T_FLIP = "2026-01-01T00:05:00.000Z";
const T_TIE = "2026-01-01T00:10:00.000Z";
const T_GENERIC = "2026-01-01T00:15:00.000Z";

type RatingEntry = { userId: string; scores: [number, number, number] };

async function cleanupFixtures(admin: SupabaseClient) {
  await admin.from("exam_difficulty_ratings").delete().in("exam_id", ALL_FIXTURE_IDS);
  await admin.from("exams").delete().in("id", ALL_FIXTURE_IDS);
}

async function setupExams(admin: SupabaseClient, authorId: string) {
  const base = {
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "SE2 Test Author",
    question_ids: [] as string[],
    status: "published",
  };
  const { error } = await admin.from("exams").insert([
    { ...base, id: ZERO_ID, title: "[SE2] 0 rating (below threshold)", created_at: T_NULL_TIE },
    { ...base, id: ONE_ID, title: "[SE2] 1 rating (below threshold)", created_at: T_NULL_TIE },
    { ...base, id: FLIP_ID, title: "[SE2] 2->3 rating flip", created_at: T_FLIP },
    { ...base, id: MEAN_1_0_ID, title: "[SE2] mean 1.0 (Easy min)", created_at: T_GENERIC },
    { ...base, id: MEAN_3_9_ID, title: "[SE2] mean 3.9 (Easy, near Medium)", created_at: T_GENERIC },
    { ...base, id: MEAN_4_0_ID, title: "[SE2] mean 4.0 (Medium min)", created_at: T_GENERIC },
    { ...base, id: MEAN_6_9_ID, title: "[SE2] mean 6.9 (Medium, near Hard)", created_at: T_GENERIC },
    { ...base, id: MEAN_7_0_ID, title: "[SE2] mean 7.0 (Hard min)", created_at: T_GENERIC },
    { ...base, id: MEAN_10_0_ID, title: "[SE2] mean 10.0 (Hard max)", created_at: T_GENERIC },
    { ...base, id: TIE_A_ID, title: "[SE2] tie A (5.0)", created_at: T_TIE },
    { ...base, id: TIE_B_ID, title: "[SE2] tie B (5.0)", created_at: T_TIE },
  ]);
  if (error) throw error;
}

async function insertRatings(admin: SupabaseClient, examId: string, entries: RatingEntry[]) {
  const rows = entries.map(({ userId, scores }) => ({
    exam_id: examId,
    user_id: userId,
    score_part1: scores[0],
    score_part2: scores[1],
    score_part3: scores[2],
  }));
  const { error } = await admin.from("exam_difficulty_ratings").insert(rows);
  if (error) throw error;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service)
    throw new Error("Thiếu URL / ANON_KEY / SERVICE_ROLE_KEY trong .env.local");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 10 rater accounts — the exact minimum count for which a whole-number sum of
  // integer [1,10] part-scores can average to the terminating decimals 3.9/6.9
  // (avg_overall = S/(3N); N must be a multiple of 10 for S/(3N) to equal k.9 exactly).
  const RATER_EMAILS = Array.from(
    { length: 10 },
    (_, i) => `smithnguyen247+se2rater${i + 1}@gmail.com`
  );
  const raterIds: string[] = [];
  for (const email of RATER_EMAILS) raterIds.push(await ensureUser(admin, email));
  const authorId = raterIds[0];

  const reader = await signInAs(url, anon, RATER_EMAILS[0]);

  console.log("\nSE2 — setup fixture (service_role)…");
  await cleanupFixtures(admin);

  // Fixture-dependent body wrapped in try/finally: any thrown error from setup or
  // one of the proof-obligation reads below must still run cleanup, otherwise a
  // mid-test failure leaks live-DB se2-* rows (main().catch() only logs and exits).
  try {
    await runFixtureDependentChecks(admin, reader, raterIds, authorId);
  } finally {
    await cleanupFixtures(admin);
  }

  console.log(
    failures === 0 ? "\n✅ SE2 test: tất cả PASS." : `\n❌ SE2 test: ${failures} check FAIL.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

async function runFixtureDependentChecks(
  admin: SupabaseClient,
  reader: SupabaseClient,
  raterIds: string[],
  authorId: string
) {
  await setupExams(admin, authorId);

  // MEAN_1_0 / MEAN_4_0 / MEAN_7_0 / MEAN_10_0 / TIE_A / TIE_B: 3 raters, identical
  // scores per exam → each rater's own overall equals the target exactly (no
  // repeating fraction), so the community avg_overall is exact.
  await insertRatings(
    admin,
    MEAN_1_0_ID,
    raterIds.slice(0, 3).map((userId) => ({ userId, scores: [1, 1, 1] }))
  );
  await insertRatings(
    admin,
    MEAN_4_0_ID,
    raterIds.slice(0, 3).map((userId) => ({ userId, scores: [4, 4, 4] }))
  );
  await insertRatings(
    admin,
    MEAN_7_0_ID,
    raterIds.slice(0, 3).map((userId) => ({ userId, scores: [7, 7, 7] }))
  );
  await insertRatings(
    admin,
    MEAN_10_0_ID,
    raterIds.slice(0, 3).map((userId) => ({ userId, scores: [10, 10, 10] }))
  );
  await insertRatings(
    admin,
    TIE_A_ID,
    raterIds.slice(0, 3).map((userId) => ({ userId, scores: [5, 5, 5] }))
  );
  await insertRatings(
    admin,
    TIE_B_ID,
    raterIds.slice(0, 3).map((userId) => ({ userId, scores: [5, 5, 5] }))
  );

  // MEAN_3_9: 10 raters — 7x(4,4,4) sum=12 + 3x(4,4,3) sum=11 → total 117 →
  // avg_overall = 117 / (3*10) = 3.9 exactly.
  const mean39Entries: RatingEntry[] = raterIds.map((userId, i) => ({
    userId,
    scores: i < 7 ? [4, 4, 4] : [4, 4, 3],
  }));
  await insertRatings(admin, MEAN_3_9_ID, mean39Entries);

  // MEAN_6_9: 10 raters — 7x(7,7,7) sum=21 + 3x(7,7,6) sum=20 → total 207 →
  // avg_overall = 207 / (3*10) = 6.9 exactly.
  const mean69Entries: RatingEntry[] = raterIds.map((userId, i) => ({
    userId,
    scores: i < 7 ? [7, 7, 7] : [7, 7, 6],
  }));
  await insertRatings(admin, MEAN_6_9_ID, mean69Entries);

  // ONE_ID: 1 rating (below threshold — content irrelevant).
  await insertRatings(admin, ONE_ID, [{ userId: raterIds[0], scores: [5, 5, 5] }]);

  // FLIP_ID: 2 ratings initially (below threshold); 3rd rating inserted later in
  // the test to flip it to a { bucket, mean } (AC-022). Overalls 5, 7, 9 (after the
  // 3rd) average to an exact 7.0 (Hard) with no repeating fraction.
  await insertRatings(admin, FLIP_ID, [
    { userId: raterIds[0], scores: [5, 5, 5] },
    { userId: raterIds[1], scores: [7, 7, 7] },
  ]);

  console.log("\nSE2 checks — proof obligation (a): threshold/bucket at the DB layer:");

  const { data: rowsData, error: rowsErr } = await reader
    .from("exams_with_difficulty")
    .select("id, rating_count, avg_overall")
    .eq("status", "published")
    .in("id", ALL_FIXTURE_IDS);
  if (rowsErr) throw rowsErr;
  const rows = rowsData as { id: string; rating_count: number; avg_overall: number | null }[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  assert(rows.length === ALL_FIXTURE_IDS.length, "(a) tất cả 11 exam fixture đọc được qua view");

  const zero = byId.get(ZERO_ID);
  assert(
    zero?.rating_count === 0 && zero?.avg_overall === null,
    "(a) 0 rating -> rating_count=0, avg_overall=null"
  );
  const one = byId.get(ONE_ID);
  assert(
    one?.rating_count === 1 && one?.avg_overall === null,
    "(a) 1 rating -> rating_count=1, avg_overall=null (< threshold)"
  );
  const flipBefore = byId.get(FLIP_ID);
  assert(
    flipBefore?.rating_count === 2 && flipBefore?.avg_overall === null,
    "(a) 2 rating -> rating_count=2, avg_overall=null (< threshold, chưa flip)"
  );

  const boundaryChecks: { id: string; mean: number; expectedBucket: "Easy" | "Medium" | "Hard" }[] = [
    { id: MEAN_1_0_ID, mean: 1.0, expectedBucket: "Easy" },
    { id: MEAN_3_9_ID, mean: 3.9, expectedBucket: "Easy" },
    { id: MEAN_4_0_ID, mean: 4.0, expectedBucket: "Medium" },
    { id: MEAN_6_9_ID, mean: 6.9, expectedBucket: "Medium" },
    { id: MEAN_7_0_ID, mean: 7.0, expectedBucket: "Hard" },
    { id: MEAN_10_0_ID, mean: 10.0, expectedBucket: "Hard" },
  ];
  for (const { id, mean, expectedBucket } of boundaryChecks) {
    const row = byId.get(id);
    const avg = row?.avg_overall ?? null;
    const community = communityDifficultyFrom(avg, row?.rating_count ?? 0);
    assert(
      row?.rating_count === (id === MEAN_3_9_ID || id === MEAN_6_9_ID ? 10 : 3) &&
        avg !== null &&
        approxEqual(avg, mean) &&
        bucket(avg) === expectedBucket &&
        community?.bucket === expectedBucket &&
        community !== null &&
        approxEqual(community.mean, mean),
      `(a) ${id}: avg_overall≈${mean} (thực tế ${avg}), bucket=${expectedBucket} (AC-018)`
    );
  }

  console.log("\nSE2 checks — proof obligation (b): Hardest order + created_at/id tie-break:");

  async function readHardestOrder(): Promise<string[]> {
    const { data, error } = await reader
      .from("exams_with_difficulty")
      .select("id")
      .eq("status", "published")
      .in("id", ALL_FIXTURE_IDS)
      .order("avg_overall", { ascending: false, nullsFirst: false })
      .order("created_at")
      .order("id");
    if (error) throw error;
    return (data as { id: string }[]).map((r) => r.id);
  }
  const order1 = await readHardestOrder();
  const order2 = await readHardestOrder();
  assert(
    JSON.stringify(order1) === JSON.stringify(EXPECTED_HARDEST_ORDER),
    `(b) Hardest order đúng thứ tự kỳ vọng (rated desc, null sunk cuối, tie-break created_at/id): ${JSON.stringify(order1)}`
  );
  assert(
    JSON.stringify(order1) === JSON.stringify(order2),
    "(b) đọc lặp lại cho ra thứ tự giống hệt (deterministic)"
  );

  console.log("\nSE2 checks — proof obligation (c): Level=Hard filter excludes below-threshold/other-bucket:");

  const { data: hardData, error: hardErr } = await reader
    .from("exams_with_difficulty")
    .select("id")
    .eq("status", "published")
    .in("id", ALL_FIXTURE_IDS)
    .gte("avg_overall", 7);
  if (hardErr) throw hardErr;
  const hardIds = new Set((hardData as { id: string }[]).map((r) => r.id));
  assert(
    hardIds.size === 2 && hardIds.has(MEAN_7_0_ID) && hardIds.has(MEAN_10_0_ID),
    `(c) Level=Hard query chỉ trả về 2 đề Hard (>=3 rating): ${JSON.stringify([...hardIds])}`
  );

  console.log("\nSE2 checks — proof obligation (d): 2->3 rating flip, no exams write, no trigger:");

  const { data: examBefore, error: examBeforeErr } = await admin
    .from("exams")
    .select("*")
    .eq("id", FLIP_ID)
    .single();
  if (examBeforeErr) throw examBeforeErr;

  await insertRatings(admin, FLIP_ID, [{ userId: raterIds[2], scores: [9, 9, 9] }]);

  const { data: examAfter, error: examAfterErr } = await admin
    .from("exams")
    .select("*")
    .eq("id", FLIP_ID)
    .single();
  if (examAfterErr) throw examAfterErr;
  assert(
    JSON.stringify(examBefore) === JSON.stringify(examAfter),
    "(d) row `exams` KHÔNG đổi (không có write/denormalize sau khi thêm rating thứ 3, AC-022)"
  );
  // Static evidence (source inspection, recorded here since PostgREST does not expose
  // pg_catalog to this client): grepping schema.sql for "trigger" finds exactly one
  // trigger (`on_auth_user_created` on `auth.users`) — none on `exams` or
  // `exam_difficulty_ratings`. No trigger fires on the rating write path.

  const { data: flipAfterData, error: flipAfterErr } = await reader
    .from("exams_with_difficulty")
    .select("rating_count, avg_overall")
    .eq("id", FLIP_ID)
    .single();
  if (flipAfterErr) throw flipAfterErr;
  const flipAfter = flipAfterData as { rating_count: number; avg_overall: number | null };
  const flipCommunity = communityDifficultyFrom(flipAfter.avg_overall, flipAfter.rating_count);
  assert(
    flipAfter.rating_count === 3 &&
      flipAfter.avg_overall !== null &&
      approxEqual(flipAfter.avg_overall, 7.0) &&
      flipCommunity?.bucket === "Hard" &&
      approxEqual(flipCommunity.mean, 7.0) &&
      flipCommunity.count === 3,
    `(d) Ngay sau khi thêm rating thứ 3, lần đọc kế tiếp phản ánh flip null -> {bucket:"Hard", mean≈7.0, count:3} (thực tế avg_overall=${flipAfter.avg_overall})`
  );
}

main().catch((err) => {
  console.error("❌ SE2 test lỗi:", err.message ?? err);
  process.exit(1);
});
