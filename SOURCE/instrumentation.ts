// Next.js instrumentation — `register()` chạy MỘT LẦN lúc server khởi động,
// trước request đầu tiên. Đây là chỗ duy nhất trong Next chạy đúng một lần cho
// cả tiến trình, nên là chỗ đúng để kiểm cấu hình (TD-009).
//
// Đặt trong route handler hay layout thì check sẽ chạy lại mỗi request (ồn) và
// vẫn sót những trang không đi qua chỗ đó. Đặt ở đây thì một lần khởi động sai
// cấu hình = một khối log đọc được ở đầu Vercel Runtime Logs, ngay trên dòng
// request đầu tiên.
import { checkEnv, formatEnvReport } from "@/lib/env/checkEnv";

export async function register() {
  // Chỉ chạy ở runtime nodejs. Edge runtime nạp module này riêng một lần nữa
  // và không thấy các biến chỉ-có-ở-server, nên chạy ở đó chỉ sinh báo động giả.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const report = formatEnvReport(checkEnv(process.env));
  if (report) console.warn(report);
}
