// @vitest-environment jsdom

// ExplainStepAffordance [integration] — the "Explain this step" tutor
// affordance and, through it, useTutorAction's 4-phase state machine (no
// separate hook test file is named by the frontend Design Doc's own
// Implementation Path Mapping; the hook is exercised through the component it
// drives, matching ActionButton.test.tsx's precedent of testing usePdfAction
// through ActionButton rather than in isolation).
// Design Doc: docs/design/engine1-adaptive-ai-frontend-design.md (v1.0) §
//   State Machine Detail — useTutorAction, § Accessibility Implementation
// UI Spec: docs/ui-spec/engine1-adaptive-ai-ui-spec.md (v1.0) — state x display
//   matrix for ExplainStepAffordance, S-01
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-018-020 UI half, AC-021,
//   AC-025, AC-026, AC-029)
//
// Mock boundary (frontend DD Test Boundaries — Mock Boundary Decisions):
//   `explainStep` (imported into useTutorAction) — Yes, mock — I/O boundary
//   (network/Gemini round trip), mirrors ActionButton.test.tsx's mocking of
//   generateAttemptPdfFile/downloadPdfFile/canShareFile. RichText — No, real
//   render (already covered by its own RichText.xss.test.tsx, reused unmodified
//   here). BentoCell, Button — No, real render (pure display primitives).
//   useT() — No, real (no-provider DEFAULT_LOCALE fallback = "en", matching
//   ActionButton.test.tsx's convention — no I18nProvider wrapper needed).
//   This repo's vitest.config.ts wires no @testing-library/jest-dom setup file,
//   so jest-dom matchers (toHaveAttribute etc.) are unavailable — this file
//   reads raw DOM properties/attributes directly, same convention as
//   ActionButton.test.tsx.
//   render() does not auto-cleanup between tests here (no `test.globals`, so
//   @testing-library/react's afterEach-based auto-cleanup never registers) —
//   every query below is scoped to its own render()'s returned `container` via
//   `within`, never the global `screen` (ActionButton.test.tsx precedent).
//
// Generated: 2026-08-08 | Budget Used: integration 1/3 (frontend sub-budget —
//   see backend tutorActions.int.test.ts's header for the sub-budget rationale
//   this pairs with)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplainStepAffordance } from "./ExplainStepAffordance";
import type { ExplainStepResult } from "@/features/exams/tutorActions";

vi.mock("@/features/exams/tutorActions", () => ({
  explainStep: vi.fn(),
}));

import { explainStep } from "@/features/exams/tutorActions";

const mockExplainStep = vi.mocked(explainStep);

// Deliberately NOT symmetric/interchangeable-looking — a swapped call site must
// fail Test 2's assertion on the values alone, not merely on argument count.
const ATTEMPT_ID = "attempt-fixture-111";
const QUESTION_ID = "question-fixture-222";

const IDLE_LABEL = "Explain this step"; // tutor.explainThisStep (en)
const RETRY_LABEL = "Retry"; // common.retry (en), reused per ActionButton's LABEL_KEY precedent
const ERROR_COPY = "Couldn't load a hint. Try again."; // tutor.error (en) — ONE generic copy for all 4 backend codes

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExplainStepAffordance", () => {
  // ===========================================================================
  // Test 1 — AC-025: busyRef synchronous double-activation guard — a second
  // activation while busy is a verified no-op (at most 1 explainStep() call)
  // ===========================================================================
  // AC-025: "...A second activation while busy shall be a no-op (checked via
  //   busyRef synchronously, before any React state update)."
  // ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
  // Behavior: render ExplainStepAffordance with a mocked explainStep() that never
  //   resolves (a pending Promise, held open) -> fire two rapid activations
  //   (click, or a second click) on the button while phase==="busy" -> assert the
  //   mocked explainStep() was called AT MOST ONCE.
  // @category: core-functionality
  // @lane: integration
  // @dependency: SOURCE/components/tutor/ExplainStepAffordance.tsx +
  //   SOURCE/components/tutor/useTutorAction.ts + mocked
  //   SOURCE/features/exams/tutorActions.ts (explainStep)
  // @complexity: medium
  // @real-dependency: none — sanctioned mock boundary (frontend DD Mock Boundary
  //   Decisions: explainStep is the I/O boundary; useTutorAction's own
  //   phase/busyRef control flow runs for real, in-process).
  // Primary failure mode: the busyRef guard is implemented as a React state check
  //   (`phase === "busy"`) instead of a synchronous ref check, so a second click
  //   fired in the same tick (before React's state update flushes) is NOT blocked
  //   — firing a second explainStep() call, another Gemini round trip, another
  //   rate-limit consumption for the same click gesture.
  // Proof obligation: with generateHint (mocked explainStep) held pending via an
  //   unresolved Promise, fire two activation events on the button in immediate
  //   succession -> assert mockExplainStep.mock.calls.length === 1 (never 2),
  //   using a literal call-count assertion, not merely "the UI still looks busy."
  it("AC-025: busyRef synchronous double-activation guard — a second activation while busy is a no-op (at most 1 explainStep() call)", async () => {
    // Held open: phase stays "busy" for the whole assertion window.
    let resolveExplain!: (result: ExplainStepResult) => void;
    mockExplainStep.mockImplementation(
      () =>
        new Promise<ExplainStepResult>((resolve) => {
          resolveExplain = resolve;
        })
    );

    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );
    const button = within(container).getByRole("button", { name: IDLE_LABEL });

    // BOTH activations inside ONE act() body — this is the whole point of the
    // test. fireEvent wraps each call in its own act(), which flushes React's
    // state update in between, so a `phase === "busy"` guard would already read
    // the updated phase and (wrongly) look correct. Two native clicks in a
    // single act() body leave `phase` at its pre-render value for the second
    // handler, so ONLY a synchronous ref check blocks it — the exact same-tick
    // gesture AC-025 is about.
    act(() => {
      button.click(); // idle -> busy (busyRef set synchronously, before any state update)
      button.click(); // rapid second activation in the same tick — must be a no-op
    });

    // Literal call-count assertion, not "the UI still looks busy": a React-state
    // guard (`phase === "busy"`) lets this second same-tick click through.
    expect(mockExplainStep.mock.calls.length).toBe(1);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");

    resolveExplain({ hint: "gợi ý sau khi mở khoá" });
    await waitFor(() => expect(within(container).queryByRole("button")).toBeNull());
    expect(mockExplainStep.mock.calls.length).toBe(1); // still 1 after the busy window closes
  });

  // ===========================================================================
  // Test 2 — argument-order proof: explainStep is called with (attemptId,
  // questionId), never the swapped ExplainStepAffordanceProps declaration order
  // ===========================================================================
  // No standalone AC number — frontend DD's own top-named Risk: "explainStep(
  //   attemptId, questionId) vs. ExplainStepAffordanceProps' (questionId,
  //   attemptId) declaration order — a silent argument swap since both are
  //   strings," mitigated explicitly by "a literal-fixture unit test in
  //   ExplainStepAffordance.test.tsx asserting toHaveBeenCalledWith(
  //   '<attemptId-fixture>', '<questionId-fixture>') with two distinguishable
  //   fixture values, so a swap fails the assertion."
  // ROI: 56 (BV:8 x Freq:6 + Legal:0 + Defect:8)
  // Behavior: render ExplainStepAffordance with two DISTINGUISHABLE literal string
  //   props (e.g. attemptId="attempt-fixture-111", questionId="question-fixture-222"
  //   — deliberately NOT symmetric/interchangeable-looking) -> activate the button
  //   -> assert the mocked explainStep was called with the arguments in the exact
  //   order (attemptId, questionId), not (questionId, attemptId).
  // @category: core-functionality
  // @lane: integration
  // @dependency: same as Test 1
  // @complexity: low
  // @real-dependency: none
  // Primary failure mode: useTutorAction.ts's call site swaps the two string
  //   arguments (both plain strings, so TypeScript compiles either order without
  //   error) — every tutor invocation silently targets the wrong
  //   attempt/question pair, an undetectable-by-type-system regression this test
  //   is the SOLE guard against.
  // Proof obligation: `expect(mockExplainStep).toHaveBeenCalledWith(
  //   "attempt-fixture-111", "question-fixture-222")` — using two fixture values
  //   that would fail this assertion if swapped (not, e.g., two identical or
  //   easily-confusable strings).
  it("argument-order proof: explainStep called with (attemptId, questionId), never the swapped declaration order", async () => {
    mockExplainStep.mockResolvedValue({ hint: "gợi ý bất kỳ" });

    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );
    fireEvent.click(within(container).getByRole("button", { name: IDLE_LABEL }));

    await waitFor(() => expect(mockExplainStep).toHaveBeenCalledTimes(1));

    // The SOLE guard against a silent swap — both parameters are plain strings,
    // so either order compiles. Two distinguishable fixtures make the swap fail.
    expect(mockExplainStep).toHaveBeenCalledWith(ATTEMPT_ID, QUESTION_ID);
    expect(mockExplainStep.mock.calls[0]).toEqual([ATTEMPT_ID, QUESTION_ID]);
  });

  // ===========================================================================
  // Test 3 — AC-018/019/020 UI half + D5: hint-shown state renders the hint via
  // RichText and removes the re-invoke control for this question in this render
  // ===========================================================================
  // AC (D5, UI half): "...no control to re-invoke the tutor shall exist in this
  //   state for this question in this render."
  // ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:7)
  // Behavior: mocked explainStep resolves { hint: "<fixture hint text>" } -> after
  //   the state settles, the rendered container contains the hint text (rendered
  //   through RichText, real render) and does NOT contain the "explain this step"
  //   button/control anymore for this render.
  // @category: core-functionality
  // @lane: integration
  // @dependency: same as Test 1, RichText (real, unmocked)
  // @complexity: medium
  // @real-dependency: none — RichText itself is exercised for real per Mock
  //   Boundary Decisions ("already covered by its own hardened-pipeline tests...
  //   reused unmodified here, not re-tested" — this test only proves
  //   ExplainStepAffordance routes the hint INTO RichText, not RichText's own
  //   sanitize correctness).
  // Primary failure mode: the hint is rendered through a competing plain-text/
  //   dangerouslySetInnerHTML path instead of RichText (reopening an output-side
  //   sanitization gap ADR-0002/D4 exist to close), or the button remains mounted
  //   alongside the hint panel, allowing a second, redundant tutor invocation for
  //   the same already-answered question.
  // Proof obligation: after the mocked explainStep resolves with a fixture hint
  //   string, assert the container's text content includes the fixture hint
  //   string, and assert no `role="button"`-equivalent "explain this step"
  //   control remains queryable within the same container.
  it("AC-018/019/020 UI half + D5: hint-shown state renders the hint via RichText and removes the re-invoke control", async () => {
    // Markdown emphasis is the discriminator: RichText turns it into <strong>,
    // while any competing plain-text path would leave the literal asterisks.
    const HINT = "Xem lại **định luật bảo toàn** rồi thử lại nhé.";
    mockExplainStep.mockResolvedValue({ hint: HINT });

    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );
    fireEvent.click(within(container).getByRole("button", { name: IDLE_LABEL }));

    await waitFor(() => expect(within(container).queryByRole("button")).toBeNull());

    // RichText nạp ĐỘNG từ TD-021 (chunk markdown+KaTeX 122.5 KB gzip không được
    // nằm trong bundle đầu của trang này). Nút biến mất NGAY khi hint về, nhưng
    // nội dung hint chỉ render sau khi chunk resolve — hai mốc khác nhau, nên
    // phải đợi riêng. Chờ đúng <strong> chứ không chờ chuỗi: nó vừa là bằng chứng
    // chunk đã về, vừa là chính thứ nghĩa vụ chứng minh của case này cần (đường
    // render đi qua markdown, không phải plain-text).
    // TIMEOUT DÀI CÓ CHỦ Ý, không phải nới lỏng khẳng định: mốc chờ vẫn là
    // <strong> XUẤT HIỆN, y như cũ. Cái đổi là NGÂN SÁCH thời gian. Mặc định
    // 1000ms của waitFor đủ khi chạy riêng file này, nhưng chunk markdown+KaTeX
    // ở trên là một import ĐỘNG 122.5 KB, và khi cả 120 file test chạy song
    // song thì lượt resolve ấy thường xuyên vượt 1s — ca này vì thế đỏ khoảng
    // một nửa số lần chạy toàn bộ suite, xanh 100% khi chạy một mình. Một ca
    // đỏ ngẫu nhiên là ca không ai còn đọc, nên nó được sửa chứ không bị bỏ
    // qua. Một lượt render THẬT SỰ hỏng vẫn đỏ ở đây, chỉ là chậm hơn.
    await waitFor(() => expect(container.querySelector("strong")).not.toBeNull(), {
      timeout: 15_000,
    });

    expect(container.textContent).toContain("Xem lại");
    expect(container.textContent).toContain("định luật bảo toàn");
    expect(container.textContent).toContain("rồi thử lại nhé.");
    expect(container.querySelector("strong")?.textContent).toBe("định luật bảo toàn");
    expect(container.textContent).not.toContain("**"); // not a raw/plain-text render path

    // D5: no control to re-invoke the tutor exists in this state, for this
    // question, in this render.
    expect(within(container).queryByRole("button")).toBeNull();
    expect(within(container).queryByRole("button", { name: IDLE_LABEL })).toBeNull();
    expect(within(container).queryByRole("button", { name: RETRY_LABEL })).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.textContent).toContain("Hint"); // tutor.hintEyebrow

    // Hồi quy Phase 5 Task 19 (đo bằng bàn phím trên trình duyệt thật, không
    // phải suy diễn): D5 xoá hẳn cái nút vừa GIỮ FOCUS của người dùng bàn phím,
    // và trình duyệt đáp lại bằng cách trả focus về <body> — Tab kế tiếp nhảy
    // ngược lên đầu tài liệu, người dùng bàn phím không bao giờ tới được gợi ý
    // họ vừa xin. Bảng gợi ý phải tự nhận lấy focus, và phải bằng tabIndex={-1}
    // (nhận theo lệnh) chứ không phải 0 — nó là nội dung tĩnh, không được chen
    // thêm một chặng vào thứ tự Tab của trang.
    const panel = container.querySelector<HTMLElement>('[tabindex="-1"]');
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(panel);
    expect(panel!.textContent).toContain("định luật bảo toàn");
  });

  // ===========================================================================
  // Test 4 — AC-021: failure path re-labels to retry, mounts a role="alert" error
  // paragraph, and the rest of the page (this component's own DOM) stays
  // interactive
  // ===========================================================================
  // AC-021: "...the button shall re-label to common.retry, and a role='alert'
  //   paragraph reading tutor.error shall mount below it; the rest of the result
  //   page shall remain fully interactive."
  // ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:7)
  // Behavior: mocked explainStep resolves { error: "gemini_unavailable" } (and,
  //   as a second case, mocked explainStep REJECTS/throws) -> the button's
  //   accessible label changes to the retry copy, and a `role="alert"` element
  //   with the generic tutor.error copy mounts; the button remains enabled/
  //   focusable (never native `disabled`) so a retry activation is possible.
  // @category: edge-case
  // @lane: integration
  // @dependency: same as Test 1
  // @complexity: medium
  // @real-dependency: none
  // Primary failure mode: the button is set to native `disabled` on error
  //   (removing it from the tab order — the exact bug already fixed twice in this
  //   codebase, RateButton then ActionButton, per frontend DD's own Applicable
  //   Standards), permanently blocking a retry via keyboard; or the error
  //   paragraph lacks `role="alert"`, so assistive technology never announces the
  //   failure.
  // Proof obligation: for BOTH the typed-error-resolution case and the
  //   rejected-Promise case, assert an element with role="alert" is present and
  //   its text content matches the generic tutor.error copy, and assert the
  //   button element has no native `disabled` attribute/property set (still
  //   focusable) in either failure case.
  it("AC-021: failure path re-labels to retry, mounts a role=alert error paragraph, stays interactive", async () => {
    // The hook console.error's both failure branches by design (frontend DD §
    // Logging and Monitoring) — silenced so the expected logs don't read as
    // test noise.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Case A — typed-error resolution (one of the 4 closed backend codes).
      mockExplainStep.mockResolvedValue({ error: "gemini_unavailable" });
      const typed = render(
        <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
      );
      fireEvent.click(within(typed.container).getByRole("button", { name: IDLE_LABEL }));

      const typedAlert = await within(typed.container).findByRole("alert");
      expect(typedAlert.textContent).toBe(ERROR_COPY); // ONE generic copy — never discloses which code
      const typedButton = within(typed.container).getByRole("button", { name: RETRY_LABEL });
      // Never native `disabled` — the exact bug already fixed twice here
      // (RateButton, then ActionButton); a disabled button leaves the tab order.
      expect(typedButton.hasAttribute("disabled")).toBe(false);
      expect((typedButton as HTMLButtonElement).disabled).toBe(false);
      expect(typedButton.getAttribute("aria-disabled")).toBe("false");
      expect(typedButton.getAttribute("aria-busy")).toBe("false");
      typedButton.focus();
      expect(document.activeElement).toBe(typedButton); // still focusable => retry reachable by keyboard

      // Case B — the call rejects outright (network drop / Server Action throw).
      mockExplainStep.mockRejectedValue(new Error("network blip"));
      const rejected = render(
        <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
      );
      fireEvent.click(within(rejected.container).getByRole("button", { name: IDLE_LABEL }));

      const rejectedAlert = await within(rejected.container).findByRole("alert");
      expect(rejectedAlert.textContent).toBe(ERROR_COPY); // identical copy — both branches collapse to one message
      const rejectedButton = within(rejected.container).getByRole("button", { name: RETRY_LABEL });
      expect(rejectedButton.hasAttribute("disabled")).toBe(false);
      expect((rejectedButton as HTMLButtonElement).disabled).toBe(false);
      expect(rejectedButton.getAttribute("aria-disabled")).toBe("false");
      rejectedButton.focus();
      expect(document.activeElement).toBe(rejectedButton);

      // busyRef must not be left stuck true after a failure — a retry re-enters busy.
      mockExplainStep.mockResolvedValue({ hint: "gợi ý sau khi thử lại" });
      fireEvent.click(rejectedButton);
      await waitFor(() => expect(mockExplainStep).toHaveBeenCalledTimes(3));
    } finally {
      errorSpy.mockRestore();
    }
  });

  // ===========================================================================
  // Test 5 — AC-023/024/029: mount condition is gated solely by hasBeenWrongTwice,
  // never by skill_node_id presence (untagged questions render identically)
  // ===========================================================================
  // AC-024: "When r.hasBeenWrongTwice is false or undefined, ResultDetailPage
  //   shall not mount ExplainStepAffordance for that question."
  // AC-029 (UI half): "...ExplainStepAffordance shall render and function
  //   identically — it is gated solely by hasBeenWrongTwice, never by skill-tag
  //   presence."
  // ROI: 45 (BV:6 x Freq:6 + Legal:0 + Defect:7)
  // Behavior: this is a mount-condition proof, exercised at the ResultDetailPage
  //   call-site level conceptually, but testable here as: ExplainStepAffordance
  //   itself carries no internal gating logic on skill_node_id/hasBeenWrongTwice
  //   (those fields are not part of ExplainStepAffordanceProps at all — the
  //   gating happens at the CALLER, ResultDetailPage, per IP-1's own note that
  //   ResultDetailPage itself has "no RTL coverage... matching the ExamCard/
  //   ExamBrowser untested-Server-Component precedent"). This test instead proves
  //   the COMPONENT's own behavior is independent of any skill-tag-shaped prop —
  //   i.e. rendering ExplainStepAffordance with only {questionId, attemptId}
  //   (its actual, minimal Props surface) functions fully, with no additional
  //   prop required or consulted for a skill tag.
  // @category: edge-case
  // @lane: integration
  // @dependency: same as Test 1
  // @complexity: low
  // @real-dependency: none
  // Primary failure mode: a future maintainer widens ExplainStepAffordanceProps to
  //   accept a skill-tag-shaped field and conditions rendering/behavior on it,
  //   silently breaking AC-029's "needs question content, not a skill tag"
  //   contract for untagged questions.
  // Proof obligation: render ExplainStepAffordance with only its documented
  //   {questionId, attemptId} props (no additional prop) and assert the idle-state
  //   button renders and is activatable, proving no other prop is required for the
  //   component to function — the mount/no-mount DECISION itself (AC-023/024) is
  //   ResultDetailPage's own responsibility and is out of RTL scope per IP-1,
  //   verified instead by the manual Playwright pass (frontend DD Integration
  //   Verification Points).
  it("AC-023/024/029: mount condition gated solely by hasBeenWrongTwice, never by skill_node_id presence", async () => {
    mockExplainStep.mockResolvedValue({ hint: "gợi ý cho câu chưa gắn nhãn kỹ năng" });

    // Only the documented, minimal props — no skill-tag-shaped prop supplied.
    const { container } = render(
      <ExplainStepAffordance questionId={QUESTION_ID} attemptId={ATTEMPT_ID} />
    );

    const button = within(container).getByRole("button", { name: IDLE_LABEL });
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.hasAttribute("disabled")).toBe(false);

    fireEvent.click(button); // fully activatable with nothing but {questionId, attemptId}
    await waitFor(() => expect(mockExplainStep).toHaveBeenCalledTimes(1));
    expect(mockExplainStep).toHaveBeenCalledWith(ATTEMPT_ID, QUESTION_ID);

    // Structural half of AC-029: neither the component nor its hook may read a
    // skill-tag-shaped value at all. The mount/no-mount DECISION itself
    // (AC-023/024) is ResultDetailPage's own responsibility, out of RTL scope
    // per IP-1 — verified by the manual Playwright pass (Phase 5 Task 18).
    // Resolved against THIS file's own directory, not process.cwd(): the two
    // targets are its co-located siblings either way, so the scan survives being
    // run from the repo root instead of SOURCE/.
    const here = dirname(fileURLToPath(import.meta.url));
    const componentSource = readFileSync(join(here, "ExplainStepAffordance.tsx"), "utf-8");
    const hookSource = readFileSync(join(here, "useTutorAction.ts"), "utf-8");
    const readsSkillTag = (source: string) => /skill[_A-Za-z]*(Id|_id|Tag|Node)/i.test(source);
    expect(readsSkillTag(componentSource)).toBe(false);
    expect(readsSkillTag(hookSource)).toBe(false);
  });
});
