// Build-time check: BÍ MẬT SERVER-ONLY không nằm trong client bundle.
//
// Chạy SAU `next build`:  node scripts/check-ai-key-bundle.mjs
// (script npm: `npm run check:bundle` — build trước rồi check).
//
// Phủ các bí mật server-only của repo:
//   1) GEMINI_API_KEY (UGC v2.0, PRD metric 6) — lib/ugc/gemini.ts.
//   2) SUPABASE_SERVICE_ROLE_KEY (Security review 2026-08-03 #2) —
//      lib/supabase/service-role.ts. Key này BYPASS TOÀN BỘ RLS, lộ ra client
//      là mất sạch mọi tầng bảo vệ của dự án cùng lúc, nên đáng canh gắt hơn cả
//      AI key (lộ AI key chỉ tốn tiền).
//   3) SUPPORT_SMTP_APP_PASSWORD (ADR-0012) — lib/mail/.
//   4) BA THÔNG TIN XÁC THỰC payOS (ADR-0013/ADR-0014, Integration Point I8) —
//      lib/billing/payos/. `PAYOS_CHECKSUM_KEY` là khoá KÝ: ai cầm nó thì ký
//      được webhook. ADR-0014 đã hạ giá trị của nó xuống — thân webhook chỉ là
//      GỢI Ý, `settleOrder()` vẫn hỏi lại payOS trước mỗi lượt ghi — nhưng nó
//      vẫn cho phép sai khiến server ta gọi ra ngoài, và `PAYOS_API_KEY` thì
//      nói chuyện trực tiếp được với tài khoản merchant.
//   5) KV_REST_API_TOKEN (Upstash Redis) — lib/security/rateLimitStore.ts,
//      lib/billing/readEntitlement.ts. Token này ghi/đọc được toàn bộ store
//      rate-limit và cache entitlement; lộ ra client là bỏ được mọi hạn mức.
//      Trước đây nó là bí mật server-only DUY NHẤT không có marker nào — được
//      thêm cùng lượt với payOS (quét cạnh của plan Task 4.1).
//   6) GROQ_API_KEY (ADR-0018) — lib/essay/groqClient.ts, điểm phát Groq DUY
//      NHẤT. Mục này được thêm TRƯỚC module mà nó canh: guard sẵn sàng trước
//      thứ nó canh thì không có cửa sổ nào key đi trước lưới.
//
// Cơ chế: quét .next-build/static (mọi thứ ship xuống browser) tìm giá trị thật
// của từng key (đọc từ env/.env.local nếu có) + các marker chỉ xuất hiện khi
// module server-only bị bundle nhầm.
// Lớp chặn thứ nhất là `import "server-only"` trong chính 2 module đó (build
// fail ngay khi client import); script này là lưới an toàn thứ hai.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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

const envLocal = loadEnvLocal();
const read = (name) => process.env[name] ?? envLocal[name];

// `markers` = chuỗi chỉ có thể lọt vào bundle khi module server-only bị import
// nhầm từ client. `value` = chính giá trị bí mật (chỉ check khi đọc được).
//
// ĐƯỢC EXPORT để `lib/security/checkAiKeyBundleSecrets.test.ts` ghim nguyên văn
// nhãn + marker. Trên CI, `markers` là TOÀN BỘ tấm lưới: bước "Check bundle"
// của .github/workflows/ci.yml không có khối `env:` nào (bốn giá trị giả chỉ
// thuộc phạm vi bước Build) và `.env.local` không tồn tại ở đó, nên cả TÁM
// `value` là `undefined`, cả TÁM dòng cảnh báo được in, và nhánh so-khớp-GIÁ-TRỊ
// chạy 0 trên 8 lần. Không cấu hình nào của workflow này làm nó chạy hữu ích
// được, vì thứ nó sẽ quét chính là mấy chuỗi placeholder mà build vừa nướng vào.
export const SECRETS = [
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
    // "record_payment_settlement" là hàm SQL cùng file — đường DUY NHẤT kéo dài
    // được entitlement (ADR-0014 Decision 3). Nó đắt hơn hẳn: một client bundle
    // chứa tên này nghĩa là module cầm khoá bypass-RLS đã đi kèm cả đường ghi
    // vào tiền.
    markers: [
      "SUPABASE_SERVICE_ROLE_KEY",
      "record_exam_result",
      "record_payment_settlement",
    ],
  },
  {
    label: "Support mail SMTP credential (ADR-0012)",
    value: read("SUPPORT_SMTP_APP_PASSWORD"),
    // "nodemailer" chỉ được import trong lib/mail/sendSupportNotification.ts
    // (Node-only, không "use client") — lọt vào bundle là dấu hiệu module
    // server-only bị import nhầm từ client.
    markers: ["SUPPORT_SMTP_APP_PASSWORD", "SUPPORT_SMTP_USER", "nodemailer"],
  },
  {
    label: "payOS checksum key (ADR-0014)",
    value: read("PAYOS_CHECKSUM_KEY"),
    // "api-merchant.payos.vn" chơi đúng vai của "generativelanguage.googleapis
    // .com" ở mục AI key: host này CHỈ được viết ra trong lib/billing/payos/
    // index.ts, module có `import "server-only"`. Nó bắt được cả ca tệ hơn tên
    // biến env — một module adapter bị kéo nguyên xuống client.
    markers: ["PAYOS_CHECKSUM_KEY", "api-merchant.payos.vn"],
  },
  {
    label: "payOS API key (ADR-0013)",
    value: read("PAYOS_API_KEY"),
    markers: ["PAYOS_API_KEY"],
  },
  {
    // Không phải bí mật theo nghĩa hẹp, nhưng nó là NỬA CÒN LẠI của cặp xác
    // thực merchant: có API key mà thiếu client id thì không gọi được gì.
    label: "payOS client id (ADR-0013)",
    value: read("PAYOS_CLIENT_ID"),
    markers: ["PAYOS_CLIENT_ID"],
  },
  {
    label: "Upstash Redis token",
    value: read("KV_REST_API_TOKEN"),
    markers: ["KV_REST_API_TOKEN", "KV_REST_API_URL"],
  },
  {
    label: "Groq API key (ADR-0018)",
    value: read("GROQ_API_KEY"),
    // "api.groq.com" chơi đúng vai của "generativelanguage.googleapis.com" ở
    // mục AI key và "api-merchant.payos.vn" ở mục payOS: host này CHỈ được viết
    // ra trong lib/essay/groqClient.ts, module có `import "server-only"`. Marker
    // theo host bắt được ca TỆ HƠN tên biến env — nguyên một module adapter bị
    // kéo xuống client, mà tên biến env thì bundler có thể tree-shake mất.
    // KHÔNG dùng tên gói SDK làm marker: không có SDK (ADR-0018 Decision 5).
    //
    // Chuỗi host này là marker của GUARD, và nó phải KHÁC chuỗi mà phép quét bề
    // mặt phát dùng làm khoá (ADR-0018 Implementation Guidance #5b): chính tệp
    // này chứa "api.groq.com", nên một phép quét khoá theo host sẽ xếp cổng
    // bundle vào diện điểm phát và biến guard mạnh nhất repo thành danh sách
    // ngoại lệ. Phép quét đó keys theo ĐỊNH DANH hằng endpoint / lượt import.
    markers: ["GROQ_API_KEY", "api.groq.com"],
  },
];

// Thân CLI, nguyên văn như trước — chỉ được bọc vào một hàm và gọi CHỈ KHI file
// này là entry point. Không có lớp bọc đó thì một lượt `import { SECRETS }` từ
// test sẽ chạy luôn cả lượt quét và `process.exit(1)` khi chưa có bản build.
function main() {
  if (!existsSync(STATIC_DIR)) {
    console.error(`❌ Không thấy ${STATIC_DIR} — chạy \`next build\` trước.`);
    process.exit(1);
  }

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
  console.log(
    `✅ Server-secret bundle check PASS — ${SECRETS.length} bí mật server-only không xuống client.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
