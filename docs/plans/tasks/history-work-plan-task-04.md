# Task 04: `(HM)/layout.tsx` + `(HM)/history/page.tsx` Auth Guard (Work Plan Phase 1, Task 1.3)

Metadata:
- Dependencies: history-work-plan-task-03 (Deliverable: `SOURCE/app/(HM)/queries.ts` — `listMyHistory()`)
- Provides: `(HM)/layout.tsx` + `(HM)/history/page.tsx` with a temporary placeholder render (real render added by Task 14)
- Size: Small (2 files)

## Implementation Content

Create `SOURCE/app/(HM)/layout.tsx` (nullable-user `SiteHeader` shell, no redirect — mirrors `(layer3)/layout.tsx`/`(layer4)/layout.tsx` structurally) and `SOURCE/app/(HM)/history/page.tsx` (page-level auth guard: `getCurrentUser()` + `redirect("/?auth=signin")` before any fetch, mirroring `(layer4)/upload/page.tsx:8-10`; then calls `listMyHistory()`).

**Build-ordering note (explicit resolution, preserved from the Work Plan)**: the backend DD's own code sample has `history/page.tsx` return `<HistoryList entries={entries} />`, but `HistoryList` doesn't exist until Task 13 (Phase 4). To keep the build green through Phases 1-3, this task creates the guard + fetch with a temporary minimal render — **decision: return `null`** (not a placeholder string/div) from `HistoryPage` after the guard passes and `listMyHistory()` resolves, so there is no visible-but-wrong UI to later confuse a manual QA pass; a one-line code comment states this is temporary, replaced by Task 14. Task 14 (`history-work-plan-task-14.md`) adds the real `HistoryList` import + render line, matching the frontend DD's own stated scope ("one line added to backend-authored `history/page.tsx`").

## Target Files
- [x] `SOURCE/app/(HM)/layout.tsx` (new)
- [x] `SOURCE/app/(HM)/history/page.tsx` (new, temporary placeholder render)

## Investigation Targets
- `SOURCE/app/(layer4)/upload/page.tsx` (lines 1-17 — the exact page-level auth-guard shape to mirror verbatim)
- `SOURCE/app/(layer3)/layout.tsx` (the exact route-group layout shape to mirror verbatim — nullable user, `SiteHeader` only, no redirect)
- `SOURCE/app/(layer4)/layout.tsx` (second precedent, confirm structural identity with `(layer3)/layout.tsx`)
- `SOURCE/lib/auth/getCurrentUser.ts` (lines 6-20, 26-52 — `getCurrentUser()`/`getCurrentUserProfile()` signatures)
- `SOURCE/app/(HM)/queries.ts` (this task's dependency — `listMyHistory()`'s signature, produced by Task 03)
- `docs/design/history-backend-design.md` (§ Auth Guard and Layout — the exact code excerpt this task must match; § Security Considerations)
- `docs/design/history-backend-design.md` (§ Agreement Checklist / Scope) — Design Traceability
- `docs/ui-spec/history-ui-spec.md` (§ D6 — `(HM)` route-group layout decision; § D7 — loading/error boundary ownership, confirming this task does not own `loading.tsx`/`error.tsx`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-backend-design.md` (§ Acceptance Criteria — AC-016) | state-lifecycle-negative | `"Given a logged-out visitor, when they navigate to /history, then history/page.tsx's guard redirects to /?auth=signin before listMyHistory() is ever called (zero attempt rows fetched)."` | Does the guard redirect to `/?auth=signin` before `listMyHistory()` is ever invoked for a logged-out request (zero attempt rows fetched)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations — in particular, confirm `(layer3)/layout.tsx` and `(layer4)/layout.tsx` are structurally identical before copying the pattern.
- [x] There is no automated test precedent for this exact guard pattern (matches the untested `(layer4)/upload/page.tsx` precedent, noted explicitly in the backend DD as not a gap) — this task is verified manually, not via a new automated test; skip to a manual-verification plan instead of writing a failing automated test.

### 2. Green Phase
- [x] Implement `(HM)/layout.tsx` exactly per the backend DD's Auth Guard and Layout code.
- [x] Implement `(HM)/history/page.tsx`'s guard + `listMyHistory()` call + temporary `return null` placeholder (with the one-line "replaced by Task 14" comment), exactly per the backend DD's code with the placeholder substitution documented above.

### 3. Refactor Phase
- [x] Confirm `tsc`/lint pass; confirm no unused imports remain from the temporary placeholder.

## Investigation Notes

**Investigation Targets read** (all, in full, before implementation):
- `(layer4)/upload/page.tsx:1-17` — exact page-level guard shape: `const user = await getCurrentUser(); if (!user) redirect("/?auth=signin");` runs as the first two statements of the async Server Component, strictly before any other logic/render.
- `(layer3)/layout.tsx:1-22` and `(layer4)/layout.tsx:1-22` — confirmed **structurally identical** (byte-diff: only the file-header comment text and the exported function name differ; both call `getCurrentUserProfile()` (nullable), render `<div className="min-h-dvh"><SiteHeader user={user} />{children}</div>`, and neither redirects). Safe to copy this exact structure for `(HM)/layout.tsx`.
- `SOURCE/lib/auth/getCurrentUser.ts:6-20` (`getCurrentUser()` — returns Supabase `user | null`, used for the page-level guard) and `:26-52` (`getCurrentUserProfile()` — returns `CurrentUserProfile | null` with `displayName`, used for the layout's `SiteHeader`). Both already swallow Supabase connectivity errors internally and return `null` — no additional error handling needed at the call sites.
- `SOURCE/app/(HM)/queries.ts:16` — `listMyHistory(): Promise<MyHistoryEntry[]>` — no parameters, confirmed ready to import from Task 03's deliverable.
- `docs/design/history-backend-design.md` § Auth Guard and Layout (lines 442-477) — exact code excerpt for both files; this task's implementation matches it verbatim except for the documented `return null` placeholder substitution (HistoryList doesn't exist until Task 13/14) and its accompanying one-line comment.
- `docs/design/history-backend-design.md` § Security Considerations (lines 657-661) and § Agreement Checklist (lines 57-77) — confirms the guard-before-fetch requirement (AC-016) and that this task's scope is exactly "new `(HM)/layout.tsx` + `(HM)/history/page.tsx` page-level auth guard, then calls `listMyHistory()`" — no schema/RLS/UI-component work in scope here.
- `docs/ui-spec/history-ui-spec.md` D6 (line 61) — confirms layout renders `SiteHeader` only with nullable user, guard lives in `history/page.tsx` per the `(layer4)/upload/page.tsx` precedent. D7 (line 62) — confirms `loading.tsx`/`error.tsx` are frontend-owned (not this task's scope).

**Reference Contract Check** (pre-implementation and Exit Gate re-evaluation):

| Source | Required Observable Value | Planned/Actual Approach | Evaluation | Rationale |
|---|---|---|---|---|
| `docs/design/history-backend-design.md` § Acceptance Criteria — AC-016 | Guard redirects to `/?auth=signin` before `listMyHistory()` is ever called (zero attempt rows fetched) for a logged-out visitor. | `HistoryPage` calls `const user = await getCurrentUser(); if (!user) redirect("/?auth=signin");` as the first two statements, with `listMyHistory()` called only afterward on the line following the guard — no code path reaches `listMyHistory()` before the guard check. | Y | `redirect()` throws (Next.js `NEXT_REDIRECT` signal) and halts execution immediately; the guard is textually and control-flow-wise strictly prior to the `listMyHistory()` call, matching the `(layer4)/upload/page.tsx` precedent exactly. Manually verified via `npm run dev` guest request (see Operation Verification Methods) — confirmed no `listMyHistory()`/Supabase network activity before the redirect. |

Result: **Y** — no escalation required.

**Verification re-run (resumed session)**: `tsc --noEmit` and `eslint app/(HM)/layout.tsx app/(HM)/history/page.tsx` both pass with zero output. `npm run dev` + `curl -D - http://localhost:3000/history` (no cookies) returned `HTTP/1.1 307 Temporary Redirect` with `location: /?auth=signin` — confirms the guard fires and redirects a guest before any page content renders, consistent with `listMyHistory()` never executing (it sits strictly after the `redirect()` call, which throws `NEXT_REDIRECT` and halts execution).

**Similar Function Duplication check** (Step 3 of Mandatory Judgment Criteria): `(HM)/layout.tsx` and `(HM)/history/page.tsx` are intentionally pattern-copies of `(layer3)/(layer4) layout.tsx` and `(layer4)/upload/page.tsx` respectively — this is the explicit, DD-mandated approach (structural mirroring), not an undisclosed duplication; the backend DD's own Auth Guard and Layout section prescribes copying this exact shape. No escalation — this is the intended reuse-by-mirroring pattern already established in the codebase for route-group layouts and page-level guards.

**Core Mechanism Preservation**: the guard-runs-strictly-before-fetch mechanism (AC-016) is preserved exactly — no simplification, no reordering, no bypass. The only deviation from the DD's literal code sample is the documented, DD-anticipated placeholder substitution (`return null` instead of `return <HistoryList entries={entries} />`, since `HistoryList` does not exist until Task 13/14) — this substitution does not touch the guard/fetch ordering mechanism itself.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide

## Operation Verification Methods
- **Verification method**: manual `npm run dev` hit of `/history` as a guest (no session) and as a logged-in seeded user.
- **Success criteria**: guest request redirects to `/?auth=signin` with zero attempt-row fetch observable (browser network tab / log inspection shows `listMyHistory()` never runs); logged-in request reaches the page without error (renders nothing visible, per the temporary placeholder).
- **Failure response**: if a guest request ever triggers `listMyHistory()` before the redirect, reorder the guard to run strictly first — this is a security-relevant ordering bug, not a cosmetic one.
- **Verification level**: L1 (manual functional verification of the guard, per the plan's own Completion criterion — no existing automated test for this exact pattern).

## Proof Obligations
- **Claim**: AC-016 — a logged-out visitor's request to `/history` is redirected to `/?auth=signin` before `listMyHistory()` is ever called.
  - **Primary failure mode**: the guard is bypassed, missing, or runs after (not before) the data fetch, causing a guest request to trigger `listMyHistory()` or reach rendered content.
  - **Boundary to exercise**: integration (real Next.js route, manual `npm run dev` session) — no automated test exists for this exact guard pattern in this repo (matches the untested `(layer4)/upload/page.tsx` precedent).
  - **State assertion**: before — guest, no session cookie; action — navigate to `/history`; after — final URL is `/?auth=signin`, zero attempt-row network/log activity observed.
  - **Mock boundary rationale**: none — real session/no-session state, manually verified.
  - **Residual**: no automated regression guard exists for this exact ordering; a future refactor could silently reorder the guard and fetch without a failing test catching it — flagged, matching the repo's own accepted precedent for `(layer4)/upload/page.tsx`.

## Completion Criteria
- [x] Guard + layout match the backend DD's Auth Guard and Layout code exactly (Implementation)
- [x] `tsc`/lint clean (Quality)
- [x] Manual `npm run dev` hit of `/history` as a guest confirms redirect with zero fetch (Integration)
- [x] Every Reference Contract Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/app/(HM)/layout.tsx`, `SOURCE/app/(HM)/history/page.tsx` only.
- Scope boundary: do not create `HistoryList`/`HistoryRow`/`loading.tsx`/`error.tsx` here — those are Task 13. The placeholder render (`return null`) is intentional and temporary, replaced by Task 14.
