// Setup Storage (UGC v2.0, Task 1.1) — tạo 2 bucket exam-images & exam-uploads.
//
// Idempotent: bucket đã tồn tại → bỏ qua. Cả 2 bucket đều PRIVATE (public=false);
// quyền đọc/ghi do RLS policies trên storage.objects quyết định (schema.sql §8).
//
// Cách chạy:  cd SOURCE && npx tsx supabase/setup-storage.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const BUCKETS = ["exam-images", "exam-uploads", "support-screenshots"] as const;

// support-screenshots: private, giới hạn kích thước/MIME ở tầng Storage (backstop) —
// xem node_modules/@supabase/storage-js/dist/index.d.mts:1809-1812 cho field names.
const BUCKET_OPTIONS: Partial<
  Record<(typeof BUCKETS)[number], { fileSizeLimit: string; allowedMimeTypes: string[] }>
> = {
  "support-screenshots": {
    fileSizeLimit: "8MB", // LIMITS.MAX_SCREENSHOT_BYTES mirror
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], // LIMITS.ALLOWED_SCREENSHOT_MIME mirror
  },
};

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service)
    throw new Error("Thiếu URL / SERVICE_ROLE_KEY trong .env.local");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existing = await admin.storage.listBuckets();
  if (existing.error) throw existing.error;
  const names = new Set(existing.data.map((b) => b.name));

  for (const bucket of BUCKETS) {
    if (names.has(bucket)) {
      console.log(`✓ Bucket "${bucket}" đã tồn tại — bỏ qua.`);
      continue;
    }
    const { error } = await admin.storage.createBucket(bucket, {
      public: false,
      ...BUCKET_OPTIONS[bucket],
    });
    if (error) throw error;
    console.log(`✓ Đã tạo bucket "${bucket}" (private).`);
  }

  console.log("✅ Storage setup xong.");
}

main().catch((err) => {
  console.error("❌ Storage setup lỗi:", err.message ?? err);
  process.exit(1);
});
