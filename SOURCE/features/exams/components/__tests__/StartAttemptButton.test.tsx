// @vitest-environment jsdom

// StartAttemptButton — nguồn `source` thật của `?from=` bind vào đối số thứ hai
// của `startAttempt` (P6-T1: nối chuỗi `?from=`).
// Design Doc: docs/design/exam-shelves-frontend-design.md § Field Propagation Map
//   (`rawSource` | `StartAttemptButton` → `startAttempt` | preserved | server-action
//   closure argument | `const start = startAttempt.bind(null, examId, source);`)
// Design Doc: docs/design/exam-shelves-backend-design.md § The attempt-source
//   write path (`startAttempt` là nơi DUY NHẤT ghi cột `source`, luôn qua
//   `toAttemptSource` — component này KHÔNG tự thêm luật chuẩn hoá nào).
//
// `render(await StartAttemptButton(props))` — precedent
// `SkillRecommendationCard.test.tsx` cho async Server Component KHÔNG có con
// async (`StartAttemptSubmit` là client component đồng bộ, chỉ đọc
// `useFormStatus`), nên không rơi vào bẫy cây rỗng mà `renderServerTree` tồn tại
// để né. `fireEvent.submit` trên form kích hoạt cơ chế form-action phía client
// của React 19 (chặn submit, gọi thẳng hàm) — cùng cơ chế
// `DisplayNameEditor.test.tsx`'s `fireEvent.submit` đã dựa vào, chỉ khác
// `StartAttemptButton` truyền thẳng một hàm đã `bind` làm `action`, không qua
// `useActionState`.

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startAttemptMock } = vi.hoisted(() => ({ startAttemptMock: vi.fn() }));
vi.mock("@/features/exams/actions", () => ({ startAttempt: startAttemptMock }));

import { StartAttemptButton } from "@/features/exams/components/StartAttemptButton";

beforeEach(() => {
  startAttemptMock.mockReset();
  startAttemptMock.mockResolvedValue(undefined);
});

afterEach(cleanup);

// =============================================================================
// P6-T1 — StartAttemptButton → startAttempt (the `source` → bound-argument hop)
// =============================================================================
// AC-040: "Given an attempt started from an exam page reached with ?from=, when
//   startAttempt inserts the exam_attempts row, then that row persists exactly
//   one of practice, hot, explore, none." (this file proves the second of the
//   two hops the raw value must survive unmodified — the first is
//   app/(exams)/exams/[id]/__tests__/page.test.tsx's job)
// AC-041: "Given a missing, empty, unknown or forged ?from= value, when the
//   attempt row is written, then it stores none — 0 errors, 0 rejected attempt
//   starts." (the absent-`source` and `totally-bogus` cases below prove this
//   hop does 0 filtering of its own, so toAttemptSource stays the single
//   normalisation point AC-041 describes)
// ROI: 73 (BV:8 x Freq:8 + Legal:0 + Defect:9)
//   BV 8 — the sole remaining wiring gap in the attribution chain every earlier
//     phase (P1-T5's whitelist, P2-T2's producer, P5-T1's shelf cards) was
//     built to feed; without it every attempt start silently records 'none'.
//   Freq 8 — every attempt started from this button, i.e. every "Làm bài"
//     submission on the exam detail page.
//   Defect 9 — the failure mode is the LAST hop before the DB write and is
//     completely silent (this repo's only `<form action={boundFn}>` server
//     action, so there is no prior automated coverage of this exact bind
//     pattern): a hardcoded/dropped `source` argument produces a working,
//     redirecting "Làm bài" button with no visible symptom, only a wrong
//     exam_attempts.source value discovered later, if ever.
// Behavior: StartAttemptButton({ examId, source }) is rendered (no async child,
//   so `render(await StartAttemptButton(props))` applies, not renderServerTree)
//   against a mocked `startAttempt` -> the form is submitted (React 19 client-
//   side form-action interception) -> the mocked `startAttempt` is called with
//   (examId, source, FormData) where `source` is EXACTLY the prop value,
//   untouched, for a valid shelf value, for an absent `source` prop, and for an
//   unrecognised/forged value.
// @category: core-functionality
// @lane: integration
// @dependency: features/exams/components/StartAttemptButton.tsx + mocked
//   features/exams/actions.ts (startAttempt)
// @complexity: low
// @real-dependency: none — `startAttempt` is the sanctioned mock boundary here
//   (same reasoning as rating.int.test.ts's Supabase-client boundary): its own
//   toAttemptSource normalisation is proven by
//   lib/exams/__tests__/attemptSource.test.ts, a pure unit test outside this
//   file's job.
// Primary failure mode: `source` stays hardcoded to `undefined` (the pre-P6-T1
//   placeholder this task replaced), or the component adds its own ad-hoc
//   whitelist/validation on `source` before binding it, creating a second
//   normalisation point that can silently disagree with `toAttemptSource`'s
//   rules inside `startAttempt`.
// Proof obligation:
//   (a) source='hot' -> startAttempt is called with ('exam-1', 'hot', FormData);
//   (b) source absent -> startAttempt is called with ('exam-2', undefined,
//       FormData) — not a default like 'none', that mapping is startAttempt's
//       own job via toAttemptSource;
//   (c) source='totally-bogus' -> startAttempt receives 'totally-bogus'
//       verbatim, proving 0 filtering happens at this hop.
describe("StartAttemptButton — source prop bind vào startAttempt(examId, source) (P6-T1)", () => {
  it("obligation (a): source='hot': submit form gọi startAttempt('exam-1', 'hot', FormData)", async () => {
    const { container } = render(await StartAttemptButton({ examId: "exam-1", source: "hot" }));

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledTimes(1));
    const [examId, source, formData] = startAttemptMock.mock.calls[0];
    expect(examId).toBe("exam-1");
    expect(source).toBe("hot");
    expect(formData).toBeInstanceOf(FormData);
  });

  it("obligation (b): source vắng mặt: submit form gọi startAttempt('exam-2', undefined, FormData) — 0 luật whitelist thêm ở đây (đó là việc của toAttemptSource)", async () => {
    const { container } = render(await StartAttemptButton({ examId: "exam-2" }));

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledTimes(1));
    const [examId, source] = startAttemptMock.mock.calls[0];
    expect(examId).toBe("exam-2");
    expect(source).toBeUndefined();
  });

  it("obligation (c): source='totally-bogus': đi qua NGUYÊN VĂN, không tự lọc — chuẩn hoá chỉ xảy ra ở startAttempt/toAttemptSource (Boundary Context)", async () => {
    const { container } = render(
      await StartAttemptButton({ examId: "exam-3", source: "totally-bogus" })
    );

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledTimes(1));
    const [, source] = startAttemptMock.mock.calls[0];
    expect(source).toBe("totally-bogus");
  });
});
