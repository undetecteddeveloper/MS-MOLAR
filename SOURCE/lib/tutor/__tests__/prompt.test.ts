// buildTutorPrompt() [unit]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-018/019/020, Success
//   Criteria #8 — "Khoá đáp án không bao giờ tới mô hình")
// Sinh ngày: 2026-08-08 | Chuyển từ skeleton: 2026-08-14 (backend task 11,
//   Red -> Green trong một commit, quy ước của repo này)
//
// KHÔNG thuộc ngân sách làn integration/fixture-e2e/service-integration-e2e —
// là độ phủ unit do Design Doc bắt buộc (Implementation Path Mapping của backend DD:
// "SOURCE/lib/tutor/__tests__/prompt.test.ts", AC-018/019). Được chọn làm mục rủi ro
// hàng đầu được nêu tên rõ của chính task này: "khoá đáp án
// (correct_answer/sub_answers/essay_answer) tới được prompt của gia sư — chốt
// quan trọng nhất theo PRD Success Criteria #8" (backend DD Design
// Summary, biggest_risks).
//
// Ranh giới mock (Test Boundaries của backend DD): buildTutorPrompt() — Không, cài đặt
//   thật, unit test hàm thuần trực tiếp (dựng chuỗi thuần, không I/O). Cơ chế khoanh vùng
//   có HAI LỚP và file này chứng minh lớp THỨ HAI: (1) hình dạng kiểu của TutorPromptInput
//   về cấu trúc không thể CHỨA correct_answer/sub_answers/essay_answer (thuộc tính lúc biên dịch);
//   (2) kể cả với đầu vào thù địch tối đa nhưng hợp kiểu, CHUỖI ĐẦU RA phải
//   chứa 0 lần xuất hiện của các giá trị canh có hình dạng khoá đáp án (thuộc tính
//   lúc chạy của chính file này) — AC-018 đòi cả hai, không chỉ hình dạng kiểu.

import { describe, expect, it } from "vitest";

import { buildTutorPrompt, TUTOR_MAX_STUDENT_ANSWER } from "../prompt";
import type { TutorPromptInput } from "../prompt";
// Import ĐỂ KHẲNG ĐỊNH SỰ TÁCH RỜI: `prompt.ts` cố ý KHÔNG import hằng này.
import { LIMITS } from "@/lib/ugc/limits";

/**
 * Một ca trong "dàn" (battery) kiểm chứng: input ĐÃ THU HẸP đúng kiểu, kèm
 * `answerKeySentinels` — các giá trị đại diện cho correct_answer/sub_answers/
 * essay_answer của CHÍNH câu hỏi đó, cố tình KHÔNG đặt vào `input` (kiểu
 * TutorPromptInput không có chỗ chứa chúng).
 *
 * `fullQuestionRow` là biến thể ĐỐI NGHỊCH: nguyên một dòng bảng `questions`
 * (có đủ 3 trường đáp án mang sentinel) — chính là "primary failure mode" mà
 * Test 1 tồn tại để bắt (call site lỡ truyền cả dòng DB thay vì kiểu đã thu
 * hẹp). Ở TS thật, `Question` không gán được vào `TutorPromptInput` nên lỗi này
 * bị chặn ngay lúc biên dịch; ép kiểu ở đây là cách DUY NHẤT quan sát được điều
 * gì xảy ra nếu hàng rào kiểu ấy bị phá — nếu buildTutorPrompt() nội suy bừa
 * (JSON.stringify cả input, trải ...input, đọc trường ngoài kiểu), sentinel sẽ
 * rò ra chuỗi prompt và ca này bắt được.
 */
interface PromptFixture {
  label: string;
  input: TutorPromptInput;
  answerKeySentinels: string[];
  fullQuestionRow: Record<string, unknown>;
}

/** sub_answers thật là Partial<Record<SubItemId, boolean>>; ở đây dùng chuỗi
 *  sentinel cho grep được — điều cần chứng minh là GIÁ TRỊ ấy không lọt ra
 *  chuỗi prompt, không phải kiểu của nó. */
function makeFixture(
  label: string,
  input: TutorPromptInput,
  extraRowFields: Record<string, unknown> = {},
): PromptFixture {
  const correctAnswer = `SENTINEL-CORRECT-ANSWER-${label}`;
  const subAnswerValue = `SENTINEL-SUB-ANSWERS-${label}`;
  const essayAnswer = `SENTINEL-ESSAY-ANSWER-${label}`;
  return {
    label,
    input,
    answerKeySentinels: [correctAnswer, subAnswerValue, essayAnswer],
    fullQuestionRow: {
      id: `q-${label}`,
      content: input.questionContent,
      subject: "Toán",
      grade: 12,
      topic: "Đạo hàm",
      ...input,
      ...extraRowFields,
      correctAnswer,
      subAnswers: { a: subAnswerValue, b: subAnswerValue },
      essayAnswer,
    },
  };
}

const FIXTURES: PromptFixture[] = [
  makeFixture("mcq", {
    questionContent: "Đạo hàm của $f(x)=x^2$ tại $x=3$ bằng bao nhiêu?",
    questionType: "mcq",
    choices: [
      { id: "A", text: "$3$" },
      { id: "B", text: "$6$" },
      { id: "C", text: "$9$" },
      { id: "D", text: "$2x$" },
    ],
    studentAnswer: "C",
  }),
  makeFixture("true_false", {
    questionContent: "Xét hàm số $y=\\sin x$ trên đoạn $[0;\\pi]$.",
    questionType: "true_false",
    subItems: [
      { id: "a", text: "Hàm số đồng biến trên $[0;\\pi]$." },
      { id: "b", text: "Hàm số đạt giá trị lớn nhất bằng $1$." },
      { id: "c", text: "Đồ thị cắt trục hoành tại đúng hai điểm." },
      { id: "d", text: "Hàm số nghịch biến trên $[\\pi/2;\\pi]$." },
    ],
    studentAnswer: "a:Đ,b:Đ,c:S,d:S",
  }),
  makeFixture("short_answer", {
    questionContent: "Nghiệm dương nhỏ nhất của phương trình $\\tan x = 1$ là bao nhiêu (theo radian)?",
    questionType: "short_answer",
    studentAnswer: "1,25",
  }),
];

/** Trả về mô tả từng sentinel BỊ RÒ (rỗng = đạt) — dùng mảng thay vì assert
 *  trong vòng lặp để thông báo lỗi chỉ đúng ca nào rò cái gì. */
function findLeaks(prompt: string, sentinels: string[], where: string): string[] {
  return sentinels.filter((sentinel) => prompt.includes(sentinel)).map((sentinel) => `${where}: ${sentinel}`);
}

// =============================================================================
// Test 1 — AC-018/019: 0 lần xuất hiện khoá đáp án qua một bộ fixture
// theo từng questionType
// =============================================================================
// AC-018: "Cho bất kỳ lần gọi gia sư nào, khi payload prompt đã ghép được
//   kiểm tra, thì nó chứa 0 lần xuất hiện của bất kỳ giá trị correct_answer/
//   sub_answers/essay_answer nào."
// AC-019: "Cho việc ghép ngữ cảnh của gia sư, nó chỉ được đọc các cột thuộc
//   tập an toàn §10c cộng câu trả lời đã ghi của chính học sinh."
// ROI: 70 (BV:10 x Freq:6 + Legal:0 + Defect:10)
// Hành vi: buildTutorPrompt(input) được gọi qua một bộ fixture TutorPromptInput,
//   mỗi questionType một cái (mcq/true_false/short_answer), mỗi cái đi kèm
//   một giá trị canh SONG SONG đại diện cho "thứ mà correct_answer/sub_answers/
//   essay_answer của hàng DB đầy đủ sẽ chứa" — một giá trị cố ý KHÔNG BAO GIỜ
//   đặt vào đâu bên trong chính fixture TutorPromptInput (vì kiểu không có trường để chứa nó)
//   -> khẳng định chuỗi prompt trả về chứa 0 lần xuất hiện của mọi giá trị canh,
//   với mọi questionType.
// @category: core-functionality
// @lane: unit
// @dependency: không có (dựng chuỗi thuần; không I/O)
// @complexity: medium
// @real-dependency: N/A
// Kiểu hỏng chính: người bảo trì về sau mở rộng TutorPromptInput (hoặc cài đặt
//   của chính buildTutorPrompt()) để nội suy một trường tình cờ mang nội dung
//   có hình dạng khoá đáp án — ví dụ vô tình truyền CẢ hàng Question
//   thay vì TutorPromptInput đã thu hẹp ở nơi gọi trong
//   explainStep() — và việc khoanh vùng lặng lẽ hỏng, vì hiện không gì
//   khẳng định CHUỖI ĐẦU RA; chỉ chốt hình dạng kiểu thì không bắt được
//   một lỗi ở nơi gọi truyền vào một object quá rộng thoả một kiểu đã mở rộng.
// Nghĩa vụ chứng minh: với mỗi mcq/true_false/short_answer, dựng một
//   fixture TutorPromptInput và một chuỗi canh riêng biệt, grep được, đại diện cho
//   correct_answer/sub_answers/essay_answer của câu đó (ví dụ
//   "SENTINEL-CORRECT-ANSWER-<questionType>") -> khẳng định
//   `prompt.includes(sentinel) === false` với mọi chuỗi canh qua cả
//   bộ fixture, không chỉ một ca đường vui. Cũng khẳng định prompt CÓ chứa
//   studentAnswer và questionContent của fixture nguyên văn, để chứng minh test
//   không qua rỗng nghĩa trên một prompt gần như trống.
describe("buildTutorPrompt — không có đáp án nào lọt vào prompt (AC-018/019)", () => {
  it("cho cả mcq/true_false/short_answer: 0 lần xuất hiện sentinel đáp án, kể cả khi bị truyền nguyên dòng questions", () => {
    const built = FIXTURES.map((fixture) => ({
      fixture,
      narrowed: buildTutorPrompt(fixture.input),
      fromFullRow: buildTutorPrompt(fixture.fullQuestionRow as unknown as TutorPromptInput),
    }));

    const leaks = built.flatMap(({ fixture, narrowed, fromFullRow }) => [
      ...findLeaks(narrowed, fixture.answerKeySentinels, `${fixture.label}/narrowed-input`),
      ...findLeaks(fromFullRow, fixture.answerKeySentinels, `${fixture.label}/full-question-row`),
    ]);
    expect(leaks).toEqual([]);

    // Chống "đạt rỗng": prompt phải thật sự mang ngữ cảnh câu hỏi + bài làm.
    const missingContext = built
      .filter(
        ({ fixture, narrowed }) =>
          !narrowed.includes(fixture.input.questionContent) || !narrowed.includes(fixture.input.studentAnswer),
      )
      .map(({ fixture }) => fixture.label);
    expect(missingContext).toEqual([]);
  });
});

// =============================================================================
// Test 2 — AC-020 (nửa backend): có chỉ dẫn tiếng Việt, kiểu Socratic, giấu đáp án
// cho mọi questionType
// =============================================================================
// AC-020: "Cho một ca trả lời sai, prompt đã ghép phải chỉ dẫn
//   mô hình trả lời bằng tiếng Việt, theo kiểu Socratic, không nêu đáp án
//   cuối — việc mô hình thực sự tuân thủ được đánh giá thủ công trên bộ
//   đánh giá cố định (PRD Success Criteria #9), không khẳng định bởi unit
//   test của tài liệu này." Test này chỉ khẳng định SỰ CÓ MẶT của CHỈ DẪN trong
//   văn bản prompt (một điều kiện cần), không phải việc mô hình cuối cùng tuân thủ.
// ROI: 55 (BV:6 x Freq:6 + Legal:0 + Defect:9)
// Hành vi: đầu ra buildTutorPrompt() chứa văn bản chỉ dẫn cố định
//   kiểu Socratic, giấu đáp án bằng tiếng Việt (hoặc một chuỗi con ổn định của nó)
//   cho đầu vào mcq, true_false và short_answer như nhau.
// @category: core-functionality
// @lane: unit
// @dependency: không có
// @complexity: low
// @real-dependency: N/A
// Kiểu hỏng chính: phần mở đầu chỉ dẫn vô tình bị bỏ chỉ ở một
//   nhánh questionType (ví dụ ngữ cảnh dạng subItems của true_false), khiến
//   nhánh đó lặng lẽ gửi cho Gemini một bãi câu hỏi trần không có ràng buộc
//   hành vi nào trong khi hai nhánh kia vẫn bị ràng buộc đúng.
// Nghĩa vụ chứng minh: định nghĩa literal chỉ dẫn đã biết (hoặc một chuỗi con
//   tối thiểu ổn định của nó) MỘT LẦN làm hằng fixture, độc lập với
//   file cài đặt — khẳng định nó có mặt trong đầu ra buildTutorPrompt() cho
//   từng trong ba fixture questionType.

/** Chép tay, CỐ Ý không import từ prompt.ts: nếu import, câu lệnh này tự động
 *  "đúng" theo mọi thay đổi của implementation và không còn chứng minh gì. */
const SOCRATIC_INSTRUCTION =
  "Trả lời hoàn toàn bằng tiếng Việt, theo lối đặt câu hỏi gợi mở (Socratic), và TUYỆT ĐỐI KHÔNG nêu đáp án cuối cùng.";

describe("buildTutorPrompt — chỉ dẫn Socratic tiếng Việt, không nêu đáp án (AC-020, phần backend)", () => {
  it("có mặt trong prompt của cả ba dạng câu hỏi", () => {
    const missingInstruction = FIXTURES.filter(
      (fixture) => !buildTutorPrompt(fixture.input).includes(SOCRATIC_INSTRUCTION),
    ).map((fixture) => fixture.label);

    expect(missingInstruction).toEqual([]);
  });
});

// =============================================================================
// Test 3 — việc loại essay khỏi TutorPromptInput.questionType là cấu trúc
// (nghĩa vụ chứng minh ở mức kiểu, không phải khẳng định lúc chạy)
// =============================================================================
// Không có AC riêng — ý định thiết kế do chính backend DD nêu: "essay bị loại khỏi
//   TutorPromptInput.questionType" (backend DD § Data Contracts). Cách viết GỐC
//   của ý định đó là "không bao giờ chấm, không bao giờ đủ điều kiện wrong-twice"; sau
//   ADR-0018 nửa đầu là sai — bài tự luận ĐƯỢC tự chấm, chúng mang một band.
//   Việc loại trừ đứng vững chỉ nhờ nửa THỨ HAI, và nửa đó là nửa chịu
//   lực: tính đủ điều kiện wrong-twice được tính từ `isCorrect`, một
//   vị từ NHỊ PHÂN mà bài tự luận không có giá trị. Một band không phải đáp án đúng/sai.
// ROI: 45 (BV:6 x Freq:4 + Legal:0 + Defect:9) — một chốt bảo trì/hồi quy
//   chứ không phải bằng chứng hành vi hướng người dùng.
// @category: edge-case
// @lane: unit
// @dependency: không có
// @complexity: low
// @real-dependency: N/A
// Kiểu hỏng chính: người bảo trì về sau mở rộng `questionType` để gồm
//   `"essay"` (phá bất biến "bài tự luận không bao giờ đủ điều kiện wrong-twice" mà hình dạng
//   kiểu này hiện cưỡng chế) mà không gì trong file test này báo hiệu
//   thay đổi đó, vì việc loại trừ ở mức TS hiện không đi kèm khẳng định lúc chạy nào.
// Nghĩa vụ chứng minh: người cài đặt thêm một dòng fixture `// @ts-expect-error`
//   cố dựng một TutorPromptInput với `questionType: "essay"` —
//   dòng này được kỳ vọng KHÔNG BIÊN DỊCH được hôm nay (chứng minh việc loại trừ
//   được cưỡng chế ở mức kiểu) và là chốt bắt nếu `essay` bị thêm vào
//   union mà không có một lần mở rộng kiểu này có chủ đích, được review.
// 2026-09-13: union NỚI để nhận "essay" — một quyết định có chủ đích, không
// phải lỡ tay (engineer: gợi ý chuyển sang màn làm bài, mở cho mọi câu kể cả tự
// luận). Ca "@ts-expect-error" cũ đã làm đúng việc của nó: nó đỏ khi union nới,
// và bản nới này đi kèm ba ràng buộc thay thế được ghim ngay dưới.
describe("TutorPromptInput.questionType — nhận cả 'essay' (gợi ý khi đang làm bài)", () => {
  const ESSAY_SENTINEL = "SENTINEL-ESSAY-MODEL-ANSWER";
  const essayInput: TutorPromptInput = {
    questionContent: "Phân tích hình tượng người lính trong bài thơ Đồng chí.",
    questionType: "essay",
    studentAnswer: "Mở bài: giới thiệu Chính Hữu và hoàn cảnh sáng tác…",
  };

  it("bốn dạng câu đều là giá trị hợp lệ của union", () => {
    const accepted: TutorPromptInput["questionType"][] = ["mcq", "true_false", "short_answer", "essay"];
    expect(accepted).toHaveLength(4);
  });

  it("prompt tự luận: có chỉ dẫn Socratic, có luật 'không viết bài mẫu', mang đề + bản nháp, và KHÔNG mang đáp án mẫu", () => {
    const prompt = buildTutorPrompt(essayInput);
    expect(prompt).toContain(SOCRATIC_INSTRUCTION);
    // Chép tay, không import: luật riêng cho tự luận phải tồn tại trong khối
    // chỉ dẫn CHUNG, không nằm trong một nhánh có thể rơi rụng.
    expect(prompt).toContain("KHÔNG viết bài mẫu");
    expect(prompt).toContain("tự luận (viết bài)");
    expect(prompt).toContain(essayInput.questionContent);
    expect(prompt).toContain(essayInput.studentAnswer);
    // Cả khi bị truyền nguyên dòng `questions` mang essay_answer (đáp án mẫu),
    // thân hàm chỉ nội suy đích danh từng trường nên sentinel không có đường ra.
    const fromFullRow = buildTutorPrompt({
      ...essayInput,
      essay_answer: ESSAY_SENTINEL,
      correct_answer: ESSAY_SENTINEL,
    } as unknown as TutorPromptInput);
    expect(fromFullRow).not.toContain(ESSAY_SENTINEL);
  });

  it("bản nháp trống vẫn dựng được prompt — khối bài làm hiện ra trống, không mất ngữ cảnh", () => {
    const prompt = buildTutorPrompt({ ...essayInput, studentAnswer: "" });
    expect(prompt).toContain("Bài làm của học sinh");
    expect(prompt).toContain(essayInput.questionContent);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// EG-BE-029 / Gate H4 — TRẦN BÀI LÀM ĐI VÀO PROMPT GEMINI
//
// Task B3.3 nâng `LIMITS.MAX_ATTEMPT_ANSWER` từ 500 lên 4000 để chứa một bài
// tự luận. Trần ấy là một quyết định về việc HỌC SINH ĐƯỢC VIẾT BAO NHIÊU.
// Con số ở đây là một quyết định KHÁC HẲN: bao nhiêu token được gửi cho
// Gemini, trên một khoá ngân sách KHÁC. Hai thứ đó tình cờ bằng nhau trước
// hôm nay; gộp chúng lại là để một lần nâng trần DB âm thầm nâng hoá đơn
// Gemini.
//
// VÌ SAO PHÉP CẮT PHẢI NẰM TRONG `buildTutorPrompt()`, KHÔNG PHẢI Ở CALL SITE:
// một phép cắt ở call site là một phép cắt mà call site THỨ HAI sẽ quên.
//
// ĐƯỜNG RIPPLE ĐI QUA `short_answer`, KHÔNG PHẢI `essay`: union
// `TutorPromptInput["questionType"]` loại trừ `essay` ở mức kiểu, nên bài tự
// luận không bao giờ tới được gia sư. Nhưng ô nhập short_answer bị chặn ở
// `LIMITS.MAX_SHORT_ANSWER = 100` phía CLIENT, mà MỘT PHÉP CHẶN Ở CLIENT
// KHÔNG PHẢI MỘT PHÉP CHẶN Ở SERVER: `submitExam` cắt bằng
// `MAX_ATTEMPT_ANSWER` (`actions.ts:146`), nên một request tự soạn lưu được
// 4000 ký tự, và chúng đi thẳng vào prompt khi học sinh bấm "Giải thích bước
// này". Đó là lý do ca này tồn tại và vì sao nó dùng `short_answer`.
// ═══════════════════════════════════════════════════════════════════════════

describe("buildTutorPrompt — trần bài làm gửi cho Gemini (EG-BE-029 / Gate H4)", () => {
  /** 4000 ký tự — đúng trần DB MỚI sau Task H7/B3.3. */
  const HUGE_ANSWER = "x".repeat(4000);

  function shortAnswerInput(studentAnswer: string): TutorPromptInput {
    return {
      questionContent: "Tính 5 + 7.",
      questionType: "short_answer",
      studentAnswer,
    };
  }

  it("bài làm 4000 ký tự ⇒ prompt mang TỐI ĐA 500 ký tự bài làm", () => {
    const prompt = buildTutorPrompt(shortAnswerInput(HUGE_ANSWER));

    // Đếm trên chính chuỗi prompt: số lần xuất hiện của ký tự bài làm không
    // được vượt trần, bất kể phần còn lại của prompt dài bao nhiêu.
    const occurrences = (prompt.match(/x/g) ?? []).length;
    expect(occurrences).toBe(TUTOR_MAX_STUDENT_ANSWER);
    expect(occurrences).toBeLessThanOrEqual(500);
    // Và prompt KHÔNG chứa nguyên văn bài làm 4000 ký tự.
    expect(prompt).not.toContain(HUGE_ANSWER);
  });

  it("phép cắt nằm TRONG buildTutorPrompt() — người gọi không phải làm gì", () => {
    // Đây là toàn bộ điểm của ca này: người gọi truyền vào nguyên văn thứ đọc
    // từ DB, không cắt gì cả, và vẫn KHÔNG vượt trần được.
    const prompt = buildTutorPrompt(shortAnswerInput(HUGE_ANSWER));
    expect(prompt.length).toBeLessThan(HUGE_ANSWER.length);
  });

  it("bài làm NGẮN hơn trần đi qua NGUYÊN VẸN — không cắt oan", () => {
    // Trần là một cái nắp, không phải một phép chuẩn hoá. Mọi bài làm thật hôm
    // nay (≤ 500 dưới CHECK cũ) phải đi qua không suy suyển một ký tự.
    const normal = "Kết quả là 12 vì 5 cộng 7 bằng 12.";
    const prompt = buildTutorPrompt(shortAnswerInput(normal));
    expect(prompt).toContain(normal);
  });

  it("bài làm dài ĐÚNG BẰNG trần đi qua nguyên vẹn (biên trên)", () => {
    const exact = "y".repeat(TUTOR_MAX_STUDENT_ANSWER);
    const prompt = buildTutorPrompt(shortAnswerInput(exact));
    expect(prompt).toContain(exact);
  });

  it("trần này ĐỘC LẬP với LIMITS.MAX_ATTEMPT_ANSWER, và đó là quyết định", () => {
    // Ghim sự TÁCH RỜI, không phải một giá trị. Nếu ai đó "dọn dẹp" bằng cách
    // cho `prompt.ts` import `LIMITS.MAX_ATTEMPT_ANSWER`, ca này đỏ — và đó
    // đúng là lúc cần một lượt xem lại có chủ đích, vì lần nâng trần DB kế
    // tiếp sẽ đi thẳng vào hoá đơn Gemini.
    expect(TUTOR_MAX_STUDENT_ANSWER).toBe(500);
    expect(LIMITS.MAX_ATTEMPT_ANSWER).toBe(4000);
    expect(TUTOR_MAX_STUDENT_ANSWER).not.toBe(LIMITS.MAX_ATTEMPT_ANSWER);
  });
});
