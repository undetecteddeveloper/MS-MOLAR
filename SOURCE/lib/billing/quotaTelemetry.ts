// Ánh xạ OK-04 — ba lý do từ chối của `consumeQuota()` → ba mã
// `telemetry_log.error_code` (backend DD § OK-04, plan Task 5.5).
//
// Module này là một module THƯỜNG, KHÔNG có chỉ thị `"use server"`, và đó là
// toàn bộ lý do nó tồn tại. Hai chỗ từ chối — `features/authoring/actions.ts` (cổng
// upload) và `features/exams/tutorActions.ts` (cổng gia sư) — đều là file
// `"use server"`, tức mọi export của chúng phải là hàm async: chúng không thể
// export nổi một hằng dùng chung cho nhau. Chỉ thị ấy hạn chế EXPORT, không hạn
// chế IMPORT, nên một module thứ ba như file này là chỗ hợp nhất hợp lệ duy
// nhất. Trước đây mỗi bên giữ một bản sao literal và KHÔNG có gì ghim chúng vào
// nhau: `satisfies Record<…>` chỉ khoá TẬP KHOÁ và MIỀN GIÁ TRỊ, không khoá
// từng cặp, nên `user_quota: "server"` vẫn biên dịch được ở một bên trong khi
// bên kia giữ giá trị đúng — hai bảng trôi lệch nhau trong im lặng.
//
// Bảng KHÔNG nằm trong `quota.ts`: hàm ấy không biết gì về telemetry, và không
// được biết — nó trả lý do theo từ vựng hạn mức, còn việc dịch sang từ vựng
// CHECK constraint `telemetry_log_error_code_check` thuộc về tầng đang cầm ngữ cảnh.
//
// `satisfies Record<…>` khoá hai đầu: một lý do THỨ TƯ trong tương lai là lỗi
// biên dịch (thiếu khoá), và một mã không nằm trong `TELEMETRY_ERROR_CODES`
// cũng vậy — chứ không phải một `null` im lặng ở cột `error_code` phát hiện ra
// sau nhiều tháng, khi lớp lọc lúc chạy của `buildTelemetryPayload()` đã nuốt
// nó.
//
// `unavailable` KHÔNG có mã riêng: nó là sự cố hạ tầng của CHÍNH TA, và thêm
// literal thứ ba sẽ vượt phạm vi R13 đã tuyên.
import type { ConsumeResult } from "@/lib/billing/quota";
import type { TelemetryErrorCode } from "@/lib/tutor/telemetry";

export const QUOTA_REFUSAL_TELEMETRY_CODE = {
  user_quota: "user_quota_exhausted",
  project_budget: "project_budget_exhausted",
  unavailable: "server",
} as const satisfies Record<Extract<ConsumeResult, { ok: false }>["reason"], TelemetryErrorCode>;
