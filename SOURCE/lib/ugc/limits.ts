// UGC Exam Upload v2.0 — giới hạn input (Design Doc §Input limits, TBD-04).
// Dùng ở cả validation server (actions) lẫn assembler thuần.

export const LIMITS = {
  MAX_QUESTIONS: 50,
  MIN_QUESTIONS: 1,
  // v2.1 (ADR-0005) — format đề quốc gia nhiều phần.
  MAX_PARTS: 5,
  // A2 — 1, KHÔNG phải 2. `true_false` trong codebase KHÔNG có nghĩa "câu
  // đúng/sai"; nó nghĩa là "khối PHẦN II: một câu dẫn kèm các ý a–d, mỗi ý
  // chấm Đ/S riêng". Đề Tiếng Anh lại có dạng thật sự một-mệnh-đề ("Decide
  // whether the following statement is True or False"), và khối đó chỉ có
  // ĐÚNG MỘT ý. Trần dưới 2 khiến nó không có chỗ đựng: AI chọn type đúng
  // theo nghĩa tiếng Anh thông thường rồi phải nhét mệnh đề vào stem và để
  // subItems rỗng — câu hiện ra với 4 ô trống.
  MIN_SUB_ITEMS: 1,
  MAX_SUB_ITEMS: 4,
  // A3 — mcq KHÔNG còn buộc đúng 4 lựa chọn. Đề Tiếng Anh có dạng
  // True/False/Not Given (3 lựa chọn) và các dạng 2 lựa chọn.
  //
  // Trần TRÊN vẫn là 4 và đó là ràng buộc của TẦNG DƯỚI, không phải lựa chọn
  // thẩm mỹ: questions.correct_answer có CHECK `in ('A','B','C','D')`
  // (schema.sql:425) và ChoiceId chỉ khai A–D. Muốn 5 lựa chọn thì phải
  // migrate CHECK đó + nới ChoiceId ở cả types/question.ts lẫn lib/ugc/types.ts
  // + cổng verify:schema — một đợt riêng, không lén nới ở đây.
  MIN_CHOICES: 2,
  MAX_CHOICES: 4,
  MAX_SHORT_ANSWER: 100,
  // Trần cho BÀI LÀM của người thi (attempt_answers.answer), KHÁC với
  // MAX_ESSAY_ANSWER ở dưới — cái đó là đáp án mẫu của tác giả đề, lưu ở
  // questions.essay_answer. Giá trị này PHẢI khớp CHECK trong
  // supabase/schema.sql: `length(answer) <= 4000`.
  //
  // 500 → 4000 (Essay Auto-Scoring R11/D11): một bài tự luận có rubric không
  // viết nổi trong 500 ký tự. Con số 4000 KHÔNG có cơ sở thực nghiệm —
  // production có 0 bài tự luận đã nộp — nên nó được chọn bằng lập luận, ghi ở
  // docs/design/essay-auto-scoring-backend-design.md § Trần ký tự.
  //
  // HAI HƯỚNG LỆCH KHÔNG ĐỐI XỨNG, và đó là lý do trần DB được nâng TRƯỚC
  // (Task H7) rồi mới tới hằng này (Task B3.3):
  //   · mã THẤP hơn DB  ⇒ cắt oan bài làm — mất một phần, còn cứu được.
  //   · mã CAO hơn DB   ⇒ Postgres từ chối NGUYÊN lượt nộp bài — học sinh mất
  //     cả bài thi. Không bao giờ được để cửa sổ nằm ở phía này.
  // `npm run verify:schema` đọc lại trần này từ DB THẬT và đỏ nếu hai bên lệch.
  MAX_ATTEMPT_ANSWER: 4000,
  // B1 — TỔNG điểm một đề phải cộng đủ trước khi publish. 10 không phải một
  // lựa chọn kỹ thuật: đó là thang điểm của mọi đề phổ thông Việt Nam, và tầng
  // chấm đã quy mọi lượt thi về đúng thang này (Σ(điểm đạt)/Σ(points)×10). Đề
  // cộng thành 8.5 vẫn chấm ra một con số hợp lệ — nhưng nó là con số của một
  // thang khác thang mà tác giả tưởng mình đang cho, và không ai nhìn ra được
  // điều đó từ bảng điểm của học sinh.
  EXAM_TOTAL_POINTS: 10,
  // Sai số cho phép khi so tổng. So bằng `===` là hỏng: điểm hợp lệ có bậc 0.1
  // và 0.25, mà 0.25 cộng 40 lần trong dấu phẩy động không ra đúng 10.
  // 0.01 nằm gọn giữa hai quy mô: rộng hơn tích luỹ sai số nhị phân ở mức ≤ 50
  // câu (cỡ 1e-14), hẹp hơn bậc nhỏ nhất tác giả gõ được (0.1) một bậc mười —
  // nên nó không bao giờ tha một biểu điểm sai thật.
  POINTS_EPSILON: 0.01,
  MAX_TITLE: 200,
  // Trần tiêu đề MỘT PHẦN của đề ("PHẦN II. VIẾT", "I. PHẦN ĐỌC HIỂU"). Tách
  // khỏi MAX_TITLE dù trùng số: hai thứ này bị ép bởi hai chỗ khác nhau — tiêu
  // đề đề là cột `exams.title` có CHECK riêng, còn tiêu đề phần nằm trong jsonb
  // `exams.parts` và chỉ có tầng app giữ (§8d). Buộc chúng bằng nhau bằng cách
  // dùng chung hằng sẽ khiến một lần nới MAX_TITLE âm thầm nới cả cái này.
  MAX_PART_TITLE: 200,
  // A1 — ngữ liệu dùng chung. Rộng tay hơn MAX_STEM RẤT NHIỀU và đó là cả điểm
  // của A1: bài đọc nay lưu ĐÚNG MỘT BẢN cho cả nhóm câu, nên chi phí của một
  // đoạn dài không còn nhân với số câu. 12000 ký tự ≈ một bài đọc 2000 từ, dài
  // hơn mọi bài đọc THPT thực tế.
  MAX_PASSAGE: 12000,
  // Trần số ngữ liệu một đề — chốt chặn "AI băm đề thành trăm mảnh", cùng vai
  // với MAX_PARTS. Đề Tiếng Anh dày nhất cũng chỉ 3–4 bài đọc.
  MAX_PASSAGES: 10,
  // Trần MẶC ĐỊNH cho đề bài. KHÔNG phải trần của mọi môn — xem
  // MAX_STEM_BY_SUBJECT ngay dưới và đọc qua maxStemFor(), đừng so thẳng hằng
  // này. Con số 2000 không bảo vệ gì ở tầng dưới: questions.content chỉ là
  // `text not null` (schema.sql:70, KHÔNG có CHECK), và extractQuestions chạy
  // maxOutputTokens 65536 nên nó cũng không phải trần token. Nó chỉ là chốt
  // chặn "AI phiên âm lỗi tràn lan" — nên nới theo môn là an toàn, không cần
  // migration, không đụng cổng verify:schema.
  MAX_STEM: 2000,
  // Trần đề bài NỚI theo môn. Môn vắng mặt ở đây dùng MAX_STEM.
  //
  // Anh và Văn có mặt vì cùng MỘT lý do, không phải hai: đề hai môn này thường
  // gắn một BÀI ĐỌC dùng chung cho nhiều câu, mà pipeline hiện chưa có chỗ
  // chứa ngữ liệu dùng chung (lỗi A1) nên đoạn văn bị chép lặp vào stem của
  // từng câu. 8000 đủ cho một bài đọc ~400 từ kèm câu hỏi.
  //
  // ĐÂY LÀ THUỐC GIẢM ĐAU, KHÔNG PHẢI THUỐC CHỮA. Khi A1 xong — có ngữ liệu
  // dùng chung thật — stem trở lại ngắn và bảng này nên co lại, đừng để nó
  // phình thêm môn mỗi lần gặp một đề dài.
  MAX_STEM_BY_SUBJECT: {
    English: 8000,
    Literature: 8000,
  } as Record<string, number>,
  MAX_CHOICE: 500,
  // Trần ĐÁP ÁN MẪU của tác giả (questions.essay_answer) — bản song sinh của
  // MAX_STEM ở trên, cùng cách đọc: qua maxEssayAnswerFor(), không so thẳng.
  MAX_ESSAY_ANSWER: 4000,
  // Chỉ Văn: hướng dẫn chấm một bài nghị luận văn học có biểu điểm từng ý vượt
  // 4000 ký tự là bình thường. Anh KHÔNG có mặt ở đây — đề Anh dài ở phần ĐỀ
  // BÀI (bài đọc), không ở đáp án mẫu, nên nới chỗ này cho Anh là nới thừa.
  MAX_ESSAY_ANSWER_BY_SUBJECT: {
    Literature: 8000,
  } as Record<string, number>,
  MAX_REPORT_REASON: 1000,
  MAX_SCHOOL: 200,
  MIN_DURATION: 1,
  MAX_DURATION: 600,
  // Giả định nghiệp vụ D10 — phạm vi THCS/THPT; product confirm ở Open Item O-1.
  MIN_GRADE: 6,
  MAX_GRADE: 12,
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
  // Mỗi file; đồng thời là guard kích thước request Claude.
  MAX_FILE_BYTES: 15 * 1024 * 1024,
  MAX_PDF_PAGES: 30,
  ALLOWED_MIME: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
  ] as const,
  // Guard chi phí nhẹ theo user (app-layer, không phải DB).
  MAX_UPLOADS_PER_DAY: 30,
  // User Support System v1 (support-system-backend-design.md §Business Logic).
  MAX_SUPPORT_MESSAGE: 1000, // TBD-07 resolved — matches MAX_REPORT_REASON
  MAX_SCREENSHOT_BYTES: 8 * 1024 * 1024, // 8MB — nhỏ hơn MAX_FILE_BYTES(15MB), còn dư dưới bodySizeLimit 32MB toàn cục
  ALLOWED_SCREENSHOT_MIME: ["image/png", "image/jpeg", "image/webp"] as const,
} as const;

export type AllowedMime = (typeof LIMITS.ALLOWED_MIME)[number];

// ---------------------------------------------------------------------------
// Trần theo môn — CHỖ DUY NHẤT được phép quyết định "câu này dài bao nhiêu là
// quá dài". Mọi call site đọc qua hai hàm dưới, không ai so thẳng với hằng.
// ---------------------------------------------------------------------------
//
// BA nhánh, và nhánh giữa là nhánh dễ bỏ sót nhất:
//
//   1. Môn ĐÃ BIẾT, có override  → trần của môn đó.
//   2. Môn CHƯA BIẾT (sentinel "" của chế độ Automatic, ADR-0007) → trần RỘNG
//      NHẤT. Nghe ngược, nhưng đây là hướng lệch an toàn DUY NHẤT: sentinel
//      nghĩa là "AI chưa đọc ra môn", và chặt tay lúc đó sinh ra một lỗi mà
//      tác giả KHÔNG sửa được bằng cách sửa câu — họ phải đoán ra rằng phải đi
//      chọn môn trước. Nới tay thì không lọt gì vào catalog: validateMetaForPublish
//      đã chặn cứng subject === "" ở cổng publish (normalizeMeta.ts:148), nên
//      tới lúc đề thật sự lên sóng thì môn LUÔN đã biết và trần thật đã áp.
//   3. Môn đã biết, không có override → trần mặc định.
//
// Chuỗi môn đi qua normalizeSubject() chứ không tra thẳng: exams.subject có
// row cũ mang chuỗi THÔ chưa canonical ("Tiếng Anh" thay vì "English", TD-016),
// và một bảng tra thẳng sẽ lặng lẽ trả trần mặc định cho đúng những đề cần nới.

import { normalizeSubject } from "./subjects";

/** Trần rộng nhất trong một bảng override — dùng cho nhánh "chưa biết môn". */
function widest(table: Record<string, number>, fallback: number): number {
  return Math.max(fallback, ...Object.values(table));
}

/** Môn chưa được xác định: sentinel "" hoặc chuỗi toàn khoảng trắng.
 *  KHÁC "môn không tra được" (chuỗi lạ, không rỗng) — cái đó dùng trần mặc
 *  định, vì tác giả đã khai MỘT thứ gì đó và ta không có cớ nới cho nó. */
function isSubjectUnknown(subject: string | null | undefined): boolean {
  return !subject || subject.trim() === "";
}

/** Trần đề bài áp dụng cho MỘT môn. Xem ba nhánh ở khối trên. */
export function maxStemFor(subject: string | null | undefined): number {
  if (isSubjectUnknown(subject)) {
    return widest(LIMITS.MAX_STEM_BY_SUBJECT, LIMITS.MAX_STEM);
  }
  const canonical = normalizeSubject(subject);
  return (canonical && LIMITS.MAX_STEM_BY_SUBJECT[canonical]) || LIMITS.MAX_STEM;
}

/** Trần đáp án mẫu áp dụng cho MỘT môn. Cùng ba nhánh với maxStemFor. */
export function maxEssayAnswerFor(subject: string | null | undefined): number {
  if (isSubjectUnknown(subject)) {
    return widest(LIMITS.MAX_ESSAY_ANSWER_BY_SUBJECT, LIMITS.MAX_ESSAY_ANSWER);
  }
  const canonical = normalizeSubject(subject);
  return (
    (canonical && LIMITS.MAX_ESSAY_ANSWER_BY_SUBJECT[canonical]) || LIMITS.MAX_ESSAY_ANSWER
  );
}
