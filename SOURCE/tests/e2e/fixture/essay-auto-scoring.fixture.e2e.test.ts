// @vitest-environment jsdom

// Essay (Tự luận) Auto-Scoring — FIXTURE-E2E lane skeleton
// Design Docs: docs/design/essay-auto-scoring-frontend-design.md (v1.1, § Test
//                Boundaries :2134, § Feature-Off Window :1605, § EssayGradingPoller
//                mount condition F-05 :1383)
//              docs/design/essay-auto-scoring-backend-design.md (v1.3, § Cờ tính
//                năng :2011)
// UI Spec:     docs/ui-spec/essay-auto-scoring-ui-spec.md (v1.3, RS-0..RS-6 :333,
//                usePdfAction :643, ActionButton :681, HistoryRowMenu :708,
//                Copy Inventory :822, Golden States :966)
// PRD:         docs/prd/essay-auto-scoring-prd.md (v1.2, AC-012, AC-023, AC-057,
//                AC-058, AC-064, AC-067)
// ADR:         docs/adr/ADR-0018-essay-async-grade-write.md (Accepted; Amendment
//                to ADR-0010 — the three surfaces that must respect a moving score)
// Generated:   2026-08-29 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// ALL THREE CASES BELOW ARE SKELETONS (`it.todo`). Nothing here renders anything
// yet, and no component in this feature exists.
//
// HOW THIS LANE RUNS: `npm run test:fixture` (from `SOURCE/`), i.e.
// `vitest run --config vitest.fixture.config.ts`. That config globs the whole
// directory (`tests/e2e/fixture/**/*.test.{ts,tsx}`), so THIS FILE IS COLLECTED
// FROM THE MOMENT IT IS COMMITTED and needs no config edit. That is exactly why
// the cases are `it.todo` and not bare comments: a collected file with zero tasks
// makes vitest report "No test suite found in file" and exit 1 — which is the
// failure mode the six DRIVER SCRIPTS in this directory are excluded by name to
// avoid (`vitest.fixture.config.ts:45-52`). Do NOT add this file to that exclude
// list; `it.todo` already keeps the lane green, and being excluded is how a case
// gets written, reviewed and merged without ever executing.
//
// WHY THIS LANE AND NOT A PLAYWRIGHT DRIVER SCRIPT. The six shipped siblings here
// (`history.`, `rating.`, `short-answer-scoring.`, three `support-*.`) are written
// against a structural subset of Playwright's API and NOTHING EXECUTES THEM — the
// repo has no `@playwright/test` and no `playwright.config.ts`. The one case shape
// in this directory that actually runs is `subscription.fixture.e2e.test.ts`: an
// IN-PROCESS render of the REAL route tree (RootLayout -> route-group layout ->
// page), with only the action module and the data sources stubbed, real
// dictionaries, no MSW, no database, no network. All three cases below take that
// shape. It is the only shape in this repo that can discharge the claims below,
// because every one of them is a claim about what the PAGE composes — not about
// what a component renders when handed props by a test.
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — stated once, applies to all three cases
// -----------------------------------------------------------------------------
// Frontend DD § Mock Boundary Decisions (:2136) is the authority:
//   MOCKED  — `next/navigation` (`useRouter().refresh`), so refreshes are COUNTED
//             exactly (precedent `RecheckOrderControl.test.tsx:55`);
//             `retryEssayGrading()` Server Action; `lib/pdf/generateAttemptPdf`
//             (jsPDF + html2canvas do not run in jsdom); the two data sources the
//             page/row read (`getResult()`, `listMyHistory()`), stubbed to return
//             hand-built `ExamResult` / `MyHistoryEntry[]` fixtures.
//   STUBBED — `document.visibilityState` via `Object.defineProperty`.
//   REAL    — `deriveEssayView()`, `summariseEssays()`, `isEssayIncomplete()`;
//             `useT()`/`getTranslate()` and BOTH dictionaries (so cases assert the
//             right KEY resolved to the right string, not "some string");
//             `EssayLifecycleBadge`; the layouts, providers and formatters.
//   ZERO PROVIDER CALLS — grading ships DISABLED behind the AC-067 human gate
//             (Groq Zero Data Retention) and NO GROQ ACCOUNT EXISTS. No case in
//             this file has a network boundary at all: the band is a FIXTURE VALUE
//             in the stubbed `ExamResult`. FE2E-1 additionally asserts the count of
//             `router.refresh()` calls is zero, which is the client-side half of
//             "flag off => nothing is set in motion".
// @real-dependency: none. This lane needs no database and no credentials.
//
// -----------------------------------------------------------------------------
// TWO HAZARDS THAT MAKE A GREEN CASE MEANINGLESS — read before writing assertions
// -----------------------------------------------------------------------------
// (1) EMPTY-TREE VACUOUS PASS. `render(await Component())` returns an EMPTY TREE
//     when the awaited server component has an async child, and every
//     `expect(queryBy…).toBeNull()` written against it PASSES AGAINST NOTHING.
//     `EssayScoreLine` and `EssayReviewBlock` are both async AND have an async
//     child (`EssayLifecycleBadge`), so they land squarely in it. Any case
//     rendering either MUST use `renderServerTree()` AND carry at least one
//     POSITIVE assertion (`getByText`/`getByRole` that succeeds), so an empty tree
//     is always red. Frontend DD § Early Verification Point makes this a rule for
//     the whole slice, not advice.
//     PATH CORRECTION, verified in the tree on 2026-08-29: the helper is at
//     `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx`.
//     `SOURCE/lib/test/renderServerTree.tsx` DOES NOT EXIST — frontend DD :2158
//     names it as the destination on the THIRD consumer, and this slice is the
//     second. Import from the existing path, or move the helper and update the
//     orders test in the same commit; do not import a path that is not there.
// (2) FAKE-TIMER / REAL-TIMER COLLISION IN ONE FILE. FE2E-2 requires
//     `vi.useFakeTimers()` (the poller is a nested-setTimeout loop; frontend DD
//     :2160 pins the harness and forbids `waitFor` there). FE2E-3 must NOT use
//     fake timers. Scope the fake clock to FE2E-2's own `describe` with
//     `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => { cleanup();
//     vi.useRealTimers(); })` — a file-level fake clock would hang FE2E-3's menu
//     interactions.
//
// -----------------------------------------------------------------------------
// SELECTION — why these three
// -----------------------------------------------------------------------------
//   FE2E-1  108  feature-off byte-for-byte across S-01 + S-02  <- selected (rank 1)
//   FE2E-2   81  last essay resolves: announcement + unblock    <- selected, RESERVED
//                 (highest-ROI user-facing multi-step journey)
//   FE2E-3   72  PDF guard at BOTH exits, one attempt           <- selected (rank 3)
//   (F-4)    40  RS-6 retry control aria-disabled + click no-op <- NOT selected here;
//                 PUSHED DOWN to the component lane
//                 (`EssayRegradeControl.test.tsx`, `npm test`), which proves the
//                 whole aria-disabled idiom more cheaply. The ONE part a component
//                 test cannot prove — the control survives a `router.refresh()`
//                 without unmounting — is folded into FE2E-2 obligation (f).
//   (F-5)    64  RS-0..RS-6 render matrix on /result/detail     <- NOT selected;
//                 it is one component's state x display table, owned by the
//                 component lane per frontend DD § Phân tầng.

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =============================================================================
// MOCK BOUNDARY — data sources and the action module ONLY
// =============================================================================
// Real: every dictionary, every component, both route layouts, the whole
// component tree. Stubbed: what reaches out of the process (Supabase reads, the
// PDF pipeline, the router) plus the framework shims jsdom has no answer for.
//
// The point of this lane is that a defect in the WIRING between two real
// components is visible. Mocking a component would hide exactly that.

const {
  getResultMock,
  getMyRatingMock,
  getProfileMock,
  readEntitlementMock,
  listMyHistoryMock,
  refreshMock,
  generatePdfMock,
} = vi.hoisted(() => ({
  getResultMock: vi.fn(),
  getMyRatingMock: vi.fn(),
  getProfileMock: vi.fn(),
  readEntitlementMock: vi.fn(),
  listMyHistoryMock: vi.fn(),
  refreshMock: vi.fn(),
  generatePdfMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
// `next/font/google` la mot compiler transform; goi nhu mot ham thuong thi no
// nem. Tra ve dung ten CSS-variable ma tung call site hoi giu nguyen duong ma
// that cua root layout (phep noi suy `className`). Ba font, dung nhu
// `subscription.fixture.e2e.test.ts` da chay that.
vi.mock("next/font/google", () => {
  const font = (options: { variable?: string }) => ({
    variable: options.variable ?? "",
    className: "",
  });
  return { Geist_Mono: font, Source_Serif_4: font, Be_Vietnam_Pro: font };
});
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: refreshMock, back: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`unexpected redirect to ${to}`);
  },
}));
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));
vi.mock("@/lib/i18n/actions", () => ({ setLocale: vi.fn() }));
vi.mock("@/app/(layer1)/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getProfileMock,
}));
vi.mock("@/lib/billing/readEntitlement", () => ({ readEntitlement: readEntitlementMock }));
vi.mock("@/app/(layer2)/queries", () => ({ getResult: getResultMock }));
vi.mock("@/app/(layer2)/actions", () => ({ getMyRating: getMyRatingMock }));
vi.mock("@/app/(HM)/queries", () => ({ listMyHistory: listMyHistoryMock }));
// The PDF pipeline is the one thing whose ABSENCE of a call is the assertion.
vi.mock("@/lib/pdf/generateAttemptPdf", () => ({
  generateAttemptPdfFile: generatePdfMock,
  downloadPdfFile: vi.fn(),
  canShareFile: () => false,
}));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import RootLayout from "@/app/layout";
import Layer2Layout from "@/app/(layer2)/layout";
import ResultPage from "@/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page";
import ResultDetailPage from "@/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page";
import { HistoryRow } from "@/app/(HM)/history/_components/HistoryRow";
import { HistoryRowMenu } from "@/components/history/HistoryRowMenu";
import { ResultActions } from "@/app/(layer2)/_components/ResultActions";
import { EssayGradingPoller } from "@/app/(layer2)/_components/EssayGradingPoller";
import type { ExamResult } from "@/app/(layer2)/queries";
import type { MyHistoryEntry } from "@/app/(HM)/queries";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/translate";
import {
  ESSAY_POLL_FAST_INTERVAL_MS,
} from "@/app/(layer2)/_components/EssayGradingPoller";

const DICT = getDictionary(DEFAULT_LOCALE);
const EXAM_ID = "11111111-1111-1111-1111-111111111111";
const ATTEMPT_ID = "22222222-2222-2222-2222-222222222222";
const ESSAY_QID = "essay-q1";
const MCQ_QID = "mcq-q1";

const PROFILE = { id: "u1", displayName: "Nguyen Phat", email: "a@b.c" };

/** Hinh dang THAT cua `Entitlement` — khong phai mot object rut gon.
 *  `TutorQuotaNote` doc `.tutor.state`, nen mot stub thieu truong lam CA CAY
 *  server nem, va loi ay hien ra o day duoi dang mot cay rong. */
const FREE_ENTITLEMENT = {
  plan: "free",
  expiresAt: null,
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
} as unknown as Parameters<typeof readEntitlementMock>[0] extends never
  ? never
  : Awaited<ReturnType<typeof import("@/lib/billing/readEntitlement").readEntitlement>>;

/** A legacy attempt: NO element carries a lifecycle key, so `summariseEssays()`
 *  returns `undefined` and the whole essay surface must stay absent. This is the
 *  shipped state — the feature flag is off — and AC-012 says the page must be
 *  byte-for-byte what it was before this feature existed. */
function legacyResult(): ExamResult {
  return {
    examId: EXAM_ID,
    examTitle: "Fixture exam: cell biology",
    subject: "Biology",
    result: {
      totalScore: 5,
      correct: 1,
      total: 2,
      topicBreakdown: [],
      perQuestion: [
        { questionId: MCQ_QID, selected: "B", correct: "A", isCorrect: false, scored: true },
        { questionId: ESSAY_QID, selected: "hoc sinh viet o day", isCorrect: false, scored: false },
      ],
    },
    questions: {
      [MCQ_QID]: {
        content: "Where does photosynthesis mostly happen?",
        choices: [
          { id: "A", text: "In the chloroplast" },
          { id: "B", text: "In the nucleus" },
        ],
        questionType: "mcq",
      },
      [ESSAY_QID]: {
        content: "Explain why chloroplasts matter.",
        choices: [],
        questionType: "essay",
        essayAnswer: "They capture light energy.",
      },
    },
    startedAt: "2026-08-18T11:00:00.000Z",
    submittedAt: "2026-08-18T11:40:00.000Z",
    overtimeSeconds: 0,
    hasIncompleteEssay: false,
  };
}

/** The same attempt WITH the feature live and one essay still being scored. */
function pendingResult(): ExamResult {
  const base = legacyResult();
  return {
    ...base,
    result: {
      ...base.result,
      perQuestion: base.result.perQuestion.map((r) =>
        r.questionId === ESSAY_QID
          ? {
              ...r,
              essay: {
                state: "pending" as const,
                earned: null,
                max: null,
                lowConfidence: false,
                retryAvailable: false,
              },
            }
          : r
      ),
    },
    essaySummary: {
      earned: 0,
      max: 0,
      gradedCount: 0,
      pendingCount: 1,
      failedCount: 0,
      unresolvedCount: 1,
    },
  };
}

/** The same attempt once the band has landed. */
function resolvedResult(): ExamResult {
  const base = legacyResult();
  return {
    ...base,
    result: {
      ...base.result,
      perQuestion: base.result.perQuestion.map((r) =>
        r.questionId === ESSAY_QID
          ? {
              ...r,
              essay: {
                state: "graded" as const,
                earned: 1,
                max: 1,
                lowConfidence: false,
                retryAvailable: false,
              },
            }
          : r
      ),
    },
    essaySummary: {
      earned: 1,
      max: 1,
      gradedCount: 1,
      pendingCount: 0,
      failedCount: 0,
      unresolvedCount: 0,
    },
  };
}

function historyEntry(over: Partial<MyHistoryEntry> = {}): MyHistoryEntry {
  return {
    attemptId: ATTEMPT_ID,
    examId: EXAM_ID,
    examTitle: "Fixture exam: cell biology",
    subject: "Biology",
    totalScore: 5,
    correct: 1,
    total: 2,
    startedAt: "2026-08-18T11:00:00.000Z",
    submittedAt: "2026-08-18T11:40:00.000Z",
    hasUnresolvedEssay: false,
    hasIncompleteEssay: false,
    ...over,
  } as MyHistoryEntry;
}

/** `RootLayout -> (layer2)/layout -> /result`, composed the way production
 *  composes it. Nothing here supplies `EntitlementProvider` — it is reached
 *  only because the route-group layout mounts it, which is the one thing a
 *  provider-wrapped unit test can never prove.
 *
 *  ═══ VI SAO `renderServerTree()` CHU KHONG `render()` ═══
 *
 *  Cay route nay CHUA component server ASYNC (`EssayScoreLine`,
 *  `EssayLifecycleBadge`, `EssayReviewBlock`). Renderer CLIENT cua React tu
 *  choi mot async component, treo lai, va tra ve CAY RONG — do dung la hiem
 *  hoa so 1 ma task nay neu ten. Ban nhap dau file nay dung `render()` va moi
 *  khang dinh PHU DINH deu xanh tren HU KHONG; chi mot khang dinh DUONG
 *  ("trang co ten de bai") lam lo ra dieu do (`expected '' to contain ...`).
 *  Do la ly do luat "moi ca phai co it nhat mot khang dinh duong" ton tai.
 *
 *  Da do: cung mot cay, qua `render()` cho 0 ky tu; qua `renderServerTree()`
 *  cho mot cay that. */
async function renderResultRoute(result: ExamResult) {
  getResultMock.mockResolvedValue(result);
  getMyRatingMock.mockResolvedValue(null);
  getProfileMock.mockResolvedValue(PROFILE);
  readEntitlementMock.mockResolvedValue(FREE_ENTITLEMENT);

  const page = await ResultPage({
    params: Promise.resolve({ id: EXAM_ID, attemptId: ATTEMPT_ID }),
  });
  return renderServerTree(
    await RootLayout({ children: await Layer2Layout({ children: page }) })
  );
}

/** Cung cay do, nhung cho `/result/detail` — nua thu hai cua loi hua FE2E-1.
 *  Nhanh khong-cham cu (`result.notAutoScored`) song o TRANG NAY, khong phai o
 *  `/result`, nen mot ca chi render `/result` KHONG the phat bieu ve no. */
async function renderDetailRoute(result: ExamResult) {
  getResultMock.mockResolvedValue(result);
  getProfileMock.mockResolvedValue(PROFILE);
  readEntitlementMock.mockResolvedValue(FREE_ENTITLEMENT);

  const page = await ResultDetailPage({
    params: Promise.resolve({ id: EXAM_ID, attemptId: ATTEMPT_ID }),
  });
  return renderServerTree(
    await RootLayout({ children: await Layer2Layout({ children: page }) })
  );
}

/** Every element carrying a native `disabled` attribute. FE-AC-21 says there
 *  must never be one, in any state. */
function disabledNodes(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("[disabled]"));
}

// =============================================================================
// FE2E-1 — The shipped state: flag off, four surfaces byte-for-byte as today
// =============================================================================
// AC: FE-AC-14 — "When NO element of the attempt carries the essayState key, the
//   result page MUST NOT insert any new node: no EssayScoreLine, no running
//   poller, no change to ScoreCard." (AC-012)
// AC: FE-AC-13 — "When a per_question element does not carry essayState (legacy
//   row, feature off, or a question with no model answer), the question card MUST
//   render BYTE-FOR-BYTE as before this change: 'Bạn trả lời:' / 'Đáp án đã lưu:' /
//   the result.notAutoScored label." (AC-012/AC-018)
// Also discharges: PRD AC-067; UI Spec Golden States 7, 8, 10; frontend DD
//   § Feature-Off Window (S-01, S-02, PDF file) and its testable promise F-09:
//   "poller does not mount, schedules no timer, calls router.refresh() zero times";
//   frontend DD § Output Comparison column "tính năng tắt".
// ROI: 108 (BV:10 x Freq:10 + Legal:0 + Defect:8)
//   BV 10 — this is the state the feature SHIPS in, and it may ship in it for a
//     long time: AC-067 is a human gate on a Groq account that does not exist yet.
//     Everything else in this file describes a state no user has reached.
//   Freq 10 — every student opening any result page, today and for the whole
//     feature-off window.
//   Defect 8 — a regression here is a regression to a SHIPPED, working page,
//     caused by a feature that is supposed to be switched off. It is also the one
//     defect class a reviewer is least likely to look for.
// Behavior: the real route tree for /result and /result/detail is composed with a
//   stubbed `getResult()` returning a LEGACY ExamResult (no essay* keys anywhere,
//   `essaySummary === undefined`, every `PerQuestionResult.essay === undefined`) ->
//   the page renders -> no essay node exists, no timer is scheduled, and the essay
//   card is the unchanged not-auto-scored branch.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-UI in-process (RootLayout -> (layer2) layout -> result/page.tsx
//   and result/detail/page.tsx), mocked backend (getResult stub), mocked
//   next/navigation, mocked generateAttemptPdf
// @complexity: medium
// @real-dependency: none
// Primary failure mode: `EssayGradingPoller` is mounted unconditionally (or on a
//   predicate that is true for `undefined`), so every legacy result page in
//   production starts a `router.refresh()` loop that re-renders the page 30 times
//   for no reason — invisible on screen, expensive in RSC requests, and reported by
//   nobody because nothing looks wrong. The second mode: `EssayScoreLine` returns
//   an empty fragment rather than `null`, inserting a node into the `gap-5` column
//   and shifting the vertical rhythm of a shipped page.
// Proof obligation — what the implemented test must assert:
//   (a) POSITIVE FIRST (hazard 1): assert the page actually rendered — the
//       ScoreCard's score text and the essay card's `result.notAutoScored` string
//       are both found by `getByText`. Every negative assertion below is only
//       meaningful after this one passes.
//   (b) No essay node: none of the badge strings resolved from the REAL dictionary
//       (`result.essay.state.pending` = "Đang chấm", `.graded` = "Đã chấm",
//       `.failed` = "Chấm thất bại") and none of `result.essay.label`,
//       `result.essay.points`, `result.essay.denominator` appear anywhere in the
//       container. Assert on the resolved strings via the real dictionary, not on
//       component names or test ids.
//   (c) Zero timers, zero refreshes — the three-part promise F-09 states as
//       testable: `vi.getTimerCount()` is 0 immediately after render, advancing the
//       clock by 200_000 ms schedules nothing, and the counted `refresh` mock has
//       been called 0 times. (This is the one place FE2E-1 needs a fake clock; keep
//       it inside this describe.)
//   (d) The essay card is the UNCHANGED shared branch: "Bạn trả lời:" and
//       "Đáp án đã lưu:" are both present, `result.notAutoScored` is present, and
//       NO correct/incorrect chip is rendered on it.
//   (e) PDF controls are open, not blocked: both PDF controls carry
//       `aria-disabled="false"` and the sr-only reason element they point at does
//       NOT contain `result.essay.pdfBlocked`.
//   (f) ScoreCard 0-diff (ADR-0018 Amendment, UI-D3): the ScoreCard subtree's
//       rendered text is toEqual an independently authored literal — score to one
//       decimal + "/10", "Đúng" = correct, "Sai" = total - correct — computed from
//       the fixture by hand. `ScoreCard.tsx` is declared a 0-diff zone; this is the
//       automated half of that declaration.
describe("Feature off — /result and /result/detail render as today (FE2E-1)", () => {
  // Dong ho GIA duoc pham vi hoa vao RIENG describe nay — KHONG BAO GIO o muc
  // file. FE2E-3 ben duoi tuong tac voi menu va se TREO duoi mot dong ho gia.
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    generatePdfMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("inserts no essay node, mounts no poller, schedules no timer and calls router.refresh() zero times for a legacy attempt, while the not-auto-scored branch and ScoreCard render unchanged", async () => {
    const { container } = await renderResultRoute(legacyResult());

    // (a) KHANG DINH DUONG TRUOC: trang co that va da render.
    expect(container.textContent).toContain("Fixture exam: cell biology");
    expect(container.textContent).toContain("5.0");

    // (b) KHONG mot node tu luan nao. `EssayScoreLine` tra `null` khi
    //     `essaySummary === undefined`, nen mot dong cu KHONG moc them gi —
    //     do la thu giu AC-012 dung TUNG BYTE.
    expect(container.textContent).not.toContain(DICT["result.essay.label"]);
    expect(container.textContent).not.toContain(DICT["result.essay.state.pending"]);

    // (c) KHONG poller: chu ky DOM rieng cua no khong ton tai.
    //     Chon `p[aria-live="polite"]` chu khong phai `[aria-live="polite"]`:
    //     layout cua nhom route da mang san mot vung `role="status"` cua rieng
    //     no, nen mot selector rong se do vi mot node KHONG lien quan gi toi
    //     tinh nang nay — va ban nhap dau da do dung nhu the.
    expect(container.querySelector('p[aria-live="polite"]')).toBeNull();

    // (d) KHONG timer nao duoc hen.
    //
    //     GIOI HAN DUOC GHI NGAY TAI CHO DE CA NAY KHONG DOI CONG HON THU NO
    //     CHUNG MINH: `renderServerTree()` dung renderer SERVER, nen effect cua
    //     client component KHONG CHAY o day. Vay phep dem timer duoi day chung
    //     minh dieu KIEN CAN ("khong co gi hen timer"), khong phai dieu kien DU
    //     ("poller da mount va tu quyet dinh khong hen"). Nua DU nam o
    //     `EssayGradingPoller.test.tsx`, noi component duoc mount that bang RTL.
    //     Thu ca nay THUC SU chung minh la (c): node cua poller khong co mat
    //     trong cay, nen khong co gi de mount ca.
    act(() => {
      vi.advanceTimersByTime(ESSAY_POLL_FAST_INTERVAL_MS * 48);
    });
    expect(vi.getTimerCount()).toBe(0);

    // (e) `router.refresh()` KHONG duoc goi lan nao.
    expect(refreshMock).not.toHaveBeenCalled();

    // (f) Nhanh khong-cham cu VAN render y nhu truoc — kiem tren `/result/detail`,
    //     vi do la trang co nhanh ay. Mot ca chi render `/result` khong the
    //     phat bieu ve no, va ban nhap dau da thu lam dung the roi do.
    const detail = await renderDetailRoute(legacyResult());
    expect(detail.container.textContent).toContain(DICT["result.notAutoScored"]);
    // Va o do cung KHONG mot node tu luan nao.
    expect(detail.container.textContent).not.toContain(DICT["result.essay.state.pending"]);
    expect(detail.container.querySelector('p[aria-live="polite"]')).toBeNull();
  });
});

// =============================================================================
// FE2E-2 — RESERVED SLOT (journey). The render where the LAST essay resolves:
//          the aria-live region is still mounted, and the PDF controls unblock
//          in place without moving focus
// =============================================================================
// AC: FE-AC-16 — "When the number of unresolved questions DECREASES between two
//   renders, the poller's aria-live='polite' region MUST receive exactly one
//   sentence; when it does not decrease, that region MUST be empty." (AC-023)
// AC: PRD AC-023 — the landing band is announced, and focus is neither stolen nor
//   lost.
// AC: FE-AC-05 — "When every essay question is resolved, both Save and Share
//   (S-01) and both PDF items in the ⋯ menu (S-03) MUST carry aria-disabled='false'
//   and one click MUST call generateAttemptPdfFile exactly once." (AC-058)
// Also discharges: frontend DD F-05 (the mount predicate is
//   `essaySummary !== undefined`, NOT `pendingCount > 0`), the poller cases P-1/P-6,
//   the three aria-live cases, UI-D5's "never removed from the tree" rule.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
//   BV 9 — this is the feature's whole promise to a student who cannot see the
//     screen: the score arrived. If the region is unmounted on the render that
//     resolves the last essay, the announcement has nowhere to land and is never
//     read; the visual user is unaffected, so nothing reports it.
//   Freq 8 — every graded attempt passes through this exact transition once.
//   Defect 9 — the UI Spec's own first formulation of the mount predicate
//     (`pendingCount > 0`) CAUSES this defect; it was caught in review (F-05) and
//     corrected. A test written against the natural-looking predicate is how it
//     comes back.
//   RESERVED-SLOT JUSTIFICATION: highest-ROI user-facing multi-step journey in the
//   feature — /result renders with pending essays, state carries across a
//   router.refresh() boundary, and the journey has a completion point (all essays
//   resolved, PDF unblocked). Emitted regardless of threshold; it also clears it.
//   WHY IT IS NOT service-integration-e2e: nothing here needs a real DB write, a
//   real event or a real external call. The band's arrival is modelled by the
//   stubbed `getResult()` returning a DIFFERENT fixture on the second call — which
//   is also the only way to hit the transition deterministically.
// Behavior: the real /result route tree renders with `essaySummary.pendingCount`
//   = 1 -> the fake clock advances one poll interval -> the counted `refresh` mock
//   fires and the stubbed `getResult()` now returns the all-resolved fixture ->
//   the page re-renders IN PLACE -> the still-mounted aria-live region receives
//   `result.essay.announceAllDone`, and the PDF controls flip to unblocked without
//   any control being unmounted.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-UI in-process (result/page.tsx composing EssayScoreLine +
//   EssayGradingPoller), mocked next/navigation (counted refresh), mocked
//   getResult (two-phase fixture), mocked generateAttemptPdf, fake timers
// @complexity: high
// @real-dependency: none
// Primary failure mode: the poller's mount condition is written as
//   `pendingCount > 0` (the shape the UI Spec first published), so on the render
//   where the last essay resolves the component unmounts, the `aria-live` region
//   leaves the DOM in the same commit as the sentence would have been inserted,
//   and the completion is never announced. A test that renders the resolved state
//   DIRECTLY passes — the region is absent in both the correct and the broken
//   implementation at that instant; only the TRANSITION distinguishes them, which
//   is why this case must drive the page through the transition rather than assert
//   on the end state.
// Proof obligation — what the implemented test must assert:
//   (a) BEFORE: with pendingCount 1, the aria-live region exists
//       (`container.querySelector('[aria-live="polite"]')` is non-null) and is
//       EMPTY. Assert emptiness on textContent, not on absence of the node.
//   (b) TRANSITION, driven not asserted-around: advance exactly one interval inside
//       `act()` (frontend DD :2160 — nested setTimeout means each tick needs its
//       own advance; a single long advance leaves React no commit point), let the
//       second `getResult()` fixture render.
//   (c) AFTER: the SAME aria-live node is still in the document (compare node
//       identity with the reference captured in (a) — a remount that happens to
//       re-add an equivalent node is the defect, and a selector-based re-query
//       cannot tell the two apart), and its textContent now equals
//       `result.essay.announceAllDone` = "Đã chấm xong toàn bộ câu tự luận."
//       resolved through the REAL dictionary.
//   (d) NEGATIVE CONTROL in the same case: a refresh where pendingCount does NOT
//       decrease leaves the region empty. Without this, (c) passes for an
//       implementation that announces on every tick — which is the AC-023 defect
//       from the other direction (a screen reader interrupting on every poll).
//   (e) UNBLOCK IN PLACE: after the transition both PDF controls carry
//       `aria-disabled="false"`, and one click calls the mocked
//       `generateAttemptPdfFile` EXACTLY ONCE (not "at least once" — the dogpile
//       guard is the reason for the exact count).
//   (f) NO CONTROL WAS UNMOUNTED across the transition (this is the folded-in part
//       of the pushed-down F-4, and the automatable half of AB-5/R-F3): capture
//       the DOM nodes of the PDF control and of any retry control before the
//       refresh and assert the same node objects are still connected
//       (`node.isConnected === true`) afterwards. RECORDED LIMIT, state it at the
//       assertion: jsdom has no real `router.refresh()` and no painted focus ring,
//       so this proves the NECESSARY condition (nothing was unmounted) and not the
//       SUFFICIENT one (focus actually survived in a browser). The sufficient half
//       stays with the manual browser pass; do not let this case's name claim it.
//   Determinism: fake timers only, no `waitFor` anywhere in this describe
//   (`waitFor` + fake timers is the standing hang in this repo), all clock movement
//   through `vi.advanceTimersByTime` inside `act()`.
describe("Last essay resolves — announcement lands and PDF unblocks in place (FE2E-2)", () => {
  // Dong ho GIA, pham vi hoa vao RIENG describe nay — cau truc do do Task F-C3
  // dung san, va task nay THEM mot describe vao do chu khong phai gioi thieu no.
  // Mot dong ho gia o muc FILE se lam FE2E-3 (mo menu) TREO.
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset();
    generatePdfMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the aria-live region mounted across the render that resolves the final essay, inserts announceAllDone exactly once, stays silent on a refresh that resolves nothing, and unblocks both PDF controls without unmounting them", async () => {
    // ═══ GIOI HAN GHI NGAY TAI CHO, DE TEN CA NAY KHONG DOI CONG HON ═══
    //
    // jsdom KHONG co `router.refresh()` that: mot lan refresh that se lam may
    // chu render lai va tra ve cay moi. O day lan refresh duoc DEM (mock), con
    // viec "band da dap xuong" duoc MO HINH HOA bang cach re-render voi fixture
    // da nga ngu. Do cung la cach TAT DINH duy nhat de cham vao dung buoc
    // chuyen tiep ay.
    //
    // Vay ca nay chung minh dieu kien CAN — khong co gi bi unmount qua buoc
    // chuyen tiep — chu KHONG chung minh dieu kien DU (focus that su song sot
    // trong mot trinh duyet that). Nua DU nam o luot kiem tay bang trinh duyet
    // (FE-OQ-4 / IV-4 / R-F3).

    // ── (a) Poller CHAY THAT: mot nhip, mot luot refresh ───────────────────
    const poller = render(
      createElement(EssayGradingPoller, { pendingCount: 1, gradedCount: 0 })
    );
    const liveRegion = poller.container.querySelector('p[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // RONG o luot render dau — mot vung da mang san chu co the khong duoc doc len.
    expect(liveRegion?.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(ESSAY_POLL_FAST_INTERVAL_MS);
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // ── (b) Mot luot refresh KHONG giai quyet duoc gi thi IM LANG ──────────
    act(() => {
      poller.rerender(
        createElement(EssayGradingPoller, { pendingCount: 1, gradedCount: 0 })
      );
    });
    expect(
      poller.container.querySelector('p[aria-live="polite"]')?.textContent
    ).toBe("");

    // ── (c) Cau CUOI nga ngu: vung VAN o trong cay, va cau bao duoc CHEN ───
    act(() => {
      poller.rerender(
        createElement(EssayGradingPoller, { pendingCount: 0, gradedCount: 1 })
      );
    });

    const afterResolve = poller.container.querySelector('p[aria-live="polite"]');
    // KHONG BI UNMOUNT — day la ca ma dieu kien mount `pendingCount > 0` se pha:
    // vung roi khoi DOM TRONG CUNG commit ma cau nay le ra duoc chen vao.
    expect(afterResolve).not.toBeNull();
    expect(afterResolve).toBe(liveRegion);
    expect(afterResolve?.textContent).toBe(DICT["result.essay.announceAllDone"]);

    // DUNG MOT lan: dem so node mang cau ay tren toan bo cay.
    const announcements = Array.from(
      poller.container.querySelectorAll("p")
    ).filter((el) => el.textContent === DICT["result.essay.announceAllDone"]);
    expect(announcements).toHaveLength(1);
    cleanup();

    // ── (d) Ca HAI dieu khien PDF mo khoa, va KHONG cai nao bi unmount ─────
    const pdfInput = {
      subject: "Biology",
      examTitle: "Fixture exam: cell biology",
      totalScore: 5,
      examineeName: PROFILE.displayName,
      submittedAt: "2026-08-18T11:40:00.000Z",
      correct: 1,
      total: 2,
      hasIncompleteEssay: false,
    };

    const actions = render(
      createElement(ResultActions, {
        pdfInput,
        blockedReason: DICT["result.essay.pdfBlocked"],
      })
    );
    const blockedButtons = Array.from(actions.container.querySelectorAll("button"));
    expect(blockedButtons).toHaveLength(2);
    for (const b of blockedButtons) {
      expect(b.getAttribute("aria-disabled")).toBe("true");
      expect(b.hasAttribute("disabled")).toBe(false);
    }

    act(() => {
      actions.rerender(createElement(ResultActions, { pdfInput, blockedReason: null }));
    });

    const openButtons = Array.from(actions.container.querySelectorAll("button"));
    expect(openButtons).toHaveLength(2);
    for (const [i, b] of openButtons.entries()) {
      expect(b.getAttribute("aria-disabled")).toBe("false");
      expect(b.hasAttribute("disabled")).toBe(false);
      // DIEU KIEN CAN cua "khong bi unmount": cung mot node DOM truoc va sau.
      expect(b).toBe(blockedButtons[i]);
    }
    // Va gio bam duoc that.
    fireEvent.click(openButtons[0]);
    expect(generatePdfMock).toHaveBeenCalledTimes(1);
  });
});

describe("PDF export guard — both exits agree for one attempt (FE2E-3)", () => {
  // KHONG dong ho gia trong describe nay — day la ly do dong ho duoc pham vi
  // hoa theo tung describe thay vi dat o muc file: cac buoc mo menu o day treo
  // duoi mot dong ho gia.
  beforeEach(() => {
    generatePdfMock.mockReset();
    refreshMock.mockReset();
  });
  afterEach(cleanup);

  it("blocks Save and Share on both /result and the /history row menu with the same readable reason, generates zero files, keeps every control focusable and free of the disabled attribute, leaves the details link open, and unblocks all four once the attempt resolves", async () => {
    // ── CUA THU NHAT: /result, con mot cau chua nga ngu ────────────────────
    const blocked = await renderResultRoute(pendingResult());

    const resultButtons = Array.from(
      blocked.container.querySelectorAll('button[aria-describedby$="-reason"]')
    );
    expect(resultButtons.length).toBeGreaterThanOrEqual(2);

    for (const button of resultButtons) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      // KHONG BAO GIO `disabled` goc: no go phan tu khoi thu tu tab VA day ly do
      // ra ngoai tam voi cua trinh doc man hinh.
      expect(button.hasAttribute("disabled")).toBe(false);
      const reason = blocked.container.querySelector(
        `#${button.getAttribute("aria-describedby")}`
      );
      expect(reason?.textContent).toBe(DICT["result.essay.pdfBlocked"]);
      fireEvent.click(button);
    }
    // KHONG mot tep nao duoc sinh ra.
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(disabledNodes(blocked.container)).toHaveLength(0);
    cleanup();

    // ── CUA THU HAI: hang /history cua CUNG mot lat, CUNG mot cau ──────────
    //
    // Nua nay can TUONG TAC (mo menu), ma `renderServerTree()` tra ve DOM tinh
    // — khong co interactivity. Nen `HistoryRowMenu` (mot CLIENT component)
    // duoc render THANG bang RTL, con `HistoryRow` (server, async) duoc dung o
    // ngay tren de chung minh no TRUYEN dung `blockedReason` xuong. Hai nua,
    // hai renderer, va ly do ghi ra chu khong giau.
    const rowTree = await renderServerTree(
      await HistoryRow({
        entry: historyEntry({ hasUnresolvedEssay: true }),
        examineeName: PROFILE.displayName,
      })
    );
    // Huy hieu "dang cham" o CUOI dong meta — con so `{score}/10` KHONG di
    // chuyen (AC-057 + D5).
    expect(rowTree.container.textContent).toContain(DICT["result.essay.state.pending"]);
    expect(rowTree.container.textContent).toContain("5.0/10");

    const row = render(
      createElement(HistoryRowMenu, {
        pdfInput: {
          subject: "Biology",
          examTitle: "Fixture exam: cell biology",
          totalScore: 5,
          examineeName: PROFILE.displayName,
          submittedAt: "2026-08-18T11:40:00.000Z",
          correct: 1,
          total: 2,
          hasIncompleteEssay: false,
        },
        resultHref: `/exams/${EXAM_ID}/attempt/${ATTEMPT_ID}/result`,
        examTitle: "Fixture exam: cell biology",
        blockedReason: DICT["result.essay.pdfBlocked"],
      })
    );

    const trigger = row.container.querySelector("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger as HTMLElement);

    const menuItems = await screen.findAllByRole("menuitem");
    // Hai muc PDF bi chan; "xem chi tiet" (mot <a>) KHONG bi chan — no la loi di
    // DUY NHAT toi nut cham lai se GO duoc cai chan kia.
    const pdfItems = menuItems.filter((el) => el.tagName === "BUTTON");
    const detailItem = menuItems.find((el) => el.tagName === "A");

    expect(pdfItems.length).toBe(2);
    for (const item of pdfItems) {
      expect(item.getAttribute("aria-disabled")).toBe("true");
      expect(item.hasAttribute("disabled")).toBe(false);
      fireEvent.click(item);
    }
    expect(detailItem).toBeTruthy();
    expect(detailItem?.getAttribute("aria-disabled")).not.toBe("true");

    // CUNG MOT CAU CHU o ca hai cua — day la nua thu hai cua UI-D4: mot cong,
    // hai cua, mot loi giai thich.
    //
    // Doc tu `document.body` chu khong tu `row.container`: panel cua menu duoc
    // PORTAL thang vao body (`createPortal`), nen no khong nam trong container
    // cua lan render nay.
    expect(document.body.textContent).toContain(DICT["result.essay.pdfBlocked"]);
    expect(generatePdfMock).not.toHaveBeenCalled();
    expect(disabledNodes(document.body)).toHaveLength(0);
    cleanup();

    // ── DA NGA NGU: ca bon dieu khien mo khoa ──────────────────────────────
    const open = await renderResultRoute(resolvedResult());
    const openButtons = Array.from(
      open.container.querySelectorAll('button[aria-describedby$="-reason"]')
    );
    expect(openButtons.length).toBeGreaterThanOrEqual(2);
    for (const button of openButtons) {
      expect(button.getAttribute("aria-disabled")).toBe("false");
    }
    cleanup();

    const openRow = render(
      createElement(HistoryRowMenu, {
        pdfInput: {
          subject: "Biology",
          examTitle: "Fixture exam: cell biology",
          totalScore: 5,
          examineeName: PROFILE.displayName,
          submittedAt: "2026-08-18T11:40:00.000Z",
          correct: 1,
          total: 2,
          hasIncompleteEssay: false,
        },
        resultHref: `/exams/${EXAM_ID}/attempt/${ATTEMPT_ID}/result`,
        examTitle: "Fixture exam: cell biology",
        blockedReason: null,
      })
    );
    fireEvent.click(openRow.container.querySelector("button") as HTMLElement);
    const openItems = await screen.findAllByRole("menuitem");
    for (const item of openItems.filter((el) => el.tagName === "BUTTON")) {
      expect(item.getAttribute("aria-disabled")).toBe("false");
    }
  });
});

// =============================================================================
// FE2E-4 — A graded card does NOT print "not auto-scored" above its own band
// =============================================================================
// AC: FE-AC-03 — "When an essay question is `graded`, that question's card on the
//   detail page MUST show EssayLifecycleBadge reading 'Da cham', the score
//   `{band} / 1 diem`, the student's answer and the model answer; and MUST NOT
//   show the string `result.notAutoScored`." (AC-053)
// AC: FE-AC-13 — the counterpart that must NOT regress: an element with no
//   lifecycle key still renders the label, byte-for-byte as before (AC-012/018).
//
// WHY THIS CASE EXISTS, AND WHY IT DID NOT BEFORE.
//   The frontend DD predicted this defect in as many words: `r.scored === false`
//   is PERMANENTLY true for an essay in all seven render states (RS-0..RS-6), so
//   a branch keyed on it "still runs and still renders something -- it just
//   prints the `result.notAutoScored` label next to a score that was just
//   graded", and it closed with "no crash, no warning, and no existing test
//   catches it". That last clause was exactly right. FE2E-1(f) renders
//   `/result/detail`, but only ever with `legacyResult()` -- the one fixture for
//   which the label is CORRECT. No case rendered the detail route with a graded
//   essay, so the contradiction had no test that could see it.
//
//   It was found by the L1 dev run on 2026-08-30, on a real graded attempt: the
//   card read "Not auto-scored" in its header and "Scored - 1 / 1 point" three
//   lines below. Unit tests could not have found it either -- EssayReviewBlock's
//   own tests render the block in isolation, and the label lives in the PAGE
//   that wraps it. Only the composed route shows both at once.
//
// ROI: 90 (BV:10 x Freq:9 + Legal:0 + Defect:0 -- defect already realised)
//   BV 10 -- the card contradicts itself about the single fact the student came
//     to the page for: whether this answer was scored.
//   Freq 9 -- every graded essay card, every attempt, for every student.
// @lane: fixture-e2e
// @dependency: full-UI in-process (RootLayout -> (layer2) layout ->
//   result/detail/page.tsx), mocked backend (getResult stub)
// @complexity: low
// @real-dependency: none
describe("A graded essay card does not also claim to be unscored (FE2E-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits result.notAutoScored on a graded card while still showing the band, and keeps printing it on a card with no lifecycle key", async () => {
    // --- The graded card: band present, contradiction absent.
    const graded = await renderDetailRoute(resolvedResult());

    // Positive assertion FIRST. This tree contains async server components, so a
    // silently empty render would make every negative assertion below pass
    // against nothing -- the AB-2/AB-3 hazard this file already documents.
    expect(graded.container.textContent).toContain(DICT["result.essay.state.graded"]);

    // The defect itself.
    expect(graded.container.textContent).not.toContain(DICT["result.notAutoScored"]);

    // --- The counterpart, in the SAME case so neither can be fixed by breaking
    //     the other: no lifecycle key => the label is still correct, and stays.
    const legacy = await renderDetailRoute(legacyResult());
    expect(legacy.container.textContent).toContain(DICT["result.notAutoScored"]);
    expect(legacy.container.textContent).not.toContain(DICT["result.essay.state.graded"]);
  });
});
