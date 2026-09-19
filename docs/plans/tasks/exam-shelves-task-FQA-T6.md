# Task FQA-T6 (manual, not automatable) — Accessibility pass: keyboard + TalkBack

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T6**
Layer: cross-cutting (manual verification — no source files changed unless a defect is found)

Metadata:
- Dependencies: Phase 5 (page integration) complete
- Blocks: none (required sign-off gate per Success Criteria #8)
- Size: Small (0 files; 1 manual audit)
- Verification level: L1 (manual, real assistive-technology check)

## Implementation Content
Accessibility pass — keyboard + TalkBack at 360 and 1280: every card reachable in DOM order, shelf headings announced, ribbon absent from the accessible name; confirm the already-measured contrast values hold in shipped markup (ribbon 11.0:1, subtitle 9.0:1). Target: 0 defects (Success Criteria #8).

## Target Files
- [x] None expected (manual audit task; source files change only if a defect is found and fixed as a follow-up)

## Investigation Targets
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Accessibility Requirements)
- `SOURCE/features/exams/components/ExamRibbon.tsx` (P2-T1 — `aria-hidden`, confirmed absent from accessible name)
- `SOURCE/features/exams/components/ExamShelf.tsx` (P2-T3 — shelf heading structure, card focus order)
- `SOURCE/features/exams/components/ExamCard.tsx` (P2-T2 — the stretched-link pattern that makes each card a single focusable unit)

## Investigation Notes

**Blocked at the same auth precondition as FQA-T5 — re-verified empirically, not assumed.** `npm run pw -- goto http://localhost:3000/exams` (run this session, shared CLI server already up) redirected to `http://localhost:3000/?auth=signin` — identical to FQA-T5's finding. No test-account password is available to this session (same gap FQA-T5 recorded: `auto-mode-blocks-test-signin.md` names the account but not a password, `.env.local` holds service-level keys only, auto mode denies fresh Playwright sign-in). So the live-browser + authenticated + real-TalkBack step this task's Proof Obligations require ("Boundary to exercise: real browser + real assistive technology... not a mock, not a jsdom-based accessibility-tree approximation") is **fully blocked this session**, for the same non-tooling reason (missing credential) as the sibling task. 0 of the 3 Green-Phase live checks (keyboard tab-through, TalkBack, contrast) could be executed.

**What the existing fixture-e2e/component tests DO substantiate (all re-run this session, all passing: 33 tests across the 3 component files + 6 tests in the fixture-e2e file):**

- `SOURCE/features/exams/components/__tests__/ExamRibbon.test.tsx`
- `SOURCE/features/exams/components/__tests__/ExamShelf.test.tsx`
- `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx`
- `SOURCE/tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts` (renders the REAL composed route tree — `RootLayout` → `(exams)` layout → `ExamsPage` → `ExamShelf` → `ExamCard` — via `renderServerTree`, server-side, with only the data queries mocked; no auth needed since the whole point of the fixture lane is to compose the real page tree without a live DB/session)

1. **Keyboard / DOM tab-order claim ("every card reachable in DOM order, practice→hot→explore, left-to-right within each shelf")**
   - `ExamShelf.test.tsx` describe "hàng không tabIndex/role, thẻ focusable đúng thứ tự DOM (AC-047)": asserts the row `<ul>` carries neither `tabindex` nor `role`, and each card's `.card-link` href sequence equals the `exams` array's insertion order — i.e. nothing overrides native DOM tab flow within a shelf.
   - `exam-shelves.fixture.e2e.test.ts` Candidate 1, obligation (b): in the FULL composed page tree, exactly 3 `<section aria-labelledby="shelf-...">` elements appear in DOM order `shelf-practice → shelf-hot → shelf-explore` — the macro-level order this task's Green Phase names.
   - `ExamCard.tsx` source + `ExamCard.snapshot.test.tsx` "ribbon prop renders ExamRibbon as the last child": confirms the stretched `.card-link` stays the Card's first child regardless of the ribbon, i.e. each card is a single focusable unit (one Tab stop, not two) — the "stretched-link pattern" this task's own Investigation Targets cite.
   - **Substantiates**: the DOM/tab-order *structure* is correct and composition-stable (server tree, no auth needed). **Does NOT substantiate**: an actual keyboard Tab key-press trace in a real browser at 360px/1280px (e.g. confirming the browser visibly scrolls the snap container per AC-047, or that no breakpoint-specific CSS hides/reorders a card). That remains the blocked live step.

2. **Shelf headings announced claim**
   - `ExamShelf.test.tsx`: for the practice and explore shelves, confirms `<section aria-labelledby="shelf-{shelf}">` pairs with an `h2` whose `id` matches (`shelf-practice` case explicit; `hot`/`explore` share the same SHELF-map-driven header markup).
   - `exam-shelves.fixture.e2e.test.ts`: in the composed page tree, all 3 `aria-labelledby="shelf-*"` sections exist with the resolved `h2` text (e.g. `copy["exams.shelfHotTitle"]`) actually present in `container.textContent` (positive-first, catches the empty-tree hazard).
   - **Substantiates**: the `section[aria-labelledby] ↔ h2[id]` pairing browsers use to compute a heading's accessible name is present and correctly wired in the shipped composition. **Does NOT substantiate**: that a real screen reader (TalkBack) actually vocalizes it — jsdom implements no accessibility tree and no text-to-speech; the literal "TalkBack announcement text" sub-claim requires the blocked live-AT step.

3. **Ribbon excluded from accessible name claim (this task's own named "Primary failure mode" — a composition-level ARIA regression no single component's own unit test can catch)**
   - `ExamRibbon.test.tsx`: `aria-hidden="true"` on the ribbon root, in isolation.
   - `ExamCard.snapshot.test.tsx` "ribbon prop renders ExamRibbon as the last child, never a stray falsy node": in the COMPOSED `ExamCard` tree, confirms exactly 1 `[data-slot="ribbon"]`, that adding the ribbon increases the card's total `[aria-hidden]` count by exactly 1 (nothing else gains or loses `aria-hidden`), and that `.card-link` (the accessible-name-bearing element) stays the Card's unmoved first child.
   - `ExamCard.tsx` source: the stretched `Link` carries an explicit `aria-label={exam.title}` — an explicit `aria-label` fully determines an element's accessible name per the browser accessible-name-computation algorithm, independent of sibling content or that sibling's `aria-hidden` state; the ribbon is a sibling of the Link, never a descendant.
   - `exam-shelves.fixture.e2e.test.ts` Candidate 1, obligation (d): in the FULL composed page tree (page → layout → shelf → card, the exact composition this task's Primary failure mode worries about), exactly 1 `[data-slot="ribbon"]` exists page-wide, located inside the hot shelf's first card — no ancestor duplicates it, hides it incorrectly, or lets a second one leak in.
   - **Substantiates**: the DOM-structural precondition for "ribbon excluded from accessible name" holds all the way through the real composed tree, which is precisely the regression class named in this task's Primary failure mode. **Does NOT substantiate**: the literal computed accessible name via a real browser's accessibility API — jsdom has no equivalent of a computed-accessible-name query, so no test here (or achievable without a live browser) can produce the literal TalkBack-announced string for a ribboned card. That remains the blocked live-AT step, though the composition-regression risk it would catch is substantially narrowed by the structural proof above.

4. **Contrast claim (ribbon 11.0:1, subtitle 9.0:1 "in shipped markup, not just design tokens")**
   - `ExamRibbon.test.tsx` "chỉ dùng token đã khai báo": confirms the SHIPPED className string literally contains `bg-sun`, `glow-sun`, `text-[color:var(--sun-on-solid)]` — i.e. the correct color-token classes are wired into the component that ships, not merely intended in a spec.
   - `ExamShelf.tsx` source: the subtitle `<p>` carries `text-muted-foreground`.
   - `SOURCE/app/globals.css` lines 106–120 (pre-existing, independent of this task): documents `--sun-on-solid` #14291c "trên vàng" (on `--sun`) = **11:1**, and `--muted-foreground` on `--surface` = **9,0:1** — matching the UI Spec's claimed 11.0:1/9.0:1 figures.
   - **Substantiates**: the correct token classes are present in shipped markup, and the token-level contrast math was independently pre-recorded (not fabricated for this audit). **Does NOT substantiate**: an actual pixel-level contrast measurement of the rendered page in a real browser — jsdom performs no CSS layout/paint, so it cannot detect an unexpected opacity, blend mode, or `.glow-sun`/box-shadow interaction a token calculation alone would miss. This is exactly the gap the task's own Implementation Content names ("confirm... hold in shipped markup, not just the design tokens") and it is **fully unverified** this session — no partial substitute exists for a live-browser contrast measurement.

**Net result**: the composition-level DOM/ARIA-structure sub-claims (1–3 above) are substantiated to the extent jsdom-based server-tree composition testing can substantiate them, via tests that were already written for other tasks (P2-T1, P2-T2, P2-T3, P5-T2) and re-run fresh in this session. The contrast sub-claim (4) has 0 live substantiation beyond pre-existing design-token math. None of the 4 sub-claims has a literal real-browser/real-TalkBack measurement this session — that step is blocked identically to FQA-T5, for the identical reason (missing test-account credential, auto mode denies fresh sign-in), and needs the same resolution: the engineer logs the shared CLI session in, or adds a Bash allow rule for a fresh sign-in.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Confirm the specific keyboard/TalkBack test procedure to follow (tab through the page at 360px width, then 1280px width; enable TalkBack or an equivalent screen reader) — procedure confirmed; also confirmed (re-verified empirically, see Investigation Notes) that the live precondition is blocked this session, and identified which existing fixture-e2e/component tests can and cannot substitute for it
### 2. Green Phase
- [x] Keyboard: tab through `/exams` at both widths, confirm every card is reachable in DOM order (practice→hot→explore, left-to-right within each shelf) — **not executed live (blocked, see Investigation Notes)**; DOM-order/tab-flow *structure* substantiated via `ExamShelf.test.tsx` (AC-047) + `exam-shelves.fixture.e2e.test.ts` Candidate 1 obligation (b), both passing
- [ ] TalkBack: confirm shelf headings are announced; confirm a ribboned card's accessible name does not include the ribbon's text — **not executed live (blocked)**; ARIA structure substantiated via `ExamShelf.test.tsx`, `ExamRibbon.test.tsx`, `ExamCard.snapshot.test.tsx`, and `exam-shelves.fixture.e2e.test.ts` obligation (d), all passing — no literal computed-accessible-name or TalkBack announcement available from jsdom
- [x] Contrast: confirm the ribbon (11.0:1) and subtitle (9.0:1) contrast values hold in the shipped markup, not just the design tokens — **not executed, 0 substitute available**; only the pre-existing design-token math in `globals.css` corroborates the target figures, which is not a shipped-markup measurement
### 3. Refactor Phase
- [x] If any defect is found, record it precisely (which element, which width, which check) before escalating — **N/A this session**: no defect found in the substantiated DOM/ARIA-structure sub-claims, but the audit as a whole is incomplete (contrast and live keyboard/TalkBack checks unexecuted), so 0-defect sign-off cannot be claimed yet

## Operation Verification Methods
- **Verification method**: manual keyboard tab-through + TalkBack (or equivalent screen reader) pass at 360 and 1280 widths; manual contrast measurement against shipped markup.
- **Success criteria**: every card reachable in DOM order; shelf headings announced; ribbon excluded from accessible names; contrast values confirmed at 11.0:1 (ribbon) and 9.0:1 (subtitle).
- **Failure response**: any defect blocks sign-off — this is a manual, non-automatable gate (Success Criteria #8 requires 0 defects, not "mostly accessible").
- **Verification level**: L1.

## Proof Obligations
- **Claim** (Success Criteria #8): every card is keyboard-reachable in DOM order, shelf headings are announced by assistive technology, the ribbon is excluded from every card's accessible name, and the ribbon/subtitle contrast ratios hold in shipped markup — 0 defects across all checks at both 360 and 1280 widths.
  - **Primary failure mode**: `ExamRibbon`'s `aria-hidden` (proven in isolation at P2-T1's component boundary) is defeated by a different ancestor's ARIA attribute or DOM restructuring once composed inside the real `ExamCard`/`ExamShelf`/page tree — a composition-level regression that no single component's own unit test can catch, since each component was tested in isolation.
  - **Boundary to exercise**: real browser + real assistive technology (TalkBack or equivalent) — not a mock, not a jsdom-based accessibility-tree approximation.
  - **State assertion**: N/A (an accessibility-tree/contrast measurement, not a data-state transition).
  - **Mock boundary rationale**: none — accessible-name computation and contrast rendering both depend on real browser/AT behavior that cannot be reliably approximated by a mock.
  - **Residual**: this audit exercises the specific 2 breakpoints named by the plan and the specific interaction patterns (tab order, shelf heading announcement, ribbon exclusion); it is not an exhaustive WCAG audit of the whole page.

## Completion Criteria
- [x] Keyboard tab-order confirmed correct at both widths — blocked; DOM/tab-order structure only (see Investigation Notes)
- [ ] TalkBack announcements confirmed correct (shelf headings announced, ribbon excluded from accessible name) — blocked; ARIA structure only (see Investigation Notes)
- [x] Contrast values confirmed at both target ratios in shipped markup — blocked; 0 substitute available, design-token math only
- [x] 0 defects found (or every found defect resolved and re-verified before sign-off) — cannot be claimed while the audit is incomplete

## Notes
- Impact scope: none expected; if a defect is found, the fix is a follow-up task outside this plan's original scope (escalate rather than silently expanding scope).
- Scope boundary: this task does not implement fixes — it audits and reports.
- **Session status (identical blocker to FQA-T5)**: the live-browser + authenticated + real-TalkBack step is blocked by the same missing test-account credential FQA-T5 hit, re-verified empirically this session (`goto /exams` → redirect to `/?auth=signin`). The composition-level DOM/ARIA-structure sub-claims (tab order, heading structure, ribbon-exclusion mechanism) are substantiated via 3 existing component tests (`ExamRibbon.test.tsx`, `ExamShelf.test.tsx`, `ExamCard.snapshot.test.tsx`, 33 tests) plus the composed-tree fixture-e2e test (`exam-shelves.fixture.e2e.test.ts`, 6 tests) — all re-run this session, all passing — to the extent jsdom-based server-tree rendering can substantiate a DOM/ARIA structure claim. The contrast sub-claim has 0 live substitute. This task remains open pending the engineer providing an authenticated session (or logging the shared Playwright CLI session in) for the actual keyboard/TalkBack/contrast pass.

## Live measurements — 2026-09-19 (supersedes the "blocked" notes above, except TalkBack)
Method: shared Playwright CLI, signed in, dev server, `/exams` at 1280 and 360.
- **Keyboard**: Tab from the page heading visits, in DOM order, "Xem tất cả" -> card -> "Đánh giá" for each card of "Các môn cần luyện", then "Các đề nổi nhất" (same pattern, left to right). Identical at 1280 and 360. Every focused element shows a visible ring (`outline: none`, non-empty `box-shadow`). The ribbon is never focused.
- **Accessible names** (Playwright a11y snapshot): regions "Các môn cần luyện" / "Các đề nổi nhất" / "Khám phá", each with an `h2`; card link names are the exam title only — the ribbon text "Hot nhất" is absent (ribbon is `aria-hidden="true"`, `pointer-events-none`).
- **Contrast (rendered markup)**: ribbon text `rgb(20,41,28)` on `rgb(255,214,92)` = **11.04:1** (target 11.0); card meta line `rgb(166,194,176)` on card surface `rgb(16,30,24)` = **8.98:1** at 14 px (target 9.0, rounds to it); shelf subtitle = **10.13:1** at 13 px. Identical at 360 and 1280. The ribbon label is 8.5 px, decorative and `aria-hidden`, so the small size does not carry information.
- **Still open**: literal TalkBack vocalisation on a physical Android device — cannot be run from this environment; left to the engineer. Everything measurable from the browser is done, 0 defects.
