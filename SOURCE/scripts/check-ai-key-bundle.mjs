// Build-time check: BÍ MẬT SERVER-ONLY không nằm trong client bundle.
//
// Chạy SAU `next build`:  node scripts/check-ai-key-bundle.mjs
// (script npm: `npm run check:bundle` — build trước rồi check).
//
// Phủ 2 bí mật:
//   1) GEMINI_API_KEY (UGC v2.0, PRD metric 6) — lib/ugc/gemini.ts.
//   2) SUPABASE_SERVICE_ROLE_KEY (Security review 2026-08-03 #2) —
//      lib/supabase/service-role.ts. Key này BYPASS TOÀN BỘ RLS, lộ ra client
//      là mất sạch mọi tầng bảo vệ của dự án cùng lúc, nên đáng canh gắt hơn cả
//      AI key (lộ AI key chỉ tốn tiền).
//
// Cơ chế: quét .next-build/static (mọi thứ ship xuống browser) tìm giá trị thật
// của từng key (đọc từ env/.env.local nếu có) + các marker chỉ xuất hiện khi
// module server-only bị bundle nhầm.
// Lớp chặn thứ nhất là `import "server-only"` trong chính 2 module đó (build
// fail ngay khi client import); script này là lưới an toàn thứ hai.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
// `.next-build` — production distDir tách riêng khỏi dev (next.config.ts S#36).
const STATIC_DIR = join(ROOT, ".next-build", "static");

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

if (!existsSync(STATIC_DIR)) {
  console.error(`❌ Không thấy ${STATIC_DIR} — chạy \`next build\` trước.`);
  process.exit(1);
}

const envLocal = loadEnvLocal();
const read = (name) => process.env[name] ?? envLocal[name];

// `markers` = chuỗi chỉ có thể lọt vào bundle khi module server-only bị import
// nhầm từ client. `value` = chính giá trị bí mật (chỉ check khi đọc được).
const SECRETS = [
  {
    label: "AI key",
    value: read("GEMINI_API_KEY"),
    markers: ["GEMINI_API_KEY", "@google/genai", "generativelanguage.googleapis.com"],
  },
  {
    label: "Supabase service-role key",
    value: read("SUPABASE_SERVICE_ROLE_KEY"),
    // "record_exam_result" là marker rẻ mà chắc: tên RPC này CHỈ xuất hiện
    // trong lib/supabase/service-role.ts, module không bao giờ được xuống client.
    markers: ["SUPABASE_SERVICE_ROLE_KEY", "record_exam_result"],
  },
];

for (const s of SECRETS) {
  if (!s.value) {
    // Không fail: CI/máy khác có thể không có sẵn env. Marker vẫn được quét.
    console.warn(`⚠ Không đọc được giá trị ${s.label} — chỉ quét theo marker.`);
  }
}

let failures = 0;
for (const file of walk(STATIC_DIR)) {
  const content = readFileSync(file, "utf8");
  for (const s of SECRETS) {
    if (s.value && content.includes(s.value)) {
      console.error(`❌ GIÁ TRỊ ${s.label} xuất hiện trong client bundle: ${file}`);
      failures += 1;
    }
    for (const marker of s.markers) {
      if (content.includes(marker)) {
        console.error(
          `❌ Marker server-only "${marker}" (${s.label}) trong client bundle: ${file}`
        );
        failures += 1;
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n❌ Server-secret bundle check FAIL (${failures} phát hiện).`);
  process.exit(1);
}
console.log("✅ Server-secret bundle check PASS — AI key + service-role key không xuống client.");
