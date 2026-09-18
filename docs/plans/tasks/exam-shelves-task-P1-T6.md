# Task P1-T6 — `lib/exams/browseParams.ts` (`hasBrowseParam`)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T6**
Layer: backend/shared (`SOURCE/lib/exams/`)

Metadata:
- Dependencies: none within Phase 1
- Blocks: P5-T1 (the `/exams` page branch predicate consumes this module directly)
- Size: Small (2 files)
- Verification level: L2

## Implementation Content
Create `SOURCE/lib/exams/browseParams.ts` (`BROWSE_PARAM_KEYS` — the ten AC-008 keys named once — and `hasBrowseParam(sp)`). Create `SOURCE/lib/exams/__tests__/browseParams.test.ts`.

## Target Files
- [ ] `SOURCE/lib/exams/browseParams.ts` (new)
- [ ] `SOURCE/lib/exams/__tests__/browseParams.test.ts` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Implementation Path Mapping — `lib/exams/browseParams.ts` row)
- `docs/design/exam-shelves-frontend-design.md` (§ Data flow "Branch rule" — `hasBrowseParam(sp)` consumption at the page)
- `docs/prd/exam-shelves-prd.md` (§ AC-008 — the exact 10 listed URL params)
- `SOURCE/app/(exams)/exams/page.tsx` (`:37-123` current `searchParams` handling — the raw `sp` object shape this predicate reads from)

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Ten AC-008 listed URL params → `hasBrowseParam(sp)`. Owner left: browser-supplied URL (address bar, bookmark, shelf's own header/tile links). Owner right (this task): `lib/exams/browseParams.ts`, consumed by `app/(exams)/exams/page.tsx` (P5-T1). Serialized format: URL query string, raw key presence — not parsed value. Consumer parse rule: `key in sp && sp[key] !== undefined` on the raw `searchParams` object. Expected signal: `?sort=garbage`/`?page=abc`/`?dir=asc` all render the flat grid despite normalising to `undefined` downstream.

## Investigation Notes
_(Record here: the exact 10 keys named in `BROWSE_PARAM_KEYS`, cross-checked against PRD AC-008; confirmation the predicate reads raw key presence, never a normalised local.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write failing cases: `hasBrowseParam` is `true` for `?sort=garbage`, `?page=abc`, `?dir=asc`, and `?q=` (empty); `false` only for a genuinely bare URL (no listed keys present at all)
- [ ] Confirm they fail because the module does not yet exist
### 2. Green Phase
- [ ] Implement `BROWSE_PARAM_KEYS` (the 10 AC-008 keys, named once) and `hasBrowseParam(sp)` reading raw key presence
- [ ] Run tests and confirm all pass
### 3. Refactor Phase
- [ ] Confirm the predicate never reads a normalised/parsed local — only `key in sp && sp[key] !== undefined`

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `lib/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run lib/exams/__tests__/browseParams.test.ts`, exercising every one of the 10 AC-008 keys individually plus the malformed-value cases.
- **Success criteria**: every one of the 10 keys, present with any value (including malformed/garbage), makes `hasBrowseParam` return `true`; only a URL with none of the 10 keys returns `false`.
- **Failure response**: if a malformed value (e.g. `?sort=garbage`) returns `false`, the predicate is reading a normalised/parsed value instead of raw key presence — fix by switching the check to raw key presence, per the Boundary Context's Consumer Parse Rule.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (F-005, boundary row expected signal): `hasBrowseParam` is `true` for `?sort=garbage`, `?page=abc`, `?dir=asc`, and `false` only for a genuinely bare URL.
  - **Primary failure mode**: the predicate is written against normalised locals instead of raw keys, so a bookmarked/hand-edited URL with a garbage value silently renders shelves instead of the flat grid (the work plan's own named Risk).
  - **Boundary to exercise**: in-process unit test, one case per AC-008 key plus malformed-value variants.
  - **State assertion**: N/A (pure function).
  - **Mock boundary rationale**: none.
  - **Residual**: this proves the predicate itself; that the page (P5-T1) actually consumes it correctly, and that the fixture-e2e lane (P5-T2) proves it table-driven end-to-end, are separate obligations.
- **Claim** (Failure Mode: empty input): `?q=` (present but empty) still counts as a listed param — `hasBrowseParam` returns `true`.
  - **Primary failure mode**: an empty-string value is treated as "absent" by an `sp[key]` truthiness check instead of a presence check, making a cleared search box silently switch back to shelves.
  - **Boundary to exercise**: in-process unit test.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [ ] All added tests pass, covering all 10 AC-008 keys plus malformed-value cases
- [ ] `hasBrowseParam` confirmed to read raw key presence only
- [ ] Gates 1-6 green

## Notes
- Impact scope: `browseParams.ts` (new), its test file (new).
- Scope boundary: this module has 0 dependency on `lib/adaptive` or any DB access — pure URL-shape predicate only.
