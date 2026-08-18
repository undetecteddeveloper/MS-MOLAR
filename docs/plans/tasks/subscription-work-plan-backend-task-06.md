# Task: Documentation hygiene batch B — citation drift and state-set narrowing (ST-04, ST-05, CL-05, CL-06, LO-01, LO-02)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.6**
Layer: **backend** (documents under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none. Best run after backend-task-03/04/05 so their edits are included in the citation sweep.
- Provides: **one** source for C-13 Empty/Partial state sets — consumed by plan Task 4.3 (frontend-task-11)
- Size: Medium (3 documents)

## Implementation Content

- **ST-04, ST-05, CL-05, CL-06** — version and line-citation drift across all three documents. Apply the backend DD own v1.4 citation rule: **cite the identifier plus a quoted phrase** for artifacts under concurrent revision, rather than a bare line number that goes stale on the next edit.
- **LO-01 / LO-02** — UI Spec C-13 Empty and Partial states are **narrower** than the frontend DD, which is a **strict superset**. Record the **superset** as the implemented behaviour in the UI Spec, so plan Task 4.3 has one source. Concretely, C-13 Partial must cover `paid` / `expired` / `cancelled` **and an unrecognised status**, in all of which neither the QR nor the transfer block renders; C-13 Empty must cover no `?order=` param, an unparseable param, an unknown order and a **foreign** order — as one shared state.

## Target Files
- [x] `docs/ui-spec/subscription-ui-spec.md` (C-13 Empty/Partial state sets; cross-document version references) — **v1.5 → v1.6**
- [x] `docs/design/subscription-frontend-design.md` (version + citation references) — **v1.5 → v1.6**
- [x] `docs/design/subscription-backend-design.md` (version + citation references) — **v1.5 → v1.6**
- [x] `docs/plans/subscription-work-plan.md` (§ Related Documents versions; the two citations plan Task 0.5's own edits invalidated) — **v1.2 → v1.3**. Not a Target File of this task; edited under the allowed-list entry for the referenced work plan, and limited to the two items handed to this task

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — verify default (`pending`) + loading + empty + error + partial states)
- `docs/design/subscription-frontend-design.md` (§ Main Components — C-13 Empty/Partial description; the Status/version header)
- `docs/design/subscription-backend-design.md` (the v1.4 citation rule; the Status/version header)
- `docs/plans/subscription-work-plan.md` (§ Related Documents — the version numbers this sweep must leave consistent)

> **⚠ The version list originally written on the line above was already stale when this task started, and was not trusted.** It read "backend DD v1.4, frontend DD v1.2, UI Spec v1.3, PRD v1.6"; plan Tasks 0.3, 0.4 and 0.5 had since moved the first three to **v1.5 / v1.5 / v1.5**, which is what was read from the file headers at execution time. Every version in this task file and in the work plan was re-read from disk rather than taken from any document's prose — see **Investigation Notes N1**. Post-task state: backend DD **v1.6**, frontend DD **v1.6**, UI Spec **v1.6**, work plan **v1.3**, PRD **v1.6** (unchanged).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets; list every cross-document version/line citation and mark the stale ones — **Investigation Notes N1 and N3**; five drift classes recorded, including two the task brief did not name (the `.claude/MEMORY.md` citations that never resolved, and the version list in this task file itself)
- [x] Write out both C-13 state sets side by side and confirm the frontend DD set is a strict superset — **Investigation Notes N2**. Superset confirmed in both rows (Empty 3 ⊂ 4, Partial 3 ⊂ 4, no case contradicted), so the escalation branch did **not** fire
### 2. Green Phase
- [x] Refresh the stale citations using identifier + quoted phrase
- [x] Record the superset C-13 Empty/Partial sets in the UI Spec
### 3. Refactor Phase
- [x] Re-read both C-13 descriptions and confirm they are now identical in content — diffed clause by clause after the edit; both now state four Empty cases (no param / unparseable / unknown / foreign, one shared state, indistinguishable on purpose) and four Partial cases (`paid` / `expired` / `cancelled` / unrecognised, no QR and no transfer block, status + `orderCode` + link to `/me/orders`). Default, Loading and Error were already identical. The UI Spec additionally states that C-10's re-check control stays available on an unrecognised status; that is not a divergence — the frontend DD states the same rule in Decision 3's affordance table (*"C-10 re-check control | **always**, in every status including unrecognised"*)

## Operation Verification Methods
- **Verification method**: diff the two C-13 state descriptions clause by clause; then spot-check each refreshed citation by opening the cited document and confirming the quoted phrase exists.
- **Success criteria**: cross-document version references are current; **C-13 Empty/Partial state sets are identical in both documents**; every refreshed citation carries a quoted phrase that resolves.
- **Failure response**: if the two C-13 sets cannot be merged as superset/subset, record an escalation row instead of choosing — a state-set choice is a design decision this plan does not make.
- **Verification level**: L3 (document consistency).

## Proof Obligations
- **Claim**: plan Task 4.3 has exactly one source for C-13 Empty and Partial behaviour.
- **Primary failure mode**: the implementer follows the narrower UI Spec set, and an unrecognised status renders the QR and transfer block on a non-payable order.
- **Boundary to exercise**: document-to-document consistency.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: does not verify the rendered states — plan Task 4.3 tests and FE-1 (plan Task 4.6) do.

## Completion Criteria
- [x] Cross-document version references are current. *(The parenthesised list originally here — "backend DD v1.4, frontend DD v1.2, UI Spec v1.3, PRD v1.6" — was stale on arrival and is not the target state; see the warning under Investigation Targets.)* **Post-task**: backend DD **v1.6**, frontend DD **v1.6**, UI Spec **v1.6**, PRD **v1.6**, work plan **v1.3**. The frontend DD's UI Spec pointer is the one deliberate exception — **kept pinned at v1.2 with the current version and the full v1.3→v1.6 delta enumerated at the point of citation**, decided under Investigation Notes N4
- [x] C-13 Empty/Partial state sets are identical in the UI Spec and the frontend Design Doc, recorded as the superset
- [x] Every refreshed citation uses identifier + quoted phrase and resolves against the cited document — verified by searching each cited document for the quoted phrase

## Notes
- Impact scope: the three specification documents; downstream, plan Task 4.3.
- Scope boundary: no source file is edited; no C-13 behaviour is invented — only the existing superset is recorded.

## Investigation Notes

*Recorded at execution time (plan Task 0.6). Tooling note: `TaskCreate` / `TaskUpdate` do not exist in this environment, so step registration was skipped; the underlying Red/Green/Refactor work was performed and is recorded here.*

### N1 — The version set in this task file's Investigation Targets was stale before execution began

The Investigation Targets line reads "backend DD v1.4, frontend DD v1.2, UI Spec v1.3, PRD v1.6". Read from disk at execution time, **before** any edit by this task:

| Document | Version on disk | Last changed by |
|---|---|---|
| `docs/design/subscription-backend-design.md` | **1.5** | plan Task 0.5 |
| `docs/design/subscription-frontend-design.md` | **1.5** | plan Tasks 0.3 → 1.3, 0.4 → 1.4, 0.5 → 1.5 |
| `docs/ui-spec/subscription-ui-spec.md` | **1.5** | plan Tasks 0.3 → 1.4, 0.5 → 1.5 |
| `docs/prd/subscription-prd.md` | 1.6 | unchanged |
| `docs/plans/subscription-work-plan.md` | 1.2 | unchanged |

This is itself an instance of ST-04/ST-05: **no version number written in any document of this corpus — including this task file and the work plan — was trusted; every one was read from the file header.** The three preceding hygiene tasks each shifted the set, which is the third shift in five tasks.

### N2 — C-13 state sets, written side by side (Red phase, LO-01 / LO-02)

| State | UI Spec C-13 (v1.5, § State × Display Matrix) | Frontend DD C-13 (v1.5, **States**) | Relation |
|---|---|---|---|
| Empty | no `?order=`; unknown `orderCode`; an order belonging to someone else — **3 cases** | no param; **unparseable param**; unknown; not yours — **4 cases** | frontend DD is a superset (adds *unparseable*) |
| Partial | `paid` / `expired` / `cancelled` — **3 cases** | `paid` / `expired` / `cancelled` / **unrecognised** — **4 cases** | frontend DD is a superset (adds *unrecognised*) |

**Strict superset confirmed in both rows** — every UI Spec case appears in the frontend DD set, and the frontend DD adds exactly one case to each. No case in the UI Spec is absent from, or contradicted by, the frontend DD. The failure branch in Operation Verification Methods ("record an escalation row instead of choosing") therefore does **not** fire; the merge is a widening, not a design decision.

The two added cases are already decided elsewhere in the UI Spec, so recording them in C-13 introduces no new behaviour:
- *unrecognised status* — **UI-D15** already specifies a fifth badge appearance for it and states the money-affordance consequence; the frontend DD's Decision 3 gates C-13's QR + transfer block on `status === "pending"` and nothing else, which yields Partial for an unrecognised value automatically.
- *unparseable `?order=`* — **UI-D11** already fixes order identity as a search param and makes "no order / not my order" one state of one page rather than a 404, and the frontend DD already carries the disposition as an acceptance criterion (**FE-AC-20**, *"absent, unparseable, names no order, or names another user's order … one shared 'no active payment in progress' state"*) plus an explicit accept-list rule (§ Field Propagation Map, `orderCode`: *"Anything else — including a non-string — ⇒ C-13's Empty state, **not** an error and **not** a 404"*). *Mechanism correction (QA):* an unparseable value does **not** "produce no row through the same read" — `payment_orders.order_code` is a `bigint`, so the value is rejected by the accept-list **before** any read, whereas a foreign or non-existent code does reach the read and returns no row. Both land in Empty, so the merge stands, but the reason differs per case and the UI Spec sentence stating the single mechanism was corrected.

### N3 — Citation inventory (Red phase, ST-04 / ST-05 / CL-05 / CL-06)

Stale items found, grouped by class:

1. **Cross-document version pointers.** Backend DD to frontend DD "**v1.1**" (its Referenced Documents block, § Architecture Overview and Integration Point I7) and to UI Spec "**v1.2**"; frontend DD References to backend DD "**v1.2**" and to UI Spec "**v1.2**"; UI Spec header row to backend DD "**(v1.2)**"; work plan § Related Documents to backend DD "v1.4", frontend DD "v1.2", UI Spec "v1.3".
2. **A false factual claim carried by a version pointer.** Backend DD § Referenced Documents, *"not yet acknowledged there"*: it states the frontend DD still carries FE-B-01/FE-B-02 as open and still specifies an inline camelCase mapping. Both were closed by plan Task 0.4 (frontend DD v1.4), which recorded the residual as the backend document's to correct. This is the hand-off item, and it is a **content** defect, not a numbering one.
3. **Line-number drift into the UI Spec.** Bare `:NNN` citations into the UI Spec written before its v1.3 no longer resolve — spot-checked at 36 cited positions, of which 30 landed on a blank line, a table separator or an unrelated section. The frontend DD's fact-disposition rows `ui:01`…`ui:12` and eleven further citations are in this class; so are the backend DD's § Referenced Documents, § Frontend-scope boundary, § S-06's read path, § Architecture Overview and I7.
4. **Line-number drift caused by plan Task 0.5 specifically.** UI-D3's *"the error-path half of AC-041 is backend work"* moved `:116` → `:118`, and the AC-050 traceability row moved `:404` → `:408`. The backend DD's AC-050 row (written by Task 0.5) already carries both numbers and the quoted text; the **work plan** carries only the old numbers, in three places (§ Task 0.5 body twice, § Phase Completion Criteria once).
5. **Citations into `.claude/MEMORY.md` that never resolved.** The UI Spec cites `:103` / `:104` / `:105` / `:106` / `:116` for the hard colour rules; that file is **112 lines long**, so `:116` does not exist at all, and the other four are each exactly 4 lines ahead of the rule they name (`:99` / `:100` / `:101` / `:102`). The frontend DD had already recorded the `:116` half as non-existent at its v1.1 (D006) without the UI Spec being corrected — the same one-sided-correction pattern X-13 was raised for.

**Deliberately not touched (audit trail).** Update History / Revision History rows in all three documents, and the closed contradiction rows **X-10 / X-11 / X-12** in the frontend DD. Those record what a past revision asserted, including its line numbers; re-pinning them would rewrite the audit trail, and plan Task 0.5 (ST-03) already marked X-10…X-12 historical and non-actionable. The backend DD's own v1.1 row says the same of its numbers in as many words.

### N4 — The deliberate exception: the frontend DD's UI Spec pin. **Decision: keep the pin, and make its rationale explicit and current at the point of citation.**

The frontend DD's "Referenced UI Spec" heading and its References list point at **UI Spec v1.2**, the version its design was written against; its v1.3 row states this is intentional and its v1.4 and v1.5 rows re-affirm it. Task 0.6 owns the call, so it is decided here rather than carried a fourth time.

**Chosen: keep v1.2 as the *designed-against* version, and name the current version beside it.** Reasons:

1. The pin carries information that an updated number would destroy — *which* version's decisions this design consumed. That is the fact a reader needs in order to check whether a design conclusion still follows from its premises.
2. The pin is verifiably safe. Every change the UI Spec made after v1.2 is already reflected in this document: **v1.3**'s three corrections are the frontend DD's own X-10/X-11/X-12, closed at its v1.5; **v1.4**'s UI-D17 / C-06 amendment is the frontend DD's own X-13, which it raised and had already applied to itself at its v1.3; **v1.5**'s TBD-07 closure and AC-050 traceability owner are recorded in the frontend DD at v1.4 and v1.5 respectively. The delta between UI Spec v1.2 and v1.5 is therefore empty *for this document*, and that enumeration is what gets written at the citation.
3. What was defective was not the number but its **silence**: a bare "v1.2" beside a file whose header reads a later number is indistinguishable from staleness, and each of the last three passes had to re-litigate it from an Update History row. Naming the current version and the enumerated delta at the point of citation removes the ambiguity permanently and costs one clause.

**Not extended to the backend DD pointer in the same References list.** That one is updated to current, because it is a different case: the frontend DD's design *depends on* backend content that did not exist at backend v1.2 — the four persisted transfer columns closing FE-B-01 arrived in backend v1.3. A "v1.2" pointer there names a contract that cannot support this document's C-13, so it is stale rather than provenance-bearing.

### N5 — Applied citation form

The backend DD's rule adopted at its v1.4 (§ "Citation rule adopted in v1.4"): *"when a cited artifact is itself under revision, cite the identifier plus a quoted phrase, and treat the line number as a convenience that may rot."* Every citation refreshed by this task drops the bare line number and cites the **identifier** (`UI-D11`, `C-13`, `AC-027`, or a section heading) plus a **quoted phrase** from the cited text. Numbers are retained only where the cited artifact is source code under `SOURCE/`, which the rule exempts, or where a number is being recorded *as history*.

### N6 — Out of scope, observed and left alone

The work plan's § Phase Completion Criteria still shows `[ ]` for two criteria whose owning tasks (0.3, 0.5) are marked `[x]` — "UI Spec UI-D17 / C-06 delta amended; frontend `ui:06` corrected; X-13 recorded" and the AC-050 deferral line. That is a progress-sync residual of those tasks, not a citation or version defect, so this task corrects only the stale `:404` citation inside the second line and leaves both checkbox states as it found them.
