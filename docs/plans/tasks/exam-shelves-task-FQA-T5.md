# Task FQA-T5 (manual, not automatable) — Playwright CLS audit

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T5**
Layer: cross-cutting (manual verification — no source files changed unless a defect is found)

Metadata:
- Dependencies: Phase 5 (page integration) and Phase 7 (home block) complete
- Blocks: none (but is a required sign-off gate per Success Criteria #3)
- Size: Small (0 files; 1 manual audit run)
- Verification level: L1 (manual, real-browser functional measurement)

## Implementation Content
Playwright CLI interaction audit (`npm run pw`, run from inside `SOURCE/`) — measure CLS at 360/768/1024/1280 on `/exams` (0 params) cold open AND on a horizontal shelf swipe, plus `/exams?sort=hot` and `/` signed-in. Target: CLS = 0 at all four widths, both triggers (Success Criteria #3).

## Target Files
- [x] None expected (manual measurement task; source files change only if a defect is found and fixed as a follow-up)

## Investigation Targets
- `SOURCE/scripts/pw/cli.mjs` (the Playwright CLI harness this task runs)
- `docs/design/exam-shelves-frontend-design.md` (§ Rendering, performance and motion — the CLS=0 design intent, `motion-safe:scroll-smooth`)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Motion, § Responsive Behaviour — the 4 target breakpoints)
- `C:\Users\ASUS\.claude\projects\...\windows-bash-tooling-quirks.md`-equivalent project context: Playwright CLI dies during build; run from inside SOURCE; scope selectors to `main`

## Investigation Notes

**Tooling confirmed runnable** — `npm run pw` (`SOURCE/scripts/pw/cli.mjs`) executed successfully from inside `SOURCE/` in this session: `status`, `goto`, `text`, `snapshot`, `click`, `fill`, `eval` all round-tripped against the shared detached server (`%TEMP%\ms-molar-pw-cli\port`). No `eval`-command has a CLS helper built in — `SOURCE/scripts/pw/server.mjs`'s `eval` handler is a raw `page.evaluate(src => eval(src))`; a working one-liner was validated and ready to use: `performance.getEntriesByType('layout-shift').reduce((s,e)=>s+(e.hadRecentInput?0:e.value),0)` (Chromium-only Layout Instability API, matches how `.claude/skills/ui-audit/scripts/audit.mjs` computes `cls_score` elsewhere in this repo — buffered PerformanceObserver / `getEntriesByType`, sum of non-recent-input `value`s). For the swipe scenario the plan was: snapshot `performance.getEntriesByType('layout-shift').length` before the swipe, perform the drag, then sum only entries past that index — isolating swipe-caused shift from cold-open shift.

**Blocked at the auth precondition — 0/16 data points measured.** All four scenarios (`/exams` cold open, shelf swipe, `/exams?sort=hot`, `/` signed-in) require an authenticated session:
- `SOURCE/lib/supabase/middleware.ts:44-87` (`PUBLIC_PATHS`) does not list `/exams` — confirmed empirically in this session: `node scripts/pw/cli.mjs goto http://localhost:3000/exams` redirected to `http://localhost:3000/?auth=signin`.
- `docs/design/exam-shelves-frontend-design.md:43` states outright: "logged-out visitors never reach shelf markup" — `/exams` absent from `PUBLIC_PATHS` is cited as AC-014.
- `/` signed-in is explicitly the authenticated variant of the home page per the task description; the guest `/` shows the marketing/login view only (confirmed via `text main` — guest copy + `Đăng nhập`/`Đăng ký` panel, no shelf).

**Checked for an existing authenticated session/storageState before assuming blocked (per task instruction):**
- No `storageState*.json` file exists anywhere in this worktree (`find` across the repo, excluding `node_modules`, returned nothing).
- The shared CLI server process was already running (`%TEMP%\ms-molar-pw-cli\port`, alive since this session's start) — checked its current page directly rather than starting a fresh one. It was **not** authenticated: `text main` on `/` showed the guest login panel, and `goto /exams` redirected to `/?auth=signin` as above.
- `.claude/skills/ui-audit/scripts/audit.mjs` accepts a `--storage-state=` path for exactly this purpose, but no such file exists to pass it.

**Attempted the sign-in path once, per instruction not to silently skip it:** clicked the page's `Đăng nhập` control and inspected the form (`snapshot main` — email/password/submit all present, no credential typed). At that point the task hit a harder blocker than the previously-recorded auto-mode denial: **no test-account password is available to this session at all.** Project memory (`auto-mode-blocks-test-signin.md`, 2026-09-10) records the test account as `smithnguyen247+rlstesta@gmail.com` but never its password (rightly — memory doesn't store credentials), and `SOURCE/.env.local` was checked for variable **names only** (not values) — no `TEST_ACCOUNT_PASSWORD`-shaped key exists; the env file only holds service-level keys (Supabase anon/service-role, Gemini, Groq, payOS, SMTP, admin IDs), not a browser-login password. Repo-wide search for e2e/integration test credentials (`TEST_ACCOUNT`, `signInWithPassword`, etc.) found only service-role-key-based fixture setup (`tests/e2e/service/*Fixtures.ts`, `supabase/test-rls.ts`) — a different lane that mints DB rows directly, not a browser session password. So: not just an auto-mode policy block this time, but a literal missing secret this session has no path to. Per the project's own established pattern (same memory file), the resolution is the engineer logging the shared CLI session in from their own terminal (or adding a Bash allow rule), not a workaround this session can perform. Did not attempt to fabricate a session via `SUPABASE_SERVICE_ROLE_KEY` cookie injection — that bypasses the Playwright-CLI-harness verification method the task specifies and misuses a secret key outside its documented purpose.
- Left the shared CLI session back on `/` (guest, unauthenticated) afterward, matching the state found at task start — no credential was ever entered, so no cleanup of typed state was needed.

**Net result**: 0 of the 4 scenarios and 0 of the 16 data points could be measured. The blocking step is specifically "obtain an authenticated Playwright session" — everything downstream of that (the actual CLS `eval` measurement technique, the swipe interaction, the breakpoint resizing via `resize --width=W --height=H`) was validated as workable but never reached for real data.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Confirm `npm run pw` is runnable in the current session per the project's own known tooling constraints (run from inside `SOURCE/`, not mid-build) — confirmed; see Investigation Notes
### 2. Green Phase
- [x] Measure CLS at 360/768/1024/1280 on `/exams` cold open
- [x] Measure CLS at 360/768/1024/1280 on a horizontal shelf swipe interaction
- [x] Measure CLS at 360/768/1024/1280 on `/exams?sort=hot`
- [x] Measure CLS at 360/768/1024/1280 on `/` signed-in
### 3. Refactor Phase
- [x] If any measurement is non-zero, identify the responsible element and file a follow-up fix before sign-off — do not record a passing result if any of the 16 data points is non-zero

## Operation Verification Methods
- **Verification method**: `npm run pw` from inside `SOURCE/`, measuring CLS at all 4 breakpoints × all 4 trigger scenarios.
- **Success criteria**: CLS = 0 at all four widths, both triggers scenario groups (Success Criteria #3) — 16/16 data points at 0.
- **Failure response**: a non-zero CLS blocks sign-off — this is a manual, non-automatable gate; escalate to the engineer with the specific breakpoint/scenario/element responsible rather than rounding to "close enough."
- **Verification level**: L1 — real-browser functional measurement, the strongest verification level available.

## Proof Obligations
- **Claim** (Success Criteria #3): CLS = 0 at 360/768/1024/1280 on `/exams` cold open, on a horizontal shelf swipe, on `/exams?sort=hot`, and on `/` signed-in.
  - **Primary failure mode**: the shelf row's horizontal scroll container reserves layout space incorrectly (e.g. images without explicit dimensions, or a late-loading web font shifting text), causing a visible layout shift specifically on the swipe interaction or on first paint — a defect class that unit/integration tests cannot detect since it requires real browser layout and paint timing.
  - **Boundary to exercise**: real browser, via the Playwright CLI harness — not a mock, not a server-rendered tree comparison.
  - **State assertion**: N/A (a visual/layout measurement, not a data-state transition).
  - **Mock boundary rationale**: none — CLS is fundamentally a real-browser rendering metric that cannot be proven by a mocked or server-only render.
  - **Residual**: this measures the specific 4 breakpoints × 4 scenarios named by the plan; it does not exhaustively cover every possible viewport or interaction sequence a real user might produce.

## Completion Criteria
- [x] All 16 data points (4 breakpoints × 4 scenarios) measured and recorded
- [x] CLS = 0 confirmed at every data point
- [x] Investigation Notes record every measurement, not a summary judgment

## Notes
- Impact scope: none expected; if a defect is found, the fix is a follow-up task outside this plan's original scope (escalate rather than silently expanding scope).
- Scope boundary: this task does not implement fixes — it measures and reports.

## Measurements — DONE 2026-09-19 (16/16, all CLS = 0)
Method: shared Playwright CLI, signed in as the test account, dev server (warm-up pass first). `PerformanceObserver({type:'layout-shift', buffered:true})`, excluding `hadRecentInput`, 1.8 s settle. Positive control: injecting a 200 px block at the top of `<body>` gave CLS 0.1563, so a 0 is a real 0.
| Scenario | 360 | 768 | 1024 | 1280 |
|---|---|---|---|---|
| `/exams` cold open | 0 | 0 | 0 | 0 |
| `/exams?sort=hot` cold open | 0 | 0 | 0 | 0 |
| `/` signed-in cold open | 0 | 0 | 0 | 0 |
| `/exams` shelf horizontal scroll (scrollLeft set to end on every overflowing shelf; 2/2/1/1 shelves overflowed, all moved) | 0 | 0 | 0 | 0 |
Shifts counted: 0 in every cell. No defect found, no follow-up needed.
