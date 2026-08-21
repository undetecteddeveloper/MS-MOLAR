// Telemetry-write payload builder [unit] (AC-013)
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-013, Success Criteria #13
//   "Telemetry never carries answer-key material")
// Generated: 2026-08-08 | Converted from skeleton: 2026-08-14 (backend task 12,
//   Red -> Green in one commit, this repo's convention)
//
// NOT part of the integration/fixture-e2e/service-integration-e2e lane budget —
// Design-Doc-mandated unit coverage (backend DD Implementation Path Mapping:
// "SOURCE/lib/tutor/__tests__/telemetry.test.ts", AC-013). Selected as one of
// this task's explicitly named highest-risk gaps ("the telemetry containment").
//
// Implementer note: the backend DD's Implementation Path Mapping does not name a
// standalone exported "payload builder" function distinct from explainStep()'s /
// getSkillRecommendation()'s own inline insert-call construction — per this
// document's own precedent ("matching AC-018's own 'unit test on the builder,
// not just an integration check' precedent"), extract the telemetry insert
// payload construction into its own small, pure, unit-testable function (e.g.
// `buildTelemetryPayload(...)` in SOURCE/lib/tutor/telemetry.ts or co-located
// with callTutor.ts) so this file can unit-test it in isolation from the
// Supabase call itself — mirroring buildTutorPrompt()'s own pure-function shape.
//
// Mock boundary (backend DD Test Boundaries / Mock Boundary Decisions, applied
//   here to the payload-construction step specifically): No I/O — pure
//   payload-construction function; the actual DB insert call is a SEPARATE
//   concern exercised by tutorActions.int.test.ts / getSkillRecommendation.int.test.ts
//   (mocked Supabase boundary) at the integration level.

import { describe, expect, it } from "vitest";

import { buildTelemetryPayload, TELEMETRY_ERROR_CODES } from "../telemetry";
import type { TelemetryErrorCode, TelemetryEvent, TelemetryLogInsert } from "../telemetry";

/** Đúng 6 cột app tự điền của `public.telemetry_log`; `id`/`created_at` do DB sinh (default), nên
 *  payload KHÔNG được có chúng — và cũng không được có bất kỳ khoá nào khác:
 *  một khoá lạ chính là dấu vết của việc trải cả object lỗi vào payload. */
const EXPECTED_COLUMNS = [
  "user_id",
  "event_type",
  "question_id",
  "skill_node_id",
  "success",
  "error_code",
] as const;

/** Chép tay, CỐ Ý không import từ schema hay implementation: đây là bản sao độc
 *  lập của CHECK constraint `telemetry_log_error_code_check`, để test còn chứng
 *  minh được điều gì khi ai đó nới enum ở phía implementation. */
const SCHEMA_ERROR_CODES = ["gemini_unavailable", "rate_limited", "server", "not_eligible", "user_quota_exhausted", "project_budget_exhausted"];

const USER_ID = "11111111-1111-4111-8111-111111111111";
const QUESTION_ID = "q-derivative-001";
const SKILL_NODE_ID = "skill-derivative-basic";

/**
 * Một ca trong "dàn" (battery): `event` là đầu vào (có ca CỐ TÌNH phá kiểu để mô
 * phỏng sai lầm của người bảo trì tương lai), `answerKeySentinels` là các giá
 * trị đại diện cho correct_answer/sub_answers/essay_answer của câu hỏi liên
 * quan — thứ TUYỆT ĐỐI không được xuất hiện ở bất kỳ trường nào của payload.
 */
interface TelemetryFixture {
  label: string;
  event: TelemetryEvent;
  answerKeySentinels: string[];
}

/** Lỗi mô phỏng đúng theo "primary failure mode": message của exception mang
 *  theo nội dung câu hỏi/đáp án (UGC do người dùng nhập, có thể bị tác động bởi
 *  kẻ tấn công) — đây chính là con đường rò mà CHECK constraint `telemetry_log_error_code_check` và test
 *  này cùng tồn tại để chặn. */
const LEAK_SENTINEL = "SENTINEL-CORRECT-ANSWER-leak";
const LEAK_SUB_ANSWERS_SENTINEL = "SENTINEL-SUB-ANSWERS-leak";
const LEAK_ESSAY_SENTINEL = "SENTINEL-ESSAY-ANSWER-leak";
const LEAK_SENTINELS = [LEAK_SENTINEL, LEAK_SUB_ANSWERS_SENTINEL, LEAK_ESSAY_SENTINEL];

const caughtError = new Error(
  `Gemini 503 khi chấm câu "q-derivative-001" (correct_answer=${LEAK_SENTINEL}, essay_answer=${LEAK_ESSAY_SENTINEL})`,
);

const FIXTURES: TelemetryFixture[] = [
  {
    label: "tutor_invoke/success",
    event: { eventType: "tutor_invoke", userId: USER_ID, questionId: QUESTION_ID, success: true },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    label: "tutor_invoke/failure",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: "gemini_unavailable",
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    label: "adaptive_route/success",
    event: { eventType: "adaptive_route", userId: USER_ID, skillNodeId: SKILL_NODE_ID, success: true },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    label: "adaptive_route/failure",
    event: { eventType: "adaptive_route", userId: USER_ID, skillNodeId: null, success: false, errorCode: "server" },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Ca 1 của "primary failure mode": người bảo trì ép err.message vào errorCode
    // (ở TS thật phải cố ý `as` mới lọt — chính là diff mà reviewer nhìn thấy).
    label: "error-message-cast-as-code",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: caughtError.message as TelemetryErrorCode,
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Ca 2 (đối nghịch, cùng lối của prompt.test.ts's fullQuestionRow): truyền
    // NGUYÊN cụm ngữ cảnh lỗi thay vì event đã thu hẹp — nếu builder trải
    // `...event` hoặc JSON.stringify cả input, sentinel sẽ rò ra payload.
    label: "broad-error-context",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: caughtError.message,
      error: caughtError,
      message: caughtError.message,
      detail: {
        name: caughtError.name,
        message: caughtError.message,
        correctAnswer: LEAK_SENTINEL,
        subAnswers: { a: LEAK_SUB_ANSWERS_SENTINEL, b: LEAK_SUB_ANSWERS_SENTINEL },
        essayAnswer: LEAK_ESSAY_SENTINEL,
      },
    } as unknown as TelemetryEvent,
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // R13 (AC-045): mã mới thứ nhất. Đây là ca chứng minh bộ lọc runtime cho
    // mã này ĐI QUA — không có nó, một bộ lọc còn dừng ở bốn mã cũ vẫn xanh
    // hết dàn trên, chỉ khác là error_code thành null lúc ghi thật.
    label: "tutor_invoke/failure/user-quota",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: "user_quota_exhausted",
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Mã mới thứ hai, GIÁ TRỊ KHÁC ca trên và event_type khác: hai ca cùng kiểu
    // mà cùng một giá trị thì không phân biệt được ánh xạ với hằng số.
    label: "adaptive_route/failure/project-budget",
    event: {
      eventType: "adaptive_route",
      userId: USER_ID,
      skillNodeId: null,
      success: false,
      errorCode: "project_budget_exhausted",
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Ca SÁT NGHĨA: chuỗi chỉ khác mã thật ở phần đuôi. Bộ lọc phải là bộ lọc
    // đối sánh ĐẦY ĐỦ, không phải so tiền tố — CHECK của Postgres so đầy đủ.
    label: "near-miss-code",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: "user_quota_exhausted_v2" as TelemetryErrorCode,
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
];

/** Trả về mô tả từng sentinel BỊ RÒ, kèm ĐÚNG tên cột rò — dùng mảng thay vì
 *  assert trong vòng lặp để thông báo lỗi chỉ ra ngay ca nào/cột nào/rò cái gì. */
function findLeaks(payload: TelemetryLogInsert, sentinels: string[], where: string): string[] {
  return Object.entries(payload).flatMap(([column, value]) => {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    return sentinels
      .filter((sentinel) => serialized?.includes(sentinel) === true)
      .map((sentinel) => `${where}/${column}: ${sentinel}`);
  });
}

// =============================================================================
// Test 1 — AC-013: 0 occurrences of answer-key material in the constructed
// telemetry_log insert payload, across a fixture battery including simulated
// error paths
// =============================================================================
// AC-013: "Given any telemetry_log row, it shall contain no answer-key material
//   — asserted by a unit test on the telemetry-write payload builder, not by the
//   schema's column-shape exclusion alone."
// ROI: 69 (BV:10 x Freq:6 + Legal:0 + Defect:9)
// Behavior: the telemetry payload builder is invoked across a battery of fixture
//   inputs — success/failure outcomes, both event_type values
//   ('tutor_invoke'/'adaptive_route'), and a simulated caught Error whose
//   .message field contains a sentinel answer-key-shaped string (mirroring
//   prompt.test.ts's sentinel technique) — assert the constructed insert payload
//   object has 0 occurrences of the sentinel in ANY field, for every fixture in
//   the battery.
// @category: core-functionality
// @lane: unit
// @dependency: none (pure payload-construction function; no I/O)
// @complexity: medium
// @real-dependency: N/A
// Primary failure mode: a future maintainer routes a caught exception's
//   `err.message` (which could echo attacker-influenced UGC question content, per
//   Security Considerations) into `error_code` or any other telemetry column
//   instead of the constrained closed enum — reopening exactly the leak path
//   the schema's own CHECK constraint (`error_code in (...)`) and this unit test
//   both exist to prevent, per the schema's stated design intent ("Mã có cấu
//   trúc, KHÔNG BAO GIỜ free-text/exception message").
// Proof obligation: for each fixture (success/failure x tutor_invoke/adaptive_route),
//   assert every field of the constructed payload is either a structurally-safe
//   value (uuid, boolean, timestamp, or a closed enum member) or, for the one
//   string-shaped field capable of holding free text (error_code), assert it is
//   STRICTLY one of the named literals of the CHECK constraint (R13 widened it
//   to six) and never the raw simulated Error's .message —
//   over a fixture battery that includes a simulated Error whose .message
//   contains the sentinel string, proving that string never reaches the payload
//   under any exercised code path.
describe("buildTelemetryPayload — telemetry không bao giờ mang theo đáp án (AC-013)", () => {
  it("trên cả dàn success/failure x tutor_invoke/adaptive_route: 0 lần xuất hiện sentinel, error_code luôn nằm trong enum §19", () => {
    const built = FIXTURES.map((fixture) => ({ fixture, payload: buildTelemetryPayload(fixture.event) }));

    // (1) Không một cột nào mang theo sentinel đáp án — kể cả ca err.message.
    const leaks = built.flatMap(({ fixture, payload }) =>
      findLeaks(payload, fixture.answerKeySentinels, fixture.label),
    );
    expect(leaks).toEqual([]);

    // (2) Payload chỉ có đúng 6 cột app tự điền: một khoá lạ = dấu vết trải
    // object lỗi vào payload, tức là một đường rò mới chưa ai kiểm.
    const unexpectedColumns = built.flatMap(({ fixture, payload }) =>
      Object.keys(payload)
        .filter((column) => !EXPECTED_COLUMNS.includes(column as (typeof EXPECTED_COLUMNS)[number]))
        .map((column) => `${fixture.label}: ${column}`),
    );
    expect(unexpectedColumns).toEqual([]);

    // (3) error_code: NGHIÊM NGẶT null hoặc 1 trong các literal của CHECK
    // `telemetry_log_error_code_check` — đối chiếu với bản chép tay SCHEMA_ERROR_CODES,
    // không phải với hằng của implementation, nên nới enum ở implementation vẫn bị bắt tại đây.
    const badErrorCodes = built
      .filter(({ payload }) => payload.error_code !== null && !SCHEMA_ERROR_CODES.includes(payload.error_code))
      .map(({ fixture, payload }) => `${fixture.label}: ${String(payload.error_code)}`);
    expect(badErrorCodes).toEqual([]);

    // (4) Các cột còn lại đúng kiểu cấu trúc an toàn (không có chỗ chứa văn bản
    // tự do): event_type là enum đóng, success là boolean, các id là string|null.
    const badShapes = built
      .filter(
        ({ payload }) =>
          !["tutor_invoke", "adaptive_route"].includes(payload.event_type) ||
          typeof payload.success !== "boolean" ||
          !(payload.user_id === null || typeof payload.user_id === "string") ||
          !(payload.question_id === null || typeof payload.question_id === "string") ||
          !(payload.skill_node_id === null || typeof payload.skill_node_id === "string"),
      )
      .map(({ fixture }) => fixture.label);
    expect(badShapes).toEqual([]);

    // (5) Chống "đạt rỗng": builder phải thật sự dựng đủ dòng log dùng được cho
    // AC-012 ("bao nhiêu lượt gọi, của ai, bao nhiêu lượt hỏng"), chứ không phải
    // trả về {} hay null hết mọi cột.
    expect(built[0].payload).toEqual({
      user_id: USER_ID,
      event_type: "tutor_invoke",
      question_id: QUESTION_ID,
      skill_node_id: null,
      success: true,
      error_code: null,
    });
    expect(built[3].payload).toEqual({
      user_id: USER_ID,
      event_type: "adaptive_route",
      question_id: null,
      skill_node_id: null,
      success: false,
      error_code: "server",
    });
    // Mã hợp lệ ĐI QUA được (nếu builder null hoá tất cả thì (1)-(3) vẫn xanh mà
    // telemetry thành vô dụng — assert này chặn đúng cách "đạt" rẻ tiền đó).
    expect(built[1].payload.error_code).toBe("gemini_unavailable");
    // Còn mã bịa từ err.message thì thành null, không phải chuỗi rác.
    expect(built[4].payload.error_code).toBeNull();

    // Hai mã R13 cũng phải ĐI QUA, và đi qua thành ĐÚNG mã của nhánh sinh ra
    // nó. Hai ca dùng HAI giá trị khác nhau: một builder trả hằng số, hay một
    // bộ lọc ánh xạ nhầm hai nhánh vào nhau, chỉ bị bắt khi có cả hai.
    expect(built[6].payload.error_code).toBe("user_quota_exhausted");
    expect(built[7].payload.error_code).toBe("project_budget_exhausted");
    // Mà bộ lọc vẫn phải là BỘ LỌC chứ không thành ống dẫn: một mã sát nghĩa
    // nhưng không nằm trong CHECK vẫn thành null. Đổi `includes` thành so tiền
    // tố thì đúng ca này đỏ, còn cả dàn trên vẫn xanh.
    expect(built[8].payload.error_code).toBeNull();

    // (6) Hằng của implementation phải khớp CHECK constraint
    // `telemetry_log_error_code_check` từng phần tử — khoá luôn nguồn duy nhất mà cả kiểu lẫn bộ lọc lúc chạy cùng dùng.
    expect([...TELEMETRY_ERROR_CODES]).toEqual(SCHEMA_ERROR_CODES);
  });
});
