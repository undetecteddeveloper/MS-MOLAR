# Task: ST-01 — reconcile FE-B-01 and FE-B-02 as closed, and unblock slice S2

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.4**
Layer: **backend** (document under `docs/**` — deterministic layer rule)

Metadata:
- Dependencies: none. **Scheduled early because it unblocks work** — the frontend Design Doc currently documents slice S2 (`/pricing/checkout`, plan Task 4.2) as un-startable.
- Provides: an accurate frontend DD Implementation Order that plan Task 4.2 (frontend-task-10) can start against
- Size: Small (1 document, four locations)

## Implementation Content

Backend Design Doc v1.4 **closes** FE-B-01 and FE-B-02. `docs/design/subscription-frontend-design.md` still carries them as blocking in **four** locations, so slice S2 reads as un-startable when it is in fact startable:

1. its Status line,
2. its "Blocking Unresolved Items" section,
3. its FE-I5 row,
4. its Implementation Order step 5.

Update all four to "closed in backend v1.4", **naming the resolution** in each, and remove the serialisation of S2 behind them.

**Leave FE-B-02 shipping condition intact as a *verification* requirement**: SVC-2 (plan Task 6.2) must pass before S-05 reaches real users. That is a genuine gate, not a design gap, and the Deployment Sequencing table depends on it.

## Target Files
- [x] `docs/design/subscription-frontend-design.md` (Status line; Blocking Unresolved Items; FE-I5 row; Implementation Order step 5)

## Investigation Targets
- `docs/design/subscription-frontend-design.md` (§ Status; § Blocking Unresolved Items; the FE-I5 integration row; § Implementation Order step 5)
- `docs/design/subscription-backend-design.md` (the v1.4 statements that close FE-B-01 and FE-B-02 — quote the resolution, do not paraphrase it)
- `docs/plans/subscription-work-plan.md` (§ Deployment Sequencing — the Phase 3 and Phase 6 rows that keep FE-B-02 as a verification gate)
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (SVC-2 — the case that discharges the retained verification gate)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets; list the four locations with their current wording
- [x] Record the exact backend v1.4 resolution sentence for each of FE-B-01 and FE-B-02
### 2. Green Phase
- [x] Update all four locations to "closed in backend v1.4" with the named resolution; de-serialise S2
- [x] Restate FE-B-02 shipping condition as a verification gate pointing at SVC-2 / plan Task 6.2
### 3. Refactor Phase
- [x] Re-read the document end to end; confirm no location still describes either item as open or blocking

## Operation Verification Methods
- **Verification method**: grep the frontend Design Doc for `FE-B-01` and `FE-B-02` and read every hit in context.
- **Success criteria**: the frontend DD Implementation Order lists S2 as startable once `createOrder()` exists (plan Task 3.4); **no document still describes either item as open**; FE-B-02 survives only as a verification gate naming SVC-2.
- **Failure response**: if a fifth location is found, amend it here — leaving one open occurrence reproduces exactly the "startable slice reads as blocked" defect this task removes.
- **Verification level**: L3 (document consistency).

## Proof Obligations
- **Claim**: slice S2 is documented as startable, and FE-B-02 survives only as a shipping-time verification gate.
- **Primary failure mode**: Phase 4 is deferred (or S-06 ships unverified) because a stale "blocking" line is read as authoritative.
- **Boundary to exercise**: document-to-document consistency.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: does not verify owner-scoping itself — SVC-2 (plan Task 6.2) does.

## Completion Criteria
- [x] All four locations updated with the named backend v1.4 resolution
- [x] The frontend DD Implementation Order lists S2 as startable once `createOrder()` exists
- [x] No document still describes FE-B-01 or FE-B-02 as open
- [x] FE-B-02 shipping condition is retained as a verification requirement pointing at SVC-2 (plan Task 6.2)

## Notes
- Impact scope: `docs/design/subscription-frontend-design.md`; downstream, the Phase 4 start decision.
- Scope boundary: no source file, no UI Spec change (UI Spec is not the source of these two items).

## Investigation Notes

**Tooling note**: `TaskCreate` / `TaskUpdate` are not available in this environment; step registration was skipped, the underlying steps below were performed in order.

### Red phase — the locations, as found (frontend DD **v1.3**, before this task)

`grep -n "FE-B-01\|FE-B-02" docs/design/subscription-frontend-design.md` returns **20** hits: **2** are Update History rows (v1.0 opening the items, v1.1 restating them — audit trail, never rewritten), **2** are the two subsection headings inside § Blocking Unresolved Items (counted with that section as one location), leaving **17 distinct live locations**. The task names four; **thirteen further live locations describe the items as open**, so the "failure response: if a fifth location is found, amend it here" clause fires:

| # | Line | Current wording (abridged) | In task's four? |
|---|---|---|---|
| 1 | `:7` Status | "Draft — **two BLOCKING UNRESOLVED ITEMS** (FE-B-01, FE-B-02) … S-06's *implementation* cannot start until FE-B-01 is answered" | yes |
| 2 | `:1100-1136` § Blocking Unresolved Items | both items written as open, with "Required input" menus and escalation conditions | yes |
| 3 | `:965` FE-I5 | "**High — DOES NOT EXIST** … **FE-B-01 — blocking.** No test can be written against a contract that has no producer" | yes |
| 4 | `:1001` Impl. Order step 5 | "**FE-B-01 answered** (backend design revision)" — a design step interposed between S1 and S2 | yes |
| 5 | `:37` Riskiest single element | "four of `CheckoutOrder`'s eight fields … are **not columns of `payment_orders`** … **FE-B-01.**" | no |
| 6 | `:63` API Schema Source row | "there is **no declared by-orderCode read** for the transfer fields (FE-B-01)" | no |
| 7 | `:269` Existing-dependency table | "**Does not exist anywhere** — **FE-B-01, BLOCKING**" | no |
| 8 | `:354` fact row `ui:09` | "The read-path gap it exposes is FE-B-01" | no |
| 9 | `:566` Decision 1 consequence | "**The backend Design Doc does not say which.** → **FE-B-02, BLOCKING for ship**" | no |
| 10 | `:880` Contract delta item 2 | "**FE-B-01, new and blocking**" | no |
| 11 | `:979` Impl. Approach Phase 2/3 | "The risk that dominates is **FE-B-01 blocking S-06 indefinitely**" | no |
| 12 | `:989` slice table, S2 row | "**Blocked on FE-B-01.** Until it is answered, S2 cannot start" — **this is the un-startable statement the plan cares about** | no (adjacent to #4) |
| 13 | `:1012` Security Considerations | "byte-identical to a nonexistent one — pending **FE-B-02**" | no |
| 14 | `:1097` Risk R-11 | "FE-B-01 **is answered by** …" (conditional future) | no |
| 15 | `:1140` Not-blocking list | "TBD-07 … **subsumed by FE-B-01** but distinct; both are needed" | no |
| 16 | `:1150` X-1 | "**Unresolvable here → FE-B-01.** … the read path that produces it does not exist" | no |
| 17 | `:1151` X-2 | "the backend contract is silent … → **FE-B-02**" | no |

### Red phase — the backend v1.4 resolutions, quoted not paraphrased

Both were resolved in backend v1.3 and stand unchanged in the on-disk **v1.4**; v1.4's own header (`:7`) states "FE-B-01 and FE-B-02 were closed in v1.3", and its § headings carry "(FE-B-01, closed in v1.3)" (`:572`) and "(FE-B-02, closed in v1.3)" (`:695`). "Closed in backend v1.4" below therefore means "closed in the backend Design Doc, current at v1.4".

- **FE-B-01** — backend `:572-694`, alternative **A** selected: *"**A — persist four columns on `payment_orders`, written at creation** (selected)"*, and (v1.3 Update History `:1377`) *"Resolved by **persisting them on `payment_orders`** (`qr_payload`, `account_number`, `account_name`, `memo`; `text not null`, no new FK), written once from the payOS **create** response, provider-call-before-insert so `not null` is enforceable and a blank transfer block is unreachable."* Consequences: *"**No new read action.** … the frontend's `getMyOrder(orderCode)` is an ordinary owner-scoped `select … .maybeSingle()` under `orders_select_own`"* (`:674`), and *"`createOrder()` returns the full `CheckoutOrder` (**TBD-07 closed**)"* (`:1377`). Under I010 (v1.4) `getMyOrder()` maps through the one exported `toCheckoutOrder()` in `lib/billing/checkoutOrder.ts` rather than an inline literal — flagged there as a cross-layer change for `design-sync`, carried in the plan as CL-01 (Task 3.5).
- **FE-B-02** — backend `:695-700`, normative contract clause, verbatim: *"`recheckOrder(orderCode)` resolves `{ settled: false, reason: \"unknown_order\" }` for an `orderCode` that does not exist **and** for one that exists but whose `user_id` is not the caller. The two are **byte-identical**: the same value, from the same branch, with the same side effects (none), the same number of provider calls (zero) and the same number of writes (zero)."* Enforced by the request-scoped `orders_select_own` read inside `recheckOrder()`, **not** inside `settleOrder()` (two triggers; the webhook has no caller identity).

### Red phase — the retained verification gate

- Work plan § Deployment Sequencing (`:358-366`): Phase 3 and Phase 4 rows both read "**and** Task 6.2 (SVC-2) before S-05 is reachable by real users, per FE-B-02's escalation condition"; the Phase 6 row repeats it. The table depends on FE-B-02 surviving as a *ship-time* gate, which is why the closure must not delete it.
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts:157-177` — SVC-2 skeleton, `@lane: service-integration-e2e`, mock boundary "nothing — real Postgres, two real sessions", payOS adapter stubbed and counted. Its header cites frontend DD FE-B-02 as its source. Plan Task 6.2 (`:762`) implements and executes it.

### Green/Refactor phase — approach and result

All **17** live locations rewritten to state the closure and name its resolution; the three Update History rows left untouched (audit trail). S2 de-serialised: the slice table's S2 row and Implementation Order step 5 now gate S2 on **code** (plan Task 3.4 `createOrder()`'s full-`CheckoutOrder` return; plan Task 3.5 `getMyOrder()` over the four persisted columns) rather than on a design answer. FE-B-02 retained in one place only, as a verification gate naming SVC-2 / plan Task 6.2, matching the work plan's Deployment Sequencing wording.

Citations deliberately **not** touched, per the task prompt: "Referenced UI Spec" and the References list keep their UI Spec **v1.2** pointers (the version this design was written against, as v1.3's Update History row states). The References line for the backend DD keeps its "v1.2 — owns the Server Actions" wording for the same reason; every statement this task adds cites backend **v1.4** explicitly at the point of use, so no reader is left inferring a version.

**Residual, outside Target Files (for downstream review)**: backend DD `:20-21` still says the frontend DD "is at **v1.1**" and that FE-B-01/FE-B-02 are "**not yet acknowledged there** — `subscription-frontend-design.md` v1.1 still carries them as open blocking items in its Status line and its 'Blocking Unresolved Items' section". After this task that sentence is stale in the *other* document. `docs/design/subscription-backend-design.md` is not in this task's Target Files, so it is left unmodified and recorded here instead.
