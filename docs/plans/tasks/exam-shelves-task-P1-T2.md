# Task P1-T2 — `lib/copy.ts`: 16 new copy keys (3 destinations)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T2**
Layer: frontend (`SOURCE/lib/copy.ts`)

Metadata:
- Dependencies: none within Phase 1 (independent of P1-T1/T3/T4/T5/T6)
- Blocks: P2-T3 (ExamShelf consumes several of these keys)
- Size: Small (1 file)
- Verification level: L3 (`MessageKey` exhaustiveness)

## Implementation Content
Add the 16 new copy keys to `SOURCE/lib/copy.ts` at 3 destinations: 14 shelf/ribbon keys near `:132`; `exams.sortHot` after `exams.sortHardest` near `:505`; `home.hotExams` after `home.newExams` near `:81`. All Vietnamese literals must be copied verbatim from the UI Spec.

## Target Files
- [x] `SOURCE/lib/copy.ts`

## Investigation Targets
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Copy Keys — the full verbatim table of all 16 keys and their Vietnamese literals)
- `SOURCE/lib/copy.ts` (`:81` `home.newExams` insertion point; `:132` shelf/ribbon keys insertion point; `:505` `exams.sortHardest` insertion point)
- `SOURCE/lib/copy.ts` (the `MessageKey` type / `t()` function signature — confirms how a new key becomes typo-safe)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/ui-spec/exam-shelves-ui-spec.md (§ Copy Keys) | derived-display | The 6 `HOT_SUBTITLE` rung→string mappings: `grade-recent`→"Khối {grade}, tuần này" (AC-019); `grade-30d`→"Khối {grade}, 30 ngày qua" (AC-020); `grade-all`→"Khối {grade}, từ trước tới nay" (AC-021); `site-recent`→"Toàn hệ thống, tuần này" (AC-023); `site-30d`→"Toàn hệ thống, 30 ngày qua" (AC-023); `site-all`→"Toàn hệ thống, từ trước tới nay" (AC-022/AC-023) | Does `copy.ts` declare exactly these 6 literal strings under their corresponding keys, byte-for-byte? |
| docs/prd/exam-shelves-prd.md (§ AC-031) | derived-display | Explore subtitle literal: "Đề mới đăng, môn và trường bạn chưa thử" | Does `copy.ts` declare this exact literal under the explore-shelf subtitle key? |
| docs/prd/exam-shelves-prd.md (§ AC-012); docs/ui-spec/exam-shelves-ui-spec.md (§ Page State Matrix) | derived-display | "{subject} đang là môn điểm trung bình thấp nhất của bạn", where `{subject}` = `subjectLabel(subject)` — so `Chemistry` reads `Hóa học`, not the canvas shorthand `Hoá` | Does `copy.ts`'s template literal use the `{subject}` placeholder (interpolated via `subjectLabel()` at the call site in P2-T3), and is the surrounding sentence copied verbatim? |

## Investigation Notes
- UI Spec § Copy Keys (`docs/ui-spec/exam-shelves-ui-spec.md:248-269`) read in full: table lists exactly 16 keys with Vietnamese literals and insertion locations (14 shelf/ribbon keys under `// --- Danh sách đề ---` at `copy.ts:132`; `exams.sortHot` after `exams.sortHardest` under `// --- Bộ lọc & độ khó ---` near `copy.ts:505`; `home.hotExams` after `home.newExams` near `copy.ts:81`).
- `SOURCE/lib/copy.ts` investigated: it is a single flat `Record<string, string>` object literal (`export const copy = {...} satisfies Record<string, string>`); `MessageKey = keyof Dictionary` and `Dictionary = typeof copy` are derived automatically, so adding a new `"key": "literal"` entry is sufficient — no separate type/enum to touch. `t(key, values)` does `{name}` interpolation via regex replace and falls back to printing the raw key when a key is missing.
- Confirmed (grep) none of the 16 new keys pre-existed in `copy.ts` before this change (Red-phase check passed).
- All 16 keys added at the 3 documented insertion points, preserving existing key order/comments. Verified byte-for-byte against the UI Spec table with a script comparing each `"key": "literal"` pair in `copy.ts` against the spec's markdown table row — 16/16 matched, 0 mismatches, including diacritics (`Nổi nhất`, `Khối {grade}, từ trước tới nay`, `Đề nổi nhất`, etc.).
- `npx tsc --noEmit` run from `SOURCE/`: exit code 0, no output — `MessageKey` exhaustiveness holds project-wide. `npx eslint lib/copy.ts --max-warnings 0`: exit code 0.
- Reference Contracts re-evaluated against final implementation:
  - Row 1 (6 `HOT_SUBTITLE` rung mappings): Y — all 6 literals (`exams.shelfHotGradeWeek/Month/All`, `exams.shelfHotSiteWeek/Month/All`) match the spec's rung→string table exactly.
  - Row 2 (Explore subtitle AC-031): Y — `exams.shelfExploreSubtitle` = "Đề mới đăng, môn và trường bạn chưa thử", byte-identical.
  - Row 3 (Practice subtitle `{subject}` placeholder, AC-012): Y — `exams.shelfPracticeSubtitle` = "{subject} đang là môn điểm trung bình thấp nhất của bạn" uses the `{subject}` placeholder verbatim; interpolation via `subjectLabel()` at the P2-T3 call site is out of this task's scope per the Proof Obligations Residual note.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read the UI Spec § Copy Keys table in full and record all 16 key names + literals
- [x] Confirm none of the 16 keys already exist in `copy.ts` (no accidental duplicate)
### 2. Green Phase
- [x] Add the 14 shelf/ribbon keys near `:132`
- [x] Add `exams.sortHot` after `exams.sortHardest` near `:505`
- [x] Add `home.hotExams` after `home.newExams` near `:81`
### 3. Refactor Phase
- [x] Run `npx tsc --noEmit` and confirm no `MessageKey` errors anywhere in the codebase (this key set becomes the exhaustiveness baseline every later `t()` call in this feature checks against)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Enforces: type correctness incl. `MessageKey` validity of every new `t()` call — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx tsc --noEmit` after adding all 16 keys; diff the added literals character-by-character against the UI Spec's Copy Keys table.
- **Success criteria**: `tsc` passes with 0 errors; every literal matches the UI Spec verbatim (no re-wording, no dropped diacritics).
- **Failure response**: if a literal was copied with a typo or wrong diacritic, fix by re-copying directly from the UI Spec source — do not retype from memory.
- **Verification level**: L3 (type-check verification — these are string constants with no runtime logic of their own).

## Proof Obligations
- **Claim**: every one of the 16 new copy literals matches the UI Spec's Copy Keys table verbatim, including diacritics.
  - **Primary failure mode**: a Vietnamese literal is retyped instead of copied and drifts from the UI Spec (a dropped diacritic, a re-worded phrase) — the kind of drift that is invisible to `tsc`/`eslint` and only shows up as a wrong string on screen.
  - **Boundary to exercise**: static source comparison (this file against the UI Spec) — no runtime test exists for string-literal content at this layer.
  - **State assertion**: N/A (constant declarations, no state transition).
  - **Mock boundary rationale**: none.
  - **Residual**: this task proves the literals exist and type-check; that they render correctly in context (e.g. `{subject}` interpolation via `subjectLabel()`) is P2-T3's proof obligation.

## Completion Criteria
- [x] All 16 keys added at the 3 specified locations
- [x] Every literal matches the UI Spec § Copy Keys table verbatim
- [x] `npx tsc --noEmit` passes (MessageKey exhaustiveness)
- [x] Every Reference Contract Compliance Check evaluates to `Y`
- [x] Gates 1-6 green

## Notes
- Impact scope: `copy.ts` only — additive, no existing keys edited.
- Scope boundary — preserve unchanged: all existing keys in `copy.ts` untouched.
