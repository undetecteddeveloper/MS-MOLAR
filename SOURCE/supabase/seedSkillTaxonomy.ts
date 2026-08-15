// Seed cây kỹ năng Toán (Engine 1 Adaptive AI & Feedback, PRD R1) — đẩy dữ
// liệu đã duyệt ở lib/adaptive/skillTaxonomy.ts vào skill_nodes /
// skill_prerequisites. Dùng service_role key (bypass RLS), CHỈ chạy local.
//
// Cách chạy (sau khi đã apply §9b của schema.sql trong Supabase SQL Editor):
//   cd SOURCE
//   npx tsx supabase/seedSkillTaxonomy.ts
//
// Idempotent (upsert theo khoá chính) — chạy lại không sinh dòng trùng. Mượn
// nguyên pattern nạp env + tạo client của supabase/seed.ts.
//
// Phạm vi: CHỈ taxonomy. Không đụng questions.skill_node_id — việc gắn thẻ câu
// hỏi là của supabase/tagQuestionSkills.ts (backend-task-06).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  SKILL_NODES,
  SKILL_PREREQUISITES,
  validateDag,
} from "../lib/adaptive/skillTaxonomy";

// --- Nạp env từ .env.local (tsx không tự load như Next.js) ----------------
function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
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

async function main() {
  // Chặn TRƯỚC khi ghi: một DAG hỏng (chu trình / cạnh treo) mà lọt xuống DB
  // thì recommendNextSkill() sẽ đọc nó như dữ liệu tin cậy được — Data Contract
  // của hàm đó nói rõ nó KHÔNG tự validate lại mỗi lần gọi vì lý do hiệu năng,
  // và coi cổng chặn chính là chỗ này (AC-001/002).
  const dag = validateDag(SKILL_NODES, SKILL_PREREQUISITES);
  if (!dag.valid) {
    throw new Error(
      `Cây kỹ năng không hợp lệ, KHÔNG seed. Chu trình: [${dag.cycleNodeIds.join(", ")}]; ` +
        `cạnh treo: ${JSON.stringify(dag.danglingEdges)}`,
    );
  }

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nodeRows = SKILL_NODES.map((n) => ({ id: n.id, label_vi: n.labelVi }));
  const edgeRows = SKILL_PREREQUISITES.map((e) => ({
    skill_node_id: e.skillNodeId,
    prerequisite_node_id: e.prerequisiteNodeId,
  }));

  // node trước (skill_prerequisites có FK trỏ về skill_nodes cả hai cột).
  // onConflict "id": khoá chính — chạy lại là UPDATE label_vi, không sinh dòng
  // mới. Không truyền onConflict thì postgrest vẫn dùng PK, nhưng ghi rõ ra để
  // ý định không phụ thuộc mặc định của thư viện.
  const nodes = await supabase.from("skill_nodes").upsert(nodeRows, { onConflict: "id" });
  if (nodes.error) throw nodes.error;
  console.log(`✓ Seed ${nodeRows.length} node kỹ năng.`);

  const edges = await supabase
    .from("skill_prerequisites")
    .upsert(edgeRows, { onConflict: "skill_node_id,prerequisite_node_id" });
  if (edges.error) throw edges.error;
  console.log(`✓ Seed ${edgeRows.length} cạnh tiên quyết.`);

  // Đếm lại từ DB thay vì tin vào việc upsert không báo lỗi: đây chính là phép
  // đo mà Completion Criteria của backend-task-05 yêu cầu (chạy 2 lần, lần 2
  // không sinh dòng trùng). In ra để engineer đối chiếu giữa hai lần chạy.
  const nodeCount = await supabase
    .from("skill_nodes")
    .select("*", { count: "exact", head: true });
  if (nodeCount.error) throw nodeCount.error;

  const edgeCount = await supabase
    .from("skill_prerequisites")
    .select("*", { count: "exact", head: true });
  if (edgeCount.error) throw edgeCount.error;

  console.log(
    `→ Trong DB sau khi seed: ${nodeCount.count} node / ${edgeCount.count} cạnh ` +
      `(kỳ vọng ${nodeRows.length} / ${edgeRows.length}).`,
  );

  if (nodeCount.count !== nodeRows.length || edgeCount.count !== edgeRows.length) {
    throw new Error(
      "Số dòng trong DB lệch so với dữ liệu seed — có dòng thừa/thiếu, kiểm tra trước khi chạy tagQuestionSkills.ts.",
    );
  }

  console.log("✅ Seed cây kỹ năng hoàn tất.");
}

main().catch((err) => {
  console.error("❌ Seed cây kỹ năng thất bại:", err.message ?? err);
  process.exit(1);
});
