// Next.js instrumentation — `register()` chạy MỘT LẦN lúc server khởi động,
// trước request đầu tiên. Đây là chỗ duy nhất trong Next chạy đúng một lần cho
// cả tiến trình, nên là chỗ đúng để kiểm cấu hình (TD-009).
//
// Đặt trong route handler hay layout thì check sẽ chạy lại mỗi request (ồn) và
// vẫn sót những trang không đi qua chỗ đó. Đặt ở đây thì một lần khởi động sai
// cấu hình = một khối log đọc được ở đầu Vercel Runtime Logs, ngay trên dòng
// request đầu tiên.
import { checkEnv, formatEnvReport } from "@/lib/env/checkEnv";
import { checkSchemaVersion, formatSchemaVersionReport } from "@/lib/schema/checkSchemaVersion";

export async function register() {
  // Chỉ chạy ở runtime nodejs. Edge runtime nạp module này riêng một lần nữa
  // và không thấy các biến chỉ-có-ở-server, nên chạy ở đó chỉ sinh báo động giả.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const envReport = formatEnvReport(checkEnv(process.env));
  if (envReport) console.warn(envReport);

  // TD-005 — DB có đang chạy cùng bản schema.sql với code này không.
  //
  // Chạy SAU check env và không chạy song song, cố ý: nếu thiếu env Supabase
  // thì check này chỉ trả "unknown" vì đúng nguyên nhân vừa được báo ở trên, và
  // hai khối log về cùng một sự cố đọc như hai sự cố.
  //
  // Có `await`: `register()` chạy trước request đầu tiên, một lượt fetch có
  // timeout 3s là cái giá cho mỗi cold start, không phải mỗi request. Nuốt lỗi
  // ở đây vì một cảnh báo vận hành không được phép làm chết tiến trình server
  // (cùng quyết định với TD-009).
  try {
    const schemaReport = formatSchemaVersionReport(await checkSchemaVersion(process.env));
    if (schemaReport) console.warn(schemaReport);
  } catch (err) {
    console.warn("! SCHEMA: check phiên bản schema hỏng bất ngờ —", err);
  }
}
