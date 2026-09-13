// buildTutorPrompt — hàm THUẦN (pure): không I/O, không đọc ambient state, mọi
// dữ liệu do caller tiêm vào (cùng nhà với computeScore.ts, wrongTwice.ts).
// Ghép chuỗi prompt gửi Gemini cho gia sư Socratic của Engine 1.
//
// RÀO CHẮN QUAN TRỌNG NHẤT CỦA TÍNH NĂNG (PRD Success Criteria #8, AC-018/019):
// đáp án (correct_answer / sub_answers / essay_answer) KHÔNG BAO GIỜ được lọt
// vào prompt. Cơ chế chặn có HAI LỚP, cả hai đều nằm ở file này:
//   1. Kiểu `TutorPromptInput` KHÔNG CÓ trường nào chứa nổi đáp án — muốn rò,
//      người sửa phải cố ý thêm trường mới, tức là một diff mà reviewer nhìn
//      thấy, không phải một chỗ rò thầm lặng.
//   2. Thân hàm chỉ nội suy ĐÍCH DANH từng trường của kiểu đã thu hẹp — không
//      JSON.stringify(input), không trải `...input`, không lặp Object.entries()
//      trên input. Nhờ vậy, kể cả khi có ai đó ép cả dòng bảng `questions` vào
//      đây, mấy cột đáp án cũng không có đường ra chuỗi prompt.
// `__tests__/prompt.test.ts` khoá cả hai lớp lại (0 lần xuất hiện sentinel trên
// dàn fixture 3 dạng câu chấm tự động + ca tự luận riêng).
//
// CỐ Ý KHÔNG có trường `correctAnswer?: never` hay tương tự làm "chặn thêm":
// bất biến của backend DD là "TutorPromptInput has no field named or shaped like
// an answer-key field" — thêm trường như thế là tự phá bất biến đó.
//
// 2026-09-13 — GỢI Ý KHI ĐANG LÀM BÀI (engineer: "người ta cần gợi ý lúc đang
// bí, không phải lúc đã làm xong"). Gia sư rời trang Chi tiết kết quả sang màn
// làm bài; cổng "sai hai lần" bỏ, nên lý do loại trừ tự luận (cổng ấy cần vị từ
// nhị phân `isCorrect`) không còn — union `questionType` nay nhận cả "essay",
// và khối chỉ dẫn nói rõ với tự luận chỉ gợi hướng lập luận, không viết bài
// mẫu. Hai lớp rào chắn đáp án ở trên KHÔNG đổi một chữ.

/** Trần ký tự của BÀI LÀM khi nó đi vào prompt Gemini.
 *
 *  KHAI RIÊNG, VÀ CỐ Ý KHÔNG import `LIMITS.MAX_ATTEMPT_ANSWER`. Hai con số
 *  này trả lời hai câu hỏi khác nhau, của hai người chủ khác nhau:
 *
 *    · `LIMITS.MAX_ATTEMPT_ANSWER` = HỌC SINH ĐƯỢC VIẾT BAO NHIÊU. Nó phải
 *      khớp CHECK trên Postgres, và Task B3.3 vừa nâng nó 500 → 4000 để chứa
 *      một bài tự luận.
 *    · `TUTOR_MAX_STUDENT_ANSWER` = BAO NHIÊU TOKEN ĐƯỢC GỬI CHO GEMINI, trên
 *      một KHOÁ NGÂN SÁCH KHÁC (`ai:budget:` — không phải `groq:budget:`).
 *
 *  Chúng tình cờ bằng nhau cho tới hôm nay. Cho file này import hằng kia sẽ
 *  biến MỌI lần nâng trần DB về sau thành một lần nâng hoá đơn Gemini mà không
 *  ai quyết định — nâng 8× ở lần này. `prompt.test.ts` ghim đúng SỰ TÁCH RỜI
 *  ấy, chứ không ghim một giá trị.
 *
 *  PHÉP CẮT ĐƯỢC CƯỠNG CHẾ TRONG `buildTutorPrompt()`, KHÔNG PHẢI Ở CALL SITE:
 *  một phép cắt ở call site là một phép cắt mà call site THỨ HAI sẽ quên.
 *
 *  Từ 2026-09-13 bài tự luận (tới 8000 ký tự với Ngữ văn/Tiếng Anh) cũng đi
 *  qua đây dưới dạng BẢN NHÁP đang viết dở — phép cắt 500 ký tự này chính là
 *  thứ giữ hoá đơn Gemini không đi theo trần bài làm. Ô short_answer cũng vậy:
 *  nó chỉ bị chặn ở `LIMITS.MAX_SHORT_ANSWER = 100` phía CLIENT, và một phép
 *  chặn ở client KHÔNG phải một phép chặn ở server. */
export const TUTOR_MAX_STUDENT_ANSWER = 500;

/** Một lựa chọn/ý con để hiển thị cho model: chỉ NHÃN + NỘI DUNG, không có
 *  thông tin đúng/sai nào. */
interface LabelledOption {
  id: string;
  text: string;
}

/**
 * Ngữ cảnh (đã thu hẹp) để dựng prompt gia sư — đúng bộ cột an toàn §10c cộng
 * bài làm của chính học sinh, không hơn (AC-019).
 */
export interface TutorPromptInput {
  /** Đề bài, nguyên văn (có thể chứa LaTeX $...$). */
  questionContent: string;
  /** Bốn dạng câu, KỂ CẢ tự luận (nới 2026-09-13).
   *
   *  Union này từng ĐÓNG ở ba dạng chấm tự động, vì gia sư chỉ mở cho câu "sai
   *  hai lần" mà `wrongTwice` đọc `isCorrect` — một vị từ NHỊ PHÂN mà một band
   *  tự luận không trả lời được. Cổng ấy nay không còn (gợi ý trong lúc làm
   *  bài), nên lý do loại trừ cũng không còn. Cái giá đã được cân nhắc: văn
   *  xuôi của học sinh đi vào prompt Gemini dưới dạng bản nháp cắt 500 ký tự
   *  (`TUTOR_MAX_STUDENT_ANSWER`), trên khoá ngân sách `ai:budget:` — và mỗi
   *  lượt vẫn qua rate limit + hạn mức kỳ như mọi dạng câu khác. */
  questionType: "mcq" | "true_false" | "short_answer" | "essay";
  /** Chỉ có ở mcq — bốn phương án A–D, KHÔNG đánh dấu phương án nào đúng. */
  choices?: LabelledOption[];
  /** Chỉ có ở true_false — nội dung các ý a–d, KHÔNG kèm đáp án Đ/S. */
  subItems?: LabelledOption[];
  /** Bài làm HIỆN TẠI (đang làm dở) của học sinh, nguyên văn như ô nhập đang
   *  giữ (mcq: "B"; true_false: chuỗi tfCodec "a:Đ,b:S"; short_answer: giá trị
   *  đã điền; essay: đoạn đang viết). Rỗng khi chưa làm gì. */
  studentAnswer: string;
}

/**
 * Câu chốt của AC-020, tách riêng để đọc được ngay: buộc model trả lời tiếng
 * Việt, theo lối Socratic, và không nêu đáp án. Test khoá câu này bằng bản chép
 * tay độc lập, nên sửa chữ ở đây là một quyết định có ý thức chứ không lỡ tay.
 */
const SOCRATIC_INSTRUCTION =
  "Trả lời hoàn toàn bằng tiếng Việt, theo lối đặt câu hỏi gợi mở (Socratic), và TUYỆT ĐỐI KHÔNG nêu đáp án cuối cùng.";

/** Khối chỉ dẫn dùng CHUNG cho mọi dạng câu hỏi — cố ý không nằm trong bất kỳ
 *  nhánh theo `questionType` nào, để không thể rơi rụng ở đúng một nhánh. */
const INSTRUCTION_BLOCK = `Bạn là gia sư đang kèm một học sinh trung học ở Việt Nam.
Học sinh này ĐANG LÀM BÀI và bị bí ở câu hỏi dưới đây, nên điều em ấy cần là một hướng suy nghĩ để tự đi tiếp, không phải nhận kết quả.

Yêu cầu bắt buộc:
- ${SOCRATIC_INSTRUCTION}
- Dẫn dắt bằng 1–3 câu hỏi ngắn, giúp học sinh tự kiểm tra lại cách hiểu đề và bước làm của mình.
- Chỉ ra kiến thức hoặc bước cần dùng tới, nhưng không làm hộ và không kết luận phương án nào đúng.
- Với câu tự luận: chỉ gợi hướng lập luận hoặc dàn ý sơ lược, KHÔNG viết bài mẫu và không viết thay đoạn nào.
- Bạn KHÔNG được cho biết đáp án đúng của câu này; cũng đừng suy đoán rồi khẳng định chắc chắn.
- Viết tối đa 5 câu, giữ nguyên ký hiệu LaTeX ($...$) nếu đề có.`;

const QUESTION_TYPE_LABELS: Record<TutorPromptInput["questionType"], string> = {
  mcq: "trắc nghiệm nhiều lựa chọn (A–D)",
  true_false: "đúng/sai từng ý (a–d)",
  short_answer: "trả lời ngắn (điền giá trị)",
  essay: "tự luận (viết bài)",
};

/** Nói cho model biết cách ĐỌC chuỗi bài làm — nếu không, "a:Đ,b:S" trông như
 *  rác và model dễ bịa ra ý học sinh không hề chọn. */
const STUDENT_ANSWER_HINTS: Record<TutorPromptInput["questionType"], string> = {
  mcq: "nhãn phương án em ấy đang chọn, trống nếu chưa chọn",
  true_false: 'dạng "ý:Đ hoặc S", chỉ gồm những ý em ấy đã trả lời',
  short_answer: "giá trị em ấy đã điền, trống nếu chưa điền",
  essay: "đoạn em ấy đang viết dở, có thể trống nếu chưa viết gì",
};

/** Danh sách nhãn + nội dung, mỗi dòng một mục; rỗng/không có → chuỗi rỗng để
 *  khối này biến mất khỏi prompt thay vì để lại tiêu đề trống. */
function formatOptions(title: string, options: LabelledOption[] | undefined): string {
  if (!options || options.length === 0) return "";
  return `${title}\n${options.map((option) => `${option.id}. ${option.text}`).join("\n")}`;
}

/**
 * Dựng prompt hoàn chỉnh cho một lời gọi gia sư.
 *
 * - Thuần & tất định: cùng input luôn cho ra cùng chuỗi; không bao giờ throw.
 * - Bảo đảm (AC-018): chuỗi trả về chỉ chứa nội dung lấy từ 5 trường của
 *   `TutorPromptInput`, nên không thể mang theo giá trị đáp án nào.
 * - `choices`/`subItems` được in khi có mặt, không rẽ theo `questionType`: một
 *   dòng dữ liệu lệch dạng (mcq mà có subItems) vẫn hiển thị đủ ngữ cảnh thay
 *   vì âm thầm mất phần đó.
 */
export function buildTutorPrompt(input: TutorPromptInput): string {
  const sections = [
    INSTRUCTION_BLOCK,
    `Dạng câu hỏi: ${QUESTION_TYPE_LABELS[input.questionType]}`,
    `Nội dung câu hỏi:\n${input.questionContent}`,
    formatOptions("Các phương án:", input.choices),
    formatOptions("Các ý cần xét:", input.subItems),
    // Phép cắt nằm ở ĐÂY, trong hàm, chứ không ở người gọi — xem
    // `TUTOR_MAX_STUDENT_ANSWER`. `slice()` trên một chuỗi ngắn hơn trần trả về
    // chính nó, nên bài làm thật hôm nay đi qua không suy suyển một ký tự.
    `Bài làm của học sinh (${STUDENT_ANSWER_HINTS[input.questionType]}):\n${input.studentAnswer.slice(0, TUTOR_MAX_STUDENT_ANSWER)}`,
  ];
  return sections.filter((section) => section !== "").join("\n\n");
}
