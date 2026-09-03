# Task: Documentation hygiene batch A — ownership and stale-open items (CL-03, CL-04, ST-02, ST-03)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.5**
Layer: **backend** (documents under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none
- Provides: an AC ownership table with no unowned and no doubly-owned criterion — read by plan Task 6.6 close-out sweep
- Size: Medium (3 documents)

## Implementation Content

**CL-03 — AC-041 and AC-050 are owned by *neither* document; each assigns them to the other. Record the owner and the current disposition together — ownership alone is not the whole item.**

- **AC-041** (the quota case must stop looking like a generic failure): assign the **error-path half to the backend document**, which is where it is decided. UI Spec UI-D3 (`:116`) already states *"it cannot be closed in this phase … the **error-path** half of AC-041 is backend work"*, and the pre-emptive display half is shipped. The binding constraint that comes with it — the four collapsed codes stay indistinguishable — is enforced by **plan Task 5.3 (backend-task-23)**, not by this documentation task.
- **AC-050** (≤3 days left ⇒ reminder in `SiteHeader`): assign ownership **and record that it is already deferred by the authoritative UI Spec** — `docs/ui-spec/subscription-ui-spec.md:404` maps it to screen **S-07, marked "deferred (P2)"**, and PRD R15 is **Should Have**. **No task in this plan implements it.** Write the deferral and its two sources into whichever document takes ownership, so a later reader does not re-open it as an unowned Must.

**CL-04** — AC-026, AC-027, AC-035, AC-036, AC-037 are claimed by both documents. Apply the split notation the backend DD **already uses for AC-028** (`FE (display) / BE (supply)`) to all five.

**ST-02** — close UI Spec TBD-07: `createOrder()` now returns the full eight-field `CheckoutOrder`.

**ST-03** — X-10, X-11 and X-12 are **already satisfied** by UI Spec v1.3 text. The frontend DD still lists them live with "text to amend" instructions that would **re-edit already-corrected text**. The fix is to **close them** (marking each "satisfied by UI Spec v1.3, no amendment outstanding"), **not** to apply them.

## Target Files
- [x] `docs/design/subscription-backend-design.md` (AC ownership table — AC-041 error-path half; the AC-026/027/035/036/037 split notation)
- [x] `docs/design/subscription-frontend-design.md` (AC ownership table; X-10 / X-11 / X-12 closure)
- [x] `docs/ui-spec/subscription-ui-spec.md` (TBD-07 closure; the AC-050 deferral cross-reference)

## Investigation Targets
- `docs/design/subscription-backend-design.md` (§ AC ownership — the existing AC-028 `FE (display) / BE (supply)` split notation is the pattern to copy)
- `docs/design/subscription-frontend-design.md` (§ AC ownership; contradiction rows X-10, X-11, X-12)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 at `:114-116`; the S-07 mapping at `:404`; TBD-07)
- `docs/prd/subscription-prd.md` (R15 — Should Have; AC-041, AC-050, AC-026, AC-027, AC-035, AC-036, AC-037)
- `SOURCE/features/exams/tutorActions.ts` (`:51` — the four-literal client-visible `ExplainStepError` union AC-041 constraint protects)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 — This phase does NOT split the four tutor error codes) | state-lifecycle-negative | **"When the backend later introduces a distinct quota code, the split must preserve `not_eligible`, `server` and `gemini_unavailable` as one indistinguishable group — that constraint is recorded for the backend phase, not resolved here."** With its rationale: *"distinguishing the codes would leak that the server re-runs an eligibility check (`not_eligible`)"* — `ExplainStepAffordance.tsx:96-99`. The client-visible union stays exactly `"not_eligible" \| "rate_limited" \| "gemini_unavailable" \| "server"` (`tutorActions.ts:51`) and all four keep rendering **one** message | The document that takes AC-041 ownership restates this constraint verbatim and names plan Task 5.3 as its enforcer, without weakening it to an implementation preference |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets; tabulate, per AC, which document currently claims it and which disclaims it
- [x] Quote UI-D3 `:116` and UI Spec `:404` verbatim for reuse in the amendment
### 2. Green Phase
- [x] Apply CL-03 (owner + disposition for AC-041 and AC-050), CL-04 (the five split notations), ST-02 (TBD-07 closed), ST-03 (X-10/X-11/X-12 marked satisfied, **not** applied)
### 3. Refactor Phase
- [x] Re-walk the three ownership tables and confirm every AC has exactly one owner or an explicit split

## Operation Verification Methods
- **Verification method**: walk both Design Docs AC ownership tables side by side and check each AC appears with exactly one owner or an explicit `FE (display) / BE (supply)` split; then grep for `X-10`, `X-11`, `X-12`, `TBD-07`.
- **Success criteria**: **no AC is unowned or doubly owned; no closed item is still listed as actionable**; AC-050 carries its deferral and both sources (UI Spec `:404` S-07 P2, PRD R15 Should Have); no already-corrected UI Spec text was re-edited.
- **Failure response**: if applying an X-1x instruction would change UI Spec v1.3 text, **stop and close the item instead** — re-editing corrected text is the specific defect ST-03 records.
- **Verification level**: L3 (document consistency).

## Proof Obligations
- **Claim**: every acceptance criterion in this feature has exactly one accountable owner, and no already-satisfied item remains actionable.
- **Primary failure mode**: AC-050 is re-opened later as an unowned Must and someone implements a deferred P2 screen; or an X-1x "text to amend" instruction is applied and corrupts corrected UI Spec text.
- **Boundary to exercise**: document-to-document consistency across the three specification documents.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: AC-041 anti-disclosure constraint is **not** enforced here — plan Task 5.3 enforces it in code; this task only records the ownership and the constraint.

## Completion Criteria
- [x] No AC is unowned or doubly owned; the five CL-04 ACs carry the AC-028 split notation
- [x] AC-041 error-path half owned by the backend DD, with the UI-D3 constraint restated and plan Task 5.3 named as enforcer
- [x] AC-050 records its owner **and** its deferral, citing UI Spec `:404` (S-07, deferred P2) and PRD R15 (Should Have); no task claims to implement it
- [x] TBD-07 closed; X-10, X-11, X-12 marked satisfied by UI Spec v1.3 with no amendment applied
- [x] The Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes

## Notes
- Impact scope: the three specification documents; downstream, plan Tasks 5.3 and 6.6.
- Scope boundary: no source file is edited; UI Spec v1.3 corrected text is **preserved verbatim**.

## Investigation Notes

### Investigation Targets read (Step 2)

| Target | What it fixed for this task |
|---|---|
| `docs/design/subscription-backend-design.md` § Acceptance Criteria Ownership | The per-AC table (57 rows) is the authoritative ownership artifact. **AC-028's cell — `FE (display) / BE (supply)` — is the notation to copy**, and its Design-element / Verification cells already name *both* halves (`BE: cold-read test (FE-B-01). FE: C-14`). The I008 paragraph above the table is where v1.4 recorded why ranges were replaced by per-AC rows. |
| `docs/design/subscription-frontend-design.md` § Acceptance Criteria Ownership | Three lists: "This document owns", "Backend owns and this document only consumes", "Already shipped, not re-owned". The first claimed AC-026/027/035/036/037 by *half* ("their rendered half"); the backend table claimed the same five unqualified. **AC-041 and AC-050 sat in the second list** while the backend table put both in **FE** — the mutual disclaim. |
| `docs/design/subscription-frontend-design.md` § Contradictions Found | X-10/X-11/X-12 each end in a **"Text to amend"** instruction written against UI Spec **v1.2** line numbers. X-1 and X-2 are the house pattern for closing a row: keep the ID, keep the problem statement, and state the closure inside the Resolution cell ("now CLOSED … **No contradiction remains**"). |
| `docs/ui-spec/subscription-ui-spec.md` § UI-D3, § AC Traceability, § Open Items | UI-D3's closing line and the AC-050 row are the two verbatim sources. TBD-07's Open-Items row still read as an open request for a backend revision that has since landed. |
| `docs/prd/subscription-prd.md` | R15 sits under the heading `### Should Have (P2)` (`:337`); R15 at `:339`, AC-050 at `:340`. AC-041 at `:319`. Confirms AC-050's requirement is **not** a Must. |
| `SOURCE/features/exams/tutorActions.ts` | `:51` — `export type ExplainStepError = "not_eligible" \| "rate_limited" \| "gemini_unavailable" \| "server";` **verified verbatim on disk**, four literals, unchanged. `ExplainStepAffordance.tsx:96-99` carries the anti-disclosure rationale; `:92-104` is the shipped pre-emptive blocked-quota branch. |

### Citation note discovered while reading

The plan's `:116` (UI-D3) and `:404` (AC-050 row) are **UI Spec v1.3 positions**. On disk at v1.4 they were already `:117` and `:407` — plan Task 0.3's UI-D17 amendment shifted them. After this pass (one Revision-History row added) they are `:118` and `:408`. Every citation written by this task therefore carries the **identifier plus a quoted phrase** (the backend DD's own v1.4 citation rule) and states both line numbers where the plan's number is the one a reader will have in hand. General version/citation drift stays plan Task 0.6's job.

### Per-AC ownership — before and after

| AC | Backend DD before | Frontend DD before | Verdict | After (both documents) |
|---|---|---|---|---|
| AC-026 | `BE — reassigned in v1.4` | owns ("display") | **doubly owned** | `FE (display) / BE (supply)`; the PRD's persisted-record assertion stays the **BE** half, so I008 is not reversed |
| AC-027 | `BE — new element in v1.4` | owns ("S-06's reuse rendering") | **doubly owned** | `FE (display) / BE (supply)` |
| AC-028 | `FE (display) / BE (supply)` | owns | already split | unchanged — it is the pattern the other rows copy |
| AC-035 | `BE` | owns ("rendered half") | **doubly owned** | `FE (display) / BE (supply)` |
| AC-036 | `BE` | owns ("rendered half") | **doubly owned** | `FE (display) / BE (supply)` |
| AC-037 | `BE` | owns ("rendered half") | **doubly owned** | `FE (display) / BE (supply)` |
| **AC-052** | `BE` | owns ("AC-052's *rendering*") | **doubly owned — found by the Refactor re-walk, not enumerated by the plan** | `FE (display) / BE (supply)`; backend derives `Quota.resetsAt`, C-06 / C-11 render it and neither recomputes it |
| AC-041 | `FE` | "Backend owns" | **unowned** | split by **path**: FE = the shipped pre-emptive display half; **BE = the error path**, with UI-D3's constraint restated verbatim and **plan Task 5.3** named as enforcer |
| AC-050 | `FE` | "Backend owns" | **unowned** | **FE**, and **deferred** — UI Spec S-07 "deferred (P2)" + PRD R15 Should Have (P2), with the explicit statement that no task in the plan implements it |

**Re-walk result (Refactor step).** All **57** AC rows parse out of the backend table; none is missing and none carries two unqualified owners. Every AC the frontend document claims is either `FE` in the backend table (AC-039, AC-042, AC-043, AC-044, AC-050, AC-051, AC-056) or an explicit split (AC-026/027/028/035/036/037/052). Every AC the backend table marks `FE` is claimed by the frontend document. **AC-052 was the only defect beyond the plan's enumerated five**; it is the same class and the same one-cell notation change, is labelled as such in both documents, and is reported to the orchestrator rather than folded in silently.

### ST-02 / ST-03 evidence

- **ST-02 (TBD-07)** — closed. `createOrder()` returns the full eight-field `CheckoutOrder` (backend DD v1.3, unchanged in v1.4). Closed in three places in the UI Spec (Open Items row, the C-13 gap note, the Open-Items footer) and the one stale place left in the frontend DD (contract-delta item 1, plus the **FE-I3** integration row which still described the four fields as a gap). **S-06's no-re-derivation prohibition is explicitly stated as surviving the closure** in every one of those places.
- **ST-03 (X-10/X-11/X-12)** — verified satisfied against UI Spec **v1.4 on disk** before closing, so nothing was taken on trust:
  - **X-10**: `grep` for "two permitted idioms" / "two existing announcement idioms" returns **nothing**; UI-D16 reads *"Announcement uses two of the repository's three shipped idioms, and creates no new region"* and the conventions section numbers the **busy** idiom **3** and the polite one **2**, matching the frontend DD. Both halves of X-10 (the false ceiling, the conflicting label) are gone.
  - **X-11**: the UI Spec now states *"These two directives are enforced in **every** environment, dev included"* with an explicit retraction of the production-only claim; UI-D14, C-12 and Environment Constraints all carry the corrected fact.
  - **X-12**: the ban is relabelled *"**this spec's stricter decision (UI-D6)**, not the codebase's rule"*, scoped to *"any new markup **of this feature**"*, with the narrower codebase rule stated beside it — i.e. the clarification X-12 escalated is **delivered**.
  - **No amendment was applied.** Each row's "text to amend" is marked historical and non-actionable in place; the intro paragraph (`:20`) and the reading note above the contradictions table now say so too. Applying them would have re-edited corrected text — the exact defect ST-03 records.

### Reference Contract — Compliance Check

| Row | Required observable value | Planned/actual approach | Result |
|---|---|---|---|
| UI Spec § UI-D3 — state-lifecycle-negative | The owning document restates the collapse constraint **verbatim** and names plan Task 5.3 as its enforcer, without weakening it to an implementation preference | `docs/design/subscription-backend-design.md` § Acceptance Criteria Ownership carries the sentence as a **block quote, byte-for-byte** from UI-D3; beside it the rationale (*"distinguishing the codes would leak that the server re-runs an eligibility check (`not_eligible`)"* — `ExplainStepAffordance.tsx:96-99`), the client-visible union `"not_eligible" \| "rate_limited" \| "gemini_unavailable" \| "server"` (`tutorActions.ts:51`, verified on disk), "all four keep rendering **one** message", the sentence **"This is a binding constraint, not an implementation preference — a passing test does not license a weaker substitute"**, and **"Its enforcer is plan Task 5.3"** with the closing statement that this pass enforces nothing in code | **Y** (planned) → **Y** (final, re-evaluated against the written text) |

### Residuals (deliberately not done here)

- The AC-041 anti-disclosure constraint is **recorded, not enforced** — plan Task 5.3 enforces it in code.
- The frontend DD's "Referenced UI Spec" and References entries still cite UI Spec **v1.2** by design (the version the design was written against). Version and citation drift, including the line shifts this pass introduces, is **plan Task 0.6**'s scope.
- The plan's LO-01/LO-02 items are **not** part of this task file (they belong to plan Task 0.6) and were not touched.
