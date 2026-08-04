// Backend-flow latency benchmark — measures raw Supabase query round-trip time
// for each layer's core read/write paths, using a real signed-in test-account
// session (so RLS is actually evaluated, same as production) via plain
// @supabase/supabase-js — NOT the Next.js server client (createClient() from
// lib/supabase/server.ts needs next/headers' cookies(), unavailable outside a
// request). Query chains below are copied verbatim from each layer's
// queries.ts/actions.ts so the numbers reflect the real backend flow, not an
// approximation.
//
// ⚠ These are COPIES, not imports — they drift silently when a layer's query
// changes. Update them in the same commit as any query edit, or this script
// will confidently report the latency of code that no longer exists.
//
// Scope (per engineer decision, 2026-08-02): DB/Supabase round-trip only, not
// end-to-end HTTP/Next.js render time. Layer 4's extractAndAssemble() (Gemini
// AI call) is EXCLUDED — that latency is network+LLM-inference bound, a
// different optimization space (see ADR-0006), not a query/index problem.
//
// Cách chạy:  cd SOURCE && npx tsx scripts/perf-layers.ts

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

const PASSWORD = "rls-test-password-123";
const EMAIL_A = "smithnguyen247+rlstesta@gmail.com";
const ITERATIONS = 8;
const WARMUP = 1; // first call often pays connection-setup cost; excluded from stats

type Stat = { label: string; layer: string; n: number; minMs: number; medMs: number; avgMs: number; maxMs: number; note?: string };
const results: Stat[] = [];

async function bench(
  layer: string,
  label: string,
  fn: () => Promise<unknown>,
  iterations = ITERATIONS
): Promise<void> {
  const durations: number[] = [];
  let note: string | undefined;
  try {
    for (let i = 0; i < WARMUP; i++) await fn();
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      durations.push(performance.now() - start);
    }
  } catch (err) {
    note = `ERROR: ${(err as Error).message}`;
  }
  if (durations.length === 0) {
    results.push({ label, layer, n: 0, minMs: NaN, medMs: NaN, avgMs: NaN, maxMs: NaN, note });
    return;
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const med = sorted[Math.floor(sorted.length / 2)];
  results.push({
    label,
    layer,
    n: durations.length,
    minMs: sorted[0],
    medMs: med,
    avgMs: avg,
    maxMs: sorted[sorted.length - 1],
    note,
  });
}

function printReport() {
  console.log("\n" + "=".repeat(96));
  console.log("Backend flow latency — per layer (DB/Supabase round-trip, ms)");
  console.log("=".repeat(96));
  const header = ["Layer", "Call", "n", "min", "median", "avg", "max"].map((h) => h.padEnd(14));
  console.log(header.join(""));
  console.log("-".repeat(96));
  let currentLayer = "";
  for (const r of results) {
    if (r.layer !== currentLayer) {
      currentLayer = r.layer;
      console.log("");
    }
    if (r.note) {
      console.log(`${r.layer.padEnd(14)}${r.label.padEnd(14)}${r.note}`);
      continue;
    }
    const row = [
      r.layer,
      r.label,
      String(r.n),
      r.minMs.toFixed(0),
      r.medMs.toFixed(0),
      r.avgMs.toFixed(0),
      r.maxMs.toFixed(0),
    ].map((c) => String(c).padEnd(14));
    console.log(row.join(""));
  }
  console.log("\n" + "=".repeat(96));
  const ranked = results.filter((r) => !r.note).sort((a, b) => b.medMs - a.medMs);
  console.log("Slowest calls (by median), highest first:");
  ranked.slice(0, 8).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.layer}] ${r.label} — median ${r.medMs.toFixed(0)}ms (avg ${r.avgMs.toFixed(0)}ms)`);
  });
  console.log("=".repeat(96) + "\n");
}

// --- Layer-specific query chains (copied from each layer's queries.ts) -----

const EXAM_COLUMNS =
  "id, title, question_ids, duration_minutes, subject, grade, school, school_year, semester, author_display_name, parts, rating_count, avg_overall";

async function listExams(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("exams_with_difficulty")
    .select(EXAM_COLUMNS)
    .eq("status", "published")
    .order("id");
  if (error) throw error;
  return data;
}

async function getExam(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("exams_with_difficulty")
    .select(EXAM_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveSignedImageUrl(supabase: SupabaseClient, storedUrl: string | null) {
  if (!storedUrl) return undefined;
  const m = /\/exam-images\/(.+)$/.exec(new URL(storedUrl).pathname);
  if (!m) return undefined;
  const { data } = await supabase.storage.from("exam-images").createSignedUrl(m[1], 3600);
  return data?.signedUrl;
}

async function getExamForPlayer(supabase: SupabaseClient, id: string) {
  const exam = await getExam(supabase, id);
  if (!exam) return null;
  const { data, error } = await supabase
    .from("questions")
    .select("id, content, choices, subject, grade, topic, question_type, part_number, image_url")
    .in("id", (exam as { question_ids: string[] }).question_ids);
  if (error) throw error;
  const rows = data as Array<{ image_url: string | null }>;
  await Promise.all(rows.map((r) => resolveSignedImageUrl(supabase, r.image_url)));
  return { exam, questionCount: rows.length };
}

async function getResult(supabase: SupabaseClient, attemptId: string) {
  const { data: joined, error: joinedErr } = await supabase
    .from("exam_results")
    .select(
      "total_score, correct, total, per_question, topic_breakdown, exam_attempts!inner(started_at, submitted_at, exams_with_difficulty!inner(id, title))"
    )
    .eq("attempt_id", attemptId)
    .eq("exam_attempts.exams_with_difficulty.status", "published")
    .maybeSingle();
  if (joinedErr) throw joinedErr;
  if (!joined) return null;

  const examId = (
    joined as unknown as { exam_attempts: { exams_with_difficulty: { id: string } } }
  ).exam_attempts.exams_with_difficulty.id;
  // RPC, không phải .from("questions") — 3 cột đáp án đã bị REVOKE khỏi role
  // `authenticated` (Security review 2026-08-03 #1, schema.sql §10).
  const { data: qs, error: qErr } = await supabase.rpc("exam_answer_key", {
    p_exam_id: examId,
  });
  if (qErr) throw qErr;
  return { joined, questionCount: ((qs ?? []) as unknown[]).length };
}

async function getAnalyticsByRange(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("exam_results")
    .select("correct, total, exam_attempts!inner(submitted_at, status, exams!inner(subject))")
    .eq("exam_attempts.status", "submitted");
  if (error) throw error;
  return data;
}

async function listMyHistory(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("exam_results")
    .select(
      "attempt_id, total_score, exam_attempts!inner(exam_id, started_at, submitted_at, exams!inner(title, subject))"
    )
    .eq("exam_attempts.status", "submitted")
    .eq("exam_attempts.exams.status", "published");
  if (error) throw error;
  return data;
}

async function listMyExams(supabase: SupabaseClient, authorId: string) {
  const { data, error } = await supabase
    .from("exams")
    .select("id, title, subject, grade, question_ids, status, created_at, reviewed_at")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function getMyExam(supabase: SupabaseClient, id: string, authorId: string) {
  const { data: examRow, error: examErr } = await supabase
    .from("exams")
    .select(
      "id, title, subject, grade, duration_minutes, school, school_year, semester, status, question_ids, parts"
    )
    .eq("id", id)
    .eq("author_id", authorId)
    .maybeSingle();
  if (examErr) throw examErr;
  if (!examRow) return null;
  // RPC, không phải .from("questions") — xem ghi chú ở getResult() phía trên.
  const { data: qRows, error: qErr } = await supabase.rpc("exam_answer_key", {
    p_exam_id: id,
  });
  if (qErr) throw qErr;
  return { examRow, questionCount: ((qRows ?? []) as unknown[]).length };
}

// --- Main --------------------------------------------------------------

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL/ANON_KEY trong .env.local");

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`Đăng nhập test account ${EMAIL_A} ...`);
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: EMAIL_A,
    password: PASSWORD,
  });
  if (signInErr || !signInData.user) {
    throw new Error(`Đăng nhập thất bại: ${signInErr?.message ?? "no user"}`);
  }
  const userId = signInData.user.id;
  console.log(`OK — user id ${userId}\n`);

  // Layer 1: Auth latency itself (GoTrue service, separate subsystem from Postgres/PostgREST)
  await bench("Layer1 (Auth)", "signInWithPassword", async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL_A, password: PASSWORD });
    if (error) throw error;
  });

  // Discover real ids to test against (dynamic — do not hardcode against fake-data/seed state)
  const { data: publishedExams } = await supabase
    .from("exams_with_difficulty")
    .select("id")
    .eq("status", "published")
    .limit(1);
  const examId = (publishedExams as { id: string }[] | null)?.[0]?.id;

  const { data: submittedAttempts } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("status", "submitted")
    .limit(1);
  const attemptId = (submittedAttempts as { id: string }[] | null)?.[0]?.id;

  const { data: authoredExams } = await supabase
    .from("exams")
    .select("id")
    .eq("author_id", userId)
    .limit(1);
  const authoredExamId = (authoredExams as { id: string }[] | null)?.[0]?.id;

  console.log(`Test data: examId=${examId ?? "(none found)"}  attemptId=${attemptId ?? "(none found)"}  authoredExamId=${authoredExamId ?? "(none found)"}\n`);

  // Layer 2 (Core Loop)
  await bench("Layer2 (Core)", "listExams (no filter)", () => listExams(supabase));
  if (examId) {
    await bench("Layer2 (Core)", "getExam", () => getExam(supabase, examId));
    await bench("Layer2 (Core)", "getExamForPlayer", () => getExamForPlayer(supabase, examId));
  } else {
    results.push({ label: "getExam / getExamForPlayer", layer: "Layer2 (Core)", n: 0, minMs: NaN, medMs: NaN, avgMs: NaN, maxMs: NaN, note: "SKIPPED — no published exam found" });
  }
  if (attemptId) {
    await bench("Layer2 (Core)", "getResult (2 requests)", () => getResult(supabase, attemptId));
  } else {
    results.push({ label: "getResult", layer: "Layer2 (Core)", n: 0, minMs: NaN, medMs: NaN, avgMs: NaN, maxMs: NaN, note: "SKIPPED — no submitted attempt found for this account" });
  }

  // Layer 3 (Analytics)
  await bench("Layer3 (Analytics)", "getAnalyticsByRange", () => getAnalyticsByRange(supabase));

  // Layer 4 (UGC upload) — pure queries only, extractAndAssemble (Gemini) excluded
  await bench("Layer4 (UGC)", "listMyExams", () => listMyExams(supabase, userId));
  if (authoredExamId) {
    await bench("Layer4 (UGC)", "getMyExam", () => getMyExam(supabase, authoredExamId, userId));
  } else {
    results.push({ label: "getMyExam", layer: "Layer4 (UGC)", n: 0, minMs: NaN, medMs: NaN, avgMs: NaN, maxMs: NaN, note: "SKIPPED — test account has not authored any exam" });
  }

  // HM (History)
  await bench("HM (History)", "listMyHistory (1 join)", () => listMyHistory(supabase));

  printReport();
}

main().catch((err) => {
  console.error("Benchmark thất bại:", err);
  process.exit(1);
});
