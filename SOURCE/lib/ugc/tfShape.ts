// tfShape — HÌNH DẠNG của một câu Đúng/Sai: lời dẫn ở thân câu, (các) câu phán
// xét ở ý a–d. Thuần, không I/O, dùng được cả hai phía biên (2026-09-02).
//
// Cùng họ với `tfVerdict.ts` (đọc PHÁN QUYẾT Đ/S) và `tfCodec.ts` (mã hoá đáp
// án của học sinh); file này lo phần CẤU TRÚC, không lo giá trị.
//
// VÌ SAO TÁCH RA KHỎI `extractQuestions.ts`: hàm dưới đây sinh ra ở đó, nhưng
// nó cần chạy ở CẢ BA nơi, mà file kia là SERVER-ONLY (nó kéo theo `./gemini`).
// Import nó từ đường đọc sẽ lôi cả SDK Gemini vào một truy vấn chỉ đọc DB.
//
//   · lúc BÓC TÁCH  — vá ngay khi model vừa trả lời, để dữ liệu mới lưu đúng;
//   · lúc ĐỌC ĐỂ DUYỆT (`fromRows`) — vá row CŨ đã nằm sẵn trong DB;
//   · lúc ĐỌC ĐỂ LÀM BÀI (`(exams)/queries`) — cùng lý do, và đây là nơi
//     KHÔNG vá thì học sinh nhìn thấy một câu hỏi không có gì để bấm.
//
// Vá ở đường đọc là một SHIM CHO DỮ LIỆU CŨ, đúng lối mà codebase đã dùng hai
// lần: `maxPointsOf()` quy `points` hỏng về mặc định, `questionIdentityFromId()`
// đọc được cả id dạng v2.0. Nó KHÔNG sửa row trong DB — row chỉ được ghi lại
// khi tác giả bấm lưu ở màn duyệt — nên nó phải có mặt ở MỌI đường đọc, nếu
// không thì màn duyệt và màn làm bài sẽ hiện hai cấu trúc khác nhau cho cùng
// một câu hỏi.

import { LIMITS } from "./limits";
import type { QuestionType, SubItemId } from "./types";

/**
 * Vá câu Đúng/Sai mà CÂU PHÁN XÉT bị để trong thân câu thay vì trong ý a–d.
 *
 * Prompt của `extractQuestions` đã cấm thẳng điều này ("the statements ALWAYS
 * go in subItems, never in the stem") và model vẫn làm — đo trên prod
 * 2026-09-02: đề "ĐỀ THI HỌC KÌ 2 – ĐỀ SỐ 1" có 5 câu true_false (câu 21–25,
 * phần Listening) với `choices` rỗng và câu phán xét nằm nguyên trong `content`.
 *
 * Hậu quả không phải một lỗi nhỏ. Đề Tiếng Anh dạng này in MỘT mệnh đề cho MỘT
 * câu hỏi, và học sinh chỉ việc chọn True hoặc False. Khi mệnh đề ấy nằm trong
 * thân câu thì câu hỏi không có ý nào: màn làm bài không render được gì để bấm,
 * `validateAssembledExam` bắt `WRONG_SUB_ITEM_COUNT`, và cả ĐỀ không đăng được.
 * Ở màn duyệt nó còn dựng ra một hiểu lầm ngược hẳn với đề gốc — ô nhập ý a–d
 * hiện ra mời tác giả điền cho đủ BỐN ý, trong khi đề chỉ có MỘT.
 *
 * Hình dạng model trả về tách được sạch, vì nó luôn để lời dẫn và câu phán xét
 * ở HAI ĐOẠN (đã kiểm trên cả 5 row prod, không row nào lệch):
 *
 *   "Listen to part of a news report ... Decide whether the following
 *    statement is True or False.
 *                                        <- dòng trống
 *    The UN report says that harmful effects of greenhouse gases can be
 *    eliminated."
 *
 * Nên phép vá là: đoạn CUỐI thành ý "a", phần còn lại ở lại làm lời dẫn.
 *
 * BA ĐIỀU KIỆN TỪ CHỐI, và cả ba đều là "thà để lỗi nổi lên ở màn duyệt":
 *
 *   1. Đã có ý rồi → không đụng. Câu PHẦN II thật (4 ý a–d của đề quốc gia) đi
 *      qua đây không suy suyển; hàm này chỉ nhận ca `subItems` RỖNG.
 *   2. Thân câu chỉ một đoạn → không tách được lời dẫn khỏi câu phán xét, và
 *      đẩy cả thân câu xuống ý "a" sẽ để lại `stem` rỗng, tức đổi
 *      `WRONG_SUB_ITEM_COUNT` lấy `EMPTY_STEM`.
 *   3. Đoạn cuối dài quá trần một ý → nó gần như chắc chắn không phải một mệnh
 *      đề để phán xét, mà là một đoạn văn bị model gộp nhầm.
 */
export function repairTrueFalseStem(
  type: QuestionType,
  stem: string,
  subItems: { id: SubItemId; text: string }[] | undefined
): { stem: string; subItems: { id: SubItemId; text: string }[] | undefined } {
  if (type !== "true_false") return { stem, subItems };
  if (subItems && subItems.length > 0) return { stem, subItems };

  const paragraphs = stem
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  if (paragraphs.length < 2) return { stem, subItems };

  const statement = paragraphs[paragraphs.length - 1];
  const leadIn = paragraphs.slice(0, -1).join("\n\n");
  if (statement.length > LIMITS.MAX_CHOICE) return { stem, subItems };

  return { stem: leadIn, subItems: [{ id: "a", text: statement }] };
}
