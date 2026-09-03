// Logic Layer 4 — UGC Exam Upload v2.2: Server Actions (Task 4.1 + M4/M5).
// Design Doc §Data Contracts — extractAndAssemble / saveExam / publishExam /
// deleteExam / reportExam.
//
// Nguyên tắc:
//   - Validate FILE trước mọi lời gọi AI (AC-005/006 — guard chi phí, luôn).
//     Metadata: chế độ Manual validate trước AI như v2.1 (AC-036); chế độ
//     Automatic KHÔNG có metadata lúc submit — gate chuyển sang PUBLISH
//     (ADR-0007, AC-037/038). Nút disable chỉ là UX; publishExam tự từ chối.
//   - Chỉ persist KẾT QUẢ ASSEMBLE (ADR-0004) — raw AI output không bao giờ
//     vào DB; đáp án đến từ FILE ĐÁP ÁN; metadata AI đi qua normalizeMeta
//     (ranh giới thuần duy nhất, typed thắng extracted, không clamp).
//   - extractMeta NON-FATAL (AC-040): fail → sentinel + tác giả điền ở review.
//   - Mọi quyền được RLS cưỡng chế (author-only) — action chỉ là lớp UX.
//   - Đề published phải LUÔN sạch: publishExam validate (câu hỏi + metadata);
//     saveExam trên đề published validate TRƯỚC khi ghi.
//   - KHÔNG BAO GIỜ log token hay raw AI payload.
//
// MẶT TIỀN của cụm Server Action. Trước 2026-09-03 toàn bộ nằm trong MỘT file
// 1.190 dòng (một hàm 476 dòng, một hàm 354 dòng); nay chia theo vòng đời của
// một đề và file này chỉ nối lại, nên 4 component gọi vào đây không phải sửa
// một chữ — và quy ước `features/<tên>/actions.ts` của ARCHITECTURE.md §3 vẫn
// đúng.
//
// File này KHÔNG mang "use server": directive đó nằm ở ba module định nghĩa
// bên dưới, và danh tính Server Action đến từ nơi ĐỊNH NGHĨA chứ không phải
// nơi re-export.

export { extractAndAssemble } from "./uploadActions";
export { saveExam } from "./editActions";
export { publishExam, deleteExam, reportExam } from "./lifecycleActions";
