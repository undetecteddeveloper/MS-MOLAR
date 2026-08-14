// Hằng số dùng chung của module gia sư Socratic (Engine 1).
// Tách khỏi prompt.ts vì người dùng nó là callTutor.ts (tầng gọi Gemini), còn
// prompt.ts thuần ghép chuỗi — nhập constants.ts vào prompt.ts sẽ tạo phụ thuộc
// không ai cần.

/**
 * Hạn chót cho MỘT lời gọi Gemini của gia sư, truyền vào `makeDeadlineSignal()`
 * (lib/ugc/gemini.ts) — quá hạn thì abort thay vì treo request của học sinh.
 *
 * 30s, KHÔNG dùng chung mốc `FATAL_CALL_DEADLINE_MS = 150_000` của UGC: hai
 * tải khác hẳn nhau. UGC nâng lên 150s vì phải đọc cả file PDF nhiều trang
 * (đo thực tế 42s cho 4 trang/22 câu); gia sư chỉ gửi một prompt văn bản ngắn
 * cho MỘT câu hỏi, và đứng chắn ngay trước mặt học sinh đang chờ trên màn Chi
 * tiết kết quả — chờ tới 150s ở đó là hỏng trải nghiệm chứ không phải kiên
 * nhẫn. PRD cố ý không đặt KPI độ trễ cho gia sư, nên đây là mốc CẮT lỗi treo,
 * không phải mục tiêu hiệu năng.
 *
 * Lưu ý khi ship (backend DD § Risks — "Tutor deadline vs. Vercel function
 * timeout"): mốc này phải nằm trong `maxDuration` của route segment chạy
 * `explainStep()`; nếu nền tảng cắt sớm hơn 30s thì AbortSignal ở đây không bao
 * giờ kịp chạy và lỗi hiện ra dưới dạng khác.
 */
export const TUTOR_CALL_DEADLINE_MS = 30_000;
