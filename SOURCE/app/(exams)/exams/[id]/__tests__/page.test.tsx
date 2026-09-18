// @vitest-environment jsdom

// app/(exams)/exams/[id]/page.tsx — ?from= chain wiring, chặng URL → page →
// StartAttemptButton (P6-T1).
// Design Doc: docs/design/exam-shelves-frontend-design.md § Field Propagation Map
//   (`from` URL → `[id]/page.tsx` preserved, raw, 0 client-side validation;
//   `source` `[id]/page.tsx` → `StartAttemptButton` preserved, prop `source?: string`)
// Design Doc: docs/design/exam-shelves-backend-design.md § The attempt-source
//   write path — full chain
//
// MOCK BOUNDARY: `getExam`, `hasReported`, `getCurrentUser` — data layer, mirrors
// `app/(exams)/exams/__tests__/page.test.tsx`. `StartAttemptButton` is ALSO
// mocked (capturing stub): this task's own Boundary Context names two SEPARATE
// boundaries — URL → page (owned here) and StartAttemptButton → startAttempt
// (owned by StartAttemptButton.test.tsx) — so this file isolates only the first
// hop, proving the raw `from` value reaches the `source` prop unmodified.
//
// `renderServerTree`, not `render(await ExamDetailPage(...))`: `AuthorByline`
// (rendered via the page's `<AuthorByline>`) is an async Server Component child,
// same empty-tree hazard `ExamShelf.test.tsx`/the exams-page test document.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderServerTree } from "@/tests/helpers/renderServerTree";
import type { Exam } from "@/types/exam";

vi.mock("server-only", () => ({}));

const { getExamMock, hasReportedMock, getCurrentUserMock, startAttemptButtonMock } =
  vi.hoisted(() => ({
    getExamMock: vi.fn(),
    hasReportedMock: vi.fn(),
    getCurrentUserMock: vi.fn(),
    startAttemptButtonMock: vi.fn<(props: { examId: string; source?: string }) => null>(
      () => null
    ),
  }));

vi.mock("@/features/exams/queries", () => ({ getExam: getExamMock }));
vi.mock("@/features/authoring/queries", () => ({ hasReported: hasReportedMock }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/exams/components/StartAttemptButton", () => ({
  StartAttemptButton: startAttemptButtonMock,
}));

import ExamDetailPage from "@/app/(exams)/exams/[id]/page";

const EXAM: Exam = {
  id: "exam-1",
  title: "Đề kiểm tra Hóa học",
  questionIds: ["q1", "q2"],
  durationMinutes: 45,
  subject: "Chemistry",
  grade: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  getExamMock.mockResolvedValue(EXAM);
  hasReportedMock.mockResolvedValue(false);
  getCurrentUserMock.mockResolvedValue(null);
});

// =============================================================================
// P6-T1 — URL → page → StartAttemptButton (the `from` → `source` prop hop)
// =============================================================================
// AC-039: "Given a card inside a shelf, when its link renders, then the href
//   carries ?from=practice, ?from=hot or ?from=explore according to the shelf
//   it sits on; given a card in the flat grid or in the home block, then the
//   href carries 0 ?from parameter." (this file proves the CONSUMER side —
//   the page reading that querystring back — the producer side is P2-T2's
//   ExamCard.snapshot.test.tsx)
// AC-040: "Given an attempt started from an exam page reached with ?from=, when
//   startAttempt inserts the exam_attempts row, then that row persists exactly
//   one of practice, hot, explore, none." (this file proves the first of the
//   two hops the raw value must survive unmodified — the second is
//   StartAttemptButton.test.tsx's job)
// AC-041: "Given a missing, empty, unknown or forged ?from= value, when the
//   attempt row is written, then it stores none — 0 errors, 0 rejected attempt
//   starts." (the absent-?from= and totally-bogus cases below prove this hop
//   does 0 filtering of its own, so AC-041's whitelist stays a single point)
// ROI: 72 (BV:8 x Freq:8 + Legal:0 + Defect:8)
//   BV 8 — the sole remaining wiring gap in the attribution chain every earlier
//     phase (P1-T5's whitelist, P2-T2's producer, P5-T1's shelf cards) was
//     built to feed; without it every attempt start silently records 'none'.
//   Freq 8 — every attempt started from a shelf card, i.e. every shelf-driven
//     conversion this feature exists to measure.
//   Defect 8 — the failure mode is silent: a dropped or hardcoded `source` prop
//     still renders a working "Làm bài" button with no visible symptom, only a
//     wrong exam_attempts.source value discovered later, if ever.
// Behavior: ExamDetailPage({ params, searchParams }) is called against a mocked
//   data layer (getExam/hasReported/getCurrentUser) and a mocked
//   StartAttemptButton (capturing stub) -> rendered via renderServerTree ->
//   StartAttemptButton is called with { examId, source } where `source` is
//   EXACTLY `searchParams.from`, untouched, for a valid shelf value, for absent
//   ?from=, and for an unrecognised/forged value.
// @category: core-functionality
// @lane: integration
// @dependency: app/(exams)/exams/[id]/page.tsx (ExamDetailPage) + mocked
//   getExam/hasReported/getCurrentUser + mocked StartAttemptButton
// @complexity: low
// @real-dependency: none — StartAttemptButton is mocked deliberately, per this
//   task's own Boundary Context two-boundary split: its bind-into-startAttempt
//   behavior is proven separately by StartAttemptButton.test.tsx, so this file
//   isolates only the URL -> page hop instead of re-proving the second hop too.
// Primary failure mode: the page adds its own whitelist/type-narrowing on `from`
//   before passing it down (e.g. casting to the AttemptSource union, or
//   defaulting unrecognised values to something other than a raw passthrough),
//   creating a second normalisation point that can silently disagree with
//   toAttemptSource's rules; or the prop is dropped/hardcoded, same failure as
//   the pre-P6-T1 placeholder this task replaced.
// Proof obligation:
//   (a) ?from=hot -> StartAttemptButton receives { examId: exam.id, source: "hot" };
//   (b) 0 ?from= -> StartAttemptButton receives source: undefined, not a
//       default like "none" — that mapping is startAttempt's job, not the page's;
//   (c) ?from=totally-bogus -> StartAttemptButton receives source:
//       "totally-bogus" verbatim, proving 0 filtering happens at this hop.
describe("ExamDetailPage — searchParams.from thread thành source prop cho StartAttemptButton (P6-T1, Field Propagation Map)", () => {
  it("obligation (a): ?from=hot: StartAttemptButton nhận { examId: 'exam-1', source: 'hot' }", async () => {
    await renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve({ from: "hot" }),
      })
    );

    expect(startAttemptButtonMock).toHaveBeenCalledTimes(1);
    expect(startAttemptButtonMock.mock.calls[0][0]).toMatchObject({
      examId: "exam-1",
      source: "hot",
    });
  });

  it("obligation (b): 0 ?from=: StartAttemptButton nhận source undefined — không tự thêm mặc định nào khác", async () => {
    await renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(startAttemptButtonMock.mock.calls[0][0]).toMatchObject({
      examId: "exam-1",
      source: undefined,
    });
  });

  it("obligation (c): ?from=totally-bogus: truyền NGUYÊN VĂN, không lọc/whitelist ở tầng page — chuẩn hoá là việc của toAttemptSource ở startAttempt (Boundary Context roundtrip check)", async () => {
    await renderServerTree(
      await ExamDetailPage({
        params: Promise.resolve({ id: "exam-1" }),
        searchParams: Promise.resolve({ from: "totally-bogus" }),
      })
    );

    expect(startAttemptButtonMock.mock.calls[0][0]).toMatchObject({
      examId: "exam-1",
      source: "totally-bogus",
    });
  });
});
