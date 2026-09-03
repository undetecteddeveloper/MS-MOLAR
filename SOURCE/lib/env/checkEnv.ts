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

  // Cổng phát hành Premium (PRD R14). Mặc định TẮT là cố ý, nên "chưa đặt"
  // KHÔNG phải lỗi cấu hình — nhưng nó vẫn phải được NÓI RA lúc khởi động, vì
  // hình dạng hỏng mà AC-054 lo là "đặt ở môi trường này, hụt ở môi trường
  // kia": trên máy thì bán được, lên production thì nút chết mà không ai hiểu
  // vì sao. Đúng loại hỏng im lặng mà checkEnv sinh ra để bắt (TD-009).
  const paidTier = (get("GEMINI_PAID_TIER_ENABLED") ?? "").trim().toLowerCase();
  if (!paidTier) {
    problems.push({
      level: "warn",
      name: "GEMINI_PAID_TIER_ENABLED",
      impact: "Premium CHƯA mở bán — nút mua ở /pricing không khả dụng (fail-closed, cố ý)",
    });
  } else if (paidTier !== "1" && paidTier !== "true") {
    // Một giá trị như "yes"/"on"/"enabled" bị đọc là TẮT mà không báo ở đâu cả,
    // và triệu chứng ("nút mua chết") giống hệt ca chưa-đặt-biến.
    problems.push({
      level: "warn",
      name: "GEMINI_PAID_TIER_ENABLED",
      impact: `"${paidTier}" không phải giá trị bật — chỉ "1" hoặc "true" mới bật; hiện Premium vẫn KHÔNG bán được`,
    });
  }

  // --- payOS (ADR-0013/ADR-0014) --------------------------------------------
  // Ba credential này được đăng ký Ở ĐÂY trong chính thay đổi đầu tiên đọc tới
  // chúng — docs/project-context/external-resources.md § Payment Gateway đặt ra
  // nghĩa vụ đó. Mức `warn` theo đúng tiền lệ GEMINI_API_KEY: thiếu thì đường
  // thanh toán chết chứ app vẫn phục vụ mọi thứ khác, và một deploy sập trang
  // chủ vì thiếu credential payOS là đổi một hỏng hóc cục bộ lấy một sự cố
  // toàn site (xem docblock đầu file).
  if (!get("PAYOS_CLIENT_ID")) {
    problems.push({
      level: "warn",
      name: "PAYOS_CLIENT_ID",
      impact: "không tạo đơn được — /pricing/checkout hỏng ở bước gọi payOS, không ai mua được Premium",
    });
  }

  if (!get("PAYOS_API_KEY")) {
    problems.push({
      level: "warn",
      name: "PAYOS_API_KEY",
      impact: "không tạo đơn được — payOS từ chối payment request, và đối soát chủ động cũng hỏng",
    });
  }

  if (!get("PAYOS_CHECKSUM_KEY")) {
    // Ca đắt nhất trong ba: đơn VẪN tạo được, QR VẪN hiện, người dùng VẪN
    // chuyển tiền — chỉ có webhook là không xác minh được và bị từ chối im
    // lặng. Tiền vào tài khoản mà thuê bao không bao giờ được kích hoạt.
    problems.push({
      level: "warn",
      name: "PAYOS_CHECKSUM_KEY",
      impact:
        "không xác minh được chữ ký webhook payOS — người dùng chuyển tiền xong mà đơn KHÔNG BAO GIỜ được ghi nhận",
    });
  }

  // --- Ngân sách Gemini toàn dự án (PRD R7/AC-023/AC-025) --------------------
  // Hai biến, hai hướng hỏng NGƯỢC NHAU, và đó là điểm chính của khối này.
  const freeShare = get("AI_BUDGET_FREE_SHARE");
  if (!freeShare) {
    // Thiếu nó làm suy yếu một CHÍNH SÁCH (phần ngân sách ngày bảo lưu cho
    // Premium), không gỡ bỏ trần chi — nên chỉ cần nói ra giá trị mặc định.
    problems.push({
      level: "warn",
      name: "AI_BUDGET_FREE_SHARE",
      impact: "chưa đặt suất bảo lưu cho Premium — dùng mặc định 50% ngân sách ngày cho lưu lượng Free",
    });
  } else if (!(Number(freeShare) > 0)) {
    // KHÔNG kiểm khoảng giá trị: PRD (:218, AC-023) và Design Doc đều chỉ nói
    // "50%", không nói con số được mã hoá là phân số hay phần trăm — chỗ ĐỌC
    // (lib/billing/quota.ts) ghim việc đó. Ở đây chỉ bắt thứ SAI DƯỚI MỌI cách
    // mã hoá: "50%", "một nửa", "0".
    problems.push({
      level: "warn",
      name: "AI_BUDGET_FREE_SHARE",
      impact: `"${freeShare}" không phải một số dương — suất bảo lưu Premium sẽ rơi về mặc định 50%`,
    });
  }

  const budgetLimit = get("AI_BUDGET_DAILY_LIMIT");
  if (!budgetLimit) {
    // Hướng ngược lại hoàn toàn, và là lý do biến này được đăng ký (AC-025):
    // một TRẦN CHI bị thiếu không được phép đọc thành một trần vô hạn. Cùng
    // lối fail-closed với GEMINI_PAID_TIER_ENABLED ở trên (paidTier.ts:26):
    // quên đặt thì hậu quả là KHÔNG PHỤC VỤ, chứ không phải TIÊU KHÔNG GIỚI HẠN.
    problems.push({
      level: "warn",
      name: "AI_BUDGET_DAILY_LIMIT",
      impact:
        "chưa có trần chi Gemini ngày → mọi lượt gọi AI bị TỪ CHỐI (fail-closed, cố ý — thiếu trần KHÔNG có nghĩa là không giới hạn)",
    });
  } else if (!Number.isInteger(Number(budgetLimit)) || Number(budgetLimit) < 1) {
    // "unlimited"/"Infinity" là ca cần nói to nhất: người vận hành gõ nó với ý
    // "bỏ trần" và không có gì cãi lại — trong khi Design Doc ghim "integer,
    // no default". Giá trị 0 cũng bị bắt: nó tắt AI cho toàn dự án, và một
    // quyết định như thế phải là cố ý chứ không phải một chữ số gõ nhầm.
    problems.push({
      level: "warn",
      name: "AI_BUDGET_DAILY_LIMIT",
      impact: `"${budgetLimit}" không phải số nguyên dương — trần chi Gemini ngày không dùng được, mọi lượt gọi AI bị TỪ CHỐI`,
    });
  }

  // --- Chấm tự luận tự động qua Groq (ADR-0018) -----------------------------
  // Ba biến, và chúng KHÔNG cùng một hình dạng hỏng — đó là điểm chính của khối
  // này. Cả ba đăng ký ở mức `warn`: một môi trường chưa bật chấm tự luận là
  // môi trường HOÀN TOÀN HỢP LỆ, và nó đúng là trạng thái tính năng này ship.
  if (!get("GROQ_API_KEY")) {
    // Cùng khuôn GEMINI_API_KEY (:77-84): thiếu thì một mảng chức năng tắt chứ
    // app vẫn phục vụ mọi thứ khác, nên không được phép làm sập cả tiến trình.
    problems.push({
      level: "warn",
      name: "GROQ_API_KEY",
      impact:
        "không gọi được Groq — nếu chấm tự luận đang bật thì mọi câu tự luận hỏng ở bước gọi provider, học sinh thấy nút chấm lại thay vì điểm",
    });
  }

  const groqBudget = get("GROQ_BUDGET_DAILY_LIMIT");
  if (!groqBudget) {
    // Fail-closed, y hệt AI_BUDGET_DAILY_LIMIT (:217-239) và vì cùng một lý do:
    // một TRẦN CHI bị thiếu không được phép đọc thành trần vô hạn. Trần này là
    // của Groq chứ không dùng chung với Gemini (AC-030) — một trần cho hai nhà
    // cung cấp thì một ngày chấm nặng đúng là thứ tắt gia sư đi.
    problems.push({
      level: "warn",
      name: "GROQ_BUDGET_DAILY_LIMIT",
      impact:
        "chưa có trần chi Groq ngày → mọi lượt chấm tự luận bị TỪ CHỐI (fail-closed, cố ý — thiếu trần KHÔNG có nghĩa là không giới hạn)",
    });
  } else if (!Number.isInteger(Number(groqBudget)) || Number(groqBudget) < 1) {
    problems.push({
      level: "warn",
      name: "GROQ_BUDGET_DAILY_LIMIT",
      impact: `"${groqBudget}" không phải số nguyên dương — trần chi Groq ngày không dùng được, mọi lượt chấm tự luận bị TỪ CHỐI`,
    });
  }

  // Quy tắc đọc ở MỌI chỗ đọc: "true" (đã trim) bật; mọi giá trị khác, kể cả
  // vắng mặt, TẮT. Mức `warn` chứ không `error` là cố ý (AC-067).
  const essayGrading = get("ESSAY_GRADING_ENABLED");
  if (!essayGrading) {
    problems.push({
      level: "warn",
      name: "ESSAY_GRADING_ENABLED",
      impact:
        "chưa bật chấm tự luận → mọi câu tự luận vẫn hiện 'chưa chấm tự động', đúng như trước tính năng này (môi trường hợp lệ — đây là trạng thái ship)",
    });
  } else if (essayGrading !== "true") {
    // Cái bẫy riêng của biến này, và là lý do nhánh thứ hai tồn tại: ngay TRONG
    // file này, GEMINI_PAID_TIER_ENABLED nhận CẢ "1" lẫn "true". Người vận hành
    // gõ `ESSAY_GRADING_ENABLED=1` theo trí nhớ từ biến kia sẽ được đọc là TẮT,
    // và triệu chứng giống hệt ca chưa-đặt-biến. Đúng kiểu hỏng im lặng TD-009
    // sinh ra checkEnv để chặn. "TRUE" viết hoa cũng rơi vào đây: phép so khớp
    // ở các chỗ đọc là NGUYÊN VĂN, không hạ chữ thường.
    problems.push({
      level: "warn",
      name: "ESSAY_GRADING_ENABLED",
      impact: `"${essayGrading}" không phải giá trị bật — CHỈ "true" (chữ thường) mới bật; chấm tự luận hiện vẫn TẮT`,
    });
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
    "  Trên Vercel: Settings → Environment Variables",
    "═".repeat(78),
    "",
  ].join("\n");
}
