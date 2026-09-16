// Batch gắn thẻ kỹ năng (dạng bài) cho câu hỏi của MỘT MÔN (Engine 1, PRD
// R2, AC-005..008; mở rộng từ Toán ra 7 môn 2026-09-16).
//
// Cách chạy (sau khi supabase/seedSkillTaxonomy.ts đã seed taxonomy):
//   cd SOURCE
//   npx tsx supabase/tagQuestionSkills.ts --subject=Physics            # DRY-RUN (mặc định, không ghi)
//   npx tsx supabase/tagQuestionSkills.ts --subject=Physics --apply    # ghi thật (gọi Gemini lại)
//   npx tsx supabase/tagQuestionSkills.ts --subject=Physics --apply \
//       --from-report=supabase/skill-tagging-report-<ref>-physics-<ISO>.json
//                                            # ghi ĐÚNG bản report đã duyệt, 0 request Gemini
//   Tuỳ chọn: --batch=10 (số câu mỗi request), --key-file=.env.local.skill-tagging
//
// Chạy trên prod (đặt SCHEMA_ENV_FILE, cùng convention verify-schema.ts):
//   SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts --subject=Biology
//
// DRY-RUN LÀ MẶC ĐỊNH có chủ ý: AC-008 đòi engineer đọc 100% các đề xuất
// "tagged" TRƯỚC khi có bất cứ dòng nào được ghi. Report JSON ghi ra
// supabase/skill-tagging-report-<ref>-<môn>-<ISO>.json (đã gitignore) chính là
// vật liệu cho bước review đó — và `--apply --from-report` ghi đúng bản đã
// đọc, thay vì gọi Gemini lần nữa rồi ghi một bản KHÁC bản đã duyệt.
//
// KEY GEMINI RIÊNG (bắt buộc, 2026-09-16): key của app (`.env.local`,
// `.env.local.prod-backup`) nằm ở free tier 20 request/ngày cho CẢ project và
// đã bị vét sạch một lần bởi chính việc gọi AI hàng loạt (TD-019). Script đọc
// GEMINI_API_KEY từ `--key-file` (mặc định `.env.local.skill-tagging`, một
// file chỉ cần đúng một dòng) nếu file đó tồn tại, nếu không thì từ env file;
// và TỪ CHỐI chạy khi key ấy trùng key app — trừ khi `--allow-shared-key`,
// cờ dành cho người biết mình đang lấy suất của học sinh.
//
// THEO LÔ: 20 request/ngày/model nên mỗi request gộp `--batch` câu (mặc định
// 10). Mỗi câu vẫn qua decideSkillTag() riêng — ngưỡng, tập id hợp lệ, "câu
// đã có tag không gọi model" (AC-006) đều giữ nguyên. Gặp 429/quota thì dừng
// các lô còn lại (mọi câu còn lại là classification-error) và VẪN ghi report;
// chạy lại hôm sau chỉ phân loại câu còn NULL.
//
// Corpus của một môn: questions.subject ∈ {canonical, nhãn tiếng Việt} — với
// Toán là ('Math', 'Toán'), đúng như bản trước (10 dòng 'Toán' không chuẩn
// hoá vẫn là câu Toán thật, PRD R2).
//
// Dùng service_role key (bypass RLS + column grant), CHỈ chạy local.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { SUBJECT_ORDER, type Subject } from "../lib/analytics/constants";
import { SUBJECT_LABELS } from "../lib/ugc/subjects";
import { SKILL_TAG_CONFIDENCE_THRESHOLD } from "../lib/adaptive/constants";
// Nhập thẳng từ lib/ai/models chứ KHÔNG qua lib/ugc/gemini.ts: file đó
// `import "server-only"`, ném khi chạy dưới tsx (xem ghi chú cùng lý do ở
// lib/tutor/__tests__/toneEval.manual.test.ts:9-11).
import { ANSWER_MODEL } from "../lib/ai/models";
import { skillNodesForSubject } from "../lib/adaptive/skillTaxonomy";
import { decideSkillTag, type SkillClassification } from "../lib/adaptive/tagDecision";
import {
  CLASSIFY_BATCH_SCHEMA,
  buildBatchPrompt,
  chunkBatches,
  classificationsFromReport,
  findSharedKeyMatch,
  parseBatchResponse,
  type BatchQuestion,
  type ReportEntry,
  type TaggingReport,
} from "../lib/adaptive/tagBatch";

// --- Tham số dòng lệnh -------------------------------------------------------

function readArg(name: string): string | null {
  const withEq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (withEq) return withEq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  const next = process.argv[i + 1];
  if (i !== -1 && next !== undefined && !next.startsWith("--")) return next;
  return null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_KEY_FILE = ".env.local.skill-tagging";

// --- Nạp env từ .env.local (tsx không tự load như Next.js) ----------------
/** File env đang dùng — đọc một lần để log ra đúng cái đã thật sự nạp. */
const ENV_FILE = process.env.SCHEMA_ENV_FILE?.trim() || ".env.local";

function parseEnv(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

/**
 * Đọc env từ `.env.local`, hoặc từ file khác nếu đặt `SCHEMA_ENV_FILE` — cùng
 * convention với `verify-schema.ts` và `seedSkillTaxonomy.ts`. Ở script NÀY nó
 * còn quan trọng hơn: `--apply` ghi vào `questions` của DB đích, và report JSON
 * là vật liệu engineer duyệt theo AC-008 — một report không nói nó đọc corpus
 * của môi trường nào thì không duyệt được.
 */
function loadEnvFile(file: string): Record<string, string> | null {
  const path = resolve(__dirname, "..", file);
  if (!existsSync(path)) return null;
  return parseEnv(readFileSync(path, "utf8"));
}

interface CorpusQuestion {
  id: string;
  content: string;
  subject: string | null;
  grade: number | null;
  question_type: string | null;
  skill_node_id: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Số lần thử phân loại MỘT lô. Cần thêm lớp này dù SDK đã bật
 * retryOptions.attempts: đo thực tế trên corpus 47 câu (2026-08-15), hai lần
 * dry-run liên tiếp cho coverage 85.1% rồi 70.2% — chênh lệch toàn bộ là các
 * câu rớt với "fetch failed" (lỗi tầng mạng, SDK không xếp vào nhóm status
 * retryable nên không tự thử lại).
 */
const CLASSIFY_ATTEMPTS = 3;
/** Nghỉ giữa hai lô — giữ nhịp dưới rate limit theo phút của free tier. */
const THROTTLE_MS = 2000;

function isQuotaError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err);
  return /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

type GeminiClient = import("@google/genai").GoogleGenAI;

/** Gọi Gemini cho MỘT lô; trả `null` khi lỗi (đã log), và cờ quota để vòng ngoài dừng. */
async function classifyBatchOnce(
  client: GeminiClient,
  model: string,
  prompt: string,
  ids: readonly string[],
): Promise<{ result: ReturnType<typeof parseBatchResponse> | null; quota: boolean }> {
  try {
    const response = await client.models.generateContent({
      model,
      contents: [{ text: prompt }],
      config: {
        // temperature 0: lời gọi phân loại phải bám sát tất định nhất có thể.
        // Nó KHÔNG phải là bảo đảm cho AC-006 (bảo đảm đó nằm ở nhánh
        // "already-tagged" của decideSkillTag), chỉ là giảm nhiễu.
        temperature: 0,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseJsonSchema: CLASSIFY_BATCH_SCHEMA as unknown as Record<string, unknown>,
      },
    });
    return { result: parseBatchResponse(response.text, ids), quota: false };
  } catch (err) {
    // Một lô lỗi KHÔNG được làm sập cả batch — các câu của nó thành "left-null"
    // với lý do classification-error, cùng đường với câu dưới ngưỡng.
    console.warn(`  ⚠ lỗi phân loại lô ${ids.length} câu: ${(err as Error).message ?? err}`);
    return { result: null, quota: isQuotaError(err) };
  }
}

async function classifyBatch(
  client: GeminiClient,
  model: string,
  prompt: string,
  ids: readonly string[],
): Promise<{ byQuestionId: Map<string, SkillClassification | null>; quota: boolean }> {
  for (let attempt = 1; attempt <= CLASSIFY_ATTEMPTS; attempt++) {
    const { result, quota } = await classifyBatchOnce(client, model, prompt, ids);
    if (quota) return { byQuestionId: new Map(ids.map((id) => [id, null])), quota: true };
    if (result !== null) {
      for (const w of result.warnings) console.warn(`    · ${w}`);
      return { byQuestionId: result.byQuestionId, quota: false };
    }
    if (attempt < CLASSIFY_ATTEMPTS) {
      const backoffMs = 1000 * 2 ** (attempt - 1);
      console.warn(`    ↻ thử lại lô sau ${backoffMs}ms (lần ${attempt + 1})`);
      await sleep(backoffMs);
    }
  }
  return { byQuestionId: new Map(ids.map((id) => [id, null])), quota: false };
}

function keyFingerprint(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex").slice(0, 8);
}

async function main() {
  const apply = hasFlag("apply");
  const fromReport = readArg("from-report");
  const allowSharedKey = hasFlag("allow-shared-key");
  const keyFile = readArg("key-file") ?? DEFAULT_KEY_FILE;

  const subjectArg = readArg("subject");
  if (subjectArg === null || !(SUBJECT_ORDER as readonly string[]).includes(subjectArg)) {
    throw new Error(
      `Thiếu hoặc sai --subject. Nhận một trong: ${SUBJECT_ORDER.join(", ")} (giá trị canonical, không phải nhãn tiếng Việt).`,
    );
  }
  const subject = subjectArg as Subject;
  const subjectLabel = SUBJECT_LABELS[subject];

  const batchArg = readArg("batch");
  const batchSize = batchArg === null ? DEFAULT_BATCH_SIZE : Number(batchArg);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new Error(`--batch phải là số nguyên 1..50 (nhận: ${batchArg}).`);
  }

  const env = loadEnvFile(ENV_FILE);
  if (env === null) throw new Error(`Không thấy file env ${ENV_FILE}`);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      `Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong ${ENV_FILE}`,
    );
  }

  // --- Key Gemini riêng (chỉ cần khi thật sự gọi model) ---------------------
  let geminiKey: string | null = null;
  if (fromReport === null) {
    const keyEnv = loadEnvFile(keyFile);
    const source = keyEnv?.GEMINI_API_KEY ? keyFile : ENV_FILE;
    geminiKey = keyEnv?.GEMINI_API_KEY || env.GEMINI_API_KEY || null;
    if (!geminiKey) {
      throw new Error(
        `Thiếu GEMINI_API_KEY. Tạo key MỚI ở aistudio.google.com/apikey (Google project riêng, ` +
          `không phải project của key app) và ghi vào ${keyFile} dưới dạng một dòng GEMINI_API_KEY=...`,
      );
    }
    const shared = findSharedKeyMatch(geminiKey, [
      { file: ".env.local", key: loadEnvFile(".env.local")?.GEMINI_API_KEY },
      { file: ".env.local.prod-backup", key: loadEnvFile(".env.local.prod-backup")?.GEMINI_API_KEY },
    ]);
    if (shared !== null && !allowSharedKey) {
      throw new Error(
        `GEMINI_API_KEY (đọc từ ${source}) TRÙNG key của app trong ${shared}. Key đó ở free tier ` +
          `20 request/ngày cho cả project và đang phục vụ gia sư + upload đề của học sinh (TD-019). ` +
          `Dùng key riêng (${keyFile}); nếu cố ý dùng key app, thêm --allow-shared-key.`,
      );
    }
    if (shared !== null) {
      console.warn(`⚠ --allow-shared-key: đang dùng key của app (${shared}) — mỗi request là một suất của học sinh.`);
    }
    console.log(`Key Gemini: ${source} (sha256 ${keyFingerprint(geminiKey)})`);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /** Ref của project đích, suy từ host — đi vào cả log lẫn tên file report. */
  const projectRef = new URL(url).host.split(".")[0];

  // Đọc thẳng skill_nodes từ DB chứ không tin SKILL_NODES: khoá ngoại của
  // questions.skill_node_id trỏ vào DB, nên tập id hợp lệ phải lấy từ DB. Nếu
  // ai đó quên chạy seedSkillTaxonomy.ts thì phải fail ở đây, không phải fail
  // lúc UPDATE giữa batch. Tập id HỢP LỆ cho lần chạy này = node của MÔN đang
  // gắn thẻ (∩ DB): một id môn khác lọt ra từ model là unknown-node, không ghi.
  const nodesRes = await supabase.from("skill_nodes").select("id, label_vi");
  if (nodesRes.error) throw nodesRes.error;
  const dbNodeIds = new Set((nodesRes.data ?? []).map((n) => n.id as string));
  if (dbNodeIds.size === 0) {
    throw new Error("skill_nodes rỗng — chạy `npx tsx supabase/seedSkillTaxonomy.ts` trước.");
  }
  const subjectNodes = skillNodesForSubject(subject);
  const missing = subjectNodes.filter((n) => !dbNodeIds.has(n.id)).map((n) => n.id);
  if (missing.length > 0 && apply) {
    throw new Error(
      `DB (${projectRef}) thiếu node ${subject} so với lib/adaptive/skillTaxonomy.ts: ${missing.join(", ")} — seed lại trước.`,
    );
  }
  if (missing.length > 0) {
    // Dry-run KHÔNG ghi nên không đụng khoá ngoại; cho phép chạy trước khi seed
    // để có report duyệt sớm (prod chỉ được seed sau khi deploy bản lọc định
    // tuyến — D6). Tập id hợp lệ vẫn là node của môn trong code; --apply với
    // cùng report sẽ fail ở nhánh trên cho tới khi seed.
    console.warn(
      `⚠ DB (${projectRef}) chưa có ${missing.length}/${subjectNodes.length} node ${subject} — ` +
        "dry-run vẫn chạy với danh mục trong code; phải seed trước khi --apply.",
    );
  }
  const knownNodeIds = new Set(subjectNodes.map((n) => n.id));
  const catalogue = subjectNodes.map((n) => ({ id: n.id, labelVi: n.labelVi }));

  const subjectAliases = [...new Set([subject, subjectLabel])];
  const corpusRes = await supabase
    .from("questions")
    .select("id, content, subject, grade, question_type, skill_node_id")
    .in("subject", subjectAliases)
    .order("id", { ascending: true });
  if (corpusRes.error) throw corpusRes.error;
  const corpus = (corpusRes.data ?? []) as CorpusQuestion[];

  const toClassify = corpus.filter((q) => q.skill_node_id === null);
  console.log(
    `Chế độ: ${apply ? "--APPLY (ghi thật)" : "DRY-RUN (không ghi)"} · ` +
      `${fromReport === null ? `model ${ANSWER_MODEL}, lô ${batchSize}` : `từ report ${fromReport}`} · ` +
      `env ${ENV_FILE} → ${projectRef} · môn ${subject} (${subjectAliases.join("/")}) · ` +
      `corpus ${corpus.length} câu (${toClassify.length} chưa có thẻ) · ngưỡng ${SKILL_TAG_CONFIDENCE_THRESHOLD} · ` +
      `${knownNodeIds.size} node của môn / ${dbNodeIds.size} node trong DB`,
  );
  if (corpus.length >= 1000) {
    console.warn("⚠ corpus chạm 1000 dòng — PostgREST cắt âm thầm ở max_rows, cần phân trang.");
  }

  // --- Nguồn phân loại: report đã duyệt, hoặc Gemini theo lô -----------------
  const classifications = new Map<string, SkillClassification | null>();
  let quotaStopped = false;
  let requests = 0;

  if (fromReport !== null) {
    const reportPath = resolve(process.cwd(), fromReport);
    if (!reportPath.includes(projectRef)) {
      throw new Error(
        `Report ${fromReport} không mang ref ${projectRef} trong tên file — report của môi trường khác.`,
      );
    }
    const parsed = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
    const reportSubject = (parsed as { meta?: { subject?: unknown } })?.meta?.subject;
    if (reportSubject !== undefined && reportSubject !== subject) {
      throw new Error(`Report là của môn ${String(reportSubject)}, đang chạy --subject=${subject}.`);
    }
    for (const [id, c] of classificationsFromReport(parsed)) classifications.set(id, c);
    const covered = toClassify.filter((q) => classifications.has(q.id)).length;
    console.log(`Report phủ ${covered}/${toClassify.length} câu chưa có thẻ.`);
  } else if (toClassify.length > 0) {
    const { GoogleGenAI } = await import("@google/genai");
    const gemini = new GoogleGenAI({
      apiKey: geminiKey as string,
      httpOptions: { retryOptions: { attempts: 3 } },
    });
    // Phân loại hàng loạt — cùng hạng chi phí/độ khó với việc "đọc file đáp án"
    // mà ANSWER_MODEL đã được ghim cho, nên dùng chung hằng số thay vì chép chuỗi.
    const model = ANSWER_MODEL;

    const batches = chunkBatches(
      toClassify.map<BatchQuestion>((q) => ({
        id: q.id,
        content: q.content,
        grade: q.grade,
        questionType: q.question_type,
      })),
      batchSize,
    );
    console.log(`→ ${batches.length} lô (tối đa ${batchSize} câu/lô).`);

    for (const [index, batch] of batches.entries()) {
      const ids = batch.map((q) => q.id);
      if (quotaStopped) {
        for (const id of ids) classifications.set(id, null);
        continue;
      }
      const prompt = buildBatchPrompt({ subject, subjectLabel, catalogue, questions: batch });
      console.log(`· lô ${index + 1}/${batches.length}: ${ids.length} câu`);
      requests += 1;
      const { byQuestionId, quota } = await classifyBatch(gemini, model, prompt, ids);
      for (const [id, c] of byQuestionId) classifications.set(id, c);
      if (quota) {
        quotaStopped = true;
        console.warn(
          "⚠ Gemini báo hết hạn ngạch (429) — dừng các lô còn lại. Câu chưa phân loại là " +
            "classification-error; chạy lại sau khi hạn ngạch reset (00:00 giờ Thái Bình Dương).",
        );
      } else if (index < batches.length - 1) {
        await sleep(THROTTLE_MS);
      }
    }
  }

  // --- Quyết định từng câu (cùng một cổng cho dry-run lẫn apply) -------------
  const entries: ReportEntry[] = [];

  for (const q of corpus) {
    // Câu đã có tag: KHÔNG gọi Gemini, không đọc report. Vừa tiết kiệm quota,
    // vừa là chỗ bảo đảm lần chạy --apply thứ hai không lật tag cũ sang node
    // khác (AC-006).
    const classification = q.skill_node_id === null ? (classifications.get(q.id) ?? null) : null;

    const d = decideSkillTag({
      existingSkillNodeId: q.skill_node_id,
      classification,
      knownNodeIds,
      threshold: SKILL_TAG_CONFIDENCE_THRESHOLD,
    });

    let wrote = false;
    if (apply && d.writeNeeded && d.skillNodeId !== null) {
      const upd = await supabase
        .from("questions")
        .update({ skill_node_id: d.skillNodeId })
        .eq("id", q.id)
        // Chỉ ghi khi cột vẫn đang NULL — nếu có tiến trình khác vừa gắn tag,
        // lần chạy này không đè lên.
        .is("skill_node_id", null);
      if (upd.error) throw upd.error;
      wrote = true;
    }

    entries.push({
      questionId: q.id,
      subject: q.subject,
      grade: q.grade,
      contentPrefix: q.content.slice(0, 120),
      modelSkillNodeId: classification?.skillNodeId ?? null,
      proposedSkillNodeId: d.skillNodeId,
      confidence: d.confidence,
      decision: d.decision,
      reason: d.reason,
      wrote,
    });

    const mark = d.decision === "tagged" ? "✓" : "·";
    console.log(
      `${mark} ${q.id} → ${d.skillNodeId ?? "NULL"} ` +
        `(${d.reason}${d.confidence === null ? "" : `, ${d.confidence.toFixed(2)}`}` +
        `${d.decision === "left-null" && classification?.skillNodeId ? `, model: ${classification.skillNodeId}` : ""})`,
    );
  }

  // Ref + môn nằm trong TÊN file: nhiều môi trường và nhiều môn sinh report
  // cùng hình dạng, và engineer duyệt 100% dòng "tagged" theo AC-008 dựa trên
  // chính file này — duyệt nhầm report của môi trường/môn kia là lỗi không có
  // gì bắt được. `--from-report` đối chiếu ref và môn trước khi ghi.
  const report: TaggingReport = {
    meta: {
      projectRef,
      subject,
      envFile: ENV_FILE,
      model: ANSWER_MODEL,
      threshold: SKILL_TAG_CONFIDENCE_THRESHOLD,
      batchSize,
      apply,
      fromReport,
      geminiKeyFingerprint: geminiKey === null ? null : keyFingerprint(geminiKey),
      generatedAt: new Date().toISOString(),
      corpusCount: corpus.length,
    },
    entries,
  };
  const reportPath = resolve(
    __dirname,
    `skill-tagging-report-${projectRef}-${subject.toLowerCase()}-${report.meta.generatedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  const byReason = new Map<string, number>();
  for (const e of entries) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + 1);
  const tagged = entries.filter((r) => r.decision === "tagged").length;
  const leftNull = entries.length - tagged;
  const written = entries.filter((r) => r.wrote).length;
  const coverage = corpus.length === 0 ? 0 : (tagged / corpus.length) * 100;

  console.log("");
  console.log(`Report: ${reportPath}`);
  console.log(
    `Tổng ${entries.length} câu = ${tagged} tagged + ${leftNull} left-null ` +
      `(ghi lần này: ${written} dòng; request Gemini: ${requests})`,
  );
  console.log(
    "Theo lý do: " +
      [...byReason.entries()].map(([reason, n]) => `${reason} ${n}`).join(" · "),
  );
  console.log(`Coverage: ${coverage.toFixed(1)}% (mốc dừng-xem-lại của PRD: 70%)`);

  // AC-007: mọi câu được xét phải có đúng một dòng trong report.
  if (entries.length !== corpus.length) {
    throw new Error(
      `Report có ${entries.length} dòng nhưng corpus có ${corpus.length} câu — có câu bị bỏ sót khỏi report.`,
    );
  }

  if (quotaStopped) {
    console.log("⚠ Hết hạn ngạch giữa chừng — report này CHƯA đủ để duyệt toàn bộ môn.");
  }
  if (corpus.length > 0 && coverage < 70) {
    console.log(
      "⚠ Coverage dưới 70%: đây là tín hiệu DỪNG-XEM-LẠI, không tự động là lỗi " +
        "(có thể ngưỡng đang đúng mức thận trọng). Ghi lại quyết định trước khi đi tiếp.",
    );
  }

  console.log(
    apply
      ? "✅ Đã apply."
      : "✅ Dry-run xong. Đọc report, duyệt 100% các dòng 'tagged', rồi chạy lại với --apply --from-report=<report>.",
  );
}

main().catch((err) => {
  console.error("❌ Batch gắn thẻ thất bại:", err.message ?? err);
  process.exit(1);
});
