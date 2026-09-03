# ADR-0007 AI Metadata Intake — Functional Entry Mode and the Validation-Gate Shift

## Status

Proposed — 2026-07-20. **Amends** ADR-0004 (pipeline shape: adds a third extractor), PRD R2/AC-003 (metadata is no longer author-typed in the default mode), UI Spec S-01, and Design Doc §v2.1. Records the decision to read exam metadata from the uploaded question file with AI, and the architectural consequence that follows from doing so without a confirmation stop: **the metadata validity gate moves from upload-time to publish-time.**

## Context

### The already-shipped promise

`SOURCE/features/authoring/components/EntryModeField.tsx` ships an **Entry Mode** dropdown with two values, `Automatic` and `Manual`. The Automatic option displays, to every author, the sentence:

> "AI will scan your uploaded files and extract the exam automatically — you can still edit any field."

The component's own header comment records the truth:

> `THUẦN UI: cả 2 giá trị hiện tại gọi CHUNG một action thật (extractAndAssemble) — backend chưa có nhánh nhập tay riêng, "Manual" chỉ đổi ghi chú hiển thị (HIDDEN-FEATURES #2, #3).`

So the control is inert: both values run the identical pipeline, and in both the author must type all seven metadata fields by hand. This ADR is therefore not net-new scope — it is **closing a gap between what the UI already tells the author and what the system does.**

### The redundant work

`extractAndAssemble` today calls `validateExamMeta()` before anything else and rejects on missing `title`/`subject`/`grade`/`durationMinutes` (PRD AC-003). The author types those values while looking at a document that already prints all of them. Vietnamese exam papers carry the full metadata block in the first ~15 lines, in a near-fixed shape:

```
SỞ GD&ĐT ...                         → school (department)
TRƯỜNG THPT ...                      → school (preferred over department)
ĐỀ KIỂM TRA CUỐI HỌC KÌ I            → title, semester
Môn: Toán  –  Lớp 12                 → subject, grade
Năm học: 2024 – 2025                 → schoolYear
Thời gian làm bài: 90 phút           → durationMinutes
```

This is a materially **easier** extraction problem than `extractQuestions` — a short, conventional, single-page header versus a multi-page multi-part question body. Low risk, high friction removed.

### Why the confirmation stop was rejected

A two-phase flow (scan header → author confirms metadata → then extract questions) was considered and rejected by the product owner (2026-07-20): it reintroduces a typing/confirming stop into the very flow labelled "Automatic". The accepted shape is a **straight-through pipeline** — the author picks two files, presses Extract once, and corrects everything (metadata and questions alike) in the existing mandatory review at S-03.

That choice has a consequence that is the real substance of this ADR, below.

## Decision

### 1. A third server-side extractor: `extractMeta`

A separate AI call, not a widening of `extractQuestions`:

- **Model**: `gemini-3.1-flash-lite` (the cheap model already used by `extractAnswers`).
- **Input**: the **question file, first page only** — PDF page 1, or the whole image for image uploads.
- **Output**: a structured `ExtractedMeta` in which **every field is nullable**. `null` means "not printed on the page" and is the required answer when the value is absent. The prompt forbids inference: the model may not guess a school, a year, or a duration that is not written down.
- **Isolation rationale**: keeping it out of `extractQuestions` means a metadata miss cannot degrade question extraction and vice versa; the two have independent failure modes, independent prompts, independent fixtures, and very different cost profiles. It also keeps an already-large multimodal contract from growing further.

It runs **in parallel** with `extractQuestions` and `extractAnswers` (all three read files that are already uploaded and are mutually independent), so it adds no wall-clock latency to the pipeline.

### 2. Entry Mode becomes functional

| Mode | Metadata at upload | Metadata source | Gate |
|------|--------------------|-----------------|------|
| `Automatic` (default) | Optional — the fields may be left empty | `extractMeta`, normalized by code; author edits at S-03 | **Publish-time** |
| `Manual` | Required — current v2.1 behaviour, unchanged | Author-typed; `extractMeta` is not called | **Upload-time** (unchanged) |

Manual is preserved verbatim so the existing gate, its tests, and the "reject before any AI call" cost guard remain exercised and available.

### 3. The validation-gate shift (the load-bearing decision)

In `Automatic` mode there is no metadata in hand when the pipeline starts, so the v2.0 principle *"validate metadata before any AI call"* cannot hold there. It narrows:

- **Before any AI call**, `extractAndAssemble` still validates **files** — MIME type, byte size, page count (`limits.ts`). The cost guard against sending junk to a paid API is intact; it was always the file check that carried that weight, not the title field.
- **Metadata validity becomes a precondition of `publishExam()`**, joining the assembly-cleanliness precondition already there. An exam with a missing or invalid required field cannot be published; it sits in `review` exactly as an exam with a mis-read question does.
- The mechanism is the one already built: a new `META_INCOMPLETE` / `META_INVALID` error code flows through `UgcError` → `errorCopy` → `ExtractionErrorPanel`, and `PublishBar` is disabled while it stands. **No new gate concept is introduced** — the metadata problem is expressed in the same vocabulary as a wrong choice count.

### 4. AI metadata is advisory; the author confirms

Consistent with ADR-0004's standing rule that raw AI output is never the final persisted truth:

- Extracted metadata is **written to the exam row** (so the row is coherent and reviewable) but is **marked as AI-proposed** in the review UI so the author can see what they did not type.
- The author is **not** required to touch each field. The existing mandatory review plus the explicit Publish action *is* the confirmation, exactly as it already is for AI-extracted stems and choices — those are not per-field-acknowledged either. Requiring per-field acknowledgement would contradict the word "Automatic" for no security gain, since metadata is descriptive, not authoritative like the answer key.

### 5. Normalization is pure code, never the model's job

`normalizeMeta.ts` (pure, unit-tested) sits between the extractor and the database and is the only writer of metadata derived from AI:

- `grade` outside `MIN_GRADE..MAX_GRADE` → `null` (never clamped into range — a clamp would fabricate data)
- `durationMinutes` outside `MIN_DURATION..MAX_DURATION` → `null`
- `schoolYear`: a printed range `2024 – 2025` yields the **starting year**, `2024`; outside `MIN_YEAR..MAX_YEAR` → `null`
- `semester`: `HỌC KÌ I`/`HK1`/`I` → `"HK1"`, `HỌC KÌ II`/`HK2`/`II` → `"HK2"`, anything else → `null`
- `school`: when both a department (`SỞ GD&ĐT …`) and a school (`TRƯỜNG …`) are printed, the **school** wins
- `title`: the printed exam-title line; if absent, composed from the fields that are present (`"Đề kiểm tra cuối học kì I — Toán 12"`); trimmed and truncated to `MAX_TITLE`
- Every string trimmed and truncated to its `limits.ts` bound

Out-of-range therefore degrades to "the author fills it in", never to a DB `CHECK` violation. The model's output cannot reach a column without passing through this function.

### 6. Fail-soft

`extractMeta` failure is **non-fatal to the upload**. On AI error, schema-validation failure, or an all-null result, the pipeline continues to questions and answers; the exam is created with a **provisional title derived from the question filename**, lands in `review`, and carries `META_INCOMPLETE` in the error panel. An author whose header did not parse still gets their 22 extracted questions — they type six fields instead of losing the run.

### Kill criterion

On the real-file fixture set (the official 2025 Toán paper already used for ADR-0006, plus at least two school-format term papers), `extractMeta` must populate **`subject`, `grade`, and `durationMinutes` correctly on a majority of files**, with zero fabricated values on files where a field is genuinely absent. Fabrication (inventing a school or a year that is not printed) is a **hard fail**: it is worse than `null`, because `null` is visibly empty at review while a plausible wrong value is not. If fabrication appears, tighten the prompt's null-discipline before shipping; if correctness stays low, demote Automatic from the default rather than expanding scope.

## Consequences

**Positive**

- The Entry Mode control stops lying; the shipped UI promise is met.
- The dominant manual step of the flow disappears in the default mode — the author supplies two files and reviews.
- No new gate vocabulary: metadata problems reuse `UgcError` → `errorCopy` → `ExtractionErrorPanel` → disabled `PublishBar`, all already built and tested.
- Parallel execution means zero added wall-clock latency; the cheap model plus a single page means negligible added cost.
- Manual mode retains the upload-time gate, so that path and its tests are not lost.

**Negative**

- `publishExam()` gains a precondition and therefore a new failure path to test — the shift is real work, not a rename.
- The question file's first page is sent to the API twice (once cheaply for the header, once fully for the questions). Accepted deliberately for isolation; the duplicated payload is one page on the cheapest model.
- `exams` rows now transit a state where required metadata is provisional or absent. Contained: such rows are `processing`/`review`, author-confined by RLS, and unpublishable by decision 3 — no incomplete exam can reach the catalog.
- PRD AC-003 is no longer universally true and must be split per mode.

**Neutral**

- Metadata extraction quality is not a launch gate the way answer fidelity is. Metadata is descriptive; a wrong duration is visible and one keystroke from fixed, whereas a wrong answer key silently corrupts every attempt. The asymmetry is intentional and is why per-field acknowledgement was declined.

## Related Information

- Inert control being made real: `SOURCE/features/authoring/components/EntryModeField.tsx` (HIDDEN-FEATURES #2, #3)
- Gate being moved: `validateExamMeta()` in `SOURCE/lib/ugc/validateInput.ts`, called from `extractAndAssemble` (`SOURCE/features/authoring/actions.ts:121`)
- Provider, model ids, and structured-output protocol: ADR-0006 (`gemini-3.1-flash-lite` is the established cheap-model choice)
- Advisory-AI / author-confirmation principle: ADR-0004; Design Doc §AI Extraction & Assembly
- Error-surfacing machinery reused: Design Doc §Error-code → review-panel copy; UI Spec §ExtractionErrorPanel, §PublishBar
- Related but distinct: PRD R17 (early garbage rejection, P3) — a *rejection* pre-check, not an *intake* step; unaffected by this ADR
