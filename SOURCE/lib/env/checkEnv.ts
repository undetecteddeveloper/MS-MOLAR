// Kiểm cấu hình môi trường lúc KHỞI ĐỘNG (trả nốt TD-009, 2026-08-04).
//
// Vấn đề mà file này đóng: mọi biến env của dự án đều fail-closed một cách IM
// LẶNG. Quên `ADMIN_USER_IDS` → không ai là admin → `/admin` trả 404, y hệt như
// khi bạn đăng nhập nhầm tài khoản. Quên `GEMINI_API_KEY` → `/upload` hỏng đúng
// lúc người dùng vừa chờ xong pipeline bóc đề. Gõ sai `NEXT_PUBLIC_SUPABASE_URL`
// → `next.config.ts` nuốt lỗi parse, `img-src` mất origin Supabase, ảnh đề biến
// mất mà console chỉ nói "blocked by CSP". Không cái nào tự khai là lỗi cấu
// hình, nên chúng chỉ lộ ra ở đúng lúc tệ nhất.
//
// `.env.example` (đã thêm 2026-08-04) trả lời được "có những biến gì"; file này
// trả lời "môi trường ĐANG CHẠY có đủ chúng không" — hai câu hỏi khác nhau, và
// chỉ câu thứ hai mới bắt được máy mới / deploy mới bị thiếu biến.
//
// CỐ Ý KHÔNG throw. Ném lỗi trong `register()` của instrumentation làm chết cả
// tiến trình server, kể cả những trang không liên quan đến biến bị thiếu; một
// deploy thiếu `GEMINI_API_KEY` mà làm sập luôn trang chủ là đổi một hỏng hóc
// cục bộ lấy một sự cố toàn site. Ở đây in ra thật to rồi để app chạy tiếp.

/** Một biến bị thiếu/không hợp lệ, kèm hệ quả cụ thể chứ không phải "invalid". */
export interface EnvProblem {
  /** `error` = tính năng lõi hỏng; `warn` = một mảng chức năng lặng lẽ tắt. */
  level: "error" | "warn";
  name: string;
  /** Cái gì sẽ hỏng, mô tả bằng thứ người vận hành quan sát được. */
  impact: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Soi một bộ env và trả về danh sách vấn đề. Hàm THUẦN (nhận env làm tham số,
 * không đọc `process.env`, không in gì) để test được mà không phải mutate biến
 * toàn cục của tiến trình test.
 */
export function checkEnv(env: Readonly<Record<string, string | undefined>>): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const get = (k: string) => env[k]?.trim() ?? "";

  // --- Bắt buộc: thiếu là app không phục vụ được request nào có ý nghĩa -----
  const url = get("NEXT_PUBLIC_SUPABASE_URL");
  if (!url) {
    problems.push({
      level: "error",
      name: "NEXT_PUBLIC_SUPABASE_URL",
      impact: "mọi truy vấn Supabase hỏng — đăng nhập, danh sách đề, làm bài đều chết",
    });
  } else if (!isParseableHttpUrl(url)) {
    // next.config.ts `try { new URL(raw) } catch { return "" }` — sai URL không
    // ném lỗi mà chỉ làm `img-src`/`connect-src` mất origin Supabase, tức ảnh đề
    // và mọi fetch bị CSP chặn với thông báo không hề nhắc tới env.
    problems.push({
      level: "error",
      name: "NEXT_PUBLIC_SUPABASE_URL",
      impact: `"${url}" không parse được thành URL http(s) — CSP sẽ rụng origin Supabase, ảnh đề và fetch bị chặn`,
    });
  }

  if (!get("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    problems.push({
      level: "error",
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      impact: "client Supabase không khởi tạo được — không đăng nhập được",
    });
  }

  if (!get("SUPABASE_SERVICE_ROLE_KEY")) {
    problems.push({
      level: "error",
      name: "SUPABASE_SERVICE_ROLE_KEY",
      impact:
        "mọi ghi vượt RLS hỏng: chấm điểm (record_exam_result), duyệt/gỡ đề ở /admin, pipeline UGC",
    });
  }

  // --- Tuỳ chọn: có thể vắng, nhưng vắng thì phải NÓI ----------------------
  if (!get("GEMINI_API_KEY")) {
    problems.push({
      level: "warn",
      name: "GEMINI_API_KEY",
      impact: "pipeline bóc đề UGC tắt — /upload sẽ lỗi ở bước gọi Gemini",
    });
  }

  // User Support System v1 (ADR-0012) — thiếu 1 trong 3 biến này thì
  // sendSupportNotification tự degrade về { ok: false }, KHÔNG chặn ticket
  // commit (D5/AC-031) — nên chỉ warn, không error, mirror GEMINI_API_KEY.
  if (!get("SUPPORT_NOTIFY_EMAIL")) {
    problems.push({
      level: "warn",
      name: "SUPPORT_NOTIFY_EMAIL",
      impact: "không có hộp thư nhận ticket hỗ trợ — vé vẫn được ghi nhận nhưng không ai được báo qua email",
    });
  }

  if (!get("SUPPORT_SMTP_USER")) {
    problems.push({
      level: "warn",
      name: "SUPPORT_SMTP_USER",
      impact: "sendSupportNotification không xác thực được với Gmail SMTP — mọi email báo ticket sẽ lỗi âm thầm",
    });
  }

  if (!get("SUPPORT_SMTP_APP_PASSWORD")) {
    problems.push({
      level: "warn",
      name: "SUPPORT_SMTP_APP_PASSWORD",
      impact: "sendSupportNotification không xác thực được với Gmail SMTP — mọi email báo ticket sẽ lỗi âm thầm",
    });
  }

  const admins = get("ADMIN_USER_IDS");
  if (!admins) {
    problems.push({
      level: "warn",
      name: "ADMIN_USER_IDS",
      impact: "KHÔNG AI là admin → /admin trả 404 cho mọi người (fail-closed, cố ý)",
    });
  } else {
    // Một id gõ sai không báo lỗi ở đâu cả: `isAdminUserId` chỉ so chuỗi, nên
    // người đó đơn giản là không phải admin — không phân biệt được với "chưa
    // cấu hình". Đây đúng là kiểu hỏng mà TD-009 nói tới.
    const bad = admins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !UUID_RE.test(s));
    if (bad.length > 0) {
      problems.push({
        level: "warn",
        name: "ADMIN_USER_IDS",
        impact: `${bad.length} giá trị không phải UUID (${bad.join(", ")}) — những id đó sẽ KHÔNG bao giờ khớp, /admin trả 404 cho họ`,
      });
    }
  }

  const siteUrl = get("NEXT_PUBLIC_SITE_URL");
  if (siteUrl && !isParseableHttpUrl(siteUrl)) {
    problems.push({
      level: "warn",
      name: "NEXT_PUBLIC_SITE_URL",
      impact: `"${siteUrl}" không phải URL tuyệt đối — canonical/Open Graph/sitemap sẽ sinh link hỏng`,
    });
  }

  return problems;
}

function isParseableHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Định dạng báo cáo cho log server. Rỗng = không có vấn đề gì. */
export function formatEnvReport(problems: EnvProblem[]): string {
  if (problems.length === 0) return "";
  const line = (p: EnvProblem) =>
    `  ${p.level === "error" ? "✗" : "!"} ${p.name} — ${p.impact}`;
  const errors = problems.filter((p) => p.level === "error");
  const warns = problems.filter((p) => p.level === "warn");
  return [
    "",
    "═".repeat(78),
    errors.length > 0
      ? `CẤU HÌNH THIẾU: ${errors.length} biến BẮT BUỘC chưa đặt/không hợp lệ`
      : "CẤU HÌNH: app chạy được, nhưng có phần đang tắt vì thiếu biến",
    ...errors.map(line),
    ...(warns.length > 0 ? ["", "  (không chặn app chạy:)", ...warns.map(line)] : []),
    "",
    "  Danh sách đầy đủ + cách lấy giá trị: SOURCE/.env.example",
    "  Trên Vercel: Settings → Environment Variables (docs/DEPLOYMENT.md § 2.2)",
    "═".repeat(78),
    "",
  ].join("\n");
}
