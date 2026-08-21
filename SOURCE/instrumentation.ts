// Next.js instrumentation — `register()` chạy MỘT LẦN lúc server khởi động,
// trước request đầu tiên. Đây là chỗ duy nhất trong Next chạy đúng một lần cho
// cả tiến trình, nên là chỗ đúng để kiểm cấu hình (TD-009).
//
// Đặt trong route handler hay layout thì check sẽ chạy lại mỗi request (ồn) và
// vẫn sót những trang không đi qua chỗ đó. Đặt ở đây thì một lần khởi động sai
// cấu hình = một khối log đọc được ở đầu Vercel Runtime Logs, ngay trên dòng
// request đầu tiên.
// TD-017 — KHÔNG import tĩnh gì ở đầu file này.
//
// Next nạp `instrumentation.ts` cho MỌI runtime, kể cả Edge (proxy.ts). Import
// tĩnh kéo cả cây phụ thuộc vào bundle Edge lúc BUILD, không cần biết
// `register()` có chạy tới nhánh đó hay không — và
// `checkSchemaVersion` → `schemaFingerprint` dùng `node:crypto`, thứ không tồn
// tại trên Edge. Trước đây Turbopack chỉ WARN nên vẫn deploy được; một bản
// runtime siết chặt hơn sẽ biến cảnh báo đó thành lỗi trên mọi request đi qua
// proxy.ts (gần như toàn site).
//
// `await import(...)` bên TRONG nhánh runtime check giữ cây phụ thuộc lại ở
// phía nodejs: Edge chỉ nạp đúng hàm rỗng bail-out ở dòng đầu.

export async function register() {
  // Chỉ chạy ở runtime nodejs. Edge runtime nạp module này riêng một lần nữa
  // và không thấy các biến chỉ-có-ở-server, nên chạy ở đó chỉ sinh báo động giả.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkEnv, formatEnvReport } = await import("@/lib/env/checkEnv");
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
    const { checkSchemaVersion, formatSchemaVersionReport } = await import(
      "@/lib/schema/checkSchemaVersion"
    );
    const schemaReport = formatSchemaVersionReport(await checkSchemaVersion(process.env));
    if (schemaReport) console.warn(schemaReport);
  } catch (err) {
    console.warn("! SCHEMA: check phiên bản schema hỏng bất ngờ —", err);
  }
}
