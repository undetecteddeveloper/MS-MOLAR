// buildTutorPrompt() [unit]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-018/019/020, Success
//   Criteria #8 — "Answer key never reaches the model")
// Generated: 2026-08-08 | Converted from skeleton: 2026-08-14 (backend task 11,
//   Red -> Green in one commit, this repo's convention)
//
// NOT part of the integration/fixture-e2e/service-integration-e2e lane budget —
// Design-Doc-mandated unit coverage (backend DD Implementation Path Mapping:
// "SOURCE/lib/tutor/__tests__/prompt.test.ts", AC-018/019). Selected as this
// task's own explicitly named top risk item: "the answer key
// (correct_answer/sub_answers/essay_answer) reaching the tutor prompt — the
// single most important gate per PRD Success Criteria #8" (backend DD Design
// Summary, biggest_risks).
//
// Mock boundary (backend DD Test Boundaries): buildTutorPrompt() — No, real
//   implementation, direct pure-function unit test (pure string construction, no
//   I/O). The containment mechanism is TWO-LAYERED and this file proves the
//   SECOND layer: (1) TutorPromptInput's type shape structurally cannot HOLD
//   correct_answer/sub_answers/essay_answer (a compile-time property); (2) even
//   given a maximally-adversarial-but-type-valid input, the OUTPUT STRING must
//   contain 0 occurrences of answer-key-shaped sentinel values (this file's own
//   runtime property) — AC-018 requires both, not type-shape alone.

import { describe, expect, it } from "vitest";

import { buildTutorPrompt } from "../prompt";
import type { TutorPromptInput } from "../prompt";

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
// Test 1 — AC-018/019: zero answer-key occurrences across a per-questionType
// fixture battery
// =============================================================================
// AC-018: "Given any tutor invocation, when the assembled prompt payload is
//   inspected, then it contains 0 occurrences of any correct_answer/
//   sub_answers/essay_answer value."
// AC-019: "Given the tutor's context assembly, it shall read only columns from
//   the §10c safe set plus the student's own recorded answer."
// ROI: 70 (BV:10 x Freq:6 + Legal:0 + Defect:10)
// Behavior: buildTutorPrompt(input) called across a battery of TutorPromptInput
//   fixtures, one per questionType (mcq/true_false/short_answer), each paired
//   with a PARALLEL sentinel value representing "what the full DB row's
//   correct_answer/sub_answers/essay_answer would have contained" — a value
//   deliberately NEVER placed anywhere inside the TutorPromptInput fixture itself
//   (since the type has no field to hold it) -> assert the returned prompt string
//   contains 0 occurrences of every sentinel, for every questionType.
// @category: core-functionality
// @lane: unit
// @dependency: none (pure string construction; no I/O)
// @complexity: medium
// @real-dependency: N/A
// Primary failure mode: a future maintainer widens TutorPromptInput (or
//   buildTutorPrompt()'s own implementation) to interpolate a field that happens
//   to carry answer-key-shaped content — e.g. accidentally passing the FULL
//   Question row instead of the narrowed TutorPromptInput at the call site in
//   explainStep() — and the containment silently breaks, because nothing today
//   asserts the OUTPUT STRING itself; the type-shape guard alone would not catch
//   a call-site mistake that passes an over-broad object satisfying a widened type.
// Proof obligation: for each of mcq/true_false/short_answer, construct a
//   TutorPromptInput fixture and a distinct, greppable sentinel string standing in
//   for that question's correct_answer/sub_answers/essay_answer (e.g.
//   "SENTINEL-CORRECT-ANSWER-<questionType>") -> assert
//   `prompt.includes(sentinel) === false` for every sentinel across the full
//   battery, not merely one happy-path case. Also assert the prompt DOES contain
//   the fixture's studentAnswer and questionContent verbatim, to prove the test
//   is not vacuously passing against a near-empty prompt.
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
// Test 2 — AC-020 (backend half): Vietnamese, Socratic, answer-withholding
// instruction present for every questionType
// =============================================================================
// AC-020: "Given a wrong-answer case, the assembled prompt shall instruct the
//   model to respond in Vietnamese, in Socratic form, without stating the final
//   answer — the model's actual compliance is judged manually against the fixed
//   evaluation set (PRD Success Criteria #9), not asserted by this document's
//   unit tests." This test asserts only the INSTRUCTION's presence in the prompt
//   text (a necessary precondition), not the model's eventual compliance.
// ROI: 55 (BV:6 x Freq:6 + Legal:0 + Defect:9)
// Behavior: buildTutorPrompt() output contains the fixed Vietnamese
//   Socratic-style, answer-withholding instruction text (or a stable substring of
//   it) for mcq, true_false, and short_answer inputs alike.
// @category: core-functionality
// @lane: unit
// @dependency: none
// @complexity: low
// @real-dependency: N/A
// Primary failure mode: the instruction preamble is accidentally dropped for one
//   questionType branch only (e.g. true_false's subItems-shaped context), so that
//   branch silently sends Gemini a bare question dump with no behavioral
//   constraint while the other two branches remain correctly constrained.
// Proof obligation: define the known instruction literal (or a stable, minimal
//   substring of it) ONCE as a fixture constant, independent of the
//   implementation file — assert it is present in buildTutorPrompt()'s output for
//   each of the three questionType fixtures.

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
// Test 3 — essay's exclusion from TutorPromptInput.questionType is structural
// (type-level proof obligation, not a runtime assertion)
// =============================================================================
// No standalone AC — backend DD's own stated design intent: "essay excluded —
//   never scored, never wrong-twice-eligible" (TutorPromptInput.questionType
//   comment, backend DD § Data Contracts).
// ROI: 45 (BV:6 x Freq:4 + Legal:0 + Defect:9) — a maintainability/regression
//   guard rather than a user-facing behavior proof.
// @category: edge-case
// @lane: unit
// @dependency: none
// @complexity: low
// @real-dependency: N/A
// Primary failure mode: a future maintainer widens `questionType` to include
//   `"essay"` (defeating the "essay never wrong-twice-eligible" invariant this
//   type's shape currently enforces) with nothing in this test file flagging the
//   change, since TS-level exclusion today has no accompanying runtime assertion.
// Proof obligation: implementer adds a `// @ts-expect-error` fixture line
//   attempting to construct a TutorPromptInput with `questionType: "essay"` —
//   this line is expected to FAIL TO COMPILE today (proving the exclusion is
//   enforced at the type level) and is the intended catch if `essay` is ever
//   added to the union without a conscious, reviewed widening of this type.
describe("TutorPromptInput.questionType — loại trừ 'essay' ở mức kiểu", () => {
  it("chỉ nhận mcq/true_false/short_answer; 'essay' bị chặn lúc biên dịch, không phải lúc chạy", () => {
    const accepted: TutorPromptInput["questionType"][] = ["mcq", "true_false", "short_answer"];

    // @ts-expect-error — "essay" nằm ngoài union của TutorPromptInput.questionType
    // (essay không bao giờ được chấm nên không bao giờ "sai hai lần"). Dòng này
    // PHẢI báo lỗi biên dịch; nếu ai đó nới union để nhận "essay", chính directive
    // này thành "unused" và `tsc --noEmit` gãy — buộc phải xem lại có chủ đích.
    const essayType: TutorPromptInput["questionType"] = "essay";

    expect(accepted).toEqual(["mcq", "true_false", "short_answer"]);
    // Ghi nhận đúng bản chất của rào chắn: KHÔNG có kiểm tra lúc chạy nào loại
    // bỏ "essay" — `tsc` mới là cổng, nên directive ở trên là thứ phải giữ.
    expect(essayType).toBe("essay");
  });
});
