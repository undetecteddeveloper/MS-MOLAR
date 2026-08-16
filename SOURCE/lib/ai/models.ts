// Tên model Gemini — TÁCH RIÊNG khỏi lib/ugc/gemini.ts có chủ ý.
//
// VÌ SAO TÁCH: gemini.ts `import "server-only"`, mà gói đó NÉM khi được import
// ngoài bundle react-server. Script chạy bằng tsx (supabase/tagQuestionSkills.ts)
// vì thế không thể import gemini.ts — lý do đã được ghi lại ở
// lib/tutor/__tests__/toneEval.manual.test.ts:9-11 khi bộ đánh giá giọng văn
// gặp đúng rào này và phải chuyển sang chạy dưới vitest.
//
// HẬU QUẢ TRƯỚC KHI CÓ FILE NÀY (lỗi thật, không phải chuyện thẩm mỹ):
// tagQuestionSkills.ts viết cứng "gemini-3.1-flash-lite" trong thân main().
// Đổi ANSWER_MODEL ở gemini.ts thì batch tagger VẪN lặng lẽ gọi model cũ, và
// không có gì báo — không test nào so hai giá trị đó với nhau, và script chạy
// tay nên CI không bao giờ thấy. Đúng cái bẫy sẽ nổ vào ngày Google đổi giá.
// File này không có `server-only` nên là chỗ DUY NHẤT cả bundle lẫn tsx cùng đọc.
//
// ĐỔI MODEL: sửa Ở ĐÂY, không sửa chỗ nào khác. Ba assertion đang ghim tên model
// theo chuỗi sẽ đỏ — lib/ugc/__tests__/extractors.test.ts:119 và :196,
// extractMeta.test.ts:82. Đó là cổng chặn CỐ Ý (đổi model là quyết định phải
// thấy được trong diff, không phải hiệu ứng phụ), nên cập nhật chúng cùng lúc
// chứ đừng nới lỏng chúng.
//
// PHẠM VI: file này chỉ giữ hằng số thuần. Việc dựng client, retry, deadline và
// phân loại lỗi vẫn nằm ở lib/ugc/gemini.ts — chúng cần `server-only` thật, còn
// mấy chuỗi này thì không.

// LƯU Ý (2026-07-17): "gemini-2.5-flash"/"gemini-2.5-flash-lite" (chọn ban đầu
// theo rate-limit công bố) hoá ra KHÔNG gọi được với key thật — 2.5-flash trả
// 404 "no longer available to new users", dòng 2.0-flash trả 429 quota (tài
// khoản mới không có quota free cho 2 dòng model cũ này). Xác nhận bằng
// client.models.list() + gọi thử trực tiếp: chỉ dòng 3.x hoạt động.

/** Model đọc file đề (multimodal, ảnh + PDF). Cũng là model gia sư Socratic. */
export const QUESTION_MODEL = "gemini-3.5-flash";

/** Model đọc file đáp án (rẻ hơn). Dùng chung cho batch gắn thẻ kỹ năng —
 *  phân loại hàng loạt, cùng hạng chi phí/độ khó với việc đọc file đáp án. */
export const ANSWER_MODEL = "gemini-3.1-flash-lite";
