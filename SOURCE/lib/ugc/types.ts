// UGC Exam Upload v2.1 — shared types cho pipeline extract → assemble → persist.
// Design Doc §AI Extraction & Assembly (ADR-0004) + §v2.1 Amendment (ADR-0005
// format đề quốc gia nhiều PHẦN; ADR-0006 bbox native Gemini). Các shape này là
// dạng TRƯỚC-persistence, không mang field DB-only.

/** Nhãn lựa chọn trắc nghiệm — trùng contract types/question.ts. */
export type ChoiceId = "A" | "B" | "C" | "D";

/** 4 loại câu hỏi (ADR-0005). Đề cũ chỉ dùng mcq/essay; đề chuẩn 2025 thêm
 * true_false (PHẦN II — 4 ý a–d, mỗi ý Đúng/Sai) và short_answer (PHẦN III). */
export type QuestionType = "mcq" | "essay" | "true_false" | "short_answer";

/** Nhãn ý con của câu true_false (a–d). */
export type SubItemId = "a" | "b" | "c" | "d";

/** Đáp án Đ/S từng ý — persist vào questions.sub_answers (jsonb, SERVER-ONLY,
 * kỷ luật che giấu như correct_answer). */
export type SubAnswers = Partial<Record<SubItemId, boolean>>;

/** Khung hình của figure — GIAO THỨC NATIVE GEMINI (ADR-0006): [ymin, xmin,
 * ymax, xmax], SỐ NGUYÊN 0..1000 chuẩn hoá theo trang. Quy đổi pixel duy nhất
 * tại cropImages.boxToPixels. */
export type BoundingBox = {
  /** Trang chứa hình (1-based; ảnh đơn = 1). */
  page: number;
  box2d: [number, number, number, number];
};

/** Tiêu đề PHẦN in trên đề ("PHẦN I. Câu trắc nghiệm...") — persist vào
 * exams.parts để hiển thị nhóm. Đề không chia phần → mảng rỗng. */
export type ExtractedPart = { number: number; title: string };

/** Một câu hỏi do AI đọc từ file đề. KHÔNG bao giờ chứa đáp án đúng (ADR-0004).
 * Danh tính = (part, number) — số câu đánh lại từ 1 theo từng phần (ADR-0005). */
export type ExtractedQuestion = {
  /** Phần chứa câu hỏi; đề không chia phần = 1. */
  part: number;
  /** Số câu TRONG phần. */
  number: number;
  type: QuestionType;
  stem: string;
  /** Chỉ mcq — đúng 4 lựa chọn A–D. */
  choices?: { id: ChoiceId; text: string }[];
  /** Chỉ true_false — các ý a–d (chuẩn 4 ý). */
  subItems?: { id: SubItemId; text: string }[];
  /** Có mặt nếu câu hỏi kèm hình. */
  imageBox?: BoundingBox;
};

/** Một đáp án do AI đọc từ file đáp án (không giải đề) — part-qualified. */
export type ExtractedAnswer =
  | { part: number; number: number; type: "mcq"; letter: ChoiceId }
  | {
      part: number;
      number: number;
      type: "true_false";
      values: { id: SubItemId; value: boolean }[];
    }
  | { part: number; number: number; type: "short_answer"; value: string }
  | { part: number; number: number; type: "essay"; text: string };

export type UgcErrorCode =
  | "NO_QUESTIONS_FOUND"
  | "TOO_MANY_QUESTIONS"
  | "WRONG_CHOICE_COUNT"
  | "EMPTY_STEM"
  | "EMPTY_CHOICE"
  | "ANSWER_COUNT_MISMATCH"
  | "ANSWER_MISSING"
  | "IMAGE_CROP_FAILED"
  | "EXTRACTION_FAILED"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "STEM_TOO_LONG"
  | "CHOICE_TOO_LONG"
  // Bổ sung ngoài Design Doc: MAX_ESSAY_ANSWER có trong limits nhưng thiếu
  // code tương ứng — thêm để giới hạn không bị "chết" (deviation ghi nhận).
  | "ESSAY_ANSWER_TOO_LONG"
  // v2.1 (ADR-0005):
  | "WRONG_SUB_ITEM_COUNT"
  | "SHORT_ANSWER_TOO_LONG"
  // v2.2 (ADR-0007) — metadata gate ở publish, không phải upload:
  | "META_INCOMPLETE"
  | "META_INVALID"
  | "META_EXTRACTION_FAILED";

/** Lỗi typed cho ExtractionErrorPanel — message đã bake sẵn từ errorCopy. */
export type UgcError = {
  code: UgcErrorCode;
  /** null = lỗi cấp toàn file; number = lỗi của "Câu N" (trong phần). */
  questionNumber: number | null;
  /** Phần chứa câu lỗi; null = lỗi toàn file HOẶC đề 1 phần (copy khi đó chỉ
   * ghi "Câu N", không có "Phần P"). */
  partNumber: number | null;
  /** Copy tiếng Anh bake sẵn. Giữ lại làm fallback cho log server, message của
   * UgcActionError và test — KHÔNG dùng để hiển thị: UI gọi `formatUgcError(t, e)`
   * để dựng câu theo ngôn ngữ đang chọn. */
  message: string;
  /** Tham số thô để dựng lại câu ở ngôn ngữ bất kỳ lúc render. */
  params: UgcErrorParams;
  /** v2.2 (ADR-0007): lỗi META_* trỏ vào field metadata thay vì câu hỏi —
   * ErrorPanel link tới khối metadata, không tới card câu. */
  field?: MetaFieldName;
};

/** Tham số tuỳ code — chỉ dùng field liên quan. Khai ở đây (không phải
 * errorCopy.ts) để `UgcError` tham chiếu được mà không tạo vòng import. */
export type UgcErrorParams = {
  /** Phần chứa câu lỗi — CHỈ truyền với đề nhiều phần (nhãn "Phần P Câu N");
   * bỏ qua với đề 1 phần (nhãn "Câu N" như v2.0). */
  partNumber?: number;
  /** WRONG_CHOICE_COUNT: số lựa chọn đọc được. */
  choiceCount?: number;
  /** WRONG_SUB_ITEM_COUNT: số ý đọc được. */
  subItemCount?: number;
  /** EMPTY_CHOICE / CHOICE_TOO_LONG: nhãn lựa chọn (A–D). */
  choiceLabel?: string;
  /** ANSWER_COUNT_MISMATCH: số đáp án / số câu hỏi / số không khớp. */
  answerCount?: number;
  questionCount?: number;
  unmatchedCount?: number;
  /** META_INCOMPLETE / META_INVALID: field metadata bị lỗi (v2.2, ADR-0007). */
  field?: MetaFieldName;
};

export type Result<T> = { ok: true; value: T } | { ok: false; errors: UgcError[] };

/** Metadata đề do tác giả nhập ở S-01.
 * v2.2 (ADR-0007): ở chế độ Automatic các field required có thể mang GIÁ TRỊ
 * SENTINEL khi AI không đọc được ("" cho subject, 0 cho grade/durationMinutes
 * — cột DB NOT NULL nên không dùng null). Sentinel bị chặn ở publish gate
 * (validateMetaForPublish), không bao giờ lọt vào catalog. */
export type ExamMeta = {
  title: string;
  subject: string;
  grade: number;
  durationMinutes: number;
  school?: string;
  schoolYear?: number;
  semester?: "HK1" | "HK2";
};

/** Tên field metadata (khóa lỗi META_* + fieldErrors). */
export type MetaFieldName =
  | "title"
  | "subject"
  | "grade"
  | "durationMinutes"
  | "school"
  | "schoolYear"
  | "semester";

/** Chế độ nhập S-01 (v2.2 — server-meaningful, không còn thuần UI):
 * automatic = AI điền metadata từ file đề, gate ở publish;
 * manual = tác giả nhập, validate trước mọi AI call (hành vi v2.1). */
export type EntryMode = "automatic" | "manual";

/** Metadata thô do AI đọc từ TRANG 1 file đề (ADR-0007). MỌI field nullable —
 * null nghĩa là "không in trên trang", model bị CẤM suy đoán. schoolYear/
 * semester giữ NGUYÊN VĂN chuỗi in trên đề ("2024 – 2025", "HỌC KÌ I") —
 * parse là việc của normalizeMeta (code thuần), không phải của model. */
export type ExtractedMeta = {
  title: string | null;
  subject: string | null;
  grade: number | null;
  durationMinutes: number | null;
  school: string | null;
  schoolYear: string | null;
  semester: string | null;
};

/** Câu hỏi sau assembly — giá trị DUY NHẤT được persist (ADR-0004).
 * short_answer: giá trị mong đợi lưu ở essayAnswer (tái dùng cột essay_answer,
 * ADR-0005 — không thêm cột DB mới). */
export type AssembledQuestion = {
  /** Phần chứa câu hỏi (đề 1 phần = 1) — persist vào part_number. */
  part: number;
  number: number;
  type: QuestionType;
  stem: string;
  /** mcq: đúng 4 lựa chọn A–D. */
  choices?: { id: ChoiceId; text: string }[];
  /** true_false: các ý a–d (persist vào cột choices dạng jsonb). */
  subItems?: { id: SubItemId; text: string }[];
  /** mcq: đáp án từ FILE ĐÁP ÁN của tác giả, không bao giờ do AI suy luận. */
  correctAnswer?: ChoiceId;
  /** true_false: đáp án Đ/S từng ý từ file đáp án (SERVER-ONLY khi đọc lại). */
  subAnswers?: SubAnswers;
  /** essay: đáp án mẫu; short_answer: giá trị mong đợi (cùng cột DB). */
  essayAnswer?: string;
  /** URL Storage của hình đã crop (nếu câu có figure). */
  imageUrl?: string;
  /** Mặc định = subject của đề (ADR-0004, product-owner confirmed). */
  topic: string;
};

export type AssembledExam = {
  meta: ExamMeta;
  /** Tiêu đề các phần in trên đề (rỗng = đề 1 phần) — persist vào exams.parts. */
  parts: ExtractedPart[];
  questions: AssembledQuestion[];
};

// ---------------------------------------------------------------------------
// Server Actions (Task 4.1) — shape input/output dùng chung client ↔ server.
// ---------------------------------------------------------------------------

/** Patch metadata khi tác giả sửa đề (S-03). Field optional nhận null = xoá
 * giá trị (school/schoolYear/semester).
 * v2.2 (ADR-0007): subject/grade sửa được KHI CHƯA PUBLISH (AI có thể không
 * đọc được → tác giả phải điền ở review); đổi subject cascade topic := subject
 * cho toàn bộ câu hỏi (ADR-0004 topic mặc định). Sau publish: cố định như
 * v2.0 — server từ chối. */
export type SaveExamMetaPatch = {
  title?: string;
  subject?: string;
  grade?: number;
  durationMinutes?: number;
  school?: string | null;
  schoolYear?: number | null;
  semester?: "HK1" | "HK2" | null;
};

/** Patch một câu hỏi (S-03). Field bỏ qua = giữ nguyên; null = xoá giá trị. */
export type SaveQuestionPatch = {
  /** id row DB — `{examId}-p{part}q{n}` (v2.1) hoặc `{examId}-q{n}` (row v2.0). */
  id: string;
  stem?: string;
  choices?: { id: ChoiceId; text: string }[];
  /** true_false: sửa nội dung các ý a–d. */
  subItems?: { id: SubItemId; text: string }[];
  correctAnswer?: ChoiceId | null;
  /** true_false: sửa đáp án Đ/S từng ý; null = xoá toàn bộ. */
  subAnswers?: SubAnswers | null;
  /** essay/short_answer: đáp án mẫu / giá trị mong đợi. */
  essayAnswer?: string | null;
  /** null = gỡ hình khỏi câu. */
  imageUrl?: string | null;
};

export type SaveExamPatch = {
  meta?: SaveExamMetaPatch;
  questions?: SaveQuestionPatch[];
};

/** Lỗi discriminated của các server action (Design Doc §Data Contracts). */
export type UgcActionError = {
  kind: "validation" | "file" | "extraction" | "assembly" | "server";
  message: string;
  errors?: UgcError[];
  fieldErrors?: Record<string, string>;
};

export type UgcActionFailure = { error: UgcActionError };
